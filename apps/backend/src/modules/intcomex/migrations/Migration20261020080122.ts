import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20261020080122 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "intcomex_product" drop constraint if exists "intcomex_product_sku_unique";`);
    this.addSql(`alter table if exists "intcomex_order" drop constraint if exists "intcomex_order_customer_order_number_unique";`);
    this.addSql(`alter table if exists "intcomex_order" drop constraint if exists "intcomex_order_medusa_order_id_unique";`);
    this.addSql(`alter table if exists "intcomex_fx_rate" drop constraint if exists "intcomex_fx_rate_date_unique";`);
    this.addSql(`create table if not exists "intcomex_fx_rate" ("id" text not null, "date" text not null, "rate" real not null, "source" text not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "intcomex_fx_rate_pkey" primary key ("id"));`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_intcomex_fx_rate_date_unique" ON "intcomex_fx_rate" ("date") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_intcomex_fx_rate_deleted_at" ON "intcomex_fx_rate" ("deleted_at") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "intcomex_order" ("id" text not null, "medusa_order_id" text not null, "customer_order_number" text not null, "intcomex_order_number" text null, "state" text not null default 'pending', "status_code" integer null, "status_description" text null, "tracking" jsonb null, "price_snapshots" jsonb null, "request_payload" jsonb null, "response_payload" jsonb null, "error" text null, "placed_at" timestamptz null, "last_status_check_at" timestamptz null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "intcomex_order_pkey" primary key ("id"));`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_intcomex_order_medusa_order_id_unique" ON "intcomex_order" ("medusa_order_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_intcomex_order_customer_order_number_unique" ON "intcomex_order" ("customer_order_number") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_intcomex_order_deleted_at" ON "intcomex_order" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_intcomex_order_state" ON "intcomex_order" ("state") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_intcomex_order_intcomex_order_number" ON "intcomex_order" ("intcomex_order_number") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "intcomex_product" ("id" text not null, "sku" text not null, "mpn" text null, "upc" text null, "description" text not null, "brand" text null, "category_path" text null, "category_handle" text null, "product_type" text not null default 'Physical', "cost_net" real not null, "cost_currency" text not null default 'USD', "stock" integer not null default 0, "on_sale" boolean not null default false, "image_url" text null, "medusa_product_id" text null, "medusa_variant_id" text null, "inventory_item_id" text null, "public_price" real null, "active" boolean not null default true, "last_synced_at" timestamptz null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "intcomex_product_pkey" primary key ("id"));`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_intcomex_product_sku_unique" ON "intcomex_product" ("sku") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_intcomex_product_deleted_at" ON "intcomex_product" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_intcomex_product_medusa_product_id" ON "intcomex_product" ("medusa_product_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_intcomex_product_category_handle" ON "intcomex_product" ("category_handle") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_intcomex_product_active_stock" ON "intcomex_product" ("active", "stock") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "intcomex_sync_run" ("id" text not null, "kind" text not null, "status" text not null default 'running', "mock" boolean not null default false, "started_at" timestamptz not null, "finished_at" timestamptz null, "stats" jsonb null, "error" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "intcomex_sync_run_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_intcomex_sync_run_deleted_at" ON "intcomex_sync_run" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_intcomex_sync_run_kind_started_at" ON "intcomex_sync_run" ("kind", "started_at") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "intcomex_fx_rate" cascade;`);

    this.addSql(`drop table if exists "intcomex_order" cascade;`);

    this.addSql(`drop table if exists "intcomex_product" cascade;`);

    this.addSql(`drop table if exists "intcomex_sync_run" cascade;`);
  }

}
