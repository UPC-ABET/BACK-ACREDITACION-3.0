import { runTenantSeed } from '../seed-runner';

runTenantSeed('accreditation module', async (tenantDataSource) => {
	await tenantDataSource.query(`
		INSERT INTO "accreditation"."accreditors" (code, name)
		SELECT v.code, v.name
		FROM (
			VALUES
				('ACC_SINEACE', 'Sistema Nacional de Evaluacion, Acreditacion y Certificacion de la Calidad Educativa'),
				('ACC_ICACIT', 'Instituto de Calidad y Acreditacion de Programas de Computacion, Ingenieria y Tecnologia')
		) AS v(code, name)
		WHERE NOT EXISTS (
			SELECT 1 FROM "accreditation"."accreditors" a WHERE a.code = v.code
		);
	`);

	await tenantDataSource.query(`
		INSERT INTO "accreditation"."commissions" (accreditor_id, code, name)
		SELECT accreditor.id, v.code, v.name
		FROM "accreditation"."accreditors" accreditor
		JOIN (
			VALUES
				('ACC_ICACIT', 'COM_SOFT_2026', 'Comision de acreditacion de Ingenieria de Software'),
				('ACC_SINEACE', 'COM_ADMIN_2026', 'Comision de acreditacion de Administracion')
		) AS v(accreditor_code, code, name)
			ON accreditor.code = v.accreditor_code
		WHERE NOT EXISTS (
			SELECT 1 FROM "accreditation"."commissions" c WHERE c.code = v.code
		);
	`);

	await tenantDataSource.query(`
		INSERT INTO "accreditation"."program_commissions" (
			commission_id,
			program_id,
			academic_period_id,
			commission_type_id
		)
		SELECT commission.id, program.id, period.id, commission_type.id
		FROM (
			VALUES
				('COM_SOFT_2026', 'PROG_SOFT', 'AP_2026_1', 'TG301-T001'),
				('COM_ADMIN_2026', 'PROG_ADMIN', 'AP_2026_1', 'TG301-T001')
		) AS v(commission_code, program_code, academic_period_code, commission_type_code)
		JOIN "accreditation"."commissions" commission
			ON commission.code = v.commission_code
		JOIN "academic"."programs" program
			ON program.code = v.program_code
		JOIN "academic"."academic_periods" period
			ON period.code = v.academic_period_code
		JOIN "core"."types" commission_type
			ON commission_type.code = v.commission_type_code
		WHERE NOT EXISTS (
			SELECT 1
			FROM "accreditation"."program_commissions" pc
			WHERE pc.commission_id = commission.id
				AND pc.program_id = program.id
				AND pc.academic_period_id = period.id
		);
	`);

	await tenantDataSource.query(`
		INSERT INTO "accreditation"."outcomes" (
			program_commission_id,
			outcome_code,
			outcome_name,
			outcome_description
		)
		SELECT pc.id, v.outcome_code, v.outcome_name, v.outcome_description
		FROM (
			VALUES
				('COM_SOFT_2026', 'PROG_SOFT', 'OUT_SOFT_01', 'Pensamiento critico', 'Analiza problemas complejos de ingenieria de software con criterios tecnicos y de negocio.'),
				('COM_SOFT_2026', 'PROG_SOFT', 'OUT_SOFT_02', 'Comunicacion efectiva', 'Comunica decisiones tecnicas a audiencias especializadas y no especializadas.'),
				('COM_SOFT_2026', 'PROG_SOFT', 'OUT_SOFT_03', 'Trabajo en equipo', 'Colabora en equipos multidisciplinarios durante el ciclo de vida del software.'),
				('COM_SOFT_2026', 'PROG_SOFT', 'OUT_SOFT_04', 'Solucion tecnica', 'Disena e implementa soluciones de software sostenibles y verificables.'),
				('COM_ADMIN_2026', 'PROG_ADMIN', 'OUT_ADMIN_01', 'Gestion organizacional', 'Propone acciones de gestion basadas en informacion confiable.')
		) AS v(commission_code, program_code, outcome_code, outcome_name, outcome_description)
		JOIN "accreditation"."commissions" commission
			ON commission.code = v.commission_code
		JOIN "academic"."programs" program
			ON program.code = v.program_code
		JOIN "accreditation"."program_commissions" pc
			ON pc.commission_id = commission.id AND pc.program_id = program.id
		WHERE NOT EXISTS (
			SELECT 1 FROM "accreditation"."outcomes" outcome WHERE outcome.outcome_code = v.outcome_code
		);
	`);

	await tenantDataSource.query(`
		INSERT INTO "academic"."course_outcome_mappings" (
			outcome_id,
			study_plan_course_id,
			outcome_type_id
		)
		SELECT outcome.id, spc.id, outcome_type.id
		FROM (
			VALUES
				('OUT_SOFT_01', 'SP_SOFT26', 'AP_2026_1', 'Fundamentos de Programacion', 'TG302-T001'),
				('OUT_SOFT_02', 'SP_SOFT26', 'AP_2026_1', 'Ingenieria de Requisitos', 'TG302-T001'),
				('OUT_SOFT_03', 'SP_SOFT26', 'AP_2026_2', 'Proyecto Integrador de Software', 'TG302-T001'),
				('OUT_SOFT_04', 'SP_SOFT26', 'AP_2026_2', 'Proyecto Integrador de Software', 'TG302-T001')
		) AS v(outcome_code, study_plan_code, academic_period_code, course_name, outcome_type_code)
		JOIN "accreditation"."outcomes" outcome
			ON outcome.outcome_code = v.outcome_code
		JOIN "academic"."study_plans" sp
			ON sp.code = v.study_plan_code
		JOIN "academic"."study_plan_academic_periods" spap
			ON spap.study_plan_id = sp.id
		JOIN "academic"."academic_periods" ap
			ON ap.id = spap.academic_period_id AND ap.code = v.academic_period_code
		JOIN "academic"."courses" course
			ON course.name = v.course_name
		JOIN "academic"."study_plan_courses" spc
			ON spc.study_plan_academic_period_id = spap.id AND spc.course_id = course.id
		JOIN "core"."types" outcome_type
			ON outcome_type.code = v.outcome_type_code
		WHERE NOT EXISTS (
			SELECT 1
			FROM "academic"."course_outcome_mappings" com
			WHERE com.outcome_id = outcome.id AND com.study_plan_course_id = spc.id
		);
	`);
});
