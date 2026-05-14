import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { RubricEntity } from './model/rubrics.entity';
import { RubricRepository } from './core/rubrics.repository';
import { RubricService } from './api/rubrics.service';
import { RubricController } from './api/rubrics.controller';

@Module({
	imports: [TypeOrmModule.forFeature([RubricEntity])],
	controllers: [RubricController],
	providers: [RubricService, RubricRepository],
	exports: [RubricService, RubricRepository],
})
export class RubricModule {}
