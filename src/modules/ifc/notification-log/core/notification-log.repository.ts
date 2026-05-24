import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { BaseRepository } from 'src/commons/base.repository';
import { NotificationLogEntity } from '../model/notification-log.entity';

export class NotificationLogRepository extends BaseRepository {
	constructor(
		@InjectRepository(NotificationLogEntity)
		repository: Repository<NotificationLogEntity>,
		dataSource: DataSource,
	) {
		super(repository, dataSource);
	}
}
