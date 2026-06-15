import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Unique } from 'typeorm';
import { ScrapeRunEntity } from './scrape-run.entity';

@Entity({ name: 'raw_matricula' })
@Unique('UQ_raw_matricula_run_id_nrc_codigo_alumno', ['runId', 'nrc', 'codigoAlumno'])
export class RawMatriculaEntity {
	@PrimaryGeneratedColumn({ type: 'bigint', primaryKeyConstraintName: 'PK_raw_matricula' })
	id: string;

	@Column({ type: 'uuid' })
	runId: string;

	@ManyToOne(() => ScrapeRunEntity, { onDelete: 'CASCADE' })
	@JoinColumn({ name: 'run_id', foreignKeyConstraintName: 'FK_raw_matricula_run_id' })
	run: ScrapeRunEntity;

	@Column({ type: 'text' })
	nivel: string;

	@Column({ type: 'text' })
	periodo: string;

	@Column({ type: 'text' })
	nrc: string;

	@Column({ type: 'text', nullable: true })
	codigoAlumno: string | null;

	@Column({ type: 'jsonb' })
	payload: any;

	@Column({ type: 'char', length: 64 })
	payloadHash: string;

	@Column({ type: 'timestamptz', default: () => 'now()' })
	scrapedAt: Date;
}
