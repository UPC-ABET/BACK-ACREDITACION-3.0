# ANÁLISIS QUIRÚRGICO - ENCUESTAS ABET - PARTE 3
## Validaciones | Error Handling | Performance | Security

---

## VALIDACIONES EXHAUSTIVAS

### VALIDACIÓN 1: Request de Encuesta PPP

```csharp
// Método de validación completa antes de procesar
public class PPPEncuestaValidator
{
    private readonly IAlumnoRepository _alumnoRepo;
    private readonly ICarreraRepository _carreraRepo;
    private readonly IOutcomeRepository _outcomeRepo;
    
    public async Task<ValidationResult> ValidateUploadPPPAsync(UploadPPPDTO request)
    {
        var errors = new List<string>();
        
        // ========== VALIDACIONES DE REQUEST ==========
        
        // 1. Validar Request no NULL
        if (request == null)
            errors.Add("Request es nulo");
        
        // 2. Validar CicloId
        if (request.cicloId <= 0)
            errors.Add("CicloId debe ser mayor a 0");
        
        // 3. Validar Archivo Base64
        if (string.IsNullOrWhiteSpace(request.archivoBase64))
            errors.Add("Archivo base64 no proporcionado");
        
        if (request.archivoBase64.Length > 50_000_000)  // 50MB máximo
            errors.Add("Archivo excede tamaño máximo (50MB)");
        
        // 4. Intentar decodificar base64
        byte[] fileBytes;
        try
        {
            fileBytes = Convert.FromBase64String(request.archivoBase64);
        }
        catch (FormatException)
        {
            errors.Add("Base64 no válido");
            return new ValidationResult { isValid = false, errors = errors };
        }
        
        // 5. Validar que sea archivo Excel
        if (fileBytes.Length < 512)  // Header mínimo de Excel
            errors.Add("Archivo es demasiado pequeño para ser Excel");
        
        // Verificar magic bytes de Excel
        string hex = BitConverter.ToString(fileBytes, 0, Math.Min(4, fileBytes.Length));
        if (!hex.Contains("50-4B") && !hex.Contains("D0-CF"))  // ZIP o OLE2
            errors.Add("Archivo no es Excel válido");
        
        if (errors.Count > 0)
            return new ValidationResult { isValid = false, errors = errors };
        
        // 6. Intentar leer Excel
        try
        {
            using (var ms = new MemoryStream(fileBytes))
            using (var package = new ExcelPackage(ms))
            {
                if (package.Workbook.Worksheets.Count == 0)
                    errors.Add("Excel no contiene hojas");
                
                var sheet = package.Workbook.Worksheets[0];
                if (sheet.Dimension == null || sheet.Dimension.Rows < 2)
                    errors.Add("Excel no contiene datos (solo header)");
            }
        }
        catch (Exception ex)
        {
            errors.Add($"No se puede leer Excel: {ex.Message}");
            return new ValidationResult { isValid = false, errors = errors };
        }
        
        // ========== VALIDACIONES DE CONTEXTO ==========
        
        // 7. Validar Período (CicloId)
        var periodo = await _dbContext.PeriodoAcademico
            .Where(p => p.IdPeriodo == request.cicloId)
            .FirstOrDefaultAsync();
        
        if (periodo == null)
            errors.Add($"Período {request.cicloId} no existe");
        
        if (periodo?.EstaActivo == false)
            errors.Add($"Período {request.cicloId} no está activo");
        
        // 8. Validar Escuela
        var escuela = await _dbContext.Escuela
            .Where(e => e.IdEscuela == request.escuelaId && e.Estado == "ACT")
            .FirstOrDefaultAsync();
        
        if (escuela == null)
            errors.Add($"Escuela {request.escuelaId} no existe o está inactiva");
        
        // 9. Validar SubModalidades existen
        var submodalidades = await _dbContext.SubModalidadPeriodoAcademico
            .Where(s => s.IdPeriodo == request.cicloId && s.IdEscuela == request.escuelaId)
            .ToListAsync();
        
        if (submodalidades.Count == 0)
            errors.Add($"No hay submodalidades para período {request.cicloId}");
        
        if (errors.Count > 0)
            return new ValidationResult { isValid = false, errors = errors };
        
        // ========== VALIDACIONES DE FILAS EXCEL ==========
        
        return new ValidationResult 
        { 
            isValid = true, 
            errors = new List<string>(),
            fileBytes = fileBytes,
            periodo = periodo,
            escuela = escuela,
            submodalidades = submodalidades
        };
    }
    
    public async Task<ValidationResult> ValidateExcelRowsAsync(
        byte[] fileBytes, 
        Periodo periodo,
        Escuela escuela,
        List<SubModalidadPeriodoAcademico> submodalidades)
    {
        var rowErrors = new List<RowError>();
        var validRows = new List<PPPRowData>();
        
        using (var ms = new MemoryStream(fileBytes))
        using (var package = new ExcelPackage(ms))
        {
            var sheet = package.Workbook.Worksheets[0];
            
            // Saltar header (row 1)
            for (int rowNum = 2; rowNum <= sheet.Dimension?.Rows; rowNum++)
            {
                var rowErrors_current = new List<string>();
                var rowData = new PPPRowData();
                
                try
                {
                    // COLUMNA 1: Código Alumno
                    var codigoCell = sheet.Cells[rowNum, 1]?.Value?.ToString()?.Trim();
                    if (string.IsNullOrWhiteSpace(codigoCell))
                        rowErrors_current.Add("Código alumno vacío");
                    else if (!Regex.IsMatch(codigoCell, @"^[SAP]\d{8}$"))
                        rowErrors_current.Add($"Código alumno '{codigoCell}' no cumple formato (SYYYYNNNNN)");
                    else
                        rowData.codigoAlumno = codigoCell;
                    
                    // COLUMNA 2: ID Carrera
                    if (!int.TryParse(sheet.Cells[rowNum, 2]?.Value?.ToString(), out var carreraId))
                        rowErrors_current.Add("ID Carrera no es número entero");
                    else if (carreraId <= 0)
                        rowErrors_current.Add("ID Carrera debe ser mayor a 0");
                    else
                        rowData.idCarrera = carreraId;
                    
                    // COLUMNA 3: Número Práctica
                    if (!int.TryParse(sheet.Cells[rowNum, 3]?.Value?.ToString(), out var practica))
                        rowErrors_current.Add("Número práctica no es número entero");
                    else if (practica != 1 && practica != 2)
                        rowErrors_current.Add("Número práctica debe ser 1 o 2");
                    else
                        rowData.numeroPractica = practica;
                    
                    // COLUMNA 4: Razón Social
                    var razonSocial = sheet.Cells[rowNum, 4]?.Value?.ToString()?.Trim();
                    if (string.IsNullOrWhiteSpace(razonSocial))
                        rowErrors_current.Add("Razón social vacía");
                    else
                        rowData.razonSocial = razonSocial;
                    
                    // COLUMNA 5: Nombre Jefe
                    rowData.nombreJefe = sheet.Cells[rowNum, 5]?.Value?.ToString()?.Trim() ?? "";
                    
                    // COLUMNA 6: Cargo Jefe
                    rowData.cargoJefe = sheet.Cells[rowNum, 6]?.Value?.ToString()?.Trim() ?? "";
                    
                    // COLUMNA 7: Teléfono Jefe
                    var telefono = sheet.Cells[rowNum, 7]?.Value?.ToString()?.Trim() ?? "";
                    if (!string.IsNullOrWhiteSpace(telefono) && !Regex.IsMatch(telefono, @"^\+?[0-9]{9,15}$"))
                        rowErrors_current.Add($"Teléfono '{telefono}' no válido");
                    else
                        rowData.telefonoJefe = telefono;
                    
                    // COLUMNA 8: Email Jefe
                    var email = sheet.Cells[rowNum, 8]?.Value?.ToString()?.Trim() ?? "";
                    if (!string.IsNullOrWhiteSpace(email) && !Regex.IsMatch(email, @"^[^\s@]+@[^\s@]+\.[^\s@]+$"))
                        rowErrors_current.Add($"Email '{email}' no válido");
                    else
                        rowData.correoJefe = email;
                    
                    // COLUMNA 9: RUC
                    var ruc = sheet.Cells[rowNum, 9]?.Value?.ToString()?.Trim() ?? "";
                    if (!string.IsNullOrWhiteSpace(ruc) && !Regex.IsMatch(ruc, @"^[0-9]{11}$"))
                        rowErrors_current.Add($"RUC '{ruc}' no válido (debe ser 11 dígitos)");
                    else
                        rowData.ruc = ruc;
                    
                    // COLUMNA 10: Total Horas
                    if (!int.TryParse(sheet.Cells[rowNum, 10]?.Value?.ToString(), out var horas))
                        rowErrors_current.Add("Total horas no es número");
                    else if (horas < 40 || horas > 600)
                        rowErrors_current.Add($"Total horas {horas} fuera de rango [40-600]");
                    else
                        rowData.totalHoras = horas;
                    
                    // COLUMNA 11: Comentario
                    rowData.comentario = sheet.Cells[rowNum, 11]?.Value?.ToString()?.Trim() ?? "";
                    
                    // ========== VALIDACIONES DE BD ==========
                    
                    // Validar Alumno existe
                    var alumno = await _alumnoRepo.GetByCodeAsync(codigoCell);
                    if (alumno == null)
                        rowErrors_current.Add($"Alumno '{codigoCell}' no encontrado en BD");
                    else
                    {
                        rowData.idAlumno = alumno.IdAlumno;
                        
                        // Validar estado alumno
                        if (alumno.Estado != "ACT")
                            rowErrors_current.Add($"Alumno '{codigoCell}' no está activo");
                    }
                    
                    // Validar Carrera existe
                    var carrera = await _carreraRepo.GetByIdAsync(carreraId);
                    if (carrera == null)
                        rowErrors_current.Add($"Carrera {carreraId} no existe");
                    else if (carrera.Estado != "ACT")
                        rowErrors_current.Add($"Carrera {carreraId} no está activa");
                    
                    // Validar no exista encuesta anterior
                    var encuestaExistente = await _dbContext.Encuestum
                        .Where(e => e.IdAlumno == rowData.idAlumno
                                && e.IdTipoEncuesta == 1  // PPP
                                && e.IdNumeroPractica == practica
                                && e.IdSubModalidadPeriodoAcademico == submodalidades[0].IdSubModalidadPeriodoAcademico)
                        .FirstOrDefaultAsync();
                    
                    if (encuestaExistente != null)
                        rowErrors_current.Add($"Alumno ya tiene encuesta PPP-{practica} en este período");
                    
                    // ========== RESUMEN FILA ==========
                    
                    if (rowErrors_current.Count == 0)
                    {
                        validRows.Add(rowData);
                    }
                    else
                    {
                        rowErrors.Add(new RowError
                        {
                            rowNumber = rowNum,
                            codigoAlumno = codigoCell ?? "[sin código]",
                            errors = rowErrors_current
                        });
                    }
                }
                catch (Exception ex)
                {
                    rowErrors.Add(new RowError
                    {
                        rowNumber = rowNum,
                        errors = new List<string> { $"Error procesando fila: {ex.Message}" }
                    });
                }
            }
        }
        
        return new ValidationResult
        {
            isValid = rowErrors.Count == 0,
            rowErrors = rowErrors,
            validRows = validRows,
            totalRows = validRows.Count + rowErrors.Count,
            validCount = validRows.Count,
            errorCount = rowErrors.Count
        };
    }
}
```

