import { Entity, Index, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from 'src/commons/base.entity';
import {
	IntegerFKIDColumn,
	IntegerColumn,
	BooleanColumn,
	JsonColumn,
} from 'src/commons/configs/db.configs';
import type { I18nText } from 'src/shared/types/i18n';
import { AcademicPeriodEntity } from 'src/modules/academic/academic-periods/model/academic-periods.entity';
import { CampusEntity } from 'src/modules/organization/campuses/model/campuses.entity';
import { CourseEntity } from 'src/modules/academic/courses/model/courses.entity';
import { InstrumentEntity } from 'src/modules/evidence/instruments/model/instruments.entity';
import { StaffEntity } from 'src/modules/organization/staff/model/staff.entity';
import { TypeEntity } from 'src/modules/core/types/model/types.entity';

@Entity({ name: 'findings', schema: 'improvement' })
@Index('IDX_findings_course_period', ['course_id', 'academic_period_id'])
export class FindingEntity extends BaseEntity {
	// %% ATTRIBUTES

	@IntegerFKIDColumn({ nullable: false })
	criticality_type_id: number;

	@IntegerFKIDColumn({ nullable: false })
	instrument_id: number;

	@IntegerFKIDColumn({ nullable: true })
	staff_id: number;

	@IntegerColumn({ nullable: false })
	correlative: number;

	@JsonColumn({ nullable: true })
	description: I18nText;

	@IntegerFKIDColumn({ nullable: false })
	course_id: number;

	@IntegerFKIDColumn({ nullable: false })
	academic_period_id: number;

	@IntegerFKIDColumn({ nullable: true })
	campus_id: number;

	@BooleanColumn({ nullable: false, default: true })
	is_automatic: boolean;

	// %% RELATIONS

	@ManyToOne(() => TypeEntity)
	@JoinColumn({ name: 'criticality_type_id', foreignKeyConstraintName: 'FK_findings_criticality_type_id' })
	criticality_type: TypeEntity;

	@ManyToOne(() => InstrumentEntity)
	@JoinColumn({ name: 'instrument_id', foreignKeyConstraintName: 'FK_findings_instrument_id' })
	instrument: InstrumentEntity;

	@ManyToOne(() => StaffEntity)
	@JoinColumn({ name: 'staff_id', foreignKeyConstraintName: 'FK_findings_staff_id' })
	staff: StaffEntity;

	@ManyToOne(() => CourseEntity)
	@JoinColumn({ name: 'course_id', foreignKeyConstraintName: 'FK_findings_course_id' })
	course: CourseEntity;

	@ManyToOne(() => AcademicPeriodEntity)
	@JoinColumn({ name: 'academic_period_id', foreignKeyConstraintName: 'FK_findings_academic_period_id' })
	academic_period: AcademicPeriodEntity;

	@ManyToOne(() => CampusEntity)
	@JoinColumn({ name: 'campus_id', foreignKeyConstraintName: 'FK_findings_campus_id' })
	campus: CampusEntity;
}
