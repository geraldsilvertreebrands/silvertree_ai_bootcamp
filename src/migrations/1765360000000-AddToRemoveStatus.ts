import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddToRemoveStatus1765360000000 implements MigrationInterface {
  name = 'AddToRemoveStatus1765360000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add new enum value for access_grants.status
    await queryRunner.query(
      `ALTER TYPE "public"."access_grants_status_enum" ADD VALUE IF NOT EXISTS 'to_remove'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Cannot easily drop enum values in PostgreSQL without recreating the type.
    // Documenting no-op down migration to avoid accidental breakage.
    return;
  }
}




