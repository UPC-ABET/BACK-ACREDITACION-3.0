import { Entity, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from 'src/commons/base.entity';
import {
	IntegerFKIDColumn,
	IntegerColumn,
	TextMediumColumn,
	DateColumn,
} from 'src/commons/configs/db.configs';
import { UserEntity } from 'src/modules/organization/users/model/users.entity';
import { AcademicPeriodEntity } from 'src/modules/academic/academic-periods/model/academic-periods.entity';
import { TypeEntity } from 'src/modules/core/types/model/types.entity';

@Entity({ name: 'upload_logs', schema: 'audit' })
export class UploadLogEntity extends BaseEntity {
	@IntegerFKIDColumn({ nullable: false })
	userId: number;

	@IntegerFKIDColumn({ nullable: true })
	academicPeriodId: number;

	@IntegerFKIDColumn({ nullable: false })
	uploadTypeId: number;

	@IntegerFKIDColumn({ nullable: false })
	statusTypeId: number;

	@TextMediumColumn({ nullable: true })
	sourceFile: string;

	@IntegerColumn({ nullable: true })
	totalRows: number;

	@IntegerColumn({ nullable: true })
	loadedRows: number;

	@IntegerColumn({ nullable: true })
	errorRows: number;

	@DateColumn({ nullable: true, withDefault: false })
	rollbackAt: Date;

	@ManyToOne(() => UserEntity)
	@JoinColumn({ name: 'user_id' })
	user: UserEntity;

	@ManyToOne(() => AcademicPeriodEntity)
	@JoinColumn({ name: 'academic_period_id' })
	academicPeriod: AcademicPeriodEntity;

	@ManyToOne(() => TypeEntity)
	@JoinColumn({ name: 'upload_type_id' })
	uploadType: TypeEntity;

	@ManyToOne(() => TypeEntity)
	@JoinColumn({ name: 'status_type_id' })
	statusType: TypeEntity;
}
