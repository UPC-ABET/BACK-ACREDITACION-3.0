import { MigrationInterface, QueryRunner } from 'typeorm';

export class NullableCourseSection1782498800000 implements MigrationInterface {
	name = 'NullableCourseSection1782498800000';

	public async up(queryRunner: QueryRunner): Promise<void> {
		// GRA surveys are graduate surveys — they don't belong to a specific course section.
		// Allowing null here lets us create GRA notifications without requiring a course section
		// to exist in the database.
		await queryRunner.query(
			`ALTER TABLE "evidence"."surveys" ALTER COLUMN "course_section_id" DROP NOT NULL`,
		);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(
			`UPDATE "evidence"."surveys" SET "course_section_id" = (SELECT id FROM "academic"."course_sections" ORDER BY id LIMIT 1) WHERE "course_section_id" IS NULL`,
		);
		await queryRunner.query(
			`ALTER TABLE "evidence"."surveys" ALTER COLUMN "course_section_id" SET NOT NULL`,
		);
	}
}
