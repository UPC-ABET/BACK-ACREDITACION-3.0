import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

export type PlannerScrapeRunStatus = 'running' | 'completed' | 'partial' | 'failed' | 'expired';
export type PlannerScraperPhase = 'sections' | 'evaluations' | 'grades';

// Planner analogue of ScrapeRunEntity. Planner runs scope by period (and optionally school);
// the per-phase counts (sections/evaluations/grades) live in `stats`.
@Entity({ name: 'planner_scrape_run' })
export class PlannerScrapeRunEntity {
	@PrimaryGeneratedColumn('uuid', { primaryKeyConstraintName: 'PK_planner_scrape_run' })
	id: string;

	@Column({ type: 'text' })
	period: string;

	@Column({ type: 'text', nullable: true })
	school: string | null;

	@Column({ type: 'text' })
	status: PlannerScrapeRunStatus;

	@Column({ type: 'text', nullable: true })
	phase: PlannerScraperPhase | null;

	@Column({ type: 'timestamptz', default: () => 'now()' })
	startedAt: Date;

	@Column({ type: 'timestamptz', nullable: true })
	finishedAt: Date | null;

	@Column({ type: 'jsonb', nullable: true })
	stats: any;

	@Column({ type: 'text', nullable: true })
	triggeredBy: string | null;
}
