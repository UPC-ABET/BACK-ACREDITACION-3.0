import { CallHandler, ExecutionContext } from '@nestjs/common';
import { lastValueFrom, of } from 'rxjs';
import { CamelCaseInterceptor } from './camel-case.interceptor';

const run = async (body: unknown): Promise<unknown> => {
	const interceptor = new CamelCaseInterceptor();
	const next: CallHandler = { handle: () => of(body) };
	return lastValueFrom(interceptor.intercept({} as ExecutionContext, next));
};

describe('CamelCaseInterceptor', () => {
	it('camelizes top-level and nested snake_case keys', async () => {
		const result = await run({
			code: 200,
			data: { user_id: 1, extra: { survey_type: 'GRA', name_en: 'x' } },
		});
		expect(result).toEqual({
			code: 200,
			data: { userId: 1, extra: { surveyType: 'GRA', nameEn: 'x' } },
		});
	});

	it('camelizes keys inside arrays', async () => {
		const result = await run([{ course_id: 1 }, { course_id: 2 }]);
		expect(result).toEqual([{ courseId: 1 }, { courseId: 2 }]);
	});

	it('leaves camelCase keys and primitive values untouched', async () => {
		const result = await run({ alreadyCamel: 'a_value_stays', count: 3 });
		expect(result).toEqual({ alreadyCamel: 'a_value_stays', count: 3 });
	});

	it('passes through null/undefined bodies (e.g. file responses)', async () => {
		expect(await run(undefined)).toBeUndefined();
		expect(await run(null)).toBeNull();
	});
});
