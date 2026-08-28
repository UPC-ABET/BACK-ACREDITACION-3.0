# Frontend — Reporte RC: nuevo layout y descarga por una sola sede

Rama backend: `feat/rc-report-consolidated-layout` · commit `c3a5159c`
Registro completo del cambio: `openspec/changes/rc-report-consolidated-layout/`

---

## TL;DR — lo único que rompe el front

**El selector de sede de los botones de descarga tiene que pasar a selección única.**

Antes, mandar 2+ sedes devolvía un **ZIP** (`application/zip`) con un PDF por sede. Eso ya no
existe: ahora devuelve **`400`**. Si el front sigue mandando un array de varias sedes, la descarga
falla.

| `campusIds` que manda el front | Antes             | Ahora                                               |
| ------------------------------ | ----------------- | --------------------------------------------------- |
| omitido / `[]`                 | 1 PDF consolidado | 1 PDF consolidado (`SEDE: TODAS`) ✅ igual          |
| `[3]`                          | 1 PDF de esa sede | 1 PDF de esa sede ✅ igual                          |
| `[3, 7]`                       | ZIP con 2 PDFs    | ❌ `400 error.semaphoreReport.singleCampusRequired` |
| `[1, 2, 3]` (= todas)          | 1 PDF consolidado | ❌ `400` (mandar `[]` para consolidado)             |

Aplica a los **cuatro** endpoints de descarga: `rc/pdf`, `rc/excel`, `rv/pdf`, `rv/excel`.
**No** aplica a los endpoints JSON de pantalla (`rc`, `rv`), que siguen aceptando N sedes.

> Ojo con el último caso: si el front tenía un "seleccionar todas" que marcaba los ids uno por
> uno, hay que traducirlo a **array vacío / campo omitido**, no a la lista completa de ids.

---

## 1. Endpoints

Prefijo global: **`/api`**. Todo es `POST` (incluidas las lecturas).

| Uso                  | Ruta                                              | Respuesta                 |
| -------------------- | ------------------------------------------------- | ------------------------- |
| Grilla RC (pantalla) | `POST /api/evaluation/semaphore-reports/rc`       | JSON                      |
| Descargar PDF RC     | `POST /api/evaluation/semaphore-reports/rc/pdf`   | binario `application/pdf` |
| Descargar Excel RC   | `POST /api/evaluation/semaphore-reports/rc/excel` | binario XLSX              |
| Grilla RV (pantalla) | `POST /api/evaluation/semaphore-reports/rv`       | JSON                      |
| Descargar PDF RV     | `POST /api/evaluation/semaphore-reports/rv/pdf`   | binario `application/pdf` |
| Descargar Excel RV   | `POST /api/evaluation/semaphore-reports/rv/excel` | binario XLSX              |

### Headers obligatorios

| Header                 | Valor                                                     |
| ---------------------- | --------------------------------------------------------- |
| `X-Academic-Period-Id` | id entero del periodo académico activo. **Sin él → 400.** |
| `Authorization`        | `Bearer <token>` (también acepta la cookie de sesión)     |
| `Content-Type`         | `application/json`                                        |

Permiso requerido: módulo `EVALUATION`, acción `POST`.

> `X-Academic-Period-Id` es el que define el periodo del reporte. Si te llega un reporte vacío o
> lentísimo, lo primero a revisar es que ese header lleve el periodo correcto y no un residuo.

---

## 2. Body — `SemaphoreFilterDto`

```ts
interface SemaphoreFilterDto {
	/** Comisión de programa. Filtra los outcomes. Muy recomendado mandarlo (ver §6). */
	programCommissionId?: number;
	/** Un outcome puntual. Omitir = todos los outcomes de la comisión. */
	outcomeId?: number;
	/**
	 * Sedes.
	 * - Descargas (pdf/excel): 0 o 1 elemento. 2+ → 400.
	 * - Pantalla (rc/rv): cualquier cantidad.
	 */
	campusIds?: number[];
	/** 'es' | 'en'. Default 'es'. Afecta textos del PDF/Excel y el idioma de los JSONB. */
	lang?: 'es' | 'en';
	/** Solo RV. Deprecado, preferir gradeTypeIds. */
	rubricIds?: number[];
	/** Solo RV. Tipos de nota (core.types, grupo TG205). */
	gradeTypeIds?: number[];
}
```

Notas de validación:

- `campusIds` acepta hasta 50 elementos a nivel DTO; el límite de 1 en descargas lo aplica el
  servicio, no `class-validator`. O sea: **el 400 llega con la forma de error de negocio**
  (§4), no con la de `error.validation`.
- Números vacíos / `''` / `null` se normalizan a `undefined`, así que no hace falta limpiar el
  payload en el front.

### De dónde salen los catálogos

