import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import {
	SEMAPHORE_RC_SQL,
	SEMAPHORE_RV_SQL,
	SEMAPHORE_METADATA_SQL,
} from './semaphore-reports.sql';

export interface SemaphoreRow {
	courseCode: string;
	courseName: string;
	outcomeCode: string;
	outcomeName: string;
	totalStudents: number;
	studentsAchieved: number;
	percentageAchieved: number;
	sede: string;
	cicloAcademico: string;
	color: string;
}

export interface MetadataRow {
	programName: string;
	commissionName: string;
	academicPeriodCode: string;
	accreditorCode: string;
}

@Injectable()
export class SemaphoreReportsRepository {
	constructor(private readonly dataSource: DataSource) {}

	async getRcReport(
		academicPeriodId: number,
		programCommissionId: number | null,
		outcomeId: number | null,
		campusId: number | null,
		modalityTypeId: number | null,
		language: string,
	): Promise<SemaphoreRow[]> {
		return this.dataSource.query(SEMAPHORE_RC_SQL, [
			academicPeriodId,
			outcomeId,
			campusId,
			modalityTypeId,
			language,
			programCommissionId,
		]);
	}

	async getRvReport(
		academicPeriodId: number,
		programCommissionId: number | null,
		outcomeId: number | null,
		campusId: number | null,
		modalityTypeId: number | null,
		language: string,
	): Promise<SemaphoreRow[]> {
		return this.dataSource.query(SEMAPHORE_RV_SQL, [
			academicPeriodId,
			outcomeId,
			campusId,
			modalityTypeId,
			language,
			programCommissionId,
		]);
	}

	async getMetadata(
		programCommissionId: number | null,
		academicPeriodId: number,
		language: string,
	): Promise<MetadataRow | null> {
		const [row] = await this.dataSource.query(SEMAPHORE_METADATA_SQL, [
			programCommissionId,
			academicPeriodId,
			language,
		]);
		return row ?? null;
	}
}
