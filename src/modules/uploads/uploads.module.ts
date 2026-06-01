import { Module } from '@nestjs/common';

import { UploadLogModule } from './upload-logs/upload-logs.module';
import { SectionsUploadModule } from './sections/sections-upload.module';
import { EnrolledStudentsUploadModule } from './enrolled-students/enrolled-students-upload.module';
import { GradesRcUploadModule } from './grades-rc/grades-rc-upload.module';
import { StudyPlansUploadModule } from './study-plans/study-plans-upload.module';
import { StaffUploadModule } from './staff/staff-upload.module';
import { OutcomesUploadModule } from './outcomes/outcomes-upload.module';
import { StudentSectionsUploadModule } from './student-sections/student-sections-upload.module';

@Module({
	imports: [
		UploadLogModule,
		StudyPlansUploadModule,
		StaffUploadModule,
		OutcomesUploadModule,
		SectionsUploadModule,
		EnrolledStudentsUploadModule,
		GradesRcUploadModule,
		StudentSectionsUploadModule,
	],
})
export class UploadsModule {}
