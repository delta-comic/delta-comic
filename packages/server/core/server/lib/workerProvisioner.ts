export interface PluginWorkerCode {
  compatibilityDate: string
  mainModule: string
  modules: Record<string, { js: string }>
  env?: Record<string, unknown>
  limits?: { cpuMs?: number; subRequests?: number }
}

export interface PluginWorkerEntrypoint {
  fetch(request: Request): Response | Promise<Response>
}

export interface PluginWorkerLoader {
  load(code: WorkerLoaderWorkerCode): { getEntrypoint(): PluginWorkerEntrypoint }
}

export interface PluginWorkerDispatcher {
  get(
    name: string,
    bindings?: Record<string, unknown>,
    options?: { limits?: { cpuMs?: number; subRequests?: number } },
  ): PluginWorkerEntrypoint
}

export interface PluginWorkerProvisionInput {
  installationId: string
  pluginId: string
  code: PluginWorkerCode
}

export interface PluginWorkerProvisioner {
  provision(input: PluginWorkerProvisionInput): Promise<PluginWorkerEntrypoint>
}

const installationIdPattern = /^[A-Za-z0-9._:-]+$/

const assertInstallationId = (installationId: string): void => {
  if (!installationIdPattern.test(installationId)) {
    throw new TypeError('installationId contains invalid characters')
  }
}

export class CloudflarePluginWorkerProvisioner implements PluginWorkerProvisioner {
  public constructor(private readonly loader: PluginWorkerLoader) {}

  public async provision(input: PluginWorkerProvisionInput): Promise<PluginWorkerEntrypoint> {
    assertInstallationId(input.installationId)
    if (!input.pluginId.trim()) throw new TypeError('pluginId is required')
    const worker = this.loader.load({
      ...input.code,
      env: { ...input.code.env, INSTALLATION_ID: input.installationId, PLUGIN_ID: input.pluginId },
    })
    return worker.getEntrypoint()
  }
}

export class UnavailablePluginWorkerProvisioner implements PluginWorkerProvisioner {
  public async provision(_input: PluginWorkerProvisionInput): Promise<PluginWorkerEntrypoint> {
    throw new Error('Workers for Platforms runtime provisioning is unavailable')
  }
}

export class CloudflareDispatchWorkerProvisioner implements PluginWorkerProvisioner {
  public constructor(
    private readonly dispatcher: PluginWorkerDispatcher,
    private readonly limits: { cpuMs?: number; subRequests?: number } = {
      cpuMs: 50,
      subRequests: 50,
    },
  ) {}

  public async provision(input: PluginWorkerProvisionInput): Promise<PluginWorkerEntrypoint> {
    assertInstallationId(input.installationId)
    if (!input.pluginId.trim()) throw new TypeError('pluginId is required')
    return this.dispatcher.get(
      input.installationId,
      { INSTALLATION_ID: input.installationId, PLUGIN_ID: input.pluginId },
      { limits: input.code.limits ?? this.limits },
    )
  }
}

export class PluginWorkerRuntimeRegistry {
  readonly #workers = new Map<string, PluginWorkerEntrypoint>()

  public constructor(private readonly provisioner: PluginWorkerProvisioner) {}

  public async provision(input: PluginWorkerProvisionInput): Promise<PluginWorkerEntrypoint> {
    const worker = await this.provisioner.provision(input)
    this.#workers.set(input.installationId, worker)
    return worker
  }

  public async dispatch(installationId: string, request: Request): Promise<Response> {
    const worker = this.#workers.get(installationId)
    if (!worker) return new Response('Plugin installation is unavailable', { status: 404 })
    return await worker.fetch(request)
  }

  public remove(installationId: string): void {
    this.#workers.delete(installationId)
  }

  public list(): readonly string[] {
    return [...this.#workers.keys()]
  }
}