import { Entity, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from 'src/commons/base.entity';
import { CodeColumn, IntegerFKIDColumn, IntegerColumn, JsonColumn } from 'src/commons/configs/db.configs';
import { CampusEntity } from 'src/modules/organization/campuses/model/campuses.entity';
import { ProfessorEntity } from 'src/modules/academic/professors/model/professors.entity';
import { StudyPlanCourseEntity } from 'src/modules/academic/study-plan-courses/model/study-plan-courses.entity';

@Entity({ name: 'course_sections', schema: 'academic' })
export class CourseSectionEntity extends BaseEntity {
	// %% ATRIBUTOS

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

	@IntegerColumn({ nullable: false })
	section_modality_type_id: number;

	// %% RELACIONES

	@ManyToOne(() => StudyPlanCourseEntity)
	@JoinColumn({ name: 'study_plan_course_id' })
	study_plan_course: StudyPlanCourseEntity;

	@ManyToOne(() => CampusEntity)
	@JoinColumn({ name: 'campus_id' })
	campus: CampusEntity;

	@ManyToOne(() => ProfessorEntity)
	@JoinColumn({ name: 'professor_id' })
	professor: ProfessorEntity;
}
