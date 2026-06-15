import { ArrayNotEmpty, IsArray, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class RunScrapeDto {
	@IsString()
	@IsNotEmpty()
	periodo: string;

	@IsOptional()
	@IsString()
	nivel?: string;

	@IsOptional()
	@IsArray()
	@ArrayNotEmpty()
	@IsString({ each: true })
	departamentos?: string[];
}
