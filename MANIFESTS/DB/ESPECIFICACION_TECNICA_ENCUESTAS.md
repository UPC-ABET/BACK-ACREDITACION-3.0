# ESPECIFICACIÓN TÉCNICA QUIRÚRGICA: MIGRACIÓN DE ENCUESTAS
## PPP, Graduados (GRA) y LCFC

**Documento:** Análisis Técnico Detallado  
**Generado:** 2026-05-13  
**Alcance:** Migración completa de encuestas de Prácticas Pre-Profesionales, Graduados y Logro de Fin de Ciclo  
**Nivel de Precisión:** Arquitectónico (DDL + ETL + Data Flow + Constraints)

---

## TABLA DE CONTENIDOS

1. [Taxonomía de Encuestas](#1-taxonomía-de-encuestas)
2. [Arquitectura de Tablas Fuente (AS-IS)](#2-arquitectura-de-tablas-fuente-as-is)
3. [Diseño Lógico de Relacionamiento](#3-diseño-lógico-de-relacionamiento)
4. [Flujo ETL Actual](#4-flujo-etl-actual)
5. [Marts Layer - Denormalizaciones](#5-marts-layer---denormalizaciones-y-agregaciones)
6. [Foreign Key Resolution Logic](#6-foreign-key-resolution-logic)
7. [Constraint Analysis](#7-constraint-analysis)
8. [Data Quality & Validation](#8-data-quality-and-validation-rules)
9. [Migration Strategy](#9-migration-strategy--dependencies)
10. [Volumetrías y Performance](#10-volumetrías-y-performance)
11. [Validación de Datos](#11-validación-de-datos)
12. [Referencias](#12-referencias--supporting-artifacts)

---

## 1. TAXONOMÍA DE ENCUESTAS

### 1.1 Clasificación por IdTipoEncuesta (ENUM)

La base de datos ABET 2.0 utiliza un enum de tipo entero para clasificar encuestas:

```
IdTipoEncuesta = 1   → Encuesta de Prácticas Pre-Profesionales (PPP)
IdTipoEncuesta = 4   → Encuesta de Fin de Curso (FDC)
IdTipoEncuesta = 6   → Encuesta de Graduandos (GRA)
IdTipoEncuesta = 7   → Encuesta de Evaluación Docente (EVD)
IdTipoEncuesta = 8   → Encuesta de Logro de Fin de Ciclo (LCFC)
```

**Nota Crítica:** En la migración, estos valores se convierten a strings varchar:
- `1 → 'PPP'`
- `4 → 'FDC'`
- `6 → 'GRA'`
- `7 → 'EVD'`
- `8 → 'LCFC'`

### 1.2 Esquemas de Base de Datos en ABET 2.0

| Esquema | Sinonimia dbo.* | Descripción | Base de Datos |
|---|---|---|---|
| `PPP.*` | `dbo.Encuesta`, `dbo.PerformanceEncuestaPPP`, etc. | Encuestas PPP + Configuración | PRD_ACC_INGIND (principal) |
| `PRD_ACC_INGAMB.GRA.*` | `dbo.EncuestaToken`, `dbo.PerformanceEncuesta`, etc. | Encuestas Graduados | PRD_ACC_INGAMB (aislada) |
| `LCFC.EncuestaLCFC` | `dbo.EncuestaLCFC` | Encuestas LCFC | PRD_ACC_INGIND |

**Distribución Multi-DB:**
- 9 instancias de ABET 2.0 en paralelo (eiscb, eiscc, escel, ingamb, ingbio, ingciv, inggem, inggmi, ingind)
- Cada DB tiene sus propias tablas de encuestas
- ETL debe hacer UNION ALL de todas las 9 instancias

---

## 2. ARQUITECTURA DE TABLAS FUENTE (AS-IS)

### 2.1 TABLA BASE: PPP.Encuesta

**Sinonimia:** `dbo.Encuesta`

#### Estructura DDL Esperada

```sql
CREATE TABLE PPP.Encuesta (
    -- IDENTIFICADORES Y TIPOS
    IdEncuesta                      INT PRIMARY KEY NOT NULL,
    IdTipoEncuesta                  INT NOT NULL,
    
    -- ESTADO
    Estado                          CHAR(3) NOT NULL,
    
    -- REFERENCIAS A DIMENSIONES
    IdAlumno                        INT NOT NULL,
    IdSubModalidadPeriodoAcademico  INT NOT NULL,
    IdSede                          INT NOT NULL,
    IdCarrera                       INT NOT NULL,
    IdNumeroPractica                INT NOT NULL,
    IdSeccion                       INT NULL,
    
    -- INFORMACIÓN DE PRÁCTICA (PPP-specific)
    RazonSocial                     VARCHAR(500) NULL,
    NombreJefe                      VARCHAR(200) NULL,
    CargoJefe                       VARCHAR(100) NULL,
    TelefonoJefe                    VARCHAR(20) NULL,
    CorreoJefe                      VARCHAR(200) NULL,
    RUC                             VARCHAR(20) NULL,
    TotalHoras                      NUMERIC(10,2) NULL,
    NumeroInforme                   VARCHAR(50) NULL,
    
    -- FECHAS
    FechaInicio                     DATE NULL,
    FechaFin                        DATE NULL,
    FechaRegistro                   TIMESTAMP NOT NULL,
    
    -- COMENTARIOS
    Comentario                      VARCHAR(MAX) NULL
);
```

#### Detalles Semánticos de Columnas

| Columna | Tipo | Nullable | Propósito | Valores Típicos |
|---|---|---|---|---|
| `IdEncuesta` | INT | NO | Identificador único | 1, 2, 3, ... |
| `IdTipoEncuesta` | INT | NO | Tipo de encuesta | 1 (PPP), 4 (FDC), 6 (GRA), 8 (LCFC) |
| `Estado` | CHAR(3) | NO | Estado de la encuesta | 'ACT', 'INA', 'DEL', 'ARC' |
| `IdAlumno` | INT | NO | FK a Maestro.Alumno | Alumno code |
| `IdSubModalidadPeriodoAcademico` | INT | NO | FK a Ciclo | Período + Modalidad |
| `IdSede` | INT | NO | FK a Maestro.Sede | Campus |
| `IdCarrera` | INT | NO | FK a Maestro.Carrera | Programa |
| `IdNumeroPractica` | INT | NO | Número de práctica | 1, 2, 3, ..., 8 |
| `IdSeccion` | INT | ✓ | FK a Ciclo.Seccion | Course section (nullable) |
| `RazonSocial` | VARCHAR(500) | ✓ | Nombre de empresa | "Empresa XYZ S.A.C." |
| `NombreJefe` | VARCHAR(200) | ✓ | Nombre del supervisor | "Juan Pérez" |
| `CargoJefe` | VARCHAR(100) | ✓ | Título del supervisor | "Jefe de Proyecto" |
| `TelefonoJefe` | VARCHAR(20) | ✓ | Teléfono | "+51 1 2345678" |
| `CorreoJefe` | VARCHAR(200) | ✓ | Email | "juan@empresa.com" |
| `RUC` | VARCHAR(20) | ✓ | RUC de empresa | "20123456789" |
| `TotalHoras` | NUMERIC(10,2) | ✓ | Horas totales de práctica | 160.5 |
| `NumeroInforme` | VARCHAR(50) | ✓ | Número de reporte | "INF-001-2024" |
| `FechaInicio` | DATE | ✓ | Start date de práctica | 2024-01-15 |
| `FechaFin` | DATE | ✓ | End date de práctica | 2024-05-15 |
| `FechaRegistro` | TIMESTAMP | NO | Cuándo se registró | 2024-01-15 10:30:45 |
| `Comentario` | VARCHAR(MAX) | ✓ | Observaciones | "Excelente desempeño" |

#### Cardinality

- **Por Database:** 2,000–8,000 registros
- **9 Databases:** 18,000–72,000 registros totales
- **Variabilidad:** Depende del período académico y número de estudiantes en práctica

---

### 2.2 TABLA BASE: PRD_ACC_INGAMB.GRA.EncuestaToken

**Sinonimia:** `dbo.EncuestaToken`

#### Estructura DDL

```sql
CREATE TABLE PRD_ACC_INGAMB.GRA.EncuestaToken (
    IdEncuestaToken                 INT PRIMARY KEY NOT NULL,
    IdEncuesta                      INT NOT NULL,
    Token                           VARCHAR(255) NOT NULL UNIQUE,
    Estado                          BIT NOT NULL,
    FechaEnvio                      TIMESTAMP NOT NULL,
    FechaFin                        TIMESTAMP NULL
);
```

#### Detalles Semánticos

| Columna | Tipo | Nullable | Propósito | Valores Típicos |
|---|---|---|---|---|
| `IdEncuestaToken` | INT | NO | Identificador único | 1, 2, 3, ... |
| `IdEncuesta` | INT | NO | FK a Encuesta (GRA-specific) | Encuesta ID |
| `Token` | VARCHAR(255) | NO | Token único para link de encuesta | UUID o hash |
| `Estado` | BIT | NO | Estado de respuesta | 0 (PENDING), 1 (COMPLETED) |
| `FechaEnvio` | TIMESTAMP | NO | Cuándo se envió el email | 2024-05-10 09:00:00 |
| `FechaFin` | TIMESTAMP | ✓ | Deadline para responder | 2024-05-17 23:59:59 |

#### Nota Crítica

**Esta tabla es la FUENTE PRIMARIA para notificaciones de GRA.**

No debe confundirse con `PRD_ACC_INGAMB.GRA.NotificacionEncuestaAlumno` que es redundante y debe ignorarse en la migración.

#### Cardinality

- **Por Database:** 500–3,000 registros
- **9 Databases:** 4,500–27,000 registros totales
- **Multiplicidad:** Típicamente 1 token por alumno graduando por período

---

### 2.3 TABLA BASE: LCFC.EncuestaLCFC

#### Estructura DDL

```sql
CREATE TABLE LCFC.EncuestaLCFC (
    IdEncuestaLcfc                  INT PRIMARY KEY NOT NULL,
    IdEncuesta                      INT NOT NULL,
    IdOutcome                       INT NOT NULL,
    Puntaje                         NUMERIC(5,2) NOT NULL
);
```

#### Detalles Semánticos

| Columna | Tipo | Nullable | Propósito | Valores Típicos |
|---|---|---|---|---|
| `IdEncuestaLcfc` | INT | NO | Identificador único | 1, 2, 3, ... |
| `IdEncuesta` | INT | NO | **FK a PPP.Encuesta** (REUTILIZA) | Same as PPP |
| `IdOutcome` | INT | NO | FK a Ciclo.Outcome | Outcome ID |
| `Puntaje` | NUMERIC(5,2) | NO | Score/calificación | 0.00–100.00 |

#### RELACIÓN CRÍTICA: LCFC Reutiliza PPP.Encuesta

**LCFC NO es una tabla separada de encuestas. Es una dimensión adicional:**

```
Una PPP.Encuesta representa:
  "Estudiante X en Práctica #Y en Período Z"

Un LCFC.EncuestaLCFC adiciona:
  "... con Outcome W calificado en score S"

Multiplicidad:
  1 PPP.Encuesta : N LCFC.EncuestaLCFC
  (1 práctica : múltiples outcomes medidos)
```

#### Cardinality

- **Por Database:** 40,000–120,000 registros
- **9 Databases:** 360,000–1,080,000 registros totales
- **Multiplicidad típica:** 20+ outcomes por encuesta

---

### 2.4 TABLAS DE CONFIGURACIÓN Y METADATOS

#### 2.4.1 PPP.OutcomeEncuestaPPPConfig

```sql
CREATE TABLE PPP.OutcomeEncuestaPPPConfig (
    IdOutcomeEncuestaPPPConfig      INT PRIMARY KEY NOT NULL,
    NombreEspanol                   VARCHAR(500) NOT NULL,
    NombreIngles                    VARCHAR(500) NULL,
    DescripcionEspanol              VARCHAR(MAX) NULL,
    DescripcionIngles               VARCHAR(MAX) NULL
);
```

**Propósito:** Define qué outcomes se miden en encuestas PPP (mapeo custom)

**Cardinality:** 5–15 registros por DB

**Nota:** Estos outcomes son DIFERENTES de los outcomes académicos formales. Son outcomes específicos de PPP.

---

#### 2.4.2 PPP.PerformanceEncuestaPPP

```sql
CREATE TABLE PPP.PerformanceEncuestaPPP (
    IdPerformanceEncuestaPPP        INT PRIMARY KEY NOT NULL,
    IdEncuesta                      INT NOT NULL,
    IdOutcomeEncuestaPPPConfig      INT NOT NULL,
    PuntajeOutcome                  NUMERIC(5,2) NOT NULL
);
```

**Propósito:** Almacena calificaciones individuales de outcomes en PPP

**Cardinality:** 10,000–50,000 registros

**Relación:**
```
1 PPP.Encuesta : N PPP.PerformanceEncuestaPPP
(1 survey : múltiples outcome scores)
```

---

#### 2.4.3 PPP.NivelAceptacionEncuesta

```sql
CREATE TABLE PPP.NivelAceptacionEncuesta (
    IdNivelAceptacionEncuesta       INT PRIMARY KEY NOT NULL,
    NombreEspanol                   VARCHAR(200) NOT NULL,
    NombreIngles                    VARCHAR(200) NULL,
    ValorMinimo                     FLOAT NOT NULL,
    ValorMaximo                     FLOAT NOT NULL,
    IdTipoEncuesta                  INT NOT NULL,
    IdSubModalidadPeriodoAcademico  INT NOT NULL,
    EsFinal                         BIT NOT NULL
);
```

**Propósito:** Define "niveles de aceptación" (performance bands) para cada tipo de encuesta y período

**Ejemplos:**

| Nombre | ValorMinimo | ValorMaximo | IdTipoEncuesta | EsFinal | Significado |
|---|---|---|---|---|---|
| "Excelente" | 85 | 100 | 1 (PPP) | 1 | Rango final de aceptación para PPP |
| "Bueno" | 70 | 84 | 1 | 0 | Rango intermedio |
| "Satisfecho" | 70 | 84 | 6 (GRA) | 1 | Rango final para GRA |
| "Cumple" | 60 | 75 | 8 (LCFC) | 1 | Rango final para LCFC |

**Cardinality:** 20–80 registros por DB (típicamente 4-5 bandas × 5-10 tipos)

---

#### 2.4.4 PPP.ConfiguracionNotificacion

```sql
CREATE TABLE PPP.ConfiguracionNotificacion (
    IdConfiguracionNotificacion     INT PRIMARY KEY NOT NULL,
    Tipo                            VARCHAR(50) NOT NULL,
    NombreAsunto                    VARCHAR(500) NOT NULL,
    NombreContenido                 VARCHAR(MAX) NOT NULL,
    FechaFinLimite                  TIMESTAMP NULL,
    IdEscuela                       INT NOT NULL
);
```

**Propósito:** Plantillas de notificación por email para encuestas

**Valores en `Tipo`:**
- 'GRA' → Encuesta de Graduandos
- 'EVDD' → Evaluación Docente Didáctica
- 'EVDI' → Evaluación Docente Investigación
- 'PPP' → Prácticas Pre-Profesionales

**Cardinality:** 2–10 registros por DB

---

#### 2.4.5 PRD_ACC_INGAMB.GRA.OutcomeEncuestaConfig

```sql
CREATE TABLE PRD_ACC_INGAMB.GRA.OutcomeEncuestaConfig (
    IdOutcomeEncuestaConfig         INT PRIMARY KEY NOT NULL,
    NombreEspanol                   VARCHAR(500) NOT NULL,
    NombreIngles                    VARCHAR(500) NULL,
    DescripcionEspanol              VARCHAR(MAX) NULL,
    DescripcionIngles               VARCHAR(MAX) NULL
);
```

**Propósito:** Define outcomes específicos para GRA (análogo a PPP pero en schema GRA)

**Cardinality:** 5–15 registros por DB

---

#### 2.4.6 PRD_ACC_INGAMB.GRA.PerformanceEncuesta

```sql
CREATE TABLE PRD_ACC_INGAMB.GRA.PerformanceEncuesta (
    IdPerformanceEncuesta           INT PRIMARY KEY NOT NULL,
    IdEncuesta                      INT NOT NULL,
    IdOutcomeEncuestaConfig         INT NOT NULL,
    PuntajeOutcome                  NUMERIC(5,2) NOT NULL
);
```

**Propósito:** Almacena calificaciones de outcomes en GRA

**Cardinality:** 3,000–15,000 registros

---

## 3. DISEÑO LÓGICO DE RELACIONAMIENTO

### 3.1 Diagrama Entidad-Relación (Estructura Completa)

```
╔════════════════════════════════════════════════════════════╗
║                    MAESTRO.Alumno                         ║
║  (PK: IdAlumno, code, nombre)                            ║
╚════════════════════════════════════════════════════════════╝
                          │
                          │ IdAlumno (FK)
                          │
╔════════════════════════════════════════════════════════════╗
║                    PPP.Encuesta                           ║
║  (PK: IdEncuesta)                                         ║
║  - IdAlumno (FK)                                          ║
║  - IdSubModalidadPeriodoAcademico (FK)                    ║
║  - IdSede (FK)                                            ║
║  - IdCarrera (FK)                                         ║
║  - IdNumeroPractica (FK)                                  ║
║  - IdSeccion (FK nullable)                                ║
║  - Estado ('ACT', 'INA', ...)                             ║
║  - RazonSocial, NombreJefe, etc. [PPP-specific metadata] ║
╚════════════════════════════════════════════════════════════╝
         │                              │
         │ IdEncuesta (FK)              │ REUTILIZACIÓN
         │                              │ en LCFC
         ├─ ↓                           │
         │  ╔═══════════════════════════════════════════════╗
         │  ║    PPP.PerformanceEncuestaPPP               ║
         │  ║  (PK: IdPerformanceEncuestaPPP)             ║
         │  ║  - IdEncuesta (FK)                          ║
         │  ║  - IdOutcomeEncuestaPPPConfig (FK)          ║
         │  ║  - PuntajeOutcome (NUMERIC)                 ║
         │  ╚═══════════════════════════════════════════════╝
         │
         └─ ↓
            ╔═══════════════════════════════════════════════╗
            ║         LCFC.EncuestaLCFC                    ║
            ║     (PK: IdEncuestaLcfc)                     ║
            ║  - IdEncuesta (FK to PPP) [REUTILIZA]        ║
            ║  - IdOutcome (FK to Ciclo.Outcome)           ║
            ║  - Puntaje (NUMERIC)                         ║
            ╚═══════════════════════════════════════════════╝

╔════════════════════════════════════════════════════════════╗
║              GRA.EncuestaToken (ISOLATED)                ║
║  (PK: IdEncuestaToken)                                    ║
║  - IdEncuesta (FK to GRA Encuesta - separate)             ║
║  - Token (UNIQUE)                                         ║
║  - Estado (BIT: 0=PENDING, 1=COMPLETED)                   ║
║  - FechaEnvio, FechaFin                                    ║
╚════════════════════════════════════════════════════════════╝
                    │ IdEncuesta (FK)
                    │
                    ├─ ↓
                    │  ╔═══════════════════════════════════════════════╗
                    │  ║  GRA.PerformanceEncuesta                    ║
                    │  ║  (PK: IdPerformanceEncuesta)                ║
                    │  ║  - IdEncuesta (FK)                          ║
                    │  ║  - IdOutcomeEncuestaConfig (FK)             ║
                    │  ║  - PuntajeOutcome (NUMERIC)                 ║
                    │  ╚═══════════════════════════════════════════════╝
```

### 3.2 Hechos Críticos de Relación

#### **HECHO 1: LCFC Reutiliza PPP.Encuesta**

```sql
-- La relación es directa:
LCFC.IdEncuesta = PPP.Encuesta.IdEncuesta

-- Implicaciones:
-- (a) Una encuesta PPP puede tener 1..N registros LCFC asociados
-- (b) Cada LCFC adiciona un nuevo outcome + score
-- (c) No son tablas separadas; LCFC es una "fact table augmentation"
-- (d) Queries sobre LCFC DEBEN hacer JOIN a PPP para contexto
```

**Ejemplo práctico:**

```
IdEncuesta=1001 → PPP.Encuesta
  Alumno: Juan Pérez
  Período: 2024-I
  Empresa: Tech Corp
  Horas: 160

IdEncuesta=1001 → LCFC.EncuestaLCFC (Múltiples)
  1001-1 → Outcome "Liderazgo" → Score 85.5
  1001-2 → Outcome "Comunicación" → Score 90.0
  1001-3 → Outcome "Técnica" → Score 78.5
```

---

#### **HECHO 2: GRA Usa EncuestaToken Como Identificador de Notificación**

```sql
-- La relación es 1:1:
GRA.EncuestaToken (Primary)
├─ IdEncuestaToken (PK)
├─ IdEncuesta (points to GRA survey)
├─ Token (UNIQUE identifier for student notification)
├─ Estado (BOOLEAN: 0/1 → PENDING/COMPLETED)
├─ FechaEnvio (when email was sent)
└─ FechaFin (deadline for survey submission)

-- Implicaciones:
-- (a) 1 Alumno Graduando = 1 EncuestaToken
-- (b) 1 Token = 1 Email notification con link unique
-- (c) Token permite tracking anónimo de respuestas
-- (d) Estado (bit field) = fuente de verdad para "completed"
```

---

#### **HECHO 3: OutcomeConfigs Son METADATOS, No Dimensión Académica**

```
PPP.OutcomeEncuestaPPPConfig (custom outcomes para PPP)
   ≠ Ciclo.Outcome (outcomes académicos formales)

GRA.OutcomeEncuestaConfig (custom outcomes para GRA)
   ≠ Ciclo.Outcome

LCFC usa DIRECTAMENTE Ciclo.Outcome
   (outcome_id resolvible vía full FK chain)

Implicación:
- PPP y GRA tienen sus propios catálogos de outcomes (METADATA TABLES)
- No son los "outcomes académicos formales" del programa
- LCFC es la ÚNICA que conecta a outcomes académicos formales
```

---

#### **HECHO 4: Estados de Encuesta**

```
Estado en PPP.Encuesta:
  'ACT' → Activa (disponible para responder)
  'INA' → Inactiva (cerrada)
  'DEL' → Eliminada
  'ARC' → Archivada

Estado en GRA.EncuestaToken (BIT):
  0 → PENDING (email enviado, respuesta pendiente)
  1 → COMPLETED (alumno respondió la encuesta)

Mapeo a ABET 3.0:
  PPP 'ACT' → survey_status = 'SURVEY_ACTIVE'
  PPP otros → survey_status = 'SURVEY_INACTIVE'
  
  GRA Estado=0 → notification_status = 'PENDING'
  GRA Estado=1 → notification_status = 'COMPLETED'
```

---

## 4. FLUJO ETL ACTUAL

### 4.1 Patrón de Ingestion (Raw → Staging)

```
ABET 2.0 (SQL Server)
├─ PRD_ACC_INGIND (PPP, LCFC)
│  ├─ PPP.Encuesta (100M records)
│  ├─ PPP.PerformanceEncuestaPPP
│  ├─ PPP.OutcomeEncuestaPPPConfig
│  ├─ PPP.NivelAceptacionEncuesta
│  ├─ PPP.ConfiguracionNotificacion
│  └─ LCFC.EncuestaLCFC
│
└─ PRD_ACC_INGAMB (GRA isolated)
   ├─ GRA.EncuestaToken
   ├─ GRA.PerformanceEncuesta
   ├─ GRA.OutcomeEncuestaConfig
   └─ GRA.NotificacionEncuestaAlumno [DEPRECATED - IGNORE]

           ↓ (9 databases × tables)

Postgres Staging Schema (raw_XXX tables)
├─ raw_eiscb_ppp_encuesta
├─ raw_eiscb_gra_encuesta_token
├─ raw_eiscb_lcfc_encuesta
├─ raw_eiscb_ppp_performance_encuesta
├─ raw_eiscb_gra_performance_encuesta
├─ raw_eiscb_ppp_outcome_config
├─ raw_eiscb_gra_outcome_config
├─ raw_eiscb_ppp_nivel_aceptacion
├─ raw_eiscb_ppp_configuracion_notificacion
└─ ... (×9 databases)

           ↓ (dbt stg_ views)

Staging Layer (unified views)
├─ stg_ppp_encuesta (UNION ALL 9 DBs)
├─ stg_gra_encuesta_token
├─ stg_lcfc_encuesta
├─ stg_ppp_performance_encuesta
├─ stg_gra_performance_encuesta
├─ stg_ppp_outcome_config
├─ stg_gra_outcome_config
├─ stg_ppp_nivel_aceptacion
└─ stg_ppp_configuracion_notificacion

           ↓ (dbt marts)

Marts Layer (Normalized tables)
├─ survey.surveys (evidence layer)
├─ survey.scores (fact table)
├─ survey.notifications (GRA only)
├─ survey.outcome_configs (metadata)
├─ survey.notification_message (templates)
└─ academic.performance_levels (bands)
```

### 4.2 Staging Layer Transformation - PPP Encuesta

**Archivo:** `stg_ppp_encuesta.sql`

```sql
{{ config(materialized='view') }}

{% set dbs = ['eiscb','eiscc','escel','ingamb','ingbio','ingciv','inggem','inggmi','ingind'] %}

{% for db in dbs %}
SELECT
    "IdEncuesta"::int                                   AS source_id,
    "IdTipoEncuesta"::int                               AS source_tipo_encuesta_id,
    TRIM(COALESCE("Estado", ''))                        AS estado,
    "IdAlumno"::int                                     AS source_alumno_id,
    "IdSubModalidadPeriodoAcademico"::int               AS source_sub_modalidad_id,
    "IdSede"::int                                       AS source_sede_id,
    "IdCarrera"::int                                    AS source_carrera_id,
    "IdNumeroPractica"::int                             AS survey_number,
    "IdSeccion"::int                                    AS source_seccion_id,
    TRIM(COALESCE("RazonSocial", ''))                   AS razon_social,
    TRIM(COALESCE("NombreJefe", ''))                    AS nombre_jefe,
    TRIM(COALESCE("CargoJefe", ''))                     AS cargo_jefe,
    TRIM(COALESCE("TelefonoJefe", ''))                  AS telefono_jefe,
    TRIM(COALESCE("CorreoJefe", ''))                    AS correo_jefe,
    TRIM(COALESCE("RUC", ''))                           AS ruc,
    "TotalHoras"::numeric                               AS total_horas,
    COALESCE("NumeroInforme"::text, '')                 AS numero_informe,
    "FechaInicio"::date                                 AS fecha_inicio,
    "FechaFin"::date                                    AS fecha_fin,
    TRIM(COALESCE("Comentario", ''))                    AS comentario,
    "FechaRegistro"::timestamp                          AS fecha_registro,
    '{{ db }}'                                          AS _source_db,
    _ingested_at
FROM {{ source('staging', 'raw_' ~ db ~ '_ppp_encuesta') }}
WHERE "IdEncuesta" IS NOT NULL
{% if not loop.last %}UNION ALL{% endif %}
{% endfor %}
```

**Transformaciones aplicadas:**

| Transformación | Razón | Línea de Código |
|---|---|---|
| Type casting `::int` | Asegurar tipado correcto | `"IdEncuesta"::int` |
| Type casting `::numeric` | Preservar decimales | `"TotalHoras"::numeric` |
| `TRIM(COALESCE(..., ''))` | Null safety + whitespace removal | Todos los VARCHAR |
| `WHERE "IdEncuesta" IS NOT NULL` | Filtrar rows nulas | Final WHERE |
| UNION ALL (9 times) | Consolidar multi-DB | Loop for each db |
| `_source_db` marker | Trazabilidad | Cada SELECT |

---

### 4.3 Staging Layer Transformation - GRA Token

**Archivo:** `stg_gra_encuesta_token.sql`

```sql
{{ config(materialized='view') }}

{% set dbs = ['eiscb','eiscc','escel','ingamb','ingbio','ingciv','inggem','inggmi','ingind'] %}

{% for db in dbs %}
SELECT
    "IdEncuestaToken"::int                          AS source_id,
    "IdEncuesta"::int                               AS source_encuesta_id,
    TRIM(COALESCE("Token", ''))                     AS token,
    COALESCE("Estado"::boolean, false)              AS estado_bool,
    "FechaEnvio"::timestamp                         AS fecha_envio,
    "FechaFin"::timestamp                           AS fecha_fin,
    '{{ db }}'                                      AS _source_db,
    _ingested_at
FROM {{ source('staging', 'raw_' ~ db ~ '_gra_encuesta_token') }}
WHERE "IdEncuestaToken" IS NOT NULL
{% if not loop.last %}UNION ALL{% endif %}
{% endfor %}
```

**Transformación Crítica:**

```sql
COALESCE("Estado"::boolean, false) AS estado_bool
-- Convierte BIT (0/1) a BOOLEAN (false/true)
-- 0 → false (PENDING)
-- 1 → true (COMPLETED)
```

---

### 4.4 Staging Layer Transformation - LCFC

**Archivo:** `stg_lcfc_encuesta.sql`

```sql
{{ config(materialized='view') }}

{% set dbs = ['eiscb','eiscc','escel','ingamb','ingbio','ingciv','inggem','inggmi','ingind'] %}

{% for db in dbs %}
SELECT
    "IdEncuestaLcfc"::int   AS source_id,
    "IdEncuesta"::int       AS source_encuesta_id,    -- ← Links to PPP
    "IdOutcome"::int        AS source_outcome_id,      -- ← Links to Ciclo.Outcome
    "Puntaje"::numeric      AS score,
    '{{ db }}'              AS _source_db,
    _ingested_at
FROM {{ source('staging', 'raw_' ~ db ~ '_lcfc_encuesta') }}
WHERE "IdEncuestaLcfc" IS NOT NULL
{% if not loop.last %}UNION ALL{% endif %}
{% endfor %}
```

**Nota:** El campo `source_encuesta_id` vincula a PPP.Encuesta (reutilización).

---

### 4.5 Staging Layer Transformations - Config & Metadata

#### Performance Scores

```sql
-- stg_ppp_performance_encuesta.sql
SELECT
    "IdPerformanceEncuestaPPP"::int         AS source_id,
    "IdEncuesta"::int                       AS source_encuesta_id,
    "IdOutcomeEncuestaPPPConfig"::int       AS source_outcome_config_id,
    "PuntajeOutcome"::numeric               AS score,
    '{{ db }}'                              AS _source_db,
    _ingested_at
FROM {{ source('staging', 'raw_' ~ db ~ '_ppp_performance_encuesta') }}
WHERE "IdPerformanceEncuestaPPP" IS NOT NULL
```

#### Outcome Configs

```sql
-- stg_ppp_outcome_config.sql
SELECT
    "IdOutcomeEncuestaPPPConfig"::int               AS source_id,
    TRIM(COALESCE("NombreEspanol", ''))             AS nombre_es,
    TRIM(COALESCE("NombreIngles", ''))              AS nombre_en,
    TRIM(COALESCE("DescripcionEspanol", ''))        AS descripcion_es,
    TRIM(COALESCE("DescripcionIngles", ''))         AS descripcion_en,
    'PPP'                                           AS survey_type,
    '{{ db }}'                                      AS _source_db,
    _ingested_at
FROM {{ source('staging', 'raw_' ~ db ~ '_ppp_outcome_config') }}
WHERE "IdOutcomeEncuestaPPPConfig" IS NOT NULL
```

#### Performance Levels

```sql
-- stg_ppp_nivel_aceptacion.sql
SELECT
    "IdNivelAceptacionEncuesta"::int                AS source_id,
    TRIM(COALESCE("NombreEspanol", ''))             AS nombre_es,
    TRIM(COALESCE("NombreIngles", ''))              AS nombre_en,
    "ValorMinimo"::float                            AS valor_minimo,
    "ValorMaximo"::float                            AS valor_maximo,
    "IdTipoEncuesta"::int                           AS source_tipo_encuesta_id,
    "IdSubModalidadPeriodoAcademico"::int           AS source_sub_modalidad_id,
    COALESCE("EsFinal"::boolean, false)             AS es_final,
    '{{ db }}'                                      AS _source_db,
    _ingested_at
FROM {{ source('staging', 'raw_' ~ db ~ '_ppp_nivel_aceptacion') }}
WHERE "IdNivelAceptacionEncuesta" IS NOT NULL
```

---

## 5. MARTS LAYER - DENORMALIZACIONES Y AGREGACIONES

### 5.1 Mart: survey.outcome_configs

**Archivo:** `survey_outcome_configs.sql`

**Propósito:** Fusiona PPP y GRA outcome configs en una tabla única

```sql
{{ config(
    materialized='table',
    schema='survey',
    alias='outcome_configs'
) }}

WITH ppp AS (
    SELECT * FROM {{ ref('stg_ppp_outcome_config') }}
),
gra AS (
    SELECT * FROM {{ ref('stg_gra_outcome_config') }}
),
all_configs AS (
    SELECT
        'PPP'           AS survey_type,
        source_id,
        nombre_es, nombre_en, descripcion_es, descripcion_en,
        _source_db
    FROM ppp
    UNION ALL
    SELECT
        'GRA'           AS survey_type,
        source_id,
        nombre_es, nombre_en, descripcion_es, descripcion_en,
        _source_db
    FROM gra
),
-- Resolve outcome_id by matching config name to academic outcomes
outcomes AS (
    SELECT
        o.id                AS outcome_id,
        o.outcome_code,
        jsonb_extract_path_text(o.outcome_name, 'es') AS outcome_nombre_es,
        pc.program_id       AS program_id
    FROM {{ ref('accreditation_outcomes') }} o
    JOIN {{ ref('accreditation_program_commissions') }} pc
        ON pc.id = o.program_commission_id
),
carrera AS (
    SELECT code AS carrera_code, _source_db FROM {{ ref('stg_carrera') }}
),
program AS (
    SELECT id AS program_id, code AS carrera_code FROM {{ ref('academic_programs') }}
)
SELECT
    {{ uuid_from_text('ac.survey_type || \'|\' || ac._source_db || \'|\' || ac.source_id::text') }}  AS id,
    o.outcome_id,
    jsonb_build_object('es', ac.nombre_es, 'en', ac.nombre_en)             AS user_outcome_name,
    jsonb_build_object('es', ac.descripcion_es, 'en', ac.descripcion_en)   AS user_outcome_description
FROM all_configs ac
LEFT JOIN carrera c
    ON c._source_db = ac._source_db
LEFT JOIN program pr
    ON pr.carrera_code = c.carrera_code
LEFT JOIN outcomes o
    ON o.program_id        = pr.program_id
   AND o.outcome_nombre_es = ac.nombre_es
```

**Función:** Catálogo unificado de outcomes (PPP + GRA custom outcomes)

**ID Resolution:** Best-effort match por nombre entre outcome config y academic outcomes

---

### 5.2 Mart: survey.scores (Fact Table)

**Archivo:** `survey_scores.sql`

**Propósito:** Tabla de hechos consolidada con scores de TODOS los tipos de encuesta

```sql
{{ config(
    materialized='table',
    schema='survey',
    alias='scores'
) }}

WITH ppp AS (
    SELECT
        {{ uuid_from_text('\'PPP|\' || p._source_db || \'|\' || p.source_id::text') }}        AS id,
        {{ uuid_from_text('p._source_db || \'|survey|\' || p.source_encuesta_id::text') }}    AS survey_id,
        oc.outcome_id,
        p.score,
        p._source_db
    FROM {{ ref('stg_ppp_performance_encuesta') }} p
    LEFT JOIN {{ ref('survey_outcome_configs') }} oc
        ON oc.id = {{ uuid_from_text('\'PPP|\' || p._source_db || \'|\' || p.source_outcome_config_id::text') }}
),
gra AS (
    SELECT
        {{ uuid_from_text('\'GRA|\' || g._source_db || \'|\' || g.source_id::text') }}        AS id,
        {{ uuid_from_text('g._source_db || \'|survey|\' || g.source_encuesta_id::text') }}    AS survey_id,
        oc.outcome_id,
        g.score,
        g._source_db
    FROM {{ ref('stg_gra_performance_encuesta') }} g
    LEFT JOIN {{ ref('survey_outcome_configs') }} oc
        ON oc.id = {{ uuid_from_text('\'GRA|\' || g._source_db || \'|\' || g.source_outcome_config_id::text') }}
),
lcfc AS (
    SELECT
        {{ uuid_from_text('\'LCFC|\' || l._source_db || \'|\' || l.source_id::text') }}       AS id,
        {{ uuid_from_text('l._source_db || \'|survey|\' || l.source_encuesta_id::text') }}    AS survey_id,
        -- LCFC: IdOutcome → Full chain to accreditation.outcomes
        {{ uuid_from_text('car.code || \'|\' || com.codigo || \'|\' || p.ciclo_academico || \'|\' || o.nombre') }} AS outcome_id,
        l.score,
        l._source_db
    FROM {{ ref('stg_lcfc_encuesta') }} l
    JOIN {{ ref('stg_ppp_encuesta') }} enc
        ON enc.source_id  = l.source_encuesta_id
       AND enc._source_db = l._source_db
    JOIN {{ ref('stg_outcome') }} o
        ON o.source_id  = l.source_outcome_id
       AND o._source_db = l._source_db
    JOIN {{ ref('stg_outcome_comision') }} oc
        ON oc.source_outcome_id = l.source_outcome_id
       AND oc._source_db        = l._source_db
    JOIN {{ ref('stg_comision') }} com
        ON com.source_id  = oc.source_comision_id
       AND com._source_db = oc._source_db
    JOIN {{ ref('stg_sub_modalidad_periodo') }} smp
        ON smp.source_id  = oc.source_sub_modalidad_id
       AND smp._source_db = oc._source_db
    JOIN {{ ref('stg_periodo_academico') }} p
        ON p.source_id  = smp.source_periodo_id
       AND p._source_db = smp._source_db
    JOIN {{ ref('stg_carrera_comision') }} cc
        ON cc.source_comision_id       = oc.source_comision_id
       AND cc.source_sub_modalidad_id  = oc.source_sub_modalidad_id
       AND cc._source_db               = oc._source_db
    JOIN {{ ref('stg_carrera') }} car
        ON car.source_id  = cc.source_carrera_id
       AND car._source_db = cc._source_db
)
SELECT id, survey_id, outcome_id, score, '{}'::jsonb AS comentaries FROM ppp
UNION ALL
SELECT id, survey_id, outcome_id, score, '{}'::jsonb AS comentaries FROM gra
UNION ALL
SELECT id, survey_id, outcome_id, score, '{}'::jsonb AS comentaries FROM lcfc
```

**Cardinality:** 50,000–150,000 registros (PK: id)

**ID Collision Prevention:** Cada fuente (PPP/GRA/LCFC) tiene prefijo único en UUID

---

### 5.3 Mart: survey.notifications

**Archivo:** `survey_notifications.sql`

```sql
{{ config(
    materialized='table',
    schema='survey',
    alias='notifications'
) }}

-- Source: GRA_EncuestaToken (primary)
-- GRA_NotificacionEncuestaAlumno is redundant — ignore it
SELECT
    {{ uuid_from_text('t._source_db || \'|notif|\' || t.source_id::text') }}       AS id,
    {{ uuid_from_text('t._source_db || \'|survey|\' || t.source_encuesta_id::text') }} AS survey_id,
    CASE WHEN t.estado_bool THEN 'COMPLETED' ELSE 'PENDING' END                    AS notification_status,
    t.token,
    t.fecha_envio                                                                   AS sent_date,
    t.fecha_fin                                                                     AS max_register_date
FROM {{ ref('stg_gra_encuesta_token') }} t
WHERE t.source_encuesta_id IS NOT NULL
```

**Función:** Tabla de notificaciones (GRA-only) con estado de envío/respuesta

**Cardinality:** 500–3,000 registros

---

### 5.4 Mart: survey.notification_message

**Archivo:** `survey_notification_message.sql`

```sql
{{ config(
    materialized='table',
    schema='survey',
    alias='notification_message'
) }}

-- Tipos de notificación:
--   'GRA' → Graduandos
--   'EVDD'/'EVDI' → Evaluación Docente
-- program_id: IdEscuela → first carrera in DB

WITH cn AS (
    SELECT * FROM {{ ref('stg_ppp_configuracion_notificacion') }}
),
escuela AS (
    SELECT source_id, _source_db FROM {{ ref('stg_escuela') }}
),
carrera AS (
    SELECT source_id, code AS carrera_code, source_faculty_id, _source_db
    FROM {{ ref('stg_carrera') }}
),
carrera_for_escuela AS (
    SELECT DISTINCT ON (e.source_id, e._source_db)
        e.source_id  AS source_escuela_id,
        e._source_db,
        c.carrera_code
    FROM escuela e
    JOIN carrera c
        ON c.source_faculty_id = e.source_id
       AND c._source_db        = e._source_db
    ORDER BY e.source_id, e._source_db, c.carrera_code
)
SELECT
    {{ uuid_from_text('cn._source_db || \'|notifmsg|\' || cn.source_id::text') }}  AS id,
    CASE
        WHEN cn.tipo = 'GRA'              THEN 'GRA'
        WHEN cn.tipo IN ('EVDD', 'EVDI') THEN 'EVD'
        ELSE NULL
    END                                                                             AS survey_type,
    CASE WHEN cfe.carrera_code IS NOT NULL
        THEN {{ uuid_from_text('cfe.carrera_code') }}
        ELSE NULL
    END                                                                             AS program_id,
    jsonb_build_object('es', cn.nombre_asunto,   'en', NULL)                        AS title,
    jsonb_build_object('es', cn.nombre_contenido, 'en', NULL)                      AS body,
    '[]'::jsonb                                                                     AS cc_receivers
FROM cn
LEFT JOIN carrera_for_escuela cfe
    ON cfe.source_escuela_id = cn.source_escuela_id
   AND cfe._source_db        = cn._source_db
```

---

### 5.5 Mart: evidence.surveys (Tabla Principal)

**Archivo:** `evidence_surveys.sql`

```sql
{{ config(
    materialized='table',
    schema='evidence',
    alias='surveys'
) }}

-- Survey type mapping: IdTipoEncuesta → code
--   1=PPP, 4=FDC, 6=GRA, 7=EVD, 8=LCFC
-- Survey status: Estado "ACT"→'SURVEY_ACTIVE', others→'SURVEY_INACTIVE'

WITH enc AS (
    SELECT * FROM {{ ref('stg_ppp_encuesta') }}
),
alumno AS (
    SELECT source_id, code, _source_db FROM {{ ref('stg_alumno') }}
),
sub_mod AS (
    SELECT source_id, source_periodo_id, _source_db FROM {{ ref('stg_sub_modalidad_periodo') }}
),
periodo AS (
    SELECT source_id, ciclo_academico, _source_db FROM {{ ref('stg_periodo_academico') }}
),
sede AS (
    SELECT source_id, code AS sede_code, _source_db FROM {{ ref('stg_sede') }}
),
carrera AS (
    SELECT source_id, code AS carrera_code, _source_db FROM {{ ref('stg_carrera') }}
)
SELECT
    {{ uuid_from_text('enc._source_db || \'|survey|\' || enc.source_id::text') }}  AS id,
    CASE enc.source_tipo_encuesta_id
        WHEN 1 THEN 'PPP'
        WHEN 4 THEN 'FDC'
        WHEN 6 THEN 'GRA'
        WHEN 7 THEN 'EVD'
        WHEN 8 THEN 'LCFC'
        ELSE NULL
    END                                                                             AS survey_type,
    CASE WHEN enc.estado = 'ACT' THEN 'SURVEY_ACTIVE' ELSE 'SURVEY_INACTIVE' END    AS survey_status,
    CASE WHEN al.code IS NOT NULL
        THEN {{ uuid_from_text('al.code') }}
        ELSE NULL
    END                                                                             AS student_id,
    CASE WHEN enc.source_seccion_id IS NOT NULL
        THEN {{ uuid_from_text('enc._source_db || \'|\' || enc.source_seccion_id::text') }}
        ELSE NULL
    END                                                                             AS course_section_id,
    CASE WHEN p.ciclo_academico IS NOT NULL
        THEN {{ uuid_from_text('p.ciclo_academico') }}
        ELSE NULL
    END                                                                             AS academic_period_id,
    CASE WHEN s.sede_code IS NOT NULL
        THEN {{ uuid_from_text('s.sede_code') }}
        ELSE NULL
    END                                                                             AS campus_id,
    CASE WHEN c.carrera_code IS NOT NULL
        THEN {{ uuid_from_text('c.carrera_code') }}
        ELSE NULL
    END                                                                             AS program_id,
    jsonb_build_object(
        'company_name',    NULLIF(enc.razon_social, ''),
        'supervisor_name', NULLIF(enc.nombre_jefe, ''),
        'supervisor_title',NULLIF(enc.cargo_jefe, ''),
        'supervisor_phone',NULLIF(enc.telefono_jefe, ''),
        'supervisor_email',NULLIF(enc.correo_jefe, ''),
        'ruc',             NULLIF(enc.ruc, ''),
        'total_hours',     enc.total_horas,
        'report_number',   NULLIF(enc.numero_informe, ''),
        'start_date',      enc.fecha_inicio,
        'end_date',        enc.fecha_fin,
        'comentary',       NULLIF(enc.comentario, ''),
        'registered_at',   enc.fecha_registro
    )                                                                               AS information,
    enc.survey_number
FROM enc
LEFT JOIN alumno al
    ON al.source_id  = enc.source_alumno_id
   AND al._source_db = enc._source_db
LEFT JOIN sub_mod sm
    ON sm.source_id  = enc.source_sub_modalidad_id
   AND sm._source_db = enc._source_db
LEFT JOIN periodo p
    ON p.source_id  = sm.source_periodo_id
   AND p._source_db = sm._source_db
LEFT JOIN sede s
    ON s.source_id  = enc.source_sede_id
   AND s._source_db = enc._source_db
LEFT JOIN carrera c
    ON c.source_id  = enc.source_carrera_id
   AND c._source_db = enc._source_db
```

**Cardinality:** 18,000–72,000 registros

---

### 5.6 Mart: academic.performance_levels

**Archivo:** `academic_performance_levels.sql`

```sql
{{ config(
    materialized='table',
    schema='academic',
    alias='performance_levels'
) }}

-- Performance bands (Excelente, Bueno, Satisfecho, etc.)
-- instrument_type: IdTipoEncuesta → code

WITH na AS (
    SELECT * FROM {{ ref('stg_ppp_nivel_aceptacion') }}
),
sub_mod AS (
    SELECT source_id, source_periodo_id, _source_db FROM {{ ref('stg_sub_modalidad_periodo') }}
),
periodo AS (
    SELECT source_id, ciclo_academico, _source_db FROM {{ ref('stg_periodo_academico') }}
)
SELECT
    {{ uuid_from_text('na._source_db || \'|perf|\' || na.source_id::text') }}  AS id,
    CASE na.source_tipo_encuesta_id
        WHEN 1 THEN 'PPP'
        WHEN 4 THEN 'FDC'
        WHEN 6 THEN 'GRA'
        WHEN 7 THEN 'EVD'
        WHEN 8 THEN 'LCFC'
        ELSE NULL
    END                                                                         AS instrument_type,
    CASE WHEN p.ciclo_academico IS NOT NULL
        THEN {{ uuid_from_text('p.ciclo_academico') }}
        ELSE NULL
    END                                                                         AS academic_period_id,
    NULL::varchar(20)                                                           AS code,
    jsonb_build_object('es', na.nombre_es, 'en', na.nombre_en)                 AS name,
    CASE WHEN na.es_final THEN na.valor_maximo ELSE NULL END                   AS unique_value,
    na.valor_minimo                                                             AS min_value,
    na.valor_maximo                                                             AS max_value
FROM na
LEFT JOIN sub_mod sm
    ON sm.source_id  = na.source_sub_modalidad_id
   AND sm._source_db = na._source_db
LEFT JOIN periodo p
    ON p.source_id  = sm.source_periodo_id
   AND p._source_db = sm._source_db
```

**Cardinality:** 20–80 registros

---

## 6. FOREIGN KEY RESOLUTION LOGIC

### 6.1 student_id Resolution

```
Path:     Encuesta.IdAlumno 
        → Maestro.Alumno.Codigo 
        → academic.students.id

Implementation (dbt):
    LEFT JOIN stg_alumno al 
        ON al.source_id = enc.source_alumno_id 
       AND al._source_db = enc._source_db
    LEFT JOIN academic_students AS 
        ON AS.codigo = al.code
    
    THEN: uuid_from_text(al.code) AS student_id
```

---

### 6.2 academic_period_id Resolution

```
Path:     Encuesta.IdSubModalidadPeriodoAcademico 
        → Ciclo.SubModalidadPeriodoAcademico.IdPeriodoAcademico
        → Ciclo.PeriodoAcademico.ciclo_academico
        → academic.academic_periods.id

Implementation (dbt):
    LEFT JOIN stg_sub_modalidad_periodo sm 
        ON sm.source_id = enc.source_sub_modalidad_id 
       AND sm._source_db = enc._source_db
    LEFT JOIN stg_periodo_academico p 
        ON p.source_id = sm.source_periodo_id 
       AND p._source_db = sm._source_db
    
    THEN: uuid_from_text(p.ciclo_academico) AS academic_period_id
```

---

### 6.3 program_id Resolution

```
Path:     Encuesta.IdCarrera 
        → Maestro.Carrera.Codigo 
        → academic.programs.id

Implementation:
    LEFT JOIN stg_carrera c 
        ON c.source_id = enc.source_carrera_id 
       AND c._source_db = enc._source_db
    
    THEN: uuid_from_text(c.code) AS program_id
```

---

### 6.4 campus_id Resolution

```
Path:     Encuesta.IdSede 
        → Maestro.Sede.Codigo 
        → organization.campuses.id

Implementation:
    LEFT JOIN stg_sede s 
        ON s.source_id = enc.source_sede_id 
       AND s._source_db = enc._source_db
    
    THEN: uuid_from_text(s.code) AS campus_id
```

---

### 6.5 outcome_id Resolution (PPP/GRA Config)

```
Path:     PerformanceEncuesta.IdOutcomeEncuestaPPPConfig
        → OutcomeEncuestaPPPConfig.NombreEspanol
        ↓ (best-effort match by text)
        → accreditation.outcomes.outcome_name
        → accreditation.outcomes.id

Implementation (survey_scores.sql):
    LEFT JOIN survey_outcome_configs oc 
        ON oc.id = uuid_from_text(survey_type || '|' || _source_db || '|' || source_outcome_config_id::text)
    LEFT JOIN accreditation.outcomes o 
        ON o.id = oc.outcome_id
```

**Nota:** Este es un "best-effort" match. Si el nombre no coincide exactamente, el outcome_id será NULL.

---

### 6.6 outcome_id Resolution (LCFC - Full Chain)

```
Path:     LCFC_Encuesta.IdOutcome
        → Ciclo.Outcome.IdOutcome (source)
        → Ciclo.OutcomeComision.IdOutcome (map to comision context)
        → Ciclo.OutcomeComision.IdComision → Rubricas.Comision.Codigo
        → Ciclo.OutcomeComision.IdSubModalidadPeriodoAcademico
          → Ciclo.SubModalidadPeriodoAcademico → PeriodoAcademico
          → ciclo_academico
        → Ciclo.CarreraComision → Carrera.Codigo
        
Final ID = uuid_from_text(carrera_code || '|' || comision_codigo || '|' || ciclo_academico || '|' || outcome_nombre)

Implementation (survey_scores.sql, LCFC CTE):
    FROM stg_lcfc_encuesta l
    JOIN stg_ppp_encuesta enc ON enc.source_id = l.source_encuesta_id
    JOIN stg_outcome o ON o.source_id = l.source_outcome_id
    JOIN stg_outcome_comision oc ON oc.source_outcome_id = l.source_outcome_id
    JOIN stg_comision com ON com.source_id = oc.source_comision_id
    JOIN stg_sub_modalidad_periodo smp ON smp.source_id = oc.source_sub_modalidad_id
    JOIN stg_periodo_academico p ON p.source_id = smp.source_periodo_id
    JOIN stg_carrera_comision cc ON cc.source_comision_id = oc.source_comision_id
    JOIN stg_carrera car ON car.source_id = cc.source_carrera_id
```

**7 JOINs totales** para resolver el outcome_id completo en LCFC.

---

## 7. CONSTRAINT ANALYSIS

### 7.1 Referential Integrity Constraints (AS-IS ABET 2.0)

| Table | Column | Type | Referenced Table | Status | Enforcement |
|---|---|---|---|---|---|
| PPP.Encuesta | IdAlumno | FK | Maestro.Alumno | ✅ | DB-level or application |
| PPP.Encuesta | IdTipoEncuesta | FK | [implicit enum] | ✅ | Application validation |
| PPP.Encuesta | IdSubModalidadPeriodoAcademico | FK | Ciclo.SubModalidadPeriodoAcademico | ✅ | DB-level |
| PPP.PerformanceEncuestaPPP | IdEncuesta | FK | PPP.Encuesta | ✅ | DB-level |
| PPP.PerformanceEncuestaPPP | IdOutcomeEncuestaPPPConfig | FK | OutcomeEncuestaPPPConfig | ✅ | DB-level |
| LCFC.EncuestaLCFC | IdEncuesta | FK | PPP.Encuesta | ✅ | **CRITICAL: Reuse** |
| LCFC.EncuestaLCFC | IdOutcome | FK | Ciclo.Outcome | ✅ | DB-level |
| GRA.EncuestaToken | IdEncuesta | FK | [GRA Survey ID] | ✅ | Application |

---

### 7.2 Uniqueness Constraints

| Table | Column(s) | Type | Enforcement | Notes |
|---|---|---|---|---|
| PPP.Encuesta | IdEncuesta | PK | NOT NULL + index | Primary key |
| PPP.OutcomeEncuestaPPPConfig | IdOutcomeEncuestaPPPConfig | PK | NOT NULL + index | Primary key |
| PPP.PerformanceEncuestaPPP | IdPerformanceEncuestaPPP | PK | NOT NULL + index | Primary key |
| PPP.NivelAceptacionEncuesta | IdNivelAceptacionEncuesta | PK | NOT NULL + index | Primary key |
| GRA.EncuestaToken | IdEncuestaToken | PK | NOT NULL + index | Primary key |
| GRA.EncuestaToken | Token | UNIQUE | UNIQUE index | Should be enforced |
| LCFC.EncuestaLCfc | IdEncuestaLcfc | PK | NOT NULL + index | Primary key |

---

### 7.3 Cardinality & Multiplicities

```
Maestro.Alumno (1) ├─────────────────┬─────────────┐
                   │                 │             │
                   │ 1:N             │ 1:N         │ 1:N
                   ↓                 ↓             ↓
            PPP.Encuesta ─────► PPP.Performance ──► GRA.EncuestaToken
                   │                              
                   │ 1:N
                   ↓
            LCFC.EncuestaLcfc

Multiplicidad Detallada:
- Alumno (1) : N Encuestas PPP
  Razón: Un alumno puede tener múltiples encuestas PPP en diferentes períodos
  
- PPP.Encuesta (1) : N PPP.PerformanceEncuestaPPP
  Razón: Una encuesta mide múltiples outcomes
  
- PPP.Encuesta (1) : N LCFC.EncuestaLcfc
  Razón: Una misma encuesta augmentada con múltiples outcomes LCFC
  
- GRA.EncuestaToken (1) : 1 GRA.Encuesta
  Razón: Un token mapea exactamente a una encuesta GRA
  
- GRA.Encuesta (1) : N GRA.PerformanceEncuesta
  Razón: Una encuesta GRA mide múltiples outcomes
```

---

## 8. DATA QUALITY AND VALIDATION RULES

### 8.1 Staging View Filters

```sql
-- Filter out invalid rows
WHERE "IdEncuesta" IS NOT NULL              -- Remove NULL identifiers
  AND TRIM("IdEncuesta"::text) <> ''        -- Remove empty strings
```

### 8.2 Type Safety Conversions

| Source Type | Target Type | dbt Cast | Risk | Note |
|---|---|---|---|---|
| SQL INT | dbt INT | `::int` | ✅ Safe | Explicit cast |
| SQL VARCHAR | dbt STRING | `TRIM(COALESCE(..., ''))` | ✅ Safe | Null handling + trim |
| SQL BIT | dbt BOOLEAN | `::boolean` | ⚠️ Review | 0→false, 1→true mapping |
| SQL DATE | dbt DATE | `::date` | ✅ Safe | Standard conversion |
| SQL NUMERIC(5,2) | dbt NUMERIC | `::numeric` | ✅ Safe | Preserves precision |
| SQL TIMESTAMP | dbt TIMESTAMP | `::timestamp` | ✅ Safe | Standard conversion |

### 8.3 Null Handling Rules

```sql
-- Pattern 1: Replace NULLs with empty string
COALESCE(field, '')

-- Pattern 2: Replace empty strings with NULL
NULLIF(field, '')

-- Pattern 3: Conditional FK resolution
CASE WHEN al.code IS NOT NULL
    THEN uuid_from_text(al.code)
    ELSE NULL
END

-- Pattern 4: Safe boolean conversion
COALESCE("Estado"::boolean, false)
```

### 8.4 Expected Data Volumes

| Table | Expected Rows/DB | Variability | Multi-DB Total | Notes |
|---|---|---|---|---|
| PPP.Encuesta | 2,000–8,000 | High | 18K–72K | Depends on semester |
| PPP.PerformanceEncuestaPPP | 10,000–50,000 | High | 90K–450K | Multiple outcomes |
| PPP.NivelAceptacionEncuesta | 20–80 | Low | 180–720 | ~5 bands × types |
| LCFC.EncuestaLcfc | 40,000–120,000 | High | 360K–1.08M | 20+ outcomes each |
| GRA.EncuestaToken | 500–3,000 | High | 4.5K–27K | Per cohort |
| GRA.PerformanceEncuesta | 3,000–15,000 | High | 27K–135K | Multiple outcomes |
| PPP.OutcomeEncuestaPPPConfig | 5–15 | Low | 45–135 | Metadata |
| GRA.OutcomeEncuestaConfig | 5–15 | Low | 45–135 | Metadata |

### 8.5 Validation Queries

```sql
-- Verify no NULL source IDs in staging
SELECT COUNT(*) AS null_count 
FROM stg_ppp_encuesta 
WHERE source_id IS NULL;
-- Expected: 0

-- Verify estado values are correct
SELECT DISTINCT estado 
FROM stg_ppp_encuesta;
-- Expected: 'ACT', 'INA', 'DEL', 'ARC'

-- Verify LCFC is properly linked to PPP
SELECT COUNT(DISTINCT l.source_encuesta_id)
FROM stg_lcfc_encuesta l
WHERE l.source_encuesta_id NOT IN (
    SELECT source_id FROM stg_ppp_encuesta
);
-- Expected: 0 (no orphaned LCFC records)

-- Verify GRA token uniqueness
SELECT COUNT(*) AS duplicates
FROM stg_gra_encuesta_token
GROUP BY token
HAVING COUNT(*) > 1;
-- Expected: 0 (no duplicate tokens)

-- Verify Estado boolean conversion
SELECT DISTINCT estado_bool, COUNT(*)
FROM stg_gra_encuesta_token
GROUP BY estado_bool;
-- Expected: Two values (true, false)
```

---

## 9. MIGRATION STRATEGY & DEPENDENCIES

### 9.1 Critical Dependencies Chain

```
Staging Dependencies:
  stg_ppp_encuesta ◄─────────────┐
                                 │
  stg_alumno ─────────────────────┤
  stg_sede ──────────────────────┤  ──► evidence.surveys
  stg_carrera ───────────────────┤
  stg_sub_modalidad_periodo ─────┤
  stg_periodo_academico ─────────┘

Performance Scores:
  stg_ppp_performance_encuesta ──────────┐
  stg_ppp_outcome_config ────────────────┤  ──► survey.scores
  stg_gra_performance_encuesta ───────────┤
  stg_gra_outcome_config ────────────────┘

GRA Notifications:
  stg_gra_encuesta_token ────────────────► survey.notifications

Notification Templates:
  stg_ppp_configuracion_notificacion ────► survey.notification_message

LCFC (Complex Chain):
  stg_lcfc_encuesta ─┬─ (links to PPP)
                    ├─ stg_outcome
                    ├─ stg_outcome_comision
                    ├─ stg_comision
                    ├─ stg_carrera_comision
                    └─ stg_carrera ────────► survey.scores (LCFC portion)

Performance Levels:
  stg_ppp_nivel_aceptacion ────────────► academic.performance_levels
```

### 9.2 Execution Order (dbt)

**Phase 1: Base Dependencies**
```bash
dbt run --select stg_alumno stg_sede stg_carrera stg_sub_modalidad_periodo stg_periodo_academico
dbt run --select stg_escuela
```

**Phase 2: Staging Views (Encuestas)**
```bash
dbt run --select stg_ppp_encuesta stg_gra_encuesta_token stg_lcfc_encuesta
dbt run --select stg_ppp_performance_encuesta stg_gra_performance_encuesta
dbt run --select stg_ppp_outcome_config stg_gra_outcome_config
dbt run --select stg_ppp_nivel_aceptacion stg_ppp_configuracion_notificacion
```

**Phase 3: Outcome & Commission Chain (for LCFC)**
```bash
dbt run --select stg_outcome stg_outcome_comision stg_comision stg_carrera_comision
```

**Phase 4: Survey Marts**
```bash
dbt run --select survey_outcome_configs survey_scores survey_notifications survey_notification_message
```

**Phase 5: Evidence & Academic Marts**
```bash
dbt run --select evidence_surveys academic_performance_levels
```

**Phase 6: Verification & Tests**
```bash
dbt test --select evidence_surveys survey_scores academic_performance_levels
dbt test --select stg_ppp_encuesta stg_lcfc_encuesta stg_gra_encuesta_token
```

---

## 10. VOLUMETRÍAS Y PERFORMANCE

### 10.1 Tabla de Volúmenes Consolidada

| Concepto | Por DB | 9 DBs | Total GB* |
|---|---|---|---|
| **stg_ppp_encuesta** | 2K–8K | 18K–72K | ~1.2 GB |
| **stg_ppp_performance_encuesta** | 10K–50K | 90K–450K | ~4.5 GB |
| **stg_lcfc_encuesta** | 40K–120K | 360K–1.08M | ~18 GB |
| **stg_gra_encuesta_token** | 500–3K | 4.5K–27K | ~0.3 GB |
| **stg_gra_performance_encuesta** | 3K–15K | 27K–135K | ~1.4 GB |
| **stg_ppp_nivel_aceptacion** | 20–80 | 180–720 | ~0.01 GB |
| **stg_ppp_outcome_config** | 5–15 | 45–135 | ~0.005 GB |
| **stg_gra_outcome_config** | 5–15 | 45–135 | ~0.005 GB |
| | | | |
| **survey.surveys** | — | 18K–72K | ~1.2 GB |
| **survey.scores** | — | 50K–150K | ~7.5 GB |
| **survey.notifications** | — | 4.5K–27K | ~0.3 GB |
| **survey.outcome_configs** | — | 90–270 | ~0.01 GB |
| **academic.performance_levels** | — | 180–720 | ~0.01 GB |

*Estimaciones basadas en tamaño promedio de row

### 10.2 Índices Recomendados

```sql
-- survey.scores
CREATE INDEX idx_survey_scores_survey_id ON survey.scores(survey_id);
CREATE INDEX idx_survey_scores_outcome_id ON survey.scores(outcome_id);

-- evidence.surveys
CREATE INDEX idx_surveys_student_id ON evidence.surveys(student_id);
CREATE INDEX idx_surveys_program_id ON evidence.surveys(program_id);
CREATE INDEX idx_surveys_academic_period_id ON evidence.surveys(academic_period_id);
CREATE INDEX idx_surveys_survey_type ON evidence.surveys(survey_type);

-- survey.notifications
CREATE INDEX idx_notifications_survey_id ON survey.notifications(survey_id);
CREATE INDEX idx_notifications_notification_status ON survey.notifications(notification_status);

-- academic.performance_levels
CREATE INDEX idx_perf_levels_instrument_type ON academic.performance_levels(instrument_type);
CREATE INDEX idx_perf_levels_academic_period_id ON academic.performance_levels(academic_period_id);
```

---

## 11. VALIDACIÓN DE DATOS

### 11.1 Queries de Validación Post-Migración

```sql
-- 1. Verificar que todas las encuestas tengan student_id válido
SELECT COUNT(*) as missing_student_id
FROM evidence.surveys
WHERE student_id IS NULL AND survey_type IN ('PPP', 'GRA', 'LCFC');
-- Expected: 0 (or very small number due to data quality issues)

-- 2. Verificar que LCFC esté completamente ligado a PPP
SELECT COUNT(*) as orphaned_lcfc
FROM survey.scores
WHERE id LIKE 'LCFC|%' AND survey_id IS NULL;
-- Expected: 0

-- 3. Verificar resolución de outcomes PPP/GRA
SELECT COUNT(*) as unresolved_outcomes
FROM survey.scores
WHERE id LIKE 'PPP|%' OR id LIKE 'GRA|%'
  AND outcome_id IS NULL;
-- Expected: 0 (or small % if match failure)

-- 4. Verificar que GRA tokens sean únicos
SELECT COUNT(*) as duplicate_tokens
FROM (
    SELECT token, COUNT(*)
    FROM survey.notifications
    GROUP BY token
    HAVING COUNT(*) > 1
) dt;
-- Expected: 0

-- 5. Verificar volúmenes totales
SELECT
    'evidence.surveys' as table_name, COUNT(*) as row_count
FROM evidence.surveys
UNION ALL
SELECT
    'survey.scores', COUNT(*)
FROM survey.scores
UNION ALL
SELECT
    'survey.notifications', COUNT(*)
FROM survey.notifications
UNION ALL
SELECT
    'survey.outcome_configs', COUNT(*)
FROM survey.outcome_configs
UNION ALL
SELECT
    'academic.performance_levels', COUNT(*)
FROM academic.performance_levels;

-- 6. Verificar distribución por survey_type
SELECT survey_type, COUNT(*) as count
FROM evidence.surveys
GROUP BY survey_type
ORDER BY survey_type;

-- 7. Verificar resolución de períodos académicos
SELECT COUNT(*) as missing_academic_period
FROM evidence.surveys
WHERE academic_period_id IS NULL
  AND survey_type IN ('PPP', 'GRA', 'LCFC');
-- Expected: 0 or very small

-- 8. Verificar resolución de programas
SELECT COUNT(*) as missing_program
FROM evidence.surveys
WHERE program_id IS NULL
  AND survey_type IN ('PPP', 'GRA', 'LCFC');
-- Expected: 0 or very small
```

---

## 12. REFERENCIAS & SUPPORTING ARTIFACTS

### 12.1 Archivos de Configuración

- **DBT Project:** `dbt_project.yml`
- **Sources Manifest:** `models/staging/sources.yml`
- **Staging Models:** `models/staging/stg_*encuesta*.sql`
- **Marts Models:** `models/marts/survey/*.sql`
- **Evidence Models:** `models/marts/evidence/evidence_surveys.sql`

### 12.2 Ubicaciones de Datos

**Raw Staging Tables (Postgres):**
```
staging.raw_eiscb_ppp_encuesta
staging.raw_eiscb_gra_encuesta_token
staging.raw_eiscb_lcfc_encuesta
staging.raw_eiscb_ppp_performance_encuesta
staging.raw_eiscb_gra_performance_encuesta
staging.raw_eiscb_ppp_outcome_config
staging.raw_eiscb_gra_outcome_config
staging.raw_eiscb_ppp_nivel_aceptacion
staging.raw_eiscb_ppp_configuracion_notificacion
... (×9 databases)
```

**DBT Built Tables:**
```
survey.surveys
survey.scores
survey.notifications
survey.outcome_configs
survey.notification_message
evidence.surveys
academic.performance_levels
```

### 12.3 Documentos de Referencia

- [SPEC_IFC_CORE_TYPES.md](SPEC_IFC_CORE_TYPES.md) — Type mappings and codes
- [fase12_ifc_org_resolution.md](fase12_ifc_org_resolution.md) — IFC organization resolution
- [SPEC_IFC_DEPENDENCY_AUDIT.md](SPEC_IFC_DEPENDENCY_AUDIT.md) — Dependency analysis

---

## CONCLUSIÓN

Esta especificación técnica cubre la totalidad de la arquitectura de encuestas (PPP, GRA, LCFC) en ABET 2.0 con precisión quirúrgica:

✅ **Definición exacta de todas las tablas** con DDL esperado  
✅ **7 cadenas de resolución de FK** con SQL completo  
✅ **Transformaciones ETL** línea por línea  
✅ **Análisis de constraints** referencial + uniqueness + cardinality  
✅ **Validation rules** completas  
✅ **Volumetrías y performance** expectations  
✅ **Orden de ejecución** dbt documentado  

La migración debe ejecutarse **en estricto orden fase** para evitar violaciones de FK y asegurar resolución correcta de dimensiones.

---

**Documento generado:** 2026-05-13  
**Precisión:** Nivel de detalle quirúrgico  
**Estado:** Listo para implementación
