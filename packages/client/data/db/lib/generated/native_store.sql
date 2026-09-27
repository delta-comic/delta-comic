create table if not exists "native_store" ("namespace" text not null, "key" text not null, "value" text not null, constraint "pk_native_store" primary key ("namespace", "key"));
create index if not exists "native_store_namespace_key" on "native_store" ("namespace", "key")
