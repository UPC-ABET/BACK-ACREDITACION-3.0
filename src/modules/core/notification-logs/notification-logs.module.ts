import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { NotificationLogEntity } from './model/notification-logs.entity';
import { NotificationLogRepository } from './core/notification-logs.repository';
import { NotificationLogService } from './api/notification-logs.service';
import { NotificationLogController } from './api/notification-logs.controller';

@Module({
	imports: [TypeOrmModule.forFeature([NotificationLogEntity])],
	controllers: [NotificationLogController],
	providers: [NotificationLogService, NotificationLogRepository],
	exports: [NotificationLogService, NotificationLogRepository],
})
export class NotificationLogModule {}
