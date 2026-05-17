export const IFCS_PARAMETER_KEYS = {
	FINDING_PREFIX: 'PARAMETER_FINDING_PREFIX',
	ACTION_PREFIX: 'PARAMETER_ACTION_PREFIX',
} as const;

export const IFC_INSTRUMENT_CODE = 'INST_IFC';

export const IFC_OPS = {
	CREATE: 'create',
	PATCH: 'patch',
	SUBMIT: 'submit',
	APPROVE: 'approve',
	REJECT: 'reject',
} as const;

export type IfcOp = (typeof IFC_OPS)[keyof typeof IFC_OPS];
