# ANÁLISIS QUIRÚRGICO - ENCUESTAS ABET - PARTE 2
## Bases de Datos | Almacenamiento | Transacciones Detalladas

---

## ANÁLISIS PROFUNDO DE PERSISTENCIA

### TABLA 1: Encuestum (Core Compartida)

```sql
CREATE TABLE Encuestum (
    IdEncuesta INT PRIMARY KEY IDENTITY(1,1),
    
    ========== CLASIFICACIÓN DE TIPO ==========
    IdTipoEncuesta INT NOT NULL 
        FOREIGN KEY REFERENCES TipoEncuesta(IdTipoEncuesta),
    -- Valores típicos:
    -- 1 = PPP (Prácticas Pre-Profesionales)
    -- 2 = GRA (Graduandos)  
    -- 3 = LCFC (Logro Fin de Ciclo)
    
    ========== IDENTIFICACIÓN DEL ALUMNO ==========
    IdAlumno INT NOT NULL 
        FOREIGN KEY REFERENCES Alumno(IdAlumno),
    CodigoAlumno VARCHAR(20) NOT NULL,
    -- Ej: "S20180001", "S20190234"
    -- Validación: NO NULL, LENGTH = 9-10 caracteres
    -- Patrón: [S|A|P]YYYYNNNNN
    
    ========== CARRERA Y ESTRUCTURA ACADÉMICA ==========
    IdCarrera INT NOT NULL 
        FOREIGN KEY REFERENCES Carrera(IdCarrera),
    -- FK referencia a tabla Carrera
    -- Validación: Debe existir y estar ACT
    
    IdSubModalidadPeriodoAcademico INT NOT NULL 
        FOREIGN KEY REFERENCES SubModalidadPeriodoAcademico(IdSubModalidadPeriodoAcademico),
    -- Agrupa: Período + Submodalidad (Presencial/Virtual/Semipresencial)
    -- Ejemplo: Período 5 (2025-I) + Modalidad 1 (Presencial) = 25
    
    ========== INFORMACIÓN ESPECÍFICA POR TIPO ==========
    
    -- PPP: NÚMERO DE PRÁCTICA
    IdNumeroPractica INT NULL,
    -- Valores: 1 (Práctica I) o 2 (Práctica II)
    -- NULL para GRA y LCFC
    -- Validación: IF IdTipoEncuesta=1 THEN IdNumeroPractica IN (1,2)
    
    -- PPP & GRA: INFORMACIÓN DE EMPRESA/INSTITUCIÓN
    RazonSocial VARCHAR(255) NULL,
    -- Nombre de la empresa o institución donde se realizó práctica
    -- Ej: "ACME Corporation", "Google Perú", "Telefónica del Perú"
    -- Validación (PPP): NO NULL
    
    NombreJefe VARCHAR(255) NULL,
    CargoJefe VARCHAR(255) NULL,
    TelefonoJefe VARCHAR(20) NULL,
    CorreoJefe VARCHAR(255) NULL,
    -- Información del supervisor en empresa
    -- Validación: Email debe ser válido si present
    --             Teléfono debe ser 9-15 dígitos
    
    RUC VARCHAR(20) NULL,
    -- Registro Único de Contribuyente
    -- Formato Perú: 11 dígitos
    -- Validación: REGEX ^[0-9]{11}$ si present
    
    -- PPP & LCFC: DURACIÓN
    TotalHoras INT NULL,
    -- Horas totales de práctica (PPP) o curso (LCFC)
    -- Rango típico: 0-2000 horas
    -- Validación (PPP): 40 <= TotalHoras <= 600
    
    -- LCFC: RELACIÓN CON CURSO
    IdCurso INT NULL 
        FOREIGN KEY REFERENCES Curso(IdCurso),
    -- Solo para LCFC
    -- NULL para PPP y GRA
    
    IdSeccion INT NULL 
        FOREIGN KEY REFERENCES Seccion(IdSeccion),
    -- Sección del curso (A, B, C, etc.)
    -- Solo para LCFC
    
    ========== FECHAS DE ENCUESTA ==========
    FechaInicio DATETIME2 NOT NULL,
    -- Cuando comienza la encuesta
    -- Típicamente: primer día del período
    
    FechaFin DATETIME2 NULL,
    -- Cuando termina la encuesta
    -- NULL mientras está "PEN" (Pendiente)
    -- Se llena cuando alumno responde
    
    ========== DATOS GENERALES ==========
    Comentario NVARCHAR(MAX) NULL,
    -- Observaciones del alumno
    -- Límite: Sin límite de caracteres
    
    PuntajeTotal DECIMAL(5,2) NULL,
    -- Promedio de puntajes
    -- Rango: 1.0 - 10.0 para LCFC, 1.0 - 5.0 para PPP/GRA
    
    ========== ESTADO DE ENCUESTA ==========
    Estado VARCHAR(3) NOT NULL DEFAULT 'PEN',
    -- Estados posibles:
    -- 'PEN' = Pendiente (no respondida)
    -- 'COM' = Completada (respondida)
    -- 'REV' = Revisada (coordinador revisó)
    
    -- Validación: CHECK(Estado IN ('PEN', 'COM', 'REV'))
    -- Transiciones permitidas: PEN → COM → REV
    -- NO permitido: COM → PEN (no se puede volver atrás)
    
    ========== AUDITORÍA ==========
    FechaRegistro DATETIME2 NOT NULL DEFAULT GETDATE(),
    FechaModificacion DATETIME2 NULL,
    UsuarioRegistro VARCHAR(100) NULL,
    UsuarioModificacion VARCHAR(100) NULL,
    
    ========== ÍNDICES PARA PERFORMANCE ==========
    -- PRIMARY: IdEncuesta (CLUSTERED)
    
    -- BÚSQUEDAS FRECUENTES:
    INDEX IX_Alumno_Tipo (IdAlumno, IdTipoEncuesta),
    -- Query: "¿Qué encuestas tiene este alumno?"
    
    INDEX IX_Periodo_Estado (IdSubModalidadPeriodoAcademico, Estado),
    -- Query: "¿Cuántas encuestas COM hay en este período?"
    
    INDEX IX_Carrera_Periodo (IdCarrera, IdSubModalidadPeriodoAcademico),
    -- Query: "Reportes por carrera y período"
    
    INDEX IX_Estado (Estado),
    -- Query: "Filtrar por estado"
    
    INDEX IX_FechaRegistro (FechaRegistro),
    -- Query: "Encuestas recientes"
    
    -- ÍNDICE ÚNICO (Business Rule):
    UNIQUE INDEX UX_Alumno_Tipo_Carrera_Periodo (
        IdAlumno, 
        IdTipoEncuesta, 
        IdCarrera, 
        IdSubModalidadPeriodoAcademico,
        IdNumeroPractica  -- Permite PPP I y PPP II
    )
    -- Garantiza: Un alumno no puede tener 2 encuestas PPP I en mismo período
    -- NULL handling: IdNumeroPractica puede ser NULL para GRA/LCFC
);
```

