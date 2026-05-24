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
	student_id: number;

	@IntegerFKIDColumn({ nullable: false })
	study_plan_academic_period: number;

	@IntegerFKIDColumn({ nullable: false })
	campus_id: number;

	@IntegerFKIDColumn({ nullable: false })
	enrollement_modality_type_id: number;

	// %% RELATIONS

	@ManyToOne(() => StudentEntity)
	@JoinColumn({ name: 'student_id' })
	student: StudentEntity;

	@ManyToOne(() => CampusEntity)
	@JoinColumn({ name: 'campus_id' })
	campus: CampusEntity;

	@ManyToOne(() => TypeEntity)
	@JoinColumn({ name: 'enrollement_modality_type_id' })
	enrollement_modality_type: TypeEntity;
}
