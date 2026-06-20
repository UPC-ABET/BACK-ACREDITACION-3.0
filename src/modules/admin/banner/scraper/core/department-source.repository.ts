import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

@Injectable()
export class DepartmentSourceRepository {
	constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

	async findActiveDepartmentCodes(): Promise<string[]> {
		const rows: Array<{ code: string }> = await this.dataSource.query(`
			SELECT DISTINCT extra->>'department' AS "code"
			FROM   academic.programs
			WHERE  is_active = true
			  AND  extra ? 'department'
			  AND  extra->>'department' <> ''
			ORDER  BY "code"
		`);
		return rows.map((row) => row.code);
	}

	// Course codes offered in the period via its study plans. Banner sections are kept only when
	// their derived code (materia.codigo + numeroCurso) is in this set, so the scrape is scoped to
	// the courses we actually track for the period.
	async findPeriodCourseCodes(academicPeriodId: number): Promise<string[]> {
		const rows: Array<{ code: string }> = await this.dataSource.query(
			`
			SELECT DISTINCT c.code AS "code"
			FROM   academic.study_plan_courses spc
			JOIN   academic.study_plan_academic_periods spap
			       ON spap.id = spc.study_plan_academic_period_id
			JOIN   academic.courses c ON c.id = spc.course_id
			WHERE  spap.academic_period_id = $1
			  AND  NULLIF(trim(c.code), '') IS NOT NULL
			`,
			[academicPeriodId],
		);
		return rows.map((row) => row.code);
	}

	async findAcademicPeriodCode(academicPeriodId: number): Promise<string | null> {
		const rows: Array<{ code: string }> = await this.dataSource.query(
			`SELECT code AS "code" FROM academic.academic_periods WHERE id = $1 LIMIT 1`,
			[academicPeriodId],
		);
		return rows[0]?.code ?? null;
	}
}
