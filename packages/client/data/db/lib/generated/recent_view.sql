create table if not exists "recent_view" ("timestamp" integer not null primary key, "item_key" text not null unique, "is_viewed" integer not null check (is_viewed in (0, 1)));
create index if not exists "recent_timestamp" on "recent_view" ("timestamp" desc)