| Selector   | Endpoint                                                                                 |
| ---------- | ---------------------------------------------------------------------------------------- |
| Sede       | `POST /api/campuses/get-by-filters` (o `GET /api/campuses/get-all`)                      |
| Niveles RC | `POST /api/performance-levels/get-by-filters` `{ "instrumentTypeId": <id del tipo RC> }` |

⚠️ El `instrumentTypeId: 28` del ejemplo es el **PK de `core.types` en tu entorno** y cambia entre
ambientes. No lo hardcodees: resuélvelo por el código de tipo (`TG206-T003` = RC,
`TG206-T004` = RV) o desde un catálogo de tipos.

Para el PDF **no necesitas** llamar a `performance-levels`: el backend ya inyecta los niveles en el
documento. Solo lo necesitas si quieres pintar la misma barra de colores **en pantalla**.

---

## 3. Respuesta de los endpoints JSON (pantalla)

Envoltorio estándar de la API:

```json
{
  "code": 200,
  "message": "success.ok",
  "data": { "legend": [...], "summary": [...], "metadata": {...} }
}
```

> **Gotcha:** el status HTTP de estos POST es **201** (default de Nest para POST), aunque el
> `code` del body diga 200. No condiciones nada a `status === 200`; usa `res.ok`.

```ts
interface SemaphoreReportDto {
	legend: Array<{
		name: string; // "Necesita Mejora"
		minScore: number; // 0
		maxScore: number; // 12.999999  ← ojo, ver §5
		color: string; // "#e30613"
	}>;
	summary: Array<{
		campus: string; // nombre, NO id
		academicPeriodCycle: string;
		courseCode: string;
		courseName: string;
		outcomeCode: string;
		outcomeName: string;
		totalStudents: number;
		studentsRed: number;
		studentsYellow: number;
		studentsGreen: number;
		percentageRed: number; // 13.89
		percentageYellow: number;
		percentageGreen: number;
		isCritical: boolean; // percentageRed >= 23
		color: string;
	}>;
	metadata: {
		programName: string;
		commissionName: string;
		academicPeriodCode: string;
		accreditorCode: string;
	};
}
```

**Sin cambios en este contrato.** `summary` trae `campus` como nombre y **no** trae `campusId`;
si necesitas cruzar por id, usa el catálogo de sedes.

Si no hay datos → `404` con `error.semaphoreReport.noData`.

---

## 4. Manejo de errores

El filtro global aplana todo a `{ code, message, data }`. **La clave específica del error viene en
`data[0]`, no en `message`.**

```json
{
	"code": 400,
	"message": "error.semaphoreReport.generateFailed",
	"data": ["error.semaphoreReport.singleCampusRequired"]
}
```

| HTTP | `data[0]`                                    | Qué pasó / qué mostrar                                                                                  |
| ---- | -------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| 400  | `error.semaphoreReport.singleCampusRequired` | 🆕 Mandaste 2+ sedes a una descarga. "Selecciona una sola sede, o ninguna para el reporte consolidado." |
| 404  | `error.semaphoreReport.noData`               | No hay datos para el filtro, o la sede no existe / está inactiva.                                       |
| 503  | `error.semaphoreReport.queryTimeout`         | La consulta pasó los 120 s y Postgres la canceló. Es reintentable — sugerir acotar filtros (ver §6).    |
| 500  | `error.semaphoreReport.queryFailed`          | Falla de BD.                                                                                            |
| 500  | `error.semaphoreReport.excelFailed`          | Falló armar el XLSX.                                                                                    |

Hay que agregar al diccionario i18n del front:

```
error.semaphoreReport.singleCampusRequired
```

> **Cuidado con las descargas:** en el camino de error la respuesta es **JSON**, no binario.
> Si haces `await res.blob()` a ciegas vas a guardar un archivo con un error adentro. Hay que
> chequear `res.ok` **antes** de leer el blob (ver §7).

---

## 5. Qué cambió visualmente en el PDF RC

Orden nuevo del documento:

```
Cabecera:  ACREDITADOR · COMISIÓN · CICLO · SEDE   ← SEDE es nuevo
Gráfico de barras por outcome
▸ Interpretación de Indicadores        ← sección nueva
Resumen por Outcome                     (sin cambios)
▸ Detalle de Cursos por Outcome        ← reemplaza las 3 tablas por nivel
```

**Interpretación de Indicadores** — barra horizontal, un segmento por nivel de desempeño RC, con
ancho proporcional al rango. Cada segmento muestra el nombre y el rango.

**Detalle de Cursos por Outcome** — una sola tabla:

