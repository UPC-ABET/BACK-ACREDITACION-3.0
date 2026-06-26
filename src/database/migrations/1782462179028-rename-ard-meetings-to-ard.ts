import { MigrationInterface, QueryRunner } from 'typeorm';

export class RenameArdMeetingsToArd1782462179028 implements MigrationInterface {
	public async up(queryRunner: QueryRunner): Promise<void> {
		// Remove legacy columns (and their supporting objects) that are not part of the new ARD header.
		await queryRunner.query(
			`ALTER TABLE "evidence"."ard_meetings" DROP CONSTRAINT "FK_ard_meetings_created_by_user_id"`,
		);
		await queryRunner.query(
			`ALTER TABLE "evidence"."ard_meetings" DROP CONSTRAINT "FK_ard_meetings_school_id"`,
		);
		await queryRunner.query(`DROP INDEX "evidence"."IDX_ard_meetings_school_id"`);
		await queryRunner.query(
			`ALTER TABLE "evidence"."ard_meetings" DROP COLUMN "created_by_user_id"`,
		);
		await queryRunner.query(`ALTER TABLE "evidence"."ard_meetings" DROP COLUMN "school_id"`);

		// Rename the main ARD header table.
		await queryRunner.query(`ALTER TABLE "evidence"."ard_meetings" RENAME TO "ard"`);

		// Rename primary key, unique constraint and foreign keys.
		await queryRunner.query(
			`ALTER TABLE "evidence"."ard" RENAME CONSTRAINT "PK_ard_meetings" TO "PK_ard"`,
		);
		await queryRunner.query(
			`ALTER TABLE "evidence"."ard" RENAME CONSTRAINT "UQ_ard_meetings_code" TO "UQ_ard_code"`,
		);
		await queryRunner.query(
			`ALTER TABLE "evidence"."ard" RENAME CONSTRAINT "FK_ard_meetings_academic_period_id" TO "FK_ard_academic_period_id"`,
		);
		await queryRunner.query(
			`ALTER TABLE "evidence"."ard" RENAME CONSTRAINT "FK_ard_meetings_campus_id" TO "FK_ard_campus_id"`,
		);

		// Rename indexes.
		await queryRunner.query(
			`ALTER INDEX "evidence"."IDX_ard_meetings_academic_period_id" RENAME TO "IDX_ard_academic_period_id"`,
		);
		await queryRunner.query(
			`ALTER INDEX "evidence"."IDX_ard_meetings_campus_id" RENAME TO "IDX_ard_campus_id"`,
		);
		await queryRunner.query(
			`ALTER INDEX "evidence"."IDX_ard_meetings_meeting_date" RENAME TO "IDX_ard_meeting_date"`,
		);

		// Point ard_detail foreign key to the renamed table.
		await queryRunner.query(
			`ALTER TABLE "evidence"."ard_detail" DROP CONSTRAINT "FK_ard_detail_ard_id"`,
		);
		await queryRunner.query(`
			ALTER TABLE "evidence"."ard_detail"
			ADD CONSTRAINT "FK_ard_detail_ard_id"
			FOREIGN KEY ("ard_id") REFERENCES "evidence"."ard"("id")
			ON DELETE CASCADE ON UPDATE NO ACTION
		`);

		// Add the missing foreign key for program_id.
		await queryRunner.query(`
			ALTER TABLE "evidence"."ard"
			ADD CONSTRAINT "FK_ard_program_id"
			FOREIGN KEY ("program_id") REFERENCES "academic"."programs"("id")
			ON DELETE NO ACTION ON UPDATE NO ACTION
		`);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		// Remove program foreign key.
		await queryRunner.query(`ALTER TABLE "evidence"."ard" DROP CONSTRAINT "FK_ard_program_id"`);

		// Point ard_detail foreign key back to the old table name.
		await queryRunner.query(
			`ALTER TABLE "evidence"."ard_detail" DROP CONSTRAINT "FK_ard_detail_ard_id"`,
		);
		await queryRunner.query(`
			ALTER TABLE "evidence"."ard_detail"
			ADD CONSTRAINT "FK_ard_detail_ard_id"
			FOREIGN KEY ("ard_id") REFERENCES "evidence"."ard_meetings"("id")
			ON DELETE CASCADE ON UPDATE NO ACTION
		`);

		// Rename indexes back.
		await queryRunner.query(
			`ALTER INDEX "evidence"."IDX_ard_meeting_date" RENAME TO "IDX_ard_meetings_meeting_date"`,
		);
		await queryRunner.query(
			`ALTER INDEX "evidence"."IDX_ard_campus_id" RENAME TO "IDX_ard_meetings_campus_id"`,
		);
		await queryRunner.query(
			`ALTER INDEX "evidence"."IDX_ard_academic_period_id" RENAME TO "IDX_ard_meetings_academic_period_id"`,
		);

		// Rename foreign keys back.
		await queryRunner.query(
			`ALTER TABLE "evidence"."ard" RENAME CONSTRAINT "FK_ard_campus_id" TO "FK_ard_meetings_campus_id"`,
		);
		await queryRunner.query(
			`ALTER TABLE "evidence"."ard" RENAME CONSTRAINT "FK_ard_academic_period_id" TO "FK_ard_meetings_academic_period_id"`,
		);

		// Rename unique constraint and primary key back.
		await queryRunner.query(
			`ALTER TABLE "evidence"."ard" RENAME CONSTRAINT "UQ_ard_code" TO "UQ_ard_meetings_code"`,
		);
		await queryRunner.query(
			`ALTER TABLE "evidence"."ard" RENAME CONSTRAINT "PK_ard" TO "PK_ard_meetings"`,
		);

		// Rename table back.
		await queryRunner.query(`ALTER TABLE "evidence"."ard" RENAME TO "ard_meetings"`);

		// Restore legacy columns.
		await queryRunner.query(
			`ALTER TABLE "evidence"."ard_meetings" ADD COLUMN "school_id" integer NOT NULL`,
		);
		await queryRunner.query(
			`ALTER TABLE "evidence"."ard_meetings" ADD COLUMN "created_by_user_id" integer NOT NULL`,
		);

		await queryRunner.query(
			`CREATE INDEX "IDX_ard_meetings_school_id" ON "evidence"."ard_meetings" ("school_id")`,
		);

		await queryRunner.query(`
			ALTER TABLE "evidence"."ard_meetings"
			ADD CONSTRAINT "FK_ard_meetings_school_id"
			FOREIGN KEY ("school_id") REFERENCES "organization"."schools"("id")
			ON DELETE NO ACTION ON UPDATE NO ACTION
		`);
		await queryRunner.query(`
			ALTER TABLE "evidence"."ard_meetings"
			ADD CONSTRAINT "FK_ard_meetings_created_by_user_id"
			FOREIGN KEY ("created_by_user_id") REFERENCES "organization"."users"("id")
			ON DELETE NO ACTION ON UPDATE NO ACTION
		`);
	}
}
