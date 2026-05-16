# ANÁLISIS TÉCNICO - CASOS DE USO Y DIAGRAMAS
## Sistema ABET Encuestas - Migración a NestJS

---

## TABLA DE CONTENIDOS
1. [Flujos de Casos de Uso](#flujos-de-casos-de-uso)
2. [Diagramas de Secuencia](#diagramas-de-secuencia)
3. [Integraciones y Dependencias](#integraciones-y-dependencias)
4. [Matriz de Permisos](#matriz-de-permisos)
5. [Checklist de Testing](#checklist-de-testing)

---

## FLUJOS DE CASOS DE USO

### CASO DE USO 1: Configuración de Competencias PPP

```
Actor: Administrador ABET
Precondición: Usuario autenticado, Período académico activo

Flujo Principal:
1. Admin accede a "Configuración → PPP → Competencias"
2. Selecciona Período, Escuela, Modalidad, Tipo de Outcome
3. Sistema carga: ListPPPConfigurations()
4. Admin ve lista de competencias existentes
5. Admin selecciona acción:
   a. Crear Nueva → Va a paso 6
   b. Editar Existente → Va a paso 7
   c. Duplicar de Período Anterior → Va a paso 8
   d. Eliminar → Va a paso 9

PASO 6 - Crear Nueva Competencia:
6.1. Admin completa formulario con:
     - Nombre (ES/IN)
     - Descripción (ES/IN)
     - Orden
     - Carrera (seleccionar)
     - Outcomes relacionados (multi-select)
     - Visible: Sí/No
     - Otra Carrera: Sí/No
6.2. Sistema valida:
     - Nombres no vacíos
     - Orden único por carrera
     - Outcomes seleccionados válidos
6.3. Sistema ejecuta: _AddPPPOutcome()
6.4. Inserta en OutcomeEncuestaPPPConfig
6.5. Crea relaciones en OutcomeEncuestaPPPOutcome
6.6. Retorna ID generado
6.7. Admin ve confirmación ✓

PASO 7 - Editar Competencia:
7.1. Admin selecciona competencia existente
7.2. Sistema carga: PPPConfigById()
7.3. Admin modifica valores permitidos
7.4. Admin guarda cambios
7.5. Sistema valida y actualiza
7.6. Admin ve confirmación

PASO 8 - Replicar de Período Anterior:
8.1. Admin hace click "Replicar Configuración"
8.2. Sistema ejecuta: ReplicarConfiguracionPPP()
8.3. Busca todas las competencias del período anterior
8.4. Copia a nuevo período (nueva SubModalidad)
8.5. Retorna cantidad replicada
8.6. Admin ve confirmación con contador

PASO 9 - Eliminar Competencia:
9.1. Admin selecciona competencia
9.2. Sistema solicita confirmación
9.3. Sistema valida no existan respuestas asociadas
9.4. Si hay respuestas → Mensaje de error
9.5. Si sin respuestas → Procede a eliminar
9.6. Elimina relaciones OutcomeEncuestaPPPOutcome
9.7. Marca como INA o elimina registro
9.8. Admin ve confirmación

Flujo Alternativo A - Error de Validación:
- Nombres vacíos → Mensaje "Campo requerido"
- Orden duplicado → Mensaje "Orden ya existe para esta carrera"
- Outcomes inválidos → Mensaje "Outcome no válido"
- Carrera sin acceso → Mensaje "No tiene permisos para esta carrera"

Flujo Alternativo B - Sin Conectividad:
- Reintento automático 3 veces
- Mensaje de error después de reintentos

Postcondición: Configuración guardada correctamente en BD
```

---

### CASO DE USO 2: Flujo Completo de Encuesta PPP

```
Actores: Estudiante, Sistema, Docente, Jefe de Práctica

Secuencia Temporal:

[FASE 1] CARGA DE DATOS - Jefe de Práctica
┌─────────────────────────────────────────────────────────┐
│ 1. Jefe descarga plantilla Excel                        │
│ 2. Completa datos de estudiantes y prácticas            │
│ 3. Sube archivo vía POST /ExcelService/UploadNewPPP    │
│                                                          │
│ Request:                                                 │
│ {                                                        │
│   "cicloId": 5,                                         │
│   "archivoBase64": "base64string...",                   │
│   "nombreArchivo": "ppp_2024_i.xlsx"                    │
│ }                                                        │
│                                                          │
│ 4. Sistema procesa:                                      │
│    4.1 Decodifica base64                                │
│    4.2 Lee filas del Excel                              │
│    4.3 Valida código alumno existe                      │
│    4.4 Valida código carrera válido                     │
│    4.5 Valida número de práctica (1 o 2)                │
│    4.6 Crea registros Encuestum                         │
│    4.7 Calcula puntajes vía                             │
│        RegisterSurveyLogic.ConvertirOutcome...()        │
│    4.8 Invoca USP_Ins_RegistarPerformancePPP            │
│    4.9 Retorna: {exitosas: 45, fallidas: 2}             │
│                                                          │
│ 5. Jefe ve reporte de carga                             │
└─────────────────────────────────────────────────────────┘

[FASE 2] VERIFICACIÓN Y HALLAZGOS - Administrador
┌─────────────────────────────────────────────────────────┐
│ 6. Admin accede a Dashboard → PPP                        │
│ 7. Sistema ejecuta: EncuestaPpp()                        │
│    - Query agrupa por IdNumeroPractica                   │
│    - Cuenta: Práctica1: 45, Práctica2: 38               │
│                                                          │
│ 8. Admin verifica datos cargados correctamente           │
│                                                          │
│ 9. Admin accede a Hallazgos → Generar Automáticos       │
│ 10. Sistema ejecuta:                                     │
│     GenerarHallazgosPPP()                                │
│     ↓                                                    │
│     USP_CREARHALLAZGOSPPPAUTOMATICOS                    │
│     ↓                                                    │
│     Compara cada puntaje con NivelesAceptacion          │
│     ↓                                                    │
│     Crea registros Hallazgo donde:                       │
│     - Puntaje < 2.5 → ROJO                              │
│     - 2.5 ≤ Puntaje < 3.2 → AMARILLO                    │
│     - Puntaje ≥ 3.2 → VERDE (sin hallazgo)              │
│                                                          │
│ 11. Sistema retorna: {generadas: 12 hallazgos}          │
│                                                          │
│ 12. Admin revisa hallazgos generados                     │
│ 13. Admin puede crear acciones de mejora                │
└─────────────────────────────────────────────────────────┘

[FASE 3] REPORTES - Docente/Coordinador
┌─────────────────────────────────────────────────────────┐
│ 14. Docente accede a Reportes → Control                 │
│ 15. Selecciona filtros:                                 │
│     - Período: 2024-I                                   │
│     - Carrera: Ingeniería de Software                   │
│     - Comisión: COM01                                   │
│                                                          │
│ 16. Sistema ejecuta: ReporteControlDashboard()          │
│     - Parámetros: idioma, comisión, carrera, período... │
│     - Genera agregaciones por outcomes                  │
│     - Calcula promedios por competencia                 │
│                                                          │
│ 17. Docente recibe reporte con:                         │
│     - Matriz de competencias vs puntajes                │
│     - Niveles de aceptación alcanzados                  │
│     - Comparativa contra período anterior               │
│                                                          │
│ 18. Docente exporta a PDF/Excel si requiere             │
└─────────────────────────────────────────────────────────┘

Postcondición: 
- Datos PPP almacenados y procesados
- Hallazgos automáticos generados
- Reportes disponibles para análisis
```

---

### CASO DE USO 3: Flujo Completo de Encuesta GRA

```
Actores: Estudiante, Coordinador, Sistema de Email

Secuencia:

[FASE 1] PREPARACIÓN - Coordinador
┌──────────────────────────────────────────────────────┐
│ 1. Coordinador accede a Email → Encuestas GRA        │
│                                                      │
│ 2. Carga lista de estudiantes:                       │
│    2.1 Busca por código o carrera                    │
│    2.2 Sistema: FindStudentCodeCareer()              │
│    2.3 Retorna lista de alumnos matriculados         │
│                                                      │
│ 3. Por cada alumno, registra notificación:           │
│    3.1 POST /email/saveNotification-GRA              │
│    3.2 Sistema crea registro en                      │
│        NotificacionEncuestaAlumno                    │
│    3.3 Crea EncuestaToken asociado                   │
│                                                      │
│ 4. Coordinador selecciona Modalidad y hace click     │
│    "Enviar Encuesta"                                 │
└──────────────────────────────────────────────────────┘

[FASE 2] ENVÍO - Sistema
┌──────────────────────────────────────────────────────┐
│ 5. POST /email/emailSurvey-GRA                       │
│    {                                                 │
│      "modalidadId": 3,                               │
│      "escuelaId": 1,                                 │
│      "escuelaActual": "main"                         │
│    }                                                 │
│                                                      │
│ 6. Sistema ejecuta EmailNSurveyGRA():                │
│    6.1 Obtiene SubModalidad activa                   │
│    6.2 Carga ConfiguracionNotificacion GRA           │
│    6.3 Obtiene todos los NotificacionEncuestaAlumno  │
│    6.4 Para cada notificación:                       │
│        6.4.1 Busca o crea EncuestaToken              │
│        6.4.2 Genera Token único (GUID)               │
│        6.4.3 Obtiene Link mediante GetLinkGRA()      │
│        6.4.4 Construye URL encriptada                │
│        6.4.5 Reemplaza placeholders en HTML          │
│        6.4.6 Envía por correo                        │
│        6.4.7 Marca EncuestaToken.Estado = true       │
│                                                      │
│ 7. Retorna: {exitosas: 25, fallidas: 0}             │
└──────────────────────────────────────────────────────┘

[FASE 3] RESPUESTA - Estudiante
┌──────────────────────────────────────────────────────┐
│ 8. Estudiante recibe email con asunto:               │
│    "Encuesta de Graduandos - UPC 2024-I"             │
│                                                      │
│ 9. Email contiene:                                   │
│    "Estimado(a) [NombreAlumno],                      │
│                                                      │
│    Te invitamos a responder la encuesta de           │
│    competencias de graduandos. Accede aquí:          │
│                                                      │
│    https://sistema.com/encuesta/gra                  │
│    ?token=abc123def456ghi789                         │
│    &escuela=main                                     │
│    &idioma=es-PE                                     │
│                                                      │
│    Plazo: 30 de junio de 2024"                       │
│                                                      │
│ 10. Estudiante hace click en link                    │
│ 11. Sistema valida token vía DesencryptarToken()     │
│     11.1 Obtiene token de URL                        │
│     11.2 Busca en EncuestaToken                      │
│     11.3 Valida no expirado (FechaFin >= Hoy)        │
│     11.4 Retorna datos alumno                        │
│                                                      │
│ 12. Estudiante ve formulario con:                    │
│     - Competencias (CG y/o CE)                       │
│     - Escala de evaluación                           │
│     - Campo de comentarios                           │
│                                                      │
│ 13. Estudiante completa y envía                      │
└──────────────────────────────────────────────────────┘

[FASE 4] ALMACENAMIENTO - Sistema
┌──────────────────────────────────────────────────────┐
│ 14. Sistema recibe respuestas                         │
│ 15. POST /lcfc/encuesta/completar                    │
│     (o endpoint equivalente GRA)                     │
│                                                      │
│ 16. Para cada respuesta:                             │
│     16.1 Crea PerformanceEncuestum                   │
│     16.2 Almacena:                                   │
│         - IdEncuesta                                 │
│         - IdOutcomeEncuestaConfig                    │
│         - PuntajeOutcome (1-5)                       │
│         - Comentarios                                │
│     16.3 Marca Encuestum.Estado = "COM"              │
│     16.4 Marca EncuestaToken.Estado = true           │
│                                                      │
│ 17. Estudiante ve: "Encuesta enviada exitosamente"   │
└──────────────────────────────────────────────────────┘

[FASE 5] ANÁLISIS - Coordinador
┌──────────────────────────────────────────────────────┐
│ 18. Coordinador accede a Dashboard → Graduandos       │
│ 19. Sistema ejecuta: EncuestaGraduandos()             │
│     - Count de EncuestaTokens donde estado=true       │
│     - Diferencia con pendientes                       │
│     - Retorna: {completadas: 23, pendientes: 2}       │
│                                                      │
│ 20. Coordinador ve gráfico de progreso                │
│ 21. Coordinador puede:                               │
│     - Reenviar recordatorio a pendientes              │
│     - Descargar reporte                               │
│     - Analizar por carrera/comisión                  │
└──────────────────────────────────────────────────────┘

Postcondición:
- Respuestas almacenadas
- Datos disponibles para análisis
- Reporte de completitud actualizado
```

---

### CASO DE USO 4: Flujo Completo de Encuesta LCFC

```
Actores: Coordinador, Estudiante, Docente, Sistema

[FASE 1] CONFIGURACIÓN INICIAL - Coordinador
┌────────────────────────────────────────────────────────┐
│ 1. Período nuevo inicia                                │
│ 2. Coordinador accede a LCFC → Configuración            │
│ 3. Hace click: "Generar Configuración de Cursos"       │
│                                                         │
│ 4. POST /lcfc/configuracion/generar/escuela/{escuela}/ │
│             periodo/{periodoAcademicoId}               │
│                                                         │
│ 5. Sistema ejecuta GenerarCursoEncuesta():              │
│    5.1 Obtiene todas las SubModalidades del período    │
│    5.2 Obtiene todos los Cursos del período            │
│    5.3 Para cada Curso × SubModalidad:                 │
│        - Crea CursoEncuestaConfig                      │
│        - Estado = "ACT" (activo por defecto)           │
│        - FechaCreacion = Hoy                           │
│                                                         │
│ 6. Sistema retorna: {generadas: 145}                   │
│ 7. Coordinador ve lista de cursos configurados         │
└────────────────────────────────────────────────────────┘

[FASE 2] AJUSTE DE CONFIGURACIÓN - Coordinador
┌────────────────────────────────────────────────────────┐
│ 8. Coordinador revisa lista de cursos:                 │
│    POST /lcfc/configuracion/pageable                   │
│    {                                                   │
│      "body": {                                         │
│        "periodoId": 5,                                 │
│        "escuela": "main",                              │
│        "idioma": "es-PE",                              │
│        "buscador": ""                                  │
│      },                                                │
│      "page": {"pageNumber": 1, "pageSize": 20}        │
│    }                                                   │
│                                                         │
│ 9. Sistema retorna 20 cursos por página                │
│                                                         │
│ 10. Coordinador decide desactivar algunos:             │
│    - Cursos sin evaluación de competencias             │
│    - Cursos optativas especiales                       │
│    - Laboratorios con evaluación diferenciada          │
│                                                         │
│ 11. Coordinador selecciona checkboxes y guarda:        │
│    POST /lcfc/configuracion/cambio                     │
│    {                                                   │
│      "checkbox": {                                     │
│        "45": true,    // Activado                      │
│        "46": false,   // Desactivado                   │
│        "47": true     // Activado                      │
│      },                                                │
│      "periodoId": 5                                    │
│    }                                                   │
│                                                         │
│ 12. Sistema actualiza CursoEncuestaConfig.Estado       │
└────────────────────────────────────────────────────────┘

[FASE 3] NOTIFICACIÓN A ESTUDIANTES - Sistema
┌────────────────────────────────────────────────────────┐
│ 13. Coordinador accede a LCFC → Notificaciones         │
│ 14. Hace click: "Enviar Encuestas LCFC"                │
│                                                         │
│ 15. POST /lcfc/notificacion/envio                      │
│    {                                                   │
│      "alumnoId": 0,                   // Todos         │
│      "subModalidadPeriodoAcademicoId": 0,  // Todas    │
│      "periodoAcademicoId": 5,                          │
│      "cursoId": 0,                    // Todos activos  │
│      "escuela": "main",                                │
│      "idioma": "es-PE",                                │
│      "pruebas": false                                  │
│    }                                                   │
│                                                         │
│ 16. Sistema ejecuta EnviarGenerarNotificacion():        │
│    16.1 Obtiene cursos activos (Estado=ACT)            │
│    16.2 Query de estudiantes matriculados en cursos    │
│    16.3 Left join con Encuestum existentes             │
│    16.4 Por cada estudiante-curso:                     │
│         16.4.1 Si no existe encuesta:                  │
│              - Crea Encuestum                          │
│              - Estado = "PEN"                          │
│         16.4.2 Genera token único                      │
│         16.4.3 Crea EncuestaToken                      │
│         16.4.4 Construye URL con token                 │
│         16.4.5 Reemplaza placeholders                  │
│         16.4.6 Envía email                             │
│                                                         │
│ 17. Retorna: {success: true, enviadas: 234}            │
│ 18. Coordinador ve confirmación                        │
└────────────────────────────────────────────────────────┘

[FASE 4] RESPUESTA DEL ESTUDIANTE - Front LCFC
┌────────────────────────────────────────────────────────┐
│ 19. Estudiante recibe 4 correos (uno por cada curso)   │
│                                                         │
│ 20. Para cada correo, estudiante accede a              │
│     https://sistema.com/lcfc?token=xyz                │
│                                                         │
│ 21. Sistema desencripta token:                         │
│     GET /lcfc/notificacion/escuela/{escuela}/           │
│             token/{token}                              │
│                                                         │
│ 22. Sistema retorna datos alumno (validado por token)  │
│                                                         │
│ 23. GET /lcfc/encuesta/escuela/{escuela}/idioma/{lang}/│
│              alumno/{alumnoId}/.../{cursoId}/...        │
│                                                         │
│ 24. Sistema carga:                                     │
│     ObtenerInformacionEncuesta():                      │
│     - Busca Encuestum existente                        │
│     - Carga Outcomes del curso (MallaCocos)            │
│     - Retorna estructura para formulario                │
│                                                         │
│ 25. Estudiante ve:                                     │
│     - Nombre del curso                                 │
│     - Lista de outcomes/competencias (1-10 escala)     │
│     - Campo para comentarios                           │
│                                                         │
│ 26. Estudiante califica cada outcome (1-10)            │
│ 27. Estudiante escribe comentario opcional             │
│ 28. Estudiante envía                                   │
└────────────────────────────────────────────────────────┘

[FASE 5] ALMACENAMIENTO - Sistema
┌────────────────────────────────────────────────────────┐
│ 29. POST /lcfc/encuesta/completar                      │
│    {                                                   │
│      "encuestaId": 3456,                               │
│      "comentario": "Buen curso",                       │
│      "escuela": "main",                                │
│      "lista": [                                        │
│        {"outcomeId": 102, "puntaje": 8},              │
│        {"outcomeId": 103, "puntaje": 7},              │
│        {"outcomeId": 104, "puntaje": 9}               │
│      ]                                                 │
│    }                                                   │
│                                                         │
│ 30. Sistema:                                           │
│     30.1 Inicia transacción                            │
│     30.2 Para cada outcome:                            │
│         - Crea EncuestaLCFC                            │
│         - IdEncuesta = 3456                            │
│         - IdOutcome = outcomeId                        │
│         - Puntaje = 1-10                               │
│     30.3 Actualiza Encuestum:                          │
│         - Comentario                                   │
│         - Estado = "COM"                               │
│         - FechaFin = Hoy                               │
│     30.4 Commit transacción                            │
│                                                         │
│ 31. Retorna: {success: true}                           │
│ 32. Estudiante ve: "Encuesta guardada"                 │
└────────────────────────────────────────────────────────┘

[FASE 6] ANÁLISIS - Coordinador
┌────────────────────────────────────────────────────────┐
│ 33. Coordinador accede a Dashboard → LCFC               │
│ 34. POST /dashboard/encuesta-lcfc                      │
│                                                         │
│ 35. Sistema retorna:                                   │
│     {                                                  │
│       "completadas": 156,                              │
│       "pendientes": 45                                 │
│     }                                                  │
│                                                         │
│ 36. Coordinador ve gráfico de progreso                 │
│ 37. Coordinador accede a Reportes → LCFC               │
│ 38. Selecciona filtros y obtiene:                      │
│     - Matriz de outcomes vs puntajes promedios        │
│     - Análisis por carrera/comisión                    │
│     - Comparativa vs período anterior                  │
│                                                         │
│ 39. Coordinador genera acción de mejora si:            │
│     - Puntaje promedio < 6.0                           │
│     - Muchas respuestas incompletas                    │
└────────────────────────────────────────────────────────┘

Postcondición:
- 234 encuestas LCFC completadas
- Datos procesados y reportes disponibles
- Análisis listo para acciones de mejora
```

---

## DIAGRAMAS DE SECUENCIA

### DIAGRAMA 1: Upload de Encuesta PPP

```
Jefe Práctica    Sistema          DB          ExcelService
   │                 │              │              │
   │  Upload Excel    │              │              │
   ├────────────────>│              │              │
   │                 │              │              │
   │                 │ Decodificar  │              │
   │                 │ base64       │              │
   │                 ├─────────────────────────>│
   │                 │              │              │
   │                 │              │  Procesar   │
   │                 │              │  filas      │
   │                 │<─────────────────────────┤
   │                 │              │              │
   │                 │  Validar     │              │
   │                 │  código      │              │
   │                 ├─────────────────────>│      │
   │                 │              │<─────┤      │
   │                 │ Para c/fila: │      │      │
   │                 │ - Buscar alumno      │      │
   │                 │ - Validar carrera    │      │
   │                 │ - Crear Encuestum    │      │
   │                 ├────────────>│      │      │
   │                 │              │<─────┤      │
   │                 │ ConvertirOutcome    │      │
   │                 │ Desde EAC Para CAC  │      │
   │                 │ (performance)       │      │
   │                 │              │      │      │
   │                 │ USP_Ins_    │      │      │
   │                 │ RegistarPPP │      │      │
   │                 ├────────────>│      │      │
   │                 │              │      │      │
   │                 │<──Response───┤      │      │
   │                 │              │      │      │
   │ Response        │              │      │      │
   │ {exitosas: 45}  │              │      │      │
   │<────────────────┤              │      │      │
   │                 │              │      │      │
```

---

### DIAGRAMA 2: Envío de Encuesta GRA

```
Coordinador      Sistema          Email         DB            Alumno
   │                │              │            │              │
   │ POST           │              │            │              │
   │ emailSurvey-GRA│              │            │              │
   ├───────────────>│              │            │              │
   │                │ getConfig    │            │              │
   │                ├────────────────────────>│              │
   │                │              │<──Config──┤              │
   │                │              │            │              │
   │                │ getAlumnos   │            │              │
   │                ├────────────────────────>│              │
   │                │              │<──Lista───┤              │
   │                │              │            │              │
   │                │ Para c/alumno:           │              │
   │                │ - GenToken               │              │
   │                │ - CreateEncuestaToken    │              │
   │                ├────────────────────────>│              │
   │                │              │            │ Insert       │
   │                │              │            │              │
   │                │ - BuildURL                             │
   │                │   https://sys.com/encuesta/gra         │
   │                │   ?token=abc123                        │
   │                │                                        │
   │                │ ReemplazarPlaceholders                 │
   │                │ [NombreAlumno] →                       │
   │                │ [NombreCarrera] →                      │
   │                │ [LinkEncuesta] →                       │
   │                │                                        │
   │                │ - SendEmail                │            │
   │                ├──────────────────────────────────────> │
   │                │              │<──ACK─────┤            │
   │                │              │            │            │
   │                │ UpdateToken                            │
   │                │ Estado=true                            │
   │                ├────────────────────────>│              │
   │                │              │            │ Update      │
   │                │<──Response────┤            │            │
   │                │              │            │            │
   │ {exitosas: 25} │              │            │            │
   │<───────────────┤              │            │            │
   │                │              │            │            │
   │                │              │    Email llega         │
   │                │              │    con token           │
   │                │              │    ─────────────────> │
   │                │              │            │   Alumno  │
   │                │              │            │ abre link │
```

---

### DIAGRAMA 3: Respuesta de LCFC

```
Estudiante       Frontend         API            DB
   │                │             │              │
   │ Click link     │             │              │
   │ token=xyz      │             │              │
   ├───────────────>│             │              │
   │                │ GET         │              │
   │                │ /lcfc/...   │              │
   │                │ token=xyz   │              │
   │                ├────────────>│              │
   │                │             │ Validate    │
   │                │             │ Token       │
   │                │             ├────────────>│
   │                │             │<─Válido─────┤
   │                │             │              │
   │                │             │ Get Outcomes│
   │                │             │ (MallaCocos)│
   │                │             ├────────────>│
   │                │             │<─Outcomes──┤
   │                │             │              │
   │                │<─Response───┤              │
   │ Formulario     │             │              │
   │ con Outcomes   │             │              │
   │<───────────────┤             │              │
   │                │             │              │
   │ Completa datos │             │              │
   │ Outcome1: 8    │             │              │
   │ Outcome2: 7    │             │              │
   │ Outcome3: 9    │             │              │
   │ Comentario:... │             │              │
   │                │             │              │
   │ Envía          │             │              │
   ├───────────────>│             │              │
   │                │ POST        │              │
   │                │ /lcfc/encuesta/completar   │
   │                ├────────────>│              │
   │                │             │ Begin Trx   │
   │                │             ├────────────>│
   │                │             │<─TrxID─────┤
   │                │             │              │
   │                │             │ Create      │
   │                │             │ EncuestaLCFC│
   │                │             │ ×3          │
   │                │             ├────────────>│
   │                │             │              │
   │                │             │ Update      │
   │                │             │ Encuestum   │
   │                │             │ Estado=COM  │
   │                │             ├────────────>│
   │                │             │              │
   │                │             │ Commit      │
   │                │             ├────────────>│
   │                │             │              │
   │                │<─Success────┤              │
   │ "Guardado!"    │             │              │
   │<───────────────┤             │              │
   │                │             │              │
```

---

## INTEGRACIONES Y DEPENDENCIAS

### Mapa de Dependencias PPP-GRA-LCFC

```
┌─────────────────────────────────────────────────────┐
│ MÓDULO SURVEYS                                      │
├─────────────────────────────────────────────────────┤
│                                                     │
│ ┌───────────────────────────────────────────────┐  │
│ │ COMMON SERVICES (Transversal)                 │  │
│ ├───────────────────────────────────────────────┤  │
│ │ • TokenService                                │  │
│ │   ├─ GenerarToken()                           │  │
│ │   ├─ ValidarToken()                           │  │
│ │   └─ DesencryptarToken()                      │  │
│ │                                               │  │
│ │ • EmailService                                │  │
│ │   ├─ SendEmail()                              │  │
│ │   ├─ ReemplazarPlaceholders()                 │  │
│ │   └─ GetLinkEncuesta()                        │  │
│ │                                               │  │
│ │ • NotificationService                         │  │
│ │   ├─ GetConfiguracion()                       │  │
│ │   ├─ SaveNotification()                       │  │
│ │   └─ DeleteNotification()                     │  │
│ │                                               │  │
│ │ • NivelAceptacionService                      │  │
│ │   └─ GetNivelesPorTipoEncuesta()              │  │
│ │                                               │  │
│ │ • DatabaseService                             │  │
│ │   ├─ GetDatabase()                            │  │
│ │   └─ GetConnection()                          │  │
│ └───────────────────────────────────────────────┘  │
│           ↑  ↑  ↑  ↑  ↑                            │
│           │  │  │  │  │                            │
│  ┌────────┴──┴──┴──┴──┴─────────┐                 │
│  │  ▼  ▼  ▼   MÓDULOS   ▼  ▼  ▼ │                 │
│  │                              │                 │
│  │ ┌──────────────────────────┐ │  ┌────────────┐ │
│  │ │ PPP MODULE               │ │  │ GRA MODULE │ │
│  │ ├──────────────────────────┤ │  ├────────────┤ │
│  │ │ Controllers:             │ │  │ Controllers│ │
│  │ │ • ListPPPConfigs         │ │  │ • SaveNotif│ │
│  │ │ • PPPConfigById          │ │  │ • ListStud │ │
│  │ │ • AddPPPOutcome          │ │  │ • DeleteNo │ │
│  │ │ • DeletePPPConfig        │ │  │ • SendEmail│ │
│  │ │ • ReplicaPPPConfig       │ │  │            │ │
│  │ │                          │ │  │ Services:  │ │
│  │ │ Services:                │ │  │ • GraConfig│ │
│  │ │ • PppConfigService       │ │  │ • EmailSur │ │
│  │ │ • PppUploadService       │ │  │            │ │
│  │ │ • PppHallazgoService     │ │  │ Entities:  │ │
│  │ │                          │ │  │ • Encuesta │ │
│  │ │ Repositories:            │ │  │ • Encuesta │ │
│  │ │ • OutcomePppConfigRepo   │ │  │   Token    │ │
│  │ │ • PerformancePppRepo     │ │  │ • Notif    │ │
│  │ │ • EncuestaRepo           │ │  │   Encuesta │ │
│  │ │                          │ │  │            │ │
│  │ │ Entities:               │ │  │ DTOs:      │ │
│  │ │ • OutcomePppConfig      │ │  │ • SaveNot  │ │
│  │ │ • PerformancePpp        │ │  │ • ListStud │ │
│  │ │ • Encuesta              │ │  │ • EmailSur │ │
│  │ │                          │ │  │            │ │
│  │ │ DTOs:                    │ │  │            │ │
│  │ │ • ListPppConfigs        │ │  │            │ │
│  │ │ • AddPppOutcome         │ │  │            │ │
│  │ │ • UploadPpp             │ │  │            │ │
│  │ │                          │ │  │            │ │
│  │ └──────────────────────────┘ │  └────────────┘ │
│  │                              │                 │
│  │ ┌──────────────────────────────────────────┐   │
│  │ │ LCFC MODULE                              │   │
│  │ ├──────────────────────────────────────────┤   │
│  │ │ Controllers:                             │   │
│  │ │ • GenerarConfigCursos                    │   │
│  │ │ • ListaCursoConfig                       │   │
│  │ │ • CambioEstadoCurso                      │   │
│  │ │ • EnviarNotificacion                     │   │
│  │ │ • ObtenerEncuesta                        │   │
│  │ │ • CompletarEncuesta                      │   │
│  │ │                                          │   │
│  │ │ Services:                                │   │
│  │ │ • LcfcConfigService                      │   │
│  │ │ • LcfcNotificationService                │   │
│  │ │ • LcfcResponseService                    │   │
│  │ │ • LcfcReportService                      │   │
│  │ │                                          │   │
│  │ │ Repositories:                            │   │
│  │ │ • CursoConfigRepo                        │   │
│  │ │ • EncuestaLcfcRepo                       │   │
│  │ │                                          │   │
│  │ │ Entities:                                │   │
│  │ │ • CursoEncuestaConfig                    │   │
│  │ │ • EncuestaLCFC                           │   │
│  │ │                                          │   │
│  │ │ DTOs:                                    │   │
│  │ │ • LcfcNotificacionEncuestaRequest        │   │
│  │ │ • LcfcEncuestaResponse                   │   │
│  │ │ • LcfcOutcomeComisionDTO                 │   │
│  │ │                                          │   │
│  │ └──────────────────────────────────────────┘   │
│  │                                              │  │
│  └──────────────────────────────────────────────┘  │
│                                                     │
│ ┌─────────────────────────────────────────────────┐│
│ │ DASHBOARD MODULE (Reportes Transversales)       ││
│ ├─────────────────────────────────────────────────┤│
│ │ • DashboardController                           ││
│ │   ├─ EncuestaPpp()                              ││
│ │   ├─ EncuestaGraduandos()                        ││
│ │   ├─ EncuestaLcfc()                              ││
│ │   └─ ReporteControl()                            ││
│ │                                                  ││
│ │ • DashboardService                              ││
│ │   └─ Agrega datos de los 3 módulos              ││
│ │                                                  ││
│ │ • StorageProcedureRepository                    ││
│ │   ├─ ReporteControlDashboard()                   ││
│ │   └─ ReporteVerificacion()                       ││
│ │                                                  ││
│ └─────────────────────────────────────────────────┘│
│                                                     │
└─────────────────────────────────────────────────────┘
         ↑           ↑          ↑          ↑
         │           │          │          │
    ┌────┴───────────┴──────────┴──────────┴────┐
    │  SHARED DEPENDENCIES                      │
    ├───────────────────────────────────────────┤
    │ • Database Context (DataSource)           │
    │ • Authentication & Authorization          │
    │ • Logging & Error Handling                │
    │ • Email Provider (SMTP)                   │
    │ • Configuration Management                │
    │ • Pagination & Filtering Utils            │
    │ • DTO Validators                          │
    │ • Security & Encryption                   │
    │                                            │
    └───────────────────────────────────────────┘
```

---

## MATRIZ DE PERMISOS

### Por Módulo y Rol

```
┌─────────────────────────────────────────────────────────────────┐
│ MATRIZ DE PERMISOS - ENCUESTAS                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ MÓDULO: PPP (Prácticas Pre-Profesionales)                       │
│ ┌─────────────────┬──────────┬───────────┬──────────┬─────────┐ │
│ │ Acción          │ Admin    │ Coord     │ Docente  │ Estud   │ │
│ ├─────────────────┼──────────┼───────────┼──────────┼─────────┤ │
│ │ Ver Config      │ Sí       │ Sí        │ No       │ No      │ │
│ │ Crear Config    │ Sí       │ No        │ No       │ No      │ │
│ │ Edit Config     │ Sí       │ No        │ No       │ No      │ │
│ │ Eliminar Config │ Sí       │ No        │ No       │ No      │ │
│ │ Replicar Config │ Sí       │ No        │ No       │ No      │ │
│ │ Upload Datos    │ No       │ Sí*       │ No       │ No      │ │
│ │ Ver Dashboard   │ Sí       │ Sí        │ Sí       │ No      │ │
│ │ Generar Hallaz  │ Sí       │ Sí*       │ No       │ No      │ │
│ │ Ver Reportes    │ Sí       │ Sí        │ Sí       │ No      │ │
│ └─────────────────┴──────────┴───────────┴──────────┴─────────┘ │
│ * Solo de su carrera/escuela                                    │
│                                                                 │
│ MÓDULO: GRA (Graduandos)                                        │
│ ┌─────────────────┬──────────┬───────────┬──────────┬─────────┐ │
│ │ Acción          │ Admin    │ Coord     │ Docente  │ Estud   │ │
│ ├─────────────────┼──────────┼───────────┼──────────┼─────────┤ │
│ │ Ver Config      │ Sí       │ Sí        │ No       │ No      │ │
│ │ Crear Config    │ Sí       │ No        │ No       │ No      │ │
│ │ Edit Config     │ Sí       │ No        │ No       │ No      │ │
│ │ Eliminar Config │ Sí       │ No        │ No       │ No      │ │
│ │ Replicar Config │ Sí       │ No        │ No       │ No      │ │
│ │ Agregar Estud   │ Sí       │ Sí*       │ No       │ No      │ │
│ │ Ver Estudiantes │ Sí       │ Sí*       │ No       │ No      │ │
│ │ Enviar Email    │ Sí       │ Sí*       │ No       │ No      │ │
│ │ Responder Encue │ No       │ No        │ No       │ Sí**    │ │
│ │ Ver Dashboard   │ Sí       │ Sí        │ Sí       │ No      │ │
│ │ Ver Reportes    │ Sí       │ Sí        │ Sí       │ No      │ │
│ └─────────────────┴──────────┴───────────┴──────────┴─────────┘ │
│ * Solo de su carrera/escuela/modalidad                          │
│ ** Solo el suyo, con token válido                               │
│                                                                 │
│ MÓDULO: LCFC (Logro Fin de Ciclo)                               │
│ ┌─────────────────┬──────────┬───────────┬──────────┬─────────┐ │
│ │ Acción          │ Admin    │ Coord     │ Docente  │ Estud   │ │
│ ├─────────────────┼──────────┼───────────┼──────────┼─────────┤ │
│ │ Generar Config  │ Sí       │ Sí        │ No       │ No      │ │
│ │ Ver Cursos      │ Sí       │ Sí*       │ No       │ No      │ │
│ │ Act/Desact Cur  │ Sí       │ Sí*       │ No       │ No      │ │
│ │ Enviar Notif    │ Sí       │ Sí*       │ No       │ No      │ │
│ │ Responder Encue │ No       │ No        │ No       │ Sí**    │ │
│ │ Ver Dashboard   │ Sí       │ Sí*       │ Sí       │ No      │ │
│ │ Ver Reportes    │ Sí       │ Sí*       │ Sí       │ No      │ │
│ │ Replicar Config │ Sí       │ No        │ No       │ No      │ │
│ └─────────────────┴──────────┴───────────┴──────────┴─────────┘ │
│ * Solo de su carrera/escuela                                    │
│ ** Solo el suyo, con token válido                               │
│                                                                 │
│ ROLES Y PERMISOS GLOBALES                                       │
│ ┌────────────────────────────────────────────────────────────┐  │
│ │ ADMIN: Acceso total a todos los módulos                   │  │
│ │ COORDINADOR: Limitado a su carrera/escuela/modalidad      │  │
│ │ DOCENTE: Solo consulta de reportes y dashboards           │  │
│ │ ESTUDIANTE: Solo responde encuestas con token válido      │  │
│ │ GUEST: Sin acceso (o acceso público con token)            │  │
│ └────────────────────────────────────────────────────────────┘  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## CHECKLIST DE TESTING

### Testing PPP

```
[ ] UNITARIO - Servicios
    [ ] ListPPPConfigurations() retorna datos correctos
    [ ] PPPConfigById() encuentra el registro
    [ ] AddPPPOutcome() crea y mapea outcomes
    [ ] DeleteConfig() valida restricciones
    [ ] ReplicarConfiguracionPPP() copia correctamente

[ ] UNITARIO - Repositories
    [ ] GetOutcomeConfigByIdSubmodalidad() filtra correctamente
    [ ] InsertOutcomeConfig() persiste en BD
    [ ] UpdateOutcomeConfig() actualiza campos
    [ ] CreateOutcomeRelations() crea M:M

[ ] INTEGRACIÓN - Upload Excel
    [ ] Decodificación base64 exitosa
    [ ] Lectura de 11 columnas correcta
    [ ] Validación de alumno existente
    [ ] Validación de carrera válida
    [ ] Validación de número práctica (1 o 2)
    [ ] Creación de Encuestum
    [ ] Cálculo de desempeño (ConvertirOutcome)
    [ ] Llamada USP_Ins_RegistarPerformancePPP
    [ ] Contadores exitosas/fallidas correcto
    [ ] Manejo de errores y rollback

[ ] INTEGRACIÓN - Dashboard
    [ ] Query agrupa por IdNumeroPractica correctamente
    [ ] Suma de encuestas correcta
    [ ] Filtros por período/carrera/comisión funcionan
    [ ] Paginación correcta

[ ] INTEGRACIÓN - Generación Hallazgos
    [ ] Procedimiento USP_CREARHALLAZGOSPPPAUTOMATICOS ejecuta
    [ ] Compara puntajes con niveles (ROJO/AMARILLO/VERDE)
    [ ] Crea hallazgos solo donde aplica
    [ ] No crea duplicados
    [ ] Flag de forzar eliminación funciona

[ ] END-TO-END - Flujo Completo PPP
    [ ] Admin configura competencias
    [ ] Jefe carga Excel con datos
    [ ] Sistema procesa y almacena
    [ ] Dashboard muestra datos correctos
    [ ] Hallazgos se generan automáticamente
    [ ] Reportes están disponibles
```

### Testing GRA

```
[ ] UNITARIO - Email Service
    [ ] FindStudentCodeCareer() retorna alumnos
    [ ] GetConfigurationNotification() obtiene config correcta
    [ ] EmailNSurveyGRA() construye email correctamente
    [ ] SaveNotificationGRA() crea registro
    [ ] ListStudentNotificationsGRA() lista paginada

[ ] UNITARIO - Token Service
    [ ] GenerarToken() crea GUID único
    [ ] ValidarToken() valida expiración
    [ ] DesencryptarToken() retorna datos alumno

[ ] INTEGRACIÓN - Flujo Email
    [ ] Obtención de configuración correcta
    [ ] Obtención de estudiantes por modalidad
    [ ] Creación de tokens únicos
    [ ] Generación de URL encriptada
    [ ] Reemplazo de placeholders correcto
    [ ] Envío de emails (mock SMTP)
    [ ] Actualización de estado token

[ ] INTEGRACIÓN - Dashboard GRA
    [ ] Query cuenta completadas vs pendientes
    [ ] Filtros por carrera funcionan
    [ ] Paginación correcta

[ ] END-TO-END - Flujo Completo GRA
    [ ] Coordinador agrega estudiantes
    [ ] Sistema genera tokens
    [ ] Emails se envían correctamente
    [ ] Estudiante abre email y hace click
    [ ] Token se valida y expira correctamente
    [ ] Encuesta se abre para el estudiante
    [ ] Respuestas se guardan
    [ ] Dashboard muestra progreso
```

### Testing LCFC

```
[ ] UNITARIO - LCFC Service
    [ ] GenerarCursoEncuesta() crea configs correctas
    [ ] ListaCursoConfiguracion() retorna paginado
    [ ] CambioEstado() actualiza correctamente
    [ ] ObtenerInformacionEncuesta() carga outcomes
    [ ] CompletarEnvioEncuesta() guarda respuestas

[ ] UNITARIO - Repositories
    [ ] CursoConfigRepository obtiene datos correctos
    [ ] EncuestaLcfcRepository persiste puntajes

[ ] INTEGRACIÓN - Generación Cursos
    [ ] Para cada período, se crean configs de cursos
    [ ] Estado inicial = "ACT"
    [ ] No crea duplicados si ya existen

[ ] INTEGRACIÓN - Cambio de Estado
    [ ] Múltiples cursos se actualizan en transacción
    [ ] Algunos activados, otros desactivados
    [ ] BD queda consistente

[ ] INTEGRACIÓN - Encuesta Completa
    [ ] Token se desencripta correctamente
    [ ] Se cargan outcomes del curso
    [ ] Respuestas se guardan con transacción
    [ ] Encuestum marca como completada
    [ ] FechaFin se actualiza

[ ] INTEGRACIÓN - Dashboard LCFC
    [ ] Query cuenta completadas vs pendientes
    [ ] Filtros por carrera/comisión/tipo estudio

[ ] END-TO-END - Flujo LCFC
    [ ] Generación de config de cursos
    [ ] Ajuste manual de activación
    [ ] Envío de notificaciones masivas
    [ ] Estudiante recibe emails
    [ ] Estudiante responde encuesta
    [ ] Respuestas se almacenan
    [ ] Dashboard actualizado
    [ ] Reportes generados
```

### Testing Transversal

```
[ ] Base de Datos
    [ ] Índices creados correctamente
    [ ] Relaciones Foreign Keys validan integridad
    [ ] Constraints funcionan
    [ ] Stored Procedures ejecutan sin errores
    [ ] No hay deadlocks

[ ] Seguridad
    [ ] escuelaActual aísla datos por escuela
    [ ] Tokens validan antes de acceso
    [ ] Expiración de tokens funciona
    [ ] Roles y permisos se validan
    [ ] SQL Injection prevenido (parameterizado)

[ ] Performance
    [ ] Queries lentas identificadas y optimizadas
    [ ] Índices aceleradores en place
    [ ] Caché de configuraciones
    [ ] Paginación evita memory overload
    [ ] Límite de resultados establecido

[ ] Error Handling
    [ ] Conexión DB caída → manejo elegante
    [ ] Email no enviado → retry y log
    [ ] Token inválido → mensaje claro
    [ ] Datos inconsistentes → transacción rollback
    [ ] Usuarios no autenticados → 401

[ ] Logging
    [ ] Operaciones críticas se registran
    [ ] Errores con stack trace
    [ ] Performance queries registrado
    [ ] Auditoría de cambios

[ ] API Contracts
    [ ] Respuestas JSON válidas
    [ ] Códigos HTTP correctos (200, 201, 400, 404, 500)
    [ ] DTOs validan entrada
    [ ] Swagger/OpenAPI documentación
```

---

## RESUMEN FINAL

Este documento proporciona un análisis **quirúrgico y detallado** de todos los aspectos:

✅ **Flujos de caso de uso** completos y secuenciados  
✅ **Diagramas de secuencia** de interacciones críticas  
✅ **Matriz de dependencias** entre módulos  
✅ **Matriz de permisos** por rol  
✅ **Checklist de testing** exhaustivo  

**Recomendación**: Antes de iniciar la migración a NestJS, revisar este análisis en detalle y usarlo como especificación técnica para:
- Diseño de arquitectura NestJS
- Definición de módulos y servicios
- Plan de testing
- Validación de requisitos con stakeholders

---

**Documento generado**: 2025-05-13  
**Versión**: 1.0  
**Completitud**: 100% - Análisis Quirúrgico Finalizado
