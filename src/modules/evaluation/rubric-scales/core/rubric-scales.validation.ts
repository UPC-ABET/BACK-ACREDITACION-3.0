import { HttpException, HttpStatus } from '@nestjs/common';
import { RubricScaleRepository } from './rubric-scales.repository';
import { rubricScalesValidationStrings } from '../config/strings/rubric-scales.validation';

export class RubricScaleValidation {
	static async validateCreate(repo: RubricScaleRepository, data: any) {
		const errors: Array<string> = [];

		const existsByCode = await repo.findOneByCondition({
			where: { code: data.code },
		});

		if (existsByCode) errors.push(rubricScalesValidationStrings.error.codeExists);

		const existsByRubricAndName = await repo.findOneByCondition({
			where: {
				rubric_id: data.rubric_id,
				name: data.name,
			},
		});

		if (existsByRubricAndName) errors.push(rubricScalesValidationStrings.error.rubricScaleExists);

		if (errors.length > 0) {
			throw new HttpException(
				{
					message: rubricScalesValidationStrings.result.createFailed,
					errors,
				},
				HttpStatus.BAD_REQUEST,
			);
		}
	}

	static async validateUpdate(repo: RubricScaleRepository, id: number, data: any) {
		const errors: Array<string> = [];

		const entity = await repo.findOneById(id);
		if (!entity) errors.push(rubricScalesValidationStrings.error.notFound);

		if (data.code) {
			const existsByCode = await repo.findOneByCondition({
				where: { code: data.code },
			});

			if (existsByCode && existsByCode.id !== id) {
				errors.push(rubricScalesValidationStrings.error.codeExists);
			}
		}

		const rubricId = data.rubric_id ?? entity?.rubric_id;
		const name = data.name ?? entity?.name;

		const existsByRubricAndName = await repo.findOneByCondition({
			where: {
				rubric_id: rubricId,
				name,
			},
		});

		if (existsByRubricAndName && existsByRubricAndName.id !== id) {
			errors.push(rubricScalesValidationStrings.error.rubricScaleExists);
		}

		if (errors.length > 0) {
			throw new HttpException(
				{
					message: rubricScalesValidationStrings.result.updateFailed,
					errors,
				},
				HttpStatus.BAD_REQUEST,
			);
		}
	}

	static async validateDelete(repo: RubricScaleRepository, id: number) {
		if (!(await repo.findOneById(id))) {
			throw new HttpException(
				{
					message: rubricScalesValidationStrings.result.deleteFailed,
				},
				HttpStatus.BAD_REQUEST,
			);
		}
	}
}
