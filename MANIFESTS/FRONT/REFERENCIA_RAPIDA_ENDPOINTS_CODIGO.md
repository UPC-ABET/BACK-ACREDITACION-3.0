# REFERENCIA RÁPIDA - ENCUESTAS ABET
## Ejemplos de Código y Endpoints Listos para Usar

---

## 1. ENDPOINTS POR CATEGORÍA

### 1.1 ENDPOINTS DE CONFIGURACIÓN

```
PPP - PRÁCTICAS PRE-PROFESIONALES
├─ POST   /Survey/list-ppp-configurations         (Listar competencias)
├─ POST   /Survey/add-update-ppp-config           (Crear/actualizar)
├─ POST   /Survey/get-by-id-ppp-config            (Obtener detalle)
├─ DELETE /Survey/Delete-by-Id-config             (Eliminar)
├─ POST   /Survey/ReplicarConfiguracionPPP        (Clonar config)
└─ POST   /Survey/list-Outcomes                   (Listar outcomes)

GRADUADO
├─ POST   /Survey/list-gra-configurations         (Listar competencias)
├─ POST   /Survey/add-update-gra-config           (Crear/actualizar)
├─ POST   /Survey/get-by-id-gra-config            (Obtener detalle)
├─ DELETE /Survey/Delete-gra-config               (Eliminar)
├─ POST   /Survey/ReplicarConfiguracionGRA        (Clonar config)
└─ POST   /Survey/list-Outcomes                   (Listar outcomes)

LCFC
├─ POST   /lcfc/configuracion/pageable            (Listar cursos)
├─ POST   /lcfc/configuracion/clonar              (Clonar config)
├─ POST   /lcfc/configuracion/cambio              (Cambiar estado)
└─ POST   /lcfc/configuracion/generar/escuela/{escuela}/periodo/{periodo}
```

### 1.2 ENDPOINTS DE PLANTILLAS Y CARGA

```
DESCARGA DE PLANTILLAS
├─ POST   /excel/template-PPP                     (Plantilla PPP)
├─ POST   /excel/template-GRA                     (Plantilla GRA)
└─ POST   /excel/template-LCFC                    (Plantilla LCFC)

CARGA MASIVA
├─ POST   /excel/upload-PPP                       (Carga masiva PPP)
├─ POST   /excel/uploadNotificationEncuesta-GRA   (Carga estudiantes GRA)
└─ POST   /excel/uploadNotificationEncuesta-LCFC  (Carga estudiantes LCFC)
```

### 1.3 ENDPOINTS DE NOTIFICACIONES Y EMAIL

```
GESTIÓN DE EMAILS
├─ POST   /email/getConfigurationNotification-GRA (Obtener plantilla)
├─ POST   /email/saveConfirmationNotif-GRA        (Guardar plantilla)
├─ POST   /email/emailSurvey-GRA                  (Enviar encuesta)

ESTUDIANTES
├─ POST   /email/findStudentCode-career-GRA       (Buscar estudiante)
├─ POST   /email/saveNotification-GRA             (Agregar a notificación)
├─ POST   /email/deleteNotification-GRA           (Eliminar de notificación)
├─ POST   /email/listStudentNotification-GRA      (Listar notificados)

LCFC
├─ POST   /lcfc/notificacion/paginado             (Listar estudiantes)
├─ GET    /lcfc/notificacion/parametros           (Parámetros email)
└─ POST   /lcfc/notificacion/envio                (Enviar notificaciones)
```

### 1.4 ENDPOINTS DE SURVEY (ESTUDIANTE)

```
├─ GET    /lcfc/notificacion/escuela/{escuela}/token/{token}
│         (Verificar token)
│
├─ GET    /lcfc/encuesta/escuela/{escuela}/idioma/es-PE/alumno/{idAlumno}/...
│         (Obtener outcomes para completar)
│
└─ POST   /lcfc/encuesta/completar
          (Enviar respuestas)
```

### 1.5 ENDPOINTS DE REPORTES

```
├─ POST   /report/ppp-perception                  (Reporte PPP)
├─ POST   /report/gra-perception                  (Reporte GRA)
├─ POST   /lcfc/reporte/percepcion                (Reporte LCFC percepción)
└─ POST   /dashboard/encuesta-*                   (Estado en dashboard)
```

---

## 2. ESTRUCTURAS DE REQUEST

### 2.1 Request Base Estándar

