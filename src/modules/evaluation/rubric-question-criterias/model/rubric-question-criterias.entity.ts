import { Entity } from 'typeorm';
import { BaseEntity } from 'src/commons/base.entity';
import { TextLargeColumn, IntegerColumn, DecimalColumn } from 'src/commons/configs/db.configs';

@Entity({ name: 'rubric_question_criterias', schema: 'evaluation' })
export class RubricQuestionCriteriaEntity extends BaseEntity {
	// %% ATRIBUTOS

	@IntegerColumn({ nullable: false })
	rubric_question_id: number;

	@IntegerColumn({ nullable: false })
	rubric_scale_id: number;

	@TextLargeColumn({ nullable: false })
	criteria: string;

	@DecimalColumn({ nullable: false })
	min_value: number;

	@DecimalColumn({ nullable: false })
	max_value: number;

	// %% RELACIONES
}
