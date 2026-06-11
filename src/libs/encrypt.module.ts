import { Global, Module } from '@nestjs/common';
import { EncryptService } from './encrypt.service';

@Global()
@Module({
	providers: [EncryptService],
	exports: [EncryptService],
})
export class EncryptModule {}
