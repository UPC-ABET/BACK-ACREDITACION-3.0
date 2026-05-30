import { Entity, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from 'src/commons/base.entity';
import { IntegerFKIDColumn } from 'src/commons/configs/db.configs';
import { CampusEntity } from 'src/modules/organization/campuses/model/campuses.entity';
import { StudentEntity } from 'src/modules/academic/students/model/students.entity';
import { TypeEntity } from 'src/modules/core/types/model/types.entity';

@Entity({ name: 'enrolled_students', schema: 'academic' })
export class EnrolledStudentEntity extends BaseEntity {
	// %% ATTRIBUTES

	@IntegerFKIDColumn({ nullable: false })
	studentId: number;

	@IntegerFKIDColumn({ nullable: false })
	studyPlanAcademicPeriod: number;

	@IntegerFKIDColumn({ nullable: false })
	campusId: number;

	@IntegerFKIDColumn({ nullable: false })
	enrollementModalityTypeId: number;

	// %% RELATIONS

	@ManyToOne(() => StudentEntity)
	@JoinColumn({ name: 'student_id', foreignKeyConstraintName: 'FK_enrolled_students_student_id' })
	student: StudentEntity;

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
