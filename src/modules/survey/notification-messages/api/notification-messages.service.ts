import { Injectable } from '@nestjs/common';
import { BaseService } from 'src/commons/base.service';
import { NotificationMessageRepository } from '../core/notification-messages.repository';
import { NotificationMessageValidation } from '../core/notification-messages.validation';

import { CreateNotificationMessageDto, UpdateNotificationMessageDto } from '../model/notification-messages.dtos';
import { DataSource, EntityManager } from 'typeorm';

@Injectable()
export class NotificationMessageService extends BaseService<NotificationMessageRepository> {
	constructor(
		protected readonly repository: NotificationMessageRepository,
		protected readonly dataSource: DataSource,
	) {
		super(repository);
	}

	async create(dto: CreateNotificationMessageDto, manager?: EntityManager) {
		await NotificationMessageValidation.validateCreate(this.repository, dto);
		return await super.create(dto, manager);
	}

	async update(id: number, dto: UpdateNotificationMessageDto, manager?: EntityManager) {
		await NotificationMessageValidation.validateUpdate(this.repository, id, dto);
		return await super.update(id, dto, manager);
	}

	async delete(id: number, manager?: EntityManager) {
		await NotificationMessageValidation.validateDelete(this.repository, id);
		return await super.delete(id, manager);
	}
}