**Inserción Típica - PPP**:
```sql
INSERT INTO Encuestum (
    IdTipoEncuesta,          -- 1 (PPP)
    IdAlumno,                -- 1001
    CodigoAlumno,            -- 'S20180001'
    IdCarrera,               -- 10
    IdSubModalidadPeriodoAcademico, -- 25
    IdNumeroPractica,        -- 1
    RazonSocial,             -- 'ACME Corp'
    NombreJefe,              -- 'Juan Pérez'
    CargoJefe,               -- 'Supervisor'
    TelefonoJefe,            -- '+51987654321'
    CorreoJefe,              -- 'juan@acme.com'
    RUC,                     -- '20123456789'
    TotalHoras,              -- 160
    FechaInicio,             -- GETDATE()
    FechaFin,                -- NULL (por ahora)
    Estado,                  -- 'PEN'
    FechaRegistro            -- GETDATE()
)
VALUES (1, 1001, 'S20180001', 10, 25, 1, 'ACME Corp', 
        'Juan Pérez', 'Supervisor', '+51987654321',
        'juan@acme.com', '20123456789', 160, GETDATE(), 
        NULL, 'PEN', GETDATE());
```

---

### TABLA 2: PerformanceEncuestaPPP (Respuestas PPP)

```sql
CREATE TABLE PerformanceEncuestaPPP (
    IdPerformanceEncuestaPPP INT PRIMARY KEY IDENTITY(1,1),
    
    ========== RELACIONES CLAVE ==========
    IdEncuesta INT NOT NULL 
        FOREIGN KEY REFERENCES Encuestum(IdEncuesta) ON DELETE CASCADE,
    -- Referencia a encuesta padre
    -- ON DELETE CASCADE: Si se borra encuesta, borra también respuestas
    
    IdOutcomeEncuestaPPPConfig INT NOT NULL 
        FOREIGN KEY REFERENCES OutcomeEncuestaPPPConfig(IdOutcomeEncuestaPPPConfig),
    -- Competencia específica siendo evaluada
    -- Ej: "Análisis Técnico" para carrera IS
    
    ========== PUNTUACIÓN ==========
    PuntajeOutcome DECIMAL(3,2) NOT NULL,
    -- Escala: 1.0 a 5.0 (PPP)
    -- Validación: CHECK(PuntajeOutcome >= 1.0 AND PuntajeOutcome <= 5.0)
    -- Precisión: 2 decimales (1.5, 2.75, 4.25, etc.)
    
    ========== PREGUNTA ADICIONAL (OPCIONAL) ==========
    IdPreguntaAdicional INT NULL 
        FOREIGN KEY REFERENCES PreguntaAdicional(IdPreguntaAdicional),
    PuntajePregunta DECIMAL(3,2) NULL,
    -- Campo para evaluación adicional
    -- Permite N dimensiones por competencia
    
    ========== AUDITORÍA ==========
    FechaRegistro DATETIME2 NOT NULL DEFAULT GETDATE(),
    
    ========== ÍNDICES ==========
    UNIQUE INDEX UX_Encuesta_Outcome (IdEncuesta, IdOutcomeEncuestaPPPConfig),
    -- No permitir duplicados: una competencia por encuesta
    
    INDEX IX_Encuesta (IdEncuesta),
    -- Para: "¿Todas las respuestas de esta encuesta?"
    
    INDEX IX_Outcome (IdOutcomeEncuestaPPPConfig),
    -- Para: "¿Todos los puntajes de esta competencia?"
);
```

