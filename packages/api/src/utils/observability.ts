import { randomUUID } from "crypto";
import type { FastifyRequest, FastifyReply } from "fastify";

// Request correlation middleware
export async function requestCorrelation(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const requestId = 
    (request.headers['x-request-id'] as string) || 
    (request.headers['x-correlation-id'] as string) || 
    randomUUID();

  // Add request ID to headers
  reply.header('x-request-id', requestId);
  
  // Add to request context for logging
  (request as any).requestId = requestId;
  
  // Extract tenant ID if available
  const tenantId = request.headers['x-tenant-id'] as string;
  if (tenantId) {
    (request as any).tenantId = tenantId;
  }
}

// Enhanced logging context
export function createLoggerContext(request: FastifyRequest) {
  return {
    requestId: (request as any).requestId,
    tenantId: (request as any).tenantId,
    method: request.method,
    url: request.url,
    userAgent: request.headers['user-agent'],
    ip: request.ip,
  };
}