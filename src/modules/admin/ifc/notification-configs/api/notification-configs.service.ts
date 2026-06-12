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

	async byPeriod(schoolId: number, periodId: number) {
		return await this.repository.findByPeriod(schoolId, periodId);
	}

	async upsert(schoolId: number, dto: UpsertNotificationConfigDto) {
		return await this.repository.upsertWithTemplate(schoolId, dto);
	}

	async softDelete(schoolId: number, id: number) {
		return await this.repository.softDeleteForSchool(schoolId, id);
	}
}
