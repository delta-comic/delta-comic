import type { PluginInstallInput, PluginSourceResolver, ResolvedPluginSource } from './contracts'

export class LocalFileSourceResolver implements PluginSourceResolver {
  public readonly id = 'local-file'

  public matches(input: PluginInstallInput): input is File {
    return typeof input !== 'string'
  }

  public async resolve(input: PluginInstallInput): Promise<ResolvedPluginSource> {
    if (typeof input === 'string') throw new TypeError('local file resolver requires a File')
    return { file: input, installInput: '', resolverId: this.id }
  }
}

export class HttpSourceResolver implements PluginSourceResolver {
  public readonly id = 'http'

  public matches(input: PluginInstallInput): input is string {
    return typeof input === 'string' && /^https?:\/\//i.test(input)
  }

  public async resolve(
    input: PluginInstallInput,
    signal: AbortSignal,
  ): Promise<ResolvedPluginSource> {
    if (typeof input !== 'string') throw new TypeError('HTTP resolver requires a URL')
    const response = await fetch(input, { signal })
    if (!response.ok) throw new Error(`plugin download failed: ${response.status}`)
    const name = new URL(input).pathname.split('/').at(-1) || 'plugin.zip'
    return {
      file: new File([await response.blob()], name),
      installInput: input,
      resolverId: this.id,
    }
  }
}