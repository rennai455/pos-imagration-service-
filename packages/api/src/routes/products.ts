import { prisma } from "@codex/db";
import { FastifyInstance } from "fastify";
import { z } from "zod";

import { verifyAuth } from "../plugins/auth";

const productSchema = z
  .object({
    name: z.string().min(1, "Name is required"),
    price: z.coerce.number().gt(0, "Price must be a positive number"),
    stock: z.coerce.number().int().min(0, "Stock must be a non-negative integer"),
    description: z.string().optional(),
    barcode: z.string().optional(),
  })
  .strict();

export default async function (server: FastifyInstance) {
  server.get("/", { preHandler: verifyAuth }, async (req) =>
    prisma.product.findMany({ where: { storeId: req.user!.storeId } }),
  );

  server.post("/", { preHandler: verifyAuth }, async (req, reply) => {
    const parsed = productSchema.safeParse(req.body);

    if (!parsed.success) {
      const errors = parsed.error.errors.map((error) => ({
        path: error.path.join("."),
        message: error.message,
      }));

      return reply.code(400).send({ error: "Validation failed", details: errors });
    }

    const product = await prisma.product.create({
      data: {
        ...parsed.data,
        storeId: req.user!.storeId,
        description: parsed.data.description ?? null,
        barcode: parsed.data.barcode ?? null,
      },
    });

    reply.code(201).send(product);
  });
}
