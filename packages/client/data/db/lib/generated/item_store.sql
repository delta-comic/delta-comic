create table if not exists "item_store" ("key" text not null primary key, "item" text not null);
create index if not exists "item_store_key" on "item_store" ("key")
