import { Entity, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from 'src/commons/base.entity';
import { IntegerFKIDColumn, JsonColumn } from 'src/commons/configs/db.configs';
import type { I18nText } from 'src/shared/types/i18n';
import { AcademicPeriodEntity } from 'src/modules/academic/academic-periods/model/academic-periods.entity';
import { CourseEntity } from 'src/modules/academic/courses/model/courses.entity';

type IfcInformation = Record<string, { label: I18nText; value: I18nText; order: number }>;

@Entity({ name: 'ifcs', schema: 'evidence' })
export class IfcEntity extends BaseEntity {
	// %% ATTRIBUTES

	@IntegerFKIDColumn({ nullable: false })
	course_id: number;

	@IntegerFKIDColumn({ nullable: false })
	academic_period_id: number;

	@JsonColumn({ nullable: true })
	information: IfcInformation;

	// %% RELATIONS

	@ManyToOne(() => CourseEntity)
	@JoinColumn({ name: 'course_id', foreignKeyConstraintName: 'FK_ifcs_course_id' })
	course: CourseEntity;

	@ManyToOne(() => AcademicPeriodEntity)
	@JoinColumn({
		name: 'academic_period_id',
		foreignKeyConstraintName: 'FK_ifcs_academic_period_id',
	})
	academic_period: AcademicPeriodEntity;
}