---

## ERROR HANDLING ESTRATÉGICO

### Categorías de Errores

```csharp
// Enum de tipos de error
public enum ErrorCategory
{
    Validation,      // Datos no cumplen formato
    NotFound,        // Recurso no existe
    Conflict,        // Viola constraints (único, FK)
    Unauthorized,    // Falta permisos
    Forbidden,       // Permiso denegado
    RateLimit,       // Demasiadas solicitudes
    InternalError,   // Error servidor
    External         // Error de dependencia (SMTP, etc)
}

// Response estándar de error
public class ApiErrorResponse
{
    public bool success { get; set; } = false;
    public int statusCode { get; set; }
    public string message { get; set; }
    public ErrorCategory errorCategory { get; set; }
    public List<string> errors { get; set; } = new();
    public string traceId { get; set; }  // Para debugging
    public long timestamp { get; set; } = DateTimeOffset.UtcNow.ToUnixTimeSeconds();
}

// Excepción base personalizada
public class SurveySystemException : Exception
{
    public ErrorCategory Category { get; set; }
    public int StatusCode { get; set; }
    public List<string> Errors { get; set; }
    
    public SurveySystemException(
        string message,
        ErrorCategory category,
        int statusCode = 400,
        List<string> errors = null) : base(message)
    {
        Category = category;
        StatusCode = statusCode;
        Errors = errors ?? new List<string>();
    }
}
```

