import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { IfcEntity } from './model/ifcs.entity';
import { IfcRepository } from './core/ifcs.repository';
import { IfcService } from './api/ifcs.service';
import { IfcStateMachineService } from './api/ifc-state-machine.service';
import { IfcContentService } from './api/ifc-content.service';
import { IfcViewService } from './api/ifc-view.service';
import { IfcReportService } from './api/ifc-report.service';
import { IfcStatusHistoryService } from './api/ifc-status-history.service';
import { IfcController } from './api/ifcs.controller';
import { ReportModule } from 'src/libs/reporting/report.module';
import { NotificationsModule } from 'src/modules/ifc/notifications/notifications.module';
import { IfcSchoolsChartRepository } from './core/ifc-schools.repository';
import { USER_SCHOOLS_REPOSITORY } from 'src/modules/organization/org-scope/core/user-schools/user-schools.repository.interface';

@Module({
	imports: [TypeOrmModule.forFeature([IfcEntity]), NotificationsModule, ReportModule],
	controllers: [IfcController],
	providers: [
		IfcService,
		IfcStateMachineService,
		IfcContentService,
		IfcViewService,
		IfcReportService,
		IfcStatusHistoryService,
		IfcRepository,
		IfcSchoolsChartRepository,
		{ provide: USER_SCHOOLS_REPOSITORY, useExisting: IfcSchoolsChartRepository },
	],
	exports: [IfcService, IfcRepository],
})
export class IfcModule {}
