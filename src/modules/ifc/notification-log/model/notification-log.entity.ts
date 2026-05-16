import { Entity, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from 'src/commons/base.entity';
import { IntegerFKIDColumn, DateColumn } from 'src/commons/configs/db.configs';
import { AcademicPeriodEntity } from 'src/modules/academic/academic-periods/model/academic-periods.entity';
import { CourseEntity } from 'src/modules/academic/courses/model/courses.entity';
import { StaffEntity } from 'src/modules/organization/staff/model/staff.entity';
import { UserEntity } from 'src/modules/organization/users/model/users.entity';

@Entity({ name: 'notification_log', schema: 'ifc' })
export class NotificationLogEntity extends BaseEntity {
	// %% ATRIBUTOS

	@IntegerFKIDColumn({ nullable: false })
	course_id: number;

	@IntegerFKIDColumn({ nullable: false })
	academic_period_id: number;

	@IntegerFKIDColumn({ nullable: false })
	notified_staff_id: number;

	@IntegerFKIDColumn({ nullable: false })
	notifier_staff_id: number;

	@IntegerFKIDColumn({ nullable: false })
	user_id: number;

	@DateColumn({ nullable: false })
	sent_at: Date;

	// %% RELACIONES

	@ManyToOne(() => CourseEntity)
	@JoinColumn({ name: 'course_id' })
	course: CourseEntity;

	@ManyToOne(() => AcademicPeriodEntity)
	@JoinColumn({ name: 'academic_period_id' })
	academic_period: AcademicPeriodEntity;

	@ManyToOne(() => StaffEntity)
	@JoinColumn({ name: 'notified_staff_id' })
	notified_staff: StaffEntity;

	@ManyToOne(() => StaffEntity)
	@JoinColumn({ name: 'notifier_staff_id' })
	notifier_staff: StaffEntity;

	@ManyToOne(() => UserEntity)
	@JoinColumn({ name: 'user_id' })
	user: UserEntity;
}
