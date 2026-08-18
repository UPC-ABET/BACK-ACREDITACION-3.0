import { BadRequestError } from 'src/commons/domain-error';
import { TYPE_CODES } from 'src/modules/core/types/constants/type-codes';
import { ChartRepository } from './charts.repository';
import { chartsValidationStrings } from '../config/strings/charts.validation';
import { CreateChartNodeDto, UpdateChartNodeDto } from '../model/charts.dtos';

const ENTITY = TYPE_CODES.ENTITY_TYPE;

const ENTITY_TYPES_WITH_CODE: string[] = [ENTITY.SCHOOL, ENTITY.PROGRAM, ENTITY.COURSE];
// Program joins Dean/School: it is written only by the chart-heads pre-configuration step, never
// by the Excel upload, the maintenance UI, or generic CRUD.
const READ_ONLY_ENTITY_TYPES: string[] = [ENTITY.DEAN, ENTITY.SCHOOL, ENTITY.PROGRAM];
const PROGRAM_ANCESTOR_ENTITY_TYPES: string[] = [ENTITY.AREA, ENTITY.SUBAREA, ENTITY.COURSE];

export const entityTypeNeedsCode = (entityTypeCode: string): boolean =>
	ENTITY_TYPES_WITH_CODE.includes(entityTypeCode);

export const isReadOnlyEntityType = (entityTypeCode: string | null): boolean =>
	entityTypeCode !== null && READ_ONLY_ENTITY_TYPES.includes(entityTypeCode);

// Area, Subarea and Course must resolve to a Program node before reaching the School root.
// Program itself never needs this (it is the thing being required), and Dean/School are
// read-only, so they never reach this check either.
export const requiresProgramAncestor = (entityTypeCode: string | null): boolean =>
	entityTypeCode !== null && PROGRAM_ANCESTOR_ENTITY_TYPES.includes(entityTypeCode);

export const resolveEntityCode = (
	entityTypeCode: string,
	entityCode?: number | null,
): number | null => (entityTypeNeedsCode(entityTypeCode) ? (entityCode ?? null) : null);

/**
 * The (entityTypeId, entityCode) a partial edit will actually leave on the node.
 *
 * A maintenance update may carry a new type, a new code, or neither, and the code is only kept
 * for types that take one. Validation and ChartService.updateNode must agree on the result or
 * one of them checks a trio the other never writes, and the duplicate slips through.
 */
export const resolveEffectiveEntity = (
	current: {
		entityTypeId: number | null;
		entityTypeCode: string | null;
		entityCode: number | null;
	},
	dto: { entityTypeId?: number; entityCode?: number },
	newTypeCode: string | null,
): { entityTypeId: number | null; entityCode: number | null } => {
	if (dto.entityTypeId != null) {
		return {
			entityTypeId: dto.entityTypeId,
			entityCode: newTypeCode ? resolveEntityCode(newTypeCode, dto.entityCode) : null,
		};
	}
	if (dto.entityCode != null) {
		return {
			entityTypeId: current.entityTypeId,
			entityCode: current.entityTypeCode
				? resolveEntityCode(current.entityTypeCode, dto.entityCode)
				: null,
		};
	}
	return { entityTypeId: current.entityTypeId, entityCode: current.entityCode };
};

export class ChartValidation {
	// The one place the uniqueness key is expressed in TypeScript: an entity may hold at most one
	// active chart node per academic period. Nodes without an entity code (Area/Subarea/untagged)
	// are exempt, which is why a null on either component short-circuits to "free".
	static async isEntityTakenInPeriod(
		repo: ChartRepository,
		params: {
			academicPeriodId: number;
			entityTypeId: number | null | undefined;
			entityCode: number | null | undefined;
			excludeChartId?: number;
		},
	): Promise<boolean> {
		const { academicPeriodId, entityTypeId, entityCode, excludeChartId } = params;
		if (entityTypeId == null || entityCode == null) return false;

		const found = await repo.findActiveNodeByEntity(academicPeriodId, entityTypeId, entityCode);
		return found !== null && found.id !== excludeChartId;
	}

	static async validateCreate(repo: ChartRepository, data: any) {
		const errors: Array<string> = [];

		if (data.entityTypeId != null) {
			const typeCode = await repo.getEntityTypeCode(data.entityTypeId);
			if (typeCode && isReadOnlyEntityType(typeCode)) {
				errors.push(chartsValidationStrings.error.entityTypeReadOnly);
			} else if (
				requiresProgramAncestor(typeCode) &&
				!(await repo.hasProgramAncestor(data.rootChartId ?? null))
			) {
				errors.push(chartsValidationStrings.error.programAncestorRequired);
			}
		}

		if (
			await ChartValidation.isEntityTakenInPeriod(repo, {
				academicPeriodId: data.academicPeriodId,
				entityTypeId: data.entityTypeId,
				entityCode: data.entityCode,
			})
		) {
			errors.push(chartsValidationStrings.error.entityAlreadyAssigned);
		}

		if (errors.length > 0) {
			throw new BadRequestError({
				message: chartsValidationStrings.result.createFailed,
				errors,
			});
		}
	}

