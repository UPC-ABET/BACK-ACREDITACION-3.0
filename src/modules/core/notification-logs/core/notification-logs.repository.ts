import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { BaseRepository } from 'src/commons/base.repository';
import { NotificationLogEntity } from '../model/notification-logs.entity';

export class NotificationLogRepository extends BaseRepository<NotificationLogEntity> {
	constructor(
		@InjectRepository(NotificationLogEntity)
		repository: Repository<NotificationLogEntity>,
		dataSource: DataSource,
	) {
		super(repository, dataSource);
	}
}
