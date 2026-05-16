# DIAGRAMAS TÉCNICOS - SISTEMA DE ENCUESTAS ABET
## Representación Visual de Arquitectura y Flujos

---

## 1. DIAGRAMA DE ARQUITECTURA GENERAL

### 1.1 Stack Actual (React + Vite)

```
┌─────────────────────────────────────────────────────────────────┐
│                    FRONTEND (React + Vite)                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              COMPONENTES DE PÁGINA                       │   │
│  ├──────────────────┬──────────────────┬───────────────────┤   │
│  │ PPPManagement    │ GRAManagement    │ LCFCManagement   │   │
│  │ View             │ View             │ View             │   │
│  │                  │                  │                   │   │
│  │ ├─ Descarga      │ ├─ Reportes     │ ├─ Reportes      │   │
│  │ ├─ Carga Masiva  │ ├─ Notificaciones│ ├─ Notificaciones│   │
│  │ ├─ Reportes      │ └─ Configuración │ └─ Configuración │   │
│  │ └─ Configuración │                  │                   │   │
│  └─────────────────────────────────────────────────────────┘   │
│                              ▲                                    │
│                              │                                    │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              COMPONENTES COMPARTIDOS                     │   │
│  ├──────────────────┬──────────────────┬───────────────────┤   │
│  │ Modal            │ Table            │ Forms             │   │
│  │ Components       │ Components       │ Components        │   │
│  └─────────────────────────────────────────────────────────┘   │
│                              ▲                                    │
│                              │                                    │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │           CONTEXTOS & HOOKS GLOBALES                    │   │
│  ├──────────────────┬──────────────────┬───────────────────┤   │
│  │ ABETContext      │ AuthProvider     │ PermissionsContext│   │
│  │ ReportContext    │ IFCContext       │ RouterContext     │   │
│  │                  │                  │                   │   │
│  │ useForm          │ useAuth          │ usePortfolioAccess│   │
│  └─────────────────────────────────────────────────────────┘   │
│                              ▲                                    │
│                              │                                    │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │             SERVICIOS API (Clases ES6)                  │   │
│  ├──────────────────┬──────────────────┬───────────────────┤   │
│  │ pppService       │ graService       │ LCFCService       │   │
│  │ surveyService    │ reportService    │ httpHelper        │   │
│  └─────────────────────────────────────────────────────────┘   │
│                              │                                    │
└──────────────────────────────┼────────────────────────────────────┘
                               │ fetch/XMLHttpRequest
                               │
┌──────────────────────────────▼────────────────────────────────────┐
│                  BACKEND API (Java/.NET)                          │
├──────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                  ENDPOINTS                                │   │
│  ├────────────────────────────────────────────────────────┤   │
│  │ /Survey/*           /excel/*         /email/*           │   │
│  │ /lcfc/*             /dashboard/*     /report/*          │   │
│  └──────────────────────────────────────────────────────────┘   │
│                              │                                    │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │              BASE DE DATOS (SQL Server)                  │   │
│  │                                                            │   │
│  │  Tablas Principales:                                     │   │
│  │  - Configuraciones (PPP, GRA, LCFC)                      │   │
│  │  - Outcomes/Competencias                                 │   │
│  │  - Respuestas de Encuestas                               │   │
│  │  - Notificaciones                                        │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                   │
└──────────────────────────────────────────────────────────────────┘
```

---

## 2. FLUJO DE DATOS: COMPLETAR ENCUESTA LCFC

