import 'fastify'

declare module 'fastify' {
  interface FastifyRequest {
    startTime?: [number, number] // process.hrtime() return type
    rawBody?: Buffer // Raw request body for webhook signature verification
    webhookSource?: string // Verified webhook source
  }
}