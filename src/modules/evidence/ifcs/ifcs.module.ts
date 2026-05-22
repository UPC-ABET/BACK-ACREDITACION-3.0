import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { IfcEntity } from './model/ifcs.entity';
import { IfcRepository } from './core/ifcs.repository';
import { IfcService } from './api/ifcs.service';
import { IfcController } from './api/ifcs.controller';
import { PdfRendererService } from './api/pdf-renderer.service';
import { NotificationsModule } from 'src/modules/ifc/notifications/notifications.module';

@Module({
	imports: [TypeOrmModule.forFeature([IfcEntity]), NotificationsModule],
	controllers: [IfcController],
	providers: [IfcService, IfcRepository, PdfRendererService],
	exports: [IfcService, IfcRepository],
})
export class IfcModule {}
