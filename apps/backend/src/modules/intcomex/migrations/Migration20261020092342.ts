import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20261020092342 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "intcomex_order" add column if not exists "shipped_notified_at" timestamptz null, add column if not exists "delivered_notified_at" timestamptz null;`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table if exists "intcomex_order" drop column if exists "shipped_notified_at", drop column if exists "delivered_notified_at";`);
  }

}
