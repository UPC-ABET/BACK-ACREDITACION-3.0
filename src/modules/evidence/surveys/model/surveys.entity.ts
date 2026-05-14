import { Entity, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from 'src/commons/base.entity';
import { TextMediumColumn, IntegerFKIDColumn, IntegerColumn } from 'src/commons/configs/db.configs';
import { AcademicPeriodEntity } from 'src/modules/academic/academic-periods/model/academic-periods.entity';
import { CampusEntity } from 'src/modules/organization/campuses/model/campuses.entity';
import { CourseSectionEntity } from 'src/modules/academic/course-sections/model/course-sections.entity';
import { ProgramEntity } from 'src/modules/academic/programs/model/programs.entity';
import { StudentEntity } from 'src/modules/academic/students/model/students.entity';

@Entity({ name: 'surveys', schema: 'evidence' })
export class SurveyEntity extends BaseEntity {
	// %% ATRIBUTOS

	@IntegerColumn({ nullable: false })
	survey_type_id: number;

	@IntegerColumn({ nullable: false })
	survey_status_type_id: number;

	@IntegerFKIDColumn({ nullable: false })
	student_id: number;

	@IntegerFKIDColumn({ nullable: false })
	academic_period_id: number;

	@IntegerFKIDColumn({ nullable: false })
	campus_id: number;

	@IntegerFKIDColumn({ nullable: false })
	program_id: number;

	@TextMediumColumn({ nullable: true })
	information: string;

	@IntegerColumn({ nullable: true })
	survey_number: number;

	@IntegerFKIDColumn({ nullable: false })
	course_section_id: number;

	// %% RELACIONES

	@ManyToOne(() => StudentEntity)
	@JoinColumn({ name: 'student_id' })
	student: StudentEntity;

	@ManyToOne(() => AcademicPeriodEntity)
	@JoinColumn({ name: 'academic_period_id' })
	academic_period: AcademicPeriodEntity;

	@ManyToOne(() => CampusEntity)
	@JoinColumn({ name: 'campus_id' })
	campus: CampusEntity;

	@ManyToOne(() => ProgramEntity)
	@JoinColumn({ name: 'program_id' })
	program: ProgramEntity;

	@ManyToOne(() => CourseSectionEntity)
	@JoinColumn({ name: 'course_section_id' })
	course_section: CourseSectionEntity;
}