```
ALUMNO RECIBE EMAIL
         │
         ├─ Contiene link: /survey/lcfc?escuela=1&token=ABC123
         │
         ▼
┌─────────────────────────────────┐
│  LCFCSurvey Component           │
│  (useEffect en montaje)         │
└────────────┬────────────────────┘
             │
             ├─ Extrae params: escuela, token
             │  const searchParams = useLocation().search
             │
             ▼
┌──────────────────────────────────────────┐
│  surveyService.verifyToken(escuela, token)
│  GET /lcfc/notificacion/escuela/{1}/    │
│                      token/{ABC123}     │
└────────────┬─────────────────────────────┘
             │
         ┌───┴──────────────┐
         │                  │
      VÁLIDO            EXPIRADO
         │                  │
         ▼                  ▼
    ┌─────────────┐  ┌──────────────┐
    │ estado:false│  │ estado:true  │
    │ (pendiente) │  │ (respondida) │
    └────────┬────┘  └──────┬───────┘
             │               │
             ▼               ▼
    Cargar outcomes   Error: "Ya respondida"
             │
             ▼
┌──────────────────────────────────────────┐
│  surveyService.getOutcomes(response)     │
│  GET /lcfc/encuesta/escuela/{1}/        │
│      idioma/es-PE/alumno/{123}/...      │
└────────────┬─────────────────────────────┘
             │
             ▼
┌────────────────────────────────────────────┐
│  Response data contiene:                   │
│  - escuela: "1"                            │
│  - nombreCarrera: "Ingeniería Informática" │
│  - ciclo: "2024-I"                         │
│  - lista: [                                │
│      {                                     │
│        comisionNombre: "Comisión A",       │
│        outcomes: [                         │
│          {                                 │
│            outcomeId: 1,                   │
│            competenciaE: "Análisis",       │
│            competenciaG: "Pensamiento",    │
│            descripcion: "...",             │
│            desempeno: null                 │
│          },                                │
│          ...                               │
│        ]                                   │
│      },                                    │
│      ...                                   │
│    ]                                       │
└────────────┬───────────────────────────────┘
             │
             ▼
┌──────────────────────────────────────────┐
│  Agrupar por Comisión:                   │
│  agruparPorComisionNombre(lista)         │
└────────────┬─────────────────────────────┘
             │
             ▼
┌──────────────────────────────────────────┐
│  Renderizar Survey Component:             │
│  - Info del estudiante (lectura)         │
│  - Tabla con outcomes                    │
│  - Selector de desempeño (1-5)           │
│  - Textarea de comentarios               │
│  - Botón "Guardar"                       │
└────────────┬─────────────────────────────┘
             │
  Usuario completa encuesta
             │
             ▼
┌──────────────────────────────────────────┐
│  Validar campos:                         │
│  1. Todas competencias completadas       │
│  2. Comentario no vacío                  │
│                                           │
│  ✗ Si hay vacío → Mostrar warning        │
│  ✓ Si válido → Continuar                 │
└────────────┬─────────────────────────────┘
             │
             ▼
┌──────────────────────────────────────────┐
│  Construir payload:                      │
│  {                                       │
│    comentario: "string",                 │
│    encuestaId: 789,                      │
│    escuela: "1",                         │
│    lista: [                              │
│      {                                   │
│        comisionId: 10,                   │
│        outcomeId: 1,                     │
│        puntaje: 5                        │
│      },                                  │
│      ...                                 │
│    ]                                     │
│  }                                       │
└────────────┬─────────────────────────────┘
             │
             ▼
┌──────────────────────────────────────────┐
│  surveyService.sendData(payload)         │
│  POST /lcfc/encuesta/completar           │
└────────────┬─────────────────────────────┘
             │
             ▼
    ┌───────────────┐
    │ Backend:      │
    │ 1. Valida     │
    │ 2. Guarda     │
    │ 3. Retorna OK │
    └────────┬──────┘
             │
             ▼
┌──────────────────────────────────────────┐
│  Response:                               │
│  {                                       │
│    success: true,                        │
│    data: {                               │
│      message: "Completada exitosamente" │
│    }                                     │
│  }                                       │
└────────────┬─────────────────────────────┘
             │
             ▼
┌──────────────────────────────────────────┐
│  Mostrar confirmación:                   │
│  - Modal con mensaje de éxito            │
│  - Limpiar formulario                    │
│  - Permitir salir                        │
└──────────────────────────────────────────┘
```

---

## 3. FLUJO DE DATOS: CONFIGURAR PPP (ADMINISTRADOR)

