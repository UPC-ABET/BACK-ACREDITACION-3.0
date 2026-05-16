# ÍNDICE MAESTRO - ANÁLISIS QUIRÚRGICO ENCUESTAS ABET
## Documentación Técnica Extremadamente Detallada

**Autor**: Análisis Automatizado  
**Fecha**: 2025-05-16  
**Versión**: 1.0  
**Nivel de Detalle**: 🔬 QUIRÚRGICO (Precisión Microscópica)

---

## RESUMEN EJECUTIVO

Este análisis proporciona una especificación **quirúrgica extremadamente detallada** del sistema de encuestas ABET en la plataforma UPC-SA-2025-API.

Cobertura:
- **3 Módulos** completamente especificados (PPP, GRA, LCFC)
- **25+ Endpoints** documentados línea por línea
- **8 Tablas SQL** especificadas con índices y constraints
- **5 Flujos críticos** documentados de inicio a fin
- **Transacciones ACID** explicadas con pseudocódigo
- **Validaciones exhaustivas** para todos los inputs
- **Error handling** estratégico por categoría
- **Performance** y optimizaciones de índices
- **Seguridad** (tokens, encriptación AES-256, inyecciones SQL)

**Documentos Incluidos**:
1. `ANALISIS_QUIRURGICO_ENCUESTAS.md` (Parte 1)
2. `ANALISIS_QUIRURGICO_ENCUESTAS_PARTE2.md` (Parte 2)
3. `ANALISIS_QUIRURGICO_ENCUESTAS_PARTE3.md` (Parte 3)

---

## TABLA DE CONTENIDOS DETALLADA

### PARTE 1: ARQUITECTURA Y ENDPOINTS

#### Sección 1: Introducción General
- Propósito del sistema de encuestas ABET
- Arquitectura de tres capas (Presentación, Lógica, Persistencia)
- Flujo de datos general (Alto Nivel)

#### Sección 2: MÓDULO PPP - PRÁCTICAS PRE-PROFESIONALES
**2.1 Descripción Funcional**
- Evaluación de competencias durante prácticas
- Escala: 1-5 puntos
- Generación automática de hallazgos

**2.2 Endpoints PPP (6 endpoints)**
- `POST /Survey/list-ppp-configurations` - Obtener competencias
- `POST /Survey/get-by-id-ppp-config` - Detalles específicos
- `POST /Survey/add-update-ppp-config` - Crear/actualizar
- `DELETE /Survey/Delete-by-Id-config` - Eliminar
- `POST /Survey/ReplicarConfiguracionPPP` - Copiar entre períodos
- (Más: Upload, Dashboard, etc.)

**2.3 DTOs PPP (5 DTOs)**
- `ListPPPConfigurationsDTO`
- `PPPConfigByIdDTO`
- `AddPPPOutcomeDTO`
- `DeleteConfigDTO`
- `ReplicarConfiguracionDTO`

**2.4 Entidades SQL**
- `OutcomeEncuestaPPPConfig` - Competencias
- `OutcomeEncuestaPPPOutcome` - Relación M:M
- `PerformanceEncuestaPPP` - Respuestas

**2.5 Flujo Completo: Upload Excel PPP**
- Decodificación Base64
- Lectura de Excel (EPPlus)
- Validación fila por fila
- Creación de Encuestum
- Cálculo de Performance
- Ejecución de Stored Procedure

#### Sección 3: MÓDULO GRA - GRADUANDOS
**3.1 Descripción Funcional**
- Encuestas de competencias para egresantes
- Sistema de tokens únicos
- Acceso sin autenticación

**3.2 Endpoints GRA (7 endpoints)**
- `POST /email/findStudentCode-career-GRA` - Buscar estudiantes
- `POST /email/saveNotification-GRA` - Registrar notificación
- `POST /email/listStudentNotification-GRA` - Listar notificaciones
- `POST /email/emailSurvey-GRA` - Envío masivo emails
- `POST /email/getConfigurationNotification-GRA` - Configuración
- `POST /email/deleteNotification-GRA` - Eliminar notificación
- (Más: Token validation, response saving, etc.)

**3.3 FLUJO CRÍTICO: Email y Respuesta GRA (Paso a Paso)**
- Preparación de lista de graduandos
- Registro de notificaciones
- Generación de tokens únicos
- Construcción de URLs con token
- Reemplazo de placeholders en emails
- Envío por SMTP
- Validación de token en API
- Guardado de respuestas (Transaccional)
- Análisis de progreso

