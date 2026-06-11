import { Module } from '@nestjs/common';
import { MailModule } from 'src/modules/mail/mail.module';
import { NotificationLogModule } from 'src/modules/ifc/notification-log/notification-log.module';
import { NotificationDispatcherService } from './notification-dispatcher.service';

@Module({
	imports: [MailModule, NotificationLogModule],
	providers: [NotificationDispatcherService],
	exports: [NotificationDispatcherService],
})
export class NotificationsModule {}
