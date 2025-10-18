import { FastifyInstance } from 'fastify';
import { prisma } from '../lib/db';
import { generateIdempotencyKey } from '../utils/reliability';
import { ingestLatencySeconds } from '../utils/metrics';

export default async function (server: FastifyInstance) {
  server.post('/:source/ingest', async (req, reply) => {
    const source = (req.params as any).source as string;
    const tenantId = (req.headers['x-tenant-id'] as string) || 'anonymous';
    const start = process.hrtime();

    const body = req.body as any;
    const idempotencyKey = (req.headers['idempotency-key'] as string) || generateIdempotencyKey({ tenantId, source, body });

    try {
      await prisma.idempotency.create({ data: { tenantId, key: idempotencyKey } });
    } catch (e: any) {
      // Unique constraint violation => treat as duplicate; return 204/200 without reprocessing
      if (e?.code === 'P2002') {
        const diff = process.hrtime(start);
        const seconds = diff[0] + diff[1] / 1e9;
        ingestLatencySeconds.observe({ tenant_id: tenantId, source }, seconds);
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

