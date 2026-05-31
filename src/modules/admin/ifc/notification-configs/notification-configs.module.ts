import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { NotificationConfigEntity } from './model/notification-configs.entity';
import { NotificationConfigRepository } from './core/notification-configs.repository';
import { NotificationConfigService } from './api/notification-configs.service';
import { NotificationConfigController } from './api/notification-configs.controller';

@Module({
	imports: [TypeOrmModule.forFeature([NotificationConfigEntity])],
	controllers: [NotificationConfigController],
	providers: [NotificationConfigService, NotificationConfigRepository],
	exports: [NotificationConfigService, NotificationConfigRepository],
})
export class NotificationConfigModule {}
