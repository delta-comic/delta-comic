create table if not exists "server_plugin_registry" ("plugin_id" text not null primary key, "manifest_json" text not null, "source" text not null, "trusted" integer default 1 not null check (trusted in (0, 1)), "registered_at" integer not null, "updated_at" integer not null);
create index if not exists "idx_server_plugin_registry_updated" on "server_plugin_registry" ("updated_at" desc)
