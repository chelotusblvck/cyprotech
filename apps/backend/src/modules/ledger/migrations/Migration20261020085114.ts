import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20261020085114 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "ledger_setting" add column if not exists "gateway_fee_reported_with_iva" boolean not null default false;`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table if exists "ledger_setting" drop column if exists "gateway_fee_reported_with_iva";`);
  }

}