```javascript
{
  body: {
    escuela: "1",                  // Obligatorio
    idioma: "es-PE",               // Obligatorio
    idPeriodoAcademico: 2024001,   // Varía según contexto
    idCarrera: 456,                // 0 = todas
    // ... más campos según endpoint
  },
  page: {
    pageNumber: 0,                 // 0-indexed
    pageSize: -1                   // -1 = todos, ó N registros
  }
}
```

### 2.2 Obtener Lista de Competencias

```javascript
// REQUEST
{
  body: {
    escuela: "1",
    idioma: "es-PE",
    idPeriodoAcademico: 2024001,
    idCarrera: 0  // 0 para obtener de todas las carreras
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
      competenciaEspecifica: "Análisis",
      descripcion: "Capacidad de análisis...",
      nivelAceptacion: 3,
      estado: "ACTIVO",
      idCarrera: 456,
      idPeriodo: 2024001
    }
  ],
  message: "Consulta exitosa"
}
```

### 2.3 Agregar Nueva Competencia

```javascript
// REQUEST - POST /Survey/add-update-ppp-config
{
  body: {
    escuela: "1",
    idioma: "es-PE",
    id: 0,  // 0 = crear nuevo
    competenciaGeneral: "Comunicación",
    competenciaEspecifica: "Expresión Escrita",
    descripcion: "Capacidad de escribir de manera clara y estructurada",
    nivelAceptacion: 3,
    idPeriodoAcademico: 2024001,
    idCarrera: 456
  }
}

// RESPONSE
{
  success: true,
  data: {
    id: 1002,
    message: "Competencia creada exitosamente"
  }
}
```

### 2.4 Actualizar Competencia Existente

```javascript
// REQUEST - POST /Survey/add-update-ppp-config
{
  body: {
    escuela: "1",
    idioma: "es-PE",
    id: 1001,  // ID existente (no 0)
    competenciaGeneral: "Pensamiento Crítico - MEJORADO",
    competenciaEspecifica: "Análisis Profundo",
    descripcion: "Capacidad mejorada...",
    nivelAceptacion: 4,
    idPeriodoAcademico: 2024001,
    idCarrera: 456
  }
}

// RESPONSE
{
  success: true,
  data: {
    id: 1001,
    message: "Competencia actualizada exitosamente"
  }
}
```

### 2.5 Eliminar Competencia

```javascript
// REQUEST - DELETE /Survey/Delete-by-Id-config
{
  id: 1001
}

// RESPONSE
{
  success: true,
  message: "Competencia eliminada exitosamente"
}
```

### 2.6 Clonar Configuración de Ciclo

```javascript
// REQUEST - POST /Survey/ReplicarConfiguracionPPP
{
  body: {
    escuela: "1",
    idCarreraOrigen: 456,        // Carrera origen
    idPeriodoOrigen: 2024001,    // Período origen
    idCarreraDestino: 456,       // Carrera destino
    idPeriodoDestino: 2024002    // Período destino
  }
}

// RESPONSE
{
  success: true,
  data: {
    registrosCopados: 15,
    configuracionOriginal: { /* array */ },
    configuracionNueva: { /* array */ }
  },
  message: "Configuración clonada exitosamente"
}
```

### 2.7 Descargar Plantilla Excel

```javascript
// REQUEST - POST /excel/template-PPP
{
  body: {
    escuela: "1",
    idioma: "es-PE",
    idPeriodoAcademico: 2024001
  }
}

// RESPONSE (JSON)
{
  success: true,
  data: {
    resource: {
      fileContents: "SUQsQ2FycmVyYSxDb21wZXRlbmNpYSxEZXNjcmlwY2lvbixOaXZlbCxFc3RhZG8...",
      contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      fileDownloadName: "PPP_Plantilla_2024-I.xlsx"
    }
  }
}

// PROCESAR EN CLIENTE:
// atob(fileContents) → Uint8Array → Blob → descarga
```

### 2.8 Carga Masiva de Datos

```javascript
// REQUEST - POST /excel/upload-PPP
{
  idCarrera: 0,
  validarCarrera: false,
  escuelaId: "1",
  escuelaActual: {
    id: 1,
    nombre: "Escuela de Ingeniería",
    cod: "EI"
  },
  archivoBase64: "SUQsQ2FycmVyYSxDb21wZXRlbmNpY...",  // Base64 del Excel
  nombreArchivo: "datos_ppp_2024-I.xlsx"
}

// RESPONSE (Blob)
// Blob contiene archivo con reporte de:
// - Filas procesadas
// - Filas con error
// - Detalles de cada error
```