```
ADMIN ACCEDE: /management/ppp
         │
         ▼
┌─────────────────────────────────┐
│  PPPManagementView              │
│  (Componente raíz con tabs)     │
└────────────┬────────────────────┘
             │
             ├─ Estado: selectedView = 'Descargar Plantilla'
             │
      ┌──────┴──────┬──────────┬──────────┐
      │             │          │          │
      ▼             ▼          ▼          ▼
   ┌─────────┐┌─────────┐┌────────┐┌─────────────┐
   │Descargar││Carga    ││Reportes││Configuración│
   │Plantilla││Masiva   ││        ││             │
   └────┬────┘└────┬────┘└───┬────┘└────────┬────┘
        │          │         │             │
    USUARIO SELECCIONA CONFIGURACIÓN
        │
        ▼
┌────────────────────────────────────────────┐
│  PPPConfiguration (Componente Orquestador) │
└────────────┬───────────────────────────────┘
             │
             ├─ Estado inicial: cycle: null
             │
             ▼
┌────────────────────────────────────────────┐
│  ReportService.getCycleList()              │
│  POST /cycles                              │
│  Parámetro: modalityId (del ABETContext)   │
└────────────┬───────────────────────────────┘
             │
             ▼
  Response: [
    { id: 2024001, nombre: "2024-I", ... },
    { id: 2024002, nombre: "2024-II", ... },
  ]
             │
             ▼
┌────────────────────────────────────────────┐
│  Renderizar selector de ciclo              │
└────────────┬───────────────────────────────┘
             │
   USUARIO SELECCIONA CICLO 2024-I
             │
             ▼
┌────────────────────────────────────────────┐
│  handleSelectCycle(2024001)                │
│  setCurrentCycleId(2024001)                │
└────────────┬───────────────────────────────┘
             │
             ├─ useEffect triggered
             │
             ▼
┌────────────────────────────────────────────┐
│  pppManagementService.getCompetenceList() │
│  POST /Survey/list-ppp-configurations     │
│  {                                         │
│    idPeriodoAcademico: 2024001             │
│    idCarrera: 0                            │
│  }                                         │
└────────────┬───────────────────────────────┘
             │
        ┌────┴─────────────────┐
        │                      │
     ✓ EXISTE          ✗ NO EXISTE
        │                      │
        ▼                      ▼
   ┌────────────┐      ┌────────────────┐
   │Cargar datos│      │emptyConfiguration
   │existentes  │      │= true           │
   └────┬───────┘      └────────┬────────┘
        │                       │
        ▼                       ▼
    setDataSpecific    ┌──────────────────┐
    (array de datos)   │Mostrar opción    │
        │              │"Clonar desde..." │
        ▼              │o "Crear nuevo"   │
                       └────────┬─────────┘
                               │
        ┌──────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────┐
│  Renderizar 3 SubComponentes:               │
│  1. AcceptanceLevelComponent                │
│  2. GeneralCompetenceComponent              │
│  3. SpecificCompetenceComponent             │
└─────────────────────────────────────────────┘

DENTRO DE GeneralCompetenceComponent:
        │
        ├─ Tabla de competencias generales
        │
        ├─ Botón "Agregar"
        │         │
        │         ▼
        │    Modal con form:
        │    - Nombre competencia
        │    - Descripción
        │    - Nivel aceptación
        │
        │    Si guardar:
        │    pppService.addCompetence({...})
        │    POST /Survey/add-update-ppp-config
        │
        ├─ Botón "Editar" (por cada fila)
        │    → pppService.updateCompetence({id, ...})
        │
        └─ Botón "Eliminar" (por cada fila)
             → pppService.deleteCompetence({id})

DENTRO DE SpecificCompetenceComponent:
        │
        ├─ Similar a GeneralCompetence
        │  pero adiciona:
        │  - Referencia a competencia general
        │  - Tipo de evidencia
```

---

## 4. FLUJO DE DATOS: CARGA MASIVA DE DATOS

