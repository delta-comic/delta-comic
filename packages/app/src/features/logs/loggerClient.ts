import { TauriLoggerClient } from '@delta-comic/logger'

import type { LogFileInfo, LogReadResult } from './model'

export interface LogReaderClient {
  exportLogs: (paths?: string[]) => Promise<string>
  listLogFiles: () => Promise<LogFileInfo[]>
  readLogFile: (path: string) => Promise<LogReadResult>
}

const nativeClient = new TauriLoggerClient()

export const loggerClient: LogReaderClient = {
  exportLogs: paths => nativeClient.exportLogs({ paths }),
  listLogFiles: async () =>
    (await nativeClient.listLogFiles()).map(file => ({
      ...file,
      modifiedAt: new Date(file.modifiedAt).getTime(),
    })),
  readLogFile: path => nativeClient.readLogFile(path),
}