create table if not exists "favourite_card" ("create_at" integer not null primary key, "title" text not null, "private" integer not null check (private in (0, 1)), "description" text not null);
create index if not exists "favourite_card_title_create_at" on "favourite_card" ("create_at" desc, "title")
