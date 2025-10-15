import { FastifyInstance } from "fastify";
import { prisma } from "@codex/db";

interface ProductInput {
  name: string;
  price: number;
  stock: number;
  storeId: string;
  description?: string;
  barcode?: string;
}

export default async function (server: FastifyInstance) {
  server.get("/", async () => prisma.product.findMany());

  server.post("/", async (req, reply) => {
    const data = req.body as Partial<ProductInput>;

    if (!data || typeof data !== "object") {
      return reply.code(400).send({ error: "Invalid payload" });
    }

    const required: (keyof ProductInput)[] = ["name", "price", "stock", "storeId"];
    const missing = required.filter((field) => data[field] === undefined || data[field] === null);

    if (missing.length > 0) {
      return reply
        .code(400)
        .send({ error: `Missing required fields: ${missing.join(", ")}` });
    }

    const price = Number(data.price);
    const stock = Number(data.stock);

    if (!Number.isFinite(price) || price < 0) {
      return reply.code(400).send({ error: "Price must be a positive number" });
    }

    if (!Number.isInteger(stock) || stock < 0) {
      return reply.code(400).send({ error: "Stock must be a non-negative integer" });
    }

    const product = await prisma.product.create({
      data: {
        name: data.name!,
        price,
        stock,
        storeId: data.storeId!,
        description: data.description ?? null,
        barcode: data.barcode ?? null,
      },
    });

    reply.code(201).send(product);
  });
}
