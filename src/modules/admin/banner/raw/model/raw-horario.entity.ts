import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Unique } from 'typeorm';
import { ScrapeRunEntity } from './scrape-run.entity';

@Entity({ name: 'raw_horario' })
@Unique('UQ_raw_horario_run_id_department_nrc', ['runId', 'department', 'nrc'])
export class RawHorarioEntity {
	@PrimaryGeneratedColumn({ type: 'bigint', primaryKeyConstraintName: 'PK_raw_horario' })
	id: string;

	@Column({ type: 'uuid' })
	runId: string;

	@ManyToOne(() => ScrapeRunEntity, { onDelete: 'CASCADE' })
	@JoinColumn({ name: 'run_id', foreignKeyConstraintName: 'FK_raw_horario_run_id' })
	run: ScrapeRunEntity;

	@Column({ type: 'text' })
	level: string;

	@Column({ type: 'text' })
	period: string;

	@Column({ type: 'text' })
	department: string;

	@Column({ type: 'text', nullable: true })
	nrc: string | null;

	@Column({ type: 'jsonb' })
	payload: any;

	@Column({ type: 'char', length: 64 })
	payloadHash: string;

	@Column({ type: 'timestamptz', default: () => 'now()' })
	scrapedAt: Date;
}
