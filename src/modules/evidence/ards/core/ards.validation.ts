import { BadRequestError, NotFoundError } from 'src/commons/domain-error';
import { CreateArdDto, UpdateArdDto } from '../model/ards.dtos';
import { ArdRepository } from './ards.repository';
import { ardsValidationStrings } from '../config/strings/ards.validation';

export class ArdValidation {
	static async validateCreate(
		repository: ArdRepository,
		academicPeriodId: number,
		dto: CreateArdDto,
	): Promise<void> {
		await this.validatePayload(
			repository,
			academicPeriodId,
			dto,
			ardsValidationStrings.result.createFailed,
		);
	}

	static async validateUpdate(
		repository: ArdRepository,
		id: number,
		academicPeriodId: number,
		dto: UpdateArdDto,
	): Promise<void> {
		const exists = await repository.existsActive(id);
		if (!exists) {
			throw new NotFoundError(ardsValidationStrings.error.notFound);
		}
		await this.validatePayload(
			repository,
			academicPeriodId,
			dto,
			ardsValidationStrings.result.updateFailed,
		);
	}

	static async validateDelete(repository: ArdRepository, id: number): Promise<void> {
		const exists = await repository.existsActive(id);
		if (!exists) {
			throw new NotFoundError(ardsValidationStrings.error.notFound);
		}
	}

	private static async validatePayload(
		repository: ArdRepository,
		academicPeriodId: number,
		dto: CreateArdDto | UpdateArdDto,
		message: string,
	): Promise<void> {
		const errors: string[] = [];

		if (!dto.details || dto.details.length === 0) {
			errors.push(ardsValidationStrings.error.detailRequired);
		}

		if (errors.length > 0) {
			throw new BadRequestError({
				message,
				errors,
			});
		}
	}
}
