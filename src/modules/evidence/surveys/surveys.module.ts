import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { SurveyEntity } from './model/surveys.entity';
import { SurveyRepository } from './core/surveys.repository';
import { SurveyService } from './api/surveys.service';
import { SurveyController } from './api/surveys.controller';

@Module({
	imports: [TypeOrmModule.forFeature([SurveyEntity])],
	controllers: [SurveyController],
	providers: [SurveyService, SurveyRepository],
	exports: [SurveyService, SurveyRepository],
})
export class SurveyModule {}
