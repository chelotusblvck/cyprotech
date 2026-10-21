import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20261021120000 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "intcomex_product" add column if not exists "source" text not null default 'api';`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table if exists "intcomex_product" drop column if exists "source";`);
  }

}
