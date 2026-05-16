# ANÁLISIS TÉCNICO DETALLADO: SISTEMA DE ENCUESTAS ABET
## Especificación Quirúrgica para Migración a Next.js

**Documento de referencia técnica**: Este documento proporciona una descomposición exhaustiva de cada componente, servicio, endpoint y flujo de datos del sistema de encuestas (PPP, Graduados, LCFC).

---

## 📋 TABLA DE CONTENIDOS

1. [Arquitectura General](#arquitectura-general)
2. [PPP - Prácticas Pre-Profesionales](#ppp---prácticas-pre-profesionales)
3. [Graduado (GRA) - Encuestas de Graduandos](#graduado-gra---encuestas-de-graduandos)
4. [LCFC - Logro de Fin de Ciclo](#lcfc---logro-de-fin-de-ciclo)
5. [Componentes Compartidos](#componentes-compartidos)
6. [Flujos de Datos](#flujos-de-datos)
7. [Estructura de Requests/Responses](#estructura-de-requestsresponses)
8. [Consideraciones para Migración](#consideraciones-para-migración)

---

## ARQUITECTURA GENERAL

### Stack Tecnológico Actual (React + Vite)

```
Frontend (React + Vite)
├── Servicios API (ES6 Classes)
│   ├── pppService.js (PPPManagementService)
│   ├── graService.js (GRAManagementService)
│   ├── LCFCService.jsx (LCFCServiceClient)
│   └── surveyService.jsx (Para responder encuestas)
├── Contextos (React Context API)
│   ├── ABETProvider - Estado global (páginas, modalidades, darkMode)
│   ├── AuthProvider - Autenticación y tokens
│   ├── PermissionsProvider - Roles y permisos
│   ├── ReportProvider - Estado de reportes
│   └── IFCProvider - Datos IFC específicos
├── Componentes
│   ├── Management (Configuración de encuestas)
│   ├── Reportes (Visualización de datos)
│   └── Survey (Formularios para estudiantes)
└── Hooks Personalizados
    ├── useForm - Validación y manejo de formularios
    ├── useAuth - Gestión de autenticación
    └── usePortfolioAccess - Acceso a portafolios
```

### Backend API (Endpoints)

El backend expone endpoints organizados bajo estos prefijos:
- `/Survey/*` - Configuración de competencias y outcomes
- `/excel/*` - Descarga de plantillas y carga masiva
- `/email/*` - Gestión de notificaciones y plantillas
- `/lcfc/*` - Operaciones específicas de LCFC
- `/dashboard/*` - Estado de encuestas en dashboard

---

## PPP - PRÁCTICAS PRE-PROFESIONALES

### 1.1 Estructura de Carpetas

```
src/pages/content/Management/PPP/
├── PPPManagementView.jsx           # Componente raíz con navegación de tabs
├── DownloadTemplate/
│   └── PPPDownloadTemplate.jsx      # Descarga plantilla Excel
├── MassiveUpload/
│   ├── PPPMasiveUpload.jsx          # Componente principal de carga
│   └── uploadFile.jsx               # Lógica de subida
├── ReportViews/
│   ├── PPPReportViews.jsx           # Navegación entre reportes
│   └── PPPAveragePerceptionReport.jsx # Reporte de percepción
└── Configuration/
    ├── PPPConfiguration.jsx         # Orquestador principal
    ├── GeneralCompetence/
    │   ├── generalCompetence.jsx
    │   ├── addGeneralCompetence.jsx
    │   ├── editGeneralCompetence.jsx
    │   └── deleteGeneralCompetence.jsx
    ├── SpecificCompetence/
    │   ├── specificCompetence.jsx
    │   ├── addSpecificCompetence.jsx
    │   ├── editSpecificCompetence.jsx
    │   └── deleteSpecificCompetence.jsx
    └── AcceptanceLevel/
        └── acceptanceLevelComponent.jsx
```

### 1.2 PPPManagementView - Componente Raíz

**Responsabilidad**: Orquestar la navegación entre 4 tabs principales.

```jsx
// Estructura de Tabs
const views = [
  {
    name: 'Descargar Plantilla',
    component: <PPPDownloadTemplate />,
    current: true,  // Tab inicial
  },
  {
    name: 'Carga Masiva',
    component: <PPPMasiveUpload />,
    current: false,
  },
  {
    name: 'Reportes',
    component: <PPPReportViews />,
    current: false,
  },
  {
    name: 'Configuración',
    component: <PPPConfiguration />,
    current: false,
  },
]

// Gestión de Estado
const [selectedView, setSelectedView] = useState(views.find(view => view.current).name)

// Cambio de Vista
const changeView = viewName => {
  setSelectedView(viewName)
}

// Renderizado condicional basado en selectedView
```

**Especificación de UI**:
- En mobile: Selector dropdown `<select>`
- En desktop: Tab buttons con borde rojo cuando activo
- Clases Tailwind: `border-b border-red-500` para estado activo

### 1.3 Tab 1: Descargar Plantilla

**Componente**: `PPPDownloadTemplate.jsx`

**Flujo de Negocio**:

```
1. Usuario accede a PPP → pestaña "Descargar Plantilla"
2. Componente carga lista de ciclos académicos
3. Usuario selecciona ciclo
4. Usuario hace clic en "Descargar"
5. Sistema llama a API para obtener plantilla Excel
6. Browser descarga archivo: "PPP_Ciclo_XX.xlsx"
```

**Llamadas a API**:

```javascript
// 1. Obtener lista de ciclos (desde ABETContext y ReportService)
reportService.getCycleList({ 
  modalityId: valueModality  // Obtenido del contexto ABETContext
})

// 2. Descargar plantilla
pppManagementService.downloadTemplate({
  body: {
    escuela: "1",           // ID de escuela
    idioma: "es-PE",        // Idioma
    idPeriodoAcademico: 123 // ID del ciclo seleccionado
  },
  page: {
    pageNumber: 0,
    pageSize: -1
  }
})
```

**Detalles técnicos de descarga**:

```javascript
// En pppService.js - downloadTemplate()
async downloadTemplate(requestData) {
  // POST a: excel/template-PPP
  const response = await this.httpHelper.post('excel/template-PPP', requestData)
  const responseData = await response.json()
  
  // El response contiene:
  // - fileContents: String base64 del archivo
  // - contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  // - fileDownloadName: "PPP_Template.xlsx"
  
  // Decodificar base64 a Blob
  const byteCharacters = atob(responseData.fileContents)
  const byteArrays = []
  
  // Procesar en chunks de 512 bytes
  for (let offset = 0; offset < byteCharacters.length; offset += 512) {
    const slice = byteCharacters.slice(offset, offset + 512)
    const byteNumbers = new Array(slice.length)
    for (let i = 0; i < slice.length; i++) {
      byteNumbers[i] = slice.charCodeAt(i)
    }
    const byteArray = new Uint8Array(byteNumbers)
    byteArrays.push(byteArray)
  }
  
  const blob = new Blob(byteArrays, { type: responseData.contentType })
  
  return {
    blob,                    // Blob del archivo
    fileName: responseData.fileDownloadName
  }
}

// En componente: Trigger de descarga
const handleDownload = () => {
  pppManagementService.downloadTemplate(requestData).then(result => {
    const url = window.URL.createObjectURL(result.blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', result.fileName)
    document.body.appendChild(link)
    link.click()
    link.parentNode.removeChild(link)
  })
}
```

**Estado del componente**:

```javascript
const [form, setForm] = useForm({
  cycle: null  // { label: "Ciclo 2024-I", value: 123 }
})

const [loading, setLoading] = useState(false)
const [selectList, setSelectList] = useState({
  cycleList: []  // Array de ciclos
})
```

### 1.4 Tab 2: Carga Masiva

**Componente**: `PPPMasiveUpload.jsx`

**Flujo de Negocio**:

```
1. Usuario selecciona archivo Excel con datos de encuestas
2. Sistema valida formato y estructura del archivo
3. Usuario hace clic en "Subir"
4. Sistema envía archivo en base64 al backend
5. Backend procesa y guarda datos en BD
6. Sistema muestra resultado (éxito/error)
```

**Interfaz de Usuario**:

```jsx
// Input de archivo
<input 
  type="file" 
  accept=".xlsx,.xls"
  onChange={handleFileChange}
/>

// Botones
<button onClick={() => handleUpload()}>Subir Archivo</button>
<button onClick={() => handleDownloadTemplate()}>Descargar Plantilla</button>
```

**Llamadas a API**:

```javascript
// Flujo en graService.js - massiveUpload() (similar en PPP)
async massiveUpload(file) {
  // PASO 1: Convertir File a Blob
  const blob = await fileToBlob(file)
  
  // PASO 2: Convertir Blob a Base64
  const base64String = await blobToBase64(blob)
  
  // PASO 3: Construir requestData
  const requestData = {
    idCarrera: 0,                                    // ID de carrera (0 = todas)
    validarCarrera: false,                           // Validar estructura
    escuelaId: '1',                                 // ID de escuela
    escuelaActual: JSON.parse(localStorage.getItem('escuela')),
    archivoBase64: base64String,                    // Archivo codificado
    nombreArchivo: file.name                        // Nombre original
  }
  
  // PASO 4: POST al endpoint
  // Endpoint: POST excel/uploadNotificationEncuesta-GRA
  const response = await this.httpHelper.post(
    'excel/uploadNotificationEncuesta-GRA',
    requestData
  )
  
  // PASO 5: Procesar respuesta
  const responseData = await response.blob()
  return responseData  // Blob con reporte de carga
}
```

**Estructura del archivo Excel esperado**:

La plantilla descargada contiene columnas específicas:
- **Ciclo Académico**: ID o nombre del ciclo
- **Carrera**: ID o código de carrera
- **Competencia General**: Descripción de competencia general
- **Competencia Específica**: Descripción de competencia específica
- **Nivel de Aceptación**: Puntaje esperado
- **Descripción**: Descripción detallada

**Estado del componente**:

```javascript
const [selectedFile, setSelectedFile] = useState(null)
const [uploadProgress, setUploadProgress] = useState(0)
const [uploadStatus, setUploadStatus] = useState(null)  // 'pending', 'success', 'error'
const [responseMessage, setResponseMessage] = useState('')
```

**Validaciones**:

```javascript
const validateFile = (file) => {
  const validExtensions = ['.xlsx', '.xls']
  const fileExtension = file.name.substring(file.name.lastIndexOf('.'))
  
  if (!validExtensions.includes(fileExtension)) {
    throw new Error('Formato de archivo no válido. Use .xlsx o .xls')
  }
  
  if (file.size > 10 * 1024 * 1024) { // 10MB
    throw new Error('Archivo demasiado grande. Máximo 10MB')
  }
}
```

### 1.5 Tab 3: Reportes

**Componente**: `PPPReportViews.jsx` → `PPPAveragePerceptionReport.jsx`

**Tipos de Reportes Disponibles**:
- Percepción Promedio (Única disponible actualmente)

**Flujo de Negocio**:

```
1. Usuario selecciona filtros:
   - Ciclo Académico
   - Carrera (opcional)
   - Comisión (opcional)
2. Sistema construye query con parámetros
3. Backend genera PDF con datos de percepción
4. Sistema descarga ZIP con PDFs
```

**Componente PPPAveragePerceptionReport**:

```javascript
// Estado
const [form, setForm] = useForm({
  cycle: null,      // { label: "Ciclo 2024-I", value: 123 }
  career: null,     // { label: "Ingeniería Informática", value: 456 }
  commission: null  // { label: "Comisión A", value: 789 }
})

const [selectList, setSelectList] = useState({
  cycleList: [],
  careerList: [],
  commissionList: []
})

// Contexto para resultados
const { response, setResponse } = useContext(ReportContext)

// Carga de datos
useEffect(() => {
  // 1. Cargar ciclos
  reportService.getCycleList({ modalityId: valueModality })
    .then(data => setSelectList(prev => ({ ...prev, cycleList: data })))
  
  // 2. Cuando selecciona ciclo, cargar carreras
  if (form.cycle) {
    reportService.getCareersByCycle({ idCiclo: form.cycle.value })
      .then(data => setSelectList(prev => ({ ...prev, careerList: data })))
  }
  
  // 3. Cuando selecciona carrera, cargar comisiones
  if (form.career) {
    reportService.getCommissionsByCareer({ idCarrera: form.career.value })
      .then(data => setSelectList(prev => ({ ...prev, commissionList: data })))
  }
}, [form.cycle, form.career, valueModality])

// Generación del reporte
const handleGenerateReport = () => {
  const requestData = {
    body: {
      escuela: "1",
      idioma: "es-PE",
      idPeriodoAcademico: form.cycle?.value,
      idCarrera: form.career?.value,
      idComision: form.commission?.value
    },
    page: { pageNumber: 0, pageSize: -1 }
  }
  
  // POST a ReportService (obtiene PDFs)
  reportService.fetchPDFReporte(requestData, '/report/ppp-perception')
    .then(response => {
      // response.pdfFiles: Array de PDFs generados
      // response.zipFile: ZIP descargable
      setResponse(response)
    })
}
```

**Estructura de Respuesta del Reporte**:

```javascript
{
  success: true,
  data: {
    pdfFiles: [
      {
        fileName: "Reporte_Carrera_CicloI.pdf",
        base64Content: "JVBERi0xLjQKJeLj..."
      },
      // ... más PDFs
    ],
    zipFile: {
      base64Content: "UEsDBBQACAAI...",
      fileName: "ReportePercepcionPromedio.zip"
    }
  },
  message: "Reportes generados exitosamente"
}
```

### 1.6 Tab 4: Configuración

**Componente**: `PPPConfiguration.jsx` (Orquestador)

**Subcomponentes**:
- `GeneralCompetenceComponent` - CRUD de competencias generales
- `SpecificCompetenceComponent` - CRUD de competencias específicas
- `AcceptanceLevelComponent` - Configurar niveles de aceptación

**Flujo General de Configuración**:

```
1. Usuario selecciona ciclo académico
2. Sistema verifica si ya existe configuración para ese ciclo
3. Si NO existe:
   - Opción A: Clonar configuración de otro ciclo
   - Opción B: Crear configuración nueva
4. Si existe:
   - Mostrar formulario de edición
   - Permitir agregar/editar/eliminar competencias
   - Permitir ajustar niveles de aceptación
```

**Estado del componente PPPConfiguration**:

```javascript
const [form, setForm] = useForm(
  { cycle: null },  // initialForm
  validationsForm    // validation function
)

const [currentCycleId, setCurrentCycleId] = useState(null)
const [emptyConfiguration, setEmptyConfiguration] = useState(false)  // No hay config
const [dataSpecific, setDataSpecific] = useState(null)  // Datos cargados
const [selectList, setSelectList] = useState({
  cycleList: []
})

// Contexto global
const { valueModality } = useContext(ABETContext)
```

**Flujo de Carga de Datos**:

```javascript
// PASO 1: Seleccionar ciclo
const handleSelectCycle = (cycleId) => {
  setForm({ ...form, cycle: cycleId })
  setCurrentCycleId(cycleId)
}

// PASO 2: Verificar si existe configuración
useEffect(() => {
  if (currentCycleId) {
    pppManagementService.getCompetenceList({
      body: {
        idPeriodoAcademico: currentCycleId,
        idCarrera: 0,
        escuela: "1"
      }
    })
    .then(response => {
      if (response && response.length > 0) {
        // Configuración existe
        setDataSpecific(response)
        setEmptyConfiguration(false)
      } else {
        // No existe configuración
        setEmptyConfiguration(true)
      }
    })
  }
}, [currentCycleId])

// PASO 3: Si no existe, mostrar opción de clonar
const handleCloneConfiguration = (sourceCarrerId) => {
  pppManagementService.cloneConfiguration({
    body: {
      idCarreraOrigen: sourceCarrerId,
      idCarreraDestino: currentCycleId,
      idPeriodoOrigen: sourceCarrerId,
      idPeriodoDestino: currentCycleId
    }
  })
  .then(response => {
    setShowAlert(false)
    // Recargar datos
    handleSelectCycle(currentCycleId)
  })
}
```

#### 1.6.1 Sub-Tab: Competencias Generales

**Componente**: `GeneralCompetenceComponent`

**Responsabilidad**: Listar, crear, editar y eliminar competencias generales.

**Flujo CRUD**:

```
READ:
  GET /Survey/list-ppp-configurations
  Request: { idPeriodoAcademico, idCarrera }
  Response: Array de competencias

CREATE:
  POST /Survey/add-update-ppp-config
  Request: { idPeriodoAcademico, competencia, descripcion, ... }
  Response: { success, message }

UPDATE:
  POST /Survey/add-update-ppp-config
  Request: { id, ...updateData }
  Response: { success, message }

DELETE:
  DELETE /Survey/Delete-by-Id-config
  Request: { id }
  Response: { success }
```

**Componentes Menores**:

- `addGeneralCompetence.jsx`: Formulario modal para agregar
- `editGeneralCompetence.jsx`: Formulario modal para editar
- `deleteGeneralCompetence.jsx`: Modal de confirmación

**Estado del componente**:

```javascript
const [competenceList, setCompetenceList] = useState([])
const [showAddModal, setShowAddModal] = useState(false)
const [showEditModal, setShowEditModal] = useState(false)
const [editingCompetence, setEditingCompetence] = useState(null)
const [loading, setLoading] = useState(false)

// Modal de agregar
const [formAdd, setFormAdd] = useForm({
  competencia: '',      // Nombre corto
  descripcion: '',      // Descripción
  nivelAceptacion: 3    // Nivel 1-5
})
```

**Tabla de Competencias Generales**:

```javascript
const columns = [
  { 
    title: 'Competencia', 
    data: 'competencia',
    type: 'text'
  },
  { 
    title: 'Descripción', 
    data: 'descripcion',
    type: 'text',
    width: '40%'
  },
  { 
    title: 'Nivel Aceptación', 
    data: 'nivelAceptacion',
    type: 'number'
  },
  { 
    title: 'Acciones', 
    type: 'actions',
    actions: [
      { label: 'Editar', onClick: handleEdit },
      { label: 'Eliminar', onClick: handleDelete }
    ]
  }
]
```

#### 1.6.2 Sub-Tab: Competencias Específicas

**Componente**: `SpecificCompetenceComponent`

Estructura similar a Competencias Generales pero con campos adicionales:

```javascript
// Campos adicionales
{
  competenciaGeneral: 456,    // Referencia a competencia general
  competenciaEspecifica: '',
  descripcion: '',
  evidencia: '',              // Tipo de evidencia requerida
  nivelAceptacion: 3
}
```

**Particularidad**: Las competencias específicas están ligadas a competencias generales.

#### 1.6.3 Sub-Tab: Niveles de Aceptación

**Componente**: `AcceptanceLevelComponent`

**Responsabilidad**: Configurar escala de evaluación (ej: 1-5 estrellas, con descriptions).

**Estructura de Datos**:

```javascript
[
  { 
    nivel: 1, 
    descripcion: "Insuficiente",
    rango: "0-40%"
  },
  { 
    nivel: 2, 
    descripcion: "Regular",
    rango: "41-60%"
  },
  { 
    nivel: 3, 
    descripcion: "Bueno",
    rango: "61-75%"
  },
  { 
    nivel: 4, 
    descripcion: "Muy Bueno",
    rango: "76-90%"
  },
  { 
    nivel: 5, 
    descripcion: "Excelente",
    rango: "91-100%"
  }
]
```

**Llamadas a API**:

```javascript
// Obtener niveles
async getAcceptanceLevels(requestData) {
  POST /Survey/list-niveles-aceptacion
  return response.data
}

// Actualizar niveles
async updateAcceptanceLevel(requestData) {
  POST /Survey/Update-niveles-aceptacion
  return response.text()
}
```

---

## GRADUADO (GRA) - ENCUESTAS DE GRADUANDOS

### 2.1 Estructura de Carpetas

```
src/pages/content/Management/Graduando/
├── GRAManagementView.jsx           # Raíz con tabs
├── ReportView/
│   ├── GraduatingPerceptionReportByOutcome.jsx
│   ├── GraduatingImportanceReportByOutcome.jsx
│   └── NotifiedGraduatingSurveysReport.jsx
├── NotificationView/
│   ├── AddStudent.jsx              # Agregar estudiante por código
│   ├── DeleteStudent.jsx            # Eliminar estudiante
│   ├── EditEmail.jsx                # Editar plantilla de correo
│   └── MassiveUpload/
│       ├── massiveGRAUpload.jsx
│       └── uploadFile.jsx
└── Configuration/
    ├── GRAConfiguration.jsx
    ├── GeneralCompetenceComponent
    └── SpecificCompetenceComponent
```

### 2.2 GRAManagementView - Navegación

**Tabs principales**:

```javascript
const views = [
  {
    name: 'Reportes',
    component: <GRAReportView />,
    current: true,
  },
  {
    name: 'Notificaciones',
    component: <NotificationView />,
    current: false,
  },
  {
    name: 'Configuración',
    component: <GRAConfiguration />,
    current: false,
  },
]
```

### 2.3 Tab 1: Reportes

**Subcomponentes de Reportes**:

1. **GraduatingPerceptionReportByOutcome.jsx**
   - Muestra percepción promedio por outcome
   - Filtra por: Ciclo, Carrera, Comisión

2. **GraduatingImportanceReportByOutcome.jsx**
   - Muestra importancia asignada a outcomes
   - Datos: Min, Max, Promedio

3. **NotifiedGraduatingSurveysReport.jsx**
   - Muestra estado de encuestas enviadas
   - Filtra estudiantes notificados vs respondidos

**Estructura de Reportes**:

```javascript
const reports = [
  {
    name: 'Percepción por Outcome',
    component: <GraduatingPerceptionReportByOutcome />,
    current: true,
  },
  {
    name: 'Importancia por Outcome',
    component: <GraduatingImportanceReportByOutcome />,
    current: false,
  },
  {
    name: 'Encuestas Notificadas',
    component: <NotifiedGraduatingSurveysReport />,
    current: false,
  },
]
```

### 2.4 Tab 2: Notificaciones

**Componente**: `NotificationView.jsx`

**Funcionalidades**:

#### 2.4.1 Agregar Estudiante Individual

**Componente**: `AddStudent.jsx`

**Flujo**:

```
1. Administrador ingresa código de estudiante
2. Sistema busca estudiante en BD
3. Si existe:
   - Valida que no esté ya notificado
   - Agrega a lista de notificación
   - Guarda en BD
4. Si no existe:
   - Muestra error
```

**Llamadas a API**:

```javascript
// Buscar estudiante
async getStudentByCode(requestData) {
  POST /email/findStudentCode-career-GRA
  Request: { codigoEstudiante, idCarrera }
  Response: { id, nombre, email, carrera }
}

// Agregar a notificación
async addStudentByCode(requestData) {
  POST /email/saveNotification-GRA
  Request: { studentId, encuestaId, email }
  Response: { success, message }
}
```

**Estado**:

```javascript
const [studentCode, setStudentCode] = useState('')
const [foundStudent, setFoundStudent] = useState(null)
const [loading, setLoading] = useState(false)
const [successMessage, setSuccessMessage] = useState('')
const [errorMessage, setErrorMessage] = useState('')
```

#### 2.4.2 Eliminar Estudiante

**Componente**: `DeleteStudent.jsx`

**Flujo**:

```
1. Mostrar tabla de estudiantes notificados
2. Usuario selecciona estudiante
3. Confirma eliminación
4. Sistema elimina de BD
5. Recarga tabla
```

**Llamada a API**:

```javascript
async deleteStudentByCode(requestData) {
  POST /email/deleteNotification-GRA
  Request: { notificationId }
  Response: { success }
}

// Obtener lista de estudiantes
async getAllStudents(requestData) {
  POST /email/listStudentNotification-GRA
  Request: { idEncuesta, pageNumber: 0, pageSize: -1 }
  Response: {
    success: true,
    data: [
      {
        notificationId: 123,
        studentId: 456,
        studentCode: "2020001",
        studentName: "Juan Pérez",
        email: "juan@email.com",
        sent: true,
        completed: false,
        sentDate: "2024-01-15"
      },
      // ... más estudiantes
    ]
  }
}
```

#### 2.4.3 Editar Plantilla de Correo

**Componente**: `EditEmail.jsx`

**Contenido del Correo**:

```
Subject: Encuesta de Graduandos - UPC

Body:
---
Estimado [NOMBRE_ESTUDIANTE],

Le invitamos a completar la Encuesta de Graduandos correspondiente a [CICLO].

Link para completar encuesta:
[LINK_ENCUESTA]

Atentamente,
ABET - Universidad Peruana de Ciencias Aplicadas
---

Parámetros Disponibles:
- [NOMBRE_ESTUDIANTE]
- [CICLO]
- [CARRERA]
- [LINK_ENCUESTA]
- [CODIGO_ESTUDIANTE]
- [EMAIL_ESTUDIANTE]
```

**Llamadas a API**:

```javascript
// Obtener plantilla actual
async getEmail(requestData) {
  POST /email/getConfigurationNotification-GRA
  Request: { idEncuesta }
  Response: { subject, body, htmlContent }
}

// Guardar plantilla actualizada
async saveEmail(requestData) {
  POST /email/saveConfirmationNotif-GRA
  Request: {
    idEncuesta,
    subject: "Encuesta de Graduandos",
    body: "Contenido personalizado",
    plainText: false
  }
  Response: { success, message }
}

// Enviar encuesta
async sendEmail(requestData) {
  POST /email/emailSurvey-GRA
  Request: {
    idEncuesta,
    recipients: [
      { studentId: 1, email: "student@email.com", name: "Juan" }
    ]
  }
  Response: { success, sentCount }
}
```

**Estado del componente**:

```javascript
const [emailTemplate, setEmailTemplate] = useState({
  subject: '',
  body: '',
  htmlContent: ''
})

const [unsavedChanges, setUnsavedChanges] = useState(false)
const [saving, setSaving] = useState(false)
```

#### 2.4.4 Carga Masiva de Estudiantes

**Componente**: `MassiveUpload/massiveGRAUpload.jsx`

Flujo similar a PPP pero específico para estudiantes:

```
1. Descargar plantilla
2. Rellenar con datos de estudiantes
3. Subir archivo
4. Sistema valida y agrega a notificación
5. Muestra reporte de carga
```

**Columnas esperadas en Excel**:
- Código de Estudiante
- Nombre
- Email
- Carrera
- Ciclo

### 2.5 Tab 3: Configuración

**Estructura idéntica a PPP**:
- Competencias Generales
- Competencias Específicas
- Niveles de Aceptación

**Diferencia**: Usa endpoints `/gra-configurations` en lugar de `/ppp-configurations`

```javascript
// CRUD para GRA
async getCompetenceList(requestData) {
  POST /Survey/list-gra-configurations
}

async addCompetence(requestData) {
  POST /Survey/add-update-gra-config
}

async deleteCompetence(requestData) {
  DELETE /Survey/Delete-gra-config
}
```

---

## LCFC - LOGRO DE FIN DE CICLO

### 3.1 Estructura de Carpetas

```
src/pages/content/Management/LCFC/
├── LCFCManagementView.jsx          # Raíz con tabs
├── ReportLCFC/
│   ├── LCFCPerceptionReport.jsx
│   └── LCFCReportedSurveys.jsx
├── NotificationView/
│   ├── EditEmailView.jsx
│   └── (Gestión de estudiantes similar a GRA)
└── Configuration/
    └── LCFCConfiguration.jsx
```

**Estructura de Tabs**:

```javascript
const views = [
  {
    name: 'Reportes',
    component: <LCFCReportView />,
    current: true,
  },
  {
    name: 'Notificaciones',
    component: <NotificationView />,
    current: false,
  },
  {
    name: 'Configuración',
    component: <LCFCConfiguration />,
    current: false,
  },
]
```

### 3.2 Particularidades de LCFC

LCFC difiere de PPP y GRA en varios aspectos:

1. **Configuración por Ciclo y Período**
2. **Outcomes agrupados por comisión**
3. **Respuesta individual del estudiante (no masiva)**
4. **Link token-based para respondentes**

### 3.3 Tab 1: Reportes LCFC

#### 3.3.1 Reporte de Percepción

**Componente**: `LCFCPerceptionReport.jsx`

**Filtros disponibles**:
- Ciclo Académico (obligatorio)
- Escuela (obligatorio)
- Período (obligatorio)
- Carrera (opcional)

**Datos mostrados**:
- Número de encuestas totales
- Encuestas completadas
- Porcentaje de completación
- Percepción promedio por competencia
- Desglobe por comisión

#### 3.3.2 Reporte de Encuestas Respondidas

**Componente**: `LCFCReportedSurveys.jsx`

**Datos**:
- Listado de estudiantes que respondieron
- Fecha y hora de respuesta
- Calificación promedio dada
- Detalles de respuestas

### 3.4 Tab 2: Notificaciones LCFC

Similar a GRA pero con particularidades:

**Gestión de Estudiantes**:

```javascript
// Obtener estudiantes a notificar
async getAllStudents(requestData) {
  POST /lcfc/notificacion/paginado
  Request: {
    idCiclo,
    idPeriodo,
    pageNumber: 0,
    pageSize: 20
  }
  Response: {
    success: true,
    data: {
      estudiantes: [
        {
          idAlumno: 123,
          codigo: "2020001",
          nombre: "Juan Pérez",
          email: "juan@email.com",
          encuestaEnviada: true,
          encuestaCompletada: false
        }
      ],
      totalRegistros: 150,
      pageNumber: 0,
      pageSize: 20
    }
  }
}

// Obtener parámetros para email
async getEmailParameters() {
  GET /lcfc/notificacion/parametros
  Response: {
    parametros: [
      { nombre: "[NOMBRE_ESTUDIANTE]", description: "Nombre del estudiante" },
      { nombre: "[LINK_ENCUESTA]", description: "Link de acceso a encuesta" },
      // ... más parámetros
    ]
  }
}

// Enviar encuestas
async sendEmail(requestBody) {
  POST /lcfc/notificacion/envio
  Request: {
    idCiclo,
    idPeriodo,
    destinatarios: "TODOS" | "SELECCIONADOS",
    selectedStudents: [123, 456, 789], // Si SELECCIONADOS
    asunto: "Encuesta de Logro de Fin de Ciclo",
    cuerpo: "Contenido con parámetros"
  }
  Response: { success, enviados, fallidos }
}
```

### 3.5 Tab 3: Configuración LCFC

**Componente**: `LCFCConfiguration.jsx`

**Responsabilidad**: Configurar outcomes y competencias para cada ciclo y período.

**Flujo de Configuración**:

```
1. Seleccionar escuela
2. Seleccionar período académico
3. Generar configuración automáticamente
   - Obtiene cursos del período
   - Agrupa por comisión
   - Crea estructura de outcomes
4. Permite editar competencias específicas
5. Activa/desactiva configuración
```

**Llamadas a API**:

```javascript
// Obtener cursos para periodo
async getCourses(requestData) {
  POST /lcfc/configuracion/pageable
  Request: {
    idEscuela: "1",
    idPeriodo: 123,
    pageNumber: 0,
    pageSize: -1
  }
  Response: {
    cursos: [
      {
        idCurso: 1,
        nombreCurso: "Programación I",
        codigo: "CC101",
        comisiones: [
          {
            idComision: 10,
            nombreComision: "Comisión A",
            profesor: "Dr. López"
          }
        ]
      }
    ]
  }
}

// Generar configuración automática
async optionalData(escuela, periodo) {
  POST /lcfc/configuracion/generar/escuela/{escuela}/periodo/{periodo}
  Response: {
    success: true,
    dataGenerada: { /* estructura de outcomes */ }
  }
}

// Cambiar estado de configuración
async updateStatusConfiguration(requestData) {
  POST /lcfc/configuracion/cambio
  Request: {
    idConfiguracion: 1,
    nuevoEstado: "ACTIVO" | "INACTIVO"
  }
  Response: { success: true }
}

// Clonar configuración de otro período
async cloneConfiguration(requestData) {
  POST /lcfc/configuracion/clonar
  Request: {
    idPeriodoOrigen: 100,
    idPeriodoDestino: 101
  }
  Response: { success: true, configuracionClonada }
}
```

---

## COMPONENTES COMPARTIDOS

### 4.1 Survey Form Component

**Ubicación**: `src/pages/content/survey/components/survey.jsx`

**Responsabilidad**: Renderizar formulario interactivo de encuesta para estudiantes.

**Estructura**:

```jsx
const Survey = ({ 
  selects,          // Información del estudiante (lectura)
  form,             // Datos del estudiante
  listOutcomes,     // Array de outcomes a evaluar
  onSendData,       // Callback para enviar datos
  screenType        // True = móvil, False = desktop
}) => {
  // Renderizar tabla de competencias
  // Gestionar selección de puntajes
  // Renderizar textarea de comentarios
  // Botón de envío
}
```

**Datos de Entrada - listOutcomes**:

```javascript
[
  {
    comisionNombre: "Comisión A",
    outcomes: [
      {
        outcomeId: 1,
        comisionId: 10,
        competenciaE: "Pensamiento Crítico",
        competenciaG: "Análisis",
        descripcion: "Capacidad de analizar problemas",
        desempeno: null,  // Será llenado por usuario
      },
      // ... más outcomes
    ]
  },
  // ... más comisiones
]
```

**Estructura de Tabla**:

```javascript
const headersE = {
  col: [
    { title: 'Competencia', data: 'competenciaE', type: 'text' },
    { title: 'Descripción', data: 'descripcion', type: 'text' },
    { title: 'Desempeño', data: 'desempeno', type: 'rowSelect' },  // Selector 1-5
  ],
  titleTable: 'Competencias Específicas',
  colorHeader: 'bg-red-500',
  colorHeaderText: 'text-white',
}
```

**Validaciones antes de envío**:

```javascript
// Verificar que NO hay campos nulos
const validations = [
  form.especificas.length === dataTableE.length,  // Todas competencias específicas
  form.generales?.length === dataTableG.length,   // Todas competencias generales (si aplica)
  textArea.trim().length > 0                      // Comentario obligatorio
]

if (validations.includes(false)) {
  Swal.fire({
    text: "Existen Campos Faltantes en la encuesta",
    icon: 'warning'
  })
} else {
  // Enviar datos
  onSendData(formData)
}
```

**Estructura de Datos a Enviar**:

```javascript
{
  especificas: [
    {
      comisionId: 10,
      outcomeId: 1,
      puntaje: 5,
      descripcion: ''
    },
    // ... más respuestas
  ],
  generales: [ /* si aplica */ ],
  descripcion: "Comentarios del estudiante..."
}
```

**Respuesta después de envío**:

```javascript
// Si exitoso
{
  success: true,
  data: {
    message: "Encuesta completada exitosamente"
  }
}

// Si error
{
  success: false,
  message: "Error al guardar encuesta"
}
```

---

## FLUJOS DE DATOS

### 5.1 Flujo: Administrador Configura PPP

```
┌─────────────────────────┐
│  PPPManagementView      │
│  (Orquestador)          │
└───────────┬─────────────┘
            │
            ├─→ selecciona "Configuración"
            │
            ▼
┌─────────────────────────┐
│  PPPConfiguration       │
│  (Componente Principal) │
└───────────┬─────────────┘
            │
            ├─→ Obtiene ciclos disponibles
            │   ReportService.getCycleList()
            │
            ▼
┌─────────────────────────┐
│  Usuario selecciona     │
│  ciclo: "2024-I"        │
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────────────────────┐
│  Verificar configuración existente      │
│  PPPManagementService.getCompetenceList │
└───────────┬─────────────────────────────┘
            │
            ├─→ ¿Existe?
            │
        ┌───┴─────┬──────────┐
        ▼         ▼          ▼
      NO       SÍ         SÍ (vacío)
        │        │          │
        │        │    ┌─────┴─────┐
        │        │    │ Mostrar   │
        │        │    │ botón     │
        │        │    │ "Clonar"  │
        │        │    └─────┬─────┘
        │        │          │
        ▼        ▼          ▼
    ┌────────────────┬────────────────┐
    │ Mostrar        │ Mostrar        │
    │ GeneralComp    │ GeneralComp    │
    │ SpecificComp   │ SpecificComp   │
    │ Acceptance     │ Acceptance     │
    └────────────────┴────────────────┘
    │
    └─→ Dentro de cada subcomponente:
        │
        ├─→ Listar (GET)
        ├─→ Agregar (POST /add-update)
        ├─→ Editar (POST /add-update)
        └─→ Eliminar (DELETE)
```

### 5.2 Flujo: Administrador Carga Datos Masivamente

```
┌─────────────────────────┐
│  Administrador accede   │
│  /management/ppp        │
└───────────┬─────────────┘
            │
            ├─→ Selecciona "Carga Masiva"
            │
            ▼
┌─────────────────────────┐
│  PPPMasiveUpload        │
└───────────┬─────────────┘
            │
            ├─→ Opción A: Descargar plantilla
            │   PPPManagementService.downloadTemplate()
            │   ├─→ POST /excel/template-PPP
            │   └─→ Base64 → Blob → Download
            │
            ├─→ Usuario llena Excel localmente
            │
            ├─→ Opción B: Subir archivo
            │   └─→ Selecciona archivo (.xlsx)
            │
            ▼
┌─────────────────────────┐
│  Procesar archivo       │
│  1. File → Blob        │
│  2. Blob → Base64      │
│  3. Crear requestData  │
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────────────────┐
│  PPPManagementService.massiveUpload │
│  POST /excel/upload-PPP             │
└───────────┬─────────────────────────┘
            │
            ▼
    ┌───────────────────────┐
    │ Backend:              │
    │ 1. Valida estructura  │
    │ 2. Procesa registros  │
    │ 3. Guarda en BD      │
    │ 4. Genera reporte     │
    └───────────┬───────────┘
            │
            ▼
┌──────────────────────────────┐
│ Response: Blob (reporte)     │
│ - Registros procesados       │
│ - Errores encontrados        │
│ - Resumen de carga           │
└──────────────────────────────┘
```

### 5.3 Flujo: Estudiante Responde Encuesta LCFC

```
┌──────────────────────────────────┐
│ Estudiante recibe email con link │
│ /survey/lcfc?escuela=1&token=ABC │
└─────────────┬────────────────────┘
              │
              ▼
┌──────────────────────────┐
│ LCFCSurvey.jsx           │
│ (Componente Principal)   │
└─────────────┬────────────┘
              │
              ├─→ useEffect: Verifica token
              │
              ▼
┌────────────────────────────────────┐
│ surveyService.verifyToken()        │
│ GET /lcfc/notificacion/escuela/1   │
│         /token/ABC                 │
└─────────────┬──────────────────────┘
              │
              ▼
      ┌───────────────┐
      │ Token válido? │
      └───┬───────┬───┘
          │       │
          NO      SÍ
          │       │
          ▼       ▼
      Error    Obtener outcomes
              surveyService.getOutcomes()
              │
              ├─→ Response contiene:
              │   - escuela
              │   - nombreCarrera
              │   - ciclo
              │   - nombreCurso
              │   - lista de outcomes por comisión
              │
              ▼
        ┌─────────────────┐
        │ Agrupar por     │
        │ Comisión        │
        │ (agruparPor     │
        │ ComisionNombre) │
        └────────┬────────┘
                 │
                 ▼
        ┌──────────────────┐
        │ Renderizar       │
        │ Survey component │
        │ (formulario)     │
        └────────┬─────────┘
                 │
                 ├─→ Mostrar select de usuario
                 ├─→ Mostrar tabla de outcomes
                 │   - Competencia Específica
                 │   - Descripción
                 │   - Selector de Desempeño (1-5)
                 ├─→ Mostrar textarea de comentarios
                 ├─→ Botón "Guardar"
                 │
                 ▼
        ┌──────────────────┐
        │ Usuario          │
        │ responde y       │
        │ hace clic        │
        │ "Guardar"        │
        └────────┬─────────┘
                 │
                 ├─→ Validar campos obligatorios
                 │   (todos outcomes completados)
                 │
                 ▼
        ┌────────────────────────────┐
        │ Armar estructura de datos: │
        │ {                          │
        │   comentario: "...",       │
        │   encuestaId: 123,         │
        │   escuela: "1",            │
        │   lista: [                 │
        │     {                      │
        │       comisionId: 10,      │
        │       outcomeId: 1,        │
        │       puntaje: 5           │
        │     }                      │
        │   ]                        │
        │ }                          │
        └────────┬───────────────────┘
                 │
                 ▼
        ┌──────────────────────┐
        │ surveyService.       │
        │ sendData()           │
        │ POST /lcfc/encuesta/ │
        │     completar        │
        └────────┬─────────────┘
                 │
                 ▼
    ┌──────────────────────┐
    │ Backend:             │
    │ 1. Valida token      │
    │ 2. Guarda respuestas │
    │ 3. Marca como hecho  │
    │ 4. Retorna éxito     │
    └────────┬─────────────┘
             │
             ▼
    ┌─────────────────────────┐
    │ Response: { success: true,
    │ data: { message: "..." }}
    └────────┬────────────────┘
             │
             ▼
    ┌──────────────────┐
    │ Mostrar mensaje  │
    │ de éxito y       │
    │ limpiar view     │
    └──────────────────┘
```

---

## ESTRUCTURA DE REQUESTS/RESPONSES

### 6.1 Patrón General de Request

```javascript
// Estructura base para todas las solicitudes
{
  body: {
    escuela: "1",                    // ID de escuela (casi siempre "1")
    idioma: "es-PE",                 // Código de idioma
    idPeriodoAcademico: 123,         // ID del período
    idCarrera: 456,                  // ID de carrera (0 = todas)
    // ... más campos según endpoint
  },
  page: {
    pageNumber: 0,                   // Página (0-indexed)
    pageSize: -1 | 20                // -1 = todos, ó número específico
  }
}
```

### 6.2 Patrón General de Response

```javascript
// Estructura base para todas las respuestas
{
  success: true | false,             // Indicador de éxito
  data: {
    resource: { /* datos */ } | [],  // Datos devueltos
    // ... otros campos según contexto
  },
  message: "Descripción de resultado"
}

// Para archivos
{
  success: true,
  data: {
    resource: {
      fileContents: "base64...",     // Archivo codificado
      contentType: "application/vnd.ms-excel",
      fileDownloadName: "Plantilla.xlsx"
    }
  }
}

// Para listados con paginación
{
  success: true,
  data: {
    resource: [
      { id: 1, nombre: "...", ... },
      { id: 2, nombre: "...", ... }
    ],
    pageInfo: {
      totalRecords: 150,
      pageNumber: 0,
      pageSize: 20,
      totalPages: 8
    }
  }
}
```

### 6.3 Ejemplos por Tipo de Operación

#### GET COMPETENCIAS

```javascript
// REQUEST
POST /Survey/list-ppp-configurations
{
  body: {
    escuela: "1",
    idioma: "es-PE",
    idPeriodoAcademico: 2024001,
    idCarrera: 0
  },
  page: { pageNumber: 0, pageSize: -1 }
}

// RESPONSE
{
  success: true,
  lstConfig: [
    {
      id: 1001,
      competenciaGeneral: "Pensamiento Crítico",
      competenciaEspecifica: "Análisis de Problemas",
      descripcion: "Capacidad de identificar y resolver problemas",
      nivelAceptacion: 3,
      estado: "ACTIVO",
      fechaCreacion: "2024-01-15T10:30:00",
      ultimaActualizacion: "2024-03-10T14:45:00"
    },
    // ... más competencias
  ],
  message: "Consulta exitosa"
}
```

#### ADD/UPDATE COMPETENCIA

```javascript
// REQUEST - ADD
POST /Survey/add-update-ppp-config
{
  body: {
    escuela: "1",
    idioma: "es-PE",
    id: 0,  // 0 = nuevo
    competenciaGeneral: "Comunicación",
    competenciaEspecifica: "Expresión Oral",
    descripcion: "Capacidad de expresarse claramente",
    nivelAceptacion: 3,
    idPeriodoAcademico: 2024001
  }
}

// REQUEST - UPDATE
POST /Survey/add-update-ppp-config
{
  body: {
    escuela: "1",
    idioma: "es-PE",
    id: 1001,  // ID existente
    competenciaGeneral: "Comunicación",
    competenciaEspecifica: "Expresión Oral - ACTUALIZADA",
    descripcion: "Capacidad mejorada",
    nivelAceptacion: 4,
    idPeriodoAcademico: 2024001
  }
}

// RESPONSE
{
  success: true,
  message: "Registro guardado exitosamente",
  data: { id: 1001 }
}
```

#### DELETE COMPETENCIA

```javascript
// REQUEST
DELETE /Survey/Delete-by-Id-config
{
  id: 1001
}

// RESPONSE
{
  success: true,
  message: "Registro eliminado"
}
```

#### CLONE CONFIGURATION

```javascript
// REQUEST
POST /Survey/ReplicarConfiguracionPPP
{
  body: {
    escuela: "1",
    idCarreraOrigen: 456,
    idPeriodoOrigen: 2024001,
    idCarreraDestino: 456,
    idPeriodoDestino: 2024002
  }
}

// RESPONSE
{
  success: true,
  message: "Configuración clonada exitosamente",
  data: {
    configuracionOriginal: { /* ... */ },
    configuracionNueva: { /* ... */ }
  }
}
```

#### MASSIVE UPLOAD

```javascript
// REQUEST
POST /excel/upload-PPP
{
  idCarrera: 0,
  validarCarrera: false,
  escuelaId: "1",
  escuelaActual: { id: 1, nombre: "Escuela de..." },
  archivoBase64: "SUQsQ2FycmVyYSxDb21wZXRlbmNpYQ...",
  nombreArchivo: "datos_ppp.xlsx"
}

// RESPONSE - Blob (descargable)
// El blob contiene un archivo con reporte de:
// - Registros procesados: N
// - Registros con error: M
// - Errores específicos por fila
```

#### VERIFY SURVEY TOKEN

```javascript
// REQUEST
GET /lcfc/notificacion/escuela/1/token/ABC123XYZ

// RESPONSE
{
  success: true,
  resource: {
    escuela: "1",
    nombreCarrera: "Ingeniería Informática",
    ciclo: "2024-I",
    codigo: "2020001",
    nombreCurso: "Programación I",
    cursoCodigo: "CC101",
    estado: false,  // false = no respondida, true = ya respondida
    alumnoId: 123,
    encuestaId: 789
  }
}
```

#### SUBMIT SURVEY RESPONSE

```javascript
// REQUEST
POST /lcfc/encuesta/completar
{
  comentario: "Los temas fueron claros y bien estructurados",
  encuestaId: 789,
  escuela: "1",
  lista: [
    {
      comisionId: 10,
      outcomeId: 1,
      puntaje: 5,
      descripcion: ""
    },
    {
      comisionId: 10,
      outcomeId: 2,
      puntaje: 4,
      descripcion: ""
    }
  ]
}

// RESPONSE
{
  success: true,
  data: {
    message: "Encuesta completada exitosamente"
  }
}
```

---

## CONSIDERACIONES PARA MIGRACIÓN A NEXT.JS

### 7.1 Cambios en Arquitectura

#### De React (SPA) a Next.js (SSR/SSG)

```
ACTUAL (React + Vite):
├── src/api/ - Clases con métodos
├── src/client/ - Servicios cliente
├── src/pages/ - Componentes de página
└── src/context/ - Context API

NUEVO (Next.js):
├── app/api/routes/ - API Routes (pueden reemplazar HttpHelper)
├── lib/services/ - Servicios reutilizables
├── app/(survey)/ - Rutas de encuestas
├── app/(admin)/ - Rutas de administración
├── components/ - Componentes reutilizables
└── hooks/ - Hooks personalizados
```

### 7.2 Migración de Servicios

#### Actual: Clase ES6

```javascript
// src/api/pppService.js
class PPPManagementService {
  constructor() {
    this.httpHelper = new HttpHelper()
  }
  
  async downloadTemplate(requestData) {
    const response = await this.httpHelper.post(
      'excel/template-PPP',
      requestData
    )
    // ... procesamiento
  }
}
```

#### Propuesto: Módulo Next.js (API Route)

```javascript
// app/api/surveys/ppp/template/route.js
export async function POST(request) {
  const data = await request.json()
  
  // Llamar backend
  const response = await fetch(
    `${process.env.BACKEND_URL}/excel/template-PPP`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    }
  )
  
  const result = await response.json()
  return Response.json(result)
}
```

O como servidor action (Recomendado):

```javascript
// lib/surveys/ppp-actions.js
'use server'

export async function downloadTemplate(requestData) {
  const response = await fetch(
    `${process.env.BACKEND_URL}/excel/template-PPP`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestData)
    }
  )
  
  return await response.json()
}
```

### 7.3 Cambios en Gestión de Estado

#### Actual: React Context

```javascript
// src/context/ABETProvider.jsx
const ABETContext = createContext()

export function ABETProvider({ children }) {
  const [currentPage, setCurrentPage] = useState('')
  const [valueModality, setValueModality] = useState(1)
  
  return (
    <ABETContext.Provider value={{ currentPage, valueModality }}>
      {children}
    </ABETContext.Provider>
  )
}
```

#### Propuesto: Zustand (Alternativa) o Context

```javascript
// lib/store/abet-store.js
import { create } from 'zustand'

export const useAbetStore = create((set) => ({
  currentPage: '',
  valueModality: 1,
  setCurrentPage: (page) => set({ currentPage: page }),
  setValueModality: (modality) => set({ valueModality: modality })
}))
```

### 7.4 Cambios en Componentes

#### Actual: React Hooks

```jsx
// src/pages/content/Management/PPP/PPPManagementView.jsx
export default function PPPManagementView() {
  const [selectedView, setSelectedView] = useState(
    views.find(view => view.current).name
  )
  
  const changeView = viewName => {
    setSelectedView(viewName)
  }
  
  return (
    // JSX
  )
}
```

#### Propuesto: Next.js Client Component

```jsx
// app/(admin)/management/ppp/page.jsx
'use client'

import { useState } from 'react'

export default function PPPManagementPage() {
  const [selectedView, setSelectedView] = useState(
    views.find(view => view.current).name
  )
  
  // mismo código
}
```

### 7.5 Cambios en Rutas

#### Actual: React Router

```javascript
// src/routers/MyRoutes.jsx
const routes = [
  {
    path: '/management/ppp',
    element: <PPPManagementView />,
    requiredPermission: '/management/ppp'
  },
  {
    path: '/management/graduando',
    element: <GRAManagementView />,
    requiredPermission: '/management/graduando'
  },
  {
    path: '/survey/lcfc',
    element: <LCFCSurvey />,
    parameters: { escuela: string, token: string }
  }
]
```

#### Propuesto: Next.js File-Based Routing

```
app/
├── (admin)/
│   └── management/
│       ├── ppp/
│       │   └── page.jsx         # /management/ppp
│       └── graduando/
│           └── page.jsx         # /management/graduando
└── survey/
    └── lcfc/
        └── page.jsx             # /survey/lcfc?escuela=...&token=...
```

### 7.6 Cambios en Autenticación

#### Propuesto: Middleware Next.js

```javascript
// middleware.js
import { NextResponse } from 'next/server'

export function middleware(request) {
  const token = request.cookies.get('auth')?.value
  
  if (!token && request.nextUrl.pathname.startsWith('/management')) {
    return NextResponse.redirect(new URL('/login', request.url))
  }
}

export const config = {
  matcher: ['/management/:path*', '/survey/:path*']
}
```

### 7.7 Cambios en Descarga de Archivos

#### Actual: Client-side

```javascript
const handleDownload = () => {
  pppManagementService.downloadTemplate(requestData).then(result => {
    const url = window.URL.createObjectURL(result.blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', result.fileName)
    document.body.appendChild(link)
    link.click()
  })
}
```

#### Propuesto: Server Action + Client-side

```javascript
// lib/surveys/file-actions.js
'use server'

export async function downloadTemplate(requestData) {
  const response = await fetch(
    `${process.env.BACKEND_URL}/excel/template-PPP`,
    {
      method: 'POST',
      body: JSON.stringify(requestData)
    }
  )
  
  const data = await response.json()
  
  return {
    fileContents: data.fileContents,
    fileName: data.fileDownloadName,
    contentType: data.contentType
  }
}

// En componente
'use client'

const handleDownload = async () => {
  const file = await downloadTemplate(requestData)
  const blob = new Blob([atob(file.fileContents)], { type: file.contentType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = file.fileName
  a.click()
}
```

### 7.8 Cambios en Manejo de Contexto

#### Actual: useContext + useState

```javascript
const { response, setResponse } = useContext(ReportContext)
```

#### Propuesto: Zustand

```javascript
import { useShallow } from 'zustand/react/shallow'

const useReportStore = create((set) => ({
  response: null,
  setResponse: (data) => set({ response: data })
}))

// En componente
const { response, setResponse } = useReportStore(
  useShallow(state => ({
    response: state.response,
    setResponse: state.setResponse
  }))
)
```

### 7.9 Cambios en Peticiones HTTP

#### Actual: HttpHelper (wrapper fetch)

```javascript
class HttpHelper {
  async post(endpoint, data) {
    return fetch(`${API_URL}/${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })
  }
}
```

#### Propuesto: Fetch API nativa o Axios en Server Actions

```javascript
// lib/api-client.js
export async function apiPost(endpoint, data) {
  const response = await fetch(
    `${process.env.BACKEND_URL}${endpoint}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getAuthToken()}`
      },
      body: JSON.stringify(data)
    }
  )
  
  if (!response.ok) throw new Error(`API Error: ${response.statusText}`)
  return response.json()
}
```

### 7.10 Tabla de Mapeo de Cambios

| Aspecto | React (Actual) | Next.js (Propuesto) |
|---------|---|---|
| **Gestión de Rutas** | React Router | File-based routing |
| **Navegación entre tabs** | useState + condicionales | Segmentos de ruta o estado |
| **Servicios API** | Clases ES6 | Server Actions o API Routes |
| **Estado global** | Context API | Zustand o Context API mejorado |
| **Autenticación** | Auth Provider | Middleware + NextAuth.js |
| **Descarga archivos** | Client-side con Blob | Streaming o Middleware |
| **Validación de tokens** | En componente | En Middleware |
| **Paginación** | Cliente | Server Actions con URL params |
| **Búsqueda/Filtros** | Estado local | URL search params |
| **Rendering** | SPA (todo en cliente) | SSR/SSG + Client components |

---

## RESUMEN EJECUTIVO PARA MIGRACIÓN

### Cambios Críticos:

1. **Estructura de carpetas**: Migrar a estructura de Next.js con `app/` directory
2. **Servicios**: Convertir clases ES6 a Server Actions
3. **Enrutamiento**: Eliminar React Router, usar file-based routing
4. **Estado**: Considerar Zustand para estado más simple
5. **Validación de permisos**: Mover a Middleware de Next.js
6. **Autenticación**: Implementar NextAuth.js
7. **Base de datos**: Si es necesario, considerar ORM como Prisma

### Estimated Effort:

- **PPP**: 40-50 horas (4 tabs = 4 sprints)
- **GRA**: 35-40 horas (similar a PPP + notificaciones)
- **LCFC**: 30-35 horas (configuración más simple, similar a GRA)
- **Survey (respondentes)**: 20-25 horas (componente aislado)
- **Componentes compartidos**: 15-20 horas
- **Testing**: 30-40 horas

**Total estimado**: 170-210 horas (4-5 semanas a tiempo completo)

---

**Documento Finalizado**. Este análisis proporciona una base técnica suficientemente detallada para iniciar la migración a Next.js sin necesidad de investigación adicional del código actual.

