import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import {
	SEMAPHORE_RC_SCREEN_SQL,
	SEMAPHORE_RV_SCREEN_SQL,
	SEMAPHORE_RC_DETAIL_SQL,
	SEMAPHORE_RC_SUMMARY_SQL,
	SEMAPHORE_RV_DETAIL_SQL,
	SEMAPHORE_RV_SUMMARY_SQL,
	SEMAPHORE_RC_OUTCOMES_SQL,
	SEMAPHORE_LEVELS_LEGEND_SQL,
	SEMAPHORE_METADATA_SQL,
	SEMAPHORE_CAMPUSES_SQL,
} from './semaphore-reports.sql';

export interface SemaphoreCourseOutcomeRow {
	courseCode: string;
	courseName: string;
	outcomeCode: string;
	outcomeName: string;
	outcomeDescription: string;
	totalStudents: number;
	studentsRed: number;
	studentsYellow: number;
	studentsGreen: number;
	campusId: number;
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
	campusId: number;
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
	campusId: number;
	campus: string;
}

export interface SemaphoreLevelLegendRow {
	id: number;
	name: string;
	minScore: number;
	maxScore: number;
	color: string;
}

export interface MetadataRow {
	programName: string;
	modalityName: string;
	commissionName: string;
	academicPeriodCode: string;
	accreditorCode: string;
}

export interface SemaphoreCampusRow {
	id: number;
	code: string;
	name: string;
}

export interface SemaphoreOutcomeIdRow {
	id: number;
	outcomeCode: string;
	outcomeName: string;
}

const RC_INSTRUMENT_TYPE_CODE = 'TG206-T003';
const RV_INSTRUMENT_TYPE_CODE = 'TG206-T004';

const REPORT_STATEMENT_TIMEOUT_MS = 120_000;

@Injectable()
export class SemaphoreReportsRepository {
	constructor(private readonly dataSource: DataSource) {}

	/**
	 * These reports are the heaviest reads in the app and the pool is small (`DB_POOL_MAX`), so a
	 * single runaway plan would otherwise hold its connection indefinitely and starve every other
	 * request. `SET LOCAL` needs a transaction to be scoped to this statement and to unwind on
	 * commit -- a session-level `SET` would leak the timeout onto the next borrower of the
	 * connection.
	 */
	private async runReportQuery<T>(sql: string, parameters: unknown[]): Promise<T[]> {
		const runner = this.dataSource.createQueryRunner();
		try {
			await runner.connect();
			await runner.startTransaction();
			try {
				await runner.query(`SET LOCAL statement_timeout = ${REPORT_STATEMENT_TIMEOUT_MS}`);
				const rows = (await runner.query(sql, parameters)) as T[];
				await runner.commitTransaction();
				return rows;
			} catch (error) {
				await runner.rollbackTransaction().catch(() => undefined);
				throw error;
			}
		} finally {
			await runner.release().catch(() => undefined);
		}
	}

	async getRcScreen(
		academicPeriodId: number,
		programCommissionId: number | null,
		campusIds: number[] | null,
		language: string,
		outcomeIds: number[] | null = null,
	): Promise<SemaphoreCourseOutcomeRow[]> {
		return this.runReportQuery(SEMAPHORE_RC_SCREEN_SQL, [
			academicPeriodId,
			campusIds,
			language,
			programCommissionId,
			outcomeIds,
		]);
	}

	// Every active outcome of a commission -- the RC PDF download iterates one report per id when
	// the caller doesn't select any itself. See SemaphoreReportsService.resolveRcOutcomes.
	async getRcOutcomes(
		programCommissionId: number | null,
		language: string,
	): Promise<SemaphoreOutcomeIdRow[]> {
		return this.runReportQuery(SEMAPHORE_RC_OUTCOMES_SQL, [programCommissionId, language]);
	}

	async getRvScreen(
		academicPeriodId: number,
		programCommissionId: number | null,
		campusIds: number[] | null,
		language: string,
		rubricIds: number[] | null = null,
		gradeTypeIds: number[] | null = null,
	): Promise<SemaphoreCourseOutcomeRow[]> {
		return this.runReportQuery(SEMAPHORE_RV_SCREEN_SQL, [
			academicPeriodId,
			campusIds,
			language,
			programCommissionId,
			rubricIds,
			gradeTypeIds,
		]);
	}

	async getRcDetail(
		academicPeriodId: number,
		programCommissionId: number | null,
		campusIds: number[] | null,
		language: string,
		outcomeIds: number[] | null = null,
	): Promise<SemaphoreDetailRow[]> {
		return this.runReportQuery(SEMAPHORE_RC_DETAIL_SQL, [
			academicPeriodId,
			campusIds,
			language,
			programCommissionId,
			outcomeIds,
		]);
	}

	async getRcSummary(
		academicPeriodId: number,
		programCommissionId: number | null,
		campusIds: number[] | null,
		language: string,
		outcomeIds: number[] | null = null,
	): Promise<SemaphoreSummaryRow[]> {
		return this.runReportQuery(SEMAPHORE_RC_SUMMARY_SQL, [
			academicPeriodId,
			campusIds,
			language,
			programCommissionId,
			outcomeIds,
		]);
	}

	async getRvDetail(
		academicPeriodId: number,
		programCommissionId: number | null,
		campusIds: number[] | null,
		language: string,
		rubricIds: number[] | null = null,
		gradeTypeIds: number[] | null = null,
	): Promise<SemaphoreDetailRow[]> {
		return this.runReportQuery(SEMAPHORE_RV_DETAIL_SQL, [
			academicPeriodId,
			campusIds,
			language,
			programCommissionId,
			rubricIds,
			gradeTypeIds,
		]);
	}

	async getRvSummary(
		academicPeriodId: number,
		programCommissionId: number | null,
		campusIds: number[] | null,
		language: string,
		rubricIds: number[] | null = null,
		gradeTypeIds: number[] | null = null,
	): Promise<SemaphoreSummaryRow[]> {
		return this.runReportQuery(SEMAPHORE_RV_SUMMARY_SQL, [
			academicPeriodId,
			campusIds,
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
		return this.runReportQuery(SEMAPHORE_LEVELS_LEGEND_SQL, [
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
		const [row] = await this.runReportQuery<MetadataRow>(SEMAPHORE_METADATA_SQL, [
			programCommissionId,
			academicPeriodId,
			language,
		]);
		return row ?? null;
	}

	// Every active campus -- lets the service tell "all campuses selected" apart from a proper
	// subset without trusting the client's notion of "all". See
	// SemaphoreReportsService.resolveCampusPlan.
	async getCampuses(language: string): Promise<SemaphoreCampusRow[]> {
		return this.runReportQuery(SEMAPHORE_CAMPUSES_SQL, [language]);
	}
}
