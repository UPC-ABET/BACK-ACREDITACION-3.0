import { MigrationInterface, QueryRunner } from 'typeorm';

export class MakeRubricQuestionOutcomeIdNullable1779349598281 implements MigrationInterface {
	name = 'MakeRubricQuestionOutcomeIdNullable1779349598281';

	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`ALTER TABLE "evaluation"."rubric_questions" ALTER COLUMN "outcome_id" DROP NOT NULL`);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`UPDATE "evaluation"."rubric_questions" SET "outcome_id" = 1 WHERE "outcome_id" IS NULL`);
		await queryRunner.query(`ALTER TABLE "evaluation"."rubric_questions" ALTER COLUMN "outcome_id" SET NOT NULL`);
	}
}
