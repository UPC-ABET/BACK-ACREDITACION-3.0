import { Module } from '@nestjs/common';
import { S3Controller } from './api/s3.controller';
import { S3Service } from './api/s3.service';

@Module({
	controllers: [S3Controller],
	providers: [S3Service],
	exports: [S3Service],
})
export class S3Module {}
