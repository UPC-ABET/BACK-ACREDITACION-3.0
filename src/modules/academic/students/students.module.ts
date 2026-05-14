import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { StudentEntity } from './model/students.entity';
import { StudentRepository } from './core/students.repository';
import { StudentService } from './api/students.service';
import { StudentController } from './api/students.controller';

@Module({
	imports: [TypeOrmModule.forFeature([StudentEntity])],
	controllers: [StudentController],
	providers: [StudentService, StudentRepository],
	exports: [StudentService, StudentRepository],
})
export class StudentModule {}
