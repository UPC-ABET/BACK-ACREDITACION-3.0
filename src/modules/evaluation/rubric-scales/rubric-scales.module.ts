import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { RubricScaleEntity } from './model/rubric-scales.entity';
import { RubricScaleRepository } from './core/rubric-scales.repository';
import { RubricScaleService } from './api/rubric-scales.service';
import { RubricScaleController } from './api/rubric-scales.controller';

@Module({
	imports: [TypeOrmModule.forFeature([RubricScaleEntity])],
	controllers: [RubricScaleController],
	providers: [RubricScaleService, RubricScaleRepository],
	exports: [RubricScaleService, RubricScaleRepository],
})
export class RubricScaleModule {}
