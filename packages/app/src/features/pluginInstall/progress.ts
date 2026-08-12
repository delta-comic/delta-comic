import type { PluginInstallProgress } from '@delta-comic/plugin'

const phaseRanges = { resolve: [0, 70], decode: [70, 90], persist: [90, 100] } as const

export function pluginInstallProgressPercentage(progress: PluginInstallProgress): number {
  const [start, end] = phaseRanges[progress.phase]
  const phaseProgress = Math.min(100, Math.max(0, progress.progress ?? 0))
  return start + ((end - start) * phaseProgress) / 100
}