import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { BaseRepository } from 'src/commons/base.repository';
import { ScoreEntity } from 'src/modules/survey/scores/model/scores.entity';
import type { I18nText } from 'src/shared/types/i18n';

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
		scores: {
			surveyId: number;
			outcomeId: number;
			score: number;
			commentaries?: I18nText | null;
		}[],
		manager?: EntityManager,
	): Promise<ScoreEntity[]> {
		const repository = manager ? manager.getRepository(ScoreEntity) : this.repository;
		const entities = scores.map((s) => repository.create(s as any) as unknown as ScoreEntity);
		return await repository.save(entities);
	}
}
