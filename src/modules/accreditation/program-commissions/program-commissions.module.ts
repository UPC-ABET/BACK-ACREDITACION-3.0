import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ProgramCommissionEntity } from './model/program-commissions.entity';
import { ProgramCommissionRepository } from './core/program-commissions.repository';
import { ProgramCommissionService } from './api/program-commissions.service';
import { ProgramCommissionController } from './api/program-commissions.controller';

@Module({
	imports: [TypeOrmModule.forFeature([ProgramCommissionEntity])],
	controllers: [ProgramCommissionController],
	providers: [ProgramCommissionService, ProgramCommissionRepository],
	exports: [ProgramCommissionService, ProgramCommissionRepository],
})
export class ProgramCommissionModule {}