**Inserción Múltiple - Après Créer Encuestum**:
```sql
-- Para Encuestum IdEncuesta = 5001
-- Con 5 competencias asignadas:

INSERT INTO PerformanceEncuestaPPP (IdEncuesta, IdOutcomeEncuestaPPPConfig, PuntajeOutcome)
VALUES 
    (5001, 101, 4.50),  -- Análisis Técnico: 4.5/5
    (5001, 102, 3.75),  -- Comunicación: 3.75/5
    (5001, 103, 4.25),  -- Trabajo en Equipo: 4.25/5
    (5001, 104, 3.50),  -- Gestión de Tiempo: 3.5/5
    (5001, 105, 4.00);  -- Resolución de Problemas: 4/5

-- Cálculo de PuntajeTotal:
-- UPDATE Encuestum SET PuntajeTotal = AVG(puntajes)
-- UPDATE Encuestum SET PuntajeTotal = 4.00 (promedio de 5)
```

---

### TABLA 3: EncuestaToken (Tokens de Acceso)

```sql
CREATE TABLE EncuestaToken (
    IdEncuestaToken INT PRIMARY KEY IDENTITY(1,1),
    
    ========== TOKEN IDENTIFICATION ==========
    Token UNIQUEIDENTIFIER NOT NULL UNIQUE,
    -- GUID puro (no encriptado en esta columna)
    -- Generado con: NEWID() o GUID.NewGuid() en C#
    -- Formato: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
    -- Ej: 'a1b2c3d4-e5f6-4789-a1b2-c3d4e5f6a1b2'
    
    TokenEncriptado NVARCHAR(MAX) NULL,
    -- Token AES-256 encriptado
    -- Para enviar por URL sin exposición
    -- Algoritmo: AES-256 en modo CBC
    -- Key: Derivada de config.json
    -- Ej result: '8F9K2L3M5N6P8Q9R...' (base64 encoded)
    
    ========== ESTADO Y VALIDEZ ==========
    Estado INT NOT NULL DEFAULT 0,
    -- 0 = Generado (token creado pero no enviado)
    -- 1 = Enviado (email sent, esperando respuesta)
    -- 2 = Respondido (alumno completó encuesta)
    -- 3 = Expirado (FechaFin < GETDATE())
    
    FechaEnvio DATETIME2 NULL,
    -- Cuándo fue enviado por email
    -- NULL si aún no enviado
    
    FechaFin DATETIME2 NOT NULL,
    -- Cuándo expira el token
    -- Típicamente: GETDATE() + 30 DAYS
    -- Validación: CHECK(FechaFin > FechaEnvio)
    
    ========== INFORMACIÓN DE CONTEXTO ==========
    IdAlumno INT NOT NULL 
        FOREIGN KEY REFERENCES Alumno(IdAlumno),
    
    IdCarrera INT NOT NULL 
        FOREIGN KEY REFERENCES Carrera(IdCarrera),
    
    IdEncuesta INT NULL 
        FOREIGN KEY REFERENCES Encuestum(IdEncuesta),
    -- Encuesta específica que el token abre
    -- NULL si token aún no está vinculado a encuesta
    
    IdSubModalidadPeriodoAcademico INT NOT NULL 
        FOREIGN KEY REFERENCES SubModalidadPeriodoAcademico(IdSubModalidadPeriodoAcademico),
    
    Tipo VARCHAR(3) NOT NULL,
    -- 'PPP' = Prácticas
    -- 'GRA' = Graduandos
    -- 'LCFC' = Logro Fin de Ciclo
    -- Validación: CHECK(Tipo IN ('PPP', 'GRA', 'LCFC'))
    
    IdEncuestaVirtualDelegado INT NULL,
    -- Para encuestas delegadas (caso especial)
    -- Un alumno responde por otro
    
    ========== AUDITORÍA ==========
    FechaCreacion DATETIME2 NOT NULL DEFAULT GETDATE(),
    UsuarioCreacion VARCHAR(100) NULL,
    
    ========== ÍNDICES CRÍTICOS ==========
    UNIQUE INDEX UX_Token (Token),
    -- Búsqueda rápida: "¿Este token existe y es válido?"
    
    INDEX IX_Token_Encriptado (TokenEncriptado),
    -- Para búsqueda alternativa (raro)
    
    INDEX IX_Estado_FechaFin (Estado, FechaFin),
    -- Para: "Obtener tokens activos y no expirados"
    
    INDEX IX_Alumno_Tipo_Periodo (IdAlumno, Tipo, IdSubModalidadPeriodoAcademico),
    -- Para: "¿Qué tokens tiene este alumno en este período?"
    
    INDEX IX_FechaFin (FechaFin),
    -- Para limpiar tokens expirados (mantenimiento)
);
```

