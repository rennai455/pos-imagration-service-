import { FastifyInstance } from 'fastify';
import { prisma } from '../lib/db';
import { generateIdempotencyKey } from '../utils/reliability';
import { ingestLatencySeconds, ingestDedupTotal } from '../utils/metrics';
import crypto from 'crypto';

/**
 * Verify HMAC signature for webhook payloads
 */
function verifyHMAC(payload: string, signature: string, secret: string): boolean {
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
  
  // Compare signatures (case-insensitive hex comparison)
  return signature.toLowerCase() === expectedSignature.toLowerCase();
}

export default async function (server: FastifyInstance) {
  server.post('/:source/ingest', async (req, reply) => {
    const source = (req.params as any).source as string;
    const tenantId = (req.headers['x-tenant-id'] as string) || 'anonymous';
    const start = process.hrtime();

    // Verify HMAC signature before processing
    const signature = req.headers['x-webhook-signature'] as string;
    const webhookSecret = process.env.WEBHOOK_SECRET;
    
    if (!webhookSecret) {
      server.log.error('WEBHOOK_SECRET not configured');
      return reply.code(500).send({ error: 'Server configuration error' });
    }
    
    if (!signature) {
      return reply.code(401).send({ error: 'Missing X-Webhook-Signature header' });
    }
    
    const payload = JSON.stringify(req.body);
    if (!verifyHMAC(payload, signature, webhookSecret)) {
      server.log.warn({ tenantId, source }, 'Invalid HMAC signature');
      return reply.code(403).send({ error: 'Invalid signature' });
    }

    const body = req.body as any;
    const idempotencyKey = (req.headers['idempotency-key'] as string) || generateIdempotencyKey({ tenantId, source, body });

    try {
      await prisma.idempotency.create({ data: { tenantId, key: idempotencyKey } });
    } catch (e: any) {
      // Unique constraint violation => treat as duplicate; return 204 without reprocessing
      if (e?.code === 'P2002') {
        const diff = process.hrtime(start);
        const seconds = diff[0] + diff[1] / 1e9;
        ingestLatencySeconds.observe({ tenant_id: tenantId, source }, seconds);
        ingestDedupTotal.inc({ tenant: tenantId, source });
        return reply.code(204).send();
      }
      throw e;
    }

    // Simulate successful ingest (wire actual processing here)
    const diff = process.hrtime(start);
    const seconds = diff[0] + diff[1] / 1e9;
    ingestLatencySeconds.observe({ tenant_id: tenantId, source }, seconds);
    return reply.code(201).send({ status: 'accepted' });
  });
}


