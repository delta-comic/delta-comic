create table if not exists "subscribe" ("item_key" text, "author" text, "type" text not null, "key" text not null, "plugin" text not null, constraint "pk_subscribe" primary key ("plugin", "key"));
create index if not exists "subscribe_key_plugin" on "subscribe" ("key", "plugin")
