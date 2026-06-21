import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MailModule } from 'src/modules/mail/mail.module';
import { NotificationLogModule } from 'src/modules/core/notification-logs/notification-logs.module';
import { NotificationConfigEntity } from 'src/modules/admin/ifc/notification-configs/model/notification-configs.entity';
import { NotificationDispatcherService } from './notification-dispatcher.service';
import { NotificationDispatcherRepository } from './core/notification-dispatcher.repository';

@Module({
	imports: [
		TypeOrmModule.forFeature([NotificationConfigEntity]),
		MailModule,
		NotificationLogModule,
	],
	providers: [NotificationDispatcherService, NotificationDispatcherRepository],
	exports: [NotificationDispatcherService],
})
export class NotificationsModule {}
