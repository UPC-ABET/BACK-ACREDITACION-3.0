import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { IfcEntity } from './model/ifcs.entity';
import { IfcRepository } from './core/ifcs.repository';
import { IfcService } from './api/ifcs.service';
import { IfcController } from './api/ifcs.controller';

@Module({
	imports: [TypeOrmModule.forFeature([IfcEntity])],
	controllers: [IfcController],
	providers: [IfcService, IfcRepository],
	exports: [IfcService, IfcRepository],
})
export class IfcModule {}
