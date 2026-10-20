import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20261020092341 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`create table if not exists "billing_document" ("id" text not null, "medusa_order_id" text not null, "kind" text not null, "tipo_dte" integer not null, "state" text not null default 'pending', "folio" integer null, "token" text null, "sii_status" text null, "total" real not null, "receptor" jsonb null, "lines" jsonb null, "emission_date" text null, "attempts" integer not null default 0, "first_attempt_at" timestamptz null, "last_attempt_at" timestamptz null, "last_error" text null, "retryable" boolean not null default true, "issued_at" timestamptz null, "emailed_at" timestamptz null, "voids_document_id" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "billing_document_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_billing_document_deleted_at" ON "billing_document" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_billing_document_medusa_order_id" ON "billing_document" ("medusa_order_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_billing_document_token" ON "billing_document" ("token") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_billing_document_state_kind" ON "billing_document" ("state", "kind") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "billing_document" cascade;`);
  }

}
