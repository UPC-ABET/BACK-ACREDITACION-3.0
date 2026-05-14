import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { OutcomeEntity } from './model/outcomes.entity';
import { OutcomeRepository } from './core/outcomes.repository';
import { OutcomeService } from './api/outcomes.service';
import { OutcomeController } from './api/outcomes.controller';

@Module({
	imports: [TypeOrmModule.forFeature([OutcomeEntity])],
	controllers: [OutcomeController],
	providers: [OutcomeService, OutcomeRepository],
	exports: [OutcomeService, OutcomeRepository],
})
export class OutcomeModule {}
