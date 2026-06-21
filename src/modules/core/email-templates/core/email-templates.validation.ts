import { BadRequestError } from 'src/commons/domain-error';
import { EmailTemplateRepository } from './email-templates.repository';
import { emailTemplatesValidationStrings } from '../config/strings/email-templates.validation';

export class EmailTemplateValidation {
	static async validateCreate(repo: EmailTemplateRepository, data: any) {
		const errors: Array<string> = [];

		const exists = await repo.findOneByCondition({ where: { code: data.code } });
		if (exists) errors.push(emailTemplatesValidationStrings.error.codeExists);

		if (errors.length > 0) {
			throw new BadRequestError({
				message: emailTemplatesValidationStrings.result.createFailed,
				errors,
			});
		}
	}

	static async validateUpdate(repo: EmailTemplateRepository, id: number, data: any) {
		const errors: Array<string> = [];

		const entity = await repo.findOneById(id);
		if (!entity) errors.push(emailTemplatesValidationStrings.error.notFound);

		if (data.code) {
			const exists = await repo.findOneByCondition({ where: { code: data.code } });
			if (exists && exists.id !== id) {
				errors.push(emailTemplatesValidationStrings.error.codeExists);
			}
		}

		if (errors.length > 0) {
			throw new BadRequestError({
				message: emailTemplatesValidationStrings.result.updateFailed,
				errors,
			});
		}
	}

	static async validateDelete(repo: EmailTemplateRepository, id: number) {
		if (!(await repo.findOneById(id))) {
			throw new BadRequestError({ message: emailTemplatesValidationStrings.result.deleteFailed });
		}
	}
}
