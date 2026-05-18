import { HttpException, HttpStatus } from '@nestjs/common';
import { ProjectPortfolioRepository } from './project-portfolios.repository';
import { projectPortfoliosValidationStrings } from '../config/strings/project-portfolios.validation';

export class ProjectPortfolioValidation {
	static async validateCreate(repo: ProjectPortfolioRepository, data: any) {
		const errors: string[] = [];

		if (!data?.name || String(data.name).trim() === '') {
			errors.push('error.name.required');
		}

		const academicPeriod = data?.periodoAcademicoId ?? data?.academicPeriodId;
		if (!academicPeriod) errors.push(projectPortfoliosValidationStrings.error.academicPeriodRequired);

		const modality = data?.idModalidad ?? data?.modalityId;
		if (!modality) errors.push(projectPortfoliosValidationStrings.error.modalityRequired);

		const career = data?.idCarrera ?? data?.careerId;
		if (!career) errors.push(projectPortfoliosValidationStrings.error.careerRequired);

		if (data?.code) {
			const exists = await repo.findOneByCondition({ where: { code: data.code } });
			if (exists) errors.push(projectPortfoliosValidationStrings.error.codeExists);
		}

		if (errors.length > 0) {
			throw new HttpException(
				{
					message: projectPortfoliosValidationStrings.result.createFailed,
					errors,
				},
				HttpStatus.BAD_REQUEST,
			);
		}
	}

	static async validateUpdate(repo: ProjectPortfolioRepository, id: number, data: any) {
		const errors: string[] = [];

		const entity = await repo.findOneById(id);
		if (!entity) errors.push(projectPortfoliosValidationStrings.error.notFound);

		if (data?.code) {
			const exists: any = await repo.findOneByCondition({ where: { code: data.code } });
			const found = Array.isArray(exists) ? exists.find((e: any) => e.id !== id) : exists && exists.id !== id ? exists : null;
			if (found) errors.push(projectPortfoliosValidationStrings.error.codeExists);
		}

		if (errors.length > 0) {
			throw new HttpException(
				{
					message: projectPortfoliosValidationStrings.result.updateFailed,
					errors,
				},
				HttpStatus.BAD_REQUEST,
			);
		}
	}

	static async validateDelete(repo: ProjectPortfolioRepository, id: number) {
		if (!(await repo.findOneById(id))) {
			throw new HttpException(
				{
					message: projectPortfoliosValidationStrings.result.deleteFailed,
				},
				HttpStatus.BAD_REQUEST,
			);
		}
	}
}
