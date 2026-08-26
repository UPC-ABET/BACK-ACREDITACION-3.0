import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { UserModule } from 'src/modules/organization/users/users.module';
import { ChartEntity } from './model/charts.entity';
import { ChartRepository } from './core/charts.repository';
import { ChartService } from './api/charts.service';
import { ChartController } from './api/charts.controller';

@Module({
	imports: [TypeOrmModule.forFeature([ChartEntity]), UserModule],
	controllers: [ChartController],
	providers: [ChartService, ChartRepository],
	exports: [ChartService, ChartRepository],
})
export class ChartModule {}
