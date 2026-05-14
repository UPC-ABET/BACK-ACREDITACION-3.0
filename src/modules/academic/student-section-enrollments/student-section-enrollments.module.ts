import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { StudentSectionEnrollmentEntity } from './model/student-section-enrollments.entity';
import { StudentSectionEnrollmentRepository } from './core/student-section-enrollments.repository';
import { StudentSectionEnrollmentService } from './api/student-section-enrollments.service';
import { StudentSectionEnrollmentController } from './api/student-section-enrollments.controller';

@Module({
	imports: [TypeOrmModule.forFeature([StudentSectionEnrollmentEntity])],
	controllers: [StudentSectionEnrollmentController],
	providers: [StudentSectionEnrollmentService, StudentSectionEnrollmentRepository],
	exports: [StudentSectionEnrollmentService, StudentSectionEnrollmentRepository],
})
export class StudentSectionEnrollmentModule {}
