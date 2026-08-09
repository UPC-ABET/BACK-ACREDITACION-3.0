import { ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayNotEmpty, IsArray, IsOptional, IsString } from 'class-validator';

// Period comes from the X-Academic-Period-Id header, not the body. These are optional
// overrides (defaults: nivel UG, and all active course codes for the sections search).
export class RunPlannerScrapeDto {
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
		example: ['CS101', 'CS102'],
		description: 'Course codes to scrape. Defaults to every active course code.',
	})
	cursos?: string[];
}
