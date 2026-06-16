import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Unique } from 'typeorm';
import { PlannerScrapeRunEntity } from './planner-scrape-run.entity';

// Phase 2: one row per evaluation component of a section's evaluation structure (u-planner
// EvalComponentId). Payload = verbatim component object (Structure/Component/Formula/Weight/...).
@Entity({ name: 'raw_planner_evaluacion' })
@Unique('UQ_raw_planner_evaluacion_run_id_section_id_component', [
	'runId',
	'sectionId',
	'evalComponentId',
])
export class RawPlannerEvaluacionEntity {
	@PrimaryGeneratedColumn({ type: 'bigint', primaryKeyConstraintName: 'PK_raw_planner_evaluacion' })
	id: string;

	@Column({ type: 'uuid' })
	runId: string;

	@ManyToOne(() => PlannerScrapeRunEntity, { onDelete: 'CASCADE' })
	@JoinColumn({ name: 'run_id', foreignKeyConstraintName: 'FK_raw_planner_evaluacion_run_id' })
	run: PlannerScrapeRunEntity;

	@Column({ type: 'text', nullable: true })
	sectionId: string | null;

	@Column({ type: 'text', nullable: true })
	evalComponentId: string | null;

	@Column({ type: 'jsonb' })
	payload: any;

	@Column({ type: 'char', length: 64 })
	payloadHash: string;

	@Column({ type: 'timestamptz', default: () => 'now()' })
	scrapedAt: Date;
}
