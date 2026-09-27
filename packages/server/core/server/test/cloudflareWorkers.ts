export abstract class WorkerEntrypoint<Env = Cloudflare.Env, Props = object> {
  protected constructor(
    protected readonly ctx: ExecutionContext<Props>,
    protected readonly env: Env,
  ) {}
}