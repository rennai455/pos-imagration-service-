import { FastifyInstance } from "fastify";

export default async function (server: FastifyInstance) {
  server.get("/", async () => ({ 
    status: "Codex API running",
    version: process.env.npm_package_version || "unknown"
  }));

  // Test endpoint that should be rate limited
  server.get("/test", async () => ({ 
    status: "ok",
    timestamp: new Date().toISOString()
  }));
}
