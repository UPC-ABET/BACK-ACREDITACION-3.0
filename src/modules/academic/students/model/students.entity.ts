import { Entity, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from 'src/commons/base.entity';
import { IntegerFKIDColumn, IntegerColumn } from 'src/commons/configs/db.configs';
import { ProgramEntity } from 'src/modules/academic/programs/model/programs.entity';
import { UserEntity } from 'src/modules/organization/users/model/users.entity';

@Entity({ name: 'students', schema: 'academic' })
export class StudentEntity extends BaseEntity {
	// %% ATRIBUTOS

	@IntegerFKIDColumn({ nullable: false })
	user_id: number;

	@IntegerFKIDColumn({ nullable: false })
	program_id: number;

	@IntegerColumn({ nullable: false })
	graduation_modality_type_id: number;

	// %% RELACIONES

	@ManyToOne(() => UserEntity)
	@JoinColumn({ name: 'user_id' })
	user: UserEntity;

	@ManyToOne(() => ProgramEntity)
	@JoinColumn({ name: 'program_id' })
	program: ProgramEntity;
}
