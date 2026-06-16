import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

// Reads the MAIN db for the scrape inputs (analogue of Banner's DepartmentSourceRepository):
// the academic period code and the course codes that drive the Planner sections search.
@Injectable()
export class PlannerSourceRepository {
	constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

	async findAcademicPeriodCode(academicPeriodId: number): Promise<string | null> {
		const rows: Array<{ code: string }> = await this.dataSource.query(
			`SELECT code AS "code" FROM academic.academic_periods WHERE id = $1 LIMIT 1`,
			[academicPeriodId],
		);
		return rows[0]?.code ?? null;
	}

	// Distinct active course codes. u-planner's /sections is searched per course code (`text`),
	// filtered server-side by periodIds, so codes not offered in the period simply return empty.
	async findActiveCourseCodes(): Promise<string[]> {
		const rows: Array<{ code: string }> = await this.dataSource.query(`
			SELECT DISTINCT code AS "code"
			FROM   academic.courses
			WHERE  is_active = true
			  AND  NULLIF(trim(code), '') IS NOT NULL
			ORDER  BY "code"
		`);
		return rows.map((row) => row.code);
	}
}
