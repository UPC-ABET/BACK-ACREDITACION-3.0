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

	async findAcademicPeriodCode(academicPeriodId: number): Promise<string | null> {
		const rows: Array<{ code: string }> = await this.dataSource.query(
			`SELECT code AS "code" FROM academic.academic_periods WHERE id = $1 LIMIT 1`,
			[academicPeriodId],
		);
		return rows[0]?.code ?? null;
	}
}
