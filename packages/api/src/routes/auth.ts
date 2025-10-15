import { FastifyInstance } from "fastify";
import { supabase } from "../plugins/supabase";

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

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return reply.code(401).send({ error: error.message });
    }

    return reply.send({
      session: data.session,
      user: data.user,
    });
  });
}
