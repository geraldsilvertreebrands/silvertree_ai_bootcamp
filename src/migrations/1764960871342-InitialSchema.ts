import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1764960871342 implements MigrationInterface {
  name = 'InitialSchema1764960871342';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Drop tables if they exist (for clean migration)
    await queryRunner.query(`DROP TABLE IF EXISTS "access_grants" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "system_owners" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "access_tiers" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "system_instances" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "systems" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "users" CASCADE`);

    // Create users table
    await queryRunner.query(`
      CREATE TABLE "users" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "email" varchar(255) NOT NULL,
        "name" varchar(255) NOT NULL,
        "managerId" uuid,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        "deletedAt" TIMESTAMP,
        CONSTRAINT "PK_users" PRIMARY KEY ("id")
      )
    `);

    // Create unique index on email
    await queryRunner.query(`
      CREATE UNIQUE INDEX "IDX_users_email" ON "users" ("email")
    `);

    // Create index on managerId
    await queryRunner.query(`
      CREATE INDEX "IDX_users_managerId" ON "users" ("managerId")
    `);

    // Create foreign key for manager relationship
    await queryRunner.query(`
      ALTER TABLE "users" 
      ADD CONSTRAINT "FK_users_managerId" 
      FOREIGN KEY ("managerId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION
    `);

    // Create systems table
    await queryRunner.query(`
      CREATE TABLE "systems" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "name" varchar(255) NOT NULL,
        "description" text,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_systems" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_systems_name" UNIQUE ("name")
      )
    `);

    // Create system_instances table
    await queryRunner.query(`
      CREATE TABLE "system_instances" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "systemId" uuid NOT NULL,
        "name" varchar(255) NOT NULL,
        "region" varchar(100),
        "environment" varchar(100),
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_system_instances" PRIMARY KEY ("id")
      )
    `);

    // Create unique constraint on (systemId, name)
    await queryRunner.query(`
      CREATE UNIQUE INDEX "IDX_system_instances_systemId_name" 
      ON "system_instances" ("systemId", "name")
    `);

    // Create foreign key for system
    await queryRunner.query(`
      ALTER TABLE "system_instances" 
      ADD CONSTRAINT "FK_system_instances_systemId" 
      FOREIGN KEY ("systemId") REFERENCES "systems"("id") ON DELETE CASCADE ON UPDATE NO ACTION
    `);

    // Create access_tiers table
    await queryRunner.query(`
      CREATE TABLE "access_tiers" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "systemId" uuid NOT NULL,
        "name" varchar(255) NOT NULL,
        "description" text,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_access_tiers" PRIMARY KEY ("id")
      )
    `);

    // Create unique constraint on (systemId, name)
    await queryRunner.query(`
      CREATE UNIQUE INDEX "IDX_access_tiers_systemId_name" 
      ON "access_tiers" ("systemId", "name")
    `);

    // Create foreign key for system
    await queryRunner.query(`
      ALTER TABLE "access_tiers" 
      ADD CONSTRAINT "FK_access_tiers_systemId" 
      FOREIGN KEY ("systemId") REFERENCES "systems"("id") ON DELETE CASCADE ON UPDATE NO ACTION
    `);

    // Create system_owners table
    await queryRunner.query(`
      CREATE TABLE "system_owners" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "userId" uuid NOT NULL,
        "systemId" uuid NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_system_owners" PRIMARY KEY ("id")
      )
    `);

    // Create unique constraint on (userId, systemId)
    await queryRunner.query(`
      CREATE UNIQUE INDEX "IDX_system_owners_userId_systemId" 
      ON "system_owners" ("userId", "systemId")
    `);

    // Create foreign keys
    await queryRunner.query(`
      ALTER TABLE "system_owners" 
      ADD CONSTRAINT "FK_system_owners_userId" 
      FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      ALTER TABLE "system_owners" 
      ADD CONSTRAINT "FK_system_owners_systemId" 
      FOREIGN KEY ("systemId") REFERENCES "systems"("id") ON DELETE CASCADE ON UPDATE NO ACTION
    `);

    // Create access_grants table
    await queryRunner.query(`
      CREATE TABLE "access_grants" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "userId" uuid NOT NULL,
        "systemInstanceId" uuid NOT NULL,
        "accessTierId" uuid NOT NULL,
        "status" varchar NOT NULL DEFAULT 'active',
        "grantedById" uuid,
        "grantedAt" TIMESTAMP,
        "removedAt" TIMESTAMP,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_access_grants" PRIMARY KEY ("id"),
        CONSTRAINT "CHK_access_grants_status" CHECK ("status" IN ('active', 'removed'))
      )
    `);

    // Create indexes for performance
    await queryRunner.query(`
      CREATE INDEX "IDX_access_grants_userId" ON "access_grants" ("userId")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_access_grants_systemInstanceId" ON "access_grants" ("systemInstanceId")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_access_grants_status" ON "access_grants" ("status")
    `);

    // Create unique constraint on (userId, systemInstanceId, accessTierId, status) where status='active'
    // Note: PostgreSQL partial unique index
    await queryRunner.query(`
      CREATE UNIQUE INDEX "IDX_access_grants_unique_active" 
      ON "access_grants" ("userId", "systemInstanceId", "accessTierId", "status") 
      WHERE "status" = 'active'
    `);

    // Create foreign keys
    await queryRunner.query(`
      ALTER TABLE "access_grants" 
      ADD CONSTRAINT "FK_access_grants_userId" 
      FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      ALTER TABLE "access_grants" 
      ADD CONSTRAINT "FK_access_grants_systemInstanceId" 
      FOREIGN KEY ("systemInstanceId") REFERENCES "system_instances"("id") ON DELETE CASCADE ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      ALTER TABLE "access_grants" 
      ADD CONSTRAINT "FK_access_grants_accessTierId" 
      FOREIGN KEY ("accessTierId") REFERENCES "access_tiers"("id") ON DELETE CASCADE ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      ALTER TABLE "access_grants" 
      ADD CONSTRAINT "FK_access_grants_grantedById" 
      FOREIGN KEY ("grantedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop foreign keys first
    await queryRunner.query(`
      ALTER TABLE "access_grants" DROP CONSTRAINT IF EXISTS "FK_access_grants_grantedById"
    `);
    await queryRunner.query(`
      ALTER TABLE "access_grants" DROP CONSTRAINT IF EXISTS "FK_access_grants_accessTierId"
    `);
    await queryRunner.query(`
      ALTER TABLE "access_grants" DROP CONSTRAINT IF EXISTS "FK_access_grants_systemInstanceId"
    `);
    await queryRunner.query(`
      ALTER TABLE "access_grants" DROP CONSTRAINT IF EXISTS "FK_access_grants_userId"
    `);
    await queryRunner.query(`
      ALTER TABLE "system_owners" DROP CONSTRAINT IF EXISTS "FK_system_owners_systemId"
    `);
    await queryRunner.query(`
      ALTER TABLE "system_owners" DROP CONSTRAINT IF EXISTS "FK_system_owners_userId"
    `);
    await queryRunner.query(`
      ALTER TABLE "access_tiers" DROP CONSTRAINT IF EXISTS "FK_access_tiers_systemId"
    `);
    await queryRunner.query(`
      ALTER TABLE "system_instances" DROP CONSTRAINT IF EXISTS "FK_system_instances_systemId"
    `);
    await queryRunner.query(`
      ALTER TABLE "users" DROP CONSTRAINT IF EXISTS "FK_users_managerId"
    `);

    // Drop indexes
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_access_grants_unique_active"
    `);
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_access_grants_status"
    `);
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_access_grants_systemInstanceId"
    `);
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_access_grants_userId"
    `);
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_system_owners_userId_systemId"
    `);
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_access_tiers_systemId_name"
    `);
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_system_instances_systemId_name"
    `);
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_users_managerId"
    `);
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_users_email"
    `);

    // Drop tables (in reverse order of dependencies)
    await queryRunner.query(`DROP TABLE IF EXISTS "access_grants"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "system_owners"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "access_tiers"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "system_instances"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "systems"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "users"`);
  }
}
