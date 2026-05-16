import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { NotificationLogEntity } from './model/notification-log.entity';
import { NotificationLogRepository } from './core/notification-log.repository';
import { NotificationLogService } from './api/notification-log.service';
import { NotificationLogController } from './api/notification-log.controller';

@Module({
	imports: [TypeOrmModule.forFeature([NotificationLogEntity])],
	controllers: [NotificationLogController],
	providers: [NotificationLogService, NotificationLogRepository],
	exports: [NotificationLogService, NotificationLogRepository],
})
export class NotificationLogModule {}
