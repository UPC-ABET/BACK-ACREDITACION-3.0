import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUploadLogIdToEvaluationsAndRubricScores1783050000000 implements MigrationInterface {
	name = 'AddUploadLogIdToEvaluationsAndRubricScores1783050000000';

	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(
			`ALTER TABLE "evidence"."evaluations" ADD COLUMN IF NOT EXISTS "upload_log_id" integer`,
		);
		await queryRunner.query(
			`ALTER TABLE "evidence"."evaluations" ADD CONSTRAINT "FK_evaluations_upload_log_id"
			 FOREIGN KEY ("upload_log_id") REFERENCES "audit"."upload_logs"("id")
			 ON DELETE NO ACTION ON UPDATE NO ACTION`,
		);

		await queryRunner.query(
			`ALTER TABLE "evaluation"."rubric_scores" ADD COLUMN IF NOT EXISTS "upload_log_id" integer`,
		);
		await queryRunner.query(
			`ALTER TABLE "evaluation"."rubric_scores" ADD CONSTRAINT "FK_rubric_scores_upload_log_id"
			 FOREIGN KEY ("upload_log_id") REFERENCES "audit"."upload_logs"("id")
			 ON DELETE NO ACTION ON UPDATE NO ACTION`,
		);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(
			`ALTER TABLE "evaluation"."rubric_scores" DROP CONSTRAINT IF EXISTS "FK_rubric_scores_upload_log_id"`,
		);
		await queryRunner.query(
			`ALTER TABLE "evaluation"."rubric_scores" DROP COLUMN IF EXISTS "upload_log_id"`,
		);

		await queryRunner.query(
			`ALTER TABLE "evidence"."evaluations" DROP CONSTRAINT IF EXISTS "FK_evaluations_upload_log_id"`,
		);
		await queryRunner.query(
			`ALTER TABLE "evidence"."evaluations" DROP COLUMN IF EXISTS "upload_log_id"`,
		);
	}
}
