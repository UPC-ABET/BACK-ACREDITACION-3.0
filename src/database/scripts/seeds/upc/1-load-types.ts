import { runTenantSeed, i18n } from '../seed-runner';

runTenantSeed('core type catalogs', async (tenantDataSource) => {
	const typeGroupRows: Array<[string, string, string]> = [
		[
			'TG101',
			i18n('Tipo de documento', 'Document type'),
			i18n('Documentos y valores base para usuarios', 'Documents and base values for users'),
		],
		[
			'TG102',
			i18n('Modalidad de programa', 'Program modality'),
			i18n(
				'Modalidades del programa academico (Regular, EPE)',
				'Academic program modalities (Regular, EPE)',
			),
		],
		[
			'TG103',
			i18n('Modalidad de ensenanza', 'Teaching modality'),
			i18n('Modalidades academicas generales', 'General academic modalities'),
		],
		[
			'TG203',
			i18n('Nivel academico', 'Academic level'),
			i18n('Niveles de cursos en el plan de estudios', 'Course levels in the study plan'),
		],
		[
			'TG205',
			i18n('Tipo de nota', 'Grade type'),
			i18n('Tipos de evaluacion calificada', 'Types of graded evaluation'),
		],
		[
			'TG206',
			i18n('Tipo de instrumento de desempeno', 'Performance instrument type'),
			i18n('Tipos para niveles de desempeno', 'Types for performance levels'),
		],
		[
			'TG301',
			i18n('Tipo de comision', 'Commission type'),
			i18n('Tipos de comision de acreditacion', 'Accreditation commission types'),
		],
		[
			'TG302',
			i18n('Tipo de resultado', 'Outcome type'),
			i18n('Tipos de resultados de aprendizaje', 'Learning outcome types'),
		],
		[
			'TG401',
			i18n('Tipo de rubrica', 'Rubric type'),
			i18n('Tipos de rubricas de evaluacion', 'Evaluation rubric types'),
		],
		[
			'TG403',
			i18n('Tipo de evaluador', 'Evaluator type'),
			i18n('Roles de evaluadores y participantes', 'Roles of evaluators and participants'),
		],
		[
			'TG404',
			i18n('Estado de calificacion', 'Grade status'),
			i18n('Estados de evaluaciones calificadas', 'States of graded evaluations'),
		],
		[
			'TG501',
			i18n('Tipo constituyente', 'Constituent type'),
			i18n('Tipos de constituyentes', 'Constituent types'),
		],
		['TG601', i18n('Tipo de encuesta', 'Survey type'), i18n('Tipos de encuestas', 'Survey types')],
		[
			'TG602',
			i18n('Estado de encuesta', 'Survey status'),
			i18n('Estados de encuestas', 'Survey states'),
		],
		[
			'TG701',
			i18n('Estado IFC', 'IFC status'),
			i18n('Estados de indicadores IFC', 'IFC indicator states'),
		],
		[
			'TG801',
			i18n('Criticidad de hallazgo', 'Finding criticality'),
			i18n('Niveles de criticidad', 'Criticality levels'),
		],
		[
			'TG901',
			i18n('Cargo del personal', 'Staff position'),
			i18n(
				'Tipos de cargos administrativos y docentes',
				'Administrative and teaching position types',
			),
		],
		[
			'TG903',
			i18n('Tipo de entidad organizacional', 'Organizational entity type'),
			i18n('Tipos de entidades en organigrama', 'Entity types in the org chart'),
		],
		[
			'TG1001',
			i18n('Estado de notificacion', 'Notification status'),
			i18n('Estados de notificaciones', 'Notification states'),
		],
		[
			'TG1002',
			i18n('Disparador de notificacion', 'Notification trigger'),
			i18n('Cuando se dispara una notificacion', 'When a notification is triggered'),
		],
		[
			'TG1003',
			i18n('Completitud de accion', 'Action completeness'),
			i18n(
				'Estado derivado de la accion (Pendiente/Implementada)',
				'Derived action state (Pending/Implemented)',
			),
		],
		[
			'TG1101',
			i18n('Tipo de carga', 'Upload type'),
			i18n('Tipos de carga masiva por Excel', 'Bulk Excel upload types'),
		],
		[
			'TG1102',
			i18n('Estado de carga', 'Upload status'),
			i18n('Estados de una carga masiva', 'Bulk upload states'),
		],
	];

	const typeGroupValues = typeGroupRows
		.map(([code, name, description]) => `('${code}', '${name}'::jsonb, '${description}'::jsonb)`)
		.join(',\n\t\t\t');

	await tenantDataSource.query(`
		INSERT INTO "core"."type_groups" (code, name, description)
		SELECT v.code, v.name, v.description
		FROM (
			VALUES
				${typeGroupValues}
		) AS v(code, name, description)
		WHERE NOT EXISTS (
			SELECT 1 FROM "core"."type_groups" tg WHERE tg.code = v.code
		);
	`);

	const typeRows: Array<[string, string, string, string, string]> = [
		[
			'TG101',
			'TG101-T001',
			i18n('DNI', 'National ID'),
			i18n('Documento Nacional de Identidad', 'National Identity Document'),
			'{}',
		],
		[
			'TG101',
			'TG101-T002',
			i18n('Pasaporte', 'Passport'),
			i18n('Pasaporte internacional', 'International passport'),
			'{}',
		],
		[
			'TG101',
			'TG101-T003',
			i18n('Carne de extranjeria', 'Foreigner card'),
			i18n('Carne de extranjeria', 'Foreigner residence card'),
			'{}',
		],
		[
			'TG102',
			'TG102-T001',
			i18n('Regular', 'Regular'),
			i18n('Programa en modalidad regular', 'Regular program modality'),
			'{}',
		],
		[
			'TG102',
			'TG102-T002',
			i18n('EPE', 'EPE'),
			i18n(
				'Programa para Personas con Experiencia Laboral',
				'Program for People with Work Experience',
			),
			'{}',
		],
		[
			'TG103',
			'TG103-T001',
			i18n('Presencial', 'In-person'),
			i18n('Educacion presencial', 'In-person education'),
			'{"mode":"in-person"}',
		],
		[
			'TG103',
			'TG103-T002',
			i18n('Virtual', 'Virtual'),
			i18n('Educacion virtual', 'Online education'),
			'{"mode":"online"}',
		],
		[
			'TG103',
			'TG103-T003',
			i18n('Hibrida', 'Hybrid'),
			i18n('Educacion hibrida', 'Hybrid education'),
			'{"mode":"hybrid"}',
		],
		[
			'TG203',
			'TG203-T001',
			i18n('Nivelacion', 'Leveling'),
			i18n('Curso de nivelacion', 'Leveling course'),
			'{"level":0}',
		],
		[
			'TG203',
			'TG203-T002',
			i18n('Primer ciclo', 'First cycle'),
			i18n('Curso de primer ciclo', 'First-cycle course'),
			'{"level":1}',
		],
		[
			'TG203',
			'TG203-T003',
			i18n('Segundo ciclo', 'Second cycle'),
			i18n('Curso de segundo ciclo', 'Second-cycle course'),
			'{"level":2}',
		],
		[
			'TG203',
			'TG203-T004',
			i18n('Tercer ciclo', 'Third cycle'),
			i18n('Curso de tercer ciclo', 'Third-cycle course'),
			'{"level":3}',
		],
		[
			'TG203',
			'TG203-T005',
			i18n('Cuarto ciclo', 'Fourth cycle'),
			i18n('Curso de cuarto ciclo', 'Fourth-cycle course'),
			'{"level":4}',
		],
		[
			'TG203',
			'TG203-T006',
			i18n('Quinto ciclo', 'Fifth cycle'),
			i18n('Curso de quinto ciclo', 'Fifth-cycle course'),
			'{"level":5}',
		],
		[
			'TG203',
			'TG203-T007',
			i18n('Sexto ciclo', 'Sixth cycle'),
			i18n('Curso de sexto ciclo', 'Sixth-cycle course'),
			'{"level":6}',
		],
		[
			'TG203',
			'TG203-T008',
			i18n('Septimo ciclo', 'Seventh cycle'),
			i18n('Curso de septimo ciclo', 'Seventh-cycle course'),
			'{"level":7}',
		],
		[
			'TG203',
			'TG203-T009',
			i18n('Octavo ciclo', 'Eighth cycle'),
			i18n('Curso de octavo ciclo', 'Eighth-cycle course'),
			'{"level":8}',
		],
		[
			'TG203',
			'TG203-T010',
			i18n('Noveno ciclo', 'Ninth cycle'),
			i18n('Curso de noveno ciclo', 'Ninth-cycle course'),
			'{"level":9}',
		],
		[
			'TG203',
			'TG203-T011',
			i18n('Decimo ciclo', 'Tenth cycle'),
			i18n('Curso de decimo ciclo', 'Tenth-cycle course'),
			'{"level":10}',
		],
		[
			'TG205',
			'TG205-T001',
			i18n('EA', 'EA'),
			i18n('Evaluacion Parcial', 'Midterm evaluation'),
			'{"weight":0.1}',
		],
		[
			'TG205',
			'TG205-T002',
			i18n('EB', 'EB'),
			i18n('Evaluacion Final', 'Final evaluation'),
			'{"weight":0.1}',
		],
		[
			'TG205',
			'TG205-T003',
			i18n('PA', 'PA'),
			i18n('Proyecto Academico', 'Academic project'),
			'{"weight":0.1}',
		],
		[
			'TG205',
			'TG205-T004',
			i18n('TA', 'TA'),
			i18n('Tarea Academica', 'Academic homework'),
			'{"weight":1}',
		],
		[
			'TG205',
			'TG205-T005',
			i18n('TP', 'TP'),
			i18n('Trabajo Parcial', 'Midterm assignment'),
			'{"weight":0.1}',
		],
		[
			'TG205',
			'TG205-T006',
			i18n('TF', 'TF'),
			i18n('Trabajo Final', 'Final assignment'),
			'{"weight":0.1}',
		],
		[
			'TG206',
			'TG206-T001',
			i18n('Rubrica', 'Rubric'),
			i18n('Instrumento tipo rubrica', 'Rubric-type instrument'),
			'{}',
		],
		[
			'TG206',
			'TG206-T002',
			i18n('IFC', 'IFC'),
			i18n('Instrumento tipo IFC', 'IFC-type instrument'),
			'{}',
		],
		[
			'TG206',
			'TG206-T003',
			i18n('RC', 'RC'),
			i18n('Instrumento tipo RC', 'RC-type instrument'),
			'{}',
		],
		[
			'TG206',
			'TG206-T004',
			i18n('RV', 'RV'),
			i18n('Instrumento tipo RV', 'RV-type instrument'),
			'{}',
		],
		[
			'TG206',
			'TG206-T005',
			i18n('PPP', 'PPP'),
			i18n('Instrumento tipo PPP', 'PPP-type instrument'),
			'{}',
		],
		[
			'TG206',
			'TG206-T006',
			i18n('GRA', 'GRA'),
			i18n('Instrumento tipo GRA', 'GRA-type instrument'),
			'{}',
		],
		[
			'TG206',
			'TG206-T007',
			i18n('LCFC', 'LCFC'),
			i18n('Instrumento tipo LCFC', 'LCFC-type instrument'),
			'{}',
		],
		[
			'TG206',
			'TG206-T008',
			i18n('ARD', 'ARD'),
			i18n('Instrumento tipo ARD', 'ARD-type instrument'),
			'{}',
		],
		[
			'TG301',
			'TG301-T001',
			i18n('General', 'General'),
			i18n('Comision de acreditacion general', 'General accreditation commission'),
			'{}',
		],
		[
			'TG301',
			'TG301-T002',
			i18n('Especifica', 'Specific'),
			i18n('Comision de acreditacion especifica', 'Specific accreditation commission'),
			'{}',
		],
		[
			'TG302',
			'TG302-T001',
			i18n('Verificacion', 'Verification'),
			i18n('Outcome de verificacion de logro', 'Achievement verification outcome'),
			'{}',
		],
		[
			'TG302',
			'TG302-T002',
			i18n('Control', 'Control'),
			i18n('Outcome de control de progreso', 'Progress control outcome'),
			'{}',
		],
		[
			'TG401',
			'TG401-T001',
			i18n('Rubrica Capstone', 'Capstone rubric'),
			i18n(
				'Rubrica basada en outcomes (proyecto integrador)',
				'Outcome-based rubric (capstone project)',
			),
			'{}',
		],
		[
			'TG401',
			'TG401-T002',
			i18n('Rubrica No Capstone', 'Non-Capstone rubric'),
			i18n(
				'Rubrica por curso sin requerimiento de outcomes',
				'Per-course rubric without outcome requirement',
			),
			'{}',
		],
		[
			'TG403',
			'TG403-T001',
			i18n('Comité', 'Committee'),
			i18n(
				'Comité - promedia notas de todos los evaluadores COM',
				'Committee - averages scores from all COM evaluators',
			),
			'{}',
		],
		[
			'TG403',
			'TG403-T002',
			i18n('Gerente', 'Manager'),
			i18n(
				'Gerente - escribe directo sin promediar (WASC/PA)',
				'Manager - writes directly without averaging (WASC/PA)',
			),
			'{}',
		],
		[
			'TG403',
			'TG403-T003',
			i18n('Docente', 'Professor'),
			i18n('Docente - escribe directo', 'Professor - writes directly'),
			'{}',
		],
		[
			'TG403',
			'TG403-T004',
			i18n('Cliente', 'Client'),
			i18n('Cliente - escribe directo', 'Client - writes directly'),
			'{}',
		],
		[
			'TG403',
			'TG403-T005',
			i18n('Coautor', 'Co-author'),
			i18n('Coautor - escribe directo', 'Co-author - writes directly'),
			'{}',
		],
		[
			'TG404',
			'TG404-T001',
			i18n('ASISTIO', 'ATTENDED'),
			i18n(
				'Asistio y Calificado - El evaluador asistio y califico al alumno',
				'Attended and graded - the evaluator attended and graded the student',
			),
			'{}',
		],
		[
			'TG404',
			'TG404-T002',
			i18n('NR', 'NR'),
			i18n(
				'No Registrado - Calificacion no registrada o observacion vacia',
				'Not registered - score not recorded or observation empty',
			),
			'{}',
		],
		[
			'TG404',
			'TG404-T003',
			i18n('NA', 'DNA'),
			i18n(
				'No Asistio - El evaluador no asistio a la evaluacion',
				'Did not attend - the evaluator did not attend the evaluation',
			),
			'{}',
		],
		[
			'TG501',
			'TG501-T001',
			i18n('Examen', 'Exam'),
			i18n('Instrumento de examen', 'Exam instrument'),
			'{}',
		],
		[
			'TG501',
			'TG501-T002',
			i18n('Proyecto', 'Project'),
			i18n('Instrumento de proyecto', 'Project instrument'),
			'{}',
		],
		[
			'TG501',
			'TG501-T003',
			i18n('Encuesta', 'Survey'),
			i18n('Instrumento de encuesta', 'Survey instrument'),
			'{}',
		],
		[
			'TG601',
			'TG601-T001',
			i18n('Graduandos', 'Graduates'),
			i18n('Encuesta a graduandos', 'Graduate survey'),
			'{"code":"GRA"}',
		],
		[
			'TG601',
			'TG601-T002',
			i18n('Practicas Pre-Profesionales', 'Pre-Professional Internships'),
			i18n('Encuesta PPP a estudiantes en practicas', 'PPP survey for students in internships'),
			'{"code":"PPP"}',
		],
		[
			'TG601',
			'TG601-T003',
			i18n('Logro de Fin de Ciclo', 'End-of-Cycle Achievement'),
			i18n('Encuesta LCFC por curso y ciclo', 'LCFC survey per course and cycle'),
			'{"code":"LCFC"}',
		],
		[
			'TG602',
			'TG602-T001',
			i18n('Activa', 'Active'),
			i18n('Encuesta activa', 'Active survey'),
			'{}',
		],
		[
			'TG602',
			'TG602-T002',
			i18n('Cerrada', 'Closed'),
			i18n('Encuesta cerrada', 'Closed survey'),
			'{}',
		],
		[
			'TG701',
			'TG701-T001',
			i18n('Guardado', 'Saved'),
			i18n('IFC guardado', 'IFC saved'),
			'{"color":"#3b82f6"}',
		],
		[
			'TG701',
			'TG701-T002',
			i18n('Enviado', 'Submitted'),
			i18n('IFC enviado a revision', 'IFC submitted for review'),
			'{"color":"#d97706"}',
		],
		[
			'TG701',
			'TG701-T003',
			i18n('Aprobado', 'Approved'),
			i18n('IFC aprobado', 'IFC approved'),
			'{"color":"#16a34a"}',
		],
		[
			'TG701',
			'TG701-T004',
			i18n('Observado', 'Observed'),
			i18n('IFC observado', 'IFC observed'),
			'{"color":"#ef4444"}',
		],
		[
			'TG701',
			'TG701-T005',
			i18n('Sin Registrar', 'Unregistered'),
			i18n('IFC sin registrar (derivado)', 'Unregistered IFC (derived)'),
			'{"color":"#6b7280"}',
		],
		[
			'TG801',
			'TG801-T001',
			i18n('Critico', 'Critical'),
			i18n('Criticidad alta', 'High criticality'),
			'{"order":1,"color":"#dc2626"}',
		],
		[
			'TG801',
			'TG801-T002',
			i18n('Preocupante', 'Worrying'),
			i18n('Criticidad media', 'Medium criticality'),
			'{"order":2,"color":"#f97316"}',
		],
		[
			'TG801',
			'TG801-T003',
			i18n('Normal', 'Normal'),
			i18n('Criticidad baja', 'Low criticality'),
			'{"order":3,"color":"#64748b"}',
		],
		[
			'TG901',
			'TG901-T001',
			i18n('Profesor Tiempo Completo', 'Full-time Professor'),
			i18n('Profesor con dedicacion a tiempo completo', 'Professor with full-time dedication'),
			'{}',
		],
		[
			'TG901',
			'TG901-T002',
			i18n('Profesor Tiempo Parcial', 'Part-time Professor'),
			i18n('Profesor con dedicacion a tiempo parcial', 'Professor with part-time dedication'),
			'{}',
		],
		[
			'TG901',
			'TG901-T003',
			i18n('Director Tiempo Completo', 'Full-time Director'),
			i18n('Director con dedicacion a tiempo completo', 'Director with full-time dedication'),
			'{}',
		],
		[
			'TG901',
			'TG901-T004',
			i18n('Director Tiempo Parcial', 'Part-time Director'),
			i18n('Director con dedicacion a tiempo parcial', 'Director with part-time dedication'),
			'{}',
		],
		[
			'TG903',
			'TG903-T001',
			i18n('Decanato', "Dean's Office"),
			i18n('Decanato', "Dean's Office"),
			'{}',
		],
		[
			'TG903',
			'TG903-T002',
			i18n('Escuela', 'School'),
			i18n('Escuela / Facultad', 'School / Faculty'),
			'{}',
		],
		[
			'TG903',
			'TG903-T003',
			i18n('Carrera', 'Program'),
			i18n('Carrera', 'Program'),
			'{}',
		],
		['TG903', 'TG903-T004', i18n('Area', 'Area'), i18n('Area academica', 'Academic area'), '{}'],
		[
			'TG903',
			'TG903-T005',
			i18n('Subarea', 'Subarea'),
			i18n('Subarea academica', 'Academic subarea'),
			'{}',
		],
		['TG903', 'TG903-T006', i18n('Curso', 'Course'), i18n('Curso', 'Course'), '{}'],

		[
			'TG1001',
			'TG1001-T001',
			i18n('Programada', 'Scheduled'),
			i18n('Notificacion programada', 'Scheduled notification'),
			'{}',
		],
		[
			'TG1001',
			'TG1001-T002',
			i18n('Enviada', 'Sent'),
			i18n('Notificacion enviada', 'Sent notification'),
			'{}',
		],
		[
			'TG1002',
			'TG1002-T001',
			i18n('Manual', 'Manual'),
			i18n('Notificacion enviada manualmente', 'Notification sent manually'),
			'{}',
		],
		[
			'TG1002',
			'TG1002-T002',
			i18n('Auto al cambiar estado', 'Auto on status change'),
			i18n(
				'Notificacion automatica por cambio de estado',
				'Automatic notification on status change',
			),
			'{}',
		],
		[
			'TG1003',
			'TG1003-T001',
			i18n('Pendiente', 'Pending'),
			i18n('Accion sin evidencias', 'Action without evidence'),
			'{"color":"#71717A"}',
		],
		[
			'TG1003',
			'TG1003-T002',
			i18n('Implementada', 'Implemented'),
			i18n('Accion con evidencias', 'Action with evidence'),
			'{"color":"#10B981"}',
		],
		[
			'TG1101',
			'TG1101-T001',
			i18n('Personal', 'Staff'),
			i18n('Carga de personal', 'Staff upload'),
			'{}',
		],
		[
			'TG1101',
			'TG1101-T002',
			i18n('Malla curricular', 'Study plan'),
			i18n('Carga de malla curricular', 'Study plan upload'),
			'{}',
		],
		[
			'TG1101',
			'TG1101-T003',
			i18n('Resultados', 'Outcomes'),
			i18n('Carga de resultados', 'Outcomes upload'),
			'{}',
		],
		[
			'TG1101',
			'TG1101-T004',
			i18n('Organigrama', 'Organization chart'),
			i18n('Carga de organigrama', 'Organization chart upload'),
			'{}',
		],
		[
			'TG1101',
			'TG1101-T005',
			i18n('Secciones', 'Sections'),
			i18n('Carga de secciones', 'Sections upload'),
			'{}',
		],
		[
			'TG1101',
			'TG1101-T006',
			i18n('Alumnos matriculados', 'Enrolled students'),
			i18n('Carga de alumnos matriculados', 'Enrolled students upload'),
			'{}',
		],
		[
			'TG1101',
			'TG1101-T007',
			i18n('Notas RV', 'RV grades'),
			i18n('Carga de notas RV', 'RV grades upload'),
			'{}',
		],
		[
			'TG1101',
			'TG1101-T008',
			i18n('Notas RC', 'RC grades'),
			i18n('Carga de notas RC', 'RC grades upload'),
			'{}',
		],
		[
			'TG1101',
			'TG1101-T009',
			i18n('Articulacion', 'Articulation'),
			i18n('Carga de articulacion', 'Articulation upload'),
			'{}',
		],
		[
			'TG1101',
			'TG1101-T010',
			i18n('Alumno por seccion', 'Student section enrollment'),
			i18n('Carga de alumnos por seccion', 'Student section enrollment upload'),
			'{}',
		],
		[
			'TG1102',
			'TG1102-T001',
			i18n('Completado', 'Completed'),
			i18n('Carga completada', 'Upload completed'),
			'{}',
		],
		[
			'TG1102',
			'TG1102-T002',
			i18n('Revertido', 'Rollback'),
			i18n('Carga revertida', 'Upload rolled back'),
			'{}',
		],
	];

	const typeValues = typeRows
		.map(
			([group, code, name, description, extra]) =>
				`('${group}', '${code}', '${name}'::jsonb, '${description}'::jsonb, '${extra}'::jsonb)`,
		)
		.join(',\n\t\t\t');

	await tenantDataSource.query(`
		INSERT INTO "core"."types" (type_group_id, code, name, description, extra, is_active)
		SELECT tg.id, v.code, v.name, v.description, v.extra, true
		FROM "core"."type_groups" tg
		JOIN (
			VALUES
				${typeValues}
		) AS v(group_code, code, name, description, extra)
			ON tg.code = v.group_code
		WHERE NOT EXISTS (
			SELECT 1 FROM "core"."types" t WHERE t.code = v.code
		);
	`);

	// Patch the `color` field into `extra` for IFC statuses (TG701) and criticality (TG801)
	// even if the type rows already existed before this seed ran. Idempotent: merging the
	// same patch is a no-op. Uses jsonb concatenation (`||`) which overwrites matching keys.
	const colorPatches: Array<[string, string]> = [
		['TG701-T001', '{"color":"#3b82f6"}'],
		['TG701-T002', '{"color":"#d97706"}'],
		['TG701-T003', '{"color":"#16a34a"}'],
		['TG701-T004', '{"color":"#ef4444"}'],
		['TG701-T005', '{"color":"#6b7280"}'],
		['TG801-T001', '{"color":"#dc2626"}'],
		['TG801-T002', '{"color":"#f97316"}'],
		['TG801-T003', '{"color":"#64748b"}'],
		['TG1003-T001', '{"color":"#71717A"}'],
		['TG1003-T002', '{"color":"#10B981"}'],
	];
	const colorPatchValues = colorPatches
		.map(([code, patch]) => `('${code}', '${patch}'::jsonb)`)
		.join(',\n\t\t\t');

	await tenantDataSource.query(`
		UPDATE "core"."types" t
		SET extra = COALESCE(t.extra, '{}'::jsonb) || v.patch
		FROM (
			VALUES
				${colorPatchValues}
		) AS v(code, patch)
		WHERE t.code = v.code;
	`);
});