```
ADMIN: /management/ppp → Carga Masiva tab
         │
         ▼
┌────────────────────────────────────┐
│  PPPMasiveUpload Component          │
└────────────┬──────────────────────┘
             │
             ├─ Opción A: Descargar plantilla
             │
             ▼
    ┌──────────────────────────┐
    │ handleDownloadTemplate() │
    └───────────┬──────────────┘
                │
                ▼
    pppService.downloadTemplate(requestData)
    POST /excel/template-PPP
                │
                ▼
    Response: {
      fileContents: "base64string...",
      contentType: "application/vnd.ms-excel",
      fileDownloadName: "PPP_Template.xlsx"
    }
                │
                ▼
    Decodificar base64 → Blob
    Crear link descarga
    User descarga archivo
                │
    ╔════════════════════════════════════╗
    ║ USER LLENA ARCHIVO EN EXCEL LOCAL  ║
    ║ Offline - fuera del sistema        ║
    ╚════════════════════════════════════╝
                │
                ▼
    ┌──────────────────────────┐
    │ Opción B: Subir archivo  │
    └───────────┬──────────────┘
                │
                ▼
    handleFileSelect(file)
    Validar: [.xlsx | .xls] && size < 10MB
                │
                ▼
    ┌──────────────────────────────────────┐
    │ handleUpload()                       │
    └───────────┬────────────────────────┘
                │
                ├─ File → Blob (FileReader)
                │
                ├─ Blob → Base64 (FileReader)
                │
                ├─ Construir requestData:
                │  {
                │    idCarrera: 0,
                │    validarCarrera: false,
                │    escuelaId: "1",
                │    escuelaActual: JSON.parse(
                │      localStorage.getItem('escuela')
                │    ),
                │    archivoBase64: "SUQsQ2FycmVy...",
                │    nombreArchivo: "datos_ppp.xlsx"
                │  }
                │
                ▼
┌──────────────────────────────────────────┐
│  pppService.massiveUpload(requestData)   │
│  POST /excel/upload-PPP                  │
└───────────┬────────────────────────────┘
            │
            ▼
    ┌──────────────────────────────┐
    │ BACKEND PROCESSING:          │
    │ 1. Decodificar base64        │
    │ 2. Leer archivo Excel        │
    │ 3. Validar estructura        │
    │ 4. Validar datos             │
    │ 5. Procesar por fila         │
    │ 6. Guardar en BD             │
    │ 7. Generar reporte           │
    └──────────┬───────────────────┘
               │
               ▼
    ┌──────────────────────────────┐
    │ Response: Blob (reporte)     │
    │ Contiene:                    │
    │ - Registros procesados: N    │
    │ - Registros con error: M     │
    │ - Detalles de errores        │
    │ - Resumen de carga           │
    └──────────┬───────────────────┘
               │
               ▼
    ┌──────────────────────────────┐
    │ Renderizar reporte en UI:    │
    │ - Tabla con resultados       │
    │ - Opción descargar reporte   │
    │ - Opción reintentar (si hay  │
    │   errores)                   │
    └──────────────────────────────┘
```

---

## 5. ARQUITECTURA DE COMPONENTES PARA MIGRACIÓN A NEXT.JS

### 5.1 Estructura de Carpetas Propuesta

