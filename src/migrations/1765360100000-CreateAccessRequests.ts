import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAccessRequests1765360100000 implements MigrationInterface {
  name = 'CreateAccessRequests1765360100000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."access_requests_status_enum" AS ENUM('requested', 'approved', 'rejected')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."access_request_items_status_enum" AS ENUM('requested', 'approved', 'rejected')`,
    );

    await queryRunner.query(`
      CREATE TABLE "access_requests" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "targetUserId" uuid NOT NULL,
        "requesterId" uuid NOT NULL,
        "status" "public"."access_requests_status_enum" NOT NULL DEFAULT 'requested',
        "note" text,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_access_requests" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "access_request_items" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "accessRequestId" uuid NOT NULL,
        "systemInstanceId" uuid NOT NULL,
        "accessTierId" uuid NOT NULL,
        "status" "public"."access_request_items_status_enum" NOT NULL DEFAULT 'requested',
        "accessGrantId" uuid,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_access_request_items" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(
      `ALTER TABLE "access_requests" ADD CONSTRAINT "FK_access_requests_targetUser" FOREIGN KEY ("targetUserId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "access_requests" ADD CONSTRAINT "FK_access_requests_requester" FOREIGN KEY ("requesterId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "access_request_items" ADD CONSTRAINT "FK_access_request_items_request" FOREIGN KEY ("accessRequestId") REFERENCES "access_requests"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "access_request_items" ADD CONSTRAINT "FK_access_request_items_system_instance" FOREIGN KEY ("systemInstanceId") REFERENCES "system_instances"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "access_request_items" ADD CONSTRAINT "FK_access_request_items_access_tier" FOREIGN KEY ("accessTierId") REFERENCES "access_tiers"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "access_request_items" DROP CONSTRAINT "FK_access_request_items_access_tier"`);
    await queryRunner.query(
      `ALTER TABLE "access_request_items" DROP CONSTRAINT "FK_access_request_items_system_instance"`,
    );
    await queryRunner.query(`ALTER TABLE "access_request_items" DROP CONSTRAINT "FK_access_request_items_request"`);
    await queryRunner.query(`ALTER TABLE "access_requests" DROP CONSTRAINT "FK_access_requests_requester"`);
    await queryRunner.query(`ALTER TABLE "access_requests" DROP CONSTRAINT "FK_access_requests_targetUser"`);
    await queryRunner.query(`DROP TABLE "access_request_items"`);
    await queryRunner.query(`DROP TABLE "access_requests"`);
    await queryRunner.query(`DROP TYPE "public"."access_request_items_status_enum"`);
    await queryRunner.query(`DROP TYPE "public"."access_requests_status_enum"`);
  }
}

