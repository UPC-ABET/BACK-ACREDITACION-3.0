import { Injectable } from '@nestjs/common';
import { BaseService } from 'src/commons/base.service';
import { NotificationMessageRepository } from '../core/notification-messages.repository';
import { NotificationMessageValidation } from '../core/notification-messages.validation';

import {
	CreateNotificationMessageDto,
	UpdateNotificationMessageDto,
} from '../model/notification-messages.dtos';
import { EntityManager } from 'typeorm';

@Injectable()
export class NotificationMessageService extends BaseService<NotificationMessageRepository> {
	constructor(protected readonly repository: NotificationMessageRepository) {
		super(repository);
	}

	// One-shot save: creates the SURVEY email template AND the message together.
	async create(dto: CreateNotificationMessageDto) {
		await NotificationMessageValidation.validateCreate(this.repository, dto);
		return await this.repository.createWithTemplate(dto);
	}

	async update(id: number, dto: UpdateNotificationMessageDto) {
		await NotificationMessageValidation.validateUpdate(this.repository, id, dto);
		return await this.repository.updateWithTemplate(id, dto);
	}

	async delete(id: number, manager?: EntityManager) {
		await NotificationMessageValidation.validateDelete(this.repository, id);
		return await super.delete(id, manager);
	}
}
