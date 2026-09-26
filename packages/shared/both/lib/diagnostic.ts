export interface DiagnosticRecord {
  id: string
  timestamp: number
  level: 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal'
  source: string
  message: string
  details?: Record<string, unknown>
}

export interface SystemMetrics {
  memoryUsage: number
  activePluginsCount: number
  timestamp: number
}