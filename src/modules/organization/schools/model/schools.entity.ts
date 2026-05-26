import { Entity, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from 'src/commons/base.entity';
import { CodeColumn, IntegerFKIDColumn, JsonColumn } from 'src/commons/configs/db.configs';
import type { I18nText } from 'src/shared/types/i18n';
import { FacultyEntity } from 'src/modules/organization/faculties/model/faculties.entity';

@Entity({ name: 'schools', schema: 'organization' })
export class SchoolEntity extends BaseEntity {
	// %% ATTRIBUTES

	@IntegerFKIDColumn({ nullable: false })
	faculty_id: number;

	@CodeColumn({ nullable: false })
	code: string;

	@JsonColumn({ nullable: false })
	name: I18nText;

	// %% RELATIONS

	@ManyToOne(() => FacultyEntity)
	@JoinColumn({ name: 'faculty_id', foreignKeyConstraintName: 'FK_schools_faculty_id' })
	faculty: FacultyEntity;
}
