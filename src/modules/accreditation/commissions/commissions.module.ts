import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { CommissionEntity } from './model/commissions.entity';
import { CommissionRepository } from './core/commissions.repository';
import { CommissionService } from './api/commissions.service';
import { CommissionController } from './api/commissions.controller';

@Module({
	imports: [TypeOrmModule.forFeature([CommissionEntity])],
	controllers: [CommissionController],
	providers: [CommissionService, CommissionRepository],
	exports: [CommissionService, CommissionRepository],
})
export class CommissionModule {}
