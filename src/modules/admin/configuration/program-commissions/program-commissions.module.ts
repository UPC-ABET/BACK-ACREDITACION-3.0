import { Module } from '@nestjs/common';

import { ProgramCommissionModule } from 'src/modules/accreditation/program-commissions/program-commissions.module';
import { ProgramCommissionsController } from './api/program-commissions.controller';

@Module({
	imports: [ProgramCommissionModule],
	controllers: [ProgramCommissionsController],
})
export class ProgramCommissionsConfigModule {}