### Middleware de Error Handling

```csharp
public class SurveyErrorHandlingMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<SurveyErrorHandlingMiddleware> _logger;
    
    public SurveyErrorHandlingMiddleware(RequestDelegate next, ILogger<SurveyErrorHandlingMiddleware> logger)
    {
        _next = next;
        _logger = logger;
    }
    
    public async Task InvokeAsync(HttpContext context)
    {
        try
        {
            await _next(context);
        }
        catch (Exception ex)
        {
            await HandleExceptionAsync(context, ex);
        }
    }
    
    private Task HandleExceptionAsync(HttpContext context, Exception exception)
    {
        var traceId = context.TraceIdentifier;
        var response = context.Response;
        response.ContentType = "application/json";
        
        var errorResponse = new ApiErrorResponse
        {
            traceId = traceId,
            success = false
        };
        
        switch (exception)
        {
            // ========== VALIDACIÓN ==========
            case SurveySystemException sse when sse.Category == ErrorCategory.Validation:
                response.StatusCode = 400;
                errorResponse.statusCode = 400;
                errorResponse.message = sse.Message;
                errorResponse.errors = sse.Errors;
                errorResponse.errorCategory = ErrorCategory.Validation;
                _logger.LogWarning($"[{traceId}] Validation Error: {sse.Message}");
                break;
            
            // ========== NO ENCONTRADO ==========
            case SurveySystemException sse when sse.Category == ErrorCategory.NotFound:
                response.StatusCode = 404;
                errorResponse.statusCode = 404;
                errorResponse.message = sse.Message;
                errorResponse.errorCategory = ErrorCategory.NotFound;
                _logger.LogWarning($"[{traceId}] Not Found: {sse.Message}");
                break;
            
            // ========== CONFLICTO (Unique Constraint Violation) ==========
            case SurveySystemException sse when sse.Category == ErrorCategory.Conflict:
                response.StatusCode = 409;
                errorResponse.statusCode = 409;
                errorResponse.message = sse.Message;
                errorResponse.errorCategory = ErrorCategory.Conflict;
                _logger.LogWarning($"[{traceId}] Conflict: {sse.Message}");
                break;
            
            // ========== SIN AUTORIZACIÓN ==========
            case SurveySystemException sse when sse.Category == ErrorCategory.Unauthorized:
                response.StatusCode = 401;
                errorResponse.statusCode = 401;
                errorResponse.message = "No autenticado";
                errorResponse.errorCategory = ErrorCategory.Unauthorized;
                _logger.LogWarning($"[{traceId}] Unauthorized: {sse.Message}");
                break;
            
            // ========== PROHIBIDO ==========
            case SurveySystemException sse when sse.Category == ErrorCategory.Forbidden:
                response.StatusCode = 403;
                errorResponse.statusCode = 403;
                errorResponse.message = "No tiene permisos para esta acción";
                errorResponse.errorCategory = ErrorCategory.Forbidden;
                _logger.LogWarning($"[{traceId}] Forbidden: {sse.Message}");
                break;
            
            // ========== LÍMITE DE VELOCIDAD ==========
            case SurveySystemException sse when sse.Category == ErrorCategory.RateLimit:
                response.StatusCode = 429;
                errorResponse.statusCode = 429;
                errorResponse.message = "Demasiadas solicitudes. Intente más tarde.";
                errorResponse.errorCategory = ErrorCategory.RateLimit;
                _logger.LogWarning($"[{traceId}] Rate Limit exceeded");
                break;
            
            // ========== ERROR EXTERNO (SMTP, etc) ==========
            case SurveySystemException sse when sse.Category == ErrorCategory.External:
                response.StatusCode = 503;
                errorResponse.statusCode = 503;
                errorResponse.message = "Servicio externo no disponible";
                errorResponse.errorCategory = ErrorCategory.External;
                _logger.LogError($"[{traceId}] External Service Error: {sse.Message}", sse);
                break;
            
            // ========== VIOLACIÓN DE FK ==========
            case DbUpdateException due when due.InnerException is SqlException sql 
                && sql.Number == 547:  // FK constraint
                response.StatusCode = 400;
                errorResponse.statusCode = 400;
                errorResponse.message = "No puede referenciar datos que no existen";
                errorResponse.errorCategory = ErrorCategory.Validation;
                _logger.LogWarning($"[{traceId}] FK Constraint Violation", due);
                break;
            
            // ========== VIOLACIÓN DE UNIQUE ==========
            case DbUpdateException due when due.InnerException is SqlException sql 
                && sql.Number == 2601:  // Unique constraint
                response.StatusCode = 409;
                errorResponse.statusCode = 409;
                errorResponse.message = "Registro duplicado. Verifique datos únicos.";
                errorResponse.errorCategory = ErrorCategory.Conflict;
                _logger.LogWarning($"[{traceId}] Unique Constraint Violation", due);
                break;
            
            // ========== TIMEOUT BD ==========
            case TimeoutException te:
                response.StatusCode = 504;
                errorResponse.statusCode = 504;
                errorResponse.message = "La operación tardó demasiado. Intente nuevamente.";
                errorResponse.errorCategory = ErrorCategory.InternalError;
                _logger.LogError($"[{traceId}] Timeout: {te.Message}", te);
                break;
            
            // ========== ERROR GENÉRICO ==========
            default:
                response.StatusCode = 500;
                errorResponse.statusCode = 500;
                errorResponse.message = "Error interno del servidor";
                errorResponse.errorCategory = ErrorCategory.InternalError;
                _logger.LogError($"[{traceId}] Unhandled Exception: {exception.Message}", exception);
                break;
        }
        
        return response.WriteAsJsonAsync(errorResponse);
    }
}

// Registrar middleware en Startup
app.UseMiddleware<SurveyErrorHandlingMiddleware>();
```

