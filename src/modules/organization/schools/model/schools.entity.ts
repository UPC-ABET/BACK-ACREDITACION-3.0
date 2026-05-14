import { Entity, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from 'src/commons/base.entity';
import { NameColumn, CodeColumn, IntegerFKIDColumn } from 'src/commons/configs/db.configs';
import { FacultyEntity } from 'src/modules/organization/faculties/model/faculties.entity';

@Entity({ name: 'schools', schema: 'organization' })
export class SchoolEntity extends BaseEntity {
	// %% ATRIBUTOS

	@IntegerFKIDColumn({ nullable: false })
	faculty_id: number;

	@CodeColumn({ nullable: false })
	code: string;

	@NameColumn({ nullable: false })
	name: string;

	// %% RELACIONES

	@ManyToOne(() => FacultyEntity)
	@JoinColumn({ name: 'faculty_id' })
	faculty: FacultyEntity;
}
