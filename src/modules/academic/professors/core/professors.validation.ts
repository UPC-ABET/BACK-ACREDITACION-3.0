import { HttpException, HttpStatus } from '@nestjs/common';
import { ProfessorRepository, DeleteBlockerCounts } from './professors.repository';
import { professorsValidationStrings } from '../config/strings/professors.validation';
import {
	UpdateProfessorMaintenanceDto,
	CreateProfessorMaintenanceDto,
} from '../model/professors.dtos';

const DELETE_BLOCKER_KEYS: Array<[keyof DeleteBlockerCounts, string]> = [
	['courseSections', professorsValidationStrings.error.usedInCourseSections],
	['projectEvaluators', professorsValidationStrings.error.usedInProjectEvaluators],
	['charts', professorsValidationStrings.error.usedInCharts],
	['findings', professorsValidationStrings.error.usedInFindings],
	['ifcStatuses', professorsValidationStrings.error.usedInIfcStatuses],
	['otherProfessors', professorsValidationStrings.error.sharedStaff],
];

export class ProfessorValidation {
	static async validateCreate(repo: ProfessorRepository, data: any) {
		const errors: Array<string> = [];

		const exists = await repo.findOneByCondition({
			where: {
				staffId: data.staffId,
			},
		});

		if (exists) errors.push(professorsValidationStrings.error.staffExists);

		if (errors.length > 0) {
			throw new HttpException(
				{
					message: professorsValidationStrings.result.createFailed,
					errors,
				},
				HttpStatus.BAD_REQUEST,
			);
		}
	}

	static async validateUpdate(repo: ProfessorRepository, id: number, data: any) {
		const errors: Array<string> = [];

		const entity = await repo.findOneById(id);
		if (!entity) errors.push(professorsValidationStrings.error.notFound);

		if (data.staffId) {
			const exists = await repo.findOneByCondition({
				where: {
					staffId: data.staffId,
				},
			});

			if (exists && exists.id !== id) {
				errors.push(professorsValidationStrings.error.staffExists);
			}
		}

		if (errors.length > 0) {
			throw new HttpException(
				{
					message: professorsValidationStrings.result.updateFailed,
					errors,
				},
				HttpStatus.BAD_REQUEST,
			);
		}
	}

	static async validateDelete(repo: ProfessorRepository, id: number) {
		if (!(await repo.findOneById(id))) {
			throw new HttpException(
				{
					message: professorsValidationStrings.result.deleteFailed,
				},
				HttpStatus.BAD_REQUEST,
			);
		}
	}

	static async validateMaintenanceCreate(
		repo: ProfessorRepository,
		data: CreateProfessorMaintenanceDto,
	) {
		const errors: Array<string> = [];

		const codeOwner = await repo.findOneByCondition({ where: { code: data.code } });
		if (codeOwner) errors.push(professorsValidationStrings.error.codeExists);

		if (errors.length > 0) {
			throw new HttpException(
				{ message: professorsValidationStrings.result.createFailed, errors },
				HttpStatus.BAD_REQUEST,
			);
		}
	}

	static async validateMaintenanceUpdate(
		repo: ProfessorRepository,
		id: number,
		data: UpdateProfessorMaintenanceDto,
	) {
		const errors: Array<string> = [];

		const entity = await repo.findOneById(id);
		if (!entity) {
			throw new HttpException(
				{
					message: professorsValidationStrings.result.updateFailed,
					errors: [professorsValidationStrings.error.notFound],
				},
				HttpStatus.NOT_FOUND,
			);
		}

		if (data.code !== undefined && data.code !== entity.code) {
			const codeOwner = await repo.findOneByCondition({ where: { code: data.code } });
			if (codeOwner && codeOwner.id !== id) {
				errors.push(professorsValidationStrings.error.codeExists);
			}
		}

		if (errors.length > 0) {
			throw new HttpException(
				{
					message: professorsValidationStrings.result.updateFailed,
					errors,
				},
				HttpStatus.BAD_REQUEST,
			);
		}
	}

	static async validateMaintenanceDelete(repo: ProfessorRepository, id: number) {
		const entity = await repo.findOneById(id);
		if (!entity) {
			throw new HttpException(
				{
					message: professorsValidationStrings.result.deleteFailed,
					errors: [professorsValidationStrings.error.notFound],
				},
				HttpStatus.NOT_FOUND,
			);
		}

		const counts = await repo.findDeleteBlockerCounts(id, entity.staffId);
		const blockers = DELETE_BLOCKER_KEYS.filter(([key]) => counts[key] > 0).map(([, msg]) => msg);

		if (blockers.length > 0) {
			throw new HttpException(
				{
					message: professorsValidationStrings.error.inUse,
					errors: blockers,
				},
				HttpStatus.CONFLICT,
			);
		}
	}
}
