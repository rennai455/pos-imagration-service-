import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { register } from '../utils/metrics';

export default async function configureMetrics(fastify: FastifyInstance): Promise<void> {
  fastify.get('/metrics', async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      const metrics = await register.metrics();
      reply.type(register.contentType).send(metrics);
    } catch (error) {
      reply.status(500).send(error);
    }
  });
}
