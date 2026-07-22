export const LOG_LEVELS = ['trace', 'debug', 'info', 'warn', 'error'] as const

export type LogLevel = (typeof LOG_LEVELS)[number]
export type LogLevelFilter = 'all' | LogLevel

export interface LogFileInfo {
  archived: boolean
  modifiedAt: number
  name: string
  path: string
  size: number
}

export interface LogReadResult {
  content: string
  path: string
  size: number
  truncated: boolean
}

interface ParsedLogEntry {
  level?: LogLevel
  scope?: string
  text: string
}

const LOG_ENTRY_PATTERN =
  /^\[\d{4}\/\d{2}\/\d{2}\s+\d{2}:\d{2}:\d{2}\]\s+\(([^)]*)\)\s+(trace|debug|info|warn|error)\s+>/i

const parseLogEntries = (content: string): ParsedLogEntry[] => {
  const entries: ParsedLogEntry[] = []

  for (const line of content.split('\n')) {
    const match = LOG_ENTRY_PATTERN.exec(line)
    if (match) {
      entries.push({ level: match[2]?.toLowerCase() as LogLevel, scope: match[1], text: line })
      continue
    }

    const previous = entries.at(-1)
    if (previous) previous.text += `\n${line}`
    else entries.push({ text: line })
  }

  return entries
}

export const filterLogContent = (
  content: string,
  level: LogLevelFilter,
  scopeQuery: string,
): string => {
  const normalizedScope = scopeQuery.trim().toLocaleLowerCase()
  if (level === 'all' && !normalizedScope) return content

  return parseLogEntries(content)
    .filter(entry => {
      const matchesLevel = level === 'all' || entry.level === level
      const matchesScope =
        !normalizedScope || entry.scope?.toLocaleLowerCase().includes(normalizedScope)
      return matchesLevel && matchesScope
    })
    .map(entry => entry.text)
    .join('\n')
}

export const formatLogFileSize = (bytes: number): string => {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  const unitIndex = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  const value = bytes / 1024 ** unitIndex
  return `${value >= 10 || unitIndex === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[unitIndex]}`
}