import { FastifyRequest as BaseFastifyRequest } from 'fastify'

declare module 'fastify' {
  export interface FastifyRequest extends BaseFastifyRequest {
    startTime?: [number, number] // process.hrtime() return type
  }
}