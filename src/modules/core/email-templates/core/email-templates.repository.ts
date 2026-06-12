import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { BaseRepository } from 'src/commons/base.repository';
import { EmailTemplateEntity } from '../model/email-templates.entity';

export class EmailTemplateRepository extends BaseRepository<EmailTemplateEntity> {
	constructor(
		@InjectRepository(EmailTemplateEntity)
		repository: Repository<EmailTemplateEntity>,
		dataSource: DataSource,
	) {
		super(repository, dataSource);
	}

	async findByCode(code: string): Promise<EmailTemplateEntity | null> {
		return await this.repository.findOne({ where: { code } });
	}
}
