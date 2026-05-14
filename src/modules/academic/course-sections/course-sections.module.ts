import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { CourseSectionEntity } from './model/course-sections.entity';
import { CourseSectionRepository } from './core/course-sections.repository';
import { CourseSectionService } from './api/course-sections.service';
import { CourseSectionController } from './api/course-sections.controller';

@Module({
	imports: [TypeOrmModule.forFeature([CourseSectionEntity])],
	controllers: [CourseSectionController],
	providers: [CourseSectionService, CourseSectionRepository],
	exports: [CourseSectionService, CourseSectionRepository],
})
export class CourseSectionModule {}