| Outcome | Código   | Curso                       | Necesita Mejora | Esperado    | Sobresaliente | Total de Alumnos |
| ------- | -------- | --------------------------- | --------------- | ----------- | ------------- | ---------------- |
| 1       | 1ACC0200 | FUNDAMENTOS EN PROGRAMACIÓN | (5) 13.89%      | (14) 38.89% | (17) 47.22%   | 36               |
| …       |          |                             |                 |             |               |                  |
|         |          | **TOTALES**                 | **156**         | **783**     | **806**       | **1745**         |

Solo las tres cabeceras de nivel van coloreadas, con el color del nivel. Desaparecieron las tres
tablas "Listado de Cursos con Nivel …".

**El RV no cambió** salvo por el campo `SEDE` en la cabecera. Los dos Excel tampoco cambiaron.

### Si vas a replicar la barra en pantalla

Los rangos **no** se imprimen con `maxScore` tal cual. Las filas están guardadas cerradas
(`[0, 12.999999]`, `[13, 15.999999]`, `[16, 20]`), así que el límite superior de cada nivel es el
`minScore` del **siguiente**, y solo el último cierra con su propio `maxScore`:

```ts
function formatLevelRange(legend: Level[], i: number): string {
	const lower = trim(legend[i].minScore);
	const isLast = i === legend.length - 1;
	const upper = trim(isLast ? legend[i].maxScore : legend[i + 1].minScore);
	return isLast ? `[${lower} - ${upper}]` : `[${lower} - ${upper}>`;
}
// trim = String(Math.round(Number(v) * 100) / 100)
// → "[0 - 13>" · "[13 - 16>" · "[16 - 20]"
```

Y el color del texto sobre cada segmento no puede ser fijo — el nivel del medio suele ser amarillo:

```ts
function contrastText(hex: string): string {
	const c = hex.replace('#', '');
	if (!/^[0-9a-f]{6}$/i.test(c)) return '#ffffff';
	const [r, g, b] = [0, 2, 4].map((o) => parseInt(c.slice(o, o + 2), 16));
	return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.6 ? '#18181b' : '#ffffff';
}
```

Los anchos son proporcionales: `flex-grow = max(upper - min, 1)`.

> Dato para la tabla: los tres contadores pueden sumar **menos** que `totalStudents`. Una nota que
> cae fuera de todos los niveles configurados entra al total pero a ningún nivel. No es un bug, no
> lo "corrijas" recalculando el total como la suma de los tres.

---

## 6. Rendimiento — por qué conviene mandar `programCommissionId`

Las consultas del semáforo corren con `statement_timeout = 120 s`. Sin `programCommissionId` el
backend evalúa **todos** los outcomes activos, y el join contra `course_outcome_mappings`
multiplica cada curso por cada outcome mapeado. En periodos grandes eso llega al timeout y sale
`503 error.semaphoreReport.queryTimeout`.

Recomendación para el front:

- Mandar siempre `programCommissionId` (viene del contexto de comisión del usuario).
- Ofrecer `outcomeId` y `campusIds: [id]` como filtros y empujar al usuario a usarlos.
- En un `503`, mostrar un mensaje de "reintentar acotando filtros" en vez de un error genérico.

---

## 7. Integración con Next.js + react-query

### Cliente de descarga

Lo importante: **chequear `res.ok` antes del blob**, y **leer el nombre del `Content-Disposition`**
(ya no hay caso ZIP, pero el nombre trae el código de sede).

```ts
// lib/api/semaphoreReports.ts
export type SemaphoreInstrument = 'rc' | 'rv';
export type SemaphoreFormat = 'pdf' | 'excel';

export interface SemaphoreFilter {
	programCommissionId?: number;
	outcomeId?: number;
	/** 0 o 1 elemento en descargas. */
	campusIds?: number[];
	lang?: 'es' | 'en';
	rubricIds?: number[];
	gradeTypeIds?: number[];
}

export class SemaphoreApiError extends Error {
	constructor(
		readonly status: number,
		/** clave i18n específica, p.ej. error.semaphoreReport.singleCampusRequired */
		readonly key: string,
	) {
		super(key);
	}
}

function filenameFromDisposition(header: string | null, fallback: string): string {
	if (!header) return fallback;
	const utf8 = /filename\*=UTF-8''([^;]+)/i.exec(header);
	if (utf8) return decodeURIComponent(utf8[1]);
	const plain = /filename="([^"]+)"/i.exec(header);
	return plain ? plain[1] : fallback;
}

export async function downloadSemaphoreReport(
	instrument: SemaphoreInstrument,
	format: SemaphoreFormat,
	filter: SemaphoreFilter,
	academicPeriodId: number,
	token: string,
): Promise<{ blob: Blob; filename: string }> {
	const res = await fetch(
		`${process.env.NEXT_PUBLIC_API_URL}/api/evaluation/semaphore-reports/${instrument}/${format}`,
		{
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'X-Academic-Period-Id': String(academicPeriodId),
				Authorization: `Bearer ${token}`,
			},
			body: JSON.stringify(filter),
		},
	);

	// En error el backend responde JSON, no binario. Sin este guard se descarga un archivo roto.
	if (!res.ok) {
		const body = await res.json().catch(() => null);
		throw new SemaphoreApiError(
			res.status,
			body?.data?.[0] ?? body?.message ?? 'error.internalServer',
		);
	}

	const blob = await res.blob();
	const filename = filenameFromDisposition(
		res.headers.get('content-disposition'),
		format === 'pdf' ? 'reporte.pdf' : 'reporte.xlsx',
	);
	return { blob, filename };
}
```

### Mutation

La descarga es un efecto disparado por el usuario, no un cache: va como `useMutation`, no
`useQuery`.

```ts
// hooks/useDownloadSemaphoreReport.ts
export function useDownloadSemaphoreReport(
	instrument: SemaphoreInstrument,
	format: SemaphoreFormat,
) {
	const { academicPeriodId, token } = useScope();
	const { t } = useTranslation();

	return useMutation({
		mutationFn: (filter: SemaphoreFilter) =>
			downloadSemaphoreReport(instrument, format, filter, academicPeriodId, token),
		onSuccess: ({ blob, filename }) => {
			const url = URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = url;
			a.download = filename;
			a.click();
			URL.revokeObjectURL(url);
		},
		onError: (error) => {
			if (error instanceof SemaphoreApiError && error.status === 503) {
				toast.warning(t('error.semaphoreReport.queryTimeout'));
				return;
			}
			toast.error(t(error instanceof SemaphoreApiError ? error.key : 'error.internalServer'));
		},
		// 503 = "pesado ahora mismo", no un bug: vale un reintento. 400/404 nunca.
		retry: (count, error) =>
			error instanceof SemaphoreApiError && error.status === 503 && count < 1,
	});
}
```

### Query de pantalla (sin cambios de contrato)

```ts
export function useSemaphoreScreen(instrument: SemaphoreInstrument, filter: SemaphoreFilter) {
	const { academicPeriodId } = useScope();
	return useQuery({
		// el periodo va en la key: cambiar de periodo tiene que invalidar el cache
		queryKey: ['semaphore', instrument, academicPeriodId, filter],
		queryFn: () => postSemaphoreScreen(instrument, filter, academicPeriodId),
		enabled: Boolean(academicPeriodId),
		staleTime: 5 * 60_000, // la consulta es cara; no la repitas en cada focus
	});
}
```

---

## 8. Checklist de implementación

- [ ] Selector de sede en los botones de descarga → **single-select** (radio / `Select` simple).
- [ ] La opción "Todas las sedes" manda `campusIds: []` o el campo omitido — **nunca** la lista
      completa de ids.
- [ ] El selector de sede de la **grilla** puede seguir siendo múltiple (endpoints JSON sin cambio).
- [ ] Agregar `error.semaphoreReport.singleCampusRequired` al diccionario i18n (es/en).
- [ ] Guard `res.ok` antes de `res.blob()` en todas las descargas del módulo.
- [ ] Quitar cualquier manejo del content type `application/zip` y del `.zip` en el módulo semáforo.
- [ ] Mandar `programCommissionId` siempre que exista en contexto.
- [ ] `503` con mensaje de "reintentar acotando filtros", con un solo reintento automático.
- [ ] Verificar que `X-Academic-Period-Id` va en las seis llamadas.
- [ ] (Opcional) Replicar la barra de Interpretación de Indicadores en pantalla usando
      `legend` del endpoint JSON o `performance-levels/get-by-filters` — con el formato de rango y
      el contraste de §5.

---

## 9. Ejemplos rápidos (curl)

```bash
BASE=http://localhost:7777/api
H=(-H "Content-Type: application/json" -H "X-Academic-Period-Id: 1" -H "Authorization: Bearer $TOKEN")

# PDF RC de una sede
curl "${H[@]}" -X POST "$BASE/evaluation/semaphore-reports/rc/pdf" \
  -d '{"programCommissionId":1,"campusIds":[3]}' -OJ

# PDF RC consolidado (todas las sedes)
curl "${H[@]}" -X POST "$BASE/evaluation/semaphore-reports/rc/pdf" \
  -d '{"programCommissionId":1}' -OJ

# 400 esperado
curl "${H[@]}" -X POST "$BASE/evaluation/semaphore-reports/rc/pdf" \
  -d '{"programCommissionId":1,"campusIds":[1,3]}'
# {"code":400,"message":"error.semaphoreReport.generateFailed",
#  "data":["error.semaphoreReport.singleCampusRequired"]}
```