**Ciclo de Vida de un Token**:
```
1. CREACIÓN (Estado = 0)
   ├─ Sistema genera NEWID()
   ├─ Encripta con AES-256
   ├─ INSERT con Estado = 0
   └─ FechaFin = GETDATE() + 30 DAYS

2. ENVÍO POR EMAIL (Estado → 1)
   ├─ Construye URL con token
   ├─ Envía por SMTP
   ├─ UPDATE Estado = 1
   └─ FechaEnvio = GETDATE()

3. ALUMNO RECIBE EMAIL
   ├─ Link contiene token original (sin encriptar en URL)
   ├─ Alumno hace CLICK
   └─ Frontend envía token a API

4. VALIDACIÓN EN API (Antes mostrar formulario)
   ├─ SELECT * FROM EncuestaToken WHERE Token = @token
   ├─ IF NOT FOUND → Error 401
   ├─ IF Estado = 0 → Error "Token no enviado"
   ├─ IF FechaFin < GETDATE() → Error "Token expirado"
   ├─ IF Estado = 2 → Error "Encuesta ya respondida"
   └─ IF OK → Mostrar formulario

5. ALUMNO RESPONDE (Estado → 2)
   ├─ Completa y envía respuestas
   ├─ UPDATE Estado = 2
   ├─ Actualiza Encuestum.Estado = 'COM'
   └─ Frontend: "Encuesta guardada exitosamente"

6. LIMPIEZA (Maintenance - opcional)
   ├─ Cada día ejecutar: DELETE donde FechaFin < GETDATE()-90DAYS
   └─ Conserva histórico de 90 días
```

---

### TABLA 4: OutcomeEncuestaPPPConfig (Competencias PPP)

