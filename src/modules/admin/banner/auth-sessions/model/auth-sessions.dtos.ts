import { IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * Both optional: the streamed VNC login already works with no credentials at all (AC of the
 * original feature). These only pre-fill Microsoft's email/password fields on the remote page —
 * never persisted, never logged, forwarded once to the browser-auth controller and discarded.
 */
export class StartAuthSessionDto {
	@IsOptional()
	@IsString()
	@ApiProperty({ example: 'usuario@upc.edu.pe', required: false })
	username?: string;

	@IsOptional()
	@IsString()
	@ApiProperty({ required: false })
	password?: string;
}