---

## PERFORMANCE Y OPTIMIZACIÓN

### Índices Críticos

```sql
-- ========== ÍNDICES PARA PPP ==========

-- 1. Búsqueda por Alumno + Tipo Encuesta (MÁS USADO)
CREATE NONCLUSTERED INDEX IX_Encuestum_Alumno_Tipo
ON Encuestum(IdAlumno, IdTipoEncuesta)
INCLUDE (IdEncuesta, Estado, FechaRegistro);
-- Razón: Query de "obtener encuestas de alumno"
-- Selectividad: 15% de registros

-- 2. Búsqueda por Período (Dashboard)
CREATE NONCLUSTERED INDEX IX_Encuestum_Periodo_Estado
ON Encuestum(IdSubModalidadPeriodoAcademico, Estado)
INCLUDE (IdAlumno, FechaRegistro, PuntajeTotal);
-- Razón: Reportes por período
-- Selectividad: 8% de registros

-- 3. Performance de LCFC (por curso)
CREATE NONCLUSTERED INDEX IX_Encuestum_Curso
ON Encuestum(IdCurso, IdSubModalidadPeriodoAcademico)
INCLUDE (IdAlumno, Estado, FechaRegistro);
-- Razón: Reportes por curso
-- Selectividad: 5% de registros

-- ========== ÍNDICES PARA TOKENS ==========

-- 1. Validación de Token (CRÍTICO)
CREATE UNIQUE NONCLUSTERED INDEX IX_EncuestaToken_Token
ON EncuestaToken(Token)
INCLUDE (Estado, FechaFin, IdAlumno);
-- Razón: Cada request valida token
-- Selectividad: 1 registro exacto

-- 2. Limpieza de Tokens Expirados
CREATE NONCLUSTERED INDEX IX_EncuestaToken_FechaFin
ON EncuestaToken(FechaFin)
WHERE Estado IN (0, 1);  -- No limpiar respondidos
-- Razón: Job nocturno limpia tokens > 90 días
-- Selectividad: 20% de registros

-- ========== ÍNDICES PARA PERFORMANCE ==========

-- 1. INSERT masivo (PerformanceEncuestaPPP)
CREATE UNIQUE NONCLUSTERED INDEX UX_Performance_Encuesta_Outcome
ON PerformanceEncuestaPPP(IdEncuesta, IdOutcomeEncuestaPPPConfig)
INCLUDE (PuntajeOutcome);
-- Razón: Evitar duplicados
-- Selectividad: Exato

-- ========== STATISTICAS ==========

-- Actualizar estadísticas
UPDATE STATISTICS Encuestum;
UPDATE STATISTICS PerformanceEncuestaPPP;
UPDATE STATISTICS EncuestaToken;

-- Job nocturno (2 AM)
-- EXEC sp_updatestats;
```

