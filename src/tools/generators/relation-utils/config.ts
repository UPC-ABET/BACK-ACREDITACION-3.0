export const ENTITY_CONFIG: Record<
	string,
	{
		entity: string;
		path: string;
		singular: string;
		plural: string;
	}
> = {
	verificationNote: {
		entity: 'VerificationNoteEntity',
		path: 'grades/verification-notes',
		singular: 'verificationNote',
		plural: 'verificationNotes',
	},

	user: {
		entity: 'UserEntity',
		path: 'organization/users',
		singular: 'user',
		plural: 'users',
	},

	staff: {
		entity: 'StaffEntity',
		path: 'organization/staff',
		singular: 'staff',
		plural: 'staffs',
	},

	campus: {
		entity: 'CampusEntity',
		path: 'organization/campuses',
		singular: 'campus',
		plural: 'campuses',
	},

	accreditor: {
		entity: 'AccreditorEntity',
		path: 'accreditation/accreditors',
		singular: 'accreditor',
		plural: 'accreditors',
	},

	academicPeriod: {
		entity: 'AcademicPeriodEntity',
		path: 'academic/academic-periods',
		singular: 'academicPeriod',
		plural: 'academicPeriods',
	},

	program: {
		entity: 'ProgramEntity',
		path: 'academic/programs',
		singular: 'program',
		plural: 'programs',
	},

	course: {
		entity: 'CourseEntity',
		path: 'academic/courses',
		singular: 'course',
		plural: 'courses',
	},

	chart: {
		entity: 'ChartEntity',
		path: 'organization/charts',
		singular: 'chart',
		plural: 'charts',
	},

	commission: {
		entity: 'CommissionEntity',
		path: 'accreditation/commissions',
		singular: 'commission',
		plural: 'commissions',
	},

	student: {
		entity: 'StudentEntity',
		path: 'academic/students',
		singular: 'student',
		plural: 'students',
	},

	studyPlan: {
		entity: 'StudyPlanEntity',
		path: 'academic/study-plans',
		singular: 'studyPlan',
		plural: 'studyPlans',
	},

	professor: {
		entity: 'ProfessorEntity',
		path: 'academic/professors',
		singular: 'professor',
		plural: 'professors',
	},

	programCommission: {
		entity: 'ProgramCommissionEntity',
		path: 'accreditation/program-commissions',
		singular: 'programCommission',
		plural: 'programCommissions',
	},

	studyPlanAcademicPeriod: {
		entity: 'StudyPlanAcademicPeriodEntity',
		path: 'academic/study-plan-academic-periods',
		singular: 'studyPlanAcademicPeriod',
		plural: 'studyPlanAcademicPeriods',
	},

	outcome: {
		entity: 'OutcomeEntity',
		path: 'accreditation/outcomes',
		singular: 'outcome',
		plural: 'outcomes',
	},

	enrolledStudent: {
		entity: 'EnrolledStudentEntity',
		path: 'academic/enrolled-students',
		singular: 'enrolledStudent',
		plural: 'enrolledStudents',
	},

	studyPlanCourse: {
		entity: 'StudyPlanCourseEntity',
		path: 'academic/study-plan-courses',
		singular: 'studyPlanCourse',
		plural: 'studyPlanCourses',
	},

	courseSection: {
		entity: 'CourseSectionEntity',
		path: 'academic/course-sections',
		singular: 'courseSection',
		plural: 'courseSections',
	},

	courseOutcomeMapping: {
		entity: 'CourseOutcomeMappingEntity',
		path: 'academic/course-outcome-mappings',
		singular: 'courseOutcomeMapping',
		plural: 'courseOutcomeMappings',
	},

	studentSectionEnrollment: {
		entity: 'StudentSectionEnrollmentEntity',
		path: 'academic/student-section-enrollments',
		singular: 'studentSectionEnrollment',
		plural: 'studentSectionEnrollments',
	},

	performanceLevel: {
		entity: 'PerformanceLevelEntity',
		path: 'academic/performance-levels',
		singular: 'performanceLevel',
		plural: 'performanceLevels',
	},

	typeGroup: {
		entity: 'TypeGroupEntity',
		path: 'core/type-groups',
		singular: 'typeGroup',
		plural: 'typeGroups',
	},

	type: {
		entity: 'TypeEntity',
		path: 'core/types',
		singular: 'type',
		plural: 'types',
	},

	assessment: {
		entity: 'AssessmentEntity',
		path: 'rubrics/assessments',
		singular: 'assessment',
		plural: 'assessments',
	},

	rubric: {
		entity: 'RubricEntity',
		path: 'evaluation/rubrics',
		singular: 'rubric',
		plural: 'rubrics',
	},

	rubricPerformanceLevel: {
		entity: 'RubricPerformanceLevelEntity',
		path: 'rubrics/rubric-performance-levels',
		singular: 'rubricPerformanceLevel',
		plural: 'rubricPerformanceLevels',
	},

	gradedOutcome: {
		entity: 'GradedOutcomeEntity',
		path: 'rubrics/graded-outcomes',
		singular: 'gradedOutcome',
		plural: 'gradedOutcomes',
	},

	outcomeRubric: {
		entity: 'OutcomeRubricEntity',
		path: 'rubrics/outcome-rubrics',
		singular: 'outcomeRubric',
		plural: 'outcomeRubrics',
	},

	outcomeCriteria: {
		entity: 'OutcomeCriteriaEntity',
		path: 'rubrics/outcome-criterias',
		singular: 'outcomeCriteria',
		plural: 'outcomeCriterias',
	},

	criteriaPerformanceLevel: {
		entity: 'CriteriaPerformanceLevelEntity',
		path: 'rubrics/criteria-performance-levels',
		singular: 'criteriaPerformanceLevel',
		plural: 'criteriaPerformanceLevels',
	},

	gradedCriteria: {
		entity: 'GradedCriteriaEntity',
		path: 'rubrics/graded-criteria',
		singular: 'gradedCriteria',
		plural: 'gradedCriteria',
	},

	faculty: {
		entity: 'FacultyEntity',
		path: 'organization/faculties',
		singular: 'faculty',
		plural: 'faculties',
	},

	school: {
		entity: 'SchoolEntity',
		path: 'organization/schools',
		singular: 'school',
		plural: 'schools',
	},

	project: {
		entity: 'ProjectEntity',
		path: 'evaluation/projects',
		singular: 'project',
		plural: 'projects',
	},

	rubricQuestionCriteria: {
		entity: 'RubricQuestionCriteriaEntity',
		path: 'evaluation/rubric-question-criterias',
		singular: 'rubricQuestionCriteria',
		plural: 'rubricQuestionCriterias',
	},

	instrument: {
		entity: 'InstrumentEntity',
		path: 'evidence/instruments',
		singular: 'instrument',
		plural: 'instruments',
	},

	action: {
		entity: 'ActionEntity',
		path: 'improvement/actions',
		singular: 'action',
		plural: 'actions',
	},

	plan: {
		entity: 'PlanEntity',
		path: 'improvement/plans',
		singular: 'plan',
		plural: 'plans',
	},

	projectEvaluator: {
		entity: 'ProjectEvaluatorEntity',
		path: 'evaluation/project-evaluators',
		singular: 'projectEvaluator',
		plural: 'projectEvaluators',
	},

	ifc: {
		entity: 'IfcEntity',
		path: 'evidence/ifcs',
		singular: 'ifc',
		plural: 'ifcs',
	},

	survey: {
		entity: 'SurveyEntity',
		path: 'evidence/surveys',
		singular: 'survey',
		plural: 'surveys',
	},

	finding: {
		entity: 'FindingEntity',
		path: 'improvement/findings',
		singular: 'finding',
		plural: 'findings',
	},

	rubricQuestion: {
		entity: 'RubricQuestionEntity',
		path: 'evaluation/rubric-questions',
		singular: 'rubricQuestion',
		plural: 'rubricQuestions',
	},

	ifcFinding: {
		entity: 'IfcFindingEntity',
		path: 'ifc/ifc-findings',
		singular: 'ifcFinding',
		plural: 'ifcFindings',
	},

	status: {
		entity: 'StatusEntity',
		path: 'ifc/statuses',
		singular: 'status',
		plural: 'statuses',
	},

	findingAction: {
		entity: 'FindingActionEntity',
		path: 'improvement/finding-actions',
		singular: 'findingAction',
		plural: 'findingActions',
	},

	findingOutcome: {
		entity: 'FindingOutcomeEntity',
		path: 'improvement/finding-outcomes',
		singular: 'findingOutcome',
		plural: 'findingOutcomes',
	},

	studentCourseGrade: {
		entity: 'StudentCourseGradeEntity',
		path: 'academic/student-course-grades',
		singular: 'studentCourseGrade',
		plural: 'studentCourseGrades',
	},

	projectStudent: {
		entity: 'ProjectStudentEntity',
		path: 'evaluation/project-students',
		singular: 'projectStudent',
		plural: 'projectStudents',
	},

	studentCourseOutcomeGrade: {
		entity: 'StudentCourseOutcomeGradeEntity',
		path: 'evidence/student-course-outcome-grades',
		singular: 'studentCourseOutcomeGrade',
		plural: 'studentCourseOutcomeGrades',
	},

	planAction: {
		entity: 'PlanActionEntity',
		path: 'improvement/plan-actions',
		singular: 'planAction',
		plural: 'planActions',
	},

	evaluation: {
		entity: 'EvaluationEntity',
		path: 'evidence/evaluations',
		singular: 'evaluation',
		plural: 'evaluations',
	},

	rubricScore: {
		entity: 'RubricScoreEntity',
		path: 'evaluation/rubric-scores',
		singular: 'rubricScore',
		plural: 'rubricScores',
	},

	parameter: {
		entity: 'ParameterEntity',
		path: 'core/parameters',
		singular: 'parameter',
		plural: 'parameters',
	},

	score: {
		entity: 'ScoreEntity',
		path: 'survey/scores',
		singular: 'score',
		plural: 'scores',
	},

	outcomeConfig: {
		entity: 'OutcomeConfigEntity',
		path: 'survey/outcome-configs',
		singular: 'outcomeConfig',
		plural: 'outcomeConfigs',
	},

	notification: {
		entity: 'NotificationEntity',
		path: 'survey/notifications',
		singular: 'notification',
		plural: 'notifications',
	},

	notificationMessage: {
		entity: 'NotificationMessageEntity',
		path: 'survey/notification-messages',
		singular: 'notificationMessage',
		plural: 'notificationMessages',
	},

	notificationConfig: {
		entity: 'NotificationConfigEntity',
		path: 'admin/ifc/notification-configs',
		singular: 'notificationConfig',
		plural: 'notificationConfigs',
	},

	notificationLog: {
		entity: 'NotificationLogEntity',
		path: 'ifc/notification-log',
		singular: 'notificationLog',
		plural: 'notificationLogs',
	},
};
