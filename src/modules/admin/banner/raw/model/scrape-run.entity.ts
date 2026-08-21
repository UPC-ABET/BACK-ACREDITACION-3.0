import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

export type ScrapeRunStatus = 'running' | 'completed' | 'partial' | 'failed' | 'expired';
export type ScraperPhase = 'schedule' | 'enrollment' | 'studentsAndGrades';

@Entity({ name: 'scrape_run' })
export class ScrapeRunEntity {
	@PrimaryGeneratedColumn('uuid', { primaryKeyConstraintName: 'PK_scrape_run' })
	id: string;

	@Column({ type: 'text' })
	level: string;

	@Column({ type: 'text' })
	period: string;

	@Column({ type: 'text', array: true })
	departments: string[];

	@Column({ type: 'text' })
	status: ScrapeRunStatus;

	@Column({ type: 'text', nullable: true })
	phase: ScraperPhase | null;

	@Column({ type: 'timestamptz', default: () => 'now()' })
	startedAt: Date;

	@Column({ type: 'timestamptz', nullable: true })
	finishedAt: Date | null;

	@Column({ type: 'jsonb', nullable: true })
	stats: any;

	@Column({ type: 'text', nullable: true })
	triggeredBy: string | null;
}
