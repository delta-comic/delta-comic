import { Elysia } from 'elysia'
import { CloudflareAdapter } from 'elysia/adapter/cloudflare-worker'

const app = new Elysia({ adapter: CloudflareAdapter })

export default app.compile()