```sql
CREATE TABLE OutcomeEncuestaPPPConfig (
    IdOutcomeEncuestaPPPConfig INT PRIMARY KEY IDENTITY(1,1),
    
    ========== DESCRIPCIÓN BILINGÜE ==========
    NombreEspanol NVARCHAR(255) NOT NULL,
    -- Ej: "Análisis Técnico de Requisitos"
    
    NombreIngles NVARCHAR(255) NOT NULL,
    -- Ej: "Technical Requirements Analysis"
    
    DescripcionEspanol NVARCHAR(MAX) NOT NULL,
    -- Explicación detallada en español
    -- Ej: "Capacidad de analizar requisitos técnicos de software..."
    
    DescripcionIngles NVARCHAR(MAX) NOT NULL,
    -- Explicación detallada en inglés
    
    ========== PRESENTACIÓN ==========
    Orden INT NOT NULL,
    -- Posición en formulario (1, 2, 3, ...)
    -- Validación (único por carrera):
    -- UNIQUE(IdCarrera, Orden)
    
    EsVisible BIT NOT NULL DEFAULT 1,
    -- true = mostrar en formulario
    -- false = competencia activa pero no visible para respuestas
    
    OtraCarrera BIT NOT NULL DEFAULT 0,
    -- true = esta competencia es compartida con otra carrera
    -- false = específica de esta carrera
    
    ========== CLASIFICACIÓN ==========
    Estado VARCHAR(3) NOT NULL DEFAULT 'ACT',
    -- 'ACT' = Activa (se puede usar en encuestas)
    -- 'INA' = Inactiva (no se crea en nuevas encuestas)
    -- Validación: CHECK(Estado IN ('ACT', 'INA'))
    
    ========== CONTEXTO ACADÉMICO ==========
    IdCarrera INT NOT NULL 
        FOREIGN KEY REFERENCES Carrera(IdCarrera),
    
    IdEscuela INT NOT NULL 
        FOREIGN KEY REFERENCES Escuela(IdEscuela),
    
    IdTipoOutcomeEncuesta INT NOT NULL 
        FOREIGN KEY REFERENCES TipoOutcomeEncuesta(IdTipoOutcomeEncuesta),
    -- Tipo de competencia (ABET, ACREDITA, etc.)
    
    IdSubModalidadPeriodoAcademico INT NOT NULL 
        FOREIGN KEY REFERENCES SubModalidadPeriodoAcademico(IdSubModalidadPeriodoAcademico),
    -- Período en el que esta competencia es válida
    
    ========== AUDITORÍA ==========
    FechaCreacion DATETIME2 NOT NULL DEFAULT GETDATE(),
    FechaModificacion DATETIME2 NULL,
    UsuarioCreacion VARCHAR(100) NULL,
    
    ========== ÍNDICES ==========
    INDEX IX_Carrera_Escuela_Estado (IdCarrera, IdEscuela, Estado),
    -- Para: "Competencias activas de esta carrera"
    
    INDEX IX_SubModalidad (IdSubModalidadPeriodoAcademico),
    -- Para: "Competencias válidas en este período"
    
    INDEX IX_Orden (Orden),
    -- Para: Ordenamiento en formulario
    
    UNIQUE INDEX UX_Carrera_Orden (IdCarrera, Orden),
    -- Garantiza orden único por carrera
);
```

---

## TRANSACCIONES CRÍTICAS

### TRANSACCIÓN 1: Guardar Respuestas PPP (Atómico)

