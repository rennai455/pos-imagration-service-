import { FastifyInstance } from "fastify";
import { prisma } from "../prisma/client";

export default async function (server: FastifyInstance) {
  server.get("/", async () => prisma.product.findMany());

  server.post("/", async (req, reply) => {
    const data = req.body as any;
    const product = await prisma.product.create({ data });
    reply.code(201).send(product);
  });
}
