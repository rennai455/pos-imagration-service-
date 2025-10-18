import { FastifyRequest, FastifyReply } from 'fastify';
import crypto from 'crypto';

interface WebhookConfig {
  secret: string;
  headerName: string;
  algorithm: string;
}

const webhookConfigs: Record<string, WebhookConfig> = {
  'stripe': {
    secret: process.env.STRIPE_WEBHOOK_SECRET || '',
    headerName: 'stripe-signature',
    algorithm: 'sha256'
  },
  'square': {
    secret: process.env.SQUARE_WEBHOOK_SECRET || '',
    headerName: 'x-square-hmac-signature',
    algorithm: 'sha256'
  }
};

export async function verifyWebhookSignature(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const source = request.headers['x-webhook-source'] as string;
  const config = webhookConfigs[source];

  if (!config) {
    request.log.error({ source }, 'Unknown webhook source');
    return reply.status(400).send({ error: 'Unknown webhook source' });
  }

  const signature = request.headers[config.headerName] as string;
  if (!signature) {
    request.log.error({ source }, 'Missing signature header');
    return reply.status(400).send({ error: 'Missing signature' });
  }

  const rawBody = request.rawBody as Buffer;
  const timestamp = request.headers['x-webhook-timestamp'] as string;
  
  const calculatedSignature = crypto
    .createHmac(config.algorithm, config.secret)
    .update(timestamp + '.' + rawBody)
    .digest('hex');

  if (signature !== calculatedSignature) {
    request.log.error({ 
      source,
      expected: calculatedSignature,
      received: signature 
    }, 'Invalid webhook signature');
    return reply.status(401).send({ error: 'Invalid signature' });
  }

  // Add verified source to request for downstream handlers
  request.webhookSource = source;
}