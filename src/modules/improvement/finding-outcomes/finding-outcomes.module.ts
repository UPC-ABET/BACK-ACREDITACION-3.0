import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { FindingOutcomeEntity } from './model/finding-outcomes.entity';
import { FindingOutcomeRepository } from './core/finding-outcomes.repository';
import { FindingOutcomeService } from './api/finding-outcomes.service';
import { FindingOutcomeController } from './api/finding-outcomes.controller';

@Module({
	imports: [TypeOrmModule.forFeature([FindingOutcomeEntity])],
	controllers: [FindingOutcomeController],
	providers: [FindingOutcomeService, FindingOutcomeRepository],
	exports: [FindingOutcomeService, FindingOutcomeRepository],
})
export class FindingOutcomeModule {}
