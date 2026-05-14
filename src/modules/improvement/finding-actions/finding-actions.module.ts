import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { FindingActionEntity } from './model/finding-actions.entity';
import { FindingActionRepository } from './core/finding-actions.repository';
import { FindingActionService } from './api/finding-actions.service';
import { FindingActionController } from './api/finding-actions.controller';

@Module({
	imports: [TypeOrmModule.forFeature([FindingActionEntity])],
	controllers: [FindingActionController],
	providers: [FindingActionService, FindingActionRepository],
	exports: [FindingActionService, FindingActionRepository],
})
export class FindingActionModule {}
