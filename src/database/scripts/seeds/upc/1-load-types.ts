import { runTenantSeed, i18n } from '../seed-runner';

runTenantSeed('core type catalogs', async (tenantDataSource) => {
	const typeGroupRows: Array<[string, string, string]> = [
		['TG101', i18n('Tipo de documento', 'Document type'), i18n('Documentos y valores base para usuarios', 'Documents and base values for users')],
		['TG102', i18n('Modalidad de programa', 'Program modality'), i18n('Modalidades del programa academico (Regular, EPE)', 'Academic program modalities (Regular, EPE)')],
		['TG103', i18n('Modalidad de ensenanza', 'Teaching modality'), i18n('Modalidades academicas generales', 'General academic modalities')],
		['TG202', i18n('Modalidad de graduacion', 'Graduation modality'), i18n('Modalidades de egreso del estudiante', 'Student graduation modalities')],
		['TG203', i18n('Nivel academico', 'Academic level'), i18n('Niveles de cursos en el plan de estudios', 'Course levels in the study plan')],
		['TG204', i18n('Modalidad de seccion', 'Section modality'), i18n('Modalidades para secciones academicas', 'Modalities for academic sections')],
		['TG205', i18n('Tipo de nota', 'Grade type'), i18n('Tipos de evaluacion calificada', 'Types of graded evaluation')],
		['TG206', i18n('Tipo de instrumento de desempeno', 'Performance instrument type'), i18n('Tipos para niveles de desempeno', 'Types for performance levels')],
		['TG301', i18n('Tipo de comision', 'Commission type'), i18n('Tipos de comision de acreditacion', 'Accreditation commission types')],
		['TG302', i18n('Tipo de resultado', 'Outcome type'), i18n('Tipos de resultados de aprendizaje', 'Learning outcome types')],
		['TG401', i18n('Tipo de rubrica', 'Rubric type'), i18n('Tipos de rubricas de evaluacion', 'Evaluation rubric types')],
		['TG402', i18n('Tipo de segmento', 'Segment type'), i18n('Segmentos para rubricas', 'Rubric segments')],
		['TG403', i18n('Tipo de evaluador', 'Evaluator type'), i18n('Roles de evaluadores y participantes', 'Roles of evaluators and participants')],
		['TG404', i18n('Estado de calificacion', 'Grade status'), i18n('Estados de evaluaciones calificadas', 'States of graded evaluations')],
		['TG501', i18n('Tipo constituyente', 'Constituent type'), i18n('Tipos de instrumentos de evidencia', 'Evidence instrument types')],
		['TG601', i18n('Tipo de encuesta', 'Survey type'), i18n('Tipos de encuestas', 'Survey types')],
		['TG602', i18n('Estado de encuesta', 'Survey status'), i18n('Estados de encuestas', 'Survey states')],
		['TG701', i18n('Estado IFC', 'IFC status'), i18n('Estados de indicadores IFC', 'IFC indicator states')],
		['TG801', i18n('Criticidad de hallazgo', 'Finding criticality'), i18n('Niveles de criticidad', 'Criticality levels')],
		['TG901', i18n('Cargo del personal', 'Staff position'), i18n('Tipos de cargos administrativos y docentes', 'Administrative and teaching position types')],
		['TG902', i18n('Nivel de organigrama', 'Org chart level'), i18n('Niveles de estructura organizacional', 'Organizational structure levels')],
		['TG903', i18n('Tipo de entidad organizacional', 'Organizational entity type'), i18n('Tipos de entidades en organigrama', 'Entity types in the org chart')],
		['TG1001', i18n('Estado de notificacion', 'Notification status'), i18n('Estados de notificaciones', 'Notification states')],
		['TG1002', i18n('Disparador de notificacion', 'Notification trigger'), i18n('Cuando se dispara una notificacion', 'When a notification is triggered')],
		['TG1003', i18n('Completitud de accion', 'Action completeness'), i18n('Estado derivado de la accion (Pendiente/Implementada)', 'Derived action state (Pending/Implemented)')],
	];

	const typeGroupValues = typeGroupRows.map(([code, name, description]) => `('${code}', '${name}'::jsonb, '${description}'::jsonb)`).join(',\n\t\t\t');

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
		['TG101', 'TG101-T001', i18n('DNI', 'National ID'), i18n('Documento Nacional de Identidad', 'National Identity Document'), '{}'],
		['TG101', 'TG101-T002', i18n('Pasaporte', 'Passport'), i18n('Pasaporte internacional', 'International passport'), '{}'],
		['TG101', 'TG101-T003', i18n('Carne de extranjeria', 'Foreigner card'), i18n('Carne de extranjeria', 'Foreigner residence card'), '{}'],
		['TG102', 'TG102-T001', i18n('Regular', 'Regular'), i18n('Programa en modalidad regular', 'Regular program modality'), '{}'],
		['TG102', 'TG102-T002', i18n('EPE', 'EPE'), i18n('Programa para Personas con Experiencia Laboral', 'Program for People with Work Experience'), '{}'],
		['TG103', 'TG103-T001', i18n('Presencial', 'In-person'), i18n('Educacion presencial', 'In-person education'), '{"mode":"in-person"}'],
		['TG103', 'TG103-T002', i18n('Virtual', 'Virtual'), i18n('Educacion virtual', 'Online education'), '{"mode":"online"}'],
		['TG103', 'TG103-T003', i18n('Hibrida', 'Hybrid'), i18n('Educacion hibrida', 'Hybrid education'), '{"mode":"hybrid"}'],
		['TG202', 'TG202-T001', i18n('Tesis', 'Thesis'), i18n('Graduacion por tesis', 'Graduation by thesis'), '{}'],
		['TG202', 'TG202-T002', i18n('Proyecto profesional', 'Professional project'), i18n('Graduacion por proyecto profesional', 'Graduation by professional project'), '{}'],
		['TG203', 'TG203-T001', i18n('Primer ciclo', 'First cycle'), i18n('Curso de primer ciclo', 'First-cycle course'), '{"level":1}'],
		['TG203', 'TG203-T002', i18n('Segundo ciclo', 'Second cycle'), i18n('Curso de segundo ciclo', 'Second-cycle course'), '{"level":2}'],
		['TG203', 'TG203-T003', i18n('Tercer ciclo', 'Third cycle'), i18n('Curso de tercer ciclo', 'Third-cycle course'), '{"level":3}'],
		['TG204', 'TG204-T001', i18n('Seccion presencial', 'In-person section'), i18n('Seccion dictada presencialmente', 'Section delivered in person'), '{}'],
		['TG204', 'TG204-T002', i18n('Seccion virtual', 'Virtual section'), i18n('Seccion dictada virtualmente', 'Section delivered online'), '{}'],
		['TG205', 'TG205-T001', i18n('EA', 'EA'), i18n('Evaluacion Parcial', 'Midterm evaluation'), '{"weight":0.1}'],
		['TG205', 'TG205-T002', i18n('EB', 'EB'), i18n('Evaluacion Final', 'Final evaluation'), '{"weight":0.1}'],
		['TG205', 'TG205-T003', i18n('PA', 'PA'), i18n('Proyecto Academico', 'Academic project'), '{"weight":0.1}'],
		['TG205', 'TG205-T004', i18n('TA', 'TA'), i18n('Tarea Academica', 'Academic homework'), '{"weight":1}'],
		['TG205', 'TG205-T005', i18n('TP', 'TP'), i18n('Trabajo Parcial', 'Midterm assignment'), '{"weight":0.1}'],
		['TG205', 'TG205-T006', i18n('TF', 'TF'), i18n('Trabajo Final', 'Final assignment'), '{"weight":0.1}'],
		['TG206', 'TG206-T001', i18n('Rubrica', 'Rubric'), i18n('Instrumento tipo rubrica', 'Rubric-type instrument'), '{}'],
		['TG301', 'TG301-T001', i18n('Comision de programa', 'Program commission'), i18n('Comision de acreditacion de programa', 'Program accreditation commission'), '{}'],
		['TG302', 'TG302-T001', i18n('Outcome ABET', 'ABET outcome'), i18n('Resultado de aprendizaje acreditable', 'Accreditable learning outcome'), '{}'],
		['TG401', 'TG401-T001', i18n('Rubrica Capstone', 'Capstone rubric'), i18n('Rubrica basada en outcomes (proyecto integrador)', 'Outcome-based rubric (capstone project)'), '{}'],
		['TG401', 'TG401-T002', i18n('Rubrica No Capstone', 'Non-Capstone rubric'), i18n('Rubrica por curso sin requerimiento de outcomes', 'Per-course rubric without outcome requirement'), '{}'],
		['TG402', 'TG402-T001', i18n('Producto', 'Product'), i18n('Segmento producto final', 'Final-product segment'), '{}'],
		['TG402', 'TG402-T002', i18n('Proceso', 'Process'), i18n('Segmento proceso de trabajo', 'Work-process segment'), '{}'],
		['TG403', 'TG403-T001', i18n('COM', 'COM'), i18n('Comite - promedia notas de todos los evaluadores COM', 'Committee - averages scores from all COM evaluators'), '{}'],
		['TG403', 'TG403-T002', i18n('GER', 'GER'), i18n('Gerente - escribe directo sin promediar (WASC/PA)', 'Manager - writes directly without averaging (WASC/PA)'), '{}'],
		['TG403', 'TG403-T003', i18n('DOC', 'DOC'), i18n('Docente - escribe directo', 'Professor - writes directly'), '{}'],
		['TG403', 'TG403-T004', i18n('CLI', 'CLI'), i18n('Cliente - escribe directo', 'Client - writes directly'), '{}'],
		['TG403', 'TG403-T005', i18n('COA', 'COA'), i18n('Coautor - escribe directo', 'Co-author - writes directly'), '{}'],
		[
			'TG404',
			'TG404-T001',
			i18n('ASISTIO', 'ATTENDED'),
			i18n('Asistio y Calificado - El evaluador asistio y califico al alumno', 'Attended and graded - the evaluator attended and graded the student'),
			'{}',
		],
		['TG404', 'TG404-T002', i18n('NR', 'NR'), i18n('No Registrado - Calificacion no registrada o observacion vacia', 'Not registered - score not recorded or observation empty'), '{}'],
		['TG404', 'TG404-T003', i18n('NA', 'DNA'), i18n('No Asistio - El evaluador no asistio a la evaluacion', 'Did not attend - the evaluator did not attend the evaluation'), '{}'],
		['TG501', 'TG501-T001', i18n('Examen', 'Exam'), i18n('Instrumento de examen', 'Exam instrument'), '{}'],
		['TG501', 'TG501-T002', i18n('Proyecto', 'Project'), i18n('Instrumento de proyecto', 'Project instrument'), '{}'],
		['TG501', 'TG501-T003', i18n('Encuesta', 'Survey'), i18n('Instrumento de encuesta', 'Survey instrument'), '{}'],
		['TG601', 'TG601-T001', i18n('Satisfaccion estudiantil', 'Student satisfaction'), i18n('Encuesta a estudiantes', 'Student survey'), '{}'],
		['TG601', 'TG601-T002', i18n('Egresados', 'Graduates'), i18n('Encuesta a egresados', 'Graduate survey'), '{}'],
		[
			'TG601',
			'TG601-T003',
			i18n('Practicas Pre-Profesionales', 'Pre-Professional Internships'),
			i18n('Encuesta PPP a estudiantes en practicas', 'PPP survey for students in internships'),
			'{"code":"PPP"}',
		],
		['TG601', 'TG601-T004', i18n('Logro de Fin de Ciclo', 'End-of-Cycle Achievement'), i18n('Encuesta LCFC por curso y ciclo', 'LCFC survey per course and cycle'), '{"code":"LCFC"}'],
		['TG602', 'TG602-T001', i18n('Activa', 'Active'), i18n('Encuesta activa', 'Active survey'), '{}'],
		['TG602', 'TG602-T002', i18n('Cerrada', 'Closed'), i18n('Encuesta cerrada', 'Closed survey'), '{}'],
		['TG701', 'TG701-T001', i18n('Guardado', 'Saved'), i18n('IFC guardado', 'IFC saved'), '{"color":"#3b82f6"}'],
		['TG701', 'TG701-T002', i18n('Enviado', 'Submitted'), i18n('IFC enviado a revision', 'IFC submitted for review'), '{"color":"#d97706"}'],
		['TG701', 'TG701-T003', i18n('Aprobado', 'Approved'), i18n('IFC aprobado', 'IFC approved'), '{"color":"#16a34a"}'],
		['TG701', 'TG701-T004', i18n('Observado', 'Observed'), i18n('IFC observado', 'IFC observed'), '{"color":"#ef4444"}'],
		['TG701', 'TG701-T005', i18n('Sin Registrar', 'Unregistered'), i18n('IFC sin registrar (derivado)', 'Unregistered IFC (derived)'), '{"color":"#6b7280"}'],
		['TG801', 'TG801-T001', i18n('Critico', 'Critical'), i18n('Criticidad alta', 'High criticality'), '{"order":1,"color":"#dc2626"}'],
		['TG801', 'TG801-T002', i18n('Preocupante', 'Worrying'), i18n('Criticidad media', 'Medium criticality'), '{"order":2,"color":"#f97316"}'],
		['TG801', 'TG801-T003', i18n('Normal', 'Normal'), i18n('Criticidad baja', 'Low criticality'), '{"order":3,"color":"#64748b"}'],
		['TG901', 'TG901-T001', i18n('Administrador', 'Administrator'), i18n('Administrador del sistema', 'System administrator'), '{}'],
		['TG901', 'TG901-T002', i18n('Coordinador de calidad', 'Quality coordinator'), i18n('Coordinador de calidad academica', 'Academic quality coordinator'), '{}'],
		['TG901', 'TG901-T003', i18n('Profesor', 'Professor'), i18n('Docente del programa', 'Program professor'), '{}'],
		['TG902', 'TG902-T001', i18n('Decanato', "Dean's Office"), i18n('Nivel decano', 'Dean level'), '{"level":1}'],
		['TG902', 'TG902-T002', i18n('Director de Escuela', 'School Director'), i18n('Nivel director de escuela', 'School Director level'), '{"level":2}'],
		['TG902', 'TG902-T003', i18n('Coordinador de Carrera', 'Program Coordinator'), i18n('Nivel coordinador de carrera', 'Program Coordinator level'), '{"level":3}'],
		['TG902', 'TG902-T004', i18n('Coordinador de Area', 'Area Coordinator'), i18n('Nivel coordinador de area', 'Area Coordinator level'), '{"level":4}'],
		['TG902', 'TG902-T005', i18n('Coordinador de Subarea', 'Subarea Coordinator'), i18n('Nivel coordinador de subarea', 'Subarea Coordinator level'), '{"level":5}'],
		['TG902', 'TG902-T006', i18n('Coordinador de Curso', 'Course Coordinator'), i18n('Nivel coordinador de curso', 'Course Coordinator level'), '{"level":6}'],
		['TG903', 'TG903-T001', i18n('Escuela', 'School'), i18n('Escuela / Facultad', 'School / Faculty'), '{}'],
		['TG903', 'TG903-T002', i18n('Carrera', 'Program'), i18n('Programa / Carrera', 'Program'), '{}'],
		['TG903', 'TG903-T003', i18n('Curso', 'Course'), i18n('Curso', 'Course'), '{}'],
		['TG1001', 'TG1001-T001', i18n('Programada', 'Scheduled'), i18n('Notificacion programada', 'Scheduled notification'), '{}'],
		['TG1001', 'TG1001-T002', i18n('Enviada', 'Sent'), i18n('Notificacion enviada', 'Sent notification'), '{}'],
		['TG1002', 'TG1002-T001', i18n('Manual', 'Manual'), i18n('Notificacion enviada manualmente', 'Notification sent manually'), '{}'],
		['TG1002', 'TG1002-T002', i18n('Auto al cambiar estado', 'Auto on status change'), i18n('Notificacion automatica por cambio de estado', 'Automatic notification on status change'), '{}'],
		['TG1003', 'TG1003-T001', i18n('Pendiente', 'Pending'), i18n('Accion sin evidencias', 'Action without evidence'), '{"color":"#71717A"}'],
		['TG1003', 'TG1003-T002', i18n('Implementada', 'Implemented'), i18n('Accion con evidencias', 'Action with evidence'), '{"color":"#10B981"}'],
	];

	const typeValues = typeRows.map(([group, code, name, description, extra]) => `('${group}', '${code}', '${name}'::jsonb, '${description}'::jsonb, '${extra}'::jsonb)`).join(',\n\t\t\t');

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
	const colorPatchValues = colorPatches.map(([code, patch]) => `('${code}', '${patch}'::jsonb)`).join(',\n\t\t\t');

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
