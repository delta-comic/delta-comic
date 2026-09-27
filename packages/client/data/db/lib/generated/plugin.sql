create table if not exists "plugin" ("installer_name" text not null, "loader_name" text not null, "plugin_name" text not null primary key, "meta" text not null, "enable" integer not null check (enable in (0, 1)), "install_input" text not null, "display_name" text);
create index if not exists "plugin_enable" on "plugin" ("enable");
create index if not exists "plugin_plugin_name" on "plugin" ("plugin_name")
