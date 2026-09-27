create table if not exists "auth_users" ("id" text not null primary key, "login_name" text not null unique, "password_hash" text not null, "password_salt" text not null, "password_alg" text not null, "created_at" integer not null, "updated_at" integer not null, "disabled_at" integer);
create index if not exists "idx_auth_users_login_name" on "auth_users" ("login_name")
