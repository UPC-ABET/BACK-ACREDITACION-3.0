export const projectPortfoliosRoutes = {
	projectPortfolios: {
		route: 'project-portfolios',
		tag: 'Portafolios de Proyecto',
		operation: {
			// %% Endpoints compatibles con el sistema antiguo
			getModalities: { method: 'GET', route: '/modalidades', summary: 'Obtener modalidades por usuario' },
			getCareers: { method: 'GET', route: '/carreras', summary: 'Obtener carreras por escuela' },
			getAccess: { method: 'GET', route: '/access', summary: 'Acceso al portafolio' },
			listRoles: { method: 'GET', route: '/listar-roles', summary: 'Lista de roles por usuario' },
			getAllPaginated: { method: 'POST', route: '/get-all', summary: 'Listar portafolios paginados' },
			getById: { method: 'GET', route: '/:id', summary: 'Obtener portafolio por ID' },
			create: { method: 'POST', route: '/', summary: 'Crear portafolio' },
			update: { method: 'PUT', route: '/', summary: 'Actualizar portafolio' },
			delete: { method: 'DELETE', route: '/:id', summary: 'Eliminar portafolio' },

			getBulkUploadTemplate: { method: 'GET', route: '/bulk-upload-template', summary: 'Obtener plantilla de carga masiva' },
			getBulkUploadTemplateFile: { method: 'GET', route: '/bulk-upload-template-file', summary: 'Descargar plantilla de carga masiva (archivo)' },
			bulkUpload: { method: 'POST', route: '/bulk-upload/:periodoAcademicoId/:college/:IdModalidad', summary: 'Carga masiva de portafolios' },
			bulkUploadFilled: { method: 'POST', route: '/bulk-upload-filled/:college/:periodoAcademicoId/:IdModalidad/:courseCode', summary: 'Carga masiva con plantilla pre-llena' },

			getCompanies: { method: 'GET', route: '/companies/:academicPeriodId/:modalityId', summary: 'Empresas por periodo académico y modalidad' },
			unassignStudent: { method: 'DELETE', route: '/unassign-student/:projectPortfolioId/:studentId', summary: 'Desasignar estudiante' },
			getTotalTeacherProjects: { method: 'GET', route: '/total-teacher-projects/:teacherId', summary: 'Cantidad de proyectos por docente' },

			updateManager: { method: 'PUT', route: '/update-manager', summary: 'Actualizar responsable del portafolio' },
			autoAssignPartner: { method: 'POST', route: '/auto-assign-partner', summary: 'Asignación automática de compañeros' },
			export: { method: 'POST', route: '/export', summary: 'Exportar portafolios' },
			getTeachers: { method: 'GET', route: '/teachers/:modalityId', summary: 'Docentes por modalidad' },
			migrate: { method: 'PUT', route: '/migrate', summary: 'Migrar portafolios de curso' },
			managementAssign: { method: 'POST', route: '/management-assign', summary: 'Asignación manual de proyecto a estudiantes' },
			migrateFromDatabase: { method: 'POST', route: '/migrate-from-database', summary: 'Migrar desde base de datos origen' },
		},
	},
};
