import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UpperPrefixSnakeNamingStrategy } from 'src/commons/configs/naming-strategy';

import { ScrapeRunEntity } from './model/scrape-run.entity';
import { RawHorarioEntity } from './model/raw-horario.entity';
import { RawMatriculaEntity } from './model/raw-matricula.entity';
import { RawAlumnoEntity } from './model/raw-alumno.entity';
import { RawNotasEntity } from './model/raw-notas.entity';

import { ScrapeRunRepository } from './core/scrape-run.repository';
import { RawHorarioRepository } from './core/raw-horario.repository';
import { RawMatriculaRepository } from './core/raw-matricula.repository';
import { RawAlumnoRepository } from './core/raw-alumno.repository';
import { RawNotasRepository } from './core/raw-notas.repository';

const RAW_ENTITIES = [
	ScrapeRunEntity,
	RawHorarioEntity,
	RawMatriculaEntity,
	RawAlumnoEntity,
	RawNotasEntity,
];
const RAW_REPOSITORIES = [
	ScrapeRunRepository,
	RawHorarioRepository,
	RawMatriculaRepository,
	RawAlumnoRepository,
	RawNotasRepository,
];

@Module({
	imports: [
		TypeOrmModule.forRootAsync({
			name: 'raw',
			inject: [ConfigService],
			useFactory: (config: ConfigService) => ({
				name: 'raw',
				type: 'postgres' as const,
				url: config.getOrThrow<string>('RAW_DB_URL'),
				ssl: config.get<string>('RAW_DB_SSL') === 'true' ? { rejectUnauthorized: false } : false,
				synchronize: false,
				logging: ['error', 'warn'] as const,
				namingStrategy: new UpperPrefixSnakeNamingStrategy(),
				entities: RAW_ENTITIES,
			}),
		}),
		TypeOrmModule.forFeature(RAW_ENTITIES, 'raw'),
	],
	providers: RAW_REPOSITORIES,
	exports: RAW_REPOSITORIES,
})
export class RawDatabaseModule {}