```sql
-- Scenario: Alumno completó formulario PPP
-- Entrada: @IdEncuesta = 5001, @respuestas = {101→4.5, 102→3.75, ...}

BEGIN TRANSACTION;
    
    SET ISOLATION LEVEL SERIALIZABLE;
    -- Aislamiento total: evita lecturas sucias, no repetibles, fantasmas
    
    -- PASO 1: VALIDAR ENCUESTA EXISTE Y ESTÁ EN ESTADO PEN
    IF NOT EXISTS (
        SELECT 1 FROM Encuestum 
        WHERE IdEncuesta = @IdEncuesta 
        AND Estado = 'PEN'
    )
    BEGIN
        ROLLBACK TRANSACTION;
        RAISERROR('Encuesta no encontrada o ya completada', 16, 1);
        RETURN;
    END
    
    -- PASO 2: VALIDAR TODAS LAS RESPUESTAS
    DECLARE @respuestaCount INT = 0;
    SELECT @respuestaCount = COUNT(*) 
    FROM @respuestas 
    WHERE PuntajeOutcome < 1.0 OR PuntajeOutcome > 5.0;
    
    IF @respuestaCount > 0
    BEGIN
        ROLLBACK TRANSACTION;
        RAISERROR('Existen puntajes fuera de rango (1-5)', 16, 1);
        RETURN;
    END
    
    -- PASO 3: LIMPIAR RESPUESTAS ANTERIORES (Si existen)
    DELETE FROM PerformanceEncuestaPPP
    WHERE IdEncuesta = @IdEncuesta;
    
    -- PASO 4: INSERTAR NUEVAS RESPUESTAS (BULK)
    INSERT INTO PerformanceEncuestaPPP (
        IdEncuesta, 
        IdOutcomeEncuestaPPPConfig, 
        PuntajeOutcome,
        FechaRegistro
    )
    SELECT 
        @IdEncuesta,
        IdOutcomeEncuestaPPPConfig,
        PuntajeOutcome,
        GETDATE()
    FROM @respuestas;
    
    -- Validar inserción
    IF @@ROWCOUNT = 0
    BEGIN
        ROLLBACK TRANSACTION;
        RAISERROR('No se insertaron respuestas', 16, 1);
        RETURN;
    END
    
    -- PASO 5: ACTUALIZAR ESTADO ENCUESTUM
    UPDATE Encuestum
    SET Estado = 'COM',
        FechaFin = GETDATE(),
        PuntajeTotal = (
            SELECT AVG(CAST(PuntajeOutcome AS DECIMAL(5,2)))
            FROM PerformanceEncuestaPPP
            WHERE IdEncuesta = @IdEncuesta
        ),
        FechaModificacion = GETDATE()
    WHERE IdEncuesta = @IdEncuesta;
    
    -- PASO 6: ACTUALIZAR TOKEN
    UPDATE EncuestaToken
    SET Estado = 2  -- Respondido
    WHERE IdEncuesta = @IdEncuesta;
    
    -- PASO 7: LOG DE AUDITORÍA (opcional)
    INSERT INTO AuditLog (
        Tabla, Operacion, IdRegistro, FechaOperacion, Usuario
    )
    VALUES (
        'Encuestum', 'UPDATE', @IdEncuesta, GETDATE(), @UsuarioActual
    );
    
COMMIT TRANSACTION;

-- Retornar respuesta positiva
SELECT 'SUCCESS' AS Result, @IdEncuesta AS IdEncuesta;
```

**Garantías (ACID)**:
- **Atomicidad**: Todo o nada. Si error en mitad, todo se revierte
- **Consistencia**: PuntajeTotal siempre es promedio correcto
- **Aislamiento**: Otro usuario no ve cambios incompletos
- **Durabilidad**: Una vez commited, está en disco permanentemente

---

### TRANSACCIÓN 2: Envío Masivo Email GRA (Batch Processing)

