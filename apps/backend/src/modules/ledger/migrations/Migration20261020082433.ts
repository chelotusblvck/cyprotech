import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20261020082433 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "ledger_setting" drop constraint if exists "ledger_setting_key_unique";`);
    this.addSql(`alter table if exists "ledger_period" drop constraint if exists "ledger_period_period_unique";`);
    this.addSql(`alter table if exists "ledger_order" drop constraint if exists "ledger_order_medusa_order_id_unique";`);
    this.addSql(`create table if not exists "ledger_entry" ("id" text not null, "period" text not null, "kind" text not null, "amount" real not null, "order_id" text null, "description" text not null, "source" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "ledger_entry_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_ledger_entry_deleted_at" ON "ledger_entry" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_ledger_entry_period_kind" ON "ledger_entry" ("period", "kind") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_ledger_entry_order_id" ON "ledger_entry" ("order_id") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "ledger_order" ("id" text not null, "medusa_order_id" text not null, "display_id" text not null, "state" text not null default 'pending', "economics" jsonb not null, "delivered_at" timestamptz null, "earned_at" timestamptz null, "reversed_at" timestamptz null, "period" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "ledger_order_pkey" primary key ("id"));`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_ledger_order_medusa_order_id_unique" ON "ledger_order" ("medusa_order_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_ledger_order_deleted_at" ON "ledger_order" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_ledger_order_state" ON "ledger_order" ("state") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_ledger_order_period" ON "ledger_order" ("period") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "ledger_payout" ("id" text not null, "period" text not null, "partner" text not null, "partner_name" text not null, "percent" real not null, "amount" real not null, "status" text not null default 'pending', "paid_at" timestamptz null, "reference" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "ledger_payout_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_ledger_payout_deleted_at" ON "ledger_payout" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_ledger_payout_period" ON "ledger_payout" ("period") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "ledger_period" ("id" text not null, "period" text not null, "status" text not null default 'open', "totals" jsonb null, "deficit_in" real not null default 0, "deficit_out" real not null default 0, "closed_at" timestamptz null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "ledger_period_pkey" primary key ("id"));`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_ledger_period_period_unique" ON "ledger_period" ("period") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_ledger_period_deleted_at" ON "ledger_period" ("deleted_at") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "ledger_setting" ("id" text not null, "key" text not null default 'default', "partner_a_name" text not null, "partner_a_percent" real not null, "partner_b_name" text not null, "partner_b_percent" real not null, "gateway_fee_percent" real not null default 0, "gateway_fee_fixed" real not null default 0, "hold_days" integer not null default 10, "carry_deficit" boolean not null default true, "fixed_costs" jsonb null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "ledger_setting_pkey" primary key ("id"));`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_ledger_setting_key_unique" ON "ledger_setting" ("key") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_ledger_setting_deleted_at" ON "ledger_setting" ("deleted_at") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "ledger_entry" cascade;`);

    this.addSql(`drop table if exists "ledger_order" cascade;`);

    this.addSql(`drop table if exists "ledger_payout" cascade;`);

    this.addSql(`drop table if exists "ledger_period" cascade;`);

    this.addSql(`drop table if exists "ledger_setting" cascade;`);
  }

}
