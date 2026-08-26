import { Injectable } from '@nestjs/common';
import { BaseService } from 'src/commons/base.service';
import { BadRequestError } from 'src/commons/domain-error';
import { UserService } from 'src/modules/organization/users/api/users.service';
import { ChartRepository } from '../core/charts.repository';
import { chartsValidationStrings } from '../config/strings/charts.validation';
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
	ResetMaintenancePasswordsResetUserDto,
	ResetMaintenancePasswordsSkippedNodeDto,
	ResetMaintenancePasswordsResponseDto,
} from '../model/charts.dtos';
import { EntityManager } from 'typeorm';

@Injectable()
export class ChartService extends BaseService<ChartRepository> {
	constructor(
		protected readonly repository: ChartRepository,
		private readonly userService: UserService,
	) {
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
		return await this.repository.getMaintenanceBranch(this.resolveTreeRoot(school), school.id);
	}

	async resetMaintenancePasswords(
		academicPeriodId: number,
		schoolId: number,
		entityTypeCodes: string[],
	): Promise<ResetMaintenancePasswordsResponseDto> {
		const school = await this.repository.getSchoolChartNode(academicPeriodId, schoolId);
		if (!school) return { reset: [], skipped: [] };

		const rows = await this.repository.findChartUsersByTypes(
			this.resolveTreeRoot(school),
			school.id,
			entityTypeCodes,
		);

		const skipped: ResetMaintenancePasswordsSkippedNodeDto[] = [];
		const chartIdsByUser = new Map<number, number[]>();
		for (const row of rows) {
			if (row.userId === null) {
				skipped.push({
					chartId: row.chartId,
					staffId: row.staffId,
					entityTypeCode: row.entityTypeCode,
				});
				continue;
			}
			const chartIds = chartIdsByUser.get(row.userId);
			if (chartIds) chartIds.push(row.chartId);
			else chartIdsByUser.set(row.userId, [row.chartId]);
		}

		if (chartIdsByUser.size === 0) return { reset: [], skipped };

		// Two round trips, no shared transaction: chartIds reflects the chart->user link as read
		// here, a moment before the write below. A link changing in between is a display staleness on
		// this response, not a data-integrity issue -- the bulk UPDATE below is itself atomic.
		const updated = await this.userService.resetPasswordsToDefault([...chartIdsByUser.keys()]);
		const reset: ResetMaintenancePasswordsResetUserDto[] = updated.map((user) => ({
			userId: user.id,
			firstName: user.firstName,
			lastName: user.lastName,
			// resetPasswordsToDefault only ever returns ids from the array it was given, so every key
			// here was inserted above -- falling back to [] is defensive, not an expected path.
			chartIds: chartIdsByUser.get(user.id) ?? [],
		}));

		return { reset, skipped };
	}

	// Dean is the true root; a School node whose own rootChartId is null is itself the root (no Dean
	// configured yet for this academic period).
	private resolveTreeRoot(school: { id: number; rootChartId: number | null }): number {
		return school.rootChartId ?? school.id;
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
			// Validation already loaded the node, but nothing holds it between there and here, so a
			// concurrent delete must surface as the same error validation would have raised.
			const node = await this.repository.getNodeWithType(id);
			if (!node) {
				throw new BadRequestError({
					message: chartsValidationStrings.result.maintenanceUpdateFailed,
					errors: [chartsValidationStrings.error.notFound],
				});
			}

			const newTypeCode =
				dto.entityTypeId != null ? await this.repository.getEntityTypeCode(dto.entityTypeId) : null;
			const effective = resolveEffectiveEntity(node, dto, newTypeCode);

			if (dto.entityTypeId != null) partial.entityTypeId = dto.entityTypeId;
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
