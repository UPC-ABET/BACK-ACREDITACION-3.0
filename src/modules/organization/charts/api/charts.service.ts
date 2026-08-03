import { Injectable } from '@nestjs/common';
import { BaseService } from 'src/commons/base.service';
import { ChartRepository } from '../core/charts.repository';
import {
	ChartValidation,
	resolveEffectiveEntity,
	resolveEntityCode,
} from '../core/charts.validation';
import type { I18nText } from 'src/shared/types/i18n';

import {
	CreateChartDto,
	UpdateChartDto,
	FilterChartDto,
	CreateChartNodeDto,
	UpdateChartNodeDto,
} from '../model/charts.dtos';
import { EntityManager } from 'typeorm';

@Injectable()
export class ChartService extends BaseService<ChartRepository> {
	constructor(protected readonly repository: ChartRepository) {
		super(repository);
	}

	async create(dto: CreateChartDto, manager?: EntityManager) {
		await ChartValidation.validateCreate(this.repository, dto);
		return await super.create(dto, manager);
	}

	async update(id: number, dto: UpdateChartDto, manager?: EntityManager) {
		await ChartValidation.validateUpdate(this.repository, id, dto);
		return await super.update(id, dto, manager);
	}

	async delete(id: number, manager?: EntityManager) {
		await ChartValidation.validateDelete(this.repository, id);
		return await super.delete(id, manager);
	}

	async getByFilters(filters: FilterChartDto & { academicPeriodId?: number | null }) {
		const { academicPeriodId, ...rest } = filters;
		return await super.getByFilters({
			...rest,
			...(academicPeriodId != null ? { academicPeriodId } : {}),
		});
	}

	async getMaintenanceTree(academicPeriodId: number, schoolId: number) {
		const school = await this.repository.getSchoolChartNode(academicPeriodId, schoolId);
		if (!school) return null;
		const rootChartId = school.rootChartId ?? school.id;
		return await this.repository.getMaintenanceBranch(rootChartId, school.id);
	}

	async createNode(academicPeriodId: number, dto: CreateChartNodeDto) {
		await ChartValidation.validateMaintenanceCreate(this.repository, academicPeriodId, dto);
		const typeCode = (await this.repository.getEntityTypeCode(dto.entityTypeId))!;
		const created = await this.repository.createNode({
			staffId: dto.staffId,
			academicPeriodId,
			rootChartId: dto.rootChartId,
			title: dto.title,
			entityTypeId: dto.entityTypeId,
			entityCode: resolveEntityCode(typeCode, dto.entityCode),
		});
		return { id: created.id };
	}

	async updateNode(id: number, dto: UpdateChartNodeDto) {
		await ChartValidation.validateMaintenanceUpdate(this.repository, id, dto);

		const partial: {
			staffId?: number;
			title?: I18nText;
			entityTypeId?: number;
			entityCode?: number | null;
		} = {};

		if (dto.staffId != null) partial.staffId = dto.staffId;
		if (dto.title != null) partial.title = dto.title;

		if (dto.entityTypeId != null || dto.entityCode != null) {
			const node = (await this.repository.getNodeWithType(id))!;
			const newTypeCode =
				dto.entityTypeId != null ? await this.repository.getEntityTypeCode(dto.entityTypeId) : null;
			const effective = resolveEffectiveEntity(node, dto, newTypeCode);

			if (dto.entityTypeId != null) partial.entityTypeId = effective.entityTypeId ?? undefined;
			partial.entityCode = effective.entityCode;
		}

		await this.repository.updateNode(id, partial);
		return { id };
	}

	async deleteNode(id: number) {
		await ChartValidation.validateMaintenanceDelete(this.repository, id);
		const ids = await this.repository.getSubtreeChartIds(id);
		await this.repository.hardDeleteCharts(ids);
		return { id, deletedCount: ids.length };
	}
}
