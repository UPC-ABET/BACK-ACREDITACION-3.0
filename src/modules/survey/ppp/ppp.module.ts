import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OutcomeConfigEntity } from 'src/modules/survey/outcome-configs/model/outcome-configs.entity';
import { SurveyEntity } from 'src/modules/evidence/surveys/model/surveys.entity';
import { ScoreEntity } from 'src/modules/survey/scores/model/scores.entity';
import { PppConfigRepository } from './core/ppp-config.repository';
import { PppSurveyRepository } from './core/ppp-survey.repository';
import { PppScoreRepository } from './core/ppp-score.repository';
import { PppConfigService } from './api/ppp-config.service';
import { PppSurveyService } from './api/ppp-survey.service';
import { PppService } from './api/ppp.service';
import { PppController } from './api/ppp.controller';
import { PerformanceLevelModule } from 'src/modules/academic/performance-levels/performance-levels.module';

@Module({
	imports: [
		TypeOrmModule.forFeature([OutcomeConfigEntity, SurveyEntity, ScoreEntity]),
		PerformanceLevelModule,
	],
	controllers: [PppController],
	providers: [
		PppService,
		PppConfigService,
		PppSurveyService,
		PppConfigRepository,
		PppSurveyRepository,
		PppScoreRepository,
	],
	exports: [PppService, PppConfigService, PppSurveyService],
})
export class PppModule {}
