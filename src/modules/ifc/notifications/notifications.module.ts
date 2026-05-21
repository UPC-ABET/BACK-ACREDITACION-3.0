import { Module } from '@nestjs/common';
import { MailModule } from 'src/modules/mail/mail.module';
import { NotificationDispatcherService } from './notification-dispatcher.service';

@Module({
	imports: [MailModule],
	providers: [NotificationDispatcherService],
	exports: [NotificationDispatcherService],
})
export class NotificationsModule {}
