import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Unique } from 'typeorm';
import { PlannerScrapeRunEntity } from './planner-scrape-run.entity';

// Phase 1: one row per Planner section (u-planner SectionId). Payload = verbatim section
// object (SectionName/Course/Department/Teacher/...). Keys preserved as Planner returns them.
@Entity({ name: 'raw_planner_seccion' })
@Unique('UQ_raw_planner_seccion_run_id_section_id', ['runId', 'sectionId'])
export class RawPlannerSeccionEntity {
	@PrimaryGeneratedColumn({ type: 'bigint', primaryKeyConstraintName: 'PK_raw_planner_seccion' })
	id: string;

	@Column({ type: 'uuid' })
	runId: string;

	@ManyToOne(() => PlannerScrapeRunEntity, { onDelete: 'CASCADE' })
	@JoinColumn({ name: 'run_id', foreignKeyConstraintName: 'FK_raw_planner_seccion_run_id' })
	run: PlannerScrapeRunEntity;

	@Column({ type: 'text' })
	periodo: string;

	@Column({ type: 'text', nullable: true })
	sectionId: string | null;

	@Column({ type: 'jsonb' })
	payload: any;

	@Column({ type: 'char', length: 64 })
	payloadHash: string;

	@Column({ type: 'timestamptz', default: () => 'now()' })
	scrapedAt: Date;
}
