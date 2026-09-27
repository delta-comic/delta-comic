create table if not exists "history" ("ep" text not null, "timestamp" integer not null primary key, "item_key" text not null unique);
create index if not exists "history_timestamp" on "history" ("timestamp" desc)
