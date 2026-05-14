import { Entity, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from 'src/commons/base.entity';
import { IntegerFKIDColumn, IntegerColumn } from 'src/commons/configs/db.configs';
import { CampusEntity } from 'src/modules/organization/campuses/model/campuses.entity';
import { StudentEntity } from 'src/modules/academic/students/model/students.entity';

@Entity({ name: 'enrolled_students', schema: 'academic' })
export class EnrolledStudentEntity extends BaseEntity {
	// %% ATRIBUTOS

	@IntegerFKIDColumn({ nullable: false })
	student_id: number;

	@IntegerFKIDColumn({ nullable: false })
	study_plan_academic_period: number;

	@IntegerFKIDColumn({ nullable: false })
	campus_id: number;

	@IntegerColumn({ nullable: false })
	enrollement_modality_type_id: number;

	// %% RELACIONES

	@ManyToOne(() => StudentEntity)
	@JoinColumn({ name: 'student_id' })
	student: StudentEntity;

	@ManyToOne(() => CampusEntity)
	@JoinColumn({ name: 'campus_id' })
	campus: CampusEntity;
}