```
next-app/
│
├── app/
│   ├── layout.jsx                    # Layout raíz
│   ├── page.jsx                      # Home page
│   │
│   ├── (protected)/                  # Rutas protegidas
│   │   ├── middleware.js             # Verificar autenticación
│   │   │
│   │   └── management/
│   │       ├── ppp/
│   │       │   ├── page.jsx          # /management/ppp
│   │       │   ├── layout.jsx
│   │       │   │
│   │       │   ├── download/
│   │       │   │   └── page.jsx      # /management/ppp/download
│   │       │   │
│   │       │   ├── upload/
│   │       │   │   └── page.jsx      # /management/ppp/upload
│   │       │   │
│   │       │   ├── reports/
│   │       │   │   └── page.jsx      # /management/ppp/reports
│   │       │   │
│   │       │   └── config/
│   │       │       └── page.jsx      # /management/ppp/config
│   │       │
│   │       ├── graduando/
│   │       │   ├── page.jsx          # /management/graduando
│   │       │   ├── reports/
│   │       │   ├── notifications/
│   │       │   └── config/
│   │       │
│   │       └── lcfc/
│   │           ├── page.jsx          # /management/lcfc
│   │           ├── reports/
│   │           ├── notifications/
│   │           └── config/
│   │
│   ├── (public)/                     # Rutas públicas
│   │   └── survey/
│   │       ├── lcfc/
│   │       │   ├── page.jsx          # /survey/lcfc?escuela=...&token=...
│   │       │   └── loading.jsx
│   │       │
│   │       └── gra/
│   │           └── page.jsx          # /survey/gra?escuela=...&token=...
│   │
│   └── api/
│       └── [...route]/
│           └── route.js              # API proxy (opcional)
│
├── lib/
│   ├── services/
│   │   ├── survey-service.js
│   │   ├── ppp-service.js
│   │   ├── gra-service.js
│   │   ├── lcfc-service.js
│   │   └── api-client.js
│   │
│   ├── actions/
│   │   ├── ppp-actions.js (Server Actions)
│   │   ├── gra-actions.js
│   │   └── lcfc-actions.js
│   │
│   ├── stores/
│   │   ├── abet-store.js (Zustand)
│   │   ├── report-store.js
│   │   └── auth-store.js
│   │
│   ├── hooks/
│   │   ├── useForm.js
│   │   ├── useAuth.js
│   │   ├── useSurvey.js
│   │   └── useReports.js
│   │
│   ├── utils/
│   │   ├── file-handler.js
│   │   ├── validators.js
│   │   └── formatters.js
│   │
│   └── db/
│       └── prisma.js (Si se agrega BD local)
│
├── components/
│   ├── (admin)/
│   │   ├── PPPManagement/
│   │   │   ├── PPPTabs.jsx
│   │   │   ├── GeneralCompetenceTable.jsx
│   │   │   ├── SpecificCompetenceTable.jsx
│   │   │   ├── AcceptanceLevelForm.jsx
│   │   │   └── ReportFilters.jsx
│   │   │
│   │   ├── GRAManagement/
│   │   │   ├── GRATabs.jsx
│   │   │   ├── NotificationList.jsx
│   │   │   ├── StudentForm.jsx
│   │   │   └── EmailTemplateEditor.jsx
│   │   │
│   │   └── LCFCManagement/
│   │       ├── LCFCTabs.jsx
│   │       ├── ConfigurationForm.jsx
│   │       └── StudentNotificationList.jsx
│   │
│   ├── (survey)/
│   │   ├── SurveyForm.jsx
│   │   ├── OutcomesTable.jsx
│   │   ├── SurveyHeader.jsx
│   │   └── SurveyFooter.jsx
│   │
│   ├── (shared)/
│   │   ├── Table/
│   │   │   └── DataTable.jsx
│   │   ├── Forms/
│   │   │   ├── TextInput.jsx
│   │   │   ├── SelectInput.jsx
│   │   │   └── TextArea.jsx
│   │   ├── Modals/
│   │   │   ├── ConfirmModal.jsx
│   │   │   ├── ErrorModal.jsx
│   │   │   └── SuccessModal.jsx
│   │   └── Navigation/
│   │       └── TabNavigation.jsx
│   │
│   └── Layout/
│       ├── Navbar.jsx
│       ├── Sidebar.jsx
│       └── MainLayout.jsx
│
├── middleware.js                    # Autenticación global
├── next.config.js
├── tailwind.config.js
└── package.json
```

### 5.2 Migración de Servicios Específicos

#### DE: pppService.js (React)

```javascript
class PPPManagementService {
  async downloadTemplate(requestData) {
    const response = await this.httpHelper.post('excel/template-PPP', requestData)
    // ...procesar Blob
  }
}
```

#### A: Server Action (Next.js)

```javascript
// lib/actions/ppp-actions.js
'use server'

import { cookies } from 'next/headers'

export async function downloadPPPTemplate(requestData) {
  try {
    const response = await fetch(
      `${process.env.BACKEND_URL}/excel/template-PPP`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${(await cookies()).get('auth')?.value}`
        },
        body: JSON.stringify(requestData)
      }
    )
    
    if (!response.ok) throw new Error('API Error')
    
    const data = await response.json()
    return {
      fileContents: data.fileContents,
      fileName: data.fileDownloadName,
      contentType: data.contentType
    }
  } catch (error) {
    throw new Error(`Error descargando plantilla: ${error.message}`)
  }
}
```

#### En Componente (Cliente):

```javascript
// app/(protected)/management/ppp/download/page.jsx
'use client'

import { downloadPPPTemplate } from '@/lib/actions/ppp-actions'

