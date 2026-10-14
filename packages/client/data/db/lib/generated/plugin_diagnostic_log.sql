create table if not exists "plugin_diagnostic_log" ("id" text not null primary key, "plugin_id" text not null, "timestamp" integer not null, "level" text not null check (level in ('trace', 'debug', 'info', 'warn', 'error', 'fatal')), "source" text not null, "message" text not null, "details" text, "fiber_id" text, "event_id" text);
create index if not exists "plugin_diagnostic_log_plugin_timestamp" on "plugin_diagnostic_log" ("plugin_id", "timestamp" desc);
create index if not exists "plugin_diagnostic_log_timestamp" on "plugin_diagnostic_log" ("timestamp" desc)
