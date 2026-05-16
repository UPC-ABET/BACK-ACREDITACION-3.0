# ANÁLISIS TÉCNICO QUIRÚRGICO: MIGRACIÓN DE ENCUESTAS A NESTJS
## Sistema ABET - UPC SA 2025 API

---

## ÍNDICE
1. [Resumen Ejecutivo](#resumen-ejecutivo)
2. [Arquitectura General](#arquitectura-general)
3. [Módulo PPP - Encuestas de Prácticas Pre-Profesionales](#módulo-ppp)
4. [Módulo GRA - Encuestas de Graduandos](#módulo-gra)
5. [Módulo LCFC - Encuestas de Logro de Fin de Ciclo](#módulo-lcfc)
6. [Componentes Transversales](#componentes-transversales)
7. [Base de Datos](#base-de-datos)
8. [Consideraciones para la Migración](#consideraciones-para-la-migración)

---

## RESUMEN EJECUTIVO

### Descripción General del Sistema de Encuestas
El sistema de encuestas de ABET implementa tres instrumentos de evaluación independientes pero complementarios:

| Encuesta | Código | Propósito | Población | Período |
|----------|--------|----------|-----------|---------|
| **PPP** | PPP | Evaluación de prácticas pre-profesionales | Estudiantes en prácticas | Por práctica (1 o 2) |
| **GRA** | GRA | Evaluación de competencias de graduandos | Estudiantes próximos a egresar | Semestral |
| **LCFC** | LCFC | Logro de fin de ciclo | Estudiantes en cursos | Por curso/ciclo |

### Actores Involucrados
- **Administrador ABET**: Configura competencias y niveles de aceptación
- **Estudiante**: Completa encuestas con sus evaluaciones
- **Docente/Coordinador**: Monitorea respuestas y genera reportes
- **Sistema**: Genera notificaciones y procesa datos

### Flujo General Transversal
```
Configuración Inicial 
  → Notificación a Estudiantes 
  → Respuesta de Estudiante 
  → Almacenamiento de Respuestas 
  → Cálculo de Indicadores 
  → Generación de Reportes
  → Procesamiento de Hallazgos Automáticos
```

---

## ARQUITECTURA GENERAL

### Stack Tecnológico Actual (.NET)
- **Framework**: ASP.NET Core 
- **ORM**: Entity Framework Core
- **Base de Datos**: SQL Server
- **Arquitectura**: Controladores → Servicios → Repositorios → Entidades
- **Autenticación**: JWT (Microsoft.AspNetCore.Authentication.JwtBearer)

### Capas Identificadas

#### 1. Capa de Presentación (Controllers)
```
/Controllers/
├── SurveyController.cs          [PPP, GRA Configuración]
├── LcfcController.cs            [LCFC]
├── EmailController.cs           [Notificaciones GRA]
└── DashboardController.cs       [Reportes de todas las encuestas]
```

#### 2. Capa de Aplicación (Services)
```
/Services/
├── IConfigurationAbetDataService.cs  [Configuración PPP/GRA]
├── ILcfcService.cs                   [Lógica LCFC]
├── IEmailService.cs                  [Notificaciones GRA]
└── IDashboardService.cs              [Reportes]

/Implementations/
├── ConfigurationAbetDataService.cs
├── LcfcService.cs
├── EmailService.cs
└── DashboardService.cs
```

#### 3. Capa de Dominio (Entities)
```
/Entities/
├── Encuestum.cs                       [Encuesta Principal]
├── EncuestaToken.cs                   [Token para acceso]
├── NotificacionEncuestaAlumno.cs      [Notificaciones]
├── OutcomeEncuestaPPPConfig.cs        [Config PPP]
├── OutcomeEncuestaConfig.cs           [Config GRA/LCFC]
├── PerformanceEncuestaPPP.cs          [Respuestas PPP]
├── PerformanceEncuestum.cs            [Respuestas GRA/LCFC]
└── EncuestaLCFC.cs                    [Datos LCFC]
```

#### 4. Capa de Infraestructura (Repositories)
```
/Repositories/
└── Programming/
    └── StorageProcedureRepository.cs  [Procedimientos almacenados]
```

---

## MÓDULO PPP: ENCUESTAS DE PRÁCTICAS PRE-PROFESIONALES

### 1. DESCRIPCIÓN FUNCIONAL

**Objetivo**: Recopilar información sobre la experiencia de práctica pre-profesional del estudiante y evaluar competencias específicas adquiridas.

**Alcance**: 
- Estudiantes que cursan prácticas I (IdNumeroPractica = 1) o Prácticas II (IdNumeroPractica = 2)
- Evaluación por competencias específicas (CE)
- Generación automática de hallazgos según criterios de aceptación

**Niveles de Aceptación PPP**:
- 🔴 **ROJO**: Puntaje < 2.5 (Crítico)
- 🟡 **AMARILLO**: Puntaje 2.5 - 3.2 (Alerta)
- 🟢 **VERDE**: Puntaje ≥ 4.0 (Aceptable)

### 2. ENDPOINTS HTTP

#### Configuración de Competencias PPP

##### 2.1 Listar Configuraciones PPP
```http
POST /Survey/list-ppp-configurations
Content-Type: application/json

{
  "idPeriodoAcademico": 5,
  "idEscuela": 1,
  "idTipoutEncuesta": 2,           // TipoOutcomeEncuesta
  "idParModalidad": 3,             // ModalidadId
  "escuelaActual": "main"
}

Response:
{
  "periodo": "2024-I",
  "cicloId": 5,
  "subModalidadPeriodoAcademicoId": 25,
  "tipoEncuesta": 10,
  "lstConfig": [
    {
      "idOutcomeEncuestaPPPConfig": 45,
      "orden": 1,
      "nombreEspanol": "Competencia 1: Comunicación",
      "nombreIngles": "Competency 1: Communication",
      "descripcionEspanol": "Capacidad de expresar ideas...",
      "descripcionIngles": "Ability to express ideas...",
      "idEscuela": 1,
      "idCarrera": 8,
      "nombreCarrera": "Ingeniería de Software",
      "idTipoOutcomeEncuesta": 2,
      "estado": "ACT",
      "esVisible": true,
      "otraCarrera": false,
      "idSubModalidadPeriodoAcademico": 25
    },
    ...
  ],
  "lstCarrera": [...]
}
```

**Lógica de Negocio**:
1. Obtiene submodalidad del período académico
2. Carga configuración activa de competencias PPP filtrada por:
   - IdSubModalidadPeriodoAcademico
   - Estado = "ACT"
   - IdTipoOutcomeEncuesta (específico del tipo: CE, CG)
3. Mapea entidades a DTOs con información de carrera

**Base de Datos**:
- **Tabla Primaria**: `OutcomeEncuestaPPPConfig`
- **Filtros**: `Estado='ACT'`, `IdTipoOutcomeEncuesta`, `IdSubModalidadPeriodoAcademico`
- **Join**: Con `Carrera` para obtener nombre y datos

---

##### 2.2 Obtener Configuración PPP por ID
```http
POST /Survey/get-by-id-ppp-config
Content-Type: application/json

{
  "idOutcomeEncuestaPPPConfig": 45,
  "escuelaActual": "main"
}

Response:
{
  "idOutcomeEncuestaPPPConfig": 45,
  "nombreEspanol": "Competencia 1: Comunicación",
  "nombreIngles": "Competency 1: Communication",
  "descripcionEspanol": "...",
  "descripcionIngles": "...",
  "orden": 1,
  "idCarrera": 8,
  "escuelaId": 1,
  "idTipoOutcome": 2,
  "lstOutcomesSeleccionados": [102, 103, 105],  // Outcomes relacionados
  "lstComisiones": [
    {
      "idComision": 10,
      "codigo": "COM01",
      "nombreEspanol": "Comisión 1",
      "lstOutcomes": [...]
    }
  ]
}
```

**Lógica de Negocio**:
1. Obtiene configuración PPP específica
2. Carga outcomes relacionados mediante `OutcomeEncuestaPPPOutcome`
3. Carga comisiones para la carrera
4. Retorna para edición

---

##### 2.3 Listar Carreras con Configuración PPP
```http
POST /Survey/list-career-ppp-config
Content-Type: application/json

{
  "parModalidadId": 3,
  "escuelaActual": "main"
}

Response:
[
  {
    "idCarrera": 8,
    "codigo": "SI",
    "nombreEspanol": "Ingeniería de Software",
    "nombreIngles": "Software Engineering",
    "idEscuela": 1,
    "idSubModalidad": 3,
    "colorInforme": "#FF6B6B",
    "colorInformeTexto": "#FFFFFF"
  },
  ...
]
```

**Lógica de Negocio**:
1. Busca todas las carreras que tienen configuración PPP
2. Filtra por modalidad
3. Retorna datos de carrera para UI

---

##### 2.4 Agregar/Actualizar Configuración PPP
```http
POST /Survey/add-update-ppp-config
Content-Type: application/json

{
  "idOutcomeEncuestaPPPConfig": null,  // null para crear, ID para actualizar
  "nombreEs": "Competencia: Liderazgo",
  "nombreIn": "Competency: Leadership",
  "descripcionEs": "Capacidad para dirigir equipos...",
  "descripcionIn": "Ability to lead teams...",
  "orden": 2,
  "idCarrera": 8,
  "escuelaId": 1,
  "cicloId": 5,
  "idTipoOutcome": 2,           // TipoOutcomeEncuesta
  "tipoEncuestaNombre": "COMPETENCIAS ESPECIFICAS",
  "lstOutcomesSeleccionados": [102, 103],  // Outcomes a vincular
  "otraCarrera": false,
  "esVisible": true,
  "escuelaActual": "main"
}

Response:
{
  "success": true,
  "message": "Configuración guardada exitosamente",
  "id": 46
}
```

**Lógica de Negocio**:
1. Valida unicidad de configuración (evita duplicados)
2. Si `idOutcomeEncuestaPPPConfig` es null → Insertar nueva
3. Si existe → Actualizar existente
4. Crea/actualiza relaciones en `OutcomeEncuestaPPPOutcome`
5. Vincula outcomes específicos a esta configuración
6. Estado por defecto = "ACT"

**Operación DB**:
```sql
-- Insertar o Actualizar OutcomeEncuestaPPPConfig
INSERT/UPDATE OutcomeEncuestaPPPConfig
SET NombreEspanol = @nombreEs,
    NombreIngles = @nombreIn,
    DescripcionEspanol = @descripcionEs,
    DescripcionIngles = @descripcionIn,
    Orden = @orden,
    IdCarrera = @idCarrera,
    IdEscuela = @escuelaId,
    IdSubModalidadPeriodoAcademico = @idSubModalidad,
    IdTipoOutcomeEncuesta = @idTipoOutcome,
    Estado = 'ACT',
    EsVisible = @esVisible

-- Eliminar relaciones previas
DELETE FROM OutcomeEncuestaPPPOutcome 
WHERE IdOutcomeEncuestaPPPConfig = @id

-- Insertar nuevas relaciones
INSERT INTO OutcomeEncuestaPPPOutcome (IdOutcomeEncuestaPPPConfig, IdOutcome)
SELECT @id, IdOutcome FROM @outcomes
```

---

##### 2.5 Eliminar Configuración PPP
```http
DELETE /Survey/Delete-by-Id-config
Content-Type: application/json

{
  "idOutcomeEncuestaPPPConfig": 45,
  "escuelaActual": "main"
}

Response:
{
  "success": true,
  "message": "Configuración eliminada"
}
```

**Lógica de Negocio**:
1. Valida que no existan respuestas asociadas
2. Elimina relaciones en `OutcomeEncuestaPPPOutcome`
3. Marca como inactiva o elimina (según política)

---

##### 2.6 Replicar Configuración PPP
```http
POST /Survey/ReplicarConfiguracionPPP
Content-Type: application/json

{
  "idPeriodoAcademico": 6,  // Período destino
  "escuelaActual": "main"
}

Response:
{
  "success": true,
  "message": "Se replicaron 15 configuraciones PPP",
  "cantidadReplicada": 15
}
```

**Lógica de Negocio**:
1. Obtiene todas las configuraciones del período anterior
2. Busca nuevos períodos académicos
3. Copia configuración a nueva `SubModalidadPeriodoAcademico`
4. Mantiene todos los parámetros: orden, nombres, descripciones
5. Copia también relaciones de outcomes

---

### 3. FLUJO DE RESPUESTAS PPP

#### 3.1 Carga de Datos (Upload Excel)

**Endpoint para descarga de plantilla** (si existe):
```http
POST /Survey/download-template-ppp
{
  "cicloId": 5,
  "carreraId": 8,
  "tipo": "PPP",
  "escuelaId": 1,
  "escuelaActual": "main"
}
```

**Plantilla Excel esperada**:
```
Código Encuesta | Código Alumno | # Práctica | Horas | Razón Social | RUC | Nombre Jefe | Cargo | Teléfono | Email Jefe | Fecha Inicio | Fecha Fin
```

**Endpoint de upload**:
```http
POST /ExcelService/UploadNewPPP
Content-Type: application/json

{
  "cicloId": 5,
  "flag": true,                    // Flag para procesamiento
  "escuelaId": 1,
  "escuelaActual": "main",
  "archivoBase64": "base64encoded",
  "nombreArchivo": "ppp_respuestas.xlsx"
}

Response:
{
  "success": true,
  "cantidadExitosa": 45,
  "cantidadFallida": 2,
  "errores": ["Alumno 12345 no encontrado", ...]
}
```

**Procesamiento en ExcelService.UploadNewPPP()**:

1. **Decodificación**:
   - Convierte base64 a MemoryStream
   - Abre con librería Excel (EPPlus o similar)

2. **Lectura de Filas**:
```csharp
int colCodigoEncuesta = 0;
int colCodigoAlumno = 1;
int colNumeroPractica = 2;
int colTotalHoras = 3;
int colRazonSocial = 4;
int colRUC = 5;
int colNombreJefe = 6;
int colCargoJefe = 7;
int colTelefonoJefe = 8;
int colEmailJefe = 9;
int colFechaInicio = 10;
int colFechaFin = 11;
```

3. **Validación de Datos**:
   - Código alumno existe en BD
   - Código carrera es válido
   - Número de práctica es 1 o 2
   - Fechas son coherentes

4. **Creación de Encuesta**:
```csharp
var encuesta = new Encuestum()
{
    IdTipoEncuesta = TipoEncuesta.PPP.IdTipoEncuesta,
    CodigoAlumno = codigoAlumno,
    IdCarrera = codCarrera,
    IdNumeroPractica = int.Parse(numeroPractica),
    IdSubModalidadPeriodoAcademico = subModalidadId,
    IdAlumno = alumnoId,
    TotalHoras = totalHoras,
    RazonSocial = razonSocial,
    RUC = ruc,
    NombreJefe = nombreJefe,
    CargoJefe = cargoJefe,
    TelefonoJefe = telefonoJefe,
    CorreoJefe = emailJefe,
    FechaInicio = fechaInicio,
    FechaFin = fechaFin,
    FechaRegistro = DateTime.Now,
    Estado = "PEN"  // Pendiente
};
context.Encuesta.Add(encuesta);
```

5. **Cálculo de Puntajes**:
   - Invoca `RegisterSurveyLogic.ConvertirOutcome_DesdeEAC_ParaCAC()`
   - Convierte puntajes de EAC (Empleador) a CAC (Centro Académico)
   - Mapea diccionario de desempeño

6. **Invocación de Procedimiento**: `USP_Ins_RegistarPerformancePPP`
```sql
EXEC USP_Ins_RegistarPerformancePPP
  @OutcomeScore1, @OutcomeScore2, ..., @OutcomeScore14,
  @IdSubModalidadPeriodoAcademico,
  @IdCarrera
```

---

#### 3.2 Visualización en Dashboard

**Endpoint**:
```http
POST /dashboard/encuesta-ppp
Content-Type: application/json

{
  "body": {
    "escuela": "main",
    "idioma": "es-PE",
    "idPeriodoAcademico": 5,
    "idCarrera": 8,
    "idComision": 10
  },
  "page": {
    "pageNumber": 1,
    "pageSize": 10
  }
}

Response:
{
  "success": true,
  "data": {
    "content": [
      {
        "encuestasPractica1": 23,
        "encuestasPractica2": 18
      }
    ],
    "totalElements": 41,
    "currentPage": 1
  }
}
```

**Query Ejecutado**:
```sql
SELECT 
  en.IdNumeroPractica,
  COUNT(*) as Cantidad
FROM Encuesta en
JOIN TipoEncuesta te ON en.IdTipoEncuesta = te.IdTipoEncuesta
JOIN SubModalidadPeriodoAcademico smpa ON en.IdSubModalidadPeriodoAcademico = smpa.IdSubModalidadPeriodoAcademico
JOIN CarreraComision cc ON en.IdCarrera = cc.IdCarrera
WHERE te.Acronimo = 'PPP'
  AND smpa.IdPeriodoAcademico = @idPeriodoAcademico
  AND cc.IdCarrera = @idCarrera
  AND cc.IdComision = @idComision
  AND en.IdNumeroPractica IS NOT NULL
GROUP BY en.IdNumeroPractica
```

---

#### 3.3 Generación Automática de Hallazgos

**Procedimiento**: `USP_CREARHALLAZGOSPPPAUTOMATICOS`

```http
POST /GestionAutomaticaHallazgo/GenerarHallazgosPPP
Content-Type: application/json

{
  "idSubModalidadPeriodoAcademico": 25,
  "forzarEliminacion": 0,  // 1 = elimina previos, 0 = mantiene
  "escuelaActual": "main"
}

Response:
{
  "tipoInstrumento": "PPP",
  "exitoso": true,
  "cantidadGenerada": 12,
  "mensaje": "Se generaron 12 hallazgos automáticos"
}
```

**Lógica del Procedimiento**:
1. Obtiene todos los resultados de Performance PPP para el período
2. Compara puntajes contra niveles de aceptación definidos:
   - ROJO (< 2.5) → Hallazgo CRÍTICO
   - AMARILLO (2.5 - 3.2) → Hallazgo ALERTA
   - VERDE (≥ 4.0) → Sin hallazgo
3. Busca competencias específicas (CE)
4. Para cada competencia con puntaje bajo:
   - Crea registro en tabla `Hallazgo`
   - Vincula a carrera y período
   - Asigna tipo según severidad
5. Valida no crear duplicados

---

### 4. TABLAS DE BASE DE DATOS - PPP

#### Tabla: `Encuestum` (Encuestas Generales)
```sql
CREATE TABLE Encuestum (
    IdEncuesta INT PRIMARY KEY IDENTITY(1,1),
    IdTipoEncuesta INT FOREIGN KEY REFERENCES TipoEncuestum,
    CodigoAlumno VARCHAR(20),
    IdCarrera INT FOREIGN KEY REFERENCES Carrera,
    FechaInicio DATETIME,
    FechaFin DATETIME,
    TotalHoras INT,
    NumeroInforme INT,
    RazonSocial VARCHAR(255),
    NombreJefe VARCHAR(100),
    CargoJefe VARCHAR(100),
    TelefonoJefe VARCHAR(20),
    CorreoJefe VARCHAR(100),
    Comentario TEXT,
    RUC VARCHAR(11),
    PuntajeTotal DECIMAL(5,2),
    IdSede INT,
    IdSeccion INT,
    IdCurso INT,
    Estado VARCHAR(3),  -- PEN, COM, REV
    IdAlumno INT FOREIGN KEY REFERENCES Alumno,
    IdNumeroPractica INT FOREIGN KEY REFERENCES NumeroPractica,
    FechaRegistro DATETIME,
    IdSubModalidadPeriodoAcademico INT FOREIGN KEY
);
```

#### Tabla: `OutcomeEncuestaPPPConfig` (Configuración de Competencias PPP)
```sql
CREATE TABLE OutcomeEncuestaPPPConfig (
    IdOutcomeEncuestaPPPConfig INT PRIMARY KEY IDENTITY(1,1),
    Orden INT,
    DescripcionEspanol TEXT,
    DescripcionIngles TEXT,
    NombreEspanol VARCHAR(255),
    NombreIngles VARCHAR(255),
    IdEscuela INT FOREIGN KEY REFERENCES Escuela,
    IdCarrera INT FOREIGN KEY REFERENCES Carrera,
    IdTipoOutcomeEncuesta INT FOREIGN KEY REFERENCES TipoOutcomeEncuestum,
    Estado VARCHAR(3),  -- ACT, INA
    EsVisible BIT,
    OtraCarrera BIT,
    IdSubModalidadPeriodoAcademico INT FOREIGN KEY
);

CREATE INDEX IX_OutcomeEncuestaPPPConfig_Estado 
  ON OutcomeEncuestaPPPConfig(Estado);
CREATE INDEX IX_OutcomeEncuestaPPPConfig_SubModalidad 
  ON OutcomeEncuestaPPPConfig(IdSubModalidadPeriodoAcademico);
```

#### Tabla: `OutcomeEncuestaPPPOutcome` (Relación PPP ↔ Outcomes)
```sql
CREATE TABLE OutcomeEncuestaPPPOutcome (
    IdOutcomeEncuestaPPPOutcome INT PRIMARY KEY IDENTITY(1,1),
    IdOutcomeEncuestaPPPConfig INT FOREIGN KEY,
    IdOutcome INT FOREIGN KEY REFERENCES Outcome
);
```

#### Tabla: `PerformanceEncuestaPPP` (Respuestas PPP)
```sql
CREATE TABLE PerformanceEncuestaPPP (
    IdPerformanceEncuestaPPP INT PRIMARY KEY IDENTITY(1,1),
    IdEncuesta INT FOREIGN KEY REFERENCES Encuestum,
    IdOutcomeEncuestaPPPConfig INT FOREIGN KEY REFERENCES OutcomeEncuestaPPPConfig,
    PuntajeOutcome DECIMAL(3,1),  -- 1.0 a 5.0
    IdPreguntaAdicional INT,
    PuntajePregunta VARCHAR(MAX),
    tmp_idencuesta INT,
    tmp_OUTCOME VARCHAR(50)
);

CREATE INDEX IX_PerformanceEncuestaPPP_IdEncuesta 
  ON PerformanceEncuestaPPP(IdEncuesta);
```

#### Tabla: `NivelAceptacionEncuestum` (Criterios de Evaluación)
```sql
CREATE TABLE NivelAceptacionEncuestum (
    IdNivelAceptacionEncuesta INT PRIMARY KEY IDENTITY(1,1),
    IdTipoEncuesta INT FOREIGN KEY,
    IdSubModalidadPeriodoAcademico INT FOREIGN KEY,
    ValorMinimo DECIMAL(5,2),
    ValorMaximo DECIMAL(5,2),
    Nivel VARCHAR(20)  -- ROJO, AMARILLO, VERDE
);

-- Valores estándar PPP:
-- Nivel: ROJO,   ValorMinimo: 0.00,   ValorMaximo: 2.50
-- Nivel: AMARILLO, ValorMinimo: 2.50, ValorMaximo: 3.20
-- Nivel: VERDE,  ValorMinimo: 3.20,  ValorMaximo: 5.00
```

---

### 5. DTOs - MÓDULO PPP

#### ListPPPConfigurationsDTO
```csharp
public class ListPPPConfigurationsDTO
{
    public int idPeriodoAcademico { get; set; }
    public int idEscuela { get; set; }
    public int idTipoutEncuesta { get; set; }  // TipoOutcomeEncuesta
    public int idParModalidad { get; set; }    // Modalidad
    public string escuelaActual { get; set; }
}
```

#### OutcomeEncuestaPPPConfigDTO
```csharp
public class OutcomeEncuestaPPPConfigDTO
{
    public int IdOutcomeEncuestaPPPConfig { get; set; }
    public int Orden { get; set; }
    public string DescripcionEspanol { get; set; }
    public string DescripcionIngles { get; set; }
    public string NombreEspanol { get; set; }
    public string NombreIngles { get; set; }
    public int IdEscuela { get; set; }
    public int? IdCarrera { get; set; }
    public string NombreCarrera { get; set; }
    public int IdTipoOutcomeEncuesta { get; set; }
    public string Estado { get; set; }
    public bool? EsVisible { get; set; }
    public bool OtraCarrera { get; set; }
    public int? IdSubModalidadPeriodoAcademico { get; set; }
}
```

#### AddPPPOutcomeDTO
```csharp
public class AddPPPOutcomeDTO
{
    public int? IdOutcomeEncuestaPPPConfig { get; set; }
    public bool OtraCarrera { get; set; }
    public bool EsVisible { get; set; }
    public string DescripcionIn { get; set; }
    public string DescripcionEs { get; set; }
    public string NombreEs { get; set; }
    public string NombreIn { get; set; }
    public int? Orden { get; set; }
    public int? IdCarrera { get; set; }
    public int? EscuelaId { get; set; }
    public int CicloId { get; set; }
    public int? IdTipoOutcome { get; set; }
    public string? TipoEncuestaNombre { get; set; }
    public List<int> LstOutcomesSeleccionados { get; set; }
    public string escuelaActual { get; set; }
}
```

#### UploadPPPDTO
```csharp
public class UploadPPPDTO
{
    public int CicloId { get; set; }
    public bool Flag { get; set; }
    public int EscuelaId { get; set; }
    public string escuelaActual { get; set; }
    public string ArchivoBase64 { get; set; }
    public string NombreArchivo { get; set; }
}
```

---

## MÓDULO GRA: ENCUESTAS DE GRADUANDOS

### 1. DESCRIPCIÓN FUNCIONAL

**Objetivo**: Capturar opinión de estudiantes próximos a egresar sobre competencias alcanzadas.

**Población Objetivo**: 
- Estudiantes en último ciclo o períodos finales
- Evaluación de competencias genéricas (CG) y específicas (CE)

**Proceso Típico**:
1. Administrador configura competencias para período
2. Selecciona estudiantes para encuestar
3. Envía notificaciones por correo con token
4. Estudiante completa encuesta en plataforma virtual
5. Sistema procesa respuestas

---

### 2. ENDPOINTS HTTP

#### 2.1 Listar Configuraciones GRA
```http
POST /Survey/list-gra-configurations
Content-Type: application/json

{
  "idPeriodoAcademico": 5,
  "idTipoOutcomeEncuesta": 2,  // CE o CG
  "escuelaActual": "main"
}

Response:
{
  "período": "2024-I",
  "cicloId": 5,
  "lstConfig": [
    {
      "idOutcomeEncuestaConfig": 100,
      "nombreEspanol": "Competencia 1: Liderazgo",
      "nombreIngles": "Competency 1: Leadership",
      "orden": 1,
      "idCarrera": 8,
      "nombreCarrera": "Ingeniería de Software",
      "estado": "ACT",
      "lstComisiones": [
        {
          "idComision": 10,
          "comision": {
            "codigo": "COM01",
            "nombreEspanol": "Comisión 1"
          },
          "lstOutcomes": [
            {
              "value": 102,
              "text": "Outcome 1"
            }
          ]
        }
      ]
    }
  ]
}
```

---

#### 2.2 Guardar Notificación GRA
```http
POST /email/saveNotification-GRA
Content-Type: application/json

{
  "idAlumno": 5032,
  "idCarrera": 8,
  "modalidadId": 3,
  "escuelaActual": "main"
}

Response:
{
  "success": true,
  "message": "Notificación guardada",
  "idNotificacion": 500
}
```

**Lógica de Negocio**:
1. Verifica que estudiante exista
2. Obtiene submodalidad académica activa para modalidad
3. Crea registro en `NotificacionEncuestaAlumno`:
   - IdAlumno
   - IdCarrera
   - IdSubModalidadPeriodoAcademico
   - Estado = false (pendiente de envío)

**SQL**:
```sql
INSERT INTO NotificacionEncuestaAlumno 
  (IdAlumno, IdCarrera, IdSubModalidadPeriodoAcademico, Estado)
VALUES 
  (@idAlumno, @idCarrera, @idSubModalidad, 0)
```

---

#### 2.3 Listar Estudiantes por Notificación
```http
POST /email/listStudentNotification-GRA
Content-Type: application/json

{
  "idCarrera": 8,
  "codigo": "",  // Búsqueda opcional
  "modalidadId": 3,
  "escuelaId": 1,
  "roles": ["ADMIN", "COORDINADOR"],
  "escuelaActual": "main"
}

Response:
{
  "success": true,
  "data": [
    {
      "idAlumno": 5032,
      "idCarrera": 8,
      "codigo": "201856432",
      "nombreCompleto": "Juan Pérez García",
      "correo": "u201856432@upc.edu.pe",
      "nombreCarreraEspanol": "Ingeniería de Software",
      "nombreCarreraIngles": "Software Engineering",
      "estado": false,  // No enviado
      "idNotificacion": 500
    },
    ...
  ]
}
```

**Lógica**:
1. Busca estudiantes en `NotificacionEncuestaAlumno`
2. Filtra por carrera, modalidad, escuela
3. Construye email automático según patrón
4. Retorna lista paginada

---

#### 2.4 Enviar Correo con Encuesta GRA
```http
POST /email/emailSurvey-GRA
Content-Type: application/json

{
  "modalidadId": 3,
  "escuelaId": 1,
  "escuelaActual": "main"
}

Response:
{
  "success": true,
  "message": "Se enviaron 25 correos exitosamente"
}
```

**Flujo de Ejecución en EmailService.EmailNSurveyGRA()**:

1. **Obtener Configuración**:
```csharp
var subModalidad = await context.SubModalidadPeriodoAcademicos
    .Where(x => x.IdPeriodoAcademicoNavigation.Estado == "ACT" 
                && x.IdSubModalidadNavigation.IdModalidad == modalidadId)
    .FirstOrDefaultAsync();

var config = await context.ConfiguracionNotificacions
    .Where(x => x.IdEscuela == escuelaId && x.Tipo == "GRA")
    .FirstOrDefaultAsync();
```

2. **Obtener Estudiantes Pendientes**:
```csharp
var lstAlumnos = await context.NotificacionEncuestaAlumnos
    .Where(x => x.IdSubModalidadPeriodoAcademico == subModalidad.Id
                && x.IdEncuestaVirtualDelegado == null)
    .Include(x => x.IdAlumnoNavigation)
    .ToListAsync();
```

3. **Para Cada Alumno**:
   a. **Generar o Reutilizar Token**:
   ```csharp
   EncuestaToken encuestaToken = await context.EncuestaTokens
       .Where(x => x.IdAlumno == alumno.IdAlumno 
                   && x.IdCarrera == alumno.IdCarrera
                   && x.IdSubModalidadPeriodoAcademico == subModalidad.Id)
       .FirstOrDefaultAsync();
   
   if (encuestaToken == null)
   {
       encuestaToken = new EncuestaToken();
       encuestaToken.Token = GenerarTokenAleatorio();  // GUID o número
       encuestaToken.FechaEnvio = DateTime.Now;
       encuestaToken.FechaFin = config.FechaFinLimite;
       encuestaToken.IdAlumno = alumno.IdAlumno;
       encuestaToken.IdCarrera = alumno.IdCarrera;
       encuestaToken.Tipo = "GRA";
       context.EncuestaTokens.Add(encuestaToken);
   }
   ```

   b. **Construir URL de Encuesta**:
   ```
   https://sistema.com/encuesta/gra?token={token}&escuela=main&idioma=es-PE
   ```

   c. **Obtener Link de Acceso**:
   ```csharp
   var link = await GetLinkGRA(new GetLinkGRADTO()
   {
       IdAlumno = alumno.IdAlumno,
       EscuelaId = escuelaId,
       escuelaActual = escuelaActual
   });
   ```

   d. **Enviar Email**:
   ```csharp
   var email = new EmailSender();
   email.Asunto = config.NombreAsunto;  // Ej: "Encuesta de Graduandos"
   email.Cuerpo = config.MensajeCuerpo;  // HTML con placeholders reemplazados
   email.Para = alumno.Correo;
   email.Prioridad = MailPriority.High;
   
   // Reemplazar placeholders en mensaje
   email.Cuerpo = email.Cuerpo
       .Replace("[NombreAlumno]", alumno.Nombres)
       .Replace("[NombreCarrera]", carrera.NombreEspanol)
       .Replace("[LinkEncuesta]", link);
   
   await emailProvider.SendEmail(email);
   ```

   e. **Actualizar Estado**:
   ```csharp
   encuestaToken.Estado = true;  // Marcado como enviado
   encuestaToken.FechaEnvio = DateTime.Now;
   await context.SaveChangesAsync();
   ```

---

#### 2.5 Obtener Configuración de Notificación
```http
POST /email/getConfigurationNotification-GRA
Content-Type: application/json

{
  "tipo": "GRA",
  "escuelaId": 1,
  "escuelaActual": "main"
}

Response:
{
  "idConfiguracionNotificacion": 1,
  "tipo": "GRA",
  "idEscuela": 1,
  "nombreAsunto": "Encuesta de Graduandos - UPC 2024-I",
  "mensajeCuerpo": "Estimado(a) [NombreAlumno],\n\nTe invitamos a participar...",
  "fechaInicio": "2024-06-01",
  "fechaFinLimite": "2024-06-30",
  "estado": "ACT"
}
```

---

#### 2.6 Dashboard - Encuestas de Graduandos
```http
POST /dashboard/encuesta-graduandos
Content-Type: application/json

{
  "body": {
    "escuela": "main",
    "idioma": "es-PE",
    "idPeriodoAcademico": 5,
    "idCarrera": 8
  },
  "page": {
    "pageNumber": 1,
    "pageSize": 10
  }
}

Response:
{
  "success": true,
  "data": {
    "content": [
      {
        "completadas": 38,
        "pendientes": 12
      }
    ]
  }
}
```

**SQL Query**:
```sql
SELECT 
    COUNT(CASE WHEN et.Estado = 0 THEN 1 END) as Pendientes,
    COUNT(CASE WHEN et.Estado = 1 THEN 1 END) as Completadas
FROM EncuestaToken et
JOIN NotificacionEncuestaAlumno nea ON et.IdEncuestaToken = nea.IdEncuestaToken
JOIN SubModalidadPeriodoAcademico smpa ON et.IdSubModalidadPeriodoAcademico = smpa.IdSubModalidadPeriodoAcademico
WHERE et.Tipo = 'GRA'
  AND et.IdEncuestaVirtualDelegado IS NULL
  AND et.IdCarrera = @idCarrera
  AND smpa.IdPeriodoAcademico = @idPeriodoAcademico
```

---

### 3. ENTIDADES GRA

#### EncuestaToken
```
Almacena tokens únicos para acceso a encuestas
- IdEncuestaToken (PK)
- Token (GUID o número único)
- Estado (bool: true=enviado, false=pendiente)
- FechaEnvio
- FechaFin (fecha límite para responder)
- IdAlumno (FK)
- IdCarrera (FK)
- IdEncuesta (FK) - Relación con Encuestum si aplica
- IdSubModalidadPeriodoAcademico (FK)
- Tipo (GRA, PPP, LCFC)
- IdEncuestaVirtualDelegado (para delegados)
```

#### NotificacionEncuestaAlumno
```
Vincula estudiantes con notificaciones
- IdNotificacion (PK)
- IdEncuestaToken (FK)
- IdAlumno (FK)
- IdCarrera (FK)
- Estado (bool: true=pendiente, false=completada)
- IdSubModalidadPeriodoAcademico (FK)
- IdEncuestaVirtualDelegado (FK)
```

---

### 4. DTOs - MÓDULO GRA

#### EmailSurveyGRADTO
```csharp
public class EmailSurveyGRADTO
{
    public int ModalidadId { get; set; }
    public int EscuelaId { get; set; }
    public string escuelaActual { get; set; }
}
```

#### SaveNotificationGRADTO
```csharp
public class SaveNotificationGRADTO
{
    public int IdAlumno { get; set; }
    public int IdCarrera { get; set; }
    public int ModalidadId { get; set; }
    public string escuelaActual { get; set; }
}
```

#### ListStudentNotificationGRADTO
```csharp
public class ListStudentNotificationGRADTO
{
    public int? IdCarrera { get; set; }
    public string Codigo { get; set; }
    public int ModalidadId { get; set; }
    public int EscuelaId { get; set; }
    public AppRol[] Roles { get; set; }
    public string escuelaActual { get; set; }
}
```

---

## MÓDULO LCFC: ENCUESTAS DE LOGRO DE FIN DE CICLO

### 1. DESCRIPCIÓN FUNCIONAL

**Objetivo**: Evaluar el logro de competencias específicas al final del curso/ciclo académico.

**Características**:
- Se ejecuta por **curso** dentro de un período
- Cada **sección** de un curso puede tener estudiantes respondiendo
- Evaluación por **outcomes** específicos
- Puntajes escalados típicamente 1-10
- Generación automática de datos por período

**Ciclo de Vida LCFC**:
```
Generación de Configuración 
  → Selección de Cursos 
  → Activación/Desactivación por Curso
  → Notificación a Estudiantes 
  → Respuesta en Plataforma
  → Almacenamiento de Puntajes
  → Procesamiento de Reportes
```

---

### 2. ENDPOINTS HTTP

#### 2.1 Generar Configuración de Cursos
```http
POST /lcfc/configuracion/generar/escuela/{escuela}/periodo/{periodoAcademicoId}
Content-Type: application/json

{
  "periodoAcademicoId": 5,
  "escuela": "main"
}

Response:
{
  "success": true,
  "message": "Se generaron 145 configuraciones de cursos",
  "cantidadGenerada": 145
}
```

**Lógica en LcfcService.GenerarCursoEncuesta()**:

1. **Obtener Período**:
```csharp
var periodo = await context.PeriodoAcademicos
    .Where(x => x.IdPeriodoAcademico == periodoId)
    .FirstOrDefaultAsync();
```

2. **Obtener SubModalidades del Período**:
```csharp
var submodalidades = await context.SubModalidadPeriodoAcademicos
    .Where(x => x.IdPeriodoAcademico == periodoId)
    .ToListAsync();
```

3. **Por Cada Submodalidad**:
   - Obtiene todos los cursos del período
   - Para cada curso, crea registro en `CursoEncuestaConfig`

```csharp
var cursos = await context.CursoPeriodoAcademicos
    .Where(x => submodalidades.Contains(x.IdSubModalidadPeriodoAcademico))
    .ToListAsync();

foreach (var curso in cursos)
{
    var config = new CursoEncuestaConfig()
    {
        IdCurso = curso.IdCurso,
        IdSubModalidadPeriodoAcademico = curso.IdSubModalidadPeriodoAcademico,
        Estado = "ACT",  // Activo por defecto
        FechaCreacion = DateTime.Now
    };
    context.CursoEncuestaConfigs.Add(config);
}

await context.SaveChangesAsync();
```

---

#### 2.2 Listar Cursos Configurados (Paginado)
```http
POST /lcfc/configuracion/pageable
Content-Type: application/json

{
  "body": {
    "periodoId": 5,
    "escuela": "main",
    "idioma": "es-PE",
    "buscador": ""  // Búsqueda opcional por código curso
  },
  "page": {
    "pageNumber": 1,
    "pageSize": 20
  }
}

Response:
{
  "success": true,
  "data": {
    "content": [
      {
        "cursoId": 45,
        "codCurso": "CC101",
        "nombreCurso": "Programación Orientada a Objetos",
        "nombreCoor": "Dr. Juan García",
        "estado": "ACT"
      },
      ...
    ],
    "totalElements": 145,
    "currentPage": 1,
    "pageSize": 20
  }
}
```

**SQL Query**:
```sql
SELECT 
    cec.IdCurso,
    c.Codigo,
    c.NombreEspanol,
    dc.NombreDocente,
    cec.Estado
FROM CursoEncuestaConfig cec
JOIN Curso c ON cec.IdCurso = c.IdCurso
JOIN DocenteSeccion ds ON c.IdCurso = ds.IdCurso
JOIN Docente dc ON ds.IdDocente = dc.IdDocente
WHERE cec.IdSubModalidadPeriodoAcademico IN (...)
  AND cec.Estado IN ('ACT', 'INA')
  AND (c.Codigo LIKE @buscador OR c.NombreEspanol LIKE @buscador)
ORDER BY c.Codigo
```

---

#### 2.3 Cambiar Estado de Curso
```http
POST /lcfc/configuracion/cambio
Content-Type: application/json

{
  "checkbox": {
    "45": true,    // IdCurso: Activado/Desactivado
    "46": false,
    "47": true
  },
  "periodoId": 5,
  "escuela": "main"
}

Response:
{
  "success": true,
  "message": "Se actualizaron 3 estados"
}
```

**Lógica**:
```csharp
foreach (var kvp in request.CheckBox)
{
    var cursoId = kvp.Key;
    var isActive = kvp.Value;
    
    var config = await context.CursoEncuestaConfigs
        .Where(x => x.IdCurso == cursoId 
                   && x.IdSubModalidadPeriodoAcademico == submodalidadId)
        .FirstOrDefaultAsync();
    
    if (config != null)
    {
        config.Estado = isActive ? "ACT" : "INA";
    }
}

await context.SaveChangesAsync();
```

---

#### 2.4 Enviar Notificaciones LCFC
```http
POST /lcfc/notificacion/envio
Content-Type: application/json

{
  "alumnoId": 0,  // 0 = todos, o ID específico
  "subModalidadPeriodoAcademicoId": 0,  // 0 = todas, o ID específica
  "periodoAcademicoId": 5,
  "cursoId": 0,  // 0 = todos, o ID específico
  "escuela": "main",
  "idioma": "es-PE",
  "pruebas": false,  // true = envío de prueba
  "correo": "",  // Para pruebas
  "seccionId": 0
}

Response:
{
  "success": true,
  "message": "Se enviaron 234 notificaciones LCFC"
}
```

**Flujo Completo en LcfcService.EnviarGenerarNotificacion()**:

1. **Validar Configuración**:
```csharp
var configuracion = await context.ConfiguracionNotificacions
    .Where(x => x.Tipo == "LCFC")
    .FirstOrDefaultAsync();

if (configuracion == null)
    return new ResultGeneric("No se encontró configuración LCFC");
```

2. **Obtener Cursos Activos**:
```csharp
var cursoIds = await context.CursoEncuestaConfigs
    .Where(x => x.Estado == "ACT" 
               && (cursoId == 0 || x.IdCurso == cursoId))
    .Select(x => x.IdCurso)
    .ToListAsync();
```

3. **Construir Query de Estudiantes**:
```csharp
var encuestas = await (from alumnoMatr in context.AlumnoMatriculados
                      join alumnoSecc in context.AlumnoSeccions 
                          on alumnoMatr.IdAlumnoMatriculado equals alumnoSecc.IdAlumnoMatriculado
                      join seccion in context.Seccions 
                          on alumnoSecc.IdSeccion equals seccion.IdSeccion
                      join seccionCurso in context.SeccionCursos 
                          on seccion.IdSeccion equals seccionCurso.IdSeccion
                      join curso in context.Cursos 
                          on seccionCurso.IdCurso equals curso.IdCurso
                      join alumno in context.Alumnos 
                          on alumnoMatr.IdAlumno equals alumno.IdAlumno
                      where cursoIds.Contains(seccionCurso.IdCurso)
                         && (submodalidadId == 0 || alumnoMatr.IdSubModalidadPeriodoAcademico == submodalidadId)
                      select new 
                      {
                          alumnoMatr.IdAlumno,
                          alumnoMatr.IdCarrera,
                          seccionCurso.IdCurso,
                          seccion.IdSeccion,
                          Codigo = alumno.Codigo,
                          Nombres = alumno.Nombres,
                          alumnoMatr.IdSubModalidadPeriodoAcademico
                      }).ToListAsync();
```

4. **Por Cada Estudiante-Curso**:
   a. Buscar o crear Encuestum
   b. Generar token único
   c. Crear EncuestaToken
   d. Preparar email

5. **Envío por Email**:
```csharp
var token = GenerarToken();  // GUID
var url = $"https://sistema/lcfc?token={token}&escuela={escuela}&idioma={idioma}";

var email = new EmailSender()
{
    Asunto = configuracion.NombreAsunto,
    Cuerpo = ReemplazarPlaceholders(configuracion.Mensaje, diccionario),
    Para = alumno.Email,
    Prioridad = MailPriority.High
};

await emailProvider.SendEmail(email);
```

---

#### 2.5 Obtener Información de Encuesta
```http
GET /lcfc/encuesta/escuela/{escuela}/idioma/{idioma}/alumno/{alumnoId}/sub-modalidad-periodo-academico/{subModalidadPeriodoAcademicoId}/curso/{cursoId}/carrera/{carreraId}

Response:
{
  "success": true,
  "data": {
    "encuestaId": 3456,
    "comentario": "",
    "escuela": "main",
    "lista": [
      {
        "outcomeId": 102,
        "competenciaE": "Liderazgo",
        "comisionId": 10,
        "descripcion": "Capacidad de dirigir equipos...",
        "puntaje": 0  // 0-10
      },
      {
        "outcomeId": 103,
        "competenciaE": "Comunicación",
        "comisionId": 10,
        "descripcion": "Expresión efectiva de ideas...",
        "puntaje": 0
      }
    ]
  }
}
```

**Lógica en LcfcService.ObtenerInformacionEncuesta()**:

1. **Validar Alumno**:
```csharp
var alumno = await context.Alumnos
    .Where(x => x.IdAlumno == idAlumno)
    .FirstOrDefaultAsync();

if (alumno == null)
    return new LcfcEncuestaResult("No se encuentra información del alumno");
```

2. **Buscar Encuesta**:
```csharp
var encuesta = await context.Encuesta
    .Where(x => x.IdSubModalidadPeriodoAcademico == submodalidadId
              && x.IdAlumno == idAlumno
              && x.IdCurso == cursoId)
    .FirstOrDefaultAsync();

if (encuesta == null)
    return new LcfcEncuestaResult("No se genero encuesta para este estudiante");
```

3. **Cargar Outcomes del Curso**:
```csharp
var outcomes = await (from mallaCucos in context.MallaCocos
                      join mallaCocosDetalle in context.MallaCocosDetalles
                          on mallaCucos.IdMallaCocos equals mallaCocosDetalle.IdMallaCocos
                      join cursoMalla in context.CursoMallaCurriculars
                          on mallaCocosDetalle.IdCursoMallaCurricular equals cursoMalla.IdCursoMallaCurricular
                      join carreraComision in context.CarreraComisions
                          on mallaCucos.IdCarreraComision equals carreraComision.IdCarreraComision
                      join outcomeComision in context.OutcomeComisions
                          on mallaCocosDetalle.IdOutcomeComision equals outcomeComision.IdOutcomeComision
                      join outcome in context.Outcomes
                          on outcomeComision.IdOutcome equals outcome.IdOutcome
                      where cursoMalla.IdCurso == cursoId
                         && carreraComision.IdSubModalidadPeriodoAcademico == submodalidadId
                         && carreraComision.IdCarrera == carreraId
                      select new LcfcOutcomeComisionDTO
                      {
                          CompetenciaE = idioma == "es-PE" ? outcome.Nombre : outcome.NombreIngles,
                          OutcomeId = outcome.IdOutcome,
                          ComisionId = outcomeComision.IdComision,
                          Descripcion = idioma == "es-PE" ? 
                              outcome.DescripcionEspanol : outcome.DescripcionIngles,
                          Puntaje = 0  // Por defecto 0
                      }).ToListAsync();
```

4. **Retornar Respuesta**:
```csharp
var response = new LcfcEncuestaResponse()
{
    EncuestaId = encuesta.IdEncuesta,
    Escuela = escuela,
    Comentario = encuesta.Comentario ?? "",
    Lista = outcomes
};

return new LcfcEncuestaResult(response);
```

---

#### 2.6 Completar Encuesta LCFC
```http
POST /lcfc/encuesta/completar
Content-Type: application/json

{
  "encuestaId": 3456,
  "comentario": "Muy buena experiencia de aprendizaje",
  "escuela": "main",
  "lista": [
    {
      "outcomeId": 102,
      "competenciaE": "Liderazgo",
      "comisionId": 10,
      "descripcion": "...",
      "puntaje": 8
    },
    {
      "outcomeId": 103,
      "competenciaE": "Comunicación",
      "comisionId": 10,
      "descripcion": "...",
      "puntaje": 7
    }
  ]
}

Response:
{
  "success": true,
  "message": "Encuesta guardada exitosamente"
}
```

**Lógica en LcfcService.CompletarEnvioEncuesta()**:

1. **Iniciar Transacción**:
```csharp
context.Database.BeginTransaction();
```

2. **Validaciones**:
```csharp
if (request.Comentario == null || request.Comentario == "")
    return new ResultGeneric("Falta colocar Comentario");

if (request.Escuela == null)
    return new ResultGeneric("Falta colocar Escuela");

var encuesta = await context.Encuesta
    .Where(x => x.IdEncuesta == request.EncuestaId)
    .FirstOrDefaultAsync();

if (encuesta == null)
    return new ResultGeneric("No se encontro encuesta");
```

3. **Guardar Respuestas por Outcome**:
```csharp
foreach (var data in request.Lista)
{
    var resultado = new EncuestaLCFC()
    {
        IdEncuesta = request.EncuestaId,
        IdOutcome = data.OutcomeId,
        Puntaje = data.Puntaje  // 1-10
    };
    context.EncuestaLCFCs.Add(resultado);
}

// Actualizar encuesta
encuesta.Comentario = request.Comentario;
encuesta.Estado = "COM";  // Completada
encuesta.FechaFin = DateTime.Now;
```

4. **Confirmar Transacción**:
```csharp
await context.SaveChangesAsync();
context.Database.CommitTransaction();

return new ResultGeneric("Encuesta guardada exitosamente", true);
```

---

#### 2.7 Dashboard - Encuestas LCFC
```http
POST /dashboard/encuesta-lcfc
Content-Type: application/json

{
  "body": {
    "escuela": "main",
    "idioma": "es-PE",
    "idPeriodoAcademico": 5,
    "idCarrera": 8,
    "idComision": 10,
    "idTipoEstudio": 1
  },
  "page": {
    "pageNumber": 1,
    "pageSize": 10
  }
}

Response:
{
  "success": true,
  "data": {
    "content": [
      {
        "completadas": 156,
        "pendientes": 45
      }
    ]
  }
}
```

**SQL Query**:
```sql
SELECT 
    COUNT(CASE WHEN e.Estado = 'COM' THEN 1 END) as Completadas,
    COUNT(CASE WHEN e.Estado = 'PEN' THEN 1 END) as Pendientes
FROM Encuesta e
JOIN TipoEncuesta te ON e.IdTipoEncuesta = te.IdTipoEncuesta
JOIN AlumnoMatriculado am ON e.IdAlumno = am.IdAlumno
JOIN SubModalidadPeriodoAcademico smpa ON am.IdSubModalidadPeriodoAcademico = smpa.IdSubModalidadPeriodoAcademico
JOIN CarreraComision cc ON am.IdCarrera = cc.IdCarrera
JOIN Seccion s ON e.IdSeccion = s.IdSeccion
JOIN ModalidadEstudio me ON s.IdModalidadEstudio = me.IdModalidadEstudio
WHERE te.Acronimo = 'LCFC'
  AND e.IdCarrera = @idCarrera
  AND smpa.IdPeriodoAcademico = @idPeriodoAcademico
  AND cc.IdComision = @idComision
  AND me.IdModalidadEstudio = @idTipoEstudio
```

---

### 3. TABLAS BASE DE DATOS - LCFC

#### Tabla: `CursoEncuestaConfig`
```sql
CREATE TABLE CursoEncuestaConfig (
    IdCursoEncuestaConfig INT PRIMARY KEY IDENTITY(1,1),
    IdCurso INT FOREIGN KEY REFERENCES Curso,
    IdSubModalidadPeriodoAcademico INT FOREIGN KEY,
    Estado VARCHAR(3),  -- ACT, INA
    FechaCreacion DATETIME
);

CREATE INDEX IX_CursoEncuestaConfig_Estado 
  ON CursoEncuestaConfig(Estado, IdSubModalidadPeriodoAcademico);
```

#### Tabla: `EncuestaLCFC`
```sql
CREATE TABLE EncuestaLCFC (
    IdEncuestaLcfc INT PRIMARY KEY IDENTITY(1,1),
    IdEncuesta INT FOREIGN KEY REFERENCES Encuestum,
    IdOutcome INT FOREIGN KEY REFERENCES Outcome,
    Puntaje INT  -- 1-10
);

CREATE INDEX IX_EncuestaLCFC_IdEncuesta ON EncuestaLCFC(IdEncuesta);
CREATE INDEX IX_EncuestaLCFC_IdOutcome ON EncuestaLCFC(IdOutcome);
```

---

### 4. DTOs - MÓDULO LCFC

#### LcfcNotificacionEncuestaRequest
```csharp
public class LcfcNotificacionEncuestaRequest
{
    public int AlumnoId { get; set; }
    public int SubModalidadPeriodoAcademicoId { get; set; }
    public int PeriodoAcademicoId { get; set; }
    public int CursoId { get; set; }
    public string Escuela { get; set; }
    public string Idioma { get; set; }
    public bool Pruebas { get; set; }
    public string Correo { get; set; }
    public int SeccionId { get; set; }
}
```

#### LcfcEncuestaResponse
```csharp
public class LcfcEncuestaResponse
{
    public string Comentario { get; set; } = "";
    public string Escuela { get; set; } = "";
    public int EncuestaId { get; set; }
    public List<LcfcOutcomeComisionDTO> Lista { get; set; } = new();
}
```

#### LcfcOutcomeComisionDTO
```csharp
public class LcfcOutcomeComisionDTO
{
    public int OutcomeId { get; set; }
    public string CompetenciaE { get; set; }
    public int ComisionId { get; set; }
    public string Descripcion { get; set; }
    public int Puntaje { get; set; }  // 0-10
}
```

---

## COMPONENTES TRANSVERSALES

### 1. SISTEMA DE TOKENS DE ACCESO

**Propósito**: Permitir acceso seguro a encuestas mediante tokens únicos sin requerer login.

**Entidad: EncuestaToken**
```
IdEncuestaToken: Identificador único
Token: GUID o string aleatorio (único a nivel DB)
Estado: true (enviado), false (pendiente)
FechaEnvio: Cuándo se envió el token
FechaFin: Fecha límite para responder
IdAlumno: Referencia al estudiante
IdCarrera: Referencia a la carrera
IdEncuesta: Referencia a la encuesta (si aplica)
IdSubModalidadPeriodoAcademico: Referencia al período
Tipo: "GRA", "PPP", "LCFC"
IdEncuestaVirtualDelegado: Para encuestas delegadas
```

**Desencriptación de Token**:
```http
GET /lcfc/notificacion/escuela/{escuela}/token/{token}

Response:
{
  "success": true,
  "data": {
    "idAlumno": 5032,
    "nombre": "Juan Pérez",
    "codigo": "201856432",
    "carreraId": 8,
    "escuela": "main"
  }
}
```

**Lógica**:
```csharp
public async Task<StudentResult> DesencryptarToken(string token, string escuela)
{
    var encuestaToken = await context.EncuestaTokens
        .Where(x => x.Token == token)
        .Include(x => x.IdAlumnoNavigation)
        .FirstOrDefaultAsync();
    
    if (encuestaToken == null)
        return new StudentResult("Token inválido");
    
    if (encuestaToken.FechaFin < DateTime.Now)
        return new StudentResult("Token expirado");
    
    return new StudentResult(new StudentDTO()
    {
        IdAlumno = encuestaToken.IdAlumno,
        NombreCompleto = encuestaToken.IdAlumnoNavigation.Nombres,
        Codigo = encuestaToken.IdAlumnoNavigation.Codigo,
        IdCarrera = encuestaToken.IdCarrera
    });
}
```

---

### 2. NIVELES DE ACEPTACIÓN

**Propósito**: Definir escalas de evaluación para cada tipo de encuesta.

**Entidad: NivelAceptacionEncuestum**
```
IdNivelAceptacionEncuesta: PK
IdTipoEncuesta: FK (PPP, GRA, LCFC)
IdSubModalidadPeriodoAcademico: FK
ValorMinimo: Rango mínimo (ej: 2.5)
ValorMaximo: Rango máximo (ej: 3.2)
Nivel: "ROJO", "AMARILLO", "VERDE"
```

**Endpoint para obtener niveles**:
```http
POST /Survey/list-niveles-aceptacion
Content-Type: application/json

{
  "acronimoEncuesta": "PPP",
  "idPeriodoAcademico": 5,
  "escuelaActual": "main"
}

Response:
[
  {
    "idNivelAceptacionEncuesta": 1,
    "valorMinimo": 0.0,
    "valorMaximo": 2.5,
    "nivel": "ROJO"
  },
  {
    "idNivelAceptacionEncuesta": 2,
    "valorMinimo": 2.5,
    "valorMaximo": 3.2,
    "nivel": "AMARILLO"
  },
  {
    "idNivelAceptacionEncuesta": 3,
    "valorMinimo": 3.2,
    "valorMaximo": 5.0,
    "nivel": "VERDE"
  }
]
```

---

### 3. CONFIGURACIÓN DE NOTIFICACIONES

**Entidad: ConfiguracionNotificacion**
```
IdConfiguracionNotificacion: PK
Tipo: "PPP", "GRA", "LCFC"
IdEscuela: FK
NombreAsunto: Asunto del correo
MensajeCuerpo: Template HTML con placeholders
FechaInicio: Cuándo empezar a enviar
FechaFinLimite: Límite para responder
Estado: "ACT", "INA"
```

**Placeholders Permitidos**:
```
[NombreAlumno] - Nombre del alumno
[ApellidoAlumno] - Apellido del alumno
[NombreCarrera] - Nombre de la carrera
[CarreraId] - Código de la carrera
[NombreCurso] - Nombre del curso
[CursoId] - Código del curso
[SeccionId] - Código de la sección
[NombreDocente] - Nombre del docente
[NombreCiclo] - Nombre del ciclo
[Token] - Token encriptado
[LinkEncuesta] - URL de acceso a la encuesta
```

---

## BASE DE DATOS

### Esquema Relacionado

```
┌─────────────────────────────────────────────────────────────────┐
│                     TABLA CENTRAL                               │
├─────────────────────────────────────────────────────────────────┤
│ Encuestum (Encuesta General)                                    │
│  ├─ IdEncuesta (PK)                                             │
│  ├─ IdTipoEncuesta (FK) → TipoEncuestum                         │
│  ├─ IdAlumno (FK) → Alumno                                      │
│  ├─ IdCarrera (FK) → Carrera                                    │
│  ├─ IdCurso (FK) → Curso [LCFC/GRA]                            │
│  ├─ IdSeccion (FK) → Seccion [LCFC/GRA]                        │
│  ├─ IdNumeroPractica (FK) → NumeroPractica [PPP]               │
│  ├─ IdSubModalidadPeriodoAcademico (FK)                         │
│  └─ Estado, FechaRegistro, Comentario, etc.                    │
└─────────────────────────────────────────────────────────────────┘
         ↑                    ↑                      ↑
         │                    │                      │
    ┌────┴────────────┐  ┌────┴────────┐  ┌────────┴──────┐
    │                 │  │             │  │               │
PPP RESPUESTAS    GRA RESPUESTAS   LCFC RESPUESTAS   TOKENS
┌─────────────────┐ ┌──────────────┐ ┌──────────────┐ ┌────────┐
│Performance      │ │Performance   │ │EncuestaLCFC  │ │Encuesta│
│EncuestaPPP      │ │Encuestum     │ │   idLcfc(PK) │ │Token   │
├─────────────────┤ ├──────────────┤ │  idEncuesta  │ ├────────┤
│idPerf(PK)       │ │idPerf(PK)    │ │  idOutcome   │ │IdToken │
│idEncuesta(FK)   │ │idEncuesta(FK)│ │  puntaje     │ │Token   │
│idOutcomePPPConf │ │idOutcomeConf │ │              │ │Tipo    │
│Puntaje 1-5      │ │Puntaje       │ │              │ │Estado  │
└─────────────────┘ └──────────────┘ └──────────────┘ └────────┘
       ↓                  ↓
┌─────────────────┐ ┌───────────────────┐
│OutcomeEncuesta  │ │OutcomeEncuesta    │
│PPPConfig        │ │Config (GRA)       │
│                 │ │                   │
│idConfig(PK)     │ │idConfig(PK)       │
│Orden            │ │Orden              │
│Nombre español   │ │Nombre español     │
│Nombre inglés    │ │Nombre inglés      │
│IdCarrera        │ │IdCarrera          │
│IdTipoOutcome    │ │IdComision         │
│Estado: ACT/INA  │ │Estado: ACT/INA    │
└─────────────────┘ └───────────────────┘
       ↓                    ↓
┌────────────────────┐ ┌──────────────────┐
│OutcomeEncuesta     │ │OutcomeComision   │
│PPPOutcome          │ │                  │
│(N:M)              │ │idOutcome         │
│                    │ │idComision        │
│idOutcomePPPConfig  │ └──────────────────┘
│idOutcome           │
└────────────────────┘
```

### Procedimientos Almacenados Utilizados

1. **USP_Ins_RegistarPerformancePPP**
   - Parámetros: 14 puntajes de competencias, IdSubmodalidad, IdCarrera
   - Función: Inserta respuestas PPP y calcula agregaciones
   - Invocado desde: ExcelService.UploadNewPPP()

2. **USP_CREARHALLAZGOSPPPAUTOMATICOS**
   - Parámetros: IdSubModalidadPeriodoAcademico, ForzarEliminacion
   - Función: Genera hallazgos automáticos PPP según criterios
   - Invocado desde: GestionHallazgosAutomaticosService.GenerarHallazgosPPP()

3. **ReporteControlDashboard**
   - Parámetros: Idioma, Comisión, Carrera, Sede, Período, etc.
   - Función: Genera reportes consolidados para dashboard
   - Invocado desde: DashboardService

4. **ReporteVerificacionConsolidadoPivot**
   - Parámetros: Múltiples filtros
   - Función: Genera reportes de verificación con pivot
   - Invocado desde: DashboardService

---

## CONSIDERACIONES PARA LA MIGRACIÓN A NESTJS

### 1. MAPEO DE TECNOLOGÍAS

| Aspecto | .NET | NestJS |
|---------|------|--------|
| Framework | ASP.NET Core | NestJS |
| ORM | Entity Framework Core | TypeORM / Sequelize |
| Servicios | IServiceCollection | Providers / Injectables |
| Controladores | [ApiController] | @Controller() |
| Validación | Data Annotations | class-validator |
| Seguridad | JWT Bearer | @nestjs/passport |
| DTOs | C# Classes | TypeScript Classes/Interfaces |
| DB Context | DbContext | DataSource/Connection |
| Async | async/await | async/await |

### 2. ESTRUCTURA DE DIRECTORIOS RECOMENDADA

```
src/
├── surveys/
│   ├── ppp/
│   │   ├── controllers/
│   │   │   └── ppp.controller.ts
│   │   ├── services/
│   │   │   └── ppp.service.ts
│   │   ├── entities/
│   │   │   ├── encuesta.entity.ts
│   │   │   ├── outcome-encuesta-ppp-config.entity.ts
│   │   │   └── performance-encuesta-ppp.entity.ts
│   │   ├── dtos/
│   │   │   ├── list-ppp-configurations.dto.ts
│   │   │   ├── add-ppp-outcome.dto.ts
│   │   │   └── upload-ppp.dto.ts
│   │   ├── repositories/
│   │   │   └── ppp.repository.ts
│   │   └── ppp.module.ts
│   │
│   ├── gra/
│   │   ├── controllers/
│   │   │   ├── survey.controller.ts
│   │   │   └── email.controller.ts
│   │   ├── services/
│   │   │   ├── gra-config.service.ts
│   │   │   └── email-survey.service.ts
│   │   ├── entities/
│   │   ├── dtos/
│   │   ├── repositories/
│   │   └── gra.module.ts
│   │
│   ├── lcfc/
│   │   ├── controllers/
│   │   │   └── lcfc.controller.ts
│   │   ├── services/
│   │   │   └── lcfc.service.ts
│   │   ├── entities/
│   │   ├── dtos/
│   │   ├── repositories/
│   │   └── lcfc.module.ts
│   │
│   ├── common/
│   │   ├── entities/
│   │   │   ├── encuesta-token.entity.ts
│   │   │   ├── notificacion-encuesta-alumno.entity.ts
│   │   │   └── configuracion-notificacion.entity.ts
│   │   ├── dtos/
│   │   ├── services/
│   │   │   ├── token.service.ts
│   │   │   ├── notification.service.ts
│   │   │   └── email-provider.service.ts
│   │   └── repositories/
│   │
│   └── surveys.module.ts
│
├── shared/
│   ├── database/
│   │   ├── connection.ts
│   │   └── database.module.ts
│   ├── pagination/
│   ├── utils/
│   └── decorators/
│
├── config/
│   ├── database.config.ts
│   ├── email.config.ts
│   └── app.config.ts
│
└── main.ts
```

### 3. EJEMPLO DE ENTIDAD (TypeORM)

```typescript
// encuesta.entity.ts
import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, OneToMany, ForeignKey } from 'typeorm';
import { TipoEncuesta } from './tipo-encuesta.entity';
import { Alumno } from '../../alumnos/entities/alumno.entity';
import { Carrera } from '../../carreras/entities/carrera.entity';

@Entity('Encuestum')
export class Encuesta {
  @PrimaryGeneratedColumn()
  idEncuesta: number;

  @Column()
  @ForeignKey(() => TipoEncuesta)
  idTipoEncuesta: number;

  @Column({ nullable: true })
  codigoAlumno: string;

  @Column({ nullable: true })
  @ForeignKey(() => Carrera)
  idCarrera: number;

  @Column({ type: 'datetime', nullable: true })
  fechaInicio: Date;

  @Column({ type: 'datetime', nullable: true })
  fechaFin: Date;

  @Column({ nullable: true })
  totalHoras: number;

  @Column({ nullable: true })
  razonSocial: string;

  @Column({ nullable: true })
  nombreJefe: string;

  @Column({ nullable: true })
  cargoJefe: string;

  @Column({ nullable: true })
  telefonoJefe: string;

  @Column({ nullable: true })
  correoJefe: string;

  @Column({ nullable: true, type: 'text' })
  comentario: string;

  @Column({ nullable: true })
  ruc: string;

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  puntajeTotal: number;

  @Column({ nullable: true })
  idSede: number;

  @Column({ nullable: true })
  idSeccion: number;

  @Column({ nullable: true })
  idCurso: number;

  @Column({ nullable: true })
  estado: string; // 'PEN', 'COM', 'REV'

  @Column({ nullable: true })
  @ForeignKey(() => Alumno)
  idAlumno: number;

  @Column({ nullable: true })
  idNumeroPractica: number;

  @Column({ type: 'datetime' })
  fechaRegistro: Date;

  @Column({ nullable: true })
  idSubModalidadPeriodoAcademico: number;

  // Relaciones
  @ManyToOne(() => TipoEncuesta)
  tipoEncuesta: TipoEncuesta;

  @ManyToOne(() => Alumno)
  alumno: Alumno;

  @ManyToOne(() => Carrera)
  carrera: Carrera;

  @OneToMany(() => PerformanceEncuestaPPP, pe => pe.encuesta)
  performancesPPP: PerformanceEncuestaPPP[];

  @OneToMany(() => EncuestaLCFC, el => el.encuesta)
  respuestasLCFC: EncuestaLCFC[];
}
```

### 4. EJEMPLO DE SERVICIO

```typescript
// ppp.service.ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OutcomeEncuestaPPPConfig } from './entities/outcome-encuesta-ppp-config.entity';
import { ListPPPConfigurationsDto } from './dtos/list-ppp-configurations.dto';

@Injectable()
export class PppService {
  constructor(
    @InjectRepository(OutcomeEncuestaPPPConfig)
    private readonly configRepository: Repository<OutcomeEncuestaPPPConfig>,
  ) {}

  async listPPPConfigurations(
    dto: ListPPPConfigurationsDto,
  ): Promise<any> {
    const {
      idPeriodoAcademico,
      idEscuela,
      idTipoutEncuesta,
      idParModalidad,
      escuelaActual,
    } = dto;

    // Obtener submodalidad
    const subModalidad = await this.getSubModalidadByPeriodo(idPeriodoAcademico);

    // Cargar configuración
    const configs = await this.configRepository.find({
      where: {
        idSubModalidadPeriodoAcademico: subModalidad.idSubModalidadPeriodoAcademico,
        estado: 'ACT',
        idTipoOutcomeEncuesta: idTipoutEncuesta,
      },
      relations: ['carrera', 'outcomes'],
    });

    return {
      periodo: `${idPeriodoAcademico}-I`,
      cicloId: idPeriodoAcademico,
      subModalidadPeriodoAcademicoId: subModalidad.idSubModalidadPeriodoAcademico,
      tipoEncuesta: idTipoutEncuesta,
      lstConfig: configs.map(config => this.mapToDto(config)),
    };
  }

  private mapToDto(config: OutcomeEncuestaPPPConfig): any {
    return {
      idOutcomeEncuestaPPPConfig: config.idOutcomeEncuestaPPPConfig,
      orden: config.orden,
      nombreEspanol: config.nombreEspanol,
      nombreIngles: config.nombreIngles,
      descripcionEspanol: config.descripcionEspanol,
      descripcionIngles: config.descripcionIngles,
      idEscuela: config.idEscuela,
      idCarrera: config.idCarrera,
      nombreCarrera: config.carrera?.nombreEspanol,
      idTipoOutcomeEncuesta: config.idTipoOutcomeEncuesta,
      estado: config.estado,
      esVisible: config.esVisible,
      otraCarrera: config.otraCarrera,
      idSubModalidadPeriodoAcademico: config.idSubModalidadPeriodoAcademico,
    };
  }

  private async getSubModalidadByPeriodo(idPeriodo: number): Promise<any> {
    // Implementar lógica
  }
}
```

### 5. PUNTOS CRÍTICOS DE MIGRACIÓN

#### 5.1 Manejo de Transacciones
**.NET**:
```csharp
context.Database.BeginTransaction();
try {
    // Operaciones
    context.SaveChangesAsync();
    context.Database.CommitTransaction();
} catch {
    context.Database.RollbackTransaction();
}
```

**NestJS**:
```typescript
const queryRunner = this.dataSource.createQueryRunner();
await queryRunner.startTransaction();
try {
  // Operaciones
  await queryRunner.commitTransaction();
} catch {
  await queryRunner.rollbackTransaction();
} finally {
  await queryRunner.release();
}
```

#### 5.2 Inyección de Dependencias
**.NET**:
```csharp
public SurveyController(IConfigurationAbetDataService service)
{
    this.service = service;
}
```

**NestJS**:
```typescript
@Injectable()
export class SurveyController {
  constructor(private readonly configService: ConfigurationAbetDataService) {}
}
```

#### 5.3 Email
**.NET**: Se usa `IEmailProvider` personalizado
**NestJS**: Usar `@nestjs/mailer` o similar

#### 5.4 Excel
**.NET**: EPPlus
**NestJS**: `ExcelJS` o `xlsx`

#### 5.5 Tokens y Seguridad
Usar `@nestjs/jwt` y `@nestjs/passport` con estrategia JWT

---

### 6. MIGRACIÓN FASE POR FASE

**FASE 1: Fundacional**
- [ ] Configurar NestJS + TypeORM
- [ ] Migrar DTOs y Entities
- [ ] Configurar base de datos

**FASE 2: PPP**
- [ ] Endpoints de configuración PPP
- [ ] Upload de encuestas
- [ ] Dashboard PPP

**FASE 3: GRA**
- [ ] Endpoints de configuración GRA
- [ ] Sistema de notificaciones por email
- [ ] Dashboard GRA

**FASE 4: LCFC**
- [ ] Endpoints de configuración LCFC
- [ ] Lógica de encuesta
- [ ] Dashboard LCFC

**FASE 5: Transversal**
- [ ] Sistema de tokens
- [ ] Niveles de aceptación
- [ ] Procedimientos almacenados / Triggers

**FASE 6: Validación**
- [ ] Testing
- [ ] Integración
- [ ] Deploy

---

## REFERENCIAS Y NOTAS FINALES

### Consideraciones de Seguridad
1. **Validar siempre `escuelaActual`** para aislar datos por escuela
2. **Validar tokens antes de permitir acceso** a formularios
3. **Encriptar tokens** antes de enviarlos por email
4. **Limitar acceso por roles y permisos**

### Performance
1. **Índices en:**
   - `Encuestum(IdTipoEncuesta, Estado, IdSubModalidadPeriodoAcademico)`
   - `EncuestaToken(Token, FechaFin)`
   - `OutcomeEncuestaPPPConfig(Estado, IdSubModalidadPeriodoAcademico)`

2. **Caché de:**
   - Configuraciones de competencias (válidas por período)
   - Niveles de aceptación
   - Órganos académicos

### Integraciones Externas
1. **Email**: Configurar servidor SMTP
2. **PDF**: Para reportes (si es necesario)
3. **Dashboard**: Integración con BI o gráficos

---

**Documento generado**: 2025-05-13  
**Versión**: 1.0  
**Alcance**: Migración completa de módulos de encuestas a NestJS  
**Estado**: Detalle Técnico Completo Listo para Desarrollo
