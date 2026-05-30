import { HttpException, HttpStatus } from '@nestjs/common';
import { ProgramCommissionRepository } from './program-commissions.repository';
import { programCommissionsValidationStrings } from '../config/strings/program-commissions.validation';

export class ProgramCommissionValidation {
	static async validateCreate(repo: ProgramCommissionRepository, data: any) {
		const errors: Array<string> = [];

		const exists = await repo.findOneByCondition({
			where: {
				commissionId: data.commissionId,
				programId: data.programId,
				academicPeriodId: data.academicPeriodId,
			},
		});

		if (exists) errors.push(programCommissionsValidationStrings.error.programCommissionExists);

		if (errors.length > 0) {
			throw new HttpException(
				{
					message: programCommissionsValidationStrings.result.createFailed,
					errors,
				},
				HttpStatus.BAD_REQUEST,
			);
		}
	}

	static async validateUpdate(repo: ProgramCommissionRepository, id: number, data: any) {
		const errors: Array<string> = [];

		const entity = await repo.findOneById(id);
		if (!entity) errors.push(programCommissionsValidationStrings.error.notFound);

		if (data.commissionId && data.programId && data.academicPeriodId) {
			const exists = await repo.findOneByCondition({
				where: {
					commissionId: data.commissionId,
					programId: data.programId,
					academicPeriodId: data.academicPeriodId,
				},
			});

			if (exists && exists.id !== id) {
				errors.push(programCommissionsValidationStrings.error.programCommissionExists);
			}
		}

		if (errors.length > 0) {
			throw new HttpException(
				{
					message: programCommissionsValidationStrings.result.updateFailed,
					errors,
				},
				HttpStatus.BAD_REQUEST,
			);
		}
	}

	static async validateDelete(repo: ProgramCommissionRepository, id: number) {
		if (!(await repo.findOneById(id))) {
			throw new HttpException(
				{
					message: programCommissionsValidationStrings.result.deleteFailed,
				},
				HttpStatus.BAD_REQUEST,
			);
		}
	}
}
