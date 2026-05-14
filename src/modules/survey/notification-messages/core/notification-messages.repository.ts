import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { BaseRepostitory } from 'src/commons/base.repository';
import { NotificationMessageEntity } from '../model/notification-messages.entity';

export class NotificationMessageRepository extends BaseRepostitory {
	constructor(
		@InjectRepository(NotificationMessageEntity)
		repository: Repository<NotificationMessageEntity>,
		dataSource: DataSource,
	) {
		super(repository, dataSource);
	}
}
