import { MigrationInterface, QueryRunner } from "typeorm";

export class UpdateEvaluationTables1778827539657 implements MigrationInterface {
    name = 'UpdateEvaluationTables1778827539657'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // ============================================================
        // 1. DROP FK constraints referencing tables/columns to remove
        // ============================================================
        await queryRunner.query(`ALTER TABLE "evaluation"."rubric_scores" DROP CONSTRAINT IF EXISTS "FK_c8e07c409443fb27cd779a61a5d"`);
        await queryRunner.query(`ALTER TABLE "evaluation"."rubric_outcome_criterias" DROP CONSTRAINT IF EXISTS "FK_71f94924a53684210d9c5c18eb0"`);
        await queryRunner.query(`ALTER TABLE "evaluation"."rubric_outcome_criterias" DROP CONSTRAINT IF EXISTS "FK_0c63b3ae8243bc08499b7875c2d"`);
        await queryRunner.query(`ALTER TABLE "evaluation"."rubric_scales" DROP CONSTRAINT IF EXISTS "FK_fd8b696b115497db26fecdf133c"`);

        // ============================================================
        // 2. DROP deprecated columns (no entity field)
        // ============================================================
        await queryRunner.query(`ALTER TABLE "evaluation"."rubric_scores" DROP COLUMN "rubric_outcome_criteria_id"`);
        await queryRunner.query(`ALTER TABLE "evaluation"."rubric_question_criterias" DROP COLUMN "rubric_scale_id"`);
        await queryRunner.query(`ALTER TABLE "evaluation"."project_students" DROP COLUMN "evaluator_type_id"`);
        await queryRunner.query(`ALTER TABLE "evaluation"."rubrics" DROP COLUMN "segment_type_id"`);

        // ============================================================
        // 3. DROP deprecated tables (no entity file)
        // ============================================================
        await queryRunner.query(`DROP TABLE "evaluation"."rubric_outcome_criterias"`);
        await queryRunner.query(`DROP TABLE "evaluation"."rubric_scales"`);

        // ============================================================
        // 4. ADD new columns (entity has them, migration does not)
        // ============================================================
        await queryRunner.query(`ALTER TABLE "evaluation"."rubrics" ADD "grade_type_id" integer NOT NULL`);

        // ============================================================
        // 5. ALTER nullable mismatches
        // ============================================================
        await queryRunner.query(`ALTER TABLE "evaluation"."rubric_questions" ALTER COLUMN "outcome_id" DROP NOT NULL`);

        // ============================================================
        // 6. ADD FK constraints for new columns
        // ============================================================
        await queryRunner.query(`ALTER TABLE "evaluation"."rubrics" ADD CONSTRAINT "FK_rubrics_grade_type" FOREIGN KEY ("grade_type_id") REFERENCES "core"."types"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Reverse FK
        await queryRunner.query(`ALTER TABLE "evaluation"."rubrics" DROP CONSTRAINT IF EXISTS "FK_rubrics_grade_type"`);

        // Reverse nullable
        await queryRunner.query(`ALTER TABLE "evaluation"."rubric_questions" ALTER COLUMN "outcome_id" SET NOT NULL`);

        // Reverse ADD COLUMN
        await queryRunner.query(`ALTER TABLE "evaluation"."rubrics" DROP COLUMN "grade_type_id"`);

        // Reverse DROP TABLE — recreate with original schema
        await queryRunner.query(`CREATE TABLE "evaluation"."rubric_scales" ("id" SERIAL NOT NULL, "extra" jsonb NOT NULL DEFAULT '{}'::jsonb, "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP WITH TIME ZONE DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE, "rubric_id" integer NOT NULL, "code" character varying(50) NOT NULL, "name" character varying(1000) NOT NULL, CONSTRAINT "UQ_68bd88e7233d090302fa5a99b66" UNIQUE ("code"), CONSTRAINT "PK_7e7403ac508ac3e1c9858dc421e" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "evaluation"."rubric_outcome_criterias" ("id" SERIAL NOT NULL, "extra" jsonb NOT NULL DEFAULT '{}'::jsonb, "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP WITH TIME ZONE DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE, "rubric_id" integer NOT NULL, "outcome_id" integer NOT NULL, "criteria" character varying(1000) NOT NULL, CONSTRAINT "PK_9999fa099b8ae7a9b6325b4a787" PRIMARY KEY ("id"))`);

        // Reverse DROP COLUMN
        await queryRunner.query(`ALTER TABLE "evaluation"."rubrics" ADD "segment_type_id" integer NOT NULL`);
        await queryRunner.query(`ALTER TABLE "evaluation"."project_students" ADD "evaluator_type_id" integer NOT NULL`);
        await queryRunner.query(`ALTER TABLE "evaluation"."rubric_question_criterias" ADD "rubric_scale_id" integer NOT NULL`);
        await queryRunner.query(`ALTER TABLE "evaluation"."rubric_scores" ADD "rubric_outcome_criteria_id" integer NOT NULL`);

        // Reverse FK constraints
        await queryRunner.query(`ALTER TABLE "evaluation"."rubric_scales" ADD CONSTRAINT "FK_fd8b696b115497db26fecdf133c" FOREIGN KEY ("rubric_id") REFERENCES "evaluation"."rubrics"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "evaluation"."rubric_outcome_criterias" ADD CONSTRAINT "FK_71f94924a53684210d9c5c18eb0" FOREIGN KEY ("rubric_id") REFERENCES "evaluation"."rubrics"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "evaluation"."rubric_outcome_criterias" ADD CONSTRAINT "FK_0c63b3ae8243bc08499b7875c2d" FOREIGN KEY ("outcome_id") REFERENCES "accreditation"."outcomes"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "evaluation"."rubric_scores" ADD CONSTRAINT "FK_c8e07c409443fb27cd779a61a5d" FOREIGN KEY ("rubric_outcome_criteria_id") REFERENCES "evaluation"."rubric_outcome_criterias"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

}