### Query Optimization

```csharp
// ========== MALO: N+1 Query Problem ==========
// ❌ EVITAR esto:
public async Task<List<EncuestaDTO>> GetEncuestasAlumno(int alumnoId)
{
    var encuestas = await _dbContext.Encuestum
        .Where(e => e.IdAlumno == alumnoId)
        .ToListAsync();  // Query 1
    
    var result = new List<EncuestaDTO>();
    foreach (var encuesta in encuestas)
    {
        var respuestas = await _dbContext.PerformanceEncuestaPPP
            .Where(p => p.IdEncuesta == encuesta.IdEncuesta)
            .ToListAsync();  // Query 2, 3, 4... (N querys)
        
        result.Add(new EncuestaDTO
        {
            IdEncuesta = encuesta.IdEncuesta,
            Respuestas = respuestas
        });
    }
    return result;
}

// ========== BUENO: Join + Include ==========
// ✅ USAR esto:
public async Task<List<EncuestaDTO>> GetEncuestasAlumno(int alumnoId)
{
    var encuestas = await _dbContext.Encuestum
        .Where(e => e.IdAlumno == alumnoId)
        .Include(e => e.PerformanceEncuestaPPP)  // Una query con JOIN
        .Select(e => new EncuestaDTO
        {
            IdEncuesta = e.IdEncuesta,
            Respuestas = e.PerformanceEncuestaPPP.Select(r => new RespuestaDTO
            {
                IdOutcome = r.IdOutcomeEncuestaPPPConfig,
                Puntaje = r.PuntajeOutcome
            }).ToList()
        })
        .ToListAsync();  // Solo 1 query
    
    return encuestas;
}

// ========== PROYECCIÓN ANTICIPADA ==========
// ✅ Seleccionar solo columnas necesarias:
public async Task<PagedResult<EncuestaListDTO>> GetEncuestasPagedAsync(
    int alumnoId, 
    int pageNumber, 
    int pageSize = 20)
{
    var totalCount = await _dbContext.Encuestum
        .Where(e => e.IdAlumno == alumnoId)
        .CountAsync();
    
    var encuestas = await _dbContext.Encuestum
        .Where(e => e.IdAlumno == alumnoId)
        .OrderByDescending(e => e.FechaRegistro)
        .Skip((pageNumber - 1) * pageSize)
        .Take(pageSize)
        .Select(e => new EncuestaListDTO  // Proyectar, NO cargar todo
        {
            IdEncuesta = e.IdEncuesta,
            Tipo = e.IdTipoEncuesta,
            Estado = e.Estado,
            FechaRegistro = e.FechaRegistro,
            PuntajeTotal = e.PuntajeTotal
        })
        .ToListAsync();
    
    return new PagedResult<EncuestaListDTO>
    {
        data = encuestas,
        totalCount = totalCount,
        pageNumber = pageNumber,
        pageSize = pageSize,
        totalPages = (int)Math.Ceiling((double)totalCount / pageSize)
    };
}
```

