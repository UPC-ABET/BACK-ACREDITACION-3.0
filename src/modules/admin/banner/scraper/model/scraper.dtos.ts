import { ArrayNotEmpty, IsArray, IsOptional, IsString } from 'class-validator';

// Period comes from the X-Academic-Period-Id header, not the body. These are
// optional overrides (defaults: UG, and all active programs' departments).
export class RunScrapeDto {
	@IsOptional()
	@IsString()
	nivel?: string;

	@IsOptional()
	@IsArray()
	@ArrayNotEmpty()
	@IsString({ each: true })
	departamentos?: string[];
}
