import { Injectable } from '@nestjs/common';
import { BaseService } from 'src/commons/base.service';
import { NotificationLogRepository } from '../core/notification-log.repository';
import { NotificationLogValidation } from '../core/notification-log.validation';

import { CreateNotificationLogDto, UpdateNotificationLogDto } from '../model/notification-log.dtos';
import { DataSource, EntityManager } from 'typeorm';

@Injectable()
export class NotificationLogService extends BaseService<NotificationLogRepository> {
	constructor(
		protected readonly repository: NotificationLogRepository,
		protected readonly dataSource: DataSource,
	) {
		super(repository);
	}

	async create(dto: CreateNotificationLogDto, manager?: EntityManager) {
		await NotificationLogValidation.validateCreate(this.repository, dto);
		return await super.create(dto, manager);
	}

	async update(id: number, dto: UpdateNotificationLogDto, manager?: EntityManager) {
		await NotificationLogValidation.validateUpdate(this.repository, id, dto);
		return await super.update(id, dto, manager);
	}

	async delete(id: number, manager?: EntityManager) {
		await NotificationLogValidation.validateDelete(this.repository, id);
		return await super.delete(id, manager);
	}
}
