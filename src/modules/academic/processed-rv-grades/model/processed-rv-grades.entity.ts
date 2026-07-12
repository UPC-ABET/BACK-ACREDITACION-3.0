import { Entity, ManyToOne, JoinColumn, Unique, Index } from 'typeorm';
import { BaseEntity } from 'src/commons/base.entity';
import {
	BooleanColumn,
	DecimalColumn,
	IntegerColumn,
	IntegerFKIDColumn,
	TextShortColumn,
} from 'src/commons/configs/db.configs';
import { StudentSectionEnrollmentEntity } from 'src/modules/academic/student-section-enrollments/model/student-section-enrollments.entity';
import { CourseSectionEntity } from 'src/modules/academic/course-sections/model/course-sections.entity';
import { AcademicPeriodEntity } from 'src/modules/academic/academic-periods/model/academic-periods.entity';
import { PerformanceLevelEntity } from 'src/modules/academic/performance-levels/model/performance-levels.entity';
import { OutcomeEntity } from 'src/modules/accreditation/outcomes/model/outcomes.entity';
import { ProgramCommissionEntity } from 'src/modules/accreditation/program-commissions/model/program-commissions.entity';
import { EvaluationEntity } from 'src/modules/evidence/evaluations/model/evaluations.entity';

/**
 * Report-ready RV grades: one row per (enrollment, outcome, evaluation), already scaled to the
 * 20-point scale and already classified against `academic.performance_levels`, so the semaphore
 * report is a plain filter instead of a re-derivation. The new-model equivalent of the legacy
 * `ReporteCursos.TablaReporteNotasVerificacion`.
 *
 * Rows come in two kinds, mirroring the legacy `EsCalificado` flag:
 * - `is_converted = false` -- the outcome was graded directly by a rubric.
 * - `is_converted = true`  -- the outcome belongs to a commission nobody grades against, and was
 *   derived from the source commission's grades through `accreditation.outcome_conversions`;
 *   `formula` and `source_program_commission_id` record how.
 *
 * `scaled_grade` is what the semaphore classifies, and it is clamped to the 20-point ceiling: a
 * conversion that averages outcomes cannot manufacture a grade above the scale's maximum.
 */
@Entity({ name: 'processed_rv_grades', schema: 'academic' })
@Unique('UQ_processed_rv_grades_enrollment_outcome_evaluation', [
	'studentSectionEnrollmentId',
	'outcomeId',
	'evaluationId',
])
@Index('IDX_processed_rv_grades_period_program_commission', [
	'academicPeriodId',
	'programCommissionId',
])
@Index('IDX_processed_rv_grades_course_section_id', ['courseSectionId'])
@Index('IDX_processed_rv_grades_evaluation_id', ['evaluationId'])
export class ProcessedRvGradeEntity extends BaseEntity {
	// %% ATTRIBUTES

	@IntegerFKIDColumn({ nullable: false })
	studentSectionEnrollmentId: number;

	@IntegerFKIDColumn({ nullable: false })
	outcomeId: number;

	@IntegerFKIDColumn({ nullable: false })
	evaluationId: number;

	@IntegerFKIDColumn({ nullable: false })
	programCommissionId: number;

	@IntegerFKIDColumn({ nullable: false })
	academicPeriodId: number;

	@IntegerFKIDColumn({ nullable: false })
	courseSectionId: number;

	@DecimalColumn({ nullable: false })
	grade: number;

	@DecimalColumn({ nullable: false })
	scaledGrade: number;

	@DecimalColumn({ nullable: true })
	maxOutcome: number | null;

	@IntegerFKIDColumn({ nullable: true })
	performanceLevelId: number | null;

	@IntegerColumn({ nullable: true })
	levelRank: number | null;

	@BooleanColumn({ nullable: false, withDefault: true, default: false })
	isConverted: boolean;

	@IntegerFKIDColumn({ nullable: true })
	sourceProgramCommissionId: number | null;

	@TextShortColumn({ nullable: true })
	formula: string | null;

	@IntegerFKIDColumn({ nullable: true })
	uploadLogId: number | null;

	// %% RELATIONS

	@ManyToOne(() => StudentSectionEnrollmentEntity)
	@JoinColumn({
		name: 'student_section_enrollment_id',
		foreignKeyConstraintName: 'FK_processed_rv_grades_student_section_enrollment_id',
	})
	studentSectionEnrollment: StudentSectionEnrollmentEntity;

	@ManyToOne(() => OutcomeEntity)
	@JoinColumn({
		name: 'outcome_id',
		foreignKeyConstraintName: 'FK_processed_rv_grades_outcome_id',
	})
	outcome: OutcomeEntity;

	@ManyToOne(() => EvaluationEntity)
	@JoinColumn({
		name: 'evaluation_id',
		foreignKeyConstraintName: 'FK_processed_rv_grades_evaluation_id',
	})
	evaluation: EvaluationEntity;

	@ManyToOne(() => ProgramCommissionEntity)
	@JoinColumn({
		name: 'program_commission_id',
		foreignKeyConstraintName: 'FK_processed_rv_grades_program_commission_id',
	})
	programCommission: ProgramCommissionEntity;

	@ManyToOne(() => ProgramCommissionEntity)
	@JoinColumn({
		name: 'source_program_commission_id',
		foreignKeyConstraintName: 'FK_processed_rv_grades_source_program_commission_id',
	})
	sourceProgramCommission: ProgramCommissionEntity;

	@ManyToOne(() => AcademicPeriodEntity)
	@JoinColumn({
		name: 'academic_period_id',
		foreignKeyConstraintName: 'FK_processed_rv_grades_academic_period_id',
	})
	academicPeriod: AcademicPeriodEntity;

	@ManyToOne(() => CourseSectionEntity)
	@JoinColumn({
		name: 'course_section_id',
		foreignKeyConstraintName: 'FK_processed_rv_grades_course_section_id',
	})
	courseSection: CourseSectionEntity;

	@ManyToOne(() => PerformanceLevelEntity)
	@JoinColumn({
		name: 'performance_level_id',
		foreignKeyConstraintName: 'FK_processed_rv_grades_performance_level_id',
	})
	performanceLevel: PerformanceLevelEntity;
}
