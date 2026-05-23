import { IsArray, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { BaseDto } from 'src/commons/base.dtos';

export class S3UploadResponseDto {
	key: string;
	url?: string;
	bucket?: string;
	message: string;
}

export class S3SizeTotalRequestDto extends BaseDto {
	@IsArray()
	@IsString({ each: true })
	@ApiProperty({ type: [String], example: ['portfolios/proj-1/', 'portfolios/proj-2/'] })
	prefixes: string[];
}

export class S3SizeTotalResponseDto {
	totalSizeInBytes: number;
	totalSizeInMB: number;
	isLargerThan1GB: boolean;
}