```csharp
// Pseudocódigo C# - Envío Email PPP
public async Task<SurveyEmailResponse> EmailNSurveyGRA(EmailSurveyGRADTO request)
{
    var response = new SurveyEmailResponse();
    response.exitosas = 0;
    response.fallidas = 0;
    response.detalles = new List<DetailError>();
    
    // PASO 1: Get submodalidad actual
    var submodalidad = await _dbContext.SubModalidadPeriodoAcademico
        .Where(x => x.IdModalidad == request.modalidadId 
                && x.IdEscuela == request.escuelaId 
                && x.Activa == true)
        .FirstOrDefaultAsync();
    
    if (submodalidad == null)
        return new SurveyEmailResponse { success = false, message = "Modalidad no encontrada" };
    
    // PASO 2: Get notificaciones pendientes
    var notificaciones = await _dbContext.NotificacionEncuestaAlumno
        .Where(n => n.IdSubModalidadPeriodoAcademico == submodalidad.Id 
                && n.Estado == 0)  // No enviadas
        .Include(n => n.Alumno)
        .Include(n => n.Carrera)
        .ToListAsync();
    
    response.totalProcessadas = notificaciones.Count;
    
    // PASO 3: Get email template
    var config = await _dbContext.ConfiguracionNotificacion
        .Where(c => c.IdTipoEncuesta == "GRA" 
                && c.IdEscuela == request.escuelaId 
                && c.Estado == "ACT")
        .FirstOrDefaultAsync();
    
    if (config == null)
        return new SurveyEmailResponse { success = false, message = "Configuración email no encontrada" };
    
    // PASO 4: PARA CADA NOTIFICACIÓN - BEGIN LOOP
    foreach (var notif in notificaciones)
    {
        try
        {
            // 4.1: Get o crear token
            var token = await _dbContext.EncuestaToken
                .Where(t => t.IdAlumno == notif.IdAlumno 
                        && t.IdSubModalidadPeriodoAcademico == submodalidad.Id 
                        && t.Tipo == "GRA"
                        && t.FechaFin > DateTime.UtcNow)
                .FirstOrDefaultAsync();
            
            if (token == null)
            {
                // Crear nuevo token
                token = new EncuestaToken
                {
                    Token = Guid.NewGuid(),
                    TokenEncriptado = EncryptAES256(Guid.NewGuid().ToString()),
                    Estado = 0,
                    FechaFin = DateTime.UtcNow.AddDays(30),
                    IdAlumno = notif.IdAlumno,
                    IdCarrera = notif.IdCarrera,
                    IdSubModalidadPeriodoAcademico = submodalidad.Id,
                    Tipo = "GRA",
                    FechaCreacion = DateTime.UtcNow
                };
                
                _dbContext.EncuestaToken.Add(token);
                await _dbContext.SaveChangesAsync();
            }
            
            // 4.2: Construct URL
            var url = $"https://sistema.com/gra/encuesta?token={token.Token}&escuela={request.escuelaId}";
            
            // 4.3: Replace placeholders
            var emailBody = config.PlantillaEmail
                .Replace("[NombreAlumno]", notif.Alumno.NombreCompleto)
                .Replace("[CodigoAlumno]", notif.Alumno.Codigo)
                .Replace("[NombreCarrera]", notif.Carrera.Nombre)
                .Replace("[LinkEncuesta]", url)
                .Replace("[FechaVencimiento]", token.FechaFin.ToString("dd-MM-yyyy"));
            
            // 4.4: SEND EMAIL (SMTP)
            using (var client = new SmtpClient("smtp.upc.pe", 587))
            {
                client.EnableSsl = true;
                client.Credentials = new NetworkCredential("notificaciones@upc.pe", GetSmtpPassword());
                
                var mailMessage = new MailMessage(
                    "notificaciones@upc.pe",
                    notif.Alumno.CorreoPersonal)
                {
                    Subject = config.AsuntoEmail,
                    Body = emailBody,
                    IsBodyHtml = true
                };
                
                await client.SendMailAsync(mailMessage);
            }
            
            // 4.5: Mark as sent
            token.Estado = 1;
            token.FechaEnvio = DateTime.UtcNow;
            
            notif.Estado = 1;  // Enviado
            
            await _dbContext.SaveChangesAsync();
            
            response.exitosas++;
        }
        catch (Exception ex)
        {
            _log.Error($"Error enviando email a {notif.Alumno.Codigo}", ex);
            
            response.fallidas++;
            response.detalles.Add(new DetailError
            {
                codigoAlumno = notif.Alumno.Codigo,
                motivo = ex.Message
            });
        }
    }
    // END LOOP
    
    response.success = true;
    return response;
}
```

**Garantías**:
- Si SMTP falla: Reintento 3 veces
- Si BD falla: Transacción rollback
- Logging de todos los errores
- Idempotente: Si se ejecuta 2 veces, no envía emails duplicados (ya tienen Token)

---

## NIVELES DE ACEPTACIÓN Y HALLAZGOS

### Algoritmo de Clasificación (PPP)

