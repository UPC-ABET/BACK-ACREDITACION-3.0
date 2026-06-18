import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { BaseRepository } from 'src/commons/base.repository';
import { TYPE_CODES, TYPE_GROUP_CODES } from 'src/modules/core/types/constants/type-codes';
import { IfcEntity } from '../model/ifcs.entity';
import { REPORT_CODES_SQL, STATUS_REPORT_SQL } from './ifc-report.sql';

export interface IfcStatusReportRow {
	courseName: string;
	areaLabel: string;
	programLabel: string;
	coordinatorName: string | null;
	coordinatorEmail: string | null;
	coordinatorCode: string | null;
	statusCode: string | null;
}

export interface IfcReportCodes {
	schoolCode: string | null;
	programCodes: string[];
}

export interface IfcStatusType {
	code: string;
	name: { es?: string; en?: string };
}

export class IfcRepository extends BaseRepository<IfcEntity> {
	constructor(
		@InjectRepository(IfcEntity)
		repository: Repository<IfcEntity>,
		dataSource: DataSource,
	) {
		super(repository, dataSource);
	}

	async getReportCodes(chartIds: number[], schoolId: number): Promise<IfcReportCodes | null> {
		const [row] = await this.dataSource.query(REPORT_CODES_SQL, [
			chartIds,
			schoolId,
			TYPE_CODES.ENTITY_TYPE.SCHOOL,
		]);
		return row ?? null;
	}

	async getStatusTypes(): Promise<IfcStatusType[]> {
		return this.dataSource.query(
			`SELECT t.code, t.name
			 FROM core.types t
			 INNER JOIN core.type_groups g ON g.id = t.type_group_id
			 WHERE g.code = $1`,
			[TYPE_GROUP_CODES.IFC_STATUS],
		);
	}

	async getStatusReportRows(
		chartIds: number[],
		schoolId: number,
		academicPeriodId: number,
		language: 'es' | 'en',
	): Promise<IfcStatusReportRow[]> {
		return this.dataSource.query(STATUS_REPORT_SQL, [
			chartIds,
			academicPeriodId,
			schoolId,
			TYPE_CODES.ENTITY_TYPE.COURSE,
			TYPE_CODES.ENTITY_TYPE.SCHOOL,
			language,
		]);
	}
}
