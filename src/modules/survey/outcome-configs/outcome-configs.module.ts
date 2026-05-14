import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { OutcomeConfigEntity } from './model/outcome-configs.entity';
import { OutcomeConfigRepository } from './core/outcome-configs.repository';
import { OutcomeConfigService } from './api/outcome-configs.service';
import { OutcomeConfigController } from './api/outcome-configs.controller';

@Module({
	imports: [TypeOrmModule.forFeature([OutcomeConfigEntity])],
	controllers: [OutcomeConfigController],
	providers: [OutcomeConfigService, OutcomeConfigRepository],
	exports: [OutcomeConfigService, OutcomeConfigRepository],
})
export class OutcomeConfigModule {}