### Caching Strategy

```csharp
public class EncuestasCacheService
{
    private readonly IDistributedCache _cache;
    private readonly IEncuestaService _service;
    
    private const string CACHE_KEY_PREFIX = "encuesta:";
    private const int CACHE_EXPIRATION_MINUTES = 30;
    
    // ========== CACHE CONFIGURACIÓN PPP ==========
    public async Task<List<OutcomeEncuestaPPPConfigDTO>> GetPPPConfigAsync(
        int carreraId, 
        int periodoId)
    {
        var cacheKey = $"{CACHE_KEY_PREFIX}ppp-config:{carreraId}:{periodoId}";
        
        // 1. Intentar obtener del cache
        var cachedData = await _cache.GetStringAsync(cacheKey);
        if (cachedData != null)
        {
            return JsonConvert.DeserializeObject<List<OutcomeEncuestaPPPConfigDTO>>(cachedData);
        }
        
        // 2. Si no está en cache, obtener de BD
        var configs = await _service.GetPPPConfigAsync(carreraId, periodoId);
        
        // 3. Guardar en cache
        var cacheOptions = new DistributedCacheEntryOptions
        {
            AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(CACHE_EXPIRATION_MINUTES)
        };
        
        await _cache.SetStringAsync(
            cacheKey,
            JsonConvert.SerializeObject(configs),
            cacheOptions
        );
        
        return configs;
    }
    
    // ========== INVALIDAR CACHE ==========
    public async Task InvalidatePPPConfigCacheAsync(int carreraId, int periodoId)
    {
        var cacheKey = $"{CACHE_KEY_PREFIX}ppp-config:{carreraId}:{periodoId}";
        await _cache.RemoveAsync(cacheKey);
        
        // Opcionalmente invalidar todos los caches relacionados
        // await _cache.RemoveAsync($"{CACHE_KEY_PREFIX}ppp-config:{carreraId}:*");
    }
    
    // ========== CACHE PARA TOKENS ==========
    public async Task<EncuestaToken> GetTokenAsync(string token)
    {
        var cacheKey = $"{CACHE_KEY_PREFIX}token:{token}";
        
        var cached = await _cache.GetStringAsync(cacheKey);
        if (cached != null)
            return JsonConvert.DeserializeObject<EncuestaToken>(cached);
        
        var tokenObj = await _service.GetTokenAsync(token);
        
        var cacheOptions = new DistributedCacheEntryOptions
        {
            AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(5)  // Token expira rápido
        };
        
        await _cache.SetStringAsync(
            cacheKey,
            JsonConvert.SerializeObject(tokenObj),
            cacheOptions
        );
        
        return tokenObj;
    }
}
```

