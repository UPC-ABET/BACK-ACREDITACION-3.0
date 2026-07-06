import { Body, Param, Post, Get, ParseIntPipe, Patch } from '@nestjs/common';
import { BaseController } from 'src/commons/base.controller';
import {
	SwaggerEvaluationController,
	SwaggerEvaluationCreate,
	SwaggerEvaluationUpdate,
	SwaggerEvaluationDelete,
	SwaggerEvaluationGetAll,
	SwaggerEvaluationGetById,
	SwaggerEvaluationGetByFilters,
} from './docs/evaluations.swagger';
import { EvaluationService } from './evaluations.service';
import { EvaluationSubmissionService } from './evaluation-submission.service';
import {
	CreateEvaluationDto,
	UpdateEvaluationDto,
	FilterEvaluationDto,
	SubmitEvaluationDto,
	SaveObservationDto,
	FinalizeProjectDto,
} from '../model/evaluations.dtos';
import { parseSuccessResponse } from 'src/libs/global.functions';
import { RequirePermission } from 'src/modules/auth/protocols/jwt/decorators/require-permission.decorator';
import { PERMISSION_ACTIONS, PERMISSION_MODULES } from 'src/shared/constants/permission-modules';

@SwaggerEvaluationController()
export class EvaluationController extends BaseController<EvaluationService> {
	constructor(
		private readonly service: EvaluationService,
		private readonly submissionService: EvaluationSubmissionService,
	) {
		super(service);
	}

	@Post('submit')
	@RequirePermission({ module: PERMISSION_MODULES.EVIDENCE, action: PERMISSION_ACTIONS.POST })
	async submitEvaluation(@Body() dto: SubmitEvaluationDto) {
		return parseSuccessResponse(await this.submissionService.submitEvaluation(dto));
	}

	@Patch('observation')
	@RequirePermission({ module: PERMISSION_MODULES.EVIDENCE, action: PERMISSION_ACTIONS.PATCH })
	async saveObservation(@Body() dto: SaveObservationDto) {
		return parseSuccessResponse(await this.submissionService.saveObservation(dto));
	}

	@Post('finalize')
	@RequirePermission({ module: PERMISSION_MODULES.EVIDENCE, action: PERMISSION_ACTIONS.POST })
	async finalizeProject(@Body() dto: FinalizeProjectDto) {
		return parseSuccessResponse(await this.submissionService.finalizeProject(dto));
	}

	@Get('student/:studentId')
	@RequirePermission({ module: PERMISSION_MODULES.EVIDENCE, action: PERMISSION_ACTIONS.GET })
	async getStudentEvaluations(@Param('studentId', ParseIntPipe) studentId: number) {
		return parseSuccessResponse(await this.submissionService.getStudentEvaluations(studentId));
	}

	@Get('evaluator/:evaluatorId')
	@RequirePermission({ module: PERMISSION_MODULES.EVIDENCE, action: PERMISSION_ACTIONS.GET })
	async getEvaluatorEvaluations(@Param('evaluatorId', ParseIntPipe) evaluatorId: number) {
		return parseSuccessResponse(await this.submissionService.getEvaluatorEvaluations(evaluatorId));
	}

	@Get('evaluation/:evaluationId')
	@RequirePermission({ module: PERMISSION_MODULES.EVIDENCE, action: PERMISSION_ACTIONS.GET })
	async getEvaluationWithScores(@Param('evaluationId', ParseIntPipe) evaluationId: number) {
		return parseSuccessResponse(await this.submissionService.getEvaluationById(evaluationId));
	}

	// TODO: Add GET project/:projectId/report
	// Export project results (cross outcomes, rubrics and averages) and cross with performance_levels.

	@SwaggerEvaluationCreate()
	@RequirePermission({ module: PERMISSION_MODULES.EVIDENCE, action: PERMISSION_ACTIONS.POST })
	async create(@Body() dto: CreateEvaluationDto) {
		return await super.create(dto);
	}

	@SwaggerEvaluationUpdate()
	@RequirePermission({ module: PERMISSION_MODULES.EVIDENCE, action: PERMISSION_ACTIONS.PATCH })
	async update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateEvaluationDto) {
		return await super.update(id, dto);
	}

	@SwaggerEvaluationDelete()
	@RequirePermission({ module: PERMISSION_MODULES.EVIDENCE, action: PERMISSION_ACTIONS.DELETE })
	async delete(@Param('id', ParseIntPipe) id: number) {
		return await super.delete(id);
	}

	@SwaggerEvaluationGetAll()
	@RequirePermission({ module: PERMISSION_MODULES.EVIDENCE, action: PERMISSION_ACTIONS.GET })
	async getAll() {
		return await super.getAll();
	}

	@SwaggerEvaluationGetById()
	@RequirePermission({ module: PERMISSION_MODULES.EVIDENCE, action: PERMISSION_ACTIONS.GET })
	async getById(@Param('id', ParseIntPipe) id: number) {
		return await super.getById(id);
	}

	@SwaggerEvaluationGetByFilters()
	@RequirePermission({ module: PERMISSION_MODULES.EVIDENCE, action: PERMISSION_ACTIONS.POST })
	async getByFilters(@Body() dto: FilterEvaluationDto) {
		return await super.getByFilters(dto);
	}
}
