import Fastify from "fastify";
import productRoutes from "./routes/products";
import authRoutes from "./routes/auth";

const server = Fastify({ logger: true });

server.register(productRoutes, { prefix: "/api/products" });
server.register(authRoutes, { prefix: "/api/auth" });

server.get("/", async () => ({ status: "Codex API running" }));

const start = async () => {
  try {
    await server.listen({ port: 4000, host: "0.0.0.0" });
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

start();