export default function DownloadPPPPage() {
  const handleDownload = async () => {
    try {
      const file = await downloadPPPTemplate(requestData)
      
      // Decodificar base64 a Blob
      const byteCharacters = atob(file.fileContents)
      const byteArray = new Uint8Array(byteCharacters.length)
      for (let i = 0; i < byteCharacters.length; i++) {
        byteArray[i] = byteCharacters.charCodeAt(i)
      }
      const blob = new Blob([byteArray], { type: file.contentType })
      
      // Trigger descarga
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = file.fileName
      a.click()
    } catch (error) {
      console.error(error)
    }
  }
  
  return (
    <div>
      <button onClick={handleDownload}>Descargar Plantilla</button>
    </div>
  )
}
```

---

## 6. TABLA COMPARATIVA DE ENDPOINTS

| Operación | Actual (React) | Next.js |
|-----------|---|---|
| **Obtener plantilla PPP** | `pppService.downloadTemplate()` | `downloadPPPTemplate()` (Server Action) |
| **Carga masiva PPP** | `pppService.massiveUpload()` | `uploadPPPMassive()` (Server Action) |
| **Listar competencias** | `pppService.getCompetenceList()` | `getPPPCompetenceList()` (Server Action) |
| **Agregar competencia** | `pppService.addCompetence()` | `addPPPCompetence()` (Server Action) |
| **Editar competencia** | `pppService.updateCompetence()` | `updatePPPCompetence()` (Server Action) |
| **Eliminar competencia** | `pppService.deleteCompetence()` | `deletePPPCompetence()` (Server Action) |
| **Generar reporte** | `reportService.fetchPDFReporte()` | `generateReport()` (Server Action) |
| **Verificar token** | `surveyService.verifyToken()` | `verifySurveyToken()` (Server Action) |
| **Obtener outcomes** | `surveyService.getOutcomes()` | `getSurveyOutcomes()` (Server Action) |
| **Enviar respuesta** | `surveyService.sendData()` | `submitSurveyResponse()` (Server Action) |

---

## 7. MAPA DE NAVEGACIÓN POST-MIGRACIÓN

```
HOME PAGE (/)
│
├─ /login (Autenticación)
│
├─ (PROTEGIDO) /management/
│   │
│   ├─ ppp/                          [PPP - Prácticas Pre-Profesionales]
│   │   ├─ page.jsx                  # Tabs: Download/Upload/Reports/Config
│   │   ├─ download/                 # Descarga plantilla
│   │   ├─ upload/                   # Carga masiva
│   │   ├─ reports/                  # Reportes
│   │   │   ├─ perception            # Percepción promedio
│   │   │   └─ by-outcome            # Por outcome
│   │   └─ config/                   # Configuración
│   │       ├─ general-competence    # Competencias generales
│   │       ├─ specific-competence   # Competencias específicas
│   │       └─ acceptance-levels     # Niveles de aceptación
│   │
│   ├─ graduando/                    [GRADUADO - Encuestas de Graduandos]
│   │   ├─ page.jsx                  # Tabs: Reports/Notifications/Config
│   │   ├─ reports/                  # 3 tipos de reportes
│   │   ├─ notifications/            # Gestión de notificaciones
│   │   │   ├─ add-student           # Agregar estudiante
│   │   │   ├─ edit-email            # Editar plantilla
│   │   │   ├─ upload-students       # Carga masiva
│   │   │   └─ list-students         # Listar/eliminar
│   │   └─ config/                   # Configuración
│   │       ├─ general-competence
│   │       └─ specific-competence
│   │
│   └─ lcfc/                         [LCFC - Logro de Fin de Ciclo]
│       ├─ page.jsx                  # Tabs: Reports/Notifications/Config
│       ├─ reports/                  # Reportes de LCFC
│       ├─ notifications/            # Gestión de estudiantes
│       └─ config/                   # Configuración de ciclos
│
└─ (PÚBLICO) /survey/
    ├─ lcfc/?escuela=1&token=ABC     # Encuesta LCFC (token)
    ├─ gra/?escuela=1&token=ABC      # Encuesta GRA (token)
    └─ ppp/?escuela=1&token=ABC      # Encuesta PPP (token)
```

---

**Fin de Diagramas Técnicos**. Estos diagramas proporcionan una representación visual clara de cómo migrar y estructurar el sistema en Next.js.

