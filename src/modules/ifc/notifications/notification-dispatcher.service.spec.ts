import { DataSource } from 'typeorm';
import { BadGatewayException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NotificationDispatcherService } from './notification-dispatcher.service';
import { MailService } from 'src/modules/mail/mail.service';
import { NotificationLogService } from 'src/modules/ifc/notification-log/api/notification-log.service';
import { TYPE_CODES } from 'src/modules/core/types/constants/type-codes';

const ctxRow = (overrides: Partial<Record<string, any>> = {}) => ({
	course_chart_id: 500,
	school_id: 9,
	period_id: 5,
	trigger_type_id: 101,
	ifc_status_type_id: 2,
	ifc_id: 42,
	period_code: 'AP_2026_1',
	course_name: { es: 'Curso', en: 'Course' },
	coordinator_name: 'Ada Lovelace',
	...overrides,
});

const configRow = (overrides: Partial<Record<string, any>> = {}) => ({
	id: 7,
	title: { es: 'Hola {{course_name}}', en: 'Hi {{course_name}}' },
	body: { es: '<p>{{coordinator_name}}</p>', en: '<p>{{coordinator_name}}</p>' },
	to_chart_level_type_ids: [19],
	cc_chart_level_type_ids: [18],
	...overrides,
});

const baseInput = {
	chartId: 500,
	periodId: 5,
	triggerCode: TYPE_CODES.NOTIFICATION_TRIGGER.MANUAL,
	ifcStatusCode: TYPE_CODES.IFC_STATUS.SUBMITTED,
	notifierUserId: 99,
};

function makeDispatcher() {
	const dataSource = { query: jest.fn() };
	const mailService = { sendRawEmail: jest.fn() };
	const configService = { get: jest.fn().mockReturnValue('http://localhost:3000') };
	const notificationLogService = { create: jest.fn().mockResolvedValue({}) };
	const dispatcher = new NotificationDispatcherService(
		dataSource as unknown as DataSource,
		mailService as unknown as MailService,
		configService as unknown as ConfigService,
		notificationLogService as unknown as NotificationLogService,
	);
	return { dispatcher, dataSource, mailService, configService, notificationLogService };
}

describe('NotificationDispatcherService.dispatch', () => {
	it('returns no_course_chart when the chart cannot be resolved', async () => {
		const { dispatcher, dataSource } = makeDispatcher();
		dataSource.query.mockResolvedValueOnce([]);

		const result = await dispatcher.dispatch(baseInput);

		expect(result).toEqual({
			sent: false,
			reason: 'no_course_chart',
			recipients_count: 0,
			cc_count: 0,
		});
	});

	it('returns no_config when the UNIQUE lookup misses', async () => {
		const { dispatcher, dataSource } = makeDispatcher();
		dataSource.query.mockResolvedValueOnce([ctxRow()]).mockResolvedValueOnce([]);

		const result = await dispatcher.dispatch(baseInput);

		expect(result).toEqual({ sent: false, reason: 'no_config', recipients_count: 0, cc_count: 0 });
	});

	it('returns no_recipients when the chain has no matching staff emails', async () => {
		const { dispatcher, dataSource } = makeDispatcher();
		dataSource.query
			.mockResolvedValueOnce([ctxRow()]) // ctx
			.mockResolvedValueOnce([configRow()]) // config
			.mockResolvedValueOnce([]); // recipients walk

		const result = await dispatcher.dispatch(baseInput);

		expect(result).toEqual({
			sent: false,
			reason: 'no_recipients',
			recipients_count: 0,
			cc_count: 0,
		});
	});

	it('returns send_failed and does not throw when sendRawEmail rejects', async () => {
		const { dispatcher, dataSource, mailService } = makeDispatcher();
		dataSource.query
			.mockResolvedValueOnce([ctxRow()]) // ctx
			.mockResolvedValueOnce([configRow()]) // config
			.mockResolvedValueOnce([{ level_type_id: 19, staff_id: 1, staff_email: 'a@x.com' }]) // recipients
			.mockResolvedValueOnce([{ value: [] }]) // parameter vars (empty list)
			.mockResolvedValueOnce([{ code: TYPE_CODES.IFC_STATUS.SUBMITTED }]); // lookupStatusCode
		(mailService.sendRawEmail as jest.Mock).mockRejectedValueOnce(new BadGatewayException('boom'));

		const result = await dispatcher.dispatch(baseInput);

		expect(result.sent).toBe(false);
		expect(result.reason).toBe('send_failed');
	});

	it('dedupes To/Cc: emails in to are removed from cc', async () => {
		const { dispatcher, dataSource, mailService } = makeDispatcher();
		dataSource.query
			.mockResolvedValueOnce([ctxRow()])
			.mockResolvedValueOnce([configRow()])
			.mockResolvedValueOnce([
				{ level_type_id: 19, staff_id: 1, staff_email: 'shared@x.com' },
				{ level_type_id: 18, staff_id: 1, staff_email: 'shared@x.com' },
				{ level_type_id: 18, staff_id: 2, staff_email: 'cc-only@x.com' },
			])
			.mockResolvedValueOnce([{ value: [] }])
			.mockResolvedValueOnce([{ code: TYPE_CODES.IFC_STATUS.SUBMITTED }]);
		(mailService.sendRawEmail as jest.Mock).mockResolvedValueOnce({ messageId: 'msg-1' });

		const result = await dispatcher.dispatch(baseInput);

		expect(result.sent).toBe(true);
		expect(result.recipients_count).toBe(1);
		expect(result.cc_count).toBe(1);
		const callArgs = (mailService.sendRawEmail as jest.Mock).mock.calls[0][0];
		expect(callArgs.to).toBe('shared@x.com');
		expect(callArgs.cc).toEqual(['cc-only@x.com']);
	});

	it('variable substitution: vars whose valid_status_codes do not include the current status code are replaced with empty', async () => {
		const { dispatcher, dataSource, mailService } = makeDispatcher();
		dataSource.query
			.mockResolvedValueOnce([ctxRow()])
			.mockResolvedValueOnce([
				configRow({
					title: {
						es: '[{{observer_name}}] {{course_name}}',
						en: '[{{observer_name}}] {{course_name}}',
					},
					body: { es: '<p>{{course_name}}</p>', en: '<p>{{course_name}}</p>' },
				}),
			])
			.mockResolvedValueOnce([{ level_type_id: 19, staff_id: 1, staff_email: 'a@x.com' }])
			.mockResolvedValueOnce([
				{
					value: [
						{ var: '{{course_name}}', valid_status_codes: null },
						{ var: '{{observer_name}}', valid_status_codes: [TYPE_CODES.IFC_STATUS.OBSERVED] },
					],
				},
			])
			.mockResolvedValueOnce([{ code: TYPE_CODES.IFC_STATUS.SUBMITTED }]); // status code lookup
		(mailService.sendRawEmail as jest.Mock).mockResolvedValueOnce({ messageId: 'msg-1' });

		await dispatcher.dispatch(baseInput);

		const callArgs = (mailService.sendRawEmail as jest.Mock).mock.calls[0][0];
		// {{observer_name}} stripped because status is SUBMITTED, not OBSERVED
		expect(callArgs.subject).toBe('[] Curso');
		expect(callArgs.html).toBe('<p>Curso</p>');
	});
});
