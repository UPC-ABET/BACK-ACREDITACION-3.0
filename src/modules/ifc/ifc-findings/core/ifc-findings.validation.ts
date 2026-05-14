import { HttpException, HttpStatus } from '@nestjs/common';
import { IfcFindingRepository } from './ifc-findings.repository';
import { ifcFindingsValidationStrings } from '../config/strings/ifc-findings.validation';

export class IfcFindingValidation {
	static async validateCreate(repo: IfcFindingRepository, data: any) {
		const errors: Array<string> = [];

		const exists = await repo.findOneByCondition({
			where: {
				ifc_id: data.ifc_id,
				finding_id: data.finding_id,
			},
		});

		if (exists) errors.push(ifcFindingsValidationStrings.error.relationExists);

		if (errors.length > 0) {
			throw new HttpException(
				{
					message: ifcFindingsValidationStrings.result.createFailed,
					errors,
				},
				HttpStatus.BAD_REQUEST,
			);
		}
	}

	static async validateUpdate(repo: IfcFindingRepository, id: number, data: any) {
		const errors: Array<string> = [];

		const entity = await repo.findOneById(id);
		if (!entity) errors.push(ifcFindingsValidationStrings.error.notFound);

		const ifcId = data.ifc_id ?? entity?.ifc_id;
		const findingId = data.finding_id ?? entity?.finding_id;

		const exists = await repo.findOneByCondition({
			where: {
				ifc_id: ifcId,
				finding_id: findingId,
			},
		});

		if (exists && exists.id !== id) {
			errors.push(ifcFindingsValidationStrings.error.relationExists);
		}

		if (errors.length > 0) {
			throw new HttpException(
				{
					message: ifcFindingsValidationStrings.result.updateFailed,
					errors,
				},
				HttpStatus.BAD_REQUEST,
			);
		}
	}

	static async validateDelete(repo: IfcFindingRepository, id: number) {
		if (!(await repo.findOneById(id))) {
			throw new HttpException(
				{
					message: ifcFindingsValidationStrings.result.deleteFailed,
				},
				HttpStatus.BAD_REQUEST,
			);
		}
	}
}
