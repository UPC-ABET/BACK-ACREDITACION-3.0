import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { BaseRepostitory } from 'src/commons/base.repository';
import { NotificationLogEntity } from '../model/notification-log.entity';

export class NotificationLogRepository extends BaseRepostitory {
	constructor(
		@InjectRepository(NotificationLogEntity)
		repository: Repository<NotificationLogEntity>,
		dataSource: DataSource,
	) {
		super(repository, dataSource);
	}
}
