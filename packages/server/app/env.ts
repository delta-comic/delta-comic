/**
 * Wrangler owns bindings and non-secret vars through the generated global Env type.
 * Secret bindings are declared here because Wrangler deliberately does not write them to config.
 */
export interface AppEnv extends Env {
  AUTH_PEPPER?: string
  SERVER_ADMIN_TOKEN?: string
  TOKEN_PEPPER?: string
}

export interface AppRuntime {
  env: AppEnv
  ctx: ExecutionContext
}

const runtimeByRequest = new WeakMap<Request, AppRuntime>()

export const bindRuntime = (request: Request, runtime: AppRuntime) => {
  runtimeByRequest.set(request, runtime)
}

export const getRuntime = (request: Request): AppRuntime => {
  const runtime = runtimeByRequest.get(request)
  if (!runtime) throw new Error('Delta Comic server runtime is not bound to this request')
  return runtime
}

export const readNumberVar = (value: string | undefined, fallback: number): number => {
  if (!value) return fallback
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback
  return parsed
}