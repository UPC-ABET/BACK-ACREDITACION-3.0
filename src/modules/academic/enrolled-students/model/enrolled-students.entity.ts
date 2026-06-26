import { Entity, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from 'src/commons/base.entity';
import { IntegerFKIDColumn } from 'src/commons/configs/db.configs';
import { CampusEntity } from 'src/modules/organization/campuses/model/campuses.entity';
import { StudentEntity } from 'src/modules/academic/students/model/students.entity';
import { StudyPlanAcademicPeriodEntity } from 'src/modules/academic/study-plan-academic-periods/model/study-plan-academic-periods.entity';
import { TypeEntity } from 'src/modules/core/types/model/types.entity';

@Entity({ name: 'enrolled_students', schema: 'academic' })
export class EnrolledStudentEntity extends BaseEntity {
	// %% ATTRIBUTES

	@IntegerFKIDColumn({ nullable: false })
	studentId: number;

	@IntegerFKIDColumn({ nullable: false })
	studyPlanAcademicPeriodId: number;

	@IntegerFKIDColumn({ nullable: false })
	campusId: number;

	@IntegerFKIDColumn({ nullable: false })
	enrollementModalityTypeId: number;

	@IntegerFKIDColumn({ nullable: true })
	uploadLogId: number;

	// %% RELATIONS

	@ManyToOne(() => StudentEntity)
	@JoinColumn({ name: 'student_id', foreignKeyConstraintName: 'FK_enrolled_students_student_id' })
	student: StudentEntity;

	@ManyToOne(() => StudyPlanAcademicPeriodEntity)
	@JoinColumn({
		name: 'study_plan_academic_period_id',
		foreignKeyConstraintName: 'FK_enrolled_students_study_plan_academic_period_id',
	})
	studyPlanAcademicPeriod: StudyPlanAcademicPeriodEntity;

	@ManyToOne(() => CampusEntity)
	@JoinColumn({ name: 'campus_id', foreignKeyConstraintName: 'FK_enrolled_students_campus_id' })
	campus: CampusEntity;

	@ManyToOne(() => TypeEntity)
	@JoinColumn({
		name: 'enrollement_modality_type_id',
		foreignKeyConstraintName: 'FK_enrolled_students_enrollement_modality_type_id',
	})
	enrollementModalityType: TypeEntity;
}
