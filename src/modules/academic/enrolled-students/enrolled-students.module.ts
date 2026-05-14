import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { EnrolledStudentEntity } from './model/enrolled-students.entity';
import { EnrolledStudentRepository } from './core/enrolled-students.repository';
import { EnrolledStudentService } from './api/enrolled-students.service';
import { EnrolledStudentController } from './api/enrolled-students.controller';

@Module({
	imports: [TypeOrmModule.forFeature([EnrolledStudentEntity])],
	controllers: [EnrolledStudentController],
	providers: [EnrolledStudentService, EnrolledStudentRepository],
	exports: [EnrolledStudentService, EnrolledStudentRepository],
})
export class EnrolledStudentModule {}
