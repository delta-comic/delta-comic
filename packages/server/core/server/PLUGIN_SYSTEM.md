# JSON Flow Plugins

Server plugin packages contain a protocol v2 manifest and an optional `server.entry` JSON flow
resource. Authenticated requests resolve the tenant from `auth.userId`; no client supplied tenant
identifier is trusted. D1 stores package documents, configuration, schedules, execution records,
and values under tenant and plugin keys.

Each request creates a Cordis Context with identity, input, configuration, store, HTTP, and
diagnostic services. A flow executes in order and supports `if`, `http`, `store.get`, `store.set`,
`store.delete`, and `return`. Parameters can use `{ expr: JsonLogic }` to read input, config, and
completed step results. Installation validates the manifest, integrity, schema, operators, IDs,
branch depth, and document size before saving.

The execution limits are 64 steps, depth 16, 16 HTTP requests, and a 10 second timeout per HTTP
request. A failed run stores its step ID and error. Stream responses keep the Context alive until
the stream finishes or is cancelled. Scheduled rows are atomically claimed by D1 `UPDATE ...
RETURNING` before execution, so duplicate claims do not run the same due row concurrently.

The management page edits manifest and flow JSON, configuration, enable state, schedule, manual
input, and execution history. `GET|PUT|PATCH|DELETE /api/plugins/:pluginId` and
`POST /api/plugins/:pluginId/flows/:flowId/run` use the authenticated user token.
