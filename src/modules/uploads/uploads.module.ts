import { Module } from '@nestjs/common';

import { UploadLogModule } from './upload-logs/upload-logs.module';
import { SectionsUploadModule } from './sections/sections-upload.module';
import { EnrolledStudentsUploadModule } from './enrolled-students/enrolled-students-upload.module';
import { GradesRcUploadModule } from './grades-rc/grades-rc-upload.module';
import { GradesRvUploadModule } from './grades-rv/grades-rv-upload.module';
import { StudyPlansUploadModule } from './study-plans/study-plans-upload.module';
import { StaffUploadModule } from './staff/staff-upload.module';
import { ChartsUploadModule } from './charts/charts-upload.module';
import { OutcomesUploadModule } from './outcomes/outcomes-upload.module';
import { ArticulationUploadModule } from './articulation/articulation-upload.module';
import { StudentSectionsUploadModule } from './student-sections/student-sections-upload.module';
import { ProjectsUploadModule } from './projects/projects-upload.module';
import { RubricsUploadModule } from './rubrics/rubrics-upload.module';
import { ProjectGradesUploadModule } from './project-grades/project-grades-upload.module';

@Module({
	imports: [
		UploadLogModule,
		StudyPlansUploadModule,
		StaffUploadModule,
		ChartsUploadModule,
		OutcomesUploadModule,
		ArticulationUploadModule,
		SectionsUploadModule,
		EnrolledStudentsUploadModule,
		GradesRcUploadModule,
		GradesRvUploadModule,
		StudentSectionsUploadModule,
		ProjectsUploadModule,
		RubricsUploadModule,
		ProjectGradesUploadModule,
	],
})
export class UploadsModule {}
