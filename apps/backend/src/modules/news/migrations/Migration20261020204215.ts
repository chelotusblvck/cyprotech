import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20261020204215 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "news_post" drop constraint if exists "news_post_slug_unique";`);
    this.addSql(`create table if not exists "news_post" ("id" text not null, "title" text not null, "slug" text not null, "summary" text not null, "body" text null, "image_url" text null, "image_alt" text null, "image_credit" text null, "category" text not null default 'industria', "game" text null, "source_name" text null, "source_url" text null, "status" text not null default 'draft', "featured" boolean not null default false, "published_at" timestamptz null, "origin" text not null default 'manual', "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "news_post_pkey" primary key ("id"));`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_news_post_slug_unique" ON "news_post" ("slug") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_news_post_deleted_at" ON "news_post" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_news_post_status_published_at" ON "news_post" ("status", "published_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_news_post_category" ON "news_post" ("category") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_news_post_source_url" ON "news_post" ("source_url") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "news_post" cascade;`);
  }

}
