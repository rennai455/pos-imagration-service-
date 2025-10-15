import { prisma } from "@codex/db";
import { FastifyInstance } from "fastify";
import { z } from "zod";

const productSchema = z
  .object({
    name: z.string().min(1, "Name is required"),
    price: z.coerce.number().gt(0, "Price must be a positive number"),
    stock: z.coerce.number().int().min(0, "Stock must be a non-negative integer"),
    storeId: z.string().min(1, "Store ID is required"),
    description: z.string().optional(),
    barcode: z.string().optional(),
  })
  .strict();

export default async function (server: FastifyInstance) {
  server.get("/", async () => prisma.product.findMany());

  server.post("/", async (req, reply) => {
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
        description: parsed.data.description ?? null,
        barcode: parsed.data.barcode ?? null,
      },
    });

    reply.code(201).send(product);
  });
}
