import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Unique } from 'typeorm';
import { PlannerScrapeRunEntity } from './planner-scrape-run.entity';

// Phase 3: one row per student grade for an evaluation component (u-planner ComponentId x
// StudentCode), exploded from the grades listing. Payload = verbatim grade object.
@Entity({ name: 'raw_planner_nota' })
@Unique('UQ_raw_planner_nota_run_id_component_id_student_code', [
	'runId',
	'componentId',
	'studentCode',
])
export class RawPlannerNotaEntity {
	@PrimaryGeneratedColumn({ type: 'bigint', primaryKeyConstraintName: 'PK_raw_planner_nota' })
	id: string;

	@Column({ type: 'uuid' })
	runId: string;

	@ManyToOne(() => PlannerScrapeRunEntity, { onDelete: 'CASCADE' })
	@JoinColumn({ name: 'run_id', foreignKeyConstraintName: 'FK_raw_planner_nota_run_id' })
	run: PlannerScrapeRunEntity;

	@Column({ type: 'text', nullable: true })
	sectionId: string | null;

	@Column({ type: 'text', nullable: true })
	componentId: string | null;

	@Column({ type: 'text', nullable: true })
	studentCode: string | null;

	@Column({ type: 'jsonb' })
	payload: any;

	@Column({ type: 'char', length: 64 })
	payloadHash: string;

	@Column({ type: 'timestamptz', default: () => 'now()' })
	scrapedAt: Date;
}