### 2.9 Buscar Estudiante por Código

```javascript
// REQUEST - POST /email/findStudentCode-career-GRA
{
  codigoEstudiante: "2020001",
  idCarrera: 456
}

// RESPONSE
{
  success: true,
  data: {
    resource: {
      idEstudiante: 123,
      codigo: "2020001",
      nombre: "Juan Pérez López",
      email: "juan.perez@estudiantes.upc.edu.pe",
      carrera: "Ingeniería Informática",
      ciclo: "2024-I"
    }
  }
}
```

### 2.10 Agregar Estudiante a Notificación

```javascript
// REQUEST - POST /email/saveNotification-GRA
{
  idEstudiante: 123,
  idEncuesta: 789,
  emailEstudiante: "juan.perez@estudiantes.upc.edu.pe",
  nombreEstudiante: "Juan Pérez"
}

// RESPONSE
{
  success: true,
  message: "Estudiante agregado a notificación"
}
```

### 2.11 Listar Estudiantes Notificados

```javascript
// REQUEST - POST /email/listStudentNotification-GRA
{
  idEncuesta: 789,
  pageNumber: 0,
  pageSize: 20
}

// RESPONSE
{
  success: true,
  data: {
    resource: [
      {
        idNotificacion: 1,
        idEstudiante: 123,
        codigoEstudiante: "2020001",
        nombreEstudiante: "Juan Pérez",
        emailEstudiante: "juan.perez@...",
        estadoEnvio: "ENVIADO",
        fechaEnvio: "2024-03-15T10:30:00",
        estadoRespuesta: "RESPONDIDO",
        fechaRespuesta: "2024-03-16T14:20:00"
      }
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

### 2.12 Editar Plantilla de Email

```javascript
// REQUEST - POST /email/saveConfirmationNotif-GRA
{
  idEncuesta: 789,
  asunto: "Encuesta de Graduandos UPC 2024",
  cuerpo: "Estimado [NOMBRE_ESTUDIANTE],\n\nInvitamos a completar...",
  htmlContent: "<html>...</html>",
  idiomaTemplate: "es-PE"
}

// RESPONSE
{
  success: true,
  message: "Plantilla guardada exitosamente"
}

// PARÁMETROS DISPONIBLES:
// [NOMBRE_ESTUDIANTE]
// [CODIGO_ESTUDIANTE]
// [EMAIL_ESTUDIANTE]
// [CARRERA]
// [CICLO]
// [LINK_ENCUESTA]
// [FECHA_ENVIO]
```

### 2.13 Enviar Encuestas por Email

```javascript
// REQUEST - POST /email/emailSurvey-GRA
{
  idEncuesta: 789,
  destinatarios: "TODOS",  // "TODOS" o "SELECCIONADOS"
  idsSeleccionados: [1, 2, 3],  // Si es SELECCIONADOS
  asunto: "Encuesta de Graduandos",
  cuerpoEmail: "..."
}

// RESPONSE
{
  success: true,
  data: {
    enviados: 145,
    fallidos: 5,
    detallesFallo: [
      { idEstudiante: 10, razon: "Email inválido" }
    ]
  },
  message: "Encuestas enviadas: 145 exitosos, 5 fallidos"
}
```

### 2.14 Verificar Token de Encuesta

```javascript
// REQUEST - GET /lcfc/notificacion/escuela/1/token/ABC123XYZ

// RESPONSE
{
  success: true,
  resource: {
    escuela: "1",
    escuelaId: 1,
    nombreEscuela: "Escuela de Ingeniería",
    nombreCarrera: "Ingeniería Informática",
    ciclo: "2024-I",
    codigoEstudiante: "2020001",
    nombreEstudiante: "Juan Pérez",
    nombreCurso: "Programación I",
    cursoCodigo: "CC101",
    estado: false,  // false = pendiente, true = respondida
    alumnoId: 123,
    encuestaId: 789,
    tokenValido: true,
    diasRestantes: 10
  }
}
```

### 2.15 Obtener Outcomes para Completar

```javascript
// REQUEST - GET /lcfc/encuesta/escuela/1/idioma/es-PE/alumno/123/...