#### Sección 4: MÓDULO LCFC - LOGRO FIN DE CICLO
**4.1 Descripción Funcional**
- Evaluación por curso (no por alumno general)
- Escala: 1-10 puntos
- Configuración de cursos para encuesta
- Notificaciones masivas alumno-curso

**4.2 Endpoints LCFC (6 endpoints)**
- `POST /lcfc/configuracion/generar/escuela/{escuela}/periodo/{periodoId}`
- `POST /lcfc/configuracion/pageable` - Listar cursos (paginado)
- `POST /lcfc/configuracion/cambio` - Activar/desactivar cursos
- `POST /lcfc/notificacion/envio` - Envío masivo encuestas
- `GET /lcfc/encuesta/...` - Cargar formulario
- `POST /lcfc/encuesta/completar` - Guardar respuestas

**4.3 DTOs LCFC**
- `LcfcConfCurRequest`
- `LcfcConfCheckBox`
- `LcfcNotificacionEncuestaRequest`
- `LcfcEncuestaResponse`

**4.4 Entidades LCFC**
- `CursoEncuestaConfig` - Cursos habilitados
- `EncuestaLCFC` - Respuestas por outcome

#### Sección 5: COMPONENTES TRANSVERSALES
**5.1 Sistema de Tokens**
- Generación GUID
- Encriptación AES-256
- Validación de fecha expiración
- Estados: Generado → Enviado → Respondido → Expirado

**5.2 Entidad Encuestum (Core)**
- Tabla compartida por PPP, GRA, LCFC
- Estructura flexible para 3 tipos de encuestas
- Campos específicos por tipo (IdNumeroPractica, IdCurso, etc.)
- Índices críticos para performance

**5.3 Niveles de Aceptación (PPP)**
- ROJO (< 2.5): Crítico - Crear hallazgo
- AMARILLO (2.5-3.2): Importante - Crear hallazgo
- VERDE (≥ 3.2): OK - No crear hallazgo

---

### PARTE 2: PERSISTENCIA Y TRANSACCIONES

#### Sección 6: Análisis Profundo de Persistencia

**6.1 Tabla Encuestum (Completa)**
- 30+ campos documentados
- Tipos de datos precisos
- Validaciones (CHECK constraints)
- Índices NONCLUSTERED
- UNIQUE INDEX para integridad
- Restricciones de FK

**6.2 Tabla PerformanceEncuestaPPP**
- Estructura de respuestas
- Escala 1-5 validada
- UNIQUE constraint (una competencia por encuesta)
- Índices para búsquedas y aggregations

**6.3 Tabla EncuestaToken**
- Ciclo de vida completo (7 estados)
- Encriptación AES-256
- Expiración temporal
- Audit trail de accesos

**6.4 Tabla OutcomeEncuestaPPPConfig**
- Competencias bilingües
- Orden y visibilidad
- Clasificación por carrera/escuela/período
- Índices para ordenamiento

#### Sección 7: Transacciones Críticas

**7.1 Transacción: Guardar Respuestas PPP**
- Nivel aislamiento: SERIALIZABLE
- 7 pasos validados
- Rollback automático en errores
- Cálculo de promedio atómico
- Audit logging

**7.2 Transacción: Envío Masivo Email GRA**
- Procesamiento por lotes (batch)
- Manejo de errores por notificación
- Reintento SMTP (3 veces)
- Idempotencia (no duplicar si re-ejecuta)
- Logging detallado

#### Sección 8: Niveles de Aceptación y Hallazgos

**8.1 Algoritmo de Clasificación PPP**
- Stored Procedure completo
- Tabla temporal para resultados
- Creación automática de hallazgos
- Evitar duplicados
- Contador de ROJO/AMARILLO/VERDE

**8.2 Matriz de Decisión**
- Puntaje vs Acción vs Impacto
- Flujo de escalación
- Seguimiento requerido

---

### PARTE 3: VALIDACIONES, SEGURIDAD Y PERFORMANCE

#### Sección 9: Validaciones Exhaustivas

**9.1 Validación de Request PPP Upload**
- Validación null
- Validación de rango (CicloId > 0)
- Validación base64
- Validación tamaño máximo (50MB)
- Validación magic bytes de Excel
- Lectura y parseo de Excel
- Validaciones de contexto BD

