export interface RecordedD1Statement {
  sql: string
  values: unknown[]
}

interface QueuedRunResult {
  changes?: number
}

export class D1Recorder {
  readonly statements: RecordedD1Statement[] = []
  readonly batches: RecordedD1Statement[][] = []
  readonly firstResults: unknown[] = []
  readonly allResults: unknown[][] = []
  readonly runResults: QueuedRunResult[] = []

  readonly db = {
    batch: async (statements: D1PreparedStatement[]) => {
      this.batches.push(
        statements.map(statement => {
          const recorded = this.statementRecords.get(statement)
          if (!recorded) throw new Error('batch received an unknown statement')
          return recorded
        }),
      )
      return []
    },
    prepare: (sql: string) => {
      const recorded: RecordedD1Statement = { sql, values: [] }
      this.statements.push(recorded)
      const statement = {
        all: async () => ({ results: this.allResults.shift() ?? [] }),
        bind: (...values: unknown[]) => {
          recorded.values = values
          return statement
        },
        first: async () => this.firstResults.shift() ?? null,
        run: async () => ({ meta: { changes: this.runResults.shift()?.changes ?? 1 } }),
      } as unknown as D1PreparedStatement
      this.statementRecords.set(statement, recorded)
      return statement
    },
  } as unknown as D1Database

  private readonly statementRecords = new WeakMap<D1PreparedStatement, RecordedD1Statement>()
}