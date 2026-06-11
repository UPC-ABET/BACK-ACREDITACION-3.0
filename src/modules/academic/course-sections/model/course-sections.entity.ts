import { Entity, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from 'src/commons/base.entity';
import { CodeColumn, IntegerFKIDColumn, JsonColumn } from 'src/commons/configs/db.configs';
import { CampusEntity } from 'src/modules/organization/campuses/model/campuses.entity';
import { ProfessorEntity } from 'src/modules/academic/professors/model/professors.entity';
import { CourseEntity } from 'src/modules/academic/courses/model/courses.entity';
import { AcademicPeriodEntity } from 'src/modules/academic/academic-periods/model/academic-periods.entity';
import { TypeEntity } from 'src/modules/core/types/model/types.entity';

@Entity({ name: 'course_sections', schema: 'academic' })
export class CourseSectionEntity extends BaseEntity {
	// %% ATTRIBUTES

	@IntegerFKIDColumn({ nullable: false })
	courseId: number;

	@IntegerFKIDColumn({ nullable: false })
	academicPeriodId: number;

	@IntegerFKIDColumn({ nullable: false })
	campusId: number;

	@IntegerFKIDColumn({ nullable: false })
	professorId: number;

	@CodeColumn({ nullable: false })
	sectionCode: string;

	@JsonColumn({ nullable: true })
	schedule: any;

	@IntegerFKIDColumn({ nullable: false })
	sectionModalityTypeId: number;

	@IntegerFKIDColumn({ nullable: true })
	uploadLogId: number;

	// %% RELATIONS

	@ManyToOne(() => CourseEntity)
	@JoinColumn({ name: 'course_id', foreignKeyConstraintName: 'FK_course_sections_course_id' })
	course: CourseEntity;

	@ManyToOne(() => AcademicPeriodEntity)
	@JoinColumn({
		name: 'academic_period_id',
		foreignKeyConstraintName: 'FK_course_sections_academic_period_id',
	})
	academicPeriod: AcademicPeriodEntity;

	@ManyToOne(() => CampusEntity)
	@JoinColumn({ name: 'campus_id', foreignKeyConstraintName: 'FK_course_sections_campus_id' })
	campus: CampusEntity;

	@ManyToOne(() => ProfessorEntity)
	@JoinColumn({ name: 'professor_id', foreignKeyConstraintName: 'FK_course_sections_professor_id' })
	professor: ProfessorEntity;

	@ManyToOne(() => TypeEntity)
	@JoinColumn({
		name: 'section_modality_type_id',
		foreignKeyConstraintName: 'FK_course_sections_section_modality_type_id',
	})
	sectionModalityType: TypeEntity;
}