// RESPONSE
{
  success: true,
  data: {
    resource: {
      escuela: "1",
      nombreEscuela: "Escuela de Ingeniería",
      nombreCarrera: "Ingeniería Informática",
      ciclo: "2024-I",
      nombreCurso: "Programación I",
      cursoCodigo: "CC101",
      encuestaId: 789,
      lista: [
        {
          comisionNombre: "Comisión A",
          comisionId: 10,
          outcomes: [
            {
              outcomeId: 1,
              competenciaGeneral: "Pensamiento Crítico",
              competenciaEspecifica: "Análisis de Problemas",
              descripcion: "Capacidad de identificar y resolver...",
              desempeno: null,  // A llenar por alumno
              tipoRespuesta: "LIKERT",  // 1-5 o similar
              pesaje: 1
            }
          ]
        },
        {
          comisionNombre: "Comisión B",
          comisionId: 11,
          outcomes: [ /* ... */ ]
        }
      ]
    }
  }
}
```

### 2.16 Enviar Respuesta de Encuesta

```javascript
// REQUEST - POST /lcfc/encuesta/completar
{
  comentario: "Los contenidos fueron claros y bien estructurados. Excelentes profesores.",
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
    },
    {
      comisionId: 11,
      outcomeId: 3,
      puntaje: 5,
      descripcion: ""
    }
  ]
}

// RESPONSE
{
  success: true,
  data: {
    message: "Encuesta completada exitosamente",
    encuestaId: 789,
    fechaCompletacion: "2024-03-20T16:45:00"
  }
}
```

---

## 3. EJEMPLOS DE CÓDIGO - REACT (ACTUAL)

### 3.1 Hook para Descarga de Archivo

```javascript
// useFileDownload.js
import { useState } from 'react'

