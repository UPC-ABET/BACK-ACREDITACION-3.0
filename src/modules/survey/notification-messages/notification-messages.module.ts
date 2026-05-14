import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { NotificationMessageEntity } from './model/notification-messages.entity';
import { NotificationMessageRepository } from './core/notification-messages.repository';
import { NotificationMessageService } from './api/notification-messages.service';
import { NotificationMessageController } from './api/notification-messages.controller';

@Module({
	imports: [TypeOrmModule.forFeature([NotificationMessageEntity])],
	controllers: [NotificationMessageController],
	providers: [NotificationMessageService, NotificationMessageRepository],
	exports: [NotificationMessageService, NotificationMessageRepository],
})
export class NotificationMessageModule {}
