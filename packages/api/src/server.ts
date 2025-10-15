import "dotenv/config";

import cors from "@fastify/cors";
import Fastify, { FastifyInstance } from "fastify";

import authRoutes from "./routes/auth";
import productRoutes from "./routes/products";

const createServer = (): FastifyInstance =>
  Fastify({
    logger: {
      transport:
        process.env.NODE_ENV === "development"
          ? {
              target: "pino-pretty",
              options: {
                colorize: true,
                translateTime: "SYS:standard",
              },
            }
          : undefined,
    },
  });

export const buildServer = async (): Promise<FastifyInstance> => {
  const server = createServer();

  server.setErrorHandler((err, req, reply) => {
    server.log.error(err);
    reply.code(500).send({ error: "Internal Server Error" });
  });

  await server.register(cors, {
    origin: true,
  });

  await server.register(productRoutes, { prefix: "/api/products" });
  await server.register(authRoutes, { prefix: "/api/auth" });

  server.get("/", async () => ({ status: "Codex API running" }));

  return server;
};

const start = async () => {
  const server = await buildServer();

  try {
    await server.listen({ port: 4000, host: "0.0.0.0" });
    server.log.info("Codex API running");
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

if (require.main === module) {
  start().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
