import { FastifyInstance } from "fastify";

export default async function (server: FastifyInstance) {
  server.get("/health", async () => ({ status: "ok" }));
}
