import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * PPP surveys used to write `information` as `JSON.stringify(...)`. `JsonColumn`'s
 * transformer leaves a string untouched and TypeORM's Postgres driver then
 * `JSON.stringify`s it a second time, so those rows hold a jsonb *string* whose
 * inner keys are camelCase — `information->>'company_name'` finds nothing, and the
 * API hands the frontend a string where every other row is an object.
 *
 * The service now passes an object, which the transformer snake-cases correctly.
 * This brings the rows written before that in line, so a reader does not have to
 * handle two shapes forever.
 */
const PPP_SURVEY_TYPE_CODE = 'TG601-T002';

const INFORMATION_KEYS: { camel: string; snake: string }[] = [
	{ camel: 'companyName', snake: 'company_name' },
	{ camel: 'bossName', snake: 'boss_name' },
	{ camel: 'bossRole', snake: 'boss_role' },
	{ camel: 'phone', snake: 'phone' },
	{ camel: 'email', snake: 'email' },
	{ camel: 'ruc', snake: 'ruc' },
	{ camel: 'totalHours', snake: 'total_hours' },
	{ camel: 'startDate', snake: 'start_date' },
	{ camel: 'endDate', snake: 'end_date' },
];

function buildObject(source: string, from: 'camel' | 'snake', to: 'camel' | 'snake'): string {
	return INFORMATION_KEYS.map((key) => `'${key[to]}', ${source} -> '${key[from]}'`).join(', ');
}

export class BackfillPppSurveyInformationJsonb1786940121112 implements MigrationInterface {
	name = 'BackfillPppSurveyInformationJsonb1786940121112';

	public async up(queryRunner: QueryRunner): Promise<void> {
		// `#>> '{}'` unwraps the jsonb string to its text, which is the JSON document
		// that was encoded twice. The LIKE guard keeps a row whose text is not an
		// object from failing the cast and taking the whole migration with it.
		await queryRunner.query(`
			WITH parsed AS (
				SELECT s.id, (s.information #>> '{}')::jsonb AS doc
				FROM   evidence.surveys s
				WHERE  s.survey_type_id IN (SELECT id FROM core.types WHERE code = '${PPP_SURVEY_TYPE_CODE}')
				  AND  jsonb_typeof(s.information) = 'string'
				  AND  (s.information #>> '{}') LIKE '{%'
			)
			UPDATE evidence.surveys s
			SET    information = jsonb_build_object(${buildObject('p.doc', 'camel', 'snake')})
			FROM   parsed p
			WHERE  p.id = s.id
		`);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		// Restores the double-encoded camelCase string, so rolling back leaves the rows
		// exactly as the pre-fix code wrote and read them.
		await queryRunner.query(`
			UPDATE evidence.surveys s
			SET    information = to_jsonb(
			           (jsonb_build_object(${buildObject('s.information', 'snake', 'camel')}))::text
			       )
			WHERE  s.survey_type_id IN (SELECT id FROM core.types WHERE code = '${PPP_SURVEY_TYPE_CODE}')
			  AND  jsonb_typeof(s.information) = 'object'
		`);
	}
}
