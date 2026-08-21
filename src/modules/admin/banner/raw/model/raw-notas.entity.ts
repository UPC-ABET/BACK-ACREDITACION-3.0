import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Unique } from 'typeorm';
import { ScrapeRunEntity } from './scrape-run.entity';

@Entity({ name: 'raw_notas' })
@Unique('UQ_raw_notas_run_id_student_code_course_code', ['runId', 'studentCode', 'courseCode'])
export class RawNotasEntity {
	@PrimaryGeneratedColumn({ type: 'bigint', primaryKeyConstraintName: 'PK_raw_notas' })
	id: string;

	@Column({ type: 'uuid' })
	runId: string;

	@ManyToOne(() => ScrapeRunEntity, { onDelete: 'CASCADE' })
	@JoinColumn({ name: 'run_id', foreignKeyConstraintName: 'FK_raw_notas_run_id' })
	run: ScrapeRunEntity;

	@Column({ type: 'text' })
	level: string;

	@Column({ type: 'text' })
	period: string;

	@Column({ type: 'text' })
	studentCode: string;

	@Column({ type: 'text' })
	courseCode: string;

	@Column({ type: 'jsonb' })
	payload: any;

	@Column({ type: 'char', length: 64 })
	payloadHash: string;

	@Column({ type: 'timestamptz', default: () => 'now()' })
	scrapedAt: Date;
}
