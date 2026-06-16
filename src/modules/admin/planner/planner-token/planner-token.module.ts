import { Module } from '@nestjs/common';
import { PlannerTokenService } from './api/planner-token.service';
import { PlannerSessionController } from './api/planner-session.controller';

@Module({
	controllers: [PlannerSessionController],
	providers: [PlannerTokenService],
	exports: [PlannerTokenService],
})
export class PlannerTokenModule {}
