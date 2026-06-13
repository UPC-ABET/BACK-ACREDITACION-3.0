import { Entity, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { BaseEntity } from 'src/commons/base.entity';
import {
	BooleanColumn,
	CodeColumn,
	IntegerColumn,
	IntegerFKIDColumn,
	NameColumn,
	TextLargeColumn,
} from 'src/commons/configs/db.configs';
import { AcademicPeriodEntity } from 'src/modules/academic/academic-periods/model/academic-periods.entity';
import { CourseSectionEntity } from 'src/modules/academic/course-sections/model/course-sections.entity';
import { ProfessorEntity } from 'src/modules/academic/professors/model/professors.entity';
import { ProgramEntity } from 'src/modules/academic/programs/model/programs.entity';
import { StudentEntity } from 'src/modules/academic/students/model/students.entity';
import { StudentSectionEnrollmentEntity } from 'src/modules/academic/student-section-enrollments/model/student-section-enrollments.entity';
import { TypeEntity } from 'src/modules/core/types/model/types.entity';
import { PortfolioStatus } from '../enums/portfolio-status.enum';
import { PortfolioCompanyEntity } from './portfolio-company.entity';
import { PortfolioResearchLineEntity } from './portfolio-research-line.entity';
import { PortfolioProjectApplicationEntity } from './portfolio-project-application.entity';

@Entity({ name: 'projects', schema: 'portfolio' })
export class PortfolioProjectEntity extends BaseEntity {
	// %% ATTRIBUTES

	@CodeColumn({ nullable: false, unique: true })
	code: string;

	@NameColumn({ nullable: false })
	name: string;

	@TextLargeColumn({ nullable: true })
	description?: string;

	@TextLargeColumn({ nullable: true })
	problemSolved?: string;

	@TextLargeColumn({ nullable: true })
	goal?: string;

	@BooleanColumn({ nullable: false, withDefault: true, default: false })
	isFromUPC: boolean;

	@IntegerColumn({ nullable: false, withDefault: true, default: PortfolioStatus.PENDING })
	status: PortfolioStatus;

	@IntegerFKIDColumn({ nullable: true })
	studentOneId?: number;

	@IntegerFKIDColumn({ nullable: true })
	studentTwoId?: number;

	@IntegerFKIDColumn({ nullable: false })
	academicPeriodId: number;

	@IntegerFKIDColumn({ nullable: false })
	modalityTypeId: number;

	@IntegerFKIDColumn({ nullable: false })
	companyId: number;

	@IntegerFKIDColumn({ nullable: true })
	courseSectionId?: number;

	@IntegerFKIDColumn({ nullable: true })
	researchLineId?: number;

	@IntegerFKIDColumn({ nullable: false })
	programId: number;

	@IntegerFKIDColumn({ nullable: true })
	coauthorProfessorId?: number;

	@IntegerFKIDColumn({ nullable: true })
	consultantProfessorId?: number;

	@IntegerFKIDColumn({ nullable: true })
	studentOneEnrollmentId?: number;

	@IntegerFKIDColumn({ nullable: true })
	studentTwoEnrollmentId?: number;

	// %% RELATIONS

	@ManyToOne(() => StudentEntity, { nullable: true })
	@JoinColumn({
		name: 'student_one_id',
		foreignKeyConstraintName: 'FK_portfolio_projects_student_one_id',
	})
	studentOne?: StudentEntity;

	@ManyToOne(() => StudentEntity, { nullable: true })
	@JoinColumn({
		name: 'student_two_id',
		foreignKeyConstraintName: 'FK_portfolio_projects_student_two_id',
	})
	studentTwo?: StudentEntity;

	@ManyToOne(() => AcademicPeriodEntity)
	@JoinColumn({
		name: 'academic_period_id',
		foreignKeyConstraintName: 'FK_portfolio_projects_academic_period_id',
	})
	academicPeriod: AcademicPeriodEntity;

	@ManyToOne(() => TypeEntity)
	@JoinColumn({
		name: 'modality_type_id',
		foreignKeyConstraintName: 'FK_portfolio_projects_modality_type_id',
	})
	modalityType: TypeEntity;

	@ManyToOne(() => PortfolioCompanyEntity)
	@JoinColumn({ name: 'company_id', foreignKeyConstraintName: 'FK_portfolio_projects_company_id' })
	company: PortfolioCompanyEntity;

	@ManyToOne(() => CourseSectionEntity, { nullable: true })
	@JoinColumn({
		name: 'course_section_id',
		foreignKeyConstraintName: 'FK_portfolio_projects_course_section_id',
	})
	courseSection?: CourseSectionEntity;

	@ManyToOne(() => PortfolioResearchLineEntity, { nullable: true })
	@JoinColumn({
		name: 'research_line_id',
		foreignKeyConstraintName: 'FK_portfolio_projects_research_line_id',
	})
	researchLine?: PortfolioResearchLineEntity;

	@ManyToOne(() => ProgramEntity)
	@JoinColumn({ name: 'program_id', foreignKeyConstraintName: 'FK_portfolio_projects_program_id' })
	program: ProgramEntity;

	@ManyToOne(() => ProfessorEntity, { nullable: true })
	@JoinColumn({
		name: 'coauthor_professor_id',
		foreignKeyConstraintName: 'FK_portfolio_projects_coauthor_professor_id',
	})
	coauthorProfessor?: ProfessorEntity;

	@ManyToOne(() => ProfessorEntity, { nullable: true })
	@JoinColumn({
		name: 'consultant_professor_id',
		foreignKeyConstraintName: 'FK_portfolio_projects_consultant_professor_id',
	})
	consultantProfessor?: ProfessorEntity;

	@ManyToOne(() => StudentSectionEnrollmentEntity, { nullable: true })
	@JoinColumn({
		name: 'student_one_enrollment_id',
		foreignKeyConstraintName: 'FK_portfolio_projects_student_one_enrollment_id',
	})
	studentOneEnrollment?: StudentSectionEnrollmentEntity;

	@ManyToOne(() => StudentSectionEnrollmentEntity, { nullable: true })
	@JoinColumn({
		name: 'student_two_enrollment_id',
		foreignKeyConstraintName: 'FK_portfolio_projects_student_two_enrollment_id',
	})
	studentTwoEnrollment?: StudentSectionEnrollmentEntity;

	@OneToMany(() => PortfolioProjectApplicationEntity, (app) => app.project)
	applications: PortfolioProjectApplicationEntity[];
}
