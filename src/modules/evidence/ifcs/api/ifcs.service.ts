import { Inject, Injectable } from '@nestjs/common';
import { BaseService } from 'src/commons/base.service';
import { IfcRepository } from '../core/ifcs.repository';
import { IfcValidation } from '../core/ifcs.validation';

import { IfcStatusReportDto, ListIfcsDto, RejectIfcDto, UpdateIfcDto } from '../model/ifcs.dtos';
import { CreateIfcDto, IfcContentDto, IfcPrefillQueryDto } from '../model/ifcs-content.dtos';
import { EntityManager } from 'typeorm';
import { TYPE_CODES } from 'src/modules/core/types/constants/type-codes';
import {
	NotificationDispatcherService,
	DispatchResult,
} from 'src/modules/ifc/notifications/notification-dispatcher.service';
import { IfcStateMachineService } from './ifc-state-machine.service';
import { IfcContentService } from './ifc-content.service';
import { IfcViewService } from './ifc-view.service';
import { IfcReportService } from './ifc-report.service';
import { IfcStatusHistoryService } from './ifc-status-history.service';
import {
	USER_SCHOOLS_REPOSITORY,
	type UserSchoolsRepository,
} from 'src/modules/organization/org-scope/core/user-schools/user-schools.repository.interface';

@Injectable()
export class IfcService extends BaseService<IfcRepository> {
	constructor(
		protected readonly repository: IfcRepository,
		private readonly stateMachine: IfcStateMachineService,
		private readonly content: IfcContentService,
		private readonly view: IfcViewService,
		private readonly report: IfcReportService,
		private readonly history: IfcStatusHistoryService,
		private readonly dispatcher: NotificationDispatcherService,
		@Inject(USER_SCHOOLS_REPOSITORY)
		private readonly schoolsRepository: UserSchoolsRepository,
	) {
		super(repository);
	}

	async userSchools(userId: number, academicPeriodId: number, isAdmin: boolean) {
		return this.schoolsRepository.findUserSchools(userId, { academicPeriodId }, isAdmin);
	}

	async submit(ifcId: number, userId: number, schoolId: number) {
		return this.stateMachine.submit(ifcId, userId, schoolId);
	}

	async approve(ifcId: number, userId: number, schoolId: number) {
		return this.stateMachine.approve(ifcId, userId, schoolId);
	}

	async reject(ifcId: number, userId: number, schoolId: number, dto: RejectIfcDto) {
		return this.stateMachine.reject(ifcId, userId, schoolId, dto);
	}

	async createIfc(dto: CreateIfcDto, userId: number, schoolId: number, academicPeriodId: number) {
		return this.content.createIfc(dto, userId, schoolId, academicPeriodId);
	}

	async patch(id: number, dto: IfcContentDto, userId: number, schoolId: number) {
		return this.content.patch(id, dto, userId, schoolId);
	}

	async getView(id: number, userId: number, schoolId: number) {
		return this.view.getView(id, userId, schoolId);
	}

	async getStatusHistory(id: number, userId: number, schoolId: number, isAdminUser: boolean) {
		return this.history.getHistory(id, userId, schoolId, isAdminUser);
	}

	async generatePdf(ifcId: number, userId: number, schoolId: number, lang: 'es' | 'en') {
		return this.report.generatePdf(ifcId, userId, schoolId, lang);
	}

	async generatePdfBulk(ifcIds: number[], userId: number, schoolId: number, lang: 'es' | 'en') {
		return this.report.generatePdfBulk(ifcIds, userId, schoolId, lang);
	}

	async generateStatusReport(dto: IfcStatusReportDto, schoolId: number, academicPeriodId: number) {
		return this.report.generateStatusReport(dto, schoolId, academicPeriodId);
	}

	async update(id: number, dto: UpdateIfcDto, manager?: EntityManager) {
		await IfcValidation.validateUpdate(this.repository, id, dto);
		return await super.update(id, dto, manager);
	}

	async delete(id: number, manager?: EntityManager) {
		await IfcValidation.validateDelete(this.repository, id);
		return await super.delete(id, manager);
	}

	async list(dto: ListIfcsDto, academicPeriodId: number) {
		return await this.repository.findIfcListRows(dto.chartIds, academicPeriodId);
	}

	async prefill(query: IfcPrefillQueryDto, schoolId: number, academicPeriodId: number) {
		const [headerRows, outcomeRows] = await Promise.all([
			this.repository.findPrefillHeaderRows(query.chartId, academicPeriodId, schoolId),
			this.repository.findOutcomeCourseRowsByChart(query.chartId),
		]);

		IfcValidation.assertChartFound(headerRows, 'prefill');
		const header = headerRows[0];
		const previousActions = await this.view.loadPreviousActions(
			Number(header.courseId),
			academicPeriodId,
			null,
		);

		return {
			...header,
			coordinatorUserId:
				header.coordinatorUserId === null ? null : Number(header.coordinatorUserId),
			outcomeCourseResult: this.view.groupOutcomeRows(outcomeRows),
			previousActions,
		};
	}

	async notify(chartId: number, periodId: number, userId: number): Promise<DispatchResult> {
		const statusCode = await this.stateMachine.resolveCurrentStatusCode(chartId, periodId);
		return await this.dispatcher.dispatch({
			chartId,
			periodId,
			triggerCode: TYPE_CODES.NOTIFICATION_TRIGGER.MANUAL,
			ifcStatusCode: statusCode,
			notifierUserId: userId,
		});
	}

	async notifyAll(chartIds: number[], periodId: number, userId: number) {
		const pLimitMod = await import('p-limit');
		const pLimit = (pLimitMod.default ?? pLimitMod) as (
			concurrency: number,
		) => <T>(fn: () => Promise<T>) => Promise<T>;
		const limit = pLimit(5);

		const notificationVars = await this.dispatcher.loadNotificationVars();

		const results = await Promise.allSettled(
			chartIds.map((chartId) =>
				limit(async () => {
					const statusCode = await this.stateMachine.resolveCurrentStatusCode(chartId, periodId);
					const result = await this.dispatcher.dispatch(
						{
							chartId,
							periodId,
							triggerCode: TYPE_CODES.NOTIFICATION_TRIGGER.MANUAL,
							ifcStatusCode: statusCode,
							notifierUserId: userId,
						},
						notificationVars,
					);
					return { chartId, result };
				}),
			),
		);

		const sent: number[] = [];
		const skipped: number[] = [];
		const errors: Array<{ chartId: number; message: string }> = [];
		results.forEach((r, idx) => {
			if (r.status === 'fulfilled') {
				r.value.result.sent ? sent.push(r.value.chartId) : skipped.push(r.value.chartId);
			} else {
				errors.push({ chartId: chartIds[idx], message: (r.reason as Error).message });
			}
		});
		return { sent, skipped, errors };
	}
}
