import { BadRequestError } from './domain-error';
import { ValidationConfig } from './configs/validation.config';

export abstract class BaseValidation {
	static async validateCreate(repo: any, data: any): Promise<void> {
		throw new Error('Create validation not implemented');
	}

	static async validateUpdate(repo: any, id: number, data: any): Promise<void> {
		throw new Error('Update validation not implemented');
	}

	static async validateDelete(repo: any, id: number): Promise<void> {
		throw new Error('Delete validation not implemented');
	}

	protected static async validateEntityExists(repo: any, id: number, entity = 'record') {
		if (!id) {
			throw new BadRequestError({ message: ValidationConfig.REQUIRED_ID_MESSAGE });
		}

		const exists = await repo.findOneById(id);
		if (!exists) {
			throw new BadRequestError({ message: ValidationConfig.NOT_FOUND_ENTITY(entity) });
		}
	}

	protected static async validateForeignKey(repo: any, id: number, entity: string) {
		if (!id) {
			throw new BadRequestError({ message: ValidationConfig.FK_REQUIRED(entity) });
		}

		const exists = await repo.findOneById(id);
		if (!exists) {
			throw new BadRequestError({ message: ValidationConfig.FK_NOT_FOUND(entity) });
		}
	}

	protected static throwErrors(errors: string[], message: string) {
		if (errors.length > 0) {
			throw new BadRequestError({ message, errors });
		}
	}
}
