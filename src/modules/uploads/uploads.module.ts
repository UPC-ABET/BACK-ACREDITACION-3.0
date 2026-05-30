import { Module } from '@nestjs/common';

import { UploadLogModule } from './upload-logs/upload-logs.module';
import { SectionsUploadModule } from './sections/sections-upload.module';
import { EnrolledStudentsUploadModule } from './enrolled-students/enrolled-students-upload.module';
import { ProfessorsUploadModule } from './professors/professors-upload.module';
import { GradesRcUploadModule } from './grades-rc/grades-rc-upload.module';
import { StudentSectionsUploadModule } from './student-sections/student-sections-upload.module';
import { PppUploadModule } from './ppp/ppp-upload.module';
import { ScrapingBannerUploadModule } from './scraping-banner/scraping-banner-upload.module';
import { GradesBannerUploadModule } from './grades-banner/grades-banner-upload.module';
import { StudyPlansUploadModule } from './study-plans/study-plans-upload.module';
import { ChartsUploadModule } from './charts/charts-upload.module';
import { OutcomesUploadModule } from './outcomes/outcomes-upload.module';
import { DelegatesUploadModule } from './delegates/delegates-upload.module';

// Módulo agregador del dominio de cargas. Al migrar a New_ABET, registrar UploadsModule
// en el módulo raíz (app.module). Cada flujo de carga se agrega como un feature module aquí.
@Module({
	imports: [
		UploadLogModule,
		// A — Excel DataProcessors (USP_*CargaMasiva)
		SectionsUploadModule, // A1
		EnrolledStudentsUploadModule, // A2
		ProfessorsUploadModule, // A3
		GradesRcUploadModule, // A4
		StudentSectionsUploadModule, // A5
		// B — ExcelService
		PppUploadModule, // B1
		// C — Scraping (Banner)
		ScrapingBannerUploadModule, // C1+C2
		GradesBannerUploadModule, // C3
		// D — UploadManagementService (archivos maestros)
		StudyPlansUploadModule, // D1 (Malla Curricular)
		ChartsUploadModule, // D2 (Organigrama)
		OutcomesUploadModule, // D3 (Malla COCOs / Outcomes)
		DelegatesUploadModule, // D4
	],
})
export class UploadsModule {}
