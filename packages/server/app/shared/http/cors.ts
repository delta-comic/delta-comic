import { cors as elysiaCors } from '@elysiajs/cors'
import type Elysia from 'elysia'

export const cors = elysiaCors({
  allowedHeaders: ['content-type', 'authorization'],
  maxAge: 86_400,
  methods: ['DELETE', 'GET', 'PATCH', 'POST', 'OPTIONS'],
  origin: true,
  preflight: true,
}) as unknown as Elysia