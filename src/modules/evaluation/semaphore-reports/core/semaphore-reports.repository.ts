import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import {
	SEMAPHORE_RC_SCREEN_SQL,
	SEMAPHORE_RV_SCREEN_SQL,
	SEMAPHORE_RC_DETAIL_SQL,
	SEMAPHORE_RC_SUMMARY_SQL,
	SEMAPHORE_RV_DETAIL_SQL,
	SEMAPHORE_RV_SUMMARY_SQL,
	SEMAPHORE_LEVELS_LEGEND_SQL,
	SEMAPHORE_METADATA_SQL,
} from './semaphore-reports.sql';

export interface SemaphoreCourseOutcomeRow {
	courseCode: string;
	courseName: string;
	outcomeCode: string;
	outcomeName: string;
	totalStudents: number;
	studentsRed: number;
	studentsYellow: number;
	studentsGreen: number;
	campus: string;
	academicPeriodCycle: string;
}

export interface SemaphoreDetailRow {
	courseCode: string;
	courseName: string;
	outcomeCode: string;
	outcomeName: string;
	levelRank: number;
	quantity: number;
	totalStudents: number;
	percentage: number;
	campus: string;
	academicPeriodCycle: string;
}

export interface SemaphoreSummaryRow {
	outcomeCode: string;
	outcomeName: string;
	levelRank: number;
	quantity: number;
	totalStudents: number;
	percentage: number;
	campus: string;
}

export interface SemaphoreLevelLegendRow {
	name: string;
	minScore: number;
	maxScore: number;
	color: string;
}

export interface MetadataRow {
	programName: string;
	commissionName: string;
	academicPeriodCode: string;
	accreditorCode: string;
}

const RC_INSTRUMENT_TYPE_CODE = 'TG206-T003';
const RV_INSTRUMENT_TYPE_CODE = 'TG206-T004';

@Injectable()
export class SemaphoreReportsRepository {
	constructor(private readonly dataSource: DataSource) {}

	async getRcScreen(
		academicPeriodId: number,
		programCommissionId: number | null,
		outcomeId: number | null,
		campusId: number | null,
		language: string,
	): Promise<SemaphoreCourseOutcomeRow[]> {
		return this.dataSource.query(SEMAPHORE_RC_SCREEN_SQL, [
			academicPeriodId,
			outcomeId,
			campusId,
			language,
			programCommissionId,
		]);
	}

	async getRvScreen(
		academicPeriodId: number,
		programCommissionId: number | null,
		outcomeId: number | null,
		campusId: number | null,
		language: string,
		rubricIds: number[] | null = null,
		gradeTypeIds: number[] | null = null,
	): Promise<SemaphoreCourseOutcomeRow[]> {
		return this.dataSource.query(SEMAPHORE_RV_SCREEN_SQL, [
			academicPeriodId,
			outcomeId,
			campusId,
			language,
			programCommissionId,
			rubricIds,
			gradeTypeIds,
		]);
	}

	async getRcDetail(
		academicPeriodId: number,
		programCommissionId: number | null,
		outcomeId: number | null,
		campusId: number | null,
		language: string,
	): Promise<SemaphoreDetailRow[]> {
		return this.dataSource.query(SEMAPHORE_RC_DETAIL_SQL, [
			academicPeriodId,
			outcomeId,
			campusId,
			language,
			programCommissionId,
		]);
	}

	async getRcSummary(
		academicPeriodId: number,
		programCommissionId: number | null,
		outcomeId: number | null,
		campusId: number | null,
		language: string,
	): Promise<SemaphoreSummaryRow[]> {
		return this.dataSource.query(SEMAPHORE_RC_SUMMARY_SQL, [
			academicPeriodId,
			outcomeId,
			campusId,
			language,
			programCommissionId,
		]);
	}

	async getRvDetail(
		academicPeriodId: number,
		programCommissionId: number | null,
		outcomeId: number | null,
		campusId: number | null,
		language: string,
		rubricIds: number[] | null = null,
		gradeTypeIds: number[] | null = null,
	): Promise<SemaphoreDetailRow[]> {
		return this.dataSource.query(SEMAPHORE_RV_DETAIL_SQL, [
			academicPeriodId,
			outcomeId,
			campusId,
			language,
			programCommissionId,
			rubricIds,
			gradeTypeIds,
		]);
	}

	async getRvSummary(
		academicPeriodId: number,
		programCommissionId: number | null,
		outcomeId: number | null,
		campusId: number | null,
		language: string,
		rubricIds: number[] | null = null,
		gradeTypeIds: number[] | null = null,
	): Promise<SemaphoreSummaryRow[]> {
		return this.dataSource.query(SEMAPHORE_RV_SUMMARY_SQL, [
			academicPeriodId,
			outcomeId,
			campusId,
			language,
			programCommissionId,
			rubricIds,
			gradeTypeIds,
		]);
	}

	async getLevelsLegend(
		academicPeriodId: number,
		instrument: 'rc' | 'rv',
		language: string,
	): Promise<SemaphoreLevelLegendRow[]> {
		const instrumentTypeCode =
			instrument === 'rc' ? RC_INSTRUMENT_TYPE_CODE : RV_INSTRUMENT_TYPE_CODE;
		return this.dataSource.query(SEMAPHORE_LEVELS_LEGEND_SQL, [
			academicPeriodId,
			instrumentTypeCode,
			language,
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
