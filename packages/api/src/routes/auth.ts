import { prisma } from "@codex/db";
import { FastifyInstance } from "fastify";

import { supabase } from "../plugins/supabase";
import { signToken } from "../utils/token";

interface AuthRequestBody {
  email: string;
  password: string;
}

export default async function (server: FastifyInstance) {
  server.post("/login", async (req, reply) => {
    const { email, password } = req.body as AuthRequestBody;

    if (!email || !password) {
      return reply.code(400).send({ error: "Email and password are required" });
    }

    // Sign in with retry using decorrelated jitter
    const { retry } = await import('../utils/reliability');
    const { data, error } = await retry(
      async () => {
        const res = await supabase.auth.signInWithPassword({ email, password });
        if (res.error && (res.error.status && (res.error.status >= 500 || res.error.status === 429))) {
          const e: any = new Error(res.error.message);
          e.status = res.error.status;
          throw e;
        }
        return res;
      },
      { attempts: 3, baseDelay: 300, maxDelay: 2000, jitter: true, labels: { service: 'supabase', tenant: 'unknown' } }
    );

    if (error) {
      return reply.code(401).send({ error: error.message });
    }

    const existing = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        storeId: true,
        createdAt: true,
      },
    });

    if (!existing) {
      return reply
        .code(404)
        .send({ error: "User not found in tenant database" });
    }

    const token = signToken({
      id: existing.id,
      email: existing.email,
      storeId: existing.storeId,
    });

    return reply.send({
      token,
      user: existing,
      session: data.session,
    });
  });
}
