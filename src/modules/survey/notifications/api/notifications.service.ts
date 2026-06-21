import { Injectable } from '@nestjs/common';
import { BaseService } from 'src/commons/base.service';
import { NotificationRepository } from '../core/notifications.repository';
import { NotificationValidation } from '../core/notifications.validation';

import { CreateNotificationDto, UpdateNotificationDto } from '../model/notifications.dtos';
import { EntityManager } from 'typeorm';

@Injectable()
export class NotificationService extends BaseService<NotificationRepository> {
	constructor(protected readonly repository: NotificationRepository) {
		super(repository);
	}

	async create(dto: CreateNotificationDto, manager?: EntityManager) {
		await NotificationValidation.validateCreate(this.repository, dto);
		return await super.create(dto, manager);
	}

	async update(id: number, dto: UpdateNotificationDto, manager?: EntityManager) {
		await NotificationValidation.validateUpdate(this.repository, id, dto);
		return await super.update(id, dto, manager);
	}

	async delete(id: number, manager?: EntityManager) {
		await NotificationValidation.validateDelete(this.repository, id);
		return await super.delete(id, manager);
	}
}
