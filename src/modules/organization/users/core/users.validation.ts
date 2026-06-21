import { BadRequestError } from 'src/commons/domain-error';
import { UserRepository } from './users.repository';
import { usersValidationStrings } from '../config/strings/users.validation';
import { BaseValidation } from 'src/commons/base.validation';

export class UserValidation extends BaseValidation {
	static async validateCreate(repo: UserRepository, data: any) {
		const exists = await repo.findOneByCondition({
			where: { email: data.email },
		});

		if (exists) {
			throw new BadRequestError({ message: usersValidationStrings.error.emailExists });
		}
	}

	static async validateUpdate(repo: UserRepository, id: number, data: any) {
		const entity = await repo.findOneById(id);

		if (!entity) {
			throw new BadRequestError({ message: usersValidationStrings.result.updateFailed });
		}
	}

	static async validateDelete(repo: UserRepository, id: number) {
		const entity = await repo.findOneById(id);

		if (!entity) {
			throw new BadRequestError({ message: usersValidationStrings.result.deleteFailed });
		}
	}
}
