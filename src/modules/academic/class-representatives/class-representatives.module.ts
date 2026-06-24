import { Module } from '@nestjs/common';
import { StudentSectionEnrollmentModule } from 'src/modules/academic/student-section-enrollments/student-section-enrollments.module';
import { ClassRepresentativesService } from './api/class-representatives.service';
import { ClassRepresentativesController } from './api/class-representatives.controller';

@Module({
	imports: [StudentSectionEnrollmentModule],
	controllers: [ClassRepresentativesController],
	providers: [ClassRepresentativesService],
	exports: [ClassRepresentativesService],
})
export class ClassRepresentativesModule {}
