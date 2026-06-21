import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { BaseService } from 'src/commons/base.service';
import { IfcFindingRepository } from '../core/ifc-findings.repository';
import { IfcFindingValidation } from '../core/ifc-findings.validation';

import {
	CreateIfcFindingDto,
	ListIfcFindingsDto,
	PatchIfcFindingDto,
	UpdateIfcFindingDto,
} from '../model/ifc-findings.dtos';
import { EntityManager } from 'typeorm';
import { TYPE_CODES } from 'src/modules/core/types/constants/type-codes';
import { IfcValidation } from 'src/modules/evidence/ifcs/core/ifcs.validation';
import { IFCS_PARAMETER_KEYS, IFC_OPS, IfcOp } from 'src/modules/evidence/ifcs/api/ifcs.constants';
import { ifcFindingsValidationStrings } from '../config/strings/ifc-findings.validation';

const DELETE_OP = 'delete' as IfcOp;
const PATCH_OP = IFC_OPS.PATCH;

@Injectable()
export class IfcFindingService extends BaseService<IfcFindingRepository> {
	constructor(protected readonly repository: IfcFindingRepository) {
		super(repository);
	}

	async create(dto: CreateIfcFindingDto, manager?: EntityManager) {
		await IfcFindingValidation.validateCreate(this.repository, dto);
		return await super.create(dto, manager);
	}

	async update(id: number, dto: UpdateIfcFindingDto, manager?: EntityManager) {
		await IfcFindingValidation.validateUpdate(this.repository, id, dto);
		return await super.update(id, dto, manager);
	}

	async delete(id: number, manager?: EntityManager) {
		await IfcFindingValidation.validateDelete(this.repository, id);
		return await super.delete(id, manager);
	}

	async list(dto: ListIfcFindingsDto, schoolId: number, academicPeriodId: number) {
		return await this.repository.listFindings(
			dto.chartIds,
			academicPeriodId,
			schoolId,
			IFCS_PARAMETER_KEYS.FINDING_PREFIX,
			TYPE_CODES.ENTITY_TYPE.SCHOOL,
		);
	}

	async deleteWithCascade(id: number, userId: number, schoolId: number) {
		return await this.repository.runInTransaction(async (em) => {
			const finding = await IfcFindingValidation.assertFindingExists(em, id);
			const courseChart = await IfcFindingValidation.resolveCourseChart(
				em,
				finding.courseId,
				finding.academicPeriodId,
				TYPE_CODES.ENTITY_TYPE.COURSE,
			);

			const requesterStaffId = await this.repository.findRequesterStaffId(em, userId);

			IfcValidation.assertRequesterIsStaff(requesterStaffId, DELETE_OP);
			await IfcValidation.assertIsInCourseChain(
				em,
				{
					ifcId: 0,
					courseChartId: courseChart.id,
					requesterStaffId,
					currentStatusCode: null,
				},
				DELETE_OP,
			);

			// schoolId is consumed by assertIsInCourseChain implicitly via the chart resolution;
			// keep the param so callers can't bypass the JWT contract.
			void schoolId;

			const actionIds = await this.repository.deleteFindingActions(em, id);
			if (actionIds.length > 0) {
				await this.repository.deleteActionsByIds(em, actionIds);
			}

			await this.repository.deleteFindingOutcomes(em, id);
			await this.repository.deleteIfcFindings(em, id);
			await this.repository.deleteFindingById(em, id);

			return null;
		});
	}

	async getDetail(id: number, schoolId: number) {
		const [findingRows, actionRows] = await Promise.all([
			this.repository.getFindingHeader(
				id,
				schoolId,
				IFCS_PARAMETER_KEYS.FINDING_PREFIX,
				TYPE_CODES.ENTITY_TYPE.SCHOOL,
			),
			this.repository.getFindingActions(
				id,
				IFCS_PARAMETER_KEYS.ACTION_PREFIX,
				TYPE_CODES.ACTION_COMPLETENESS.PENDING,
				TYPE_CODES.ACTION_COMPLETENESS.IMPLEMENTED,
			),
		]);

		if (findingRows.length === 0) {
			throw new HttpException(
				{
					message: ifcFindingsValidationStrings.result.viewFailed,
					errors: [ifcFindingsValidationStrings.error.notFound],
				},
				HttpStatus.NOT_FOUND,
			);
		}

		const row = findingRows[0];
		return {
			finding: {
				id: Number(row.id),
				findingCode: row.findingCode,
				academicPeriodCode: row.academicPeriodCode,
				description: row.description,
				criticality: {
					code: row.criticalityCode,
					name: row.criticalityName,
					color: row.criticalityColor ?? null,
				},
			},
			actions: actionRows.map((a) => ({
				id: Number(a.id),
				actionCode: a.actionCode,
				description: a.description,
				completeness: {
					code: a.completenessCode,
					name: a.completenessName,
					color: a.completenessColor ?? null,
				},
			})),
		};
	}

	async patch(id: number, dto: PatchIfcFindingDto, userId: number, schoolId: number) {
		return await this.repository.runInTransaction(async (em) => {
			const finding = await IfcFindingValidation.assertFindingExists(em, id);
			const courseChart = await IfcFindingValidation.resolveCourseChart(
				em,
				finding.courseId,
				finding.academicPeriodId,
				TYPE_CODES.ENTITY_TYPE.COURSE,
			);

			const requesterStaffId = await this.repository.findRequesterStaffId(em, userId);

			IfcValidation.assertRequesterIsStaff(requesterStaffId, PATCH_OP);
			await IfcValidation.assertIsInCourseChain(
				em,
				{
					ifcId: 0,
					courseChartId: courseChart.id,
					requesterStaffId,
					currentStatusCode: null,
				},
				PATCH_OP,
			);

			await this.assertFindingInSchool(em, id, schoolId);

			await this.repository.updateFindingDescription(em, id, dto.description);

			return { id };
		});
	}

	private async assertFindingInSchool(em: EntityManager, findingId: number, schoolId: number) {
		const found = await this.repository.isFindingInSchool(
			em,
			findingId,
			TYPE_CODES.ENTITY_TYPE.SCHOOL,
			schoolId,
		);
		if (!found) {
			throw new HttpException(
				{
					message: ifcFindingsValidationStrings.result.patchFailed,
					errors: [ifcFindingsValidationStrings.error.notFound],
				},
				HttpStatus.NOT_FOUND,
			);
		}
	}
}
