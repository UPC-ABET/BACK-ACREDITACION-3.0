import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { PlanEntity } from './model/plans.entity';
import { PlanRepository } from './core/plans.repository';
import { PlanService } from './api/plans.service';
import { PlanController } from './api/plans.controller';

@Module({
	imports: [TypeOrmModule.forFeature([PlanEntity])],
	controllers: [PlanController],
	providers: [PlanService, PlanRepository],
	exports: [PlanService, PlanRepository],
})
export class PlanModule {}
