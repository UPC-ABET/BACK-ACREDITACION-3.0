import { runTenantSeed } from '../seed-runner';

runTenantSeed('core module', async (tenantDataSource) => {
	await tenantDataSource.query(`
		INSERT INTO "core"."parameters" (code, name, description, value)
		SELECT v.code, v.name, v.description, v.value
		FROM (
			VALUES
				('PARAMETER_ACADEMIC_START_DATE', 'Fecha de inicio academico', 'Fecha referencial de inicio del periodo academico', '{"month":3,"day":18}'::jsonb),
				('PARAMETER_ACADEMIC_END_DATE', 'Fecha de cierre academico', 'Fecha referencial de cierre del periodo academico', '{"month":7,"day":20}'::jsonb),
				('PARAMETER_MIN_PASSING_GRADE', 'Nota minima aprobatoria', 'Nota minima requerida para aprobar una evaluacion', '{"value":13,"scale":20}'::jsonb),
				('PARAMETER_INSTITUTIONAL_NAME', 'Nombre institucional', 'Nombre oficial de la institucion', '{"name":"Universidad Peruana de Ciencias Aplicadas"}'::jsonb),
				('PARAMETER_INSTITUTIONAL_ACRONYM', 'Acronimo institucional', 'Acronimo oficial de la institucion', '{"acronym":"UPC"}'::jsonb)
		) AS v(code, name, description, value)
		WHERE NOT EXISTS (
			SELECT 1 FROM "core"."parameters" p WHERE p.code = v.code
		);
	`);
});
