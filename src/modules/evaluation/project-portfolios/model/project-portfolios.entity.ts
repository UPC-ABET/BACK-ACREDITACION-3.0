import { Entity, Column } from 'typeorm';
import { BaseEntity } from 'src/commons/base.entity';
import { CodeColumn, NameColumn, TextMediumColumn, TextLargeColumn, IntegerFKIDColumn, IntegerColumn, BooleanColumn } from 'src/commons/configs/db.configs';

/**
 * Estados que maneja el sistema antiguo (ProjectPortfolioStatus.cs).
 * Se mantiene como string para máxima compatibilidad si la BD usa varchar.
 */
export enum ProjectPortfolioStatus {
	APPROVED = 'APPROVED',
	DISAPPROVED = 'DISAPPROVED',
	PENDING = 'PENDING',
	REVIEWED = 'REVIEWED',
	PRE_APPROVED = 'PRE_APPROVED',
}

/**
 * Entidad ProjectPortfolio.
 *
 * TODO BD: La tabla `evaluation.project_portfolios` NO existe en la migración inicial
 * (`1778723980112-initial-migration.ts`). Antes de usar este módulo en producción
 * se debe crear la tabla mediante una nueva migración respetando los nombres de
 * columnas declarados aquí o, alternativamente, ajustar los nombres en esta entidad
 * para reflejar el schema real ya existente.
 *
 * Mapeo basado en `ABET.Domain.Entities.ProjectPortfolio` (C#) usando snake_case
 * compatible con el resto de las entidades del proyecto NestJS.
 */
@Entity({ name: 'project_portfolios', schema: 'evaluation' })
export class ProjectPortfolioEntity extends BaseEntity {
	// %% ATRIBUTOS BÁSICOS

	@CodeColumn({ nullable: false, unique: true })
	code: string;

	@NameColumn({ nullable: false })
	name: string;

	@TextMediumColumn({ nullable: true })
	description: string;

	@TextLargeColumn({ nullable: true })
	problem_solved: string;

	@TextLargeColumn({ nullable: true })
	goal: string;

	@BooleanColumn({ nullable: false, withDefault: true, default: false })
	is_from_upc: boolean;

	@Column({ type: 'varchar', length: 50, nullable: false, default: ProjectPortfolioStatus.PENDING })
	status: string;

	// %% FK / RELACIONES (almacenadas como columnas FK numéricas)

	@IntegerFKIDColumn({ nullable: false })
	academic_period_id: number;

	@IntegerFKIDColumn({ nullable: false })
	modality_id: number;

	@IntegerFKIDColumn({ nullable: true })
	company_id: number;

	@Column({ type: 'varchar', length: 50, nullable: true })
	company_code: string;

	@IntegerFKIDColumn({ nullable: false })
	career_id: number;

	@IntegerFKIDColumn({ nullable: true })
	course_id: number;

	@IntegerFKIDColumn({ nullable: true })
	research_line_id: number;

	@IntegerFKIDColumn({ nullable: true })
	student_one_id: number;

	@IntegerFKIDColumn({ nullable: true })
	student_two_id: number;

	@IntegerFKIDColumn({ nullable: true })
	coauthor_id: number;

	@IntegerFKIDColumn({ nullable: true })
	consultant_id: number;

	@IntegerFKIDColumn({ nullable: true })
	active_enrollment_student_one_id: number;

	@IntegerFKIDColumn({ nullable: true })
	active_enrollment_student_two_id: number;
}
