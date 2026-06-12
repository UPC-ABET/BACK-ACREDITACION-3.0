import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { BaseService } from 'src/commons/base.service';
import { EmailTemplateRepository } from '../core/email-templates.repository';
import { EmailTemplateValidation } from '../core/email-templates.validation';
import { EmailTemplateEntity } from '../model/email-templates.entity';
import { CreateEmailTemplateDto, UpdateEmailTemplateDto } from '../model/email-templates.dtos';

@Injectable()
export class EmailTemplateService extends BaseService<EmailTemplateRepository> {
	constructor(protected readonly repository: EmailTemplateRepository) {
		super(repository);
	}

	async create(dto: CreateEmailTemplateDto, manager?: EntityManager) {
		await EmailTemplateValidation.validateCreate(this.repository, dto);
		return await super.create(dto, manager);
	}

	async update(id: number, dto: UpdateEmailTemplateDto, manager?: EntityManager) {
		await EmailTemplateValidation.validateUpdate(this.repository, id, dto);
		return await super.update(id, dto, manager);
	}

	async delete(id: number, manager?: EntityManager) {
		await EmailTemplateValidation.validateDelete(this.repository, id);
		return await super.delete(id, manager);
	}

	async findByCode(code: string): Promise<EmailTemplateEntity | null> {
		return await this.repository.findByCode(code);
	}
}
