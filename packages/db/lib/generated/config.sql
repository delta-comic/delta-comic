create table if not exists "config" ("belong_to" text not null primary key, "form" text not null, "data" text not null);
create index if not exists "config_belong_to" on "config" ("belong_to")