export const useFileDownload = () => {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const downloadFile = async (serviceMethod, fileName) => {
    setLoading(true)
    setError(null)
    
    try {
      const result = await serviceMethod()
      const url = window.URL.createObjectURL(result.blob)
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', result.fileName || fileName)
      document.body.appendChild(link)
      link.click()
      link.parentNode.removeChild(link)
      window.URL.revokeObjectURL(url)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return { downloadFile, loading, error }
}

// Uso:
const { downloadFile, loading } = useFileDownload()

const handleDownload = async () => {
  await downloadFile(
    () => pppService.downloadTemplate(requestData),
    'PPP_Template.xlsx'
  )
}
```

### 3.2 Hook para Carga Masiva de Archivo

```javascript
// useFileUpload.js
import { useState } from 'react'

export const useFileUpload = () => {
  const [file, setFile] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [error, setError] = useState(null)
  const [response, setResponse] = useState(null)

  const validateFile = (file) => {
    const validExtensions = ['.xlsx', '.xls', '.csv']
    const fileExtension = file.name.substring(file.name.lastIndexOf('.'))
    
    if (!validExtensions.includes(fileExtension)) {
      throw new Error('Formato inválido. Use .xlsx, .xls o .csv')
    }
    
    if (file.size > 10 * 1024 * 1024) {
      throw new Error('Archivo muy grande. Máximo 10MB')
    }
  }

  const uploadFile = async (selectedFile, uploadService) => {
    try {
      validateFile(selectedFile)
      setFile(selectedFile)
      setUploading(true)
      setError(null)

      const result = await uploadService(selectedFile)
      setResponse(result)
    } catch (err) {
      setError(err.message)
    } finally {
      setUploading(false)
    }
  }

  return {
    file,
    uploading,
    uploadProgress,
    error,
    response,
    uploadFile
  }
}

// Uso:
const { uploadFile, uploading, error, response } = useFileUpload()

const handleUpload = async (selectedFile) => {
  await uploadFile(selectedFile, (file) => pppService.massiveUpload(file))
}
```

### 3.3 Componente de Tabla de Competencias

```javascript
// GeneralCompetenceComponent.jsx
import { useState, useEffect } from 'react'
import Table from '@/components/Table/Table'
import Modal from '@/components/Modal'
import pppService from '@/api/pppService'

export default function GeneralCompetenceComponent({ cycleId }) {
  const [competences, setCompetences] = useState([])
  const [loading, setLoading] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState({
    competencia: '',
    descripcion: '',
    nivelAceptacion: 3
  })

  useEffect(() => {
    loadCompetences()
  }, [cycleId])

  const loadCompetences = async () => {
    setLoading(true)
    try {
      const data = await pppService.getCompetenceList({
        body: {
          idPeriodoAcademico: cycleId,
          idCarrera: 0,
          escuela: "1"
        }
      })
      setCompetences(data)
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    try {
      const requestData = {
        id: editingId || 0,
        competenciaGeneral: form.competencia,
        descripcion: form.descripcion,
        nivelAceptacion: form.nivelAceptacion,
        idPeriodoAcademico: cycleId,
        escuela: "1"
      }

      if (editingId) {
        await pppService.updateCompetence(requestData)
      } else {
        await pppService.addCompetence(requestData)
      }

      loadCompetences()
      setShowModal(false)
      resetForm()
    } catch (error) {
      console.error('Error:', error)
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('¿Desea eliminar esta competencia?')) return

    try {
      await pppService.deleteCompetence({ id })
      loadCompetences()
    } catch (error) {
      console.error('Error:', error)
    }
  }

  const resetForm = () => {
    setForm({ competencia: '', descripcion: '', nivelAceptacion: 3 })
    setEditingId(null)
  }

  const columns = [
    { title: 'Competencia', data: 'competenciaGeneral', type: 'text' },
    { title: 'Descripción', data: 'descripcion', type: 'text', width: '40%' },
    { title: 'Nivel', data: 'nivelAceptacion', type: 'number' },
    {
      title: 'Acciones',
      type: 'actions',
      actions: [
        {
          label: 'Editar',
          onClick: (row) => {
            setEditingId(row.id)
            setForm({
              competencia: row.competenciaGeneral,
              descripcion: row.descripcion,
              nivelAceptacion: row.nivelAceptacion
            })
            setShowModal(true)
          }
        },
        {
          label: 'Eliminar',
          onClick: (row) => handleDelete(row.id)
        }
      ]
    }
  ]

  return (
    <div>
      <button onClick={() => setShowModal(true)}>+ Agregar</button>

      <Table columns={columns} data={competences} loading={loading} />

      {showModal && (
        <Modal
          title={editingId ? 'Editar' : 'Agregar'}
          onClose={() => {
            setShowModal(false)
            resetForm()
          }}
        >
          <form>
            <input
              value={form.competencia}
              onChange={(e) => setForm({ ...form, competencia: e.target.value })}
              placeholder="Competencia"
            />
            <textarea
              value={form.descripcion}
              onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
              placeholder="Descripción"
            />
            <input
              type="number"
              min="1"
              max="5"
              value={form.nivelAceptacion}
              onChange={(e) =>
                setForm({ ...form, nivelAceptacion: parseInt(e.target.value) })
              }
            />
            <button type="button" onClick={handleSave}>
              {editingId ? 'Actualizar' : 'Guardar'}
            </button>
          </form>
        </Modal>
      )}
    </div>
  )
}
```

---

## 4. EJEMPLOS DE CÓDIGO - NEXT.JS (PROPUESTO)

### 4.1 Server Action para Descargar Plantilla

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

    if (!response.ok) {
      throw new Error(`API Error: ${response.statusText}`)
    }

    const data = await response.json()

    return {
      fileContents: data.fileContents,
      fileName: data.fileDownloadName,
      contentType: data.contentType,
      success: true
    }
  } catch (error) {
    return {
      success: false,
      error: error.message
    }
  }
}
```

### 4.2 Componente para Descargar (Client)

```javascript
// app/(protected)/management/ppp/download/page.jsx
'use client'

import { useState } from 'react'
import { downloadPPPTemplate } from '@/lib/actions/ppp-actions'

export default function DownloadPPPPage() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const handleDownload = async () => {
    setLoading(true)
    setError(null)

    try {
      const result = await downloadPPPTemplate({
        body: {
          escuela: "1",
          idioma: "es-PE",
          idPeriodoAcademico: 2024001
        }
      })

      if (!result.success) {
        setError(result.error)
        return
      }

      // Decodificar base64
      const byteCharacters = atob(result.fileContents)
      const byteArray = new Uint8Array(byteCharacters.length)
      for (let i = 0; i < byteCharacters.length; i++) {
        byteArray[i] = byteCharacters.charCodeAt(i)
      }

      // Crear Blob
      const blob = new Blob([byteArray], { type: result.contentType })

      // Trigger descarga
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = result.fileName
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Descargar Plantilla PPP</h1>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      <button
        onClick={handleDownload}
        disabled={loading}
        className="bg-blue-500 text-white px-6 py-2 rounded disabled:opacity-50"
      >
        {loading ? 'Descargando...' : 'Descargar Plantilla'}
      </button>
    </div>
  )
}
```

### 4.3 Hook para Listar Competencias (Next.js)

```javascript
// hooks/usePPPCompetences.js
'use client'

import { useState, useEffect } from 'react'
import { getPPPCompetences } from '@/lib/actions/ppp-actions'

export function usePPPCompetences(cycleId) {
  const [competences, setCompetences] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const loadCompetences = async () => {
    if (!cycleId) return

    setLoading(true)
    setError(null)

    try {
      const data = await getPPPCompetences({
        idPeriodoAcademico: cycleId,
        idCarrera: 0,
        escuela: "1"
      })

      if (data.success) {
        setCompetences(data.data)
      } else {
        setError(data.error)
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadCompetences()
  }, [cycleId])

  return { competences, loading, error, refetch: loadCompetences }
}

// Uso en componente:
const { competences, loading } = usePPPCompetences(cycleId)
```

### 4.4 Tabla de Competencias (Next.js)

```javascript
// components/(admin)/PPPManagement/CompetenceTable.jsx
'use client'

import { useState } from 'react'
import { usePPPCompetences } from '@/hooks/usePPPCompetences'
import { addPPPCompetence, deletePPPCompetence } from '@/lib/actions/ppp-actions'
import Modal from '@/components/Modal'
import DataTable from '@/components/DataTable'

export default function CompetenceTable({ cycleId }) {
  const { competences, loading, refetch } = usePPPCompetences(cycleId)
  const [showModal, setShowModal] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState({
    competencia: '',
    descripcion: '',
    nivelAceptacion: 3
  })

  const handleSave = async () => {
    try {
      const result = await addPPPCompetence({
        id: editingId || 0,
        competenciaGeneral: form.competencia,
        descripcion: form.descripcion,
        nivelAceptacion: form.nivelAceptacion,
        idPeriodoAcademico: cycleId,
        escuela: "1"
      })

      if (result.success) {
        await refetch()
        setShowModal(false)
        setForm({ competencia: '', descripcion: '', nivelAceptacion: 3 })
        setEditingId(null)
      }
    } catch (error) {
      console.error('Error:', error)
    }
  }

  const handleDelete = async (id) => {
    if (confirm('¿Desea eliminar?')) {
      const result = await deletePPPCompetence(id)
      if (result.success) {
        await refetch()
      }
    }
  }

  const columns = [
    { key: 'competenciaGeneral', label: 'Competencia' },
    { key: 'descripcion', label: 'Descripción' },
    { key: 'nivelAceptacion', label: 'Nivel' },
    {
      key: 'actions',
      label: 'Acciones',
      render: (row) => (
        <div className="flex gap-2">
          <button onClick={() => {/* edit */ }}>Editar</button>
          <button onClick={() => handleDelete(row.id)}>Eliminar</button>
        </div>
      )
    }
  ]

  return (
    <div>
      <button onClick={() => setShowModal(true)}>+ Agregar</button>

      <DataTable
        columns={columns}
        data={competences}
        loading={loading}
      />

      {showModal && (
        <Modal
          title={editingId ? 'Editar' : 'Agregar'}
          onClose={() => setShowModal(false)}
        >
          <form onSubmit={(e) => {
            e.preventDefault()
            handleSave()
          }}>
            {/* Form fields */}
            <button type="submit">Guardar</button>
          </form>
        </Modal>
      )}
    </div>
  )
}
```

---

## 5. VARIABLES DE ENTORNO

```bash
# .env.local (Development)
NEXT_PUBLIC_API_URL=http://localhost:3000
BACKEND_URL=http://localhost:8080
DATABASE_URL=...

# .env.production
NEXT_PUBLIC_API_URL=https://app.example.com
BACKEND_URL=https://api.example.com
DATABASE_URL=...
```

---

## 6. TABLA DE EQUIVALENCIAS REACT → NEXT.JS

| Concepto | React (Actual) | Next.js (Propuesto) |
|---|---|---|
| **Servicio API** | `new PPPService()` → métodos async | Server Action `getPPPData()` |
| **Hook de datos** | `useEffect` + `useState` | `useQuery` o Server Component |
| **Validación** | Client-side en componente | Validación en Server Action |
| **Contexto global** | `useContext(ReportContext)` | Zustand store o Context API |
| **Autenticación** | `AuthProvider` wrapper | Middleware + NextAuth.js |
| **Descarga archivos** | `window.URL.createObjectURL()` | Fetch blob + trigger download |
| **Carga archivos** | `FileReader` en componente | FormData + Server Action |
| **Routing** | React Router | Next.js file-based routing |
| **Parámetros URL** | `useSearchParams()` (React Router) | `searchParams` prop o `useSearchParams()` |
| **Notificaciones** | Toast library | toast library (similar) |

---

**Fin de Referencia Rápida**. Este documento proporciona ejemplos completos y listos para implementar.

