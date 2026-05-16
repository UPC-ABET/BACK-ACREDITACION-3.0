# ANÁLISIS QUIRÚRGICO - SISTEMA DE ENCUESTAS ABET
## PPP | GRA | LCFC - Especificación Técnica Extremadamente Detallada

**Versión**: 1.0  
**Fecha**: 2025-05-16  
**Nivel de Detalle**: 🔬 QUIRÚRGICO (Análisis microscópico del código y funcionalidad)

---

## TABLA DE CONTENIDOS

1. [INTRODUCCIÓN GENERAL](#introducción-general)
2. [MÓDULO PPP - PRÁCTICAS PRE-PROFESIONALES](#módulo-ppp)
3. [MÓDULO GRA - GRADUANDOS](#módulo-gra)
4. [MÓDULO LCFC - LOGRO DE FIN DE CICLO](#módulo-lcfc)
5. [COMPONENTES TRANSVERSALES](#componentes-transversales)
6. [ANÁLISIS DE DATOS Y PERSISTENCIA](#análisis-de-datos-y-persistencia)
7. [FLUJOS DE NEGOCIO DETALLADOS](#flujos-de-negocio-detallados)
8. [INTEGRACIONES Y DEPENDENCIAS](#integraciones-y-dependencias)

---

## INTRODUCCIÓN GENERAL

### Propósito del Sistema de Encuestas ABET

El sistema de encuestas ABET es un subsistema especializado dentro de UPC-SA-2025-API que gestiona **3 tipos de evaluaciones académicas**:

- **PPP (Prácticas Pre-Profesionales)**: Evaluación de competencias desarrolladas durante prácticas
- **GRA (Graduandos)**: Evaluación de competencias de estudiantes próximos a egresar
- **LCFC (Logro de Fin de Ciclo)**: Evaluación de logros de competencias al término de cada ciclo académico

### Arquitectura Conceptual de Tres Capas

```
CAPA PRESENTACIÓN (Controllers)
├── SurveyController     (PPP & GRA Configuration)
├── EmailController      (GRA Email & Notifications)
└── LcfcController       (LCFC Survey & Configuration)

CAPA LÓGICA (Services)
├── IConfigurationAbetDataService    (PPP & GRA Config)
├── IEmailService                    (GRA Email & Notifications)
└── ILcfcService                     (LCFC Management)

CAPA PERSISTENCIA (Repositories & Context)
├── SQL Server Database
├── Stored Procedures
└── Entity Framework Core ORM
```

### Flujo de Datos General (Alto Nivel)

```
Administrador/Coordinador
         ↓
    [Controller]
         ↓
    [Service Layer]
         ↓
    [Repository Pattern]
         ↓
    [SQL Server DB]
         ↓
    [Stored Procedures / Queries]
```

---

## MÓDULO PPP

### 1. DESCRIPCIÓN FUNCIONAL

**PPP = Prácticas Pre-Profesionales**

Módulo que gestiona la evaluación de competencias de estudiantes durante sus prácticas pre-profesionales en empresas. Las evaluaciones utilizan una **escala de 1 a 5 puntos** y generan automáticamente "hallazgos" (findings) basados en umbrales de aceptación.

### 2. ENDPOINTS PPP - ANÁLISIS DETALLADO

#### 2.1 POST /Survey/list-ppp-configurations

**Propósito**: Obtener lista de competencias PPP configuradas para un período académico

**Ruta Interna en Código**:
```csharp
[HttpPost("list-ppp-configurations")]
public async Task<IActionResult> ListPPPConfigurations(
    [FromBody] ListPPPConfigurationsDTO request)
{
    var response = await configurationAbetDataService
        .ListPPPConfigurations(
            request.idPeriodoAcademico,      // ID del período (ej: 5)
            request.idEscuela,                // ID de escuela (ej: 1)
            request.idTipoutEncuesta,         // Tipo encuesta (PPP=5?)
            request.idParModalidad,           // Modalidad (Presencial/Virtual)
            request.escuelaActual              // Identificador escuela (multi-tenancy)
        );
    return Ok(response);
}
```

**Request DTO Esperado**:
```json
{
  "idPeriodoAcademico": 5,
  "idEscuela": 1,
  "idTipoutEncuesta": "PPP",
  "idParModalidad": 1,
  "escuelaActual": "main"
}
```

**Flujo de Ejecución Interno**:
```
1. Controller valida request (no null, IDs > 0)
2. Llama Service: configurationAbetDataService.ListPPPConfigurations()
3. Service ejecuta query a BD:
   SELECT * FROM OutcomeEncuestaPPPConfig
   WHERE IdSubModalidadPeriodoAcademico = @submodalidadId
   AND IdEscuela = @escuelaId
   AND IdCarrera = @carreraId (if filtered)
4. Mapea resultados a OutcomeEncuestaPPPConfigDTO[]
5. Para cada outcome, carga sus detalles:
   - Nombre (ES/EN)
   - Descripción (ES/EN)
   - Orden
   - Estado (ACT/INA)
   - EsVisible
6. Retorna JSON con array de competencias
```

**Response Esperado**:
```json
{
  "success": true,
  "data": [
    {
      "idOutcomeEncuestaPPPConfig": 101,
      "nombreEspanol": "Análisis Técnico de Requisitos",
      "nombreIngles": "Technical Requirements Analysis",
      "descripcionEspanol": "Capacidad de analizar requisitos técnicos",
      "descripcionIngles": "Ability to analyze technical requirements",
      "orden": 1,
      "idCarrera": 10,
      "idEscuela": 1,
      "estado": "ACT",
      "esVisible": true,
      "otraCarrera": false
    },
    {
      "idOutcomeEncuestaPPPConfig": 102,
      "nombreEspanol": "Comunicación Efectiva",
      "nombreIngles": "Effective Communication",
      "descripcionEspanol": "Capacidad de comunicarse eficientemente",
      "descripcionIngles": "Ability to communicate effectively",
      "orden": 2,
      "idCarrera": 10,
      "idEscuela": 1,
      "estado": "ACT",
      "esVisible": true,
      "otraCarrera": false
    }
  ],
  "totalCount": 2
}
```

**Casos de Uso**:
- Admin/Coordinador accede a pantalla de "Configuración PPP"
- Frontend carga lista de competencias para período/escuela seleccionados
- Muestra tabla con opciones de Editar/Eliminar/Replicar

---

#### 2.2 POST /Survey/get-by-id-ppp-config

**Propósito**: Obtener detalles específicos de UNA configuración PPP

```csharp
[HttpPost("get-by-id-ppp-config")]
public async Task<IActionResult> PPPConfigById(
    [FromBody] PPPConfigByIdDTO request)
{
    var response = await configurationAbetDataService
        .PPPConfigById(
            request.idOutcomeEncuestaPPPConfig,  // ID específico de config
            request.escuelaActual                 // Multi-tenancy
        );
    return Ok(response);
}
```

**Request**:
```json
{
  "idOutcomeEncuestaPPPConfig": 101,
  "escuelaActual": "main"
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "idOutcomeEncuestaPPPConfig": 101,
    "nombreEspanol": "Análisis Técnico de Requisitos",
    "nombreIngles": "Technical Requirements Analysis",
    "descripcionEspanol": "Capacidad de analizar requisitos técnicos",
    "descripcionIngles": "Ability to analyze technical requirements",
    "orden": 1,
    "idCarrera": 10,
    "idTipoOutcome": 5,
    "idEscuela": 1,
    "estado": "ACT",
    "esVisible": true,
    "otraCarrera": false,
    "idSubModalidadPeriodoAcademico": 25,
    
    // Outcomes relacionadas (M:M)
    "outcomes": [
      {
        "idOutcome": 501,
        "nombreEspanol": "Análisis de Código",
        "nombreIngles": "Code Analysis"
      },
      {
        "idOutcome": 502,
        "nombreEspanol": "Documentación Técnica",
        "nombreIngles": "Technical Documentation"
      }
    ]
  }
}
```

**Casos de Uso**:
- Coordinador clickea en competencia para editar
- Formulario se pre-llena con valores
- Usuario puede modificar y guardar cambios

---

#### 2.3 POST /Survey/add-update-ppp-config

**Propósito**: CREAR o ACTUALIZAR una configuración PPP

```csharp
[HttpPost("add-update-ppp-config")]
public async Task<IActionResult> _AddPPPOutcome(
    [FromBody] AddPPPOutcomeDTO model)
{
    var response = await configurationAbetDataService
        ._AddPPPOutcome(model);
    return Ok(response);
}
```

**Request DTO - Crear Nueva**:
```json
{
  "idOutcomeEncuestaPPPConfig": 0,  // 0 = crear nueva, >0 = actualizar
  "nombreEspanol": "Gestión de Proyectos",
  "nombreIngles": "Project Management",
  "descripcionEspanol": "Capacidad de gestionar proyectos de software",
  "descripcionIngles": "Ability to manage software projects",
  "orden": 3,
  "idCarrera": 10,
  "idTipoOutcome": 5,
  "idEscuela": 1,
  "estado": "ACT",
  "esVisible": true,
  "otraCarrera": false,
  "idSubModalidadPeriodoAcademico": 25,
  
  // Lista de outcomes relacionadas (relación M:M)
  "lstOutcomesSeleccionados": [
    501,  // ID de outcome
    502,
    503
  ]
}
```

**Lógica de Creación (Paso a Paso)**:
```
1. Validación:
   - Nombres no vacíos ✓
   - Orden > 0 ✓
   - IdCarrera, IdEscuela válidos ✓
   - IdSubModalidadPeriodoAcademico existe ✓

2. Si idOutcomeEncuestaPPPConfig == 0:
   INSERT INTO OutcomeEncuestaPPPConfig
   (NombreEspanol, NombreIngles, DescripcionEspanol, DescripcionIngles,
    Orden, IdCarrera, IdTipoOutcome, IdEscuela, Estado, EsVisible,
    OtraCarrera, IdSubModalidadPeriodoAcademico)
   VALUES (...)
   → Obtener nuevo ID generado

3. Entonces, ELIMINAR relaciones anteriores:
   DELETE FROM OutcomeEncuestaPPPOutcome
   WHERE IdOutcomeEncuestaPPPConfig = @newId

4. Crear nuevas relaciones M:M:
   Para cada ID en lstOutcomesSeleccionados:
     INSERT INTO OutcomeEncuestaPPPOutcome
     (IdOutcomeEncuestaPPPConfig, IdOutcome)
     VALUES (@newId, @outcomeId)

5. Retornar ID creado/actualizado
```

**Response**:
```json
{
  "success": true,
  "message": "Configuración PPP creada/actualizada exitosamente",
  "data": {
    "idOutcomeEncuestaPPPConfig": 103,
    "nombreEspanol": "Gestión de Proyectos",
    "estado": "ACT"
  }
}
```

---

#### 2.4 DELETE /Survey/Delete-by-Id-config

**Propósito**: ELIMINAR una configuración PPP

```csharp
[HttpDelete("Delete-by-Id-config")]
public async Task<IActionResult> DeleteConfig(
    [FromBody] DeleteConfigDTO model)
{
    var response = await configurationAbetDataService
        .DeleteConfig(model);
    return Ok(response);
}
```

**Request**:
```json
{
  "idOutcomeEncuestaPPPConfig": 103,
  "escuelaActual": "main"
}
```

**Lógica de Eliminación**:
```
1. Validación:
   - Config existe ✓
   - No hay respuestas asociadas (PerformanceEncuestaPPP) ✓
   - Permisos del usuario ✓

2. Si hay respuestas:
   RETORNAR error: "No se puede eliminar. Existen respuestas asociadas."

3. Si sin respuestas:
   DELETE FROM OutcomeEncuestaPPPOutcome
   WHERE IdOutcomeEncuestaPPPConfig = @id
   
   DELETE FROM OutcomeEncuestaPPPConfig
   WHERE IdOutcomeEncuestaPPPConfig = @id

4. Retornar OK
```

---

#### 2.5 POST /Survey/ReplicarConfiguracionPPP

**Propósito**: COPIAR configuración PPP de un período a otro

```csharp
[HttpPost("ReplicarConfiguracionPPP")]
public async Task<IActionResult> ReplicarConfiguracionPPP(
    [FromBody] ReplicarConfiguracionDTO request)
{
    var response = await configurationAbetDataService
        .ReplicarConfiguracionPPP(
            request.IdPeriodoAcademico,  // Período DESTINO
            request.escuelaActual         // Escuela actual
        );
    return Ok(response);
}
```

**Request**:
```json
{
  "IdPeriodoAcademico": 6,  // Período a replicar HACIA
  "escuelaActual": "main"
}
```

**Algoritmo de Replicación**:
```
1. Obtener período anterior (FUENTE):
   SELECT * FROM SubModalidadPeriodoAcademico
   WHERE IdPeriodo = (@targetPeriodo - 1)

2. Obtener todas las configs del período anterior:
   SELECT * FROM OutcomeEncuestaPPPConfig
   WHERE IdSubModalidadPeriodoAcademico = @sourcePeriodoId

3. Para cada configuración encontrada:
   
   3.1 Crear nueva versión en período objetivo:
       INSERT INTO OutcomeEncuestaPPPConfig
       (NombreEspanol, NombreIngles, Descripcion..., Orden,
        IdCarrera, IdTipoOutcome, IdEscuela, IdSubModalidadPeriodoAcademico = @targetPeriodo)
       VALUES (...)
       → Obtener @newId

   3.2 Replicar relaciones M:M:
       SELECT IdOutcome FROM OutcomeEncuestaPPPOutcome
       WHERE IdOutcomeEncuestaPPPConfig = @sourceId
       
       Para cada outcome:
         INSERT INTO OutcomeEncuestaPPPOutcome
         (IdOutcomeEncuestaPPPConfig = @newId, IdOutcome)

4. Retornar contador: {copiadas: N}
```

**Response**:
```json
{
  "success": true,
  "message": "Configuración replicada exitosamente",
  "data": {
    "configsReplicadas": 15,
    "periodo": 6
  }
}
```

---

### 3. DTOs PPP - ESTRUCTURA COMPLETA

#### ListPPPConfigurationsDTO
```csharp
public class ListPPPConfigurationsDTO
{
    public int idPeriodoAcademico { get; set; }      // Período académico
    public int idEscuela { get; set; }                // Escuela/facultad
    public string idTipoutEncuesta { get; set; }      // Tipo ("PPP")
    public int idParModalidad { get; set; }           // Modalidad (1=Presencial)
    public string escuelaActual { get; set; }         // Multi-tenancy
}
```

#### PPPConfigByIdDTO
```csharp
public class PPPConfigByIdDTO
{
    public int idOutcomeEncuestaPPPConfig { get; set; }
    public string escuelaActual { get; set; }
}
```

#### AddPPPOutcomeDTO
```csharp
public class AddPPPOutcomeDTO
{
    public int idOutcomeEncuestaPPPConfig { get; set; }     // 0=create, >0=update
    public string nombreEspanol { get; set; }
    public string nombreIngles { get; set; }
    public string descripcionEspanol { get; set; }
    public string descripcionIngles { get; set; }
    public int orden { get; set; }
    public int idCarrera { get; set; }
    public int idTipoOutcome { get; set; }
    public int idEscuela { get; set; }
    public string estado { get; set; }                // "ACT" o "INA"
    public bool esVisible { get; set; }
    public bool otraCarrera { get; set; }
    public int idSubModalidadPeriodoAcademico { get; set; }
    
    // Relación M:M
    public List<int> lstOutcomesSeleccionados { get; set; }
}
```

#### DeleteConfigDTO
```csharp
public class DeleteConfigDTO
{
    public int idOutcomeEncuestaPPPConfig { get; set; }
    public string escuelaActual { get; set; }
}
```

#### ReplicarConfiguracionDTO
```csharp
public class ReplicarConfiguracionDTO
{
    public int IdPeriodoAcademico { get; set; }
    public string escuelaActual { get; set; }
}
```

---

### 4. ENTIDADES PPP - ESTRUCTURA SQL

#### OutcomeEncuestaPPPConfig

```sql
CREATE TABLE OutcomeEncuestaPPPConfig (
    IdOutcomeEncuestaPPPConfig INT PRIMARY KEY IDENTITY(1,1),
    
    -- Textos Bilingües
    NombreEspanol NVARCHAR(255) NOT NULL,
    NombreIngles NVARCHAR(255) NOT NULL,
    DescripcionEspanol NVARCHAR(MAX) NOT NULL,
    DescripcionIngles NVARCHAR(MAX) NOT NULL,
    
    -- Ordenamiento y Visibilidad
    Orden INT NOT NULL,
    EsVisible BIT NOT NULL DEFAULT 1,
    OtraCarrera BIT NOT NULL DEFAULT 0,
    
    -- Estado
    Estado VARCHAR(3) NOT NULL DEFAULT 'ACT',  -- 'ACT'=Activa, 'INA'=Inactiva
    
    -- Relaciones
    IdCarrera INT NOT NULL FOREIGN KEY REFERENCES Carrera(IdCarrera),
    IdEscuela INT NOT NULL FOREIGN KEY REFERENCES Escuela(IdEscuela),
    IdTipoOutcomeEncuesta INT NOT NULL FOREIGN KEY REFERENCES TipoOutcomeEncuesta(IdTipoOutcomeEncuesta),
    IdSubModalidadPeriodoAcademico INT NOT NULL FOREIGN KEY REFERENCES SubModalidadPeriodoAcademico(IdSubModalidadPeriodoAcademico),
    
    -- Auditoría
    FechaCreacion DATETIME2 NOT NULL DEFAULT GETDATE(),
    FechaModificacion DATETIME2,
    
    -- Índices
    INDEX IX_Carrera_Escuela (IdCarrera, IdEscuela),
    INDEX IX_SubModalidad_Periodo (IdSubModalidadPeriodoAcademico),
    INDEX IX_Estado (Estado)
);
```

#### OutcomeEncuestaPPPOutcome (Relación M:M)

```sql
CREATE TABLE OutcomeEncuestaPPPOutcome (
    IdOutcomeEncuestaPPPOutcome INT PRIMARY KEY IDENTITY(1,1),
    
    IdOutcomeEncuestaPPPConfig INT NOT NULL 
        FOREIGN KEY REFERENCES OutcomeEncuestaPPPConfig(IdOutcomeEncuestaPPPConfig) ON DELETE CASCADE,
    IdOutcome INT NOT NULL 
        FOREIGN KEY REFERENCES Outcome(IdOutcome),
    
    INDEX IX_ConfigOutcome (IdOutcomeEncuestaPPPConfig, IdOutcome)
);
```

#### PerformanceEncuestaPPP (Respuestas de Encuesta)

```sql
CREATE TABLE PerformanceEncuestaPPP (
    IdPerformanceEncuestaPPP INT PRIMARY KEY IDENTITY(1,1),
    
    -- Relaciones
    IdEncuesta INT NOT NULL 
        FOREIGN KEY REFERENCES Encuestum(IdEncuesta),
    IdOutcomeEncuestaPPPConfig INT NOT NULL 
        FOREIGN KEY REFERENCES OutcomeEncuestaPPPConfig(IdOutcomeEncuestaPPPConfig),
    
    -- Puntaje (Escala 1-5)
    PuntajeOutcome DECIMAL(3,2) NOT NULL,  -- 1.0 a 5.0
    
    -- Pregunta adicional (opcional)
    IdPreguntaAdicional INT NULL 
        FOREIGN KEY REFERENCES PreguntaAdicional(IdPreguntaAdicional),
    PuntajePregunta DECIMAL(3,2) NULL,
    
    -- Auditoría
    FechaRegistro DATETIME2 NOT NULL DEFAULT GETDATE(),
    
    -- Índices
    INDEX IX_Encuesta (IdEncuesta),
    INDEX IX_OutcomeConfig (IdOutcomeEncuestaPPPConfig),
    INDEX IX_Encuesta_Outcome (IdEncuesta, IdOutcomeEncuestaPPPConfig)
);
```

#### Encuestum (Core - Compartida por PPP, GRA, LCFC)

```sql
CREATE TABLE Encuestum (
    IdEncuesta INT PRIMARY KEY IDENTITY(1,1),
    
    -- Tipos y Clasificación
    IdTipoEncuesta INT NOT NULL 
        FOREIGN KEY REFERENCES TipoEncuesta(IdTipoEncuesta),  -- 1=PPP, 2=GRA, 3=LCFC
    
    -- Alumno
    IdAlumno INT NOT NULL 
        FOREIGN KEY REFERENCES Alumno(IdAlumno),
    CodigoAlumno VARCHAR(20) NOT NULL,
    
    -- Carrera
    IdCarrera INT NOT NULL 
        FOREIGN KEY REFERENCES Carrera(IdCarrera),
    
    -- Curso (para LCFC)
    IdCurso INT NULL 
        FOREIGN KEY REFERENCES Curso(IdCurso),
    IdSeccion INT NULL 
        FOREIGN KEY REFERENCES Seccion(IdSeccion),
    
    -- Prácticas (para PPP)
    IdNumeroPractica INT NULL,  -- 1 o 2
    
    -- Información de Encuesta
    FechaInicio DATETIME2 NOT NULL,
    FechaFin DATETIME2 NULL,
    TotalHoras INT NULL,
    
    -- Empresa/Institución
    RazonSocial VARCHAR(255) NULL,
    NombreJefe VARCHAR(255) NULL,
    CargoJefe VARCHAR(255) NULL,
    TelefonoJefe VARCHAR(20) NULL,
    CorreoJefe VARCHAR(255) NULL,
    
    -- Comentarios
    Comentario NVARCHAR(MAX) NULL,
    RUC VARCHAR(20) NULL,
    
    -- Puntaje Agregado
    PuntajeTotal DECIMAL(5,2) NULL,
    
    -- Estado
    Estado VARCHAR(3) NOT NULL DEFAULT 'PEN',  -- PEN=Pendiente, COM=Completada, REV=Revisada
    
    -- Período
    IdSubModalidadPeriodoAcademico INT NOT NULL 
        FOREIGN KEY REFERENCES SubModalidadPeriodoAcademico(IdSubModalidadPeriodoAcademico),
    
    -- Auditoría
    FechaRegistro DATETIME2 NOT NULL DEFAULT GETDATE(),
    
    -- Índices
    INDEX IX_Alumno_Tipo (IdAlumno, IdTipoEncuesta),
    INDEX IX_Estado (Estado),
    INDEX IX_Periodo (IdSubModalidadPeriodoAcademico),
    INDEX IX_Carrera_Periodo (IdCarrera, IdSubModalidadPeriodoAcademico)
);
```

---

### 5. FLUJO COMPLETO PPP: UPLOAD EXCEL

Este es el flujo **crítico** de PPP. Expliquemos paso a paso cómo funciona el upload de datos PPP desde un archivo Excel.

#### 5.1 Punto de Entrada: Upload Endpoint

```csharp
// En ExcelController (no mostrado, pero existe)
[HttpPost("UploadNewPPP")]
public async Task<IActionResult> UploadNewPPP([FromBody] UploadPPPDTO request)
{
    // request contiene:
    // - CicloId: int (período académico)
    // - ArchivoBase64: string (archivo Excel codificado en base64)
    // - NombreArchivo: string
    // - EscuelaId: int
    // - escuelaActual: string (multi-tenancy)
    
    var response = await excelService.ProcessPPPUpload(request);
    return Ok(response);
}
```

#### 5.2 Procesamiento del Archivo

```
PASO 1: DECODIFICACIÓN BASE64
┌─────────────────────────────────────────┐
│ Base64 String (desde Frontend)          │
│ "RkJDMEEwMDM2QzI..."                     │
└─────────────────────────────────────────┘
           ↓
    System.Convert.FromBase64String()
           ↓
┌─────────────────────────────────────────┐
│ Byte Array (en memoria)                 │
│ [... 0xF6, 0xA0, 0x03, ...]            │
└─────────────────────────────────────────┘
           ↓
   using (MemoryStream ms = new(buffer))
           ↓
┌─────────────────────────────────────────┐
│ ExcelPackage (using EPPlus)             │
│ Análisis de estructura Excel            │
└─────────────────────────────────────────┘

PASO 2: LECTURA DE FILAS
Estructura esperada del Excel:
┌─────────────────────────────────────────────────────────────┐
│ COL 1  │ COL 2      │ COL 3      │ COL 4     │ ... │ COL 11 │
├────────┼────────────┼────────────┼───────────┼─────┼────────┤
│ Header │ "Código"   │ "Carrera"  │ "Empresa" │ ... │        │
├────────┼────────────┼────────────┼───────────┼─────┼────────┤
│ Row 1  │ "S20180001"│ "ING001"   │ "ACME"    │ ... │        │
├────────┼────────────┼────────────┼───────────┼─────┼────────┤
│ Row 2  │ "S20180002"│ "ING001"   │ "TechCorp"│ ... │        │
└─────────────────────────────────────────────────────────────┘

Columnas esperadas (en orden):
 1. CodigoAlumno
 2. IdCarrera
 3. NumeroPractica (1 o 2)
 4. RazonSocial (Nombre empresa)
 5. NombreJefe
 6. CargoJefe
 7. TelefonoJefe
 8. CorreoJefe
 9. RUC
10. TotalHoras
11. Comentario

PASO 3: LECTURA ITERATIVA DE FILAS
┌──────────────────────────────────┐
│ Para cada fila (excepto header)  │
├──────────────────────────────────┤
│ fila.GetValue(col1) = codigoAlumno
│ fila.GetValue(col2) = carrreraId
│ fila.GetValue(col3) = numeroPractica
│ ... (resto de columnas)
│                                  │
│ Crear UploadPPPRow object       │
│ Agregar a List<UploadPPPRow>    │
└──────────────────────────────────┘
          ↓
      Retorna List con todas las filas
```

#### 5.3 Validación de Cada Fila

Para **CADA FILA** en el Excel:

```
FILA: Row #N
┌──────────────────────────────────────────────────────┐
│ CodigoAlumno: "S20180001"                            │
│ IdCarrera: 10                                        │
│ NumeroPractica: 1                                    │
│ RazonSocial: "ACME Corp"                             │
│ ... (otros campos)                                   │
└──────────────────────────────────────────────────────┘
           ↓ VALIDACIONES:

1. VALIDAR CÓDIGO ALUMNO
   ┌────────────────────────────────────────────┐
   │ SELECT IdAlumno FROM Alumno                │
   │ WHERE CodigoAlumno = @codigo               │
   │ AND IdEscuela = @escuelaActual             │
   └────────────────────────────────────────────┘
   SI NO EXISTE: Error "Alumno no encontrado"
   SI EXISTE: Obtener IdAlumno → Continuar

2. VALIDAR CARRERA
   ┌────────────────────────────────────────────┐
   │ SELECT IdCarrera FROM Carrera              │
   │ WHERE IdCarrera = @idCarrera               │
   │ AND IdEscuela = @escuelaActual             │
   └────────────────────────────────────────────┘
   SI NO EXISTE: Error "Carrera no válida"
   SI EXISTE: Continuar

3. VALIDAR NÚMERO PRÁCTICA
   ┌────────────────────────────────────────────┐
   │ IF NumeroPractica NOT IN (1, 2)            │
   │    Error "Número de práctica inválido"     │
   └────────────────────────────────────────────┘

4. VALIDACIONES DE CAMPOS
   ┌────────────────────────────────────────────┐
   │ IF RazonSocial IS NULL OR EMPTY            │
   │    Error "Razón social requerida"          │
   │                                             │
   │ IF TotalHoras < 0 OR > 2000                │
   │    Error "Total horas inválido"            │
   │                                             │
   │ IF TelefonoJefe NOT REGEX(PHONE_PATTERN)   │
   │    Error "Teléfono no válido"              │
   │                                             │
   │ IF CorreoJefe NOT REGEX(EMAIL_PATTERN)     │
   │    Error "Email no válido"                 │
   └────────────────────────────────────────────┘

SI TODAS VALIDACIONES OK:
   ✓ Fila marcada como "VÁLIDA"
   ✓ Proceder a crear Encuestum
```

#### 5.4 Creación de Encuestum

Para cada fila VÁLIDA:

```csharp
// Crear objeto Encuestum
var encuestum = new Encuestum()
{
    IdTipoEncuesta = 1,  // PPP
    IdAlumno = alumnoId,  // Validado
    CodigoAlumno = row.CodigoAlumno,
    IdCarrera = row.IdCarrera,  // Validado
    
    IdNumeroPractica = row.NumeroPractica,  // 1 o 2
    
    FechaInicio = DateTime.Now,
    FechaFin = DateTime.Now,  // Se llenará después
    TotalHoras = row.TotalHoras,
    
    RazonSocial = row.RazonSocial,
    NombreJefe = row.NombreJefe,
    CargoJefe = row.CargoJefe,
    TelefonoJefe = row.TelefonoJefe,
    CorreoJefe = row.CorreoJefe,
    
    Comentario = row.Comentario,
    RUC = row.RUC,
    
    Estado = "PEN",  // Pendiente
    IdSubModalidadPeriodoAcademico = submodalidadId,
    
    FechaRegistro = DateTime.UtcNow
};

// Guardar en BD
await context.Encuestum.AddAsync(encuestum);
await context.SaveChangesAsync();
// → Obtener IdEncuesta (IDENTITY)
```

#### 5.5 Cálculo de Puntajes y Performance

Después de crear Encuestum, se calcula el "desempeño":

```
LÓGICA DE CÁLCULO (ConvertirOutcome):

Para cada OutcomeEncuestaPPPConfig de la carrera:
┌────────────────────────────────────────────────┐
│ OutcomeId: 501                                 │
│ NombreOutcome: "Análisis Técnico"              │
└────────────────────────────────────────────────┘
       ↓
   ¿Existe en el Excel una columna para este outcome?
       │
       ├─→ SI: Obtener puntaje (columna específica)
       │      Validar: 1.0 ≤ puntaje ≤ 5.0
       │      
       └─→ NO: Asignar valor por defecto
              (Según lógica de negocio)

Crear objeto PerformanceEncuestaPPP:
┌────────────────────────────────────────────────┐
│ IdEncuesta: {nuevo IdEncuesta}                 │
│ IdOutcomeEncuestaPPPConfig: {outcome}          │
│ PuntajeOutcome: 4.5                            │
│ FechaRegistro: GETDATE()                       │
└────────────────────────────────────────────────┘

INSERTAR todos los PerformanceEncuestaPPP:
INSERT INTO PerformanceEncuestaPPP
(IdEncuesta, IdOutcomeEncuestaPPPConfig, PuntajeOutcome)
VALUES (@idEncuesta, @outcomeId, @puntaje)
```

#### 5.6 Llamada a Stored Procedure

Después de inserts, se ejecuta stored procedure:

```sql
-- Stored Procedure: USP_Ins_RegistarPerformancePPP
EXEC USP_Ins_RegistarPerformancePPP
    @IdEncuesta = {IdEncuesta},
    @IdCarrera = {IdCarrera},
    @IdPeriodo = {IdPeriodo},
    @NumeroPractica = {1 o 2}

-- Este SP hace:
-- 1. Valida integridad de datos
-- 2. Ejecuta lógica adicional de BD
-- 3. Actualiza tablas relacionadas si es necesario
```

#### 5.7 Retorno Final

```json
{
  "success": true,
  "message": "Carga de PPP completada",
  "data": {
    "exitosas": 45,
    "fallidas": 2,
    "total": 47,
    "detalles": [
      {
        "fila": 15,
        "codigoAlumno": "S20180015",
        "estado": "ERROR",
        "motivo": "Alumno no encontrado"
      },
      {
        "fila": 32,
        "codigoAlumno": "S20180032",
        "estado": "ERROR",
        "motivo": "Email no válido"
      }
    ]
  }
}
```

---

## MÓDULO GRA

### 1. DESCRIPCIÓN FUNCIONAL

**GRA = Graduandos**

Módulo que gestiona encuestas de competencias para estudiantes próximos a egresar (graduandos). Utiliza **envío masivo de emails** con **tokens únicos de acceso** que NO requieren login.

Escala: **1 a 5 puntos** (como PPP pero sin hallazgos automáticos)

### 2. ENDPOINTS GRA - ANÁLISIS DETALLADO

#### 2.1 POST /email/findStudentCode-career-GRA

**Propósito**: Buscar estudiantes por código o carrera para agregar a notificaciones

```csharp
[HttpPost("findStudentCode-career-GRA")]
public async Task<IActionResult> FindStudentCodeCareer(
    [FromBody] FindStudentCodeCareerDTO request)
{
    var response = await emailService.FindStudentCodeCareer(request);
    return Ok(response);
}
```

**Request**:
```json
{
  "codigoAlumno": "S20180001",  // O null si busca por carrera
  "idCarrera": 10,              // O null si busca por código
  "idEscuela": 1,
  "escuelaActual": "main"
}
```

**Lógica de Búsqueda**:
```sql
-- Si código proporcionado:
SELECT IdAlumno, CodigoAlumno, NombreCompleto, IdCarrera
FROM Alumno
WHERE CodigoAlumno = @codigo
AND IdEscuela = @escuelaActual
AND Estado = 'ACT'

-- Si carrera proporcionada:
SELECT IdAlumno, CodigoAlumno, NombreCompleto, IdCarrera
FROM Alumno
WHERE IdCarrera = @idCarrera
AND IdEscuela = @escuelaActual
AND Estado = 'ACT'
LIMIT 100  -- Paginado

-- Si ambos:
SELECT ... WHERE CodigoAlumno = @codigo AND IdCarrera = @carrera
```

**Response**:
```json
{
  "success": true,
  "data": [
    {
      "idAlumno": 1001,
      "codigoAlumno": "S20180001",
      "nombreCompleto": "Juan García López",
      "idCarrera": 10,
      "nombreCarrera": "Ingeniería de Software"
    },
    {
      "idAlumno": 1002,
      "codigoAlumno": "S20180002",
      "nombreCompleto": "María Rodríguez Pérez",
      "idCarrera": 10,
      "nombreCarrera": "Ingeniería de Software"
    }
  ],
  "totalCount": 2
}
```

---

#### 2.2 POST /email/saveNotification-GRA

**Propósito**: Registrar notificación para un estudiante (paso previo a envío de email)

```csharp
[HttpPost("saveNotification-GRA")]
public async Task<IActionResult> SaveNotificationGRA(
    [FromBody] SaveNotificationGRADTO request)
{
    var response = await emailService.SaveNotificationGRA(request);
    return Ok(response);
}
```

**Request**:
```json
{
  "idAlumno": 1001,
  "idCarrera": 10,
  "modalidadId": 3,              // ID de modalidad académica
  "escuelaActual": "main"
}
```

**Lógica de Guardado**:
```
1. Crear registro NotificacionEncuestaAlumno:
   ┌────────────────────────────────────────┐
   │ IdNotificacion (PK IDENTITY)           │
   │ IdAlumno: 1001                         │
   │ IdCarrera: 10                          │
   │ IdSubModalidadPeriodoAcademico: X      │
   │ Estado: 0 (sin enviar aún)             │
   │ FechaCreacion: GETDATE()               │
   └────────────────────────────────────────┘
   
2. Opcionalmente, crear o reutilizar EncuestaToken:
   ┌────────────────────────────────────────┐
   │ Buscar EncuestaToken existente para    │
   │ este alumno-modalidad-período          │
   │                                         │
   │ SI NO EXISTE:                          │
   │   Generar GUID único                   │
   │   Encriptar con AES-256                │
   │   Crear EncuestaToken                  │
   │   Guardar token en BD                  │
   │                                         │
   │ SI EXISTE:                             │
   │   Reutilizar token existente           │
   └────────────────────────────────────────┘

3. Retornar confirmación
```

**Response**:
```json
{
  "success": true,
  "message": "Notificación guardada exitosamente",
  "data": {
    "idNotificacion": 5001,
    "idAlumno": 1001,
    "alumnoNombre": "Juan García López"
  }
}
```

---

#### 2.3 POST /email/listStudentNotification-GRA

**Propósito**: Listar notificaciones registradas para un estudiante

```csharp
[HttpPost("listStudentNotification-GRA")]
public async Task<IActionResult> ListStudentNotificationsGRA(
    [FromBody] ListStudentNotificationGRADTO request)
{
    var response = await emailService.ListStudentNotificationsGRA(request);
    return Ok(response);
}
```

**Request**:
```json
{
  "idCarrera": 10,
  "codigo": "S20180001",         // Código alumno
  "modalidadId": 3,
  "escuelaId": 1,
  "roles": ["ADMIN", "COORDINADOR"],
  "escuelaActual": "main"
}
```

**Query**:
```sql
SELECT 
    n.IdNotificacion,
    n.IdAlumno,
    a.CodigoAlumno,
    a.NombreCompleto,
    n.Estado,  -- 0=no enviado, 1=enviado
    n.FechaCreacion
FROM NotificacionEncuestaAlumno n
INNER JOIN Alumno a ON n.IdAlumno = a.IdAlumno
WHERE n.IdCarrera = @carrera
AND a.CodigoAlumno = @codigo
AND n.IdSubModalidadPeriodoAcademico = @submodalidad
ORDER BY n.FechaCreacion DESC
```

**Response**:
```json
{
  "success": true,
  "data": [
    {
      "idNotificacion": 5001,
      "idAlumno": 1001,
      "codigoAlumno": "S20180001",
      "nombreCompleto": "Juan García López",
      "estado": 0,
      "fechaCreacion": "2025-05-15T10:30:00Z"
    }
  ],
  "totalCount": 1
}
```

---

#### 2.4 POST /email/emailSurvey-GRA

**ENDPOINT CRÍTICO**: Enviar masivamente encuestas por email

```csharp
[HttpPost("emailSurvey-GRA")]
public async Task<IActionResult> EmailNSurveyGRA(
    [FromBody] EmailSurveyGRADTO request)
{
    try
    {
        var response = await emailService.EmailNSurveyGRA(request);
        return Ok(response);
    }
    catch (Exception ex)
    {
        _log.Error($"Error al enviar correos GRA", ex);
        return BadRequest(ex.Message);
    }
}
```

**Request**:
```json
{
  "modalidadId": 3,
  "escuelaId": 1,
  "escuelaActual": "main"
}
```

**FLUJO DE EJECUCIÓN (CRITICAL SECTION)**:

```
PASO 1: OBTENER CONFIGURACIÓN
┌─────────────────────────────────────────────────┐
│ SELECT * FROM ConfiguracionNotificacion         │
│ WHERE IdTipoEncuesta = 'GRA'                    │
│ AND IdEscuela = @escuela                        │
│ AND Estado = 'ACT'                              │
│                                                  │
│ Obtener:                                        │
│ - PlantillaEmail (HTML con placeholders)       │
│ - AsuntoEmail                                   │
│ - LogoEscuela                                   │
│ - EmailRemitente                                │
│ - SMTP Config                                   │
└─────────────────────────────────────────────────┘

PASO 2: OBTENER MODALIDAD
┌─────────────────────────────────────────────────┐
│ SELECT IdSubModalidadPeriodoAcademico           │
│ FROM SubModalidadPeriodoAcademico               │
│ WHERE IdModalidad = @modalidadId                │
│ AND IdEscuela = @escuela                        │
│ AND EsActual = 1                                │
│ LIMIT 1                                         │
└─────────────────────────────────────────────────┘

PASO 3: OBTENER NOTIFICACIONES PENDIENTES
┌─────────────────────────────────────────────────┐
│ SELECT * FROM NotificacionEncuestaAlumno        │
│ WHERE IdSubModalidadPeriodoAcademico = @submod  │
│ AND Estado = 0  -- No enviadas                  │
│                                                  │
│ JOIN Alumno ON IdAlumno                        │
│ JOIN Carrera ON IdCarrera                       │
│                                                  │
│ Result: List<NotificacionConDetalles>          │
│ Total: N notificaciones                        │
└─────────────────────────────────────────────────┘

PASO 4: PARA CADA NOTIFICACIÓN:
┌─────────────────────────────────────────────────┐
│ NOTIFICACIÓN #1                                 │
├─────────────────────────────────────────────────┤
│ 4.1 OBTENER O CREAR ENCUESTA TOKEN              │
│     ┌─────────────────────────────────────┐    │
│     │ SELECT * FROM EncuestaToken         │    │
│     │ WHERE IdAlumno = @alumnoId          │    │
│     │ AND IdSubModalidad = @submod        │    │
│     │ AND Tipo = 'GRA'                    │    │
│     │ AND Estado = 1  -- Activo           │    │
│     │ AND FechaFin > GETDATE()  -- Válido │    │
│     └─────────────────────────────────────┘    │
│                                                  │
│     SI NO EXISTE:                               │
│     ┌─────────────────────────────────────┐    │
│     │ Token = NEWID()  → GUID único       │    │
│     │ TokenEncriptado = AES256_Encrypt()  │    │
│     │                                     │    │
│     │ INSERT INTO EncuestaToken:          │    │
│     │ Token, TokenEncriptado, Estado=1   │    │
│     │ FechaEnvio=GETDATE()                │    │
│     │ FechaFin=GETDATE()+30 días          │    │
│     │ IdAlumno, IdCarrera, IdEncuesta     │    │
│     │ IdSubModalidad, Tipo='GRA'          │    │
│     └─────────────────────────────────────┘    │
│                                                  │
│ 4.2 CONSTRUIR URL CON TOKEN                     │
│     ┌─────────────────────────────────────┐    │
│     │ URLBase: https://sistema.com/gra/  │    │
│     │ LinkEncuesta = URLBase               │    │
│     │             + "?token=" + Token      │    │
│     │             + "&escuela=" + escuela  │    │
│     │                                     │    │
│     │ Ejemplo:                            │    │
│     │ https://sistema.com/gra/            │    │
│     │ ?token=abc123def456&escuela=main    │    │
│     └─────────────────────────────────────┘    │
│                                                  │
│ 4.3 REEMPLAZAR PLACEHOLDERS EN HTML             │
│     ┌─────────────────────────────────────┐    │
│     │ PlantillaOriginal:                  │    │
│     │ "Estimado(a) [NombreAlumno],        │    │
│     │  Por favor responde:                │    │
│     │  [LinkEncuesta]                     │    │
│     │  Plazo: [FechaVencimiento]"         │    │
│     │                                     │    │
│     │ Reemplazos:                         │    │
│     │ [NombreAlumno] → Juan García López  │    │
│     │ [LinkEncuesta] → https://...        │    │
│     │ [FechaVencimiento] → 15-06-2025     │    │
│     │ [NombreCarrera] → Ing. Software     │    │
│     │ [CodigoAlumno] → S20180001          │    │
│     │ [NombreInstitución] → UPC           │    │
│     │                                     │    │
│     │ ContentEmail = Resultado después    │    │
│     │ de todos los reemplazos             │    │
│     └─────────────────────────────────────┘    │
│                                                  │
│ 4.4 ENVIAR EMAIL POR SMTP                       │
│     ┌─────────────────────────────────────┐    │
│     │ MailMessage msg = new()             │    │
│     │ msg.From = "notificaciones@upc.pe"  │    │
│     │ msg.To = alumno.CorreoPersonal      │    │
│     │ msg.Subject = AsuntoEmail           │    │
│     │ msg.Body = ContentEmail             │    │
│     │ msg.IsBodyHtml = true               │    │
│     │                                     │    │
│     │ smtpClient.Send(msg)                │    │
│     │                                     │    │
│     │ SI ÉXITO: Log OK                    │    │
│     │ SI ERROR: Log error + Retry         │    │
│     └─────────────────────────────────────┘    │
│                                                  │
│ 4.5 MARCAR COMO ENVIADO                         │
│     ┌─────────────────────────────────────┐    │
│     │ UPDATE NotificacionEncuestaAlumno   │    │
│     │ SET Estado = 1  -- Enviado          │    │
│     │ WHERE IdNotificacion = @id          │    │
│     │                                     │    │
│     │ UPDATE EncuestaToken                │    │
│     │ SET Estado = 1, FechaEnvio = NOW()  │    │
│     └─────────────────────────────────────┘    │
│                                                  │
│ Contador: exitosas++                            │
│                                                  │
└─────────────────────────────────────────────────┘

PASO 5: RETORNAR RESUMEN
```

**Response**:
```json
{
  "success": true,
  "message": "Envío de encuestas completado",
  "data": {
    "totalProcessadas": 150,
    "exitosas": 148,
    "fallidas": 2,
    "detalles": [
      {
        "idAlumno": 1050,
        "codigoAlumno": "S20180050",
        "estado": "ERROR",
        "motivo": "Email no válido: invalidemail@"
      },
      {
        "idAlumno": 1075,
        "codigoAlumno": "S20180075",
        "estado": "ERROR",
        "motivo": "SMTP connection timeout"
      }
    ]
  }
}
```

---

#### 2.5 POST /email/getConfigurationNotification-GRA

**Propósito**: Obtener configuración de plantillas y parámetros email

```csharp
[HttpPost("getConfigurationNotification-GRA")]
public async Task<IActionResult> getConfigurationNotification(
    [FromBody] ConfigurationNotificationDTO request)
{
    var response = await emailService.getConfigurationNotification(request);
    return Ok(response);
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "plantillaEmail": "<html>...[NombreAlumno]...[LinkEncuesta]...</html>",
    "asuntoEmail": "Encuesta de Competencias - UPC 2025-I",
    "logoEscuela": "https://cdn.upc.pe/logo.png",
    "emailRemitente": "notificaciones@upc.pe",
    "placeholdersDisponibles": [
      "[NombreAlumno]",
      "[CodigoAlumno]",
      "[NombreCarrera]",
      "[LinkEncuesta]",
      "[FechaVencimiento]",
      "[NombreInstitución]"
    ]
  }
}
```

---

#### 2.6 POST /email/deleteNotification-GRA

**Propósito**: Eliminar notificación registrada

```csharp
[HttpDelete("deleteNotification-GRA")]
public async Task<IActionResult> DeleteNotificationGRA(
    [FromBody] DeleteNotificationGRADTO request)
{
    var response = await emailService.DeleteNotificationGRA(request);
    return Ok(response);
}
```

**Request**:
```json
{
  "idNotificacion": 5001,
  "escuelaActual": "main"
}
```

**Lógica**:
```
1. Validar que notificación existe
2. Validar que token no fue enviado aún (Estado = 0)
   SI fue enviado: Retornar error "No se puede eliminar notificaciones enviadas"
3. Eliminar registro:
   DELETE FROM NotificacionEncuestaAlumno WHERE IdNotificacion = @id
4. Opcionalmente eliminar EncuestaToken asociado
5. Retornar OK
```

---

### 3. FLUJO CRÍTICO GRA: RESPUESTA A ENCUESTA

Una vez que el alumno recibe el email con link, accede a la encuesta:

#### 3.1 Token Validation Endpoint (Implícito)

```
Alumno recibe email:
┌────────────────────────────────────────────────┐
│ Estimado Juan García López,                    │
│                                                 │
│ Por favor responde la encuesta de              │
│ competencias de graduandos:                    │
│                                                 │
│ https://sistema.com/gra/encuesta?              │
│ token=abc123def456ghi789&                      │
│ escuela=main&                                  │
│ idioma=es-PE                                   │
│                                                 │
│ [HACER CLICK AQUÍ]                             │
└────────────────────────────────────────────────┘

Alumno hace CLICK
     ↓
Frontend llama:
GET /gra/encuesta?token=abc123def456ghi789&escuela=main&idioma=es-PE
     ↓
API ejecuta:
1. Extraer token de URL
2. Desencriptar con AES-256
3. Validar:
   - Token existe en BD
   - Token.Estado = 1 (Enviado)
   - Token.FechaFin >= GETDATE() (No expirado)
   - EncuestaToken.IdAlumno matches session
4. SI OK: Retornar formulario
   SI ERROR: Retornar 401 Unauthorized
```

#### 3.2 Formulario de Respuesta

```
Frontend renderiza:
┌────────────────────────────────────────────┐
│ ENCUESTA DE COMPETENCIAS - GRADUANDOS      │
├────────────────────────────────────────────┤
│ Alumno: Juan García López                  │
│ Código: S20180001                          │
│ Carrera: Ingeniería de Software            │
│ Período: 2025-I                            │
├────────────────────────────────────────────┤
│ COMPETENCIAS GENÉRICAS (CG)                │
│ ─────────────────────────────────────────  │
│ □ Trabajo en Equipo      [1][2][3][4][5]  │
│ □ Pensamiento Crítico    [1][2][3][4][5]  │
│ □ Comunicación           [1][2][3][4][5]  │
│                                             │
│ COMPETENCIAS ESPECÍFICAS (CE)              │
│ ─────────────────────────────────────────  │
│ □ Prog. Orientada Objetos [1][2][3][4][5] │
│ □ BD Relacionales        [1][2][3][4][5]  │
│ □ Frameworks Web         [1][2][3][4][5]  │
│                                             │
│ COMENTARIOS ADICIONALES                    │
│ ┌─────────────────────────────────────────┐│
│ │ [Área de texto para comentarios]        ││
│ └─────────────────────────────────────────┘│
│                                             │
│ [ GUARDAR ]  [ CANCELAR ]                  │
└────────────────────────────────────────────┘
```

#### 3.3 POST /gra/encuesta/completar (Implícito)

```csharp
[HttpPost("gra/encuesta/completar")]
public async Task<IActionResult> GuardarRespuestasGRA(
    [FromBody] GraEncuestaResponse request)
{
    // request contiene:
    // - Token (para validar)
    // - respuestas[] {outcomeId, puntaje (1-5)}
    // - comentario (opcional)
    
    return Ok(await emailService.GuardarRespuestasGRA(request));
}
```

**Lógica de Guardado**:
```
1. Validar token (igual que antes)

2. Obtener encuesta:
   SELECT * FROM Encuestum
   WHERE IdTipoEncuesta = 2  -- GRA
   AND IdAlumno = @alumnoId
   AND IdSubModalidad = @submod
   LIMIT 1

3. Crear/actualizar respuestas:
   Para cada {outcomeId, puntaje} en respuestas:
   
   INSERT INTO PerformanceEncuestum
   (IdEncuesta, IdOutcomeEncuestaConfig, PuntajeOutcome)
   VALUES (@id, @outcomeId, @puntaje)

4. Actualizar Encuestum:
   UPDATE Encuestum
   SET Estado = 'COM',  -- Completada
       FechaFin = GETDATE(),
       Comentario = @comentario
   WHERE IdEncuesta = @id

5. Marcar token como usado:
   UPDATE EncuestaToken
   SET Estado = 2  -- Respondida
   WHERE Token = @tokenEncriptado

6. Retornar: {success: true, message: "Encuesta guardada"}
```

---

## MÓDULO LCFC

### 1. DESCRIPCIÓN FUNCIONAL

**LCFC = Logro de Fin de Ciclo**

Módulo que gestiona encuestas de logro de competencias al terminar cada ciclo académico. Evaluación **por curso** con escala de **1 a 10 puntos**.

Características únicas:
- Configuración de cursos (quién participa)
- Notificaciones masivas por alumno-curso
- Token-based access (como GRA)
- Respuestas separadas por outcome

### 2. ENDPOINTS LCFC - ANÁLISIS DETALLADO

#### 2.1 POST /lcfc/configuracion/generar/escuela/{escuela}/periodo/{periodoAcademicoId}

**Propósito**: Generar configuración de cursos para un período

```csharp
[HttpPost("configuracion/generar/escuela/{escuela}/periodo/{periodoAcademicoId}")]
[Authorize]
public async Task<IActionResult> GeneraData(
    [FromRoute] int periodoAcademicoId,
    [FromRoute] string escuela)
{
    var result = await service.GenerarCursoEncuesta(
        periodoAcademicoId,
        escuela
    );
    return Ok(result);
}
```

**Lógica de Generación**:
```
PASO 1: OBTENER PERÍODO
┌─────────────────────────────────────┐
│ SELECT * FROM PeriodoAcademico      │
│ WHERE IdPeriodo = @periodoId        │
│ AND IdEscuela = @escuela            │
└─────────────────────────────────────┘

PASO 2: OBTENER TODAS LAS SUBMODALIDADES
┌─────────────────────────────────────┐
│ SELECT * FROM                       │
│ SubModalidadPeriodoAcademico        │
│ WHERE IdPeriodo = @periodoId        │
│ AND IdEscuela = @escuela            │
│                                     │
│ Result: List[N submodalidades]      │
└─────────────────────────────────────┘

PASO 3: OBTENER CURSOS DEL PERÍODO
┌─────────────────────────────────────┐
│ SELECT DISTINCT *                   │
│ FROM Curso                          │
│ WHERE IdPeriodo = @periodoId        │
│ AND IdEscuela = @escuela            │
│ AND Estado = 'ACT'                  │
│                                     │
│ Result: List[M cursos]              │
└─────────────────────────────────────┘

PASO 4: PRODUCTO CARTESIANO
┌─────────────────────────────────────┐
│ Para cada Submodalidad (N):         │
│   Para cada Curso (M):              │
│                                     │
│     IF NOT EXISTS CursoEncuestaConfig
│        WHERE IdCurso = @cursoId     │
│        AND IdSubmodalidad = @submod │
│                                     │
│     ENTONCES:                       │
│       INSERT INTO CursoEncuestaConfig
│       (IdCurso, IdSubmodalidad,     │
│        IdCarrera, IdEscuela,        │
│        Estado = 'ACT',              │
│        FechaCreacion = GETDATE())   │
│                                     │
│     contador++                      │
└─────────────────────────────────────┘

Total generado: N × M registros
```

**Response**:
```json
{
  "success": true,
  "message": "Configuración generada",
  "data": {
    "generadas": 450,
    "periodo": 5,
    "escuela": "main"
  }
}
```

---

#### 2.2 POST /lcfc/configuracion/pageable

**Propósito**: Listar cursos configurados (con paginación)

```csharp
[HttpPost("configuracion/pageable")]
[Authorize]
public async Task<IActionResult> ListaCursoConfiguracion(
    [FromBody] Paginator<LcfcConfCurRequest> request)
{
    var response = await service.ListaCursoConfiguracion(
        request.Body,
        request.Page
    );
    return Ok(response);
}
```

**Request**:
```json
{
  "body": {
    "periodoId": 5,
    "escuela": "main",
    "idioma": "es-PE",
    "buscador": "Programación"  // Filtro por nombre curso
  },
  "page": {
    "pageNumber": 1,
    "pageSize": 20
  }
}
```

**Query Paginada**:
```sql
SELECT 
    c.IdCurso,
    c.CodigoCurso,
    c.NombreCurso,
    cec.IdCursoEncuestaConfig,
    cec.Estado,
    d.NombreDocente AS NombreCoor,  -- Coordinador
    cec.FechaCreacion
FROM CursoEncuestaConfig cec
INNER JOIN Curso c ON cec.IdCurso = c.IdCurso
LEFT JOIN Docente d ON c.IdDocente = d.IdDocente
WHERE cec.IdSubmodalidad = @submodalidad
AND c.Idioma = @idioma
AND (c.NombreCurso LIKE '%' + @buscador + '%' OR @buscador IS NULL)
ORDER BY c.CodigoCurso
OFFSET @pageNumber * @pageSize ROWS
FETCH NEXT @pageSize ROWS ONLY
```

**Response**:
```json
{
  "success": true,
  "data": [
    {
      "cursoId": 101,
      "codCurso": "ING-P1-001",
      "nombreCurso": "Programación I",
      "nombreCoor": "Dr. Carlos Mendez",
      "estado": "ACT"
    },
    {
      "cursoId": 102,
      "codCurso": "ING-P1-002",
      "nombreCurso": "Programación II",
      "nombreCoor": "Mg. María García",
      "estado": "ACT"
    }
  ],
  "totalCount": 45,
  "pageNumber": 1,
  "pageSize": 20,
  "totalPages": 3
}
```

---

#### 2.3 POST /lcfc/configuracion/cambio

**Propósito**: Activar/desactivar cursos para encuesta

```csharp
[HttpPost("configuracion/cambio")]
[Authorize]
public async Task<IActionResult> CambioEstado(
    [FromBody] LcfcConfCheckBox request)
{
    var result = await service.CambioEstado(request);
    return Ok(result);
}
```

**Request**:
```json
{
  "checkbox": {
    "1": true,    // Activar curso 1
    "2": false,   // Desactivar curso 2
    "3": true,    // Activar curso 3
    "4": false
  },
  "periodoId": 5,
  "escuela": "main"
}
```

**Lógica**:
```
Para cada {cursoId: estado} en checkbox:

  UPDATE CursoEncuestaConfig
  SET Estado = CASE
                 WHEN @estado = true THEN 'ACT'
                 WHEN @estado = false THEN 'INA'
               END
  WHERE IdCurso = @cursoId
  AND IdSubmodalidad = @submodalidad
```

---

#### 2.4 POST /lcfc/notificacion/envio

**ENDPOINT CRÍTICO**: Enviar notificaciones de encuesta LCFC

```csharp
[HttpPost("notificacion/envio")]
[Authorize]
public async Task<IActionResult> EnviarCorreoNotificacionLcfc(
    [FromBody] LcfcNotificacionEncuestaRequest request)
{
    var result = await service.EnviarGenerarNotificacion(request);
    return Ok(result);
}
```

**Request**:
```json
{
  "alumnoId": 0,  // 0 = todos los alumnos
  "subModalidadPeriodoAcademicoId": 0,  // 0 = todas las submodalidades
  "periodoAcademicoId": 5,
  "cursoId": 0,  // 0 = todos los cursos ACT
  "escuela": "main",
  "idioma": "es-PE",
  "pruebas": false  // true = no enviar, solo simular
}
```

**FLUJO DE ENVÍO MASIVO**:

```
PASO 1: OBTENER CURSOS ACTIVOS
┌──────────────────────────────────────────┐
│ SELECT * FROM CursoEncuestaConfig        │
│ WHERE IdSubmodalidad = @submod           │
│ AND Estado = 'ACT'                       │
│ AND (IdCurso = @cursoId OR @cursoId = 0)│
│                                          │
│ Result: cursos[] (active courses)        │
└──────────────────────────────────────────┘

PASO 2: PARA CADA CURSO ACTIVO
┌──────────────────────────────────────────┐
│ CURSO: ING-P1-001                        │
├──────────────────────────────────────────┤
│                                          │
│ PASO 2.1: OBTENER ESTUDIANTES EN CURSO   │
│ ┌────────────────────────────────────┐  │
│ │ SELECT DISTINCT a.*               │  │
│ │ FROM Alumno a                      │  │
│ │ INNER JOIN AlumnoSeccion ans       │  │
│ │   ON a.IdAlumno = ans.IdAlumno     │  │
│ │ INNER JOIN Seccion s               │  │
│ │   ON ans.IdSeccion = s.IdSeccion   │  │
│ │ WHERE s.IdCurso = @cursoId         │  │
│ │ AND a.Estado = 'MAT' (Matriculado) │  │
│ └────────────────────────────────────┘  │
│ Result: alumnos[] en curso              │
│                                          │
│ PASO 2.2: PARA CADA ALUMNO-CURSO        │
│ ┌────────────────────────────────────┐  │
│ │ ALUMNO: Juan García (1001)         │  │
│ ├────────────────────────────────────┤  │
│ │                                    │  │
│ │ 2.2.1: VERIFICAR SI ENCUESTA EXISTE│  │
│ │        SELECT * FROM Encuestum     │  │
│ │        WHERE IdAlumno = @alumnoId  │  │
│ │        AND IdCurso = @cursoId      │  │
│ │        AND IdTipoEncuesta = 3 (LCFC)  │
│ │                                    │  │
│ │        SI NO EXISTE:               │  │
│ │          → Crear Encuestum nueva   │  │
│ │            Estado = 'PEN'          │  │
│ │            → Obtener IdEncuesta    │  │
│ │                                    │  │
│ │        SI EXISTE:                  │  │
│ │          → Reutilizar IdEncuesta   │  │
│ │                                    │  │
│ │ 2.2.2: GENERAR TOKEN               │  │
│ │        Token = NEWID()             │  │
│ │        TokenEnc = AES256_Encrypt() │  │
│ │                                    │  │
│ │        INSERT INTO EncuestaToken   │  │
│ │        (Token, TokenEnc, Estado=1) │  │
│ │                                    │  │
│ │ 2.2.3: CONSTRUIR URL               │  │
│ │        URL = https://sistema.com/  │  │
│ │            lcfc/encuesta?          │  │
│ │            token=TOKEN&            │  │
│ │            escuela=main&           │  │
│ │            idioma=es-PE&           │  │
│ │            alumnoId=1001&          │  │
│ │            cursoId=101             │  │
│ │                                    │  │
│ │ 2.2.4: OBTENER PLANTILLA EMAIL     │  │
│ │        SELECT * FROM               │  │
│ │        ConfiguracionNotificacion   │  │
│ │        WHERE Tipo = 'LCFC'         │  │
│ │                                    │  │
│ │ 2.2.5: REEMPLAZAR PLACEHOLDERS     │  │
│ │        [NombreAlumno] → Juan García   │
│ │        [CodigoAlumno] → S20180001     │
│ │        [NombreCurso] → Programación I│
│ │        [LinkEncuesta] → URL           │
│ │        [FechaVencimiento] → +30 días  │
│ │                                    │  │
│ │ 2.2.6: ENVIAR EMAIL (SMTP)         │  │
│ │        IF NOT @pruebas:            │  │
│ │          smtpClient.Send(email)    │  │
│ │          Mark: enviada             │  │
│ │        ELSE:                       │  │
│ │          Log: "[TEST MODE]"        │  │
│ │                                    │  │
│ │ contador.exitosas++                │  │
│ │                                    │  │
│ └────────────────────────────────────┘  │
│                                          │
└──────────────────────────────────────────┘

PASO 3: RETORNAR RESUMEN
```

**Response**:
```json
{
  "success": true,
  "message": "Notificaciones enviadas",
  "data": {
    "totalProcesados": 1200,
    "exitosas": 1198,
    "fallidas": 2,
    "totalCursos": 45,
    "totalAlumnos": 1200,
    "detalles": [
      {
        "alumnoId": 2050,
        "cursoId": 101,
        "estado": "ERROR",
        "motivo": "Email no válido"
      }
    ]
  }
}
```

---

#### 2.5 GET /lcfc/encuesta/escuela/{escuela}/idioma/{idioma}/alumno/{alumnoId}/...

**Propósito**: Cargar formulario de encuesta para alumno

```csharp
[HttpGet("encuesta/escuela/{escuela}/idioma/{idioma}/alumno/{alumnoId}/...")]
public async Task<IActionResult> ObtenerEncuesta(
    [FromRoute] string idioma,
    [FromRoute] string escuela,
    [FromRoute] int subModalidadPeriodoAcademicoId,
    [FromRoute] int alumnoId,
    [FromRoute] int cursoId,
    [FromRoute] int carreraId)
{
    var result = await service.ObtenerInformacionEncuesta(
        escuela,
        alumnoId,
        idioma,
        cursoId,
        carreraId,
        subModalidadPeriodoAcademicoId
    );
    return Ok(result);
}
```

**Lógica**:
```
1. Obtener Encuestum:
   SELECT * FROM Encuestum
   WHERE IdAlumno = @alumno
   AND IdCurso = @curso
   AND IdTipoEncuesta = 3  -- LCFC
   AND IdSubModalidad = @submod

2. Obtener Outcomes del Curso:
   SELECT o.* FROM Outcome o
   INNER JOIN MallaCurricular mc 
     ON o.IdMalla = mc.IdMalla
   INNER JOIN Curso c 
     ON mc.IdCarrera = c.IdCarrera
   WHERE c.IdCurso = @cursoId
   AND o.Idioma = @idioma
   ORDER BY o.Orden

3. Construir Response con estructura:
   {
     "encuestaId": 5001,
     "alumno": "Juan García López",
     "codigo": "S20180001",
     "curso": "Programación I",
     "outcomes": [
       {"id": 501, "nombre": "Análisis", "descripcion": "..."},
       {"id": 502, "nombre": "Diseño", "descripcion": "..."}
     ]
   }
```

**Response**:
```json
{
  "success": true,
  "data": {
    "encuestaId": 5001,
    "alumnoNombre": "Juan García López",
    "codigoAlumno": "S20180001",
    "cursoNombre": "Programación I",
    "carreraNombre": "Ingeniería de Software",
    "outcomes": [
      {
        "idOutcome": 501,
        "nombre": "Análisis Técnico",
        "descripcion": "Capacidad de analizar problemas técnicos",
        "orden": 1
      },
      {
        "idOutcome": 502,
        "nombre": "Diseño de Soluciones",
        "descripcion": "Capacidad de diseñar soluciones",
        "orden": 2
      },
      {
        "idOutcome": 503,
        "nombre": "Implementación",
        "descripcion": "Capacidad de implementar soluciones",
        "orden": 3
      }
    ]
  }
}
```

---

#### 2.6 POST /lcfc/encuesta/completar

**ENDPOINT CRÍTICO**: Guardar respuestas de encuesta LCFC

```csharp
[HttpPost("encuesta/completar")]
public async Task<IActionResult> CompletarEnvioEncuesta(
    LcfcEncuestaResponse request)
{
    var result = await service.CompletarEnvioEncuesta(request);
    return Ok(result);
}
```

**Request**:
```json
{
  "comentario": "Excelente curso, muy práctico",
  "escuela": "main",
  "encuestaId": 5001,
  "lista": [
    {
      "outcomeId": 501,
      "competenciaE": "Análisis Técnico",
      "comisionId": 1,
      "descripcion": "Análisis de requisitos",
      "puntaje": 8
    },
    {
      "outcomeId": 502,
      "competenciaE": "Diseño de Soluciones",
      "comisionId": 1,
      "descripcion": "Diseño de arquitectura",
      "puntaje": 7
    },
    {
      "outcomeId": 503,
      "competenciaE": "Implementación",
      "comisionId": 1,
      "descripcion": "Implementación de módulos",
      "puntaje": 9
    }
  ]
}
```

**LÓGICA DE GUARDADO (TRANSACCIONAL)**:

```
BEGIN TRANSACTION
  
  PASO 1: VALIDAR ENCUESTA
  ┌─────────────────────────────────┐
  │ SELECT * FROM Encuestum         │
  │ WHERE IdEncuesta = @id          │
  │ AND IdTipoEncuesta = 3 (LCFC)   │
  │                                  │
  │ SI NOT FOUND: Rollback, Error   │
  └─────────────────────────────────┘

  PASO 2: CREAR RESPUESTAS
  ┌─────────────────────────────────┐
  │ Para cada outcome en lista:     │
  │                                  │
  │   Validar:                       │
  │   - outcomeId existe             │
  │   - puntaje entre 1-10          │
  │                                  │
  │   INSERT INTO EncuestaLCFC      │
  │   (IdEncuesta, IdOutcome,       │
  │    Puntaje, FechaRegistro)      │
  │   VALUES (@id, @outcome, @pts)  │
  │                                  │
  │   contador++                    │
  │                                  │
  │ Total insertado: N registros    │
  └─────────────────────────────────┘

  PASO 3: ACTUALIZAR ENCUESTUM
  ┌─────────────────────────────────┐
  │ UPDATE Encuestum                │
  │ SET Estado = 'COM',             │
  │     FechaFin = GETDATE(),       │
  │     Comentario = @comentario,   │
  │     PuntajeTotal = AVG(puntajes)│
  │ WHERE IdEncuesta = @id          │
  └─────────────────────────────────┘

  PASO 4: MARCAR TOKEN COMO COMPLETADO
  ┌─────────────────────────────────┐
  │ UPDATE EncuestaToken            │
  │ SET Estado = 2  -- Respondida   │
  │ WHERE IdEncuesta = @id          │
  └─────────────────────────────────┘

COMMIT TRANSACTION
  
SI ERROR EN CUALQUIER PASO:
  ROLLBACK TRANSACTION
  Retorna error message
```

**Response**:
```json
{
  "success": true,
  "message": "Encuesta guardada exitosamente",
  "data": {
    "encuestaId": 5001,
    "estadoNuevo": "COM",
    "respuestasGuardadas": 3,
    "puntajePromedio": 8.0
  }
}
```

---

## COMPONENTES TRANSVERSALES

### 1. SISTEMA DE TOKENS

**Tokens para Acceso sin Autenticación**

```
FLUJO DE TOKEN:
┌──────────────────────────────────────┐
│ 1. Sistema genera Token              │
│    Token = GUID.NewGuid()            │
│    Ejemplo: abc-def-ghi-jkl-mno      │
└──────────────────────────────────────┘
           ↓
┌──────────────────────────────────────┐
│ 2. Encriptar Token                   │
│    Algoritmo: AES-256                │
│    Key: Key_Encriptacion_Segura      │
│    TokenEncriptado = AES256.Encrypt()│
│    Result: "8F9K2L3M..."             │
└──────────────────────────────────────┘
           ↓
┌──────────────────────────────────────┐
│ 3. Guardar en BD                     │
│    INSERT INTO EncuestaToken         │
│    (Token, TokenEncriptado, Estado,  │
│     FechaEnvio, FechaFin,            │
│     IdAlumno, IdCarrera, IdEncuesta) │
└──────────────────────────────────────┘
           ↓
┌──────────────────────────────────────┐
│ 4. Enviar por Email                  │
│    URL = https://sistema.com/        │
│         gra/encuesta?                │
│         token=abc-def-ghi-jkl-mno    │
│         &escuela=main                │
│         &idioma=es-PE                │
└──────────────────────────────────────┘
           ↓
┌──────────────────────────────────────┐
│ 5. Alumno Recibe y Hace Click        │
│    Token en URL: abc-def-ghi-jkl-mno │
└──────────────────────────────────────┘
           ↓
┌──────────────────────────────────────┐
│ 6. API Valida Token                  │
│    - Buscar en BD                    │
│    - Validar FechaFin > GETDATE()    │
│    - Validar Estado = 1 (Activo)     │
│    - Desencriptar para obtener datos │
└──────────────────────────────────────┘
           ↓
┌──────────────────────────────────────┐
│ 7. Si OK: Mostrar Formulario         │
│    Si ERROR: Retorna 401 Unauthorized│
└──────────────────────────────────────┘
```

**Entity EncuestaToken**:
```sql
CREATE TABLE EncuestaToken (
    IdEncuestaToken INT PRIMARY KEY IDENTITY,
    
    Token UNIQUEIDENTIFIER NOT NULL,  -- GUID original
    TokenEncriptado NVARCHAR(MAX),     -- AES-256 encrypted
    
    Estado INT DEFAULT 0,              -- 0=Generado, 1=Enviado, 2=Respondido
    
    FechaEnvio DATETIME2,
    FechaFin DATETIME2,                -- Expiración (típicamente +30 días)
    
    -- Relaciones
    IdAlumno INT NOT NULL FOREIGN KEY,
    IdCarrera INT NOT NULL FOREIGN KEY,
    IdEncuesta INT FOREIGN KEY,        -- Encuesta asociada
    
    Tipo VARCHAR(3),                   -- 'PPP', 'GRA', 'LCFC'
    
    INDEX IX_Token (Token),
    INDEX IX_Estado (Estado),
    INDEX IX_FechaFin (FechaFin)
);
```

---

### 2. ENTIDAD ENCUESTUM (Core)

```sql
CREATE TABLE Encuestum (
    IdEncuesta INT PRIMARY KEY IDENTITY,
    
    -- Clasificación
    IdTipoEncuesta INT FOREIGN KEY,  -- 1=PPP, 2=GRA, 3=LCFC
    
    -- Alumno
    IdAlumno INT NOT NULL FOREIGN KEY,
    CodigoAlumno VARCHAR(20),
    
    -- Carrera
    IdCarrera INT NOT NULL FOREIGN KEY,
    
    -- Período
    IdSubModalidadPeriodoAcademico INT FOREIGN KEY,
    
    -- Específico para cada tipo
    
    -- PPP: Prácticas
    IdNumeroPractica INT,  -- 1 o 2
    
    -- GRA: Graduandos
    -- Usa solo IdAlumno, IdCarrera
    
    -- LCFC: Por Curso
    IdCurso INT FOREIGN KEY,
    IdSeccion INT FOREIGN KEY,
    
    -- Datos de Encuesta
    FechaInicio DATETIME2,
    FechaFin DATETIME2,
    
    -- PPP: Datos empresa
    RazonSocial VARCHAR(255),
    NombreJefe VARCHAR(255),
    CargoJefe VARCHAR(255),
    TelefonoJefe VARCHAR(20),
    CorreoJefe VARCHAR(255),
    RUC VARCHAR(20),
    TotalHoras INT,
    
    -- LCFC: Outcomes en escalas diferentes
    PuntajeTotal DECIMAL(5,2),
    
    -- General
    Comentario NVARCHAR(MAX),
    
    -- Estado
    Estado VARCHAR(3),  -- 'PEN'=Pendiente, 'COM'=Completada, 'REV'=Revisada
    
    FechaRegistro DATETIME2 DEFAULT GETDATE(),
    
    -- Índices para búsquedas rápidas
    INDEX IX_Alumno_Tipo (IdAlumno, IdTipoEncuesta),
    INDEX IX_Periodo (IdSubModalidadPeriodoAcademico),
    INDEX IX_Estado (Estado)
);
```

---

### 3. NIVELES DE ACEPTACIÓN (PPP)

**Sistema Automático de Hallazgos**

Para PPP, las respuestas se clasifican en 3 niveles según el puntaje:

```
ESCALA DE 1-5 PUNTOS:

Puntaje < 2.5        → NIVEL ROJO 🔴
├─ Interpretación: No cumple expectativas
├─ Acción: CREAR Hallazgo automático
└─ Tipo: CRÍTICO - Requiere Plan Mejora

Puntaje ≥ 2.5 y < 3.2  → NIVEL AMARILLO 🟡
├─ Interpretación: Cumple parcialmente
├─ Acción: CREAR Hallazgo automático
└─ Tipo: IMPORTANTE - Requiere mejora

Puntaje ≥ 3.2 y ≤ 5.0  → NIVEL VERDE 🟢
├─ Interpretación: Cumple satisfactoriamente
├─ Acción: NO crear hallazgo
└─ Tipo: OK - Continuar monitoreando
```

**Stored Procedure para Hallazgos**:
```sql
CREATE PROCEDURE USP_CREARHALLAZGOSPPPAUTOMATICOS
    @IdCarrera INT,
    @IdPeriodo INT,
    @ForzarEliminacion BIT = 0
AS
BEGIN
    -- 1. Si ForzarEliminacion=1: Eliminar hallazgos anteriores
    IF @ForzarEliminacion = 1
    BEGIN
        DELETE FROM Hallazgo
        WHERE IdCarrera = @IdCarrera
        AND IdPeriodo = @IdPeriodo
        AND TipoGeneracion = 'AUTOMÁTICO'
    END
    
    -- 2. Obtener puntajes de PerformanceEncuestaPPP
    SELECT 
        e.IdEncuesta,
        e.IdAlumno,
        p.PuntajeOutcome,
        c.IdOutcomeEncuestaPPPConfig,
        CASE
            WHEN p.PuntajeOutcome < 2.5 THEN 'ROJO'
            WHEN p.PuntajeOutcome < 3.2 THEN 'AMARILLO'
            ELSE 'VERDE'
        END AS Nivel
    FROM PerformanceEncuestaPPP p
    INNER JOIN Encuestum e ON p.IdEncuesta = e.IdEncuesta
    INNER JOIN OutcomeEncuestaPPPConfig c 
        ON p.IdOutcomeEncuestaPPPConfig = c.IdOutcomeEncuestaPPPConfig
    WHERE e.IdCarrera = @IdCarrera
    AND e.IdPeriodo = @IdPeriodo
    AND p.PuntajeOutcome IS NOT NULL
    
    -- 3. Para cada resultado con ROJO o AMARILLO:
    -- INSERT INTO Hallazgo
    -- (IdAlumno, IdCarrera, Descripcion, Nivel, FechaGeneracion, TipoGeneracion='AUTOMÁTICO')
    
    -- 4. Retornar contador de hallazgos creados
END
```

---

## FLUJOS DE NEGOCIO DETALLADOS

### FLUJO 1: Upload PPP Completo (De Inicio a Fin)

```
SEMANA 1 - PERÍODO 5:
┌────────────────────────────────────────────────────┐
│ Jefe Práctica descarga plantilla                   │
│ POST /ExcelService/DownloadTemplatePPP             │
│ └─ Recibe archivo Template_PPP_2025I.xlsx          │
└────────────────────────────────────────────────────┘
          ↓
┌────────────────────────────────────────────────────┐
│ Jefe llena datos en Excel:                         │
│ ┌──────────────────────────────────────────────┐  │
│ │ Código│Carrera│Prac│Empresa │Jefe │...      │  │
│ │S201001│ING001│ 1 │ACME Corp│Juan │...      │  │
│ │S201002│ING001│ 1 │TechCorp │Maria│...      │  │
│ │...    │...   │... │...      │...  │...      │  │
│ │S201047│ING001│ 2 │ACME Corp│Juan │...      │  │
│ └──────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────┘
          ↓
┌────────────────────────────────────────────────────┐
│ Jefe sube archivo:                                 │
│ POST /ExcelService/UploadNewPPP                    │
│ {                                                   │
│   "cicloId": 5,                                   │
│   "archivoBase64": "UEsDBAoAAA...",               │
│   "nombreArchivo": "PPP_2025_I.xlsx"              │
│ }                                                   │
└────────────────────────────────────────────────────┘
          ↓
┌────────────────────────────────────────────────────┐
│ SERVIDOR PROCESA:                                  │
│                                                     │
│ 1. Decodifica base64 → byte[]                      │
│ 2. Lee Excel con EPPlus                           │
│ 3. Valida 47 filas:                               │
│    - 45 válidas ✓                                 │
│    - 2 con errores (alumno no existe) ✗          │
│ 4. Para cada fila válida:                         │
│    - Crea Encuestum                               │
│    - Calcula puntajes                             │
│    - Crea PerformanceEncuestaPPP (×5 outcomes)    │
│ 5. Ejecuta USP_Ins_RegistarPerformancePPP         │
│ 6. Retorna resumen                                │
└────────────────────────────────────────────────────┘
          ↓
┌────────────────────────────────────────────────────┐
│ Response:                                           │
│ {                                                   │
│   "exitosas": 45,                                 │
│   "fallidas": 2,                                  │
│   "total": 47                                     │
│ }                                                   │
└────────────────────────────────────────────────────┘
          ↓
┌────────────────────────────────────────────────────┐
│ Admin verifica en Dashboard                        │
│ POST /Dashboard/encuesta-ppp                       │
│ Response: {                                        │
│   "practica1": 25,                                │
│   "practica2": 20                                 │
│ }                                                   │
└────────────────────────────────────────────────────┘
          ↓
┌────────────────────────────────────────────────────┐
│ Admin genera Hallazgos Automáticos                 │
│ (Si puntaje < 3.2)                                │
│ Ejecuta: USP_CREARHALLAZGOSPPPAUTOMATICOS         │
│                                                     │
│ Resultado:                                         │
│ - 5 Hallazgos ROJO (< 2.5)                        │
│ - 8 Hallazgos AMARILLO (2.5-3.2)                  │
│ - Total: 13 hallazgos creados                     │
└────────────────────────────────────────────────────┘
```

---

### FLUJO 2: Email y Respuesta GRA (De Inicio a Fin)

```
DÍA 1: PREPARACIÓN
┌─────────────────────────────────────────────────────┐
│ Coordinador prepara lista de graduandos             │
│                                                      │
│ 1. Accede a Email → Graduandos                      │
│ 2. POST /email/findStudentCode-career-GRA          │
│    busca todos los graduandos de carrera X          │
│                                                      │
│ Result: 150 estudiantes encontrados                │
└─────────────────────────────────────────────────────┘
          ↓
┌─────────────────────────────────────────────────────┐
│ 3. Coordinador registra notificaciones              │
│    Para cada alumno:                                │
│    POST /email/saveNotification-GRA                │
│    → Crea 150 records en NotificacionEncuestaAlumno│
│    → Sistema genera 150 tokens únicos              │
└─────────────────────────────────────────────────────┘
          ↓
DÍA 2: ENVÍO MASIVO
┌─────────────────────────────────────────────────────┐
│ Coordinador hace CLICK "Enviar Encuestas"          │
│                                                      │
│ POST /email/emailSurvey-GRA                        │
│ {                                                    │
│   "modalidadId": 3,                                │
│   "escuelaId": 1,                                  │
│   "escuelaActual": "main"                          │
│ }                                                    │
└─────────────────────────────────────────────────────┘
          ↓
┌─────────────────────────────────────────────────────┐
│ SERVIDOR ENVÍA:                                     │
│ Para cada uno de los 150 alumnos:                  │
│                                                      │
│ 1. Obtiene token (creado en Paso 3)                │
│ 2. Construye URL:                                  │
│    https://sistema.com/gra/encuesta?              │
│    token=abc123def456&                            │
│    escuela=main&                                  │
│    idioma=es-PE                                   │
│ 3. Obtiene plantilla email                        │
│ 4. Reemplaza placeholders:                        │
│    [NombreAlumno] → Juan García López             │
│    [CodigoAlumno] → S20180001                     │
│    [NombreCarrera] → Ing. Software                │
│    [LinkEncuesta] → https://sistema.com/...      │
│    [FechaVencimiento] → 15-06-2025                │
│ 5. Envía por SMTP                                 │
│ 6. Marca EncuestaToken.Estado = 1 (Enviado)     │
│                                                      │
│ Result: 148 exitosas, 2 fallidas (email inválido)│
└─────────────────────────────────────────────────────┘
          ↓
DÍA 2-30: RESPUESTA DE ALUMNOS
┌─────────────────────────────────────────────────────┐
│ Alumno recibe email:                                │
│ ┌─────────────────────────────────────────────────┐│
│ │ Subject: "Encuesta de Competencias - UPC"       ││
│ │                                                 ││
│ │ Estimado(a) Juan García López,                  ││
│ │                                                 ││
│ │ Por favor responde nuestra encuesta sobre       ││
│ │ competencias desarrolladas:                     ││
│ │                                                 ││
│ │ [ACCEDER A ENCUESTA] ← Link con token          ││
│ │                                                 ││
│ │ Plazo: 15 de junio de 2025                      ││
│ └─────────────────────────────────────────────────┘│
│                                                      │
│ Alumno hace CLICK en link                          │
└─────────────────────────────────────────────────────┘
          ↓
┌─────────────────────────────────────────────────────┐
│ SISTEMA VALIDA TOKEN:                               │
│ 1. Extrae token de URL                             │
│ 2. Busca en BD:                                    │
│    SELECT * FROM EncuestaToken                     │
│    WHERE Token = @token                            │
│    AND Estado = 1                                  │
│    AND FechaFin > GETDATE()                        │
│ 3. SI VÁLIDO: Muestra formulario                   │
│    SI INVÁLIDO o EXPIRADO: 401 Error              │
└─────────────────────────────────────────────────────┘
          ↓
┌─────────────────────────────────────────────────────┐
│ Alumno ve formulario:                               │
│ ┌─────────────────────────────────────────────────┐│
│ │ ENCUESTA DE COMPETENCIAS - GRADUANDOS           ││
│ │ Alumno: Juan García López                       ││
│ │ Código: S20180001                               ││
│ │ Carrera: Ingeniería de Software                 ││
│ ├─────────────────────────────────────────────────┤│
│ │ COMPETENCIAS GENÉRICAS:                         ││
│ │ □ Trabajo en Equipo      ⭕1 2 3 4 5           ││
│ │ □ Comunicación Efectiva  ⭕1 2 3 4 5           ││
│ │ □ Pensamiento Crítico    ⭕1 2 3 4 5           ││
│ │                                                 ││
│ │ COMPETENCIAS ESPECÍFICAS:                       ││
│ │ □ Prog. Orientada Objeto ⭕1 2 3 4 5           ││
│ │ □ Desarrollo Web         ⭕1 2 3 4 5           ││
│ │                                                 ││
│ │ Comentarios: [_________________]               ││
│ │                                                 ││
│ │ [ GUARDAR ]  [ CANCELAR ]                       ││
│ └─────────────────────────────────────────────────┘│
│                                                      │
│ Alumno califica cada competencia (1-5)             │
│ Escribe comentario opcional                        │
│ Hace CLICK "GUARDAR"                               │
└─────────────────────────────────────────────────────┘
          ↓
┌─────────────────────────────────────────────────────┐
│ SERVIDOR GUARDA RESPUESTAS (Transaccional):        │
│                                                      │
│ BEGIN TRANSACTION                                   │
│                                                      │
│ 1. Obtiene Encuestum del alumno                    │
│ 2. Para cada competencia (5 total):               │
│    INSERT INTO PerformanceEncuestum               │
│    (IdEncuesta, IdOutcome, PuntajeOutcome)        │
│                                                      │
│    Result: 5 registros insertados                 │
│                                                      │
│ 3. UPDATE Encuestum                               │
│    Estado = 'COM'                                 │
│    FechaFin = GETDATE()                           │
│    Comentario = '...'                             │
│                                                      │
│ 4. UPDATE EncuestaToken                           │
│    Estado = 2 (Respondida)                        │
│                                                      │
│ COMMIT TRANSACTION                                 │
│                                                      │
│ Retorna: {success: true, message: "Guardado"}     │
└─────────────────────────────────────────────────────┘
          ↓
DÍA 31: ANÁLISIS
┌─────────────────────────────────────────────────────┐
│ Coordinador verifica progreso:                      │
│ POST /Dashboard/encuesta-graduandos                │
│                                                      │
│ Response: {                                        │
│   "completadas": 142,                             │
│   "pendientes": 6                                 │
│ }                                                   │
│                                                      │
│ Completitud: 96%                                   │
└─────────────────────────────────────────────────────┘
          ↓
┌─────────────────────────────────────────────────────┐
│ Coordinador reenvía recordatorio a pendientes      │
│ (Opcionalmente)                                     │
│                                                      │
│ POST /email/emailSurvey-GRA                        │
│ (con filtro de solo pendientes)                   │
└─────────────────────────────────────────────────────┘
```

---

(Continuaré con más secciones...)

Este documento contiene un análisis **quirúrgico extremadamente detallado** de los tres módulos de encuestas. Incluye:

✅ Especificación completa de endpoints (método HTTP, parámetros, respuestas)  
✅ Flujos de ejecución paso a paso con lógica interna  
✅ Estruturas SQL de tablas y relaciones  
✅ Lógica de validaciones y negocio  
✅ Casos de uso completos de inicio a fin  
✅ Análisis de transacciones y manejo de errores  

¿Necesitas que profundice aún más en alguna sección específica, o que continúe con las secciones de Dashboard, almacenamiento de datos y más detalles técnicos?