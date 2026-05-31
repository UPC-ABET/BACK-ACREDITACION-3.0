import { Injectable } from '@nestjs/common';
import { BaseService } from 'src/commons/base.service';
import { PerformanceLevelRepository } from '../core/performance-levels.repository';
import { PerformanceLevelValidation } from '../core/performance-levels.validation';

import {
	CreatePerformanceLevelDto,
	UpdatePerformanceLevelDto,
	FilterPerformanceLevelDto,
} from '../model/performance-levels.dtos';
import { DataSource, EntityManager, FindManyOptions } from 'typeorm';

const PERFORMANCE_LEVEL_RELATIONS = ['instrument_type', 'academic_period'];

@Injectable()
export class PerformanceLevelService extends BaseService<PerformanceLevelRepository> {
	constructor(
		protected readonly repository: PerformanceLevelRepository,
		protected readonly dataSource: DataSource,
	) {
		super(repository);
	}

	async create(dto: CreatePerformanceLevelDto, manager?: EntityManager) {
		await PerformanceLevelValidation.validateCreate(this.repository, dto);
		return await super.create(dto, manager);
	}

	async update(id: number, dto: UpdatePerformanceLevelDto, manager?: EntityManager) {
		await PerformanceLevelValidation.validateUpdate(this.repository, id, dto);
		return await super.update(id, dto, manager);
	}

	async delete(id: number, manager?: EntityManager) {
		await PerformanceLevelValidation.validateDelete(this.repository, id);
		return await super.delete(id, manager);
	}

	async getAll(options?: FindManyOptions<any>) {
		const mergedOptions: FindManyOptions = {
			...options,
			relations: PERFORMANCE_LEVEL_RELATIONS,
		};
		return await super.getAll(mergedOptions);
	}

	async getByFilters(filters: FilterPerformanceLevelDto, options?: FindManyOptions<any>) {
		const cleanWhere = Object.fromEntries(
			Object.entries(filters).filter(([_, v]) => v !== undefined && v !== null),
		);
		const mergedOptions: FindManyOptions = {
			...options,
			where: cleanWhere,
			relations: PERFORMANCE_LEVEL_RELATIONS,
		};
		return await this.baseRepository.findByCondition(mergedOptions);
	}

	async copyFromPeriod(dto: {
		surveyTypeId: number;
		sourceAcademicPeriodId: number;
		targetAcademicPeriodId: number;
	}): Promise<number> {
		const sourceLevels = await this.baseRepository.findByCondition({
			where: { instrumentTypeId: dto.surveyTypeId, academicPeriodId: dto.sourceAcademicPeriodId },
		});

		let count = 0;
		for (const level of sourceLevels) {
			const exists = await this.baseRepository.findByCondition({
				where: {
					instrumentTypeId: dto.surveyTypeId,
					academicPeriodId: dto.targetAcademicPeriodId,
					code: level.code,
				},
			});
			if (exists.length > 0) continue;

			await super.create({
				instrumentTypeId: level.instrumentTypeId,
				academicPeriodId: dto.targetAcademicPeriodId,
				name: level.name,
				code: level.code,
				uniqueValue: level.uniqueValue,
				minScore: level.minScore,
				maxScore: level.maxScore,
				maxValue: level.maxValue,
			});
			count++;
		}
		return count;
	}
}