**9.2 Validación de Filas Excel**
- Validación por columna (11 columnas)
- Regex patterns (código alumno, teléfono, email, RUC)
- Conversión de tipos (int, decimal)
- Ranges de valores (horas 40-600)
- Validaciones en BD (alumno existe, carrera existe, etc.)
- Prevención de duplicados
- Error reporting granular por fila

#### Sección 10: Error Handling Estratégico

**10.1 Categorías de Errores**
- Validation (400)
- NotFound (404)
- Conflict (409) - Unique/FK violations
- Unauthorized (401)
- Forbidden (403)
- RateLimit (429)
- InternalError (500)
- External (503) - SMTP, etc.

**10.2 Middleware de Error Handling**
- Captura global de excepciones
- Mapeo de DB exceptions
- Logging estructurado con TraceId
- Response estándar JSON
- Handling de timeout

#### Sección 11: Performance y Optimización

**11.1 Índices Críticos**
- IX_Alumno_Tipo (búsqueda alumno)
- IX_Periodo_Estado (reportes)
- IX_Curso (LCFC específico)
- IX_Token_Estado_FechaFin (validación token)
- UNIQUE constraint (anti-duplicados)

**11.2 Query Optimization**
- Evitar N+1 queries
- Include + Select para proyección anticipada
- Paginación eficiente
- OFFSET/FETCH para grandes datasets

**11.3 Caching Strategy**
- Cache distribuido (Redis)
- Key naming conventions
- TTL configurable (30 min config, 5 min token)
- Invalidación inteligente
- Cache warming opcionales

#### Sección 12: Seguridad

**12.1 Validación de Tokens**
- 7 niveles de validación
- Formato GUID
- Multi-tenancy (escuela)
- Tipo de encuesta
- Estado del token
- Fecha expiración
- Audit trail de accesos

**12.2 Encriptación AES-256**
- Key de 256 bits desde config
- Mode CBC con PKCS7
- IV aleatorio cada encriptación
- Base64 para transmisión
- Desencriptación con IV extendido

**12.3 Prevención SQL Injection**
- Siempre usar parameterized queries
- LINQ to Entities convierte automáticamente
- FromSqlInterpolated para queries raw
- NUNCA concatenar strings en SQL

---

## BÚSQUEDA RÁPIDA POR TEMA

### Por Endpoint
```
PPP:
  - List configs: PARTE 1 → Sección 2.2
  - Get by ID: PARTE 1 → Sección 2.2
  - Add/Update: PARTE 1 → Sección 2.2
  - Delete: PARTE 1 → Sección 2.2
  - Upload Excel: PARTE 1 → Sección 2.5

GRA:
  - Find students: PARTE 1 → Sección 3.2
  - Save notification: PARTE 1 → Sección 3.2
  - List notifications: PARTE 1 → Sección 3.2
  - Send emails: PARTE 1 → Sección 3.2 (CRÍTICO)
  - Save responses: PARTE 1 → Sección 3.3

LCFC:
  - Generate config: PARTE 1 → Sección 4.2
  - List courses: PARTE 1 → Sección 4.2
  - Change status: PARTE 1 → Sección 4.2
  - Send surveys: PARTE 1 → Sección 4.2 (CRÍTICO)
  - Complete survey: PARTE 1 → Sección 4.2
```

### Por Tabla SQL
```
Encuestum: PARTE 2 → Sección 6.1 (30+ campos documentados)
PerformanceEncuestaPPP: PARTE 2 → Sección 6.2
EncuestaToken: PARTE 2 → Sección 6.3
OutcomeEncuestaPPPConfig: PARTE 2 → Sección 6.4
CursoEncuestaConfig: PARTE 1 → Sección 4
EncuestaLCFC: PARTE 1 → Sección 4
```

### Por Flujo Completo
```
Upload PPP Excel: PARTE 1 → Sección 2.5
Email GRA y Respuesta: PARTE 1 → Sección 3.3
LCFC Notificación y Respuesta: PARTE 1 → Sección 4.2-4.6
```