	static async validateUpdate(repo: ChartRepository, id: number, data: any) {
		const errors: Array<string> = [];

		const entity = await repo.findOneById(id);
		if (!entity) {
			errors.push(chartsValidationStrings.error.notFound);
		} else {
			// Only re-checked when the parent or the type is actually part of this write — a
			// staff/title-only edit never re-walks ancestry.
			if (data.rootChartId !== undefined || data.entityTypeId !== undefined) {
				const effectiveTypeId = data.entityTypeId ?? entity.entityTypeId;
				const typeCode =
					effectiveTypeId != null ? await repo.getEntityTypeCode(effectiveTypeId) : null;
				if (typeCode && isReadOnlyEntityType(typeCode)) {
					errors.push(chartsValidationStrings.error.entityTypeReadOnly);
				} else if (requiresProgramAncestor(typeCode)) {
					const effectiveRoot =
						data.rootChartId !== undefined ? data.rootChartId : entity.rootChartId;
					if (!(await repo.hasProgramAncestor(effectiveRoot ?? null))) {
						errors.push(chartsValidationStrings.error.programAncestorRequired);
					}
				}
			}

			if (
				await ChartValidation.isEntityTakenInPeriod(repo, {
					academicPeriodId: data.academicPeriodId ?? entity.academicPeriodId,
					entityTypeId: data.entityTypeId ?? entity.entityTypeId,
					entityCode: data.entityCode ?? entity.entityCode,
					excludeChartId: id,
				})
			) {
				errors.push(chartsValidationStrings.error.entityAlreadyAssigned);
			}
		}

		if (errors.length > 0) {
			throw new BadRequestError({
				message: chartsValidationStrings.result.updateFailed,
				errors,
			});
		}
	}

	static async validateDelete(repo: ChartRepository, id: number) {
		if (!(await repo.findOneById(id))) {
			throw new BadRequestError({
				message: chartsValidationStrings.result.deleteFailed,
			});
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
		} else {
			if (entityTypeNeedsCode(typeCode)) {
				if (dto.entityCode == null) {
					errors.push(chartsValidationStrings.error.entityCodeRequired);
				} else if (!(await repo.entityExists(typeCode, dto.entityCode))) {
					errors.push(chartsValidationStrings.error.entityNotFound);
				} else if (
					await ChartValidation.isEntityTakenInPeriod(repo, {
						academicPeriodId,
						entityTypeId: dto.entityTypeId,
						entityCode: resolveEntityCode(typeCode, dto.entityCode),
					})
				) {
					errors.push(chartsValidationStrings.error.entityAlreadyAssigned);
				}
			}

			if (requiresProgramAncestor(typeCode) && !(await repo.hasProgramAncestor(dto.rootChartId))) {
				errors.push(chartsValidationStrings.error.programAncestorRequired);
			}
		}

		if (errors.length > 0) {
			throw new BadRequestError({
				message: chartsValidationStrings.result.maintenanceCreateFailed,
				errors,
			});
		}
	}

	static async validateMaintenanceUpdate(
		repo: ChartRepository,
		id: number,
		dto: UpdateChartNodeDto,
	) {
		const node = await repo.getNodeWithType(id);
		if (!node) {
			throw new BadRequestError({
				message: chartsValidationStrings.result.maintenanceUpdateFailed,
				errors: [chartsValidationStrings.error.notFound],
			});
		}

		const errors: Array<string> = [];

		if (isReadOnlyEntityType(node.entityTypeCode)) {
			errors.push(chartsValidationStrings.error.readOnlyNode);
		}

		if (dto.staffId != null && !(await repo.staffExists(dto.staffId))) {
			errors.push(chartsValidationStrings.error.staffNotFound);
		}

		let newTypeCode: string | null = null;

		if (dto.entityTypeId != null) {
			newTypeCode = await repo.getEntityTypeCode(dto.entityTypeId);
			if (!newTypeCode) {
				errors.push(chartsValidationStrings.error.entityTypeInvalid);
			} else if (isReadOnlyEntityType(newTypeCode)) {
				errors.push(chartsValidationStrings.error.entityTypeReadOnly);
			} else {
				if (entityTypeNeedsCode(newTypeCode)) {
					if (dto.entityCode == null) {
						errors.push(chartsValidationStrings.error.entityCodeRequired);
					} else if (!(await repo.entityExists(newTypeCode, dto.entityCode))) {
						errors.push(chartsValidationStrings.error.entityNotFound);
					}
				}

				// UpdateChartNodeDto carries no rootChartId — a maintenance update can never move a
				// node, so re-typing into Area/Subarea/Course is checked against the node's own,
				// already-fixed parent.
				if (
					requiresProgramAncestor(newTypeCode) &&
					!(await repo.hasProgramAncestor(node.rootChartId))
				) {
					errors.push(chartsValidationStrings.error.programAncestorRequired);
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

		// Only once the type and entity resolve: reporting a duplicate on top of an invalid type
		// would name the wrong problem.
		if (errors.length === 0) {
			const effective = resolveEffectiveEntity(node, dto, newTypeCode);
			if (
				await ChartValidation.isEntityTakenInPeriod(repo, {
					academicPeriodId: node.academicPeriodId,
					entityTypeId: effective.entityTypeId,
					entityCode: effective.entityCode,
					excludeChartId: id,
				})
			) {
				errors.push(chartsValidationStrings.error.entityAlreadyAssigned);
			}
		}

		if (errors.length > 0) {
			throw new BadRequestError({
				message: chartsValidationStrings.result.maintenanceUpdateFailed,
				errors,
			});
		}
	}

	static async validateMaintenanceDelete(repo: ChartRepository, id: number) {
		const node = await repo.getNodeWithType(id);
		if (!node) {
			throw new BadRequestError({
				message: chartsValidationStrings.result.maintenanceDeleteFailed,
				errors: [chartsValidationStrings.error.notFound],
			});
		}

		const errors: Array<string> = [];

		if (isReadOnlyEntityType(node.entityTypeCode)) {
			errors.push(chartsValidationStrings.error.readOnlyNode);
		}

		if ((await repo.countCourseIfcInSubtree(id)) > 0) {
			errors.push(chartsValidationStrings.error.hasIfc);
		}

		if (errors.length > 0) {
			throw new BadRequestError({
				message: chartsValidationStrings.result.maintenanceDeleteFailed,
				errors,
			});
		}
	}
}
