import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Unique } from 'typeorm';
import { ScrapeRunEntity } from './scrape-run.entity';

@Entity({ name: 'raw_alumno' })
@Unique('UQ_raw_alumno_run_id_codigo_alumno', ['runId', 'codigoAlumno'])
export class RawAlumnoEntity {
	@PrimaryGeneratedColumn({ type: 'bigint', primaryKeyConstraintName: 'PK_raw_alumno' })
	id: string;

	@Column({ type: 'uuid' })
	runId: string;

	@ManyToOne(() => ScrapeRunEntity, { onDelete: 'CASCADE' })
	@JoinColumn({ name: 'run_id', foreignKeyConstraintName: 'FK_raw_alumno_run_id' })
	run: ScrapeRunEntity;

	@Column({ type: 'text' })
	nivel: string;

	@Column({ type: 'text' })
	codigoAlumno: string;

	@Column({ type: 'jsonb' })
	payload: any;

	@Column({ type: 'char', length: 64 })
	payloadHash: string;

	@Column({ type: 'timestamptz', default: () => 'now()' })
	scrapedAt: Date;
}
