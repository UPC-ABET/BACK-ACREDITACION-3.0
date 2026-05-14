import { HttpException, HttpStatus } from '@nestjs/common';
import { ProgramCommissionRepository } from './program-commissions.repository';
import { programCommissionsValidationStrings } from '../config/strings/program-commissions.validation';

export class ProgramCommissionValidation {
	static async validateCreate(repo: ProgramCommissionRepository, data: any) {
		const errors: Array<string> = [];

		const exists = await repo.findOneByCondition({
			where: {
				commission_id: data.commission_id,
				program_id: data.program_id,
				academic_period_id: data.academic_period_id,
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

		if (data.commission_id && data.program_id && data.academic_period_id) {
			const exists = await repo.findOneByCondition({
				where: {
					commission_id: data.commission_id,
					program_id: data.program_id,
					academic_period_id: data.academic_period_id,
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
