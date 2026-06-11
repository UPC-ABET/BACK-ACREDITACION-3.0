import { runSeed, i18n } from '../seed-runner';

runSeed('accreditation module', async (tenantDataSource) => {
	const accreditorValues = [
		[
			'ACC_SINEACE',
			i18n(
				'Sistema Nacional de Evaluacion, Acreditacion y Certificacion de la Calidad Educativa',
				'National System of Evaluation, Accreditation and Certification of Educational Quality',
			),
		],
		[
			'ACC_ICACIT',
			i18n(
				'Instituto de Calidad y Acreditacion de Programas de Computacion, Ingenieria y Tecnologia',
				'Institute of Quality and Accreditation of Computing, Engineering and Technology Programs',
			),
		],
		['ACC_EISCB', i18n('Acreditadora EISCB', 'EISCB Accreditor')],
	]
		.map(([code, name]) => `('${code}', '${name}'::jsonb)`)
		.join(',\n\t\t\t');

	await tenantDataSource.query(`
		INSERT INTO "accreditation"."accreditors" (code, name)
		SELECT v.code, v.name
		FROM (
			VALUES
				${accreditorValues}
		) AS v(code, name)
		WHERE NOT EXISTS (
			SELECT 1 FROM "accreditation"."accreditors" a WHERE a.code = v.code
		);
	`);

	const commissionValues = [
		[
			'ACC_ICACIT',
			'COM_SOFT_2026',
			i18n(
				'Comision de acreditacion de Ingenieria de Software',
				'Software Engineering accreditation commission',
			),
		],
		[
			'ACC_SINEACE',
			'COM_ADMIN_2026',
			i18n(
				'Comision de acreditacion de Administracion',
				'Business Administration accreditation commission',
			),
		],
		['ACC_EISCB', 'COM_CS', i18n('Comision de acreditacion CS', 'CS Accreditation Commission')],
	]
		.map(([accreditorCode, code, name]) => `('${accreditorCode}', '${code}', '${name}'::jsonb)`)
		.join(',\n\t\t\t');

	await tenantDataSource.query(`
		INSERT INTO "accreditation"."commissions" (accreditor_id, code, name)
		SELECT accreditor.id, v.code, v.name
		FROM "accreditation"."accreditors" accreditor
		JOIN (
			VALUES
				${commissionValues}
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
				('COM_SOFT_2026', 'PROG_SOFT', '202601', 'TG301-T001'),
				('COM_ADMIN_2026', 'PROG_ADMIN', '202601', 'TG301-T001'),
				('COM_CS', 'CS', '202502', 'TG301-T001'),
				('COM_CS', 'CS', '202601', 'TG301-T001')
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

	// outcome_code is unique per academic period (via program_commission), not global — the same
	// code may recur in another period. Pin each outcome to a specific period by academic_period_code.
	const outcomeValues = [
		[
			'COM_SOFT_2026',
			'PROG_SOFT',
			'202601',
			'OUT_SOFT_01',
			i18n('Pensamiento critico', 'Critical thinking'),
			i18n(
				'Analiza problemas complejos de ingenieria de software con criterios tecnicos y de negocio.',
				'Analyzes complex software engineering problems with technical and business criteria.',
			),
		],
		[
			'COM_SOFT_2026',
			'PROG_SOFT',
			'202601',
			'OUT_SOFT_02',
			i18n('Comunicacion efectiva', 'Effective communication'),
			i18n(
				'Comunica decisiones tecnicas a audiencias especializadas y no especializadas.',
				'Communicates technical decisions to specialized and non-specialized audiences.',
			),
		],
		[
			'COM_SOFT_2026',
			'PROG_SOFT',
			'202601',
			'OUT_SOFT_03',
			i18n('Trabajo en equipo', 'Teamwork'),
			i18n(
				'Colabora en equipos multidisciplinarios durante el ciclo de vida del software.',
				'Collaborates in multidisciplinary teams during the software lifecycle.',
			),
		],
		[
			'COM_SOFT_2026',
			'PROG_SOFT',
			'202601',
			'OUT_SOFT_04',
			i18n('Solucion tecnica', 'Technical solution'),
			i18n(
				'Disena e implementa soluciones de software sostenibles y verificables.',
				'Designs and implements sustainable and verifiable software solutions.',
			),
		],
		[
			'COM_ADMIN_2026',
			'PROG_ADMIN',
			'202601',
			'OUT_ADMIN_01',
			i18n('Gestion organizacional', 'Organizational management'),
			i18n(
				'Propone acciones de gestion basadas en informacion confiable.',
				'Proposes management actions based on reliable information.',
			),
		],
		[
			'COM_CS',
			'CS',
			'202502',
			'A1',
			i18n('Pensamiento computacional', 'Computational thinking'),
			i18n(
				'Aplica pensamiento computacional para resolver problemas.',
				'Applies computational thinking to solve problems.',
			),
		],
		[
			'COM_CS',
			'CS',
			'202502',
			'A2',
			i18n('Comunicacion tecnica', 'Technical communication'),
			i18n(
				'Comunica resultados tecnicos a audiencias diversas.',
				'Communicates technical results to diverse audiences.',
			),
		],
	]
		.map(
			([cCode, pCode, apCode, oCode, name, desc]) =>
				`('${cCode}', '${pCode}', '${apCode}', '${oCode}', '${name}'::jsonb, '${desc}'::jsonb)`,
		)
		.join(',\n\t\t\t');

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
				${outcomeValues}
		) AS v(commission_code, program_code, academic_period_code, outcome_code, outcome_name, outcome_description)
		JOIN "accreditation"."commissions" commission
			ON commission.code = v.commission_code
		JOIN "academic"."programs" program
			ON program.code = v.program_code
		JOIN "academic"."academic_periods" period
			ON period.code = v.academic_period_code
		JOIN "accreditation"."program_commissions" pc
			ON pc.commission_id = commission.id
				AND pc.program_id = program.id
				AND pc.academic_period_id = period.id
		WHERE NOT EXISTS (
			SELECT 1 FROM "accreditation"."outcomes" outcome
			WHERE outcome.program_commission_id = pc.id AND outcome.outcome_code = v.outcome_code
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
				('OUT_SOFT_01', 'SP_SOFT26', '202601', 'Fundamentos de Programacion', 'TG302-T001'),
				('OUT_SOFT_02', 'SP_SOFT26', '202601', 'Ingenieria de Requisitos', 'TG302-T001'),
				('OUT_SOFT_03', 'SP_SOFT26', '202502', 'Proyecto Integrador de Software', 'TG302-T001'),
				('OUT_SOFT_04', 'SP_SOFT26', '202502', 'Proyecto Integrador de Software', 'TG302-T001'),
				('A1', 'SP_CS_2502', '202502', 'Algoritmos y Estructuras de Datos', 'TG302-T001'),
				('A2', 'SP_CS_2502', '202502', 'Algoritmos y Estructuras de Datos', 'TG302-T001'),
				('A1', 'SP_CS_2502', '202502', 'Bases de Datos', 'TG302-T001'),
				('A2', 'SP_CS_2502', '202502', 'Bases de Datos', 'TG302-T001'),
				('A1', 'SP_CS_2502', '202502', 'Ingenieria de Software', 'TG302-T001'),
				('A2', 'SP_CS_2502', '202502', 'Ingenieria de Software', 'TG302-T001'),
				-- Mirror the CS outcome mappings for 202601 so prefill/view IFC resolves outcomes.
				('A1', 'SP_CS_2502', '202601', 'Algoritmos y Estructuras de Datos', 'TG302-T001'),
				('A2', 'SP_CS_2502', '202601', 'Algoritmos y Estructuras de Datos', 'TG302-T001'),
				('A1', 'SP_CS_2502', '202601', 'Bases de Datos', 'TG302-T001'),
				('A2', 'SP_CS_2502', '202601', 'Bases de Datos', 'TG302-T001'),
				('A1', 'SP_CS_2502', '202601', 'Ingenieria de Software', 'TG302-T001'),
				('A2', 'SP_CS_2502', '202601', 'Ingenieria de Software', 'TG302-T001')
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
			ON course.name->>'es' = v.course_name
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
