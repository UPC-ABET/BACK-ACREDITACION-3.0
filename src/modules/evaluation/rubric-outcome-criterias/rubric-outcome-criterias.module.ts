import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { RubricOutcomeCriteriaEntity } from './model/rubric-outcome-criterias.entity';
import { RubricOutcomeCriteriaRepository } from './core/rubric-outcome-criterias.repository';
import { RubricOutcomeCriteriaService } from './api/rubric-outcome-criterias.service';
import { RubricOutcomeCriteriaController } from './api/rubric-outcome-criterias.controller';

@Module({
	imports: [TypeOrmModule.forFeature([RubricOutcomeCriteriaEntity])],
	controllers: [RubricOutcomeCriteriaController],
	providers: [RubricOutcomeCriteriaService, RubricOutcomeCriteriaRepository],
	exports: [RubricOutcomeCriteriaService, RubricOutcomeCriteriaRepository],
})
export class RubricOutcomeCriteriaModule {}