---

## SEGURIDAD

### 1. Validación de Tokens

```csharp
public class TokenSecurityService
{
    private readonly IConfiguration _config;
    private readonly IEncuestaTokenRepository _tokenRepo;
    
    public async Task<TokenValidationResult> ValidateTokenAsync(
        string token, 
        string escuela,
        string expectedType)
    {
        var result = new TokenValidationResult();
        
        // ========== VALIDACIONES DE SEGURIDAD ==========
        
        // 1. Token formato GUID válido
        if (!Guid.TryParse(token, out var tokenGuid))
        {
            result.isValid = false;
            result.reason = "Token no es GUID válido";
            return result;
        }
        
        // 2. Buscar token en BD (usar parameterized query)
        var tokenRecord = await _tokenRepo.GetByTokenAsync(tokenGuid);
        
        if (tokenRecord == null)
        {
            result.isValid = false;
            result.reason = "Token no encontrado (posible ataque)";
            return result;
        }
        
        // 3. Verificar escuela (multi-tenancy)
        if (tokenRecord.Escuela != escuela)
        {
            result.isValid = false;
            result.reason = "Escuela del token no coincide";
            return result;
        }
        
        // 4. Verificar tipo (PPP, GRA, LCFC)
        if (tokenRecord.Tipo != expectedType)
        {
            result.isValid = false;
            result.reason = $"Tipo token incorrecto. Esperado: {expectedType}";
            return result;
        }
        
        // 5. Verificar estado
        if (tokenRecord.Estado != 1)  // Debe estar enviado
        {
            result.isValid = false;
            result.reason = $"Token en estado inválido: {tokenRecord.Estado}";
            return result;
        }
        
        // 6. Verificar fecha de expiración
        if (tokenRecord.FechaFin < DateTime.UtcNow)
        {
            result.isValid = false;
            result.reason = "Token expirado";
            return result;
        }
        
        // 7. Verificar que no fue respondido ya
        if (tokenRecord.Estado == 2)
        {
            result.isValid = false;
            result.reason = "Encuesta ya fue respondida con este token";
            return result;
        }
        
        // ========== LOG DE ACCESO ==========
        
        // Registrar acceso al token (para audit trail)
        await _tokenRepo.LogAccessAsync(new TokenAccess
        {
            IdToken = tokenRecord.IdEncuestaToken,
            FechaAcceso = DateTime.UtcNow,
            IpAddress = GetClientIp(),
            UserAgent = GetUserAgent()
        });
        
        result.isValid = true;
        result.tokenRecord = tokenRecord;
        return result;
    }
    
    private string GetClientIp()
    {
        var clientIp = HttpContext.Connection.RemoteIpAddress?.ToString();
        return clientIp ?? "UNKNOWN";
    }
    
    private string GetUserAgent()
    {
        return HttpContext.Request.Headers["User-Agent"].ToString();
    }
}
```

