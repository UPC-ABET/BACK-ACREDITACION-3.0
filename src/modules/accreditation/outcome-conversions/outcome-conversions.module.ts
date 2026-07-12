import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { OutcomeConversionEntity } from './model/outcome-conversions.entity';
import { OutcomeConversionsRepository } from './core/outcome-conversions.repository';
import { OutcomeConversionsService } from './api/outcome-conversions.service';
import { OutcomeConversionsController } from './api/outcome-conversions.controller';
import { OutcomeModule } from 'src/modules/accreditation/outcomes/outcomes.module';
import { ProgramCommissionModule } from 'src/modules/accreditation/program-commissions/program-commissions.module';

@Module({
	imports: [
		TypeOrmModule.forFeature([OutcomeConversionEntity]),
		OutcomeModule,
		ProgramCommissionModule,
	],
	controllers: [OutcomeConversionsController],
	providers: [OutcomeConversionsService, OutcomeConversionsRepository],
	exports: [OutcomeConversionsService, OutcomeConversionsRepository],
})
export class OutcomeConversionsModule {}
