import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { BaseRepository } from 'src/commons/base.repository';
import { NotificationConfigEntity } from '../model/notification-configs.entity';

export class NotificationConfigRepository extends BaseRepository<NotificationConfigEntity> {
	constructor(
		@InjectRepository(NotificationConfigEntity)
		repository: Repository<NotificationConfigEntity>,
		dataSource: DataSource,
	) {
		super(repository, dataSource);
	}
}
