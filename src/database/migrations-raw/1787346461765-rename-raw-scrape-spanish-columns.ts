import { MigrationInterface, QueryRunner } from 'typeorm';

export class RenameRawScrapeSpanishColumns1787346461765 implements MigrationInterface {
	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`ALTER TABLE "scrape_run" RENAME COLUMN "nivel" TO "level"`);
		await queryRunner.query(`ALTER TABLE "scrape_run" RENAME COLUMN "periodo" TO "period"`);
		await queryRunner.query(
			`ALTER TABLE "scrape_run" RENAME COLUMN "departamentos" TO "departments"`,
		);

		await queryRunner.query(`ALTER TABLE "raw_horario" RENAME COLUMN "nivel" TO "level"`);
		await queryRunner.query(`ALTER TABLE "raw_horario" RENAME COLUMN "periodo" TO "period"`);
		await queryRunner.query(
			`ALTER TABLE "raw_horario" RENAME COLUMN "departamento" TO "department"`,
		);
		await queryRunner.query(
			`ALTER TABLE "raw_horario" DROP CONSTRAINT "UQ_raw_horario_run_id_departamento_nrc"`,
		);
		await queryRunner.query(
			`ALTER TABLE "raw_horario" ADD CONSTRAINT "UQ_raw_horario_run_id_department_nrc" UNIQUE ("run_id", "department", "nrc")`,
		);

		await queryRunner.query(`ALTER TABLE "raw_matricula" RENAME COLUMN "nivel" TO "level"`);
		await queryRunner.query(`ALTER TABLE "raw_matricula" RENAME COLUMN "periodo" TO "period"`);
		await queryRunner.query(
			`ALTER TABLE "raw_matricula" RENAME COLUMN "codigo_alumno" TO "student_code"`,
		);
		await queryRunner.query(
			`ALTER TABLE "raw_matricula" DROP CONSTRAINT "UQ_raw_matricula_run_id_nrc_codigo_alumno"`,
		);
		await queryRunner.query(
			`ALTER TABLE "raw_matricula" ADD CONSTRAINT "UQ_raw_matricula_run_id_nrc_student_code" UNIQUE ("run_id", "nrc", "student_code")`,
		);

		await queryRunner.query(`ALTER TABLE "raw_alumno" RENAME COLUMN "nivel" TO "level"`);
		await queryRunner.query(
			`ALTER TABLE "raw_alumno" RENAME COLUMN "codigo_alumno" TO "student_code"`,
		);
		await queryRunner.query(
			`ALTER TABLE "raw_alumno" DROP CONSTRAINT "UQ_raw_alumno_run_id_codigo_alumno"`,
		);
		await queryRunner.query(
			`ALTER TABLE "raw_alumno" ADD CONSTRAINT "UQ_raw_alumno_run_id_student_code" UNIQUE ("run_id", "student_code")`,
		);

		await queryRunner.query(`ALTER TABLE "raw_notas" RENAME COLUMN "nivel" TO "level"`);
		await queryRunner.query(`ALTER TABLE "raw_notas" RENAME COLUMN "periodo" TO "period"`);
		await queryRunner.query(
			`ALTER TABLE "raw_notas" RENAME COLUMN "codigo_alumno" TO "student_code"`,
		);
		await queryRunner.query(
			`ALTER TABLE "raw_notas" RENAME COLUMN "curso_codigo" TO "course_code"`,
		);
		await queryRunner.query(
			`ALTER TABLE "raw_notas" DROP CONSTRAINT "UQ_raw_notas_run_id_codigo_alumno_curso_codigo"`,
		);
		await queryRunner.query(
			`ALTER TABLE "raw_notas" ADD CONSTRAINT "UQ_raw_notas_run_id_student_code_course_code" UNIQUE ("run_id", "student_code", "course_code")`,
		);

		await queryRunner.query(`ALTER TABLE "planner_scrape_run" RENAME COLUMN "periodo" TO "period"`);
		await queryRunner.query(`ALTER TABLE "planner_scrape_run" RENAME COLUMN "escuela" TO "school"`);

		await queryRunner.query(
			`ALTER TABLE "raw_planner_seccion" RENAME COLUMN "periodo" TO "period"`,
		);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(
			`ALTER TABLE "raw_planner_seccion" RENAME COLUMN "period" TO "periodo"`,
		);

		await queryRunner.query(`ALTER TABLE "planner_scrape_run" RENAME COLUMN "school" TO "escuela"`);
		await queryRunner.query(`ALTER TABLE "planner_scrape_run" RENAME COLUMN "period" TO "periodo"`);

		await queryRunner.query(
			`ALTER TABLE "raw_notas" DROP CONSTRAINT "UQ_raw_notas_run_id_student_code_course_code"`,
		);
		await queryRunner.query(
			`ALTER TABLE "raw_notas" ADD CONSTRAINT "UQ_raw_notas_run_id_codigo_alumno_curso_codigo" UNIQUE ("run_id", "codigo_alumno", "curso_codigo")`,
		);
		await queryRunner.query(
			`ALTER TABLE "raw_notas" RENAME COLUMN "course_code" TO "curso_codigo"`,
		);
		await queryRunner.query(
			`ALTER TABLE "raw_notas" RENAME COLUMN "student_code" TO "codigo_alumno"`,
		);
		await queryRunner.query(`ALTER TABLE "raw_notas" RENAME COLUMN "period" TO "periodo"`);
		await queryRunner.query(`ALTER TABLE "raw_notas" RENAME COLUMN "level" TO "nivel"`);

		await queryRunner.query(
			`ALTER TABLE "raw_alumno" DROP CONSTRAINT "UQ_raw_alumno_run_id_student_code"`,
		);
		await queryRunner.query(
			`ALTER TABLE "raw_alumno" ADD CONSTRAINT "UQ_raw_alumno_run_id_codigo_alumno" UNIQUE ("run_id", "codigo_alumno")`,
		);
		await queryRunner.query(
			`ALTER TABLE "raw_alumno" RENAME COLUMN "student_code" TO "codigo_alumno"`,
		);
		await queryRunner.query(`ALTER TABLE "raw_alumno" RENAME COLUMN "level" TO "nivel"`);

		await queryRunner.query(
			`ALTER TABLE "raw_matricula" DROP CONSTRAINT "UQ_raw_matricula_run_id_nrc_student_code"`,
		);
		await queryRunner.query(
			`ALTER TABLE "raw_matricula" ADD CONSTRAINT "UQ_raw_matricula_run_id_nrc_codigo_alumno" UNIQUE ("run_id", "nrc", "codigo_alumno")`,
		);
		await queryRunner.query(
			`ALTER TABLE "raw_matricula" RENAME COLUMN "student_code" TO "codigo_alumno"`,
		);
		await queryRunner.query(`ALTER TABLE "raw_matricula" RENAME COLUMN "period" TO "periodo"`);
		await queryRunner.query(`ALTER TABLE "raw_matricula" RENAME COLUMN "level" TO "nivel"`);

		await queryRunner.query(
			`ALTER TABLE "raw_horario" DROP CONSTRAINT "UQ_raw_horario_run_id_department_nrc"`,
		);
		await queryRunner.query(
			`ALTER TABLE "raw_horario" ADD CONSTRAINT "UQ_raw_horario_run_id_departamento_nrc" UNIQUE ("run_id", "departamento", "nrc")`,
		);
		await queryRunner.query(
			`ALTER TABLE "raw_horario" RENAME COLUMN "department" TO "departamento"`,
		);
		await queryRunner.query(`ALTER TABLE "raw_horario" RENAME COLUMN "period" TO "periodo"`);
		await queryRunner.query(`ALTER TABLE "raw_horario" RENAME COLUMN "level" TO "nivel"`);

		await queryRunner.query(
			`ALTER TABLE "scrape_run" RENAME COLUMN "departments" TO "departamentos"`,
		);
		await queryRunner.query(`ALTER TABLE "scrape_run" RENAME COLUMN "period" TO "periodo"`);
		await queryRunner.query(`ALTER TABLE "scrape_run" RENAME COLUMN "level" TO "nivel"`);
	}
}
