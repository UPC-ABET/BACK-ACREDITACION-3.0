import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { PlanActionEntity } from './model/plan-actions.entity';
import { PlanActionRepository } from './core/plan-actions.repository';
import { PlanActionService } from './api/plan-actions.service';
import { PlanActionController } from './api/plan-actions.controller';

@Module({
	imports: [TypeOrmModule.forFeature([PlanActionEntity])],
	controllers: [PlanActionController],
	providers: [PlanActionService, PlanActionRepository],
	exports: [PlanActionService, PlanActionRepository],
})
export class PlanActionModule {}
