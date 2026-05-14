import { Entity, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from 'src/commons/base.entity';
import { TextMediumColumn, IntegerFKIDColumn, IntegerColumn, BooleanColumn } from 'src/commons/configs/db.configs';
import { CampusEntity } from 'src/modules/organization/campuses/model/campuses.entity';
import { InstrumentEntity } from 'src/modules/evidence/instruments/model/instruments.entity';
import { StaffEntity } from 'src/modules/organization/staff/model/staff.entity';
import { StudyPlanCourseEntity } from 'src/modules/academic/study-plan-courses/model/study-plan-courses.entity';

@Entity({ name: 'findings', schema: 'improvement' })
export class FindingEntity extends BaseEntity {
	// %% ATRIBUTOS

	@IntegerColumn({ nullable: false })
	criticality_type_id: number;

	@IntegerFKIDColumn({ nullable: false })
	instrument_id: number;

	@IntegerFKIDColumn({ nullable: true })
	staff_id: number;

	@IntegerColumn({ nullable: false })
	correlative: number;

	@TextMediumColumn({ nullable: true })
	description: string;

	@IntegerFKIDColumn({ nullable: false })
	study_plan_course_id: number;

	@IntegerFKIDColumn({ nullable: false })
	campus_id: number;

	@BooleanColumn({ nullable: false, default: true })
	is_automatic: boolean;

	@IntegerColumn({ nullable: false })
	finding_status_type_id: number;

	// %% RELACIONES

	@ManyToOne(() => InstrumentEntity)
	@JoinColumn({ name: 'instrument_id' })
	instrument: InstrumentEntity;

	@ManyToOne(() => StaffEntity)
	@JoinColumn({ name: 'staff_id' })
	staff: StaffEntity;

	@ManyToOne(() => StudyPlanCourseEntity)
	@JoinColumn({ name: 'study_plan_course_id' })
	study_plan_course: StudyPlanCourseEntity;

	@ManyToOne(() => CampusEntity)
	@JoinColumn({ name: 'campus_id' })
	campus: CampusEntity;
}
