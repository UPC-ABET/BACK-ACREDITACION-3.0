import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { IfcFindingEntity } from './model/ifc-findings.entity';
import { IfcFindingRepository } from './core/ifc-findings.repository';
import { IfcFindingService } from './api/ifc-findings.service';
import { IfcFindingController } from './api/ifc-findings.controller';

@Module({
	imports: [TypeOrmModule.forFeature([IfcFindingEntity])],
	controllers: [IfcFindingController],
	providers: [IfcFindingService, IfcFindingRepository],
	exports: [IfcFindingService, IfcFindingRepository],
})
export class IfcFindingModule {}
