import { TYPE_CODES } from 'src/modules/core/types/constants/type-codes';

export function programInSchoolSubquery(programColumn: string): string {
	return `${programColumn} IN (
		SELECT ch_prog.entity_code
		FROM   organization.charts ch_prog
		INNER JOIN organization.charts ch_sch
		       ON  ch_sch.id = ch_prog.root_chart_id
		WHERE  ch_prog.entity_type_id = (SELECT id FROM core.types WHERE code = :programTypeCode)
		  AND  ch_sch.entity_type_id  = (SELECT id FROM core.types WHERE code = :schoolTypeCode)
		  AND  ch_sch.entity_code = :schoolId
	)`;
}

export function schoolProgramFilterParams(schoolId: number): {
	programTypeCode: string;
	schoolTypeCode: string;
	schoolId: number;
} {
	return {
		programTypeCode: TYPE_CODES.ENTITY_TYPE.PROGRAM,
		schoolTypeCode: TYPE_CODES.ENTITY_TYPE.SCHOOL,
		schoolId,
	};
}