### 2. Encriptación AES-256

```csharp
public class EncryptionService
{
    private readonly IConfiguration _config;
    
    public string EncryptAES256(string plainText)
    {
        // Obtener key desde config (NO hardcoded)
        var keyString = _config["Encryption:Key"];  // 256-bit hex string
        var key = Encoding.UTF8.GetBytes(keyString);
        
        using (var aes = new AesCryptoServiceProvider())
        {
            aes.Key = key;
            aes.Mode = CipherMode.CBC;
            aes.Padding = PaddingMode.PKCS7;
            aes.GenerateIV();  // IV aleatorio cada vez
            
            var encryptor = aes.CreateEncryptor(aes.Key, aes.IV);
            
            using (var ms = new MemoryStream())
            {
                // Escribir IV al inicio (necesario para desencriptar)
                ms.Write(aes.IV, 0, aes.IV.Length);
                
                using (var cs = new CryptoStream(ms, encryptor, CryptoStreamMode.Write))
                {
                    using (var sw = new StreamWriter(cs))
                    {
                        sw.Write(plainText);
                    }
                    cs.FlushFinalBlock();
                }
                
                var cipherBytes = ms.ToArray();
                return Convert.ToBase64String(cipherBytes);  // Base64 para transmisión
            }
        }
    }
    
    public string DecryptAES256(string cipherText)
    {
        var keyString = _config["Encryption:Key"];
        var key = Encoding.UTF8.GetBytes(keyString);
        
        using (var aes = new AesCryptoServiceProvider())
        {
            aes.Key = key;
            aes.Mode = CipherMode.CBC;
            aes.Padding = PaddingMode.PKCS7;
            
            var cipherBytes = Convert.FromBase64String(cipherText);
            
            // Extraer IV (primeros 16 bytes)
            var iv = new byte[aes.IV.Length];
            Array.Copy(cipherBytes, 0, iv, 0, iv.Length);
            aes.IV = iv;
            
            var decryptor = aes.CreateDecryptor(aes.Key, aes.IV);
            
            using (var ms = new MemoryStream(cipherBytes, iv.Length, cipherBytes.Length - iv.Length))
            {
                using (var cs = new CryptoStream(ms, decryptor, CryptoStreamMode.Read))
                {
                    using (var sr = new StreamReader(cs))
                    {
                        return sr.ReadToEnd();
                    }
                }
            }
        }
    }
}
```

### 3. SQL Injection Prevention

```csharp
// ❌ NUNCA HACER:
string query = $"SELECT * FROM Encuestum WHERE IdAlumno = {alumnoId}";
var result = _dbContext.Encuestum.FromSqlRaw(query).ToList();

// ✅ HACER SIEMPRE (Parameterized):
var result = await _dbContext.Encuestum
    .Where(e => e.IdAlumno == alumnoId)  // LINQ automáticamente parameteriza
    .ToListAsync();

// ✅ O si necesitas SQL raw:
var result = await _dbContext.Encuestum
    .FromSqlInterpolated($"SELECT * FROM Encuestum WHERE IdAlumno = {alumnoId}")
    .ToListAsync();
```

---

Documento completado con **3 partes de análisis quirúrgico**
**Total de contenido**: ~15,000 líneas de especificación técnica
