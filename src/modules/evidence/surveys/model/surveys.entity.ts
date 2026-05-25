import { Entity, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from 'src/commons/base.entity';
import { IntegerFKIDColumn, IntegerColumn, JsonColumn } from 'src/commons/configs/db.configs';
import type { I18nText } from 'src/shared/types/i18n';
import { AcademicPeriodEntity } from 'src/modules/academic/academic-periods/model/academic-periods.entity';
import { CampusEntity } from 'src/modules/organization/campuses/model/campuses.entity';
import { CourseSectionEntity } from 'src/modules/academic/course-sections/model/course-sections.entity';
import { ProgramEntity } from 'src/modules/academic/programs/model/programs.entity';
import { StudentEntity } from 'src/modules/academic/students/model/students.entity';
import { TypeEntity } from 'src/modules/core/types/model/types.entity';

@Entity({ name: 'surveys', schema: 'evidence' })
export class SurveyEntity extends BaseEntity {
	// %% ATTRIBUTES

	@IntegerFKIDColumn({ nullable: false })
	survey_type_id: number;

	@IntegerFKIDColumn({ nullable: false })
	survey_status_type_id: number;

	@IntegerFKIDColumn({ nullable: false })
	student_id: number;

	@IntegerFKIDColumn({ nullable: false })
	academic_period_id: number;

	@IntegerFKIDColumn({ nullable: false })
	campus_id: number;

	@IntegerFKIDColumn({ nullable: false })
	program_id: number;

	@JsonColumn({ nullable: true })
	information: I18nText;

	@IntegerColumn({ nullable: true })
	survey_number: number;

	@IntegerFKIDColumn({ nullable: false })
	course_section_id: number;

	// %% RELATIONS

	@ManyToOne(() => TypeEntity)
	@JoinColumn({ name: 'survey_type_id', foreignKeyConstraintName: 'FK_surveys_survey_type_id' })
	survey_type: TypeEntity;

	@ManyToOne(() => TypeEntity)
	@JoinColumn({ name: 'survey_status_type_id', foreignKeyConstraintName: 'FK_surveys_survey_status_type_id' })
	survey_status_type: TypeEntity;

	@ManyToOne(() => StudentEntity)
	@JoinColumn({ name: 'student_id', foreignKeyConstraintName: 'FK_surveys_student_id' })
	student: StudentEntity;

	@ManyToOne(() => AcademicPeriodEntity)
	@JoinColumn({ name: 'academic_period_id', foreignKeyConstraintName: 'FK_surveys_academic_period_id' })
	academic_period: AcademicPeriodEntity;

	@ManyToOne(() => CampusEntity)
	@JoinColumn({ name: 'campus_id', foreignKeyConstraintName: 'FK_surveys_campus_id' })
	campus: CampusEntity;

	@ManyToOne(() => ProgramEntity)
	@JoinColumn({ name: 'program_id', foreignKeyConstraintName: 'FK_surveys_program_id' })
	program: ProgramEntity;

	@ManyToOne(() => CourseSectionEntity)
	@JoinColumn({ name: 'course_section_id', foreignKeyConstraintName: 'FK_surveys_course_section_id' })
	course_section: CourseSectionEntity;
}
