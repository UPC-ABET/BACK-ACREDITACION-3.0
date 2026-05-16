# GUÍA RÁPIDA Y ROADMAP - MIGRACIÓN ENCUESTAS A NESTJS
## Sistema ABET - Referencia de Migración

---

## TABLA DE CONTENIDOS
1. [Quick Reference](#quick-reference)
2. [Roadmap Detallado](#roadmap-detallado-7-fases)
3. [Preguntas Frecuentes](#preguntas-frecuentes)
4. [Checklist Pre-Migración](#checklist-pre-migración)
5. [Comandos Útiles](#comandos-útiles-nestjs)

---

## QUICK REFERENCE

### Endpoints por Módulo

#### PPP - Prácticas Pre-Profesionales
```
CONFIG & MANAGEMENT
POST   /Survey/list-ppp-configurations
POST   /Survey/add-update-ppp-config
POST   /Survey/delete-ppp-config
POST   /Survey/ReplicarConfiguracionPPP

UPLOAD & PROCESSING
POST   /ExcelService/DownloadTemplatePPP
POST   /ExcelService/UploadNewPPP

REPORTING
POST   /Dashboard/encuesta-ppp
GET    /Report/control-ppp
```

#### GRA - Graduandos
```
CONFIG
POST   /Survey/list-gra-configurations
POST   /Survey/add-update-gra-config
POST   /Survey/delete-gra-config
POST   /Survey/ReplicarConfiguracionGRA

NOTIFICATIONS & EMAIL
POST   /Email/findStudentCodeCareer
POST   /Email/emailSurvey-GRA
POST   /Email/saveNotification-GRA
POST   /Email/listStudentNotification-GRA
POST   /Email/deleteNotification-GRA

SURVEYS
GET    /Gra/encuesta/{token}
POST   /Gra/encuesta/completar

REPORTING
POST   /Dashboard/encuesta-graduandos
GET    /Report/control-gra
```

#### LCFC - Logro Fin de Ciclo
```
CONFIG
POST   /lcfc/configuracion/generar/{periodo}
POST   /lcfc/configuracion/pageable
POST   /lcfc/configuracion/cambio

NOTIFICATIONS
POST   /lcfc/notificacion/envio
GET    /lcfc/notificacion/escuela/{escuela}/token/{token}
POST   /lcfc/notificacion/list-pageable

SURVEYS
GET    /lcfc/encuesta/escuela/{escuela}/idioma/{idioma}/alumno/{alumnoId}/...
POST   /lcfc/encuesta/completar

REPORTING
POST   /Dashboard/encuesta-lcfc
GET    /Report/control-lcfc
```

---

### Entities Core

```
┌─────────────────────────────────────────────────────┐
│ CORE ENTITIES (Todas las encuestas comparten)       │
├─────────────────────────────────────────────────────┤
│                                                     │
│ Encuestum                                           │
│ ├─ IdEncuesta (PK)                                  │
│ ├─ IdTipoEncuesta (FK)                              │
│ ├─ IdAlumno (FK)                                    │
│ ├─ IdCarrera (FK)                                   │
│ ├─ CodigoAlumno: string                             │
│ ├─ Estado: "PEN"/"COM"/"REV"                        │
│ ├─ FechaRegistro: DateTime                          │
│ ├─ PuntajeTotal: decimal?                           │
│ ├─ Comentario: string?                              │
│ └─ Collections:                                     │
│    ├─ PerformanceEncuesta[]                         │
│    ├─ PerformanceEncuestaPPPs[]                     │
│    ├─ EncuestaLCFCs[]                               │
│    └─ EncuestaTokens[]                              │
│                                                     │
│ EncuestaToken                                       │
│ ├─ IdEncuestaToken (PK)                             │
│ ├─ Token: GUID                                      │
│ ├─ Estado: bool (enviado)                           │
│ ├─ FechaEnvio: DateTime                             │
│ ├─ FechaFin: DateTime (expiración)                  │
│ ├─ IdEncuesta (FK)                                  │
│ ├─ IdAlumno (FK)                                    │
│ └─ Collections:                                     │
│    └─ NotificacionEncuestaAlumnos[]                 │
│                                                     │
│ NotificacionEncuestaAlumno                          │
│ ├─ IdNotificacion (PK)                              │
│ ├─ IdEncuestaToken (FK)                             │
│ ├─ IdAlumno (FK)                                    │
│ ├─ Estado: bool                                     │
│ └─ FechaCreacion: DateTime                          │
│                                                     │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│ PPP-SPECIFIC ENTITIES                               │
├─────────────────────────────────────────────────────┤
│                                                     │
│ OutcomeEncuestaPPPConfig                            │
│ ├─ IdOutcomeEncuestaPPPConfig (PK)                  │
│ ├─ NombreEspanol, NombreIngles: string              │
│ ├─ DescripcionEspanol, DescripcionIngles: string    │
│ ├─ Orden: int                                       │
│ ├─ IdCarrera (FK)                                   │
│ ├─ IdEscuela (FK)                                   │
│ ├─ Estado: "ACT"/"INA"                              │
│ ├─ EsVisible: bool                                  │
│ └─ Collections:                                     │
│    ├─ OutcomeEncuestaPPPOutcomes[]                  │
│    └─ PerformanceEncuestaPPPs[]                     │
│                                                     │
│ PerformanceEncuestaPPP                              │
│ ├─ IdPerformanceEncuestaPPP (PK)                    │
│ ├─ IdEncuesta (FK)                                  │
│ ├─ IdOutcomeEncuestaPPPConfig (FK)                  │
│ ├─ PuntajeOutcome: decimal (1-5)                    │
│ ├─ PuntajePregunta: decimal?                        │
│ └─ Navigations:                                     │
│    └─ IdEncuestaNavigation, IdOutcomeNavigation     │
│                                                     │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│ GRA-SPECIFIC ENTITIES                               │
├─────────────────────────────────────────────────────┤
│                                                     │
│ OutcomeEncuestaConfig (GRA)                         │
│ ├─ IdOutcomeEncuestaConfig (PK)                     │
│ ├─ NombreEspanol, NombreIngles: string              │
│ ├─ DescripcionEspanol, DescripcionIngles: string    │
│ ├─ Orden: int                                       │
│ ├─ IdComision (FK)  ← Diferencia con PPP           │
│ ├─ IdEscuela (FK)                                   │
│ ├─ Estado: "ACT"/"INA"                              │
│ ├─ EsVisible: bool                                  │
│ └─ Collections:                                     │
│    ├─ OutcomeEncuestaOutcomes[]                     │
│    └─ PerformanceEncuestas[]                        │
│                                                     │
│ PerformanceEncuestum (GRA Response)                 │
│ ├─ IdPerformanceEncuesta (PK)                       │
│ ├─ IdEncuesta (FK)                                  │
│ ├─ IdOutcomeEncuestaConfig (FK)                     │
│ ├─ PuntajeOutcome: decimal (1-5)                    │
│ └─ Navigations similar a PPP                        │
│                                                     │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│ LCFC-SPECIFIC ENTITIES                              │
├─────────────────────────────────────────────────────┤
│                                                     │
│ CursoEncuestaConfig (Nueva para LCFC)               │
│ ├─ IdCursoConfig (PK)                               │
│ ├─ IdCurso (FK)                                     │
│ ├─ IdPeriodo (FK)                                   │
│ ├─ IdEscuela (FK)                                   │
│ ├─ IdCarrera (FK)                                   │
│ ├─ Estado: "ACT"/"INA"                              │
│ ├─ FechaCreacion: DateTime                          │
│ └─ Collections:                                     │
│    └─ EncuestaLCFCs[]                               │
│                                                     │
│ EncuestaLCFC (LCFC Response)                        │
│ ├─ IdEncuestaLcfc (PK)                              │
│ ├─ IdEncuesta (FK)                                  │
│ ├─ IdOutcome (FK)                                   │
│ ├─ Puntaje: int (1-10)    ← Escala diferente      │
│ └─ Navigations:                                     │
│    └─ IdEncuestaNavigation, IdOutcomeNavigation     │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### Key Data Flows

```
PPP UPLOAD FLOW:
Excel Base64
  → Decodificar
  → Leer Filas (Alumno, Carrera, NumeroPractica, Datos...)
  → Validar Cada Fila
  → Crear Encuestum
  → Calcular Puntaje (ConvertirOutcome)
  → Llamar USP_Ins_RegistarPerformancePPP
  → Retornar {exitosas, fallidas}

GRA EMAIL FLOW:
Coordinador selecciona Modalidad
  → Obtener Configuración Email
  → Obtener Estudiantes
  → Para c/Estudiante:
    → Crear/Obtener EncuestaToken
    → Generar URL con Token
    → Reemplazar Placeholders
    → Enviar Email
    → Marcar Estado
  → Retornar {exitosas, fallidas}

LCFC COMPLETE FLOW:
1. Generar Configs de Cursos (al inicio período)
2. Coordinador ajusta Activación/Desactivación
3. Sistema Envía Notificaciones:
   → Para c/Alumno-Curso:
     → Crear Encuestum (PEN)
     → Generar Token
     → Construir URL
     → Enviar Email
4. Alumno Abre Link:
   → Validar Token
   → Cargar Outcomes del Curso
   → Mostrar Formulario (1-10 escala)
5. Alumno Responde:
   → Crear EncuestaLCFC (×outcomes)
   → Actualizar Encuestum (COM)
   → Commit Transacción
6. Dashboard Actualiza Progreso
```

---

## ROADMAP DETALLADO - 7 FASES

### FASE 0: Preparación del Entorno (Semana 1)

```
OBJETIVO: Configurar base NestJS lista para desarrollo

TAREAS:
[ ] Crear nuevo proyecto NestJS
    $ nest new abet-surveys
    $ cd abet-surveys
    $ npm install

[ ] Instalar dependencias críticas
    npm install @nestjs/typeorm typeorm mssql class-validator
    npm install --save-dev @types/node @nestjs/cli

[ ] Configurar TypeORM para SQL Server
    - Crear ormconfig.json con conexión SQL Server
    - Definir DataSourceFactory pattern
    - Prueba conexión a BD

[ ] Estructura de directorios
    src/
    ├── config/
    │   ├── database.config.ts
    │   ├── email.config.ts
    │   └── app.config.ts
    ├── common/
    │   ├── guards/
    │   ├── interceptors/
    │   ├── decorators/
    │   └── filters/
    ├── shared/
    │   ├── entities/
    │   ├── services/
    │   ├── repositories/
    │   └── utils/
    ├── modules/
    │   ├── ppp/
    │   ├── gra/
    │   ├── lcfc/
    │   ├── dashboard/
    │   └── email/
    └── main.ts

[ ] Configurar entorno
    - .env para DB, email, puertos
    - ValidationPipe global
    - Logger global
    - CORS si aplica

[ ] Logging y Error Handling
    - Winston logger setup
    - Global exception filter
    - Request/Response logging

DELIVERABLES:
✓ Proyecto NestJS compilable
✓ Conexión a SQL Server funcionando
✓ Estructura base de directorios
✓ Variables de entorno configuradas
```

### FASE 1: Entities y Repositories (Semana 2)

```
OBJETIVO: Migrar todas las entities de .NET a TypeORM

TAREAS - CORE ENTITIES:
[ ] Entity Encuestum
    - @Entity() decorator
    - Primary key: IdEncuesta
    - Foreign keys: IdTipoEncuesta, IdAlumno, IdCarrera
    - Relaciones @ManyToOne, @OneToMany
    - Índices necesarios

[ ] Entity EncuestaToken
    - @Entity() decorator
    - @Column() Token (GUID)
    - @Column() Estado, FechaEnvio, FechaFin
    - @ManyToOne to Encuestum
    - @OneToMany to NotificacionEncuestaAlumno

[ ] Entity NotificacionEncuestaAlumno
    - @Entity() decorator
    - Relaciones a EncuestaToken, Alumno, SubModalidad

TAREAS - PPP ENTITIES:
[ ] Entity OutcomeEncuestaPPPConfig
    - Índices en (IdCarrera, IdEscuela, IdSubModalidad)
    - Replicación de campos ES/IN

[ ] Entity PerformanceEncuestaPPP
    - @ManyToOne to Encuestum, OutcomeEncuestaPPPConfig
    - Índices en IdEncuesta, IdOutcomeEncuestaPPPConfig

TAREAS - GRA ENTITIES:
[ ] Entity OutcomeEncuestaConfig
    - @Column() NombreEspanol, NombreIngles, etc.
    - @ManyToOne to Comision (diferencia vs PPP)

[ ] Entity PerformanceEncuestum
    - @ManyToOne to Encuestum, OutcomeEncuestaConfig

TAREAS - LCFC ENTITIES:
[ ] Entity CursoEncuestaConfig (NUEVA)
    - @Column() IdCurso, IdPeriodo, IdEscuela, Estado
    - Índices necesarios

[ ] Entity EncuestaLCFC
    - @ManyToOne to Encuestum, Outcome
    - @Column() Puntaje (1-10)

TAREAS - REPOSITORIES:
[ ] BaseRepository (clase base)
    - find(), findById(), create(), update(), delete()
    - Paginación estándar
    - Soft delete si aplica

[ ] EncuestaRepository
    [ ] findByAlumnoAndTipo()
    [ ] findByAlumnoAndCurso()
    [ ] findCompletadas()
    [ ] findPendientes()

[ ] EncuestaTokenRepository
    [ ] findByToken()
    [ ] findActiveTokens()
    [ ] findExpiredTokens()
    [ ] createWithRelation()

[ ] OutcomeEncuestaPPPConfigRepository
    [ ] findByCarreraAndEscuela()
    [ ] findBySubmodalidad()
    [ ] replicateFromPrevious()

[ ] OutcomeEncuestaConfigRepository (GRA)
    [ ] findByComisionAndEscuela()

[ ] CursoEncuestaConfigRepository (LCFC)
    [ ] findActiveCourses()
    [ ] findByPeriodo()

[ ] PerformanceRepositories (PPP y GRA)
    [ ] createBulk()
    [ ] findByEncuesta()

[ ] EncuestaLCFCRepository
    [ ] findByEncuesta()
    [ ] createBulk()

DELIVERABLES:
✓ 12+ entities con decoradores y relaciones
✓ 8+ repositories con métodos específicos
✓ Migrations TypeORM creadas
✓ Índices de BD aplicados
✓ Tests unitarios para repositories
```

### FASE 2: Módulo PPP (Semana 3-4)

```
OBJETIVO: Implementar módulo PPP completo

TAREAS - CONTROLLERS:
[ ] PppConfigController
    GET  /ppp/configurations - ListPPPConfigurations
    POST /ppp/configurations - AddPPPOutcome
    GET  /ppp/configurations/:id - PPPConfigById
    DELETE /ppp/configurations/:id - DeleteConfig
    POST /ppp/configurations/replicate - ReplicarConfiguracionPPP

[ ] PppUploadController
    GET  /ppp/template/download - DownloadTemplatePPP
    POST /ppp/template/upload - UploadNewPPP

TAREAS - SERVICES:
[ ] PppConfigService
    listConfigurations(filtros)
    getConfigById(id)
    createOutcome(dto)
    updateOutcome(id, dto)
    deleteConfig(id)
    replicateConfig(sourceSubmodalidad, targetSubmodalidad)

[ ] PppUploadService
    downloadTemplate(carrera, tipo)
    uploadAndProcess(file, metadata)
    processExcelRow(row)
    validateStudent(codigo, carrera)
    createEncuestum(data)
    calculateScore(data)

[ ] PppPerformanceService
    getAllPerformances(filters, page)
    getPerformanceByEncuesta(encuestaId)
    createPerformances(encuestaId, performances)

TAREAS - DTOS:
[ ] Request DTOs
    ListPPPConfigurationsDTO
    AddPPPOutcomeDTO
    DeleteConfigDTO
    ReplicarConfigDTO
    UploadPPPDTO

[ ] Response DTOs
    OutcomeEncuestaPPPConfigDTO
    UploadResponseDTO {exitosas, fallidas}
    PppConfigResponseDTO

TAREAS - VALIDATIONS:
[ ] Crear validadores personalizados
    @IsValidCarrera()
    @IsValidNumeroP ractica()
    @IsValidPuntaje()

[ ] Validators de negocio
    validateNombreUnique(nombre)
    validateOrdenUnique(orden, carrera)
    validateCanDelete(configId)

TAREAS - EXCEL PROCESSING:
[ ] Excel parser
    parseExcelFile(buffer)
    extractRows()
    validateHeaders()

[ ] Convertir a Encuesta
    ConvertirOutcome (lógica de cálculo)
    MapRowToEncuestum()

TAREAS - TESTING:
[ ] Unit tests
    [ ] PppConfigService.ts
    [ ] PppUploadService.ts
    [ ] PppPerformanceService.ts

[ ] Integration tests
    [ ] Upload Excel completo
    [ ] CRUD configuraciones
    [ ] Replicación de configuración

DELIVERABLES:
✓ 2 controllers, 3 servicios, 5+ DTOs
✓ Excel upload processor funcionando
✓ Lógica de cálculo de puntajes (ConvertirOutcome)
✓ Tests cobriendo 80%+ de lógica
✓ API ready para frontend
```

### FASE 3: Módulo GRA (Semana 4-5)

```
OBJETIVO: Implementar módulo GRA con envío de emails

TAREAS - CONTROLLERS:
[ ] GraConfigController
    GET  /gra/configurations
    POST /gra/configurations
    GET  /gra/configurations/:id
    DELETE /gra/configurations/:id
    POST /gra/configurations/replicate

[ ] GraEmailController
    POST /gra/email/survey - EmailSurveyGRA
    POST /gra/email/notifications - SaveNotificationGRA
    GET  /gra/email/notifications - ListStudentNotifications
    DELETE /gra/email/notifications/:id
    GET  /gra/students - FindStudentCodeCareer

[ ] GraSurveyController
    GET  /gra/survey/:token
    POST /gra/survey/submit

TAREAS - SERVICES:
[ ] GraConfigService
    listConfigurations(filtros)
    getConfigById(id)
    createOutcome(dto)
    updateOutcome(id, dto)
    replicateConfig()

[ ] EmailService
    sendSurveyEmails(modalidadId, escuelaId)
    sendEmail(to, subject, template, params)
    buildEmailContent(template, params)
    replacePlaceholders(content, values)

[ ] TokenService (reutilizable)
    generateToken()
    validateToken(token)
    decryptToken(token)
    isTokenExpired(token)

[ ] GraSurveyService
    getSurveyByToken(token)
    submitSurvey(encuestaId, responses)
    createResponses(encuestaId, performances)

[ ] NotificationService
    saveNotification(dto)
    listNotifications(filtros, page)
    deleteNotification(notificacionId)
    getConfigurationNotification()

TAREAS - DTOS:
[ ] Request DTOs
    EmailSurveyGRADTO
    SaveNotificationGRADTO
    ListStudentNotificationGRADTO
    FindStudentCodeCareerDTO
    GraSurveyResponseDTO

[ ] Response DTOs
    OutcomeEncuestaConfigDTO
    NotificationResponseDTO
    SurveyFormDTO
    StudentDTO

TAREAS - EMAIL INTEGRATION:
[ ] Email Provider Interface
    sendEmail(to, subject, content)

[ ] Email Provider (SMTP)
    configurar con nodemailer
    retry logic
    logging

[ ] Email Templates
    gra-survey.hbs con placeholders:
    [NombreAlumno]
    [NombreCarrera]
    [LinkEncuesta]
    [FechaVencimiento]
    [CodigoAlumno]

TAREAS - TOKEN SECURITY:
[ ] Token Encryption/Decryption
    Generar GUID único
    Encriptar con AES-256
    Store en BD
    Validar expiración

[ ] Scoped Access
    Token contiene: alumnoId, encuestaId, escuela
    Validar permisos antes de retornar datos

TAREAS - TESTING:
[ ] Unit tests
    [ ] GraConfigService.ts
    [ ] EmailService.ts
    [ ] TokenService.ts
    [ ] NotificationService.ts

[ ] Integration tests
    [ ] Envío de emails masivo
    [ ] Respuesta a encuesta con token

[ ] Email mocking
    [ ] Mock SMTP para testing

DELIVERABLES:
✓ 3 controllers, 5 servicios, 8+ DTOs
✓ Sistema de tokens funcionando
✓ Email integration con templates
✓ Tests cobriendo flujo completo
✓ Encuesta GRA respondible vía token
```

### FASE 4: Módulo LCFC (Semana 5-6)

```
OBJETIVO: Implementar módulo LCFC con configuración de cursos

TAREAS - CONTROLLERS:
[ ] LcfcConfigController
    POST /lcfc/config/generate/{periodoId}
    GET  /lcfc/config/courses
    POST /lcfc/config/courses/toggle
    POST /lcfc/config/replicate

[ ] LcfcNotificationController
    POST /lcfc/notification/send
    GET  /lcfc/notification/list
    GET  /lcfc/notification/:token

[ ] LcfcSurveyController
    GET  /lcfc/survey/:token
    POST /lcfc/survey/submit

TAREAS - SERVICES:
[ ] LcfcConfigService
    generateCourseConfigurations(periodoId, escuela)
    listCourseConfigurations(filtros, page)
    toggleCourseState(configId, estado)
    replicateConfiguration(sourcePeriodo, targetPeriodo)

[ ] LcfcNotificationService
    sendNotifications(periodoId, cursoIds)
    listNotifications(filtros, page)
    getNotificationByToken(token)
    markNotificationAsSent(token)

[ ] LcfcSurveyService
    getSurveyForm(token)
    getOutcomesForCourse(cursoId)
    submitSurvey(encuestaId, responses)
    createEncuestaLCFC(encuestaId, outcomes, puntajes)

[ ] LcfcReplicationService
    copyConfigsFromPreviousPeriod(sourcePeriodo, targetPeriodo)
    activateAllCourses(periodoId)
    deactivateAllCourses(periodoId)

TAREAS - DTOS:
[ ] Request DTOs
    GenerateCourseConfigDTO {periodoId, escuela}
    ListCourseConfigDTO {periodoId, escuela, idioma, buscador}
    ToggleCourseDTO {configId, estado}
    SendNotificationsDTO {periodoId, cursoIds, escuela}
    LcfcSurveyResponseDTO {responses: {outcomeId, puntaje}[]}

[ ] Response DTOs
    CourseConfigDTO {cursoId, codCurso, nombreCurso, nombreCoor, estado}
    NotificationResponseDTO
    SurveyFormDTO {outcomes: {id, nombre, descripcion}[]}

TAREAS - DATABASE:
[ ] CursoEncuestaConfig table
    [ ] Crear migration
    [ ] Índices: (IdCurso, IdPeriodo), (IdEscuela, Estado)
    [ ] Default estado = "ACT"

[ ] Queries complejas
    - Listar cursos con coordinador
    - Contar pendientes vs completadas
    - Obtener outcomes por curso (join con MallaCocos)

TAREAS - TRANSACTIONS:
[ ] Envío de notificaciones masivo
    Envolver en transacción
    Rollback si error
    Reintento con backoff

[ ] Envío de encuesta (respuesta)
    Crear/actualizar Encuestum (transacción)
    Crear múltiples EncuestaLCFC (×outcomes)
    Atomic: todo o nada

TAREAS - TESTING:
[ ] Unit tests
    [ ] LcfcConfigService.ts
    [ ] LcfcNotificationService.ts
    [ ] LcfcSurveyService.ts

[ ] Integration tests
    [ ] Generación de configs
    [ ] Toggle masivo de estados
    [ ] Envío de notificaciones
    [ ] Respuesta a encuesta

[ ] Performance tests
    [ ] Generar 1000 configs (tiempo)
    [ ] Enviar 500 notificaciones (tiempo)

DELIVERABLES:
✓ 3 controllers, 4 servicios, 5+ DTOs
✓ Generación de configuraciones funcionando
✓ Notificaciones masivas
✓ Respuestas con escala 1-10
✓ Tests cobriendo flujo completo
```

### FASE 5: Dashboard & Reportes (Semana 6-7)

```
OBJETIVO: Implementar dashboards y reportes transversales

TAREAS - CONTROLLERS:
[ ] DashboardController
    POST /dashboard/ppp-summary
    POST /dashboard/gra-summary
    POST /dashboard/lcfc-summary
    POST /dashboard/comparison

[ ] ReportController
    GET  /report/ppp/{periodo}
    GET  /report/gra/{periodo}
    GET  /report/lcfc/{periodo}
    GET  /report/findings
    POST /report/export-excel

TAREAS - SERVICES:
[ ] DashboardService
    getPPPSummary(filtros)
      - Contar por NumeroPractica
      - Calcular promedios
    getGRASummary(filtros)
      - Contar completadas vs pendientes
      - % de completitud
    getLCFCSummary(filtros)
      - Contar por estado
      - % de completitud por carrera
    getComparison(periodo1, periodo2)
      - Comparativa histórica

[ ] ReportService
    generatePPPReport(periodo, filtros)
    generateGRAReport(periodo, filtros)
    generateLCFCReport(periodo, filtros)
    exportToExcel(reportType, data)
    exportToPDF(reportType, data)

[ ] AggregationService (Stored Procs / Complex Queries)
    executeAggregation(procedureName, params)
    cacheResults(key, duration)

TAREAS - DTOS:
[ ] Request DTOs
    DashboardFilterDTO
    ReportFilterDTO
    ExportDTO

[ ] Response DTOs
    DashboardSummaryDTO
    ReportDataDTO
    ComparisonDTO

TAREAS - STORED PROCEDURES:
[ ] Adaptación desde .NET
    [ ] USP_CREARHALLAZGOSPPPAUTOMATICOS
        - Crear hallazgos automáticos PPP
        - Basados en niveles (ROJO/AMARILLO/VERDE)
    
    [ ] ReporteControlDashboard
        - Agregaciones por outcomes
        - Promedios y estadísticas
    
    [ ] Otros procedimientos críticos
        - Migrar y adaptar a NestJS

TAREAS - CACHING:
[ ] Redis integration (si aplica)
    Caché de configuraciones (TTL: 1 hora)
    Caché de dashboards (TTL: 30 min)
    Invalidación al crear/modificar

TAREAS - TESTING:
[ ] Unit tests
    [ ] DashboardService.ts
    [ ] ReportService.ts

[ ] Integration tests
    [ ] Dashboard con diferentes filtros
    [ ] Generación de reportes
    [ ] Export a Excel/PDF

DELIVERABLES:
✓ 2 controllers, 3 servicios, 5+ DTOs
✓ Dashboards funcionando
✓ Reportes generables
✓ Export Excel/PDF
✓ Caching implementado
```

### FASE 6: Integración, Testing y Optimización (Semana 7-8)

```
OBJETIVO: Integración total, testing exhaustivo, optimización

TAREAS - END-TO-END TESTING:
[ ] PPP Flow
    [ ] Config → Upload → Hallazgos → Dashboard
    [ ] Validación completa
    [ ] Error scenarios

[ ] GRA Flow
    [ ] Config → Email → Respuesta → Dashboard
    [ ] Token validation
    [ ] Email mocking

[ ] LCFC Flow
    [ ] Config → Notif → Respuesta → Dashboard
    [ ] Múltiples cursos
    [ ] Transacciones

[ ] Cross-module
    [ ] Datos compartidos (Encuestum)
    [ ] Integridad referencial

TAREAS - PERFORMANCE:
[ ] Query optimization
    [ ] Análisis de queries lentas
    [ ] Índices adicionales si necesario
    [ ] N+1 problem solving

[ ] Connection pooling
    [ ] Configurar pool size
    [ ] Timeout handling

[ ] Bulk operations
    [ ] Batching de inserts
    [ ] Transacciones efectivas

TAREAS - SECURITY:
[ ] SQL Injection prevention
    [ ] Usar parameterized queries (TypeORM lo hace)
    [ ] Validar inputs

[ ] Multi-tenancy isolation
    [ ] Validar escuelaActual en cada operación
    [ ] No permitir cross-tenant access

[ ] Token security
    [ ] Encriptación AES-256
    [ ] Expiración correcta
    [ ] Rate limiting en desencriptación

[ ] Authentication & Authorization
    [ ] Integrar con sistema de roles
    [ ] Guards por rol
    [ ] Permisos granulares

TAREAS - LOGGING & MONITORING:
[ ] Structured logging
    [ ] Winston logger
    [ ] Logs en JSON
    [ ] Log levels apropiados

[ ] Error tracking
    [ ] Sentry integration (opcional)
    [ ] Stack traces completos

[ ] Audit trail
    [ ] Registrar cambios críticos
    [ ] Quién, qué, cuándo

TAREAS - DOCUMENTATION:
[ ] API Documentation
    [ ] Swagger/OpenAPI
    [ ] Ejemplos de requests/responses

[ ] Developer Guide
    [ ] Setup local dev
    [ ] Running tests
    [ ] Common tasks

[ ] Deployment Guide
    [ ] Containerización (Docker)
    [ ] Environment variables
    [ ] Database migrations

TAREAS - CODE QUALITY:
[ ] Linting
    [ ] ESLint configurado
    [ ] Prettier formateado

[ ] Code Review
    [ ] Revisar todos los módulos
    [ ] Refactoring si necesario

[ ] Coverage
    [ ] Unit tests 80%+
    [ ] Integration tests 60%+

DELIVERABLES:
✓ Suite de tests exhaustiva
✓ Performance optimizado
✓ Security hardened
✓ Documentación completa
✓ Código listo para producción
```

### FASE 7: Deployment y Go-Live (Semana 9)

```
OBJETIVO: Deploy a producción y cutover

TAREAS - PRE-DEPLOYMENT:
[ ] Ambiente staging
    [ ] Clonar BD producción a staging
    [ ] Deploy de NestJS a staging
    [ ] Testing en staging (2-3 días)

[ ] Data migration
    [ ] Validar datos existentes
    [ ] Migración incremental si aplica

[ ] Backups
    [ ] BD backup antes de cutover
    [ ] Plan de rollback

TAREAS - DEPLOYMENT:
[ ] Docker setup
    [ ] Dockerfile
    [ ] docker-compose
    [ ] Registry push

[ ] Kubernetes (si aplica)
    [ ] Deployments
    [ ] Services
    [ ] ConfigMaps

[ ] CI/CD
    [ ] GitHub Actions / Azure Pipelines
    [ ] Auto-test on commit
    [ ] Auto-deploy on merge

TAREAS - GO-LIVE:
[ ] Comunicación
    [ ] Notificar usuarios
    [ ] Training si necesario

[ ] Monitoring
    [ ] Alertas configuradas
    [ ] Dashboard de health
    [ ] On-call team ready

[ ] Support
    [ ] Hotline disponible
    [ ] Logs monitoreados

[ ] Validation
    [ ] Tests de smoke en producción
    [ ] Validación de datos críticos

DELIVERABLES:
✓ Sistema NestJS en producción
✓ Todos los módulos funcionando
✓ Usuarios migrando exitosamente
✓ Monitoring y alertas activos
✓ Go-live completado
```

---

## PREGUNTAS FRECUENTES

### Q: ¿Cuánto tiempo toma toda la migración?
**A:** ~8 semanas con equipo de 3-4 desarrolladores:
- Fase 0: 1 semana
- Fase 1: 1 semana
- Fase 2: 2 semanas
- Fase 3: 2 semanas
- Fase 4: 2 semanas
- Fase 5: 1 semana
- Fase 6: 2 semanas
- Fase 7: 1 semana

Puede paralelizarse después de Fase 1.

### Q: ¿Qué pasa con los datos existentes?
**A:** Las entities de TypeORM mapearon directamente a las tablas SQL Server. No necesitas cambiar BD. Simplemente:
1. Copia BD existente a ambiente de desarrollo
2. TypeORM crea migraciones (o manual sync)
3. Los datos existen sin cambios

### Q: ¿Cómo manejo tokens y seguridad?
**A:** 
- Genera GUID único por encuesta
- Encripta con AES-256 antes de URL
- Incluye descifrado en endpoint
- Valida expiración (FechaFin)
- Usa HTTPS en producción

### Q: ¿Puedo hacer rollback?
**A:** Sí:
1. Mantén .NET en paralelo 2-3 semanas post-launch
2. Si crítico, vuelve a .NET
3. Sincroniza datos después

### Q: ¿Qué base de datos usar?
**A:** SQL Server (igual que ahora):
- TypeORM soporta nativo
- Connection string en .env
- mssql driver en npm

### Q: ¿Necesito cambiar frontend?
**A:** Parcialmente:
- Endpoints cambian de ruta (pero funcionalidad igual)
- Respuestas JSON pueden necesitar normalización
- Sugiero: adapter pattern en frontend

### Q: ¿Cómo pruebo Excel upload?
**A:**
```typescript
// test.spec.ts
const fs = require('fs');
const excelBuffer = fs.readFileSync('template.xlsx');
const base64 = excelBuffer.toString('base64');
// POST /ppp/template/upload {archivoBase64: base64}
```

### Q: ¿Puedo usar MongoDB o PostgreSQL?
**A:** Sí, pero requiere cambios en:
- Queries (SQL → NoSQL)
- Relaciones (@Relations)
- Transacciones
- Stored Procedures
No recomendado por complejidad.

### Q: ¿Cómo monitoreamos errores?
**A:** Winston logger + Sentry (opcional):
```typescript
// Winston logs a archivo + consola
// Sentry captura excepciones en producción
// Slack notifications para alertas críticas
```

---

## CHECKLIST PRE-MIGRACIÓN

### Técnico
```
[ ] Equipo familiarizado con NestJS
[ ] SQL Server 2019+ disponible
[ ] Node.js 18+ instalado
[ ] Docker disponible (recomendado)
[ ] Acceso a repositorio Git

[ ] Entity Framework .NET proyectos leídos
[ ] DTOs .NET documentados
[ ] Procedimientos almacenados listados
[ ] Endpoints .NET catálogo
[ ] Esquema BD documentado

[ ] Planning board creado (Jira/Azure DevOps)
[ ] Sprints de 2 semanas planeados
[ ] Personas asignadas por fase
[ ] Blockers identificados
```

### De Negocio
```
[ ] Usuarios informados de cambios
[ ] Rollback plan aprobado
[ ] SLAs definidos para cutover
[ ] Support team training completado
[ ] Comunicación pre-launch programada

[ ] Datos existentes validados
[ ] Acceso a BD staging conseguido
[ ] Ambiente producción preparado
[ ] Monitoreo/alertas configuradas
```

### De Testing
```
[ ] Test data sets creados
[ ] Scenarios críticos identificados
[ ] Criterios de aceptación documentados
[ ] UAT schedule planeado
[ ] Bugs tracking system setup
```

---

## COMANDOS ÚTILES NESTJS

### Setup Inicial
```bash
# Crear proyecto
nest new abet-surveys
cd abet-surveys

# Instalar dependencias
npm install @nestjs/typeorm typeorm mssql class-validator
npm install --save-dev @types/node

# Generar módulo
nest g module modules/ppp
nest g controller modules/ppp/ppp.controller
nest g service modules/ppp/ppp.service

# Ejecutar
npm run start:dev
```

### TypeORM Migrations
```bash
# Generar migration
npm run typeorm migration:generate src/migrations/CreateEncuestum

# Ejecutar migrations
npm run typeorm migration:run

# Revertir última
npm run typeorm migration:revert
```

### Testing
```bash
# Tests unitarios
npm run test

# Tests con coverage
npm run test:cov

# Tests e2e
npm run test:e2e
```

### Build & Deploy
```bash
# Build para producción
npm run build

# Docker build
docker build -t abet-surveys:latest .

# Docker run
docker run -p 3000:3000 -e DB_HOST=... abet-surveys:latest
```

### Debugging
```bash
# Debug mode
node --inspect-brk dist/main.js

# VSCode launch config
{
  "type": "node",
  "request": "attach",
  "name": "Attach debugger",
  "port": 9229,
  "skipFiles": ["<node_internals>/**"]
}
```

---

**Documento generado**: 2025-05-13  
**Versión**: 1.0  
**Roadmap**: 7 Fases (9 semanas)  
**Status**: Listo para Implementación
