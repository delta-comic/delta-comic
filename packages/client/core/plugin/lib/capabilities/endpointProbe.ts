export interface EndpointProbeCandidate<T> {
  readonly test: (url: string, signal: AbortSignal) => PromiseLike<void>
  readonly url: string
  readonly value: T
}

export interface EndpointProbeResult<T> {
  readonly latencyMs: number
  readonly url: string
  readonly value: T
}

const probeOne = async <T>(
  candidate: EndpointProbeCandidate<T>,
  parentSignal: AbortSignal,
  timeoutMs: number,
  controllers: Set<AbortController>,
) => {
  const controller = new AbortController()
  controllers.add(controller)
  const relayAbort = () => controller.abort(parentSignal.reason)
  parentSignal.addEventListener('abort', relayAbort, { once: true })
  const timeout = setTimeout(
    () => controller.abort(new Error('endpoint probe timed out')),
    timeoutMs,
  )
  const startedAt = performance.now()
  try {
    await candidate.test(candidate.url, controller.signal)
    return { latencyMs: performance.now() - startedAt, url: candidate.url, value: candidate.value }
  } finally {
    clearTimeout(timeout)
    parentSignal.removeEventListener('abort', relayAbort)
    controllers.delete(controller)
  }
}

/** Probe independently in parallel and stop remaining attempts after the first reachable endpoint. */
export const selectFastestEndpoint = async <T>(
  candidates: readonly EndpointProbeCandidate<T>[],
  signal: AbortSignal,
  timeoutMs = 10_000,
): Promise<EndpointProbeResult<T> | undefined> => {
  signal.throwIfAborted()
  const controllers = new Set<AbortController>()
  try {
    return await Promise.any(
      candidates.map(candidate => probeOne(candidate, signal, timeoutMs, controllers)),
    )
  } catch (error) {
    signal.throwIfAborted()
    if (error instanceof AggregateError) return undefined
    throw error
  } finally {
    for (const controller of controllers)
      controller.abort(new Error('another endpoint was selected'))
  }
}