import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { BaseService } from 'src/commons/base.service';
import { NotificationLogRepository } from '../core/notification-logs.repository';
import { CreateNotificationLogDto } from '../model/notification-logs.dtos';

@Injectable()
export class NotificationLogService extends BaseService<NotificationLogRepository> {
	constructor(protected readonly repository: NotificationLogRepository) {
		super(repository);
	}

	// Logs are written by dispatch code (IFC, survey, user), never edited by users.
	async create(dto: CreateNotificationLogDto, manager?: EntityManager) {
		return await super.create(dto, manager);
	}
}
