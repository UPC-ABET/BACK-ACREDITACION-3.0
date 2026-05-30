import { IsString, IsDateString, Matches, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

// Valid MODALITY_TYPE codes for Phase 0 (manifest / blueprint §3.1 SubModalidadPeriodoAcademico).
// REGULAR = Regular undergraduate (legacy id=1), EPE = Studies for Professionals with Experience (legacy id=2).
export const PERIOD_MODALITY_CODES = ['REGULAR', 'EPE'] as const;
export type PeriodModalityCode = (typeof PERIOD_MODALITY_CODES)[number];

// Default status when opening a period (replica of legacy PeriodoAcademico.Estado = 'ACT' §3.1).
export const PERIOD_STATUS_ACTIVE = 'ACT';
export const PERIOD_STATUS_INACTIVE = 'INA';

// Body of POST /configuration/periods. Replica of the "New Cycle" modal (blueprint §4.1 Bridge Canvas).
export class CreatePeriodDto {
	// Format YYYY-01 (first semester), YYYY-02 (second), YYYY-00 (intensive) — blueprint mask.
	@IsString()
	@Matches(/^\d{4}-(01|02|00)$/, { message: 'code debe tener formato YYYY-01 | YYYY-02 | YYYY-00' })
	@MaxLength(50)
	@ApiProperty({ example: '2026-01', required: true, description: 'Academic cycle code (format YYYY-01/02/00)' })
	code: string;

	@IsDateString()
	@ApiProperty({ example: '2026-03-15', required: true, description: 'Cycle start date (ISO 8601)' })
	start_date: string;

	@IsDateString()
	@ApiProperty({ example: '2026-07-15', required: true, description: 'Cycle end date. Must be ≥ start_date (validated in service).' })
	end_date: string;

	// REGULAR | EPE. Used to resolve core.types/MODALITY_TYPE.id.
	@IsString()
	@ApiProperty({ example: 'REGULAR', enum: PERIOD_MODALITY_CODES, required: true, description: 'Study modality (REGULAR = Regular undergraduate, EPE = Studies for Professionals with Experience)' })
	modality_code: PeriodModalityCode;
}

// Serialized response — same shape for create / list / find.
export interface PeriodResponse {
	id: number;
	code: string;
	start_date: string;
	end_date: string;
	modality_type_id: number;
	status: string;
}
