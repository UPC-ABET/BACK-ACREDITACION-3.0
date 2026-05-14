import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { FindingEntity } from './model/findings.entity';
import { FindingRepository } from './core/findings.repository';
import { FindingService } from './api/findings.service';
import { FindingController } from './api/findings.controller';

@Module({
	imports: [TypeOrmModule.forFeature([FindingEntity])],
	controllers: [FindingController],
	providers: [FindingService, FindingRepository],
	exports: [FindingService, FindingRepository],
})
export class FindingModule {}
