import { ArrayNotEmpty, IsArray, IsOptional, IsString } from 'class-validator';

// Period comes from the X-Academic-Period-Id header, not the body. These are optional
// overrides (defaults: nivel UG, and all active course codes for the sections search).
export class RunPlannerScrapeDto {
	@IsOptional()
	@IsString()
	nivel?: string;

	@IsOptional()
	@IsArray()
	@ArrayNotEmpty()
	@IsString({ each: true })
	cursos?: string[];
}
