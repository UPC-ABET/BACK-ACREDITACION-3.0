import { Module } from '@nestjs/common';

import { ProgramCommissionsService } from './api/program-commissions.service';
import { ProgramCommissionsController } from './api/program-commissions.controller';

@Module({
	controllers: [ProgramCommissionsController],
	providers: [ProgramCommissionsService],
	exports: [ProgramCommissionsService],
})
export class ProgramCommissionsModule {}
