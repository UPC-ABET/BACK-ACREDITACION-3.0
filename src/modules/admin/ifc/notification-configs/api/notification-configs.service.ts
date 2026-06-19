import { Injectable } from '@nestjs/common';
import { BaseService } from 'src/commons/base.service';
import { NotificationConfigRepository } from '../core/notification-configs.repository';
import { NotificationConfigValidation } from '../core/notification-configs.validation';

import {
	CreateNotificationConfigDto,
	UpdateNotificationConfigDto,
	UpsertNotificationConfigDto,
} from '../model/notification-configs.dtos';
import { EntityManager } from 'typeorm';

@Injectable()
export class NotificationConfigService extends BaseService<NotificationConfigRepository> {
	constructor(protected readonly repository: NotificationConfigRepository) {
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

	async listConfigs() {
		return await this.repository.findAllConfigs();
	}

	async upsert(dto: UpsertNotificationConfigDto) {
		return await this.repository.upsertWithTemplate(dto);
	}

	async softDelete(id: number) {
		return await this.repository.softDelete(id);
	}
}
