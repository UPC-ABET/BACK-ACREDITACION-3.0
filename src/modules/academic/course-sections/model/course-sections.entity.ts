import { Entity, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from 'src/commons/base.entity';
import { CodeColumn, IntegerFKIDColumn, JsonColumn } from 'src/commons/configs/db.configs';
import { CampusEntity } from 'src/modules/organization/campuses/model/campuses.entity';
import { ProfessorEntity } from 'src/modules/academic/professors/model/professors.entity';
import { StudyPlanCourseEntity } from 'src/modules/academic/study-plan-courses/model/study-plan-courses.entity';
import { TypeEntity } from 'src/modules/core/types/model/types.entity';

@Entity({ name: 'course_sections', schema: 'academic' })
export class CourseSectionEntity extends BaseEntity {
	// %% ATTRIBUTES

	@IntegerFKIDColumn({ nullable: false })
	study_plan_course_id: number;

	@IntegerFKIDColumn({ nullable: false })
	campus_id: number;

	@IntegerFKIDColumn({ nullable: false })
	professor_id: number;

	@CodeColumn({ nullable: false })
	section_code: string;

	@JsonColumn({ nullable: true })
	schedule: any;

	@IntegerFKIDColumn({ nullable: false })
	section_modality_type_id: number;

	// %% RELATIONS

	@ManyToOne(() => StudyPlanCourseEntity)
	@JoinColumn({ name: 'study_plan_course_id', foreignKeyConstraintName: 'FK_course_sections_study_plan_course_id' })
	study_plan_course: StudyPlanCourseEntity;

	@ManyToOne(() => CampusEntity)
	@JoinColumn({ name: 'campus_id', foreignKeyConstraintName: 'FK_course_sections_campus_id' })
	campus: CampusEntity;

	@ManyToOne(() => ProfessorEntity)
	@JoinColumn({ name: 'professor_id', foreignKeyConstraintName: 'FK_course_sections_professor_id' })
	professor: ProfessorEntity;

	@ManyToOne(() => TypeEntity)
	@JoinColumn({ name: 'section_modality_type_id', foreignKeyConstraintName: 'FK_course_sections_section_modality_type_id' })
	section_modality_type: TypeEntity;
}
