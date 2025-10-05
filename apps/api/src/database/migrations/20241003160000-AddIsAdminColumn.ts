import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddIsAdminColumn20241003160000 implements MigrationInterface {
  name = 'AddIsAdminColumn20241003160000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "is_admin" boolean NOT NULL DEFAULT false`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "is_admin"`);
  }
}
