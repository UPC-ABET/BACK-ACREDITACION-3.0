import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, Repository } from 'typeorm';
import { BaseRepository } from 'src/commons/base.repository';
import { ProcessedRvGradeEntity } from '../model/processed-rv-grades.entity';
import {
	RV_SOURCE_GRADES_SQL,
	RV_PERFORMANCE_LEVELS_SQL,
	RV_EVALUATION_IDS_FOR_PERIOD_SQL,
	RV_PROCESSED_LIST_SQL,
} from './processed-rv-grades.sql';
import type { ProcessedRvGradeDto } from '../model/processed-rv-grades.dtos';

const RV_INSTRUMENT_TYPE_CODE = 'TG206-T004';

export interface RvSourceGradeRow {
	evaluationId: number;
	studentSectionEnrollmentId: number;
	outcomeId: number;
	outcomeCode: string;
	programCommissionId: number;
	grade: number;
	maxOutcome: number | null;
	courseSectionId: number;
	academicPeriodId: number;
}

export interface RvPerformanceLevelRow {
	id: number;
	minScore: number;
	maxScore: number;
	levelRank: number;
}

@Injectable()
export class ProcessedRvGradesRepository extends BaseRepository<ProcessedRvGradeEntity> {
	constructor(
		@InjectRepository(ProcessedRvGradeEntity) repository: Repository<ProcessedRvGradeEntity>,
		dataSource: DataSource,
	) {
		super(repository, dataSource);
	}

	async runInTransaction<T>(work: (manager: EntityManager) => Promise<T>): Promise<T> {
		return this.dataSource.transaction(work);
	}

	async getSourceGrades(
		evaluationIds: number[],
		manager?: EntityManager,
	): Promise<RvSourceGradeRow[]> {
		if (evaluationIds.length === 0) return [];
		const runner = manager ?? this.dataSource;
		return runner.query(RV_SOURCE_GRADES_SQL, [evaluationIds]);
	}

	async getRvPerformanceLevels(
		academicPeriodId: number,
		manager?: EntityManager,
	): Promise<RvPerformanceLevelRow[]> {
		const runner = manager ?? this.dataSource;
		return runner.query(RV_PERFORMANCE_LEVELS_SQL, [academicPeriodId, RV_INSTRUMENT_TYPE_CODE]);
	}

	async list(
		academicPeriodId: number,
		programCommissionId: number | null,
		outcomeId: number | null,
		courseSectionId: number | null,
		isConverted: boolean | null,
		language: string,
	): Promise<ProcessedRvGradeDto[]> {
		return this.dataSource.query(RV_PROCESSED_LIST_SQL, [
			academicPeriodId,
			programCommissionId,
			outcomeId,
			courseSectionId,
			isConverted,
			language,
		]);
	}

	async getEvaluationIdsForPeriod(academicPeriodId: number): Promise<number[]> {
		const rows: Array<{ evaluationId: number }> = await this.dataSource.query(
			RV_EVALUATION_IDS_FOR_PERIOD_SQL,
			[academicPeriodId],
		);
		return rows.map((row) => row.evaluationId);
	}

	/**
	 * Replaces every processed row of the given evaluations. Regrading an evaluation can change
	 * which outcomes it even produces (a criterion moved to another question, a conversion rule
	 * retired), so stale rows are dropped rather than upserted over -- otherwise a converted grade
	 * whose rule no longer exists would linger in the report forever.
	 */
	async replaceForEvaluations(
		evaluationIds: number[],
		rows: Array<Partial<ProcessedRvGradeEntity>>,
		manager?: EntityManager,
	): Promise<void> {
		if (evaluationIds.length === 0) return;
		const runner = manager ?? this.dataSource.manager;

		await runner.delete(ProcessedRvGradeEntity, { evaluationId: In(evaluationIds) });
		if (rows.length === 0) return;

		const CHUNK_SIZE = 500;
		for (let index = 0; index < rows.length; index += CHUNK_SIZE) {
			await runner.insert(ProcessedRvGradeEntity, rows.slice(index, index + CHUNK_SIZE));
		}
	}
}
