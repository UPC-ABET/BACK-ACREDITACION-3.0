import { MigrationInterface, QueryRunner } from 'typeorm';

export class NullableCourseSectionInSurveys1782500936189 implements MigrationInterface {
	name = 'NullableCourseSectionInSurveys1782500936189';

	public async up(queryRunner: QueryRunner): Promise<void> {
		// GRA surveys are graduate surveys — they don't belong to a specific course section.
		// Allowing null here lets us create GRA notifications without requiring a course section
		// to exist in the database.
		await queryRunner.query(
			`ALTER TABLE "evidence"."surveys" ALTER COLUMN "course_section_id" DROP NOT NULL`,
		);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		// Honest inverse: restore the NOT NULL constraint. This intentionally fails if any survey
		// has a null course_section_id, rather than silently back-filling an unrelated section.
		await queryRunner.query(
			`ALTER TABLE "evidence"."surveys" ALTER COLUMN "course_section_id" SET NOT NULL`,
		);
	}
}
