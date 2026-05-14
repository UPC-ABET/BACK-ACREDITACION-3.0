import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ProgramEntity } from './model/programs.entity';
import { ProgramRepository } from './core/programs.repository';
import { ProgramService } from './api/programs.service';
import { ProgramController } from './api/programs.controller';

@Module({
	imports: [TypeOrmModule.forFeature([ProgramEntity])],
	controllers: [ProgramController],
	providers: [ProgramService, ProgramRepository],
	exports: [ProgramService, ProgramRepository],
})
export class ProgramModule {}
