import { Injectable } from '@nestjs/common';
import { BaseService } from 'src/commons/base.service';
import { NotificationConfigRepository } from '../core/notification-configs.repository';
import { NotificationConfigValidation } from '../core/notification-configs.validation';

import { CreateNotificationConfigDto, UpdateNotificationConfigDto } from '../model/notification-configs.dtos';
import { DataSource, EntityManager } from 'typeorm';

@Injectable()
export class NotificationConfigService extends BaseService<NotificationConfigRepository> {
	constructor(
		protected readonly repository: NotificationConfigRepository,
		protected readonly dataSource: DataSource,
	) {
		super(repository);
	}

	async create(dto: CreateNotificationConfigDto, manager?: EntityManager) {
		await NotificationConfigValidation.validateCreate(this.repository, dto);
		return await super.create(dto, manager);
	}

	async update(id: number, dto: UpdateNotificationConfigDto, manager?: EntityManager) {
		await NotificationConfigValidation.validateUpdate(this.repository, id, dto);
		return await super.update(id, dto, manager);
	}

	async delete(id: number, manager?: EntityManager) {
		await NotificationConfigValidation.validateDelete(this.repository, id);
		return await super.delete(id, manager);
	}
}
