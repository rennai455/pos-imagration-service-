import "dotenv/config";

import cors from "@fastify/cors";
import Fastify from "fastify";

import authRoutes from "./routes/auth";
import productRoutes from "./routes/products";

const server = Fastify({
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

const configure = async () => {
  await server.register(cors, {
    origin: true,
  });

  await server.register(productRoutes, { prefix: "/api/products" });
  await server.register(authRoutes, { prefix: "/api/auth" });

  server.get("/", async () => ({ status: "Codex API running" }));
};

const start = async () => {
  try {
    await configure();

    const port = Number(process.env.PORT ?? 4000);
    const host = process.env.HOST ?? "0.0.0.0";

    await server.listen({ port, host });
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

start();
