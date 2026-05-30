import { HttpException, HttpStatus } from '@nestjs/common';
import { StaffRepository } from './staff.repository';
import { staffValidationStrings } from '../config/strings/staff.validation';

export class StaffValidation {
	static async validateCreate(repo: StaffRepository, data: any) {
		const errors: Array<string> = [];

		const userExists = await repo.findOneByCondition({
			where: { userId: data.userId },
		});

		if (userExists) errors.push(staffValidationStrings.error.userExists);

		const staffEmailExists = await repo.findOneByCondition({
			where: { staffEmail: data.staffEmail },
		});

		if (staffEmailExists) errors.push(staffValidationStrings.error.staffEmailExists);

		if (errors.length > 0) {
			throw new HttpException(
				{
					message: staffValidationStrings.result.createFailed,
					errors,
				},
				HttpStatus.BAD_REQUEST,
			);
		}
	}

	static async validateUpdate(repo: StaffRepository, id: number, data: any) {
		const errors: Array<string> = [];

		const entity = await repo.findOneById(id);
		if (!entity) errors.push(staffValidationStrings.error.notFound);

		if (data.userId) {
			const userExists = await repo.findOneByCondition({
				where: { userId: data.userId },
			});

			if (userExists && userExists.id !== id) {
				errors.push(staffValidationStrings.error.userExists);
			}
		}

		if (data.staffEmail) {
			const staffEmailExists = await repo.findOneByCondition({
				where: { staffEmail: data.staffEmail },
			});

			if (staffEmailExists && staffEmailExists.id !== id) {
				errors.push(staffValidationStrings.error.staffEmailExists);
			}
		}

		if (errors.length > 0) {
			throw new HttpException(
				{
					message: staffValidationStrings.result.updateFailed,
					errors,
				},
				HttpStatus.BAD_REQUEST,
			);
		}
	}

	static async validateDelete(repo: StaffRepository, id: number) {
		if (!(await repo.findOneById(id))) {
			throw new HttpException(
				{
					message: staffValidationStrings.result.deleteFailed,
				},
				HttpStatus.BAD_REQUEST,
			);
		}
	}
}
