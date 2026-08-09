import { ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayNotEmpty, IsArray, IsOptional, IsString } from 'class-validator';

// Period comes from the X-Academic-Period-Id header, not the body. These are
// optional overrides (defaults: UG, and all active programs' departments).
export class RunScrapeDto {
	@IsOptional()
	@IsString()
	@ApiPropertyOptional({ example: 'UG', description: 'Academic level. Defaults to UG.' })
	nivel?: string;

	@IsOptional()
	@IsArray()
	@ArrayNotEmpty()
	@IsString({ each: true })
	@ApiPropertyOptional({
		type: [String],
		example: ['IN', 'SI'],
		description: "Department codes to scrape. Defaults to every active program's departments.",
	})
	departamentos?: string[];
}
