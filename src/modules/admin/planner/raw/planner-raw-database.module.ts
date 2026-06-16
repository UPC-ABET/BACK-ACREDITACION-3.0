import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UpperPrefixSnakeNamingStrategy } from 'src/commons/configs/naming-strategy';

import { PlannerScrapeRunEntity } from './model/planner-scrape-run.entity';
import { RawPlannerSeccionEntity } from './model/raw-planner-seccion.entity';
import { RawPlannerEvaluacionEntity } from './model/raw-planner-evaluacion.entity';
import { RawPlannerNotaEntity } from './model/raw-planner-nota.entity';

import { PlannerScrapeRunRepository } from './core/planner-scrape-run.repository';
import { RawPlannerSeccionRepository } from './core/raw-planner-seccion.repository';
import { RawPlannerEvaluacionRepository } from './core/raw-planner-evaluacion.repository';
import { RawPlannerNotaRepository } from './core/raw-planner-nota.repository';

const RAW_ENTITIES = [
	PlannerScrapeRunEntity,
	RawPlannerSeccionEntity,
	RawPlannerEvaluacionEntity,
	RawPlannerNotaEntity,
];
const RAW_REPOSITORIES = [
	PlannerScrapeRunRepository,
	RawPlannerSeccionRepository,
	RawPlannerEvaluacionRepository,
	RawPlannerNotaRepository,
];

// Planner raw tables live in the same separate scraping DB as Banner's, but on a dedicated,
// self-contained datasource ("planner-raw") so this module never has to touch Banner's "raw"
// connection (whose entity list is fixed). Same RAW_DB_URL / RAW_DB_SSL; synchronize off —
// schema is owned by the migration in src/database/migrations-raw/.
@Module({
	imports: [
		TypeOrmModule.forRootAsync({
			name: 'planner-raw',
			inject: [ConfigService],
			useFactory: (config: ConfigService) => ({
				name: 'planner-raw',
				type: 'postgres' as const,
				url: config.getOrThrow<string>('RAW_DB_URL'),
				ssl: config.get<string>('RAW_DB_SSL') === 'true' ? { rejectUnauthorized: false } : false,
				synchronize: false,
				logging: ['error', 'warn'] as const,
				namingStrategy: new UpperPrefixSnakeNamingStrategy(),
				entities: RAW_ENTITIES,
			}),
		}),
		TypeOrmModule.forFeature(RAW_ENTITIES, 'planner-raw'),
	],
	providers: RAW_REPOSITORIES,
	exports: RAW_REPOSITORIES,
})
export class PlannerRawDatabaseModule {}
