import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ArdEntity, ArdDetailEntity } from './model/ards.entity';
import { ArdController } from './api/ards.controller';
import { ArdService } from './api/ards.service';
import { ArdRepository } from './core/ards.repository';

@Module({
	imports: [TypeOrmModule.forFeature([ArdEntity, ArdDetailEntity])],
	controllers: [ArdController],
	providers: [ArdService, ArdRepository],
	exports: [ArdService, ArdRepository],
})
export class ArdModule {}