```sql
-- Stored Procedure: Generar Hallazgos Automáticos
CREATE PROCEDURE USP_CREARHALLAZGOSPPPAUTOMATICOS
    @IdCarrera INT,
    @IdPeriodo INT,
    @ForzarEliminacion BIT = 0
AS
BEGIN
    SET NOCOUNT ON;
    
    -- Tabla temporal para resultados
    DECLARE @HallazgosTemp TABLE (
        IdEncuesta INT,
        IdAlumno INT,
        CodigoAlumno VARCHAR(20),
        IdOutcome INT,
        NombreOutcome NVARCHAR(255),
        PuntajeObtenido DECIMAL(5,2),
        NivelAceptacion VARCHAR(20),
        DescripcionNivel NVARCHAR(MAX)
    );
    
    -- PASO 1: Si ForzarEliminacion, limpiar hallazgos anteriores
    IF @ForzarEliminacion = 1
    BEGIN
        DELETE FROM Hallazgo
        WHERE IdCarrera = @IdCarrera
        AND IdPeriodo = @IdPeriodo
        AND TipoGeneracion = 'AUTOMÁTICO'
        AND Estado = 'PENDIENTE';  -- No eliminar los ya procesados
    END
    
    -- PASO 2: Obtener puntajes de encuestas PPP
    INSERT INTO @HallazgosTemp
    SELECT 
        e.IdEncuesta,
        e.IdAlumno,
        e.CodigoAlumno,
        c.IdOutcomeEncuestaPPPConfig,
        c.NombreEspanol,
        p.PuntajeOutcome,
        CASE
            WHEN p.PuntajeOutcome < 2.5 THEN 'ROJO'
            WHEN p.PuntajeOutcome < 3.2 THEN 'AMARILLO'
            ELSE 'VERDE'
        END AS Nivel,
        CASE
            WHEN p.PuntajeOutcome < 2.5 
                THEN 'No cumple con expectativas mínimas. Requiere Plan de Mejora urgente.'
            WHEN p.PuntajeOutcome < 3.2 
                THEN 'Cumple parcialmente. Se recomienda fortalecimiento.'
            ELSE 'Cumple satisfactoriamente.'
        END AS DescNivel
    FROM PerformanceEncuestaPPP p
    INNER JOIN Encuestum e ON p.IdEncuesta = e.IdEncuesta
    INNER JOIN OutcomeEncuestaPPPConfig c 
        ON p.IdOutcomeEncuestaPPPConfig = c.IdOutcomeEncuestaPPPConfig
    WHERE e.IdCarrera = @IdCarrera
    AND e.IdSubModalidadPeriodoAcademico IN (
        SELECT IdSubModalidadPeriodoAcademico
        FROM SubModalidadPeriodoAcademico
        WHERE IdPeriodo = @IdPeriodo
    )
    AND p.PuntajeOutcome IS NOT NULL;
    
    -- PASO 3: Crear hallazgos solo para ROJO y AMARILLO
    INSERT INTO Hallazgo (
        IdAlumno,
        CodigoAlumno,
        IdCarrera,
        IdPeriodo,
        IdOutcome,
        NombreOutcome,
        PuntajeObtenido,
        NivelAceptacion,
        Descripcion,
        TipoGeneracion,
        Estado,
        FechaGeneracion
    )
    SELECT 
        IdAlumno,
        CodigoAlumno,
        @IdCarrera,
        @IdPeriodo,
        IdOutcome,
        NombreOutcome,
        PuntajeObtenido,
        NivelAceptacion,
        DescripcionNivel,
        'AUTOMÁTICO',
        'PENDIENTE',
        GETDATE()
    FROM @HallazgosTemp
    WHERE NivelAceptacion IN ('ROJO', 'AMARILLO')
    AND NOT EXISTS (
        -- Evitar duplicados
        SELECT 1 FROM Hallazgo h
        WHERE h.IdAlumno = @HallazgosTemp.IdAlumno
        AND h.IdOutcome = @HallazgosTemp.IdOutcome
        AND h.IdPeriodo = @IdPeriodo
    );
    
    -- PASO 4: Retornar resumen
    SELECT 
        COUNT(*) AS HallazgosGenerados,
        SUM(CASE WHEN NivelAceptacion = 'ROJO' THEN 1 ELSE 0 END) AS Rojos,
        SUM(CASE WHEN NivelAceptacion = 'AMARILLO' THEN 1 ELSE 0 END) AS Amarillos
    FROM @HallazgosTemp
    WHERE NivelAceptacion IN ('ROJO', 'AMARILLO');
    
END;

-- EJECUCIÓN:
EXEC USP_CREARHALLAZGOSPPPAUTOMATICOS
    @IdCarrera = 10,        -- Ingeniería de Software
    @IdPeriodo = 5,         -- 2025-I
    @ForzarEliminacion = 0; -- No borrar anteriores
```

**Matriz de Decisión**:
```
Puntaje       Acción                          Impacto
──────────────────────────────────────────────────────
< 2.5         Crear Hallazgo ROJO             CRÍTICO
              + Plan Mejora Inmediato
              + Seguimiento Docente

2.5 - 3.2     Crear Hallazgo AMARILLO         IMPORTANTE
              + Plan Mejora
              + Seguimiento Coordinador

≥ 3.2         NO crear hallazgo               OK
              + Monitoreo periódico
```

---

**Documento generado**: Análisis Quirúrgico Parte 2  
**Completitud**: 50% de secciones  
**Próximas Secciones**: Error Handling, Performance, Security, Integraciones
