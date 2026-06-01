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

const EVIDENCE_MODULE = 'EVIDENCE';

@SwaggerEvaluationController()
export class EvaluationController extends BaseController<EvaluationService> {
	constructor(
		private readonly service: EvaluationService,
		private readonly submissionService: EvaluationSubmissionService,
	) {
		super(service);
	}

	@Post('submit')
	@RequirePermission({ module: EVIDENCE_MODULE, action: 'POST' })
	async submitEvaluation(@Body() dto: SubmitEvaluationDto) {
		return parseSuccessResponse(await this.submissionService.submitEvaluation(dto));
	}

	@Patch('observation')
	@RequirePermission({ module: EVIDENCE_MODULE, action: 'PATCH' })
	async saveObservation(@Body() dto: SaveObservationDto) {
		return parseSuccessResponse(await this.submissionService.saveObservation(dto));
	}

	@Post('finalize')
	@RequirePermission({ module: EVIDENCE_MODULE, action: 'POST' })
	async finalizeProject(@Body() dto: FinalizeProjectDto) {
		return parseSuccessResponse(await this.submissionService.finalizeProject(dto));
	}

	@Get('student/:studentId')
	@RequirePermission({ module: EVIDENCE_MODULE, action: 'GET' })
	async getStudentEvaluations(@Param('studentId', ParseIntPipe) studentId: number) {
		return parseSuccessResponse(await this.submissionService.getStudentEvaluations(studentId));
	}

	@Get('evaluator/:evaluatorId')
	@RequirePermission({ module: EVIDENCE_MODULE, action: 'GET' })
	async getEvaluatorEvaluations(@Param('evaluatorId', ParseIntPipe) evaluatorId: number) {
		return parseSuccessResponse(await this.submissionService.getEvaluatorEvaluations(evaluatorId));
	}

	@Get('evaluation/:evaluationId')
	@RequirePermission({ module: EVIDENCE_MODULE, action: 'GET' })
	async getEvaluationWithScores(@Param('evaluationId', ParseIntPipe) evaluationId: number) {
		return parseSuccessResponse(await this.submissionService.getEvaluationById(evaluationId));
	}

	// TODO: Agregar GET project/:projectId/report
	// Exportar el resultado del proyecto (Cruza outcomes, rúbricas y promedios) y cruce con performance_levels.

	@SwaggerEvaluationCreate()
	@RequirePermission({ module: EVIDENCE_MODULE, action: 'POST' })
	async create(@Body() dto: CreateEvaluationDto) {
		return await super.create(dto);
	}

	@SwaggerEvaluationUpdate()
	@RequirePermission({ module: EVIDENCE_MODULE, action: 'PATCH' })
	async update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateEvaluationDto) {
		return await super.update(id, dto);
	}

	@SwaggerEvaluationDelete()
	@RequirePermission({ module: EVIDENCE_MODULE, action: 'DELETE' })
	async delete(@Param('id', ParseIntPipe) id: number) {
		return await super.delete(id);
	}

	@SwaggerEvaluationGetAll()
	@RequirePermission({ module: EVIDENCE_MODULE, action: 'GET' })
	async getAll() {
		return await super.getAll();
	}

	@SwaggerEvaluationGetById()
	@RequirePermission({ module: EVIDENCE_MODULE, action: 'GET' })
	async getById(@Param('id', ParseIntPipe) id: number) {
		return await super.getById(id);
	}

	@SwaggerEvaluationGetByFilters()
	@RequirePermission({ module: EVIDENCE_MODULE, action: 'POST' })
	async getByFilters(@Body() dto: FilterEvaluationDto) {
		return await super.getByFilters(dto);
	}
}
