import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { BaseRepository } from 'src/commons/base.repository';
import { ScoreEntity } from 'src/modules/survey/scores/model/scores.entity';

@Injectable()
export class PppScoreRepository extends BaseRepository<ScoreEntity> {
	constructor(
		@InjectRepository(ScoreEntity)
		repository: Repository<ScoreEntity>,
		dataSource: DataSource,
	) {
		super(repository, dataSource);
	}

	async findBySurveyId(surveyId: number): Promise<ScoreEntity[]> {
		return await this.repository.find({
			where: { surveyId: surveyId },
			relations: ['outcome'],
		});
	}

	async deleteBySurveyId(surveyId: number): Promise<void> {
		await this.repository.delete({ surveyId: surveyId });
	}

	async bulkCreate(
		scores: { surveyId: number; outcomeId: number; score: number; commentaries?: string }[],
	): Promise<ScoreEntity[]> {
		const entities = scores.map((s) => this.repository.create(s as any) as unknown as ScoreEntity);
		return await this.repository.save(entities);
	}
}
