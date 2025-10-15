import { FastifyReply, FastifyRequest } from "fastify";

import { verifyToken } from "../utils/token";

export async function verifyAuth(req: FastifyRequest, reply: FastifyReply) {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return reply.code(401).send({ error: "Missing token" });
  }

  try {
    const token = authHeader.replace(/^Bearer\s+/i, "");
    const decoded = verifyToken(token) as FastifyRequest["user"];
    req.user = decoded;
  } catch {
    return reply.code(401).send({ error: "Invalid token" });
  }
}

declare module "fastify" {
  interface FastifyRequest {
    user?: { id: string; storeId: string; email: string };
  }
}
