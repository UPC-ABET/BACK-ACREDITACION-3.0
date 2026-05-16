import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { BaseRepostitory } from 'src/commons/base.repository';
import { ScoreEntity } from 'src/modules/survey/scores/model/scores.entity';

@Injectable()
export class PppScoreRepository extends BaseRepostitory {
	constructor(
		@InjectRepository(ScoreEntity)
		repository: Repository<ScoreEntity>,
		dataSource: DataSource,
	) {
		super(repository, dataSource);
	}

	async findBySurveyId(surveyId: number): Promise<ScoreEntity[]> {
		const { repository, queryRunner } = await this.getRepository();
		try {
			return await repository.find({
				where: { survey_id: surveyId },
				relations: ['outcome'],
			});
		} finally {
			await queryRunner.release();
		}
	}

	async deleteBySurveyId(surveyId: number): Promise<void> {
		const { repository, queryRunner } = await this.getRepository();
		try {
			await repository.delete({ survey_id: surveyId });
		} finally {
			await queryRunner.release();
		}
	}

	async bulkCreate(scores: { survey_id: number; outcome_id: number; score: number; commentaries?: string }[]): Promise<ScoreEntity[]> {
		const { repository, queryRunner } = await this.getRepository();
		try {
			const entities = scores.map((s) => repository.create(s));
			return await repository.save(entities);
		} finally {
			await queryRunner.release();
		}
	}
}
