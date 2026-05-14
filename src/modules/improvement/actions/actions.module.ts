import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ActionEntity } from './model/actions.entity';
import { ActionRepository } from './core/actions.repository';
import { ActionService } from './api/actions.service';
import { ActionController } from './api/actions.controller';

@Module({
	imports: [TypeOrmModule.forFeature([ActionEntity])],
	controllers: [ActionController],
	providers: [ActionService, ActionRepository],
	exports: [ActionService, ActionRepository],
})
export class ActionModule {}
