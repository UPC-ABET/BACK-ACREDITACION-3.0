import { Injectable } from '@nestjs/common';
import { BaseService } from 'src/commons/base.service';
import { ProcessedRvGradesRepository } from '../core/processed-rv-grades.repository';
import { RvGradeProcessingService, type RvProcessingResult } from './rv-grade-processing.service';
import { FilterProcessedRvGradeDto, ProcessedRvGradeDto } from '../model/processed-rv-grades.dtos';

@Injectable()
export class ProcessedRvGradesService extends BaseService<ProcessedRvGradesRepository> {
	constructor(
		private readonly processedRepository: ProcessedRvGradesRepository,
		private readonly processingService: RvGradeProcessingService,
	) {
		super(processedRepository);
	}

	async list(
		filters: FilterProcessedRvGradeDto,
		academicPeriodId: number,
		language: 'es' | 'en' = 'es',
	): Promise<ProcessedRvGradeDto[]> {
		return this.processedRepository.list(
			academicPeriodId,
			filters.programCommissionId ?? null,
			filters.outcomeId ?? null,
			filters.courseSectionId ?? null,
			filters.isConverted ?? null,
			language,
		);
	}

	async rebuild(academicPeriodId: number): Promise<RvProcessingResult> {
		return this.processingService.rebuildPeriod(academicPeriodId);
	}
}
