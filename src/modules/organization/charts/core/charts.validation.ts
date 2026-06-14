import { HttpException, HttpStatus } from '@nestjs/common';
import { TYPE_CODES } from 'src/modules/core/types/constants/type-codes';
import { ChartRepository } from './charts.repository';
import { chartsValidationStrings } from '../config/strings/charts.validation';
import { CreateChartNodeDto, UpdateChartNodeDto } from '../model/charts.dtos';

const ENTITY = TYPE_CODES.ENTITY_TYPE;

const ENTITY_TYPES_WITH_CODE: string[] = [ENTITY.SCHOOL, ENTITY.PROGRAM, ENTITY.COURSE];
const READ_ONLY_ENTITY_TYPES: string[] = [ENTITY.DEAN, ENTITY.SCHOOL];

export const entityTypeNeedsCode = (entityTypeCode: string): boolean =>
	ENTITY_TYPES_WITH_CODE.includes(entityTypeCode);

export const isReadOnlyEntityType = (entityTypeCode: string | null): boolean =>
	entityTypeCode !== null && READ_ONLY_ENTITY_TYPES.includes(entityTypeCode);

export const resolveEntityCode = (
	entityTypeCode: string,
	entityCode?: number | null,
): number | null => (entityTypeNeedsCode(entityTypeCode) ? (entityCode ?? null) : null);

export class ChartValidation {
	static async validateCreate(repo: ChartRepository, data: any) {
		const errors: Array<string> = [];

		const exists = await repo.findOneByCondition({
			where: {
				staffId: data.staffId,
				academicPeriodId: data.academicPeriodId,
				entityCode: data.entityCode,
			},
		});

		if (exists) errors.push(chartsValidationStrings.error.chartExists);

		if (errors.length > 0) {
			throw new HttpException(
				{
					message: chartsValidationStrings.result.createFailed,
					errors,
				},
				HttpStatus.BAD_REQUEST,
			);
		}
	}

	static async validateUpdate(repo: ChartRepository, id: number, data: any) {
		const errors: Array<string> = [];

		const entity = await repo.findOneById(id);
		if (!entity) errors.push(chartsValidationStrings.error.notFound);

		if (data.staffId && data.academicPeriodId && data.entityCode) {
			const exists = await repo.findOneByCondition({
				where: {
					staffId: data.staffId,
					academicPeriodId: data.academicPeriodId,
					entityCode: data.entityCode,
				},
			});

			if (exists && exists.id !== id) {
				errors.push(chartsValidationStrings.error.chartExists);
			}
		}

		if (errors.length > 0) {
			throw new HttpException(
				{
					message: chartsValidationStrings.result.updateFailed,
					errors,
				},
				HttpStatus.BAD_REQUEST,
			);
		}
	}

	static async validateDelete(repo: ChartRepository, id: number) {
		if (!(await repo.findOneById(id))) {
			throw new HttpException(
				{
					message: chartsValidationStrings.result.deleteFailed,
				},
				HttpStatus.BAD_REQUEST,
			);
		}
	}

	static async validateMaintenanceCreate(
		repo: ChartRepository,
		academicPeriodId: number,
		dto: CreateChartNodeDto,
	) {
		const errors: Array<string> = [];

		const parent = await repo.getNodeWithType(dto.rootChartId);
		if (!parent || parent.academicPeriodId !== academicPeriodId) {
			errors.push(chartsValidationStrings.error.parentNotFound);
		} else if (parent.entityTypeCode === ENTITY.DEAN) {
			errors.push(chartsValidationStrings.error.cannotAddUnderDean);
		}

		if (!(await repo.staffExists(dto.staffId))) {
			errors.push(chartsValidationStrings.error.staffNotFound);
		}

		const typeCode = await repo.getEntityTypeCode(dto.entityTypeId);
		if (!typeCode) {
			errors.push(chartsValidationStrings.error.entityTypeInvalid);
		} else if (isReadOnlyEntityType(typeCode)) {
			errors.push(chartsValidationStrings.error.entityTypeReadOnly);
		} else if (entityTypeNeedsCode(typeCode)) {
			if (dto.entityCode == null) {
				errors.push(chartsValidationStrings.error.entityCodeRequired);
			} else if (!(await repo.entityExists(typeCode, dto.entityCode))) {
				errors.push(chartsValidationStrings.error.entityNotFound);
			}
		}

		if (errors.length > 0) {
			throw new HttpException(
				{ message: chartsValidationStrings.result.maintenanceCreateFailed, errors },
				HttpStatus.BAD_REQUEST,
			);
		}
	}

	static async validateMaintenanceUpdate(
		repo: ChartRepository,
		id: number,
		dto: UpdateChartNodeDto,
	) {
		const node = await repo.getNodeWithType(id);
		if (!node) {
			throw new HttpException(
				{
					message: chartsValidationStrings.result.maintenanceUpdateFailed,
					errors: [chartsValidationStrings.error.notFound],
				},
				HttpStatus.BAD_REQUEST,
			);
		}

		const errors: Array<string> = [];

		if (isReadOnlyEntityType(node.entityTypeCode)) {
			errors.push(chartsValidationStrings.error.readOnlyNode);
		}

		if (dto.staffId != null && !(await repo.staffExists(dto.staffId))) {
			errors.push(chartsValidationStrings.error.staffNotFound);
		}

		if (dto.entityTypeId != null) {
			const newTypeCode = await repo.getEntityTypeCode(dto.entityTypeId);
			if (!newTypeCode) {
				errors.push(chartsValidationStrings.error.entityTypeInvalid);
			} else if (isReadOnlyEntityType(newTypeCode)) {
				errors.push(chartsValidationStrings.error.entityTypeReadOnly);
			} else if (entityTypeNeedsCode(newTypeCode)) {
				if (dto.entityCode == null) {
					errors.push(chartsValidationStrings.error.entityCodeRequired);
				} else if (!(await repo.entityExists(newTypeCode, dto.entityCode))) {
					errors.push(chartsValidationStrings.error.entityNotFound);
				}
			}
		} else if (
			dto.entityCode != null &&
			node.entityTypeCode &&
			entityTypeNeedsCode(node.entityTypeCode) &&
			!(await repo.entityExists(node.entityTypeCode, dto.entityCode))
		) {
			errors.push(chartsValidationStrings.error.entityNotFound);
		}

		if (errors.length > 0) {
			throw new HttpException(
				{ message: chartsValidationStrings.result.maintenanceUpdateFailed, errors },
				HttpStatus.BAD_REQUEST,
			);
		}
	}

	static async validateMaintenanceDelete(repo: ChartRepository, id: number) {
		const node = await repo.getNodeWithType(id);
		if (!node) {
			throw new HttpException(
				{
					message: chartsValidationStrings.result.maintenanceDeleteFailed,
					errors: [chartsValidationStrings.error.notFound],
				},
				HttpStatus.BAD_REQUEST,
			);
		}

		const errors: Array<string> = [];

		if (isReadOnlyEntityType(node.entityTypeCode)) {
			errors.push(chartsValidationStrings.error.readOnlyNode);
		}

		if ((await repo.countCourseIfcInSubtree(id)) > 0) {
			errors.push(chartsValidationStrings.error.hasIfc);
		}

		if (errors.length > 0) {
			throw new HttpException(
				{ message: chartsValidationStrings.result.maintenanceDeleteFailed, errors },
				HttpStatus.BAD_REQUEST,
			);
		}
	}
}
