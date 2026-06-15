import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

export type ScrapeRunStatus = 'running' | 'completed' | 'partial' | 'failed' | 'expired';

@Entity({ name: 'scrape_run' })
export class ScrapeRunEntity {
	@PrimaryGeneratedColumn('uuid', { primaryKeyConstraintName: 'PK_scrape_run' })
	id: string;

	@Column({ type: 'text' })
	nivel: string;

	@Column({ type: 'text' })
	periodo: string;

	@Column({ type: 'text', array: true })
	departamentos: string[];

	@Column({ type: 'text' })
	status: ScrapeRunStatus;

	@Column({ type: 'timestamptz', default: () => 'now()' })
	startedAt: Date;

	@Column({ type: 'timestamptz', nullable: true })
	finishedAt: Date | null;

	@Column({ type: 'jsonb', nullable: true })
	stats: any;

	@Column({ type: 'text', nullable: true })
	triggeredBy: string | null;
}
