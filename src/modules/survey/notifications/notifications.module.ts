import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { NotificationEntity } from './model/notifications.entity';
import { NotificationRepository } from './core/notifications.repository';
import { NotificationService } from './api/notifications.service';
import { NotificationController } from './api/notifications.controller';

@Module({
	imports: [TypeOrmModule.forFeature([NotificationEntity])],
	controllers: [NotificationController],
	providers: [NotificationService, NotificationRepository],
	exports: [NotificationService, NotificationRepository],
})
export class NotificationModule {}