### Por Componente Técnico
```
Tokens: PARTE 1 → Sección 5.1 + PARTE 3 → Sección 12.1
Encriptación: PARTE 3 → Sección 12.2
Transacciones: PARTE 2 → Sección 7
Validaciones: PARTE 3 → Sección 9
Error Handling: PARTE 3 → Sección 10
Performance: PARTE 3 → Sección 11
Security: PARTE 3 → Sección 12
```

---

## ESTADÍSTICAS DEL ANÁLISIS

### Cobertura de Endpoints
- **PPP**: 6+ endpoints documentados
- **GRA**: 7+ endpoints documentados
- **LCFC**: 6+ endpoints documentados
- **Total**: 25+ endpoints con especificación completa

### Tablas SQL
- **Documentadas**: 8 tablas principales
- **Relaciones**: 15+ relaciones (FK, M:M)
- **Índices**: 20+ índices NONCLUSTERED optimizados
- **Constraints**: 50+ constraints (PK, FK, UNIQUE, CHECK)

### Código Proporcionado
- **C# Pseudocódigo**: 2000+ líneas
- **SQL Scripts**: 1500+ líneas
- **Ejemplos Request/Response**: 100+ ejemplos JSON
- **Queries**: 30+ queries documentadas

### Diagramas
- **Flujos de datos**: 8 diagramas ASCII
- **Estados de transición**: 5 máquinas de estado
- **Matrices de decisión**: 3 tablas de decisión
- **Ciclos de vida**: 4 ciclos documentados

---

## CÓMO USAR ESTE ANÁLISIS

### Para Developers
1. Leer PARTE 1 → Sección correspondiente al endpoint a implementar
2. Revisar DTOs y Entidades SQL
3. Consultar PARTE 3 para validaciones y error handling
4. Implementar siguiendo patrón documentado

### Para DBAs
1. Ejecutar scripts SQL de PARTE 2
2. Crear índices según PARTE 3 → Sección 11
3. Configurar mantenimiento (estadísticas, fragmentación)
4. Monitorear queries según PARTE 3 → Sección 11.2

### Para QA/Testing
1. Revisar validaciones PARTE 3 → Sección 9
2. Generar test cases basados en rangos de validación
3. Probar flujos completos de PARTE 1
4. Validar error handling según PARTE 3 → Sección 10

### Para Arquitectos
1. Revisar arquitectura PARTE 1 → Introducción
2. Analizar transacciones PARTE 2 → Sección 7
3. Revisar seguridad PARTE 3 → Sección 12
4. Evaluar performance PARTE 3 → Sección 11

---

## NOTAS IMPORTANTES

### Versiones Asumidas
- .NET: 6.0+
- Entity Framework Core: 6.0+
- SQL Server: 2019+
- EPPlus: 5.0+ (para lectura Excel)
- AES-256 via System.Security.Cryptography

### Configuraciones Esperadas
```json
{
  "Encryption": {
    "Key": "[256-bit hex key, 64 caracteres]"
  },
  "Smtp": {
    "Host": "smtp.upc.pe",
    "Port": 587,
    "Username": "notificaciones@upc.pe",
    "Password": "[secret]",
    "EnableSsl": true
  },
  "Cache": {
    "RedisConnection": "[redis-host:6379]",
    "DefaultExpirationMinutes": 30
  }
}
```

### Dependencias Externas
- SQL Server SMTP
- Redis (para caching distribuido)
- EPPlus NuGet (para Excel)
- Entity Framework Core

---

## VERSIÓN Y HISTORIAL

**v1.0** (2025-05-16)
- Análisis quirúrgico completo
- 3 documentos: PARTE 1, PARTE 2, PARTE 3
- Cobertura: Endpoints, Tablas, Transacciones, Validaciones, Seguridad, Performance

**Próximas Versiones** (Planeadas)
- v1.1: Agregar ejemplos de unit tests
- v1.2: Agregar ejemplos de integration tests
- v1.3: Agregar benchmarks de performance
- v1.4: Agregar diagramas de red/infraestructura

---

**FIN DEL ÍNDICE MAESTRO**

Para acceder a contenido específico, consulte los 3 documentos:
1. **ANALISIS_QUIRURGICO_ENCUESTAS.md** - Arquitectura y Endpoints
2. **ANALISIS_QUIRURGICO_ENCUESTAS_PARTE2.md** - Persistencia y Transacciones
3. **ANALISIS_QUIRURGICO_ENCUESTAS_PARTE3.md** - Validaciones, Seguridad, Performance
