# Inteligencia Artificial del Pronóstico — Gemelo Digital PSM

Este documento describe de forma detallada la **lógica y el flujo de la IA** que genera el pronóstico (Gemelo Digital) en la sección Pronóstico: qué datos usa, cómo se construye el prompt, qué modelo se llama, qué estructura de salida se espera y cómo se persiste y muestra en la aplicación.

---

## 1. Propósito del módulo

El **Pronóstico** (Gemelo Digital) es una **simulación de riesgos futuros** que responde a la pregunta:

> *¿Qué ocurriría en la instalación si las acciones correctivas del Plan de Acción no se cumplen en sus plazos?*

La IA actúa como un **“Gemelo Digital”** de la planta: modela escenarios de incumplimiento, cadenas de fallos, consecuencias (personas, ambiente, activos, reputación), proyección temporal del riesgo y recomendaciones urgentes. Todo se basa en:

- Las **acciones pendientes** del Plan de Acción (no completadas ni canceladas).
- El **último diagnóstico finalizado** con análisis IA (hallazgos, brechas, nivel de madurez).

Si no hay acciones pendientes, igual se genera un pronóstico de **riesgo residual** a partir del último diagnóstico.

---

## 2. Dónde se dispara la generación

| Ubicación | Acción |
|-----------|--------|
| **Frontend** | Página **Pronóstico** (`PaginaPronostico.jsx`). Botón **"Generar Pronóstico IA"** en el header o **"Nuevo Análisis"** en el panel de historial. |
| **Llamada** | `apiService.generarPronostico()` → `POST /api/pronostico/generar` (con timeout largo `httpLong`). |
| **Backend** | Ruta `POST /api/pronostico/generar` en `server.js`: recopila datos, arma el prompt, llama a Gemini, parsea la respuesta y guarda en la tabla `pronosticos`. |

---

## 3. Datos que recopila el backend (entradas de la IA)

### 3.1 Acciones del Plan de Acción (pendientes)

Se ejecuta una sola consulta SQL:

```sql
SELECT pa.id, pa.nombre, pa.descripcion, pa.responsable, pa.fecha_limite,
       pa.criticidad, pa.estado, pa.elemento_psm, pa.plazo_ia, pa.origen_ia,
       p.nombre AS planta_nombre
FROM plan_accion_items pa
LEFT JOIN diagnosticos d ON d.id = pa.diagnostico_id
LEFT JOIN plantas       p ON p.id = d.planta_id
WHERE pa.estado NOT IN ('Completado','Cancelado')
  AND (tenant_id del usuario si aplica)
ORDER BY
  CASE pa.criticidad WHEN 'Crítico' THEN 1 WHEN 'Alto' THEN 2 WHEN 'Medio' THEN 3 ELSE 4 END,
  pa.fecha_limite ASC NULLS LAST
```

- **Filtro**: solo ítems con estado distinto de `Completado` y `Cancelado`.
- **Orden**: por criticidad (Crítico primero) y por fecha límite ascendente (las más próximas primero).
- **Uso**: se agrupan por criticidad (Crítico, Alto, Medio, Bajo) y se formatean en texto para el prompt (nombre, elemento PSM, responsable, fecha límite, días restantes o “VENCIDA hace X días”, estado).

Si **no hay acciones pendientes**, el texto que se inyecta en el prompt indica: *"No hay acciones pendientes en el Plan de Acción (todas completadas o canceladas). Evalúa el riesgo residual y la madurez actual según el último diagnóstico."* — aun así se genera pronóstico.

### 3.2 Último diagnóstico finalizado (contexto)

Otra consulta obtiene el **último diagnóstico** con análisis IA ya generado:

```sql
SELECT d.nivel_calculado, d.analisis_final_ia,
       p.nombre AS planta_nombre, a.nombre AS area_nombre,
       t.nombre AS empresa_nombre
FROM diagnosticos d
LEFT JOIN plantas p ON p.id = d.planta_id
LEFT JOIN areas   a ON a.id = d.area_id
LEFT JOIN tenants t ON t.id = d.tenant_id
WHERE d.estado IN ('Finalizado','Aprobado')
  AND d.analisis_final_ia IS NOT NULL
  AND (tenant_id del usuario si aplica)
ORDER BY d.analisis_generado_en DESC NULLS LAST
LIMIT 1
```

Del resultado se usan:

- **empresa_nombre**, **planta_nombre**, **area_nombre**: para identificar organización e instalación en el prompt.
- **nivel_calculado**: nivel de madurez PSM (1–5 o etiqueta).
- **analisis_final_ia**: objeto JSON. Del mismo se extraen:
  - **hallazgos_criticos**: array de `{ riesgo, elemento, descripcion }` → se pasan como lista de hallazgos.
  - **brechas_normativas**: array de strings → se resumen en una línea.

Si no hay diagnóstico finalizado, empresa/planta/nivel se sustituyen por valores por defecto (“la organización”, “la instalación”, “No determinado”) y no se inyecta bloque de hallazgos.

---

## 4. Construcción del prompt (sistema + usuario)

El prompt enviado a la IA tiene esta estructura lógica:

### 4.1 Rol y contexto organizacional

- **Rol**: *"Eres un Experto Senior en Seguridad de Procesos (PSM) y Análisis de Riesgos bajo el Decreto 1347 de 2021 (Colombia), con expertise en modelado de escenarios de accidentes mayores, análisis de fallas tipo HAZOP/LOPA y consecuencias."*
- **Datos fijos en el texto**:
  - ORGANIZACIÓN: nombre de la empresa (o “la organización”).
  - INSTALACIÓN: planta (o “la instalación”).
  - NIVEL DE MADUREZ PSM: valor del último diagnóstico (o “No determinado”).
  - FECHA DE ANÁLISIS: fecha actual en formato local (es-CO).

### 4.2 Bloque de acciones pendientes

- Título: *"ACCIONES CORRECTIVAS PENDIENTES EN EL PLAN DE ACCIÓN"*.
- Cuatro subbloques: **ACCIONES CRÍTICAS**, **ALTAS**, **MEDIAS**, **BAJAS**, cada uno con el número de ítems y la lista formateada.
- Para cada acción se incluye:
  - Criticidad, nombre, elemento PSM, responsable, fecha límite, días restantes (o “VENCIDA hace X días”), estado.
- Si no hay pendientes: el párrafo que pide evaluar riesgo residual y madurez según el último diagnóstico.

### 4.3 Bloque opcional de último diagnóstico

- Si existe `analisis_final_ia`:
  - Título tipo *"Hallazgos del último diagnóstico (nivel X)"*.
  - Lista de hallazgos: `[riesgo] elemento: descripción`.
  - Línea de brechas normativas.

### 4.4 Misión y tareas de la IA

- **Misión**: *"Actúa como el Gemelo Digital de esta instalación industrial. Simula qué ocurriría si las acciones correctivas NO son cumplidas dentro de sus plazos establecidos."*
- **Para cada grupo de acciones críticas**, modelar:
  1. La cadena de fallos que se activaría (bow-tie simplificado).
  2. Los escenarios de accidente que podrían materializarse.
  3. El incremento de probabilidad de incidente por cada semana de demora.
  4. El impacto en personas, ambiente, activos y reputación.
  5. La normativa que quedaría incumplida.

### 4.5 Esquema de salida exigido (JSON)

Se pide explícitamente: *"Responde SOLO en JSON con esta estructura exacta"* y se describe el siguiente esquema:

| Campo | Tipo | Descripción |
|-------|------|-------------|
| **indice_riesgo_global** | número 0–100 | 100 = catástrofe inminente. |
| **nivel_alerta** | "Verde" \| "Amarillo" \| "Naranja" \| "Rojo" | Verde &lt;30, Amarillo 30–59, Naranja 60–79, Rojo ≥80. |
| **resumen_ejecutivo** | string | Párrafo ejecutivo del pronóstico. |
| **proyeccion_riesgo** | objeto | `hoy`, `dias_30`, `dias_60`, `dias_90`: valores numéricos de riesgo proyectado si no se actúa. |
| **escenarios_incumplimiento** | array | Lista de escenarios (ver tabla siguiente). |
| **factores_agravantes** | array de strings | Factores que aumentan el riesgo. |
| **factores_mitigantes** | array de strings | Factores que lo reducen. |
| **recomendacion_urgente** | string | Acción más urgente a tomar. |
| **indicadores_alerta_temprana** | array | Objetos `{ indicador, umbral, frecuencia }` (KPIs a monitorear). |

Cada elemento de **escenarios_incumplimiento** tiene:

| Campo | Descripción |
|-------|-------------|
| **id** | Identificador (ej. "E1"). |
| **titulo** | Nombre del escenario. |
| **elemento_psm** | Elemento PSM afectado. |
| **criticidad** | "Crítico" \| "Alto" \| "Medio" \| "Bajo". |
| **accion_incumplida** | Acción del plan que no se cumplió. |
| **cadena_fallos** | Array de strings (pasos de la cadena de fallos). |
| **consecuencias** | Objeto con `personas`, `ambiente`, `activos`, `reputacion`. |
| **probabilidad_ocurrencia** | "Muy Alta" \| "Alta" \| "Moderada" \| "Baja". |
| **tiempo_materializacion** | Plazo estimado si no se actúa. |
| **normativa_incumplida** | Array de normas. |
| **accion_emergencia** | Qué hacer de inmediato. |

---

## 5. Llamada al modelo (Gemini)

- **Función**: `geminiAnalizar(prompt)` en `server.js`.
- **Modelo**: **Gemini 2.5 Flash** (Google Generative AI).
- **API key**: `GEMINI_API_KEY` o `VITE_GEMINI_API_KEY` en `.env`.
- **Flujo**: se envía el prompt completo como contenido de usuario; la respuesta es texto plano que se espera sea JSON.

---

## 6. Procesamiento de la respuesta

1. Se toma la respuesta en bruto (`raw`) de Gemini.
2. **Limpieza**: se quitan bloques markdown `` ```json `` y `` ``` `` y se recorta espacios.
3. **Extracción**: con una expresión regular se busca el primer objeto JSON `{ ... }` en el texto (por si la IA añade texto antes o después).
4. **Parse**: `JSON.parse(...)` sobre ese fragmento.
5. **Fallback**: si en cualquier paso falla el parse, se usa un **objeto por defecto**:
   - `indice_riesgo_global: 50`
   - `nivel_alerta: 'Amarillo'`
   - `resumen_ejecutivo: raw` (texto crudo de la IA)
   - `proyeccion_riesgo: { hoy: 50, dias_30: 60, dias_60: 70, dias_90: 80 }`
   - `escenarios_incumplimiento: []`
   - `factores_agravantes: []`, `factores_mitigantes: []`
   - `recomendacion_urgente: 'Revisar el análisis completo con el equipo técnico.'`
   - `indicadores_alerta_temprana: []`

Así la API nunca devuelve 500 por JSON mal formado; el usuario siempre recibe una estructura válida (aunque sea genérica).

---

## 7. Persistencia en base de datos

Tras obtener el objeto `analisis` (parseado o por defecto):

1. **Nombre del pronóstico**: `"Pronóstico {fecha local es-CO} — {nivel_alerta}"` (ej. "Pronóstico 3/3/2025 — Naranja").
2. **Inserción** en tabla `pronosticos`:
   - **tenant_id**: del usuario.
   - **nombre**: el anterior.
   - **analisis_ia**: el objeto `analisis` serializado como JSON (JSONB).
   - **acciones_base**: el array de acciones pendientes que se usaron como entrada (las mismas filas de la consulta SQL), en JSON.
   - **generado_por**: `req.usuario.id`.

3. **Respuesta HTTP**: `{ pronostico_id, analisis, acciones_analizadas }` (número de acciones que se incluyeron en el contexto).

---

## 8. Cómo se usa esta información en la sección Pronóstico (frontend)

### 8.1 Listado de pronósticos

- **API**: `GET /api/pronostico`.
- **Respuesta**: filas con `id`, `nombre`, `created_at`, `generado_por_nombre`, y extracciones de `analisis_ia`: `resumen`, `indice_riesgo`, `nivel_alerta`, más `total_acciones` (longitud de `acciones_base`).
- **UI**: panel lateral **“Pronósticos Generados”**: cada ítem muestra índice de riesgo, nombre, fecha/hora y total de acciones; al hacer clic se carga el detalle.

### 8.2 Detalle de un pronóstico

- **API**: `GET /api/pronostico/:id` → devuelve la fila completa (`analisis_ia`, `acciones_base`, etc.).
- **Front**: parsea `analisis_ia` (si viene como string hace `JSON.parse`) y rellena el “dashboard” del Gemelo Digital.

### 8.3 Elementos mostrados (según estructura de `analisis_ia`)

| Bloque | Origen en `analisis_ia` | Componente / Uso |
|--------|--------------------------|-------------------|
| **Gauge de riesgo** | `indice_riesgo_global`, `nivel_alerta` | `GaugeRiesgo`: aguja 0–100, etiqueta Verde/Amarillo/Naranja/Rojo. |
| **Resumen ejecutivo** | `resumen_ejecutivo` | Párrafo debajo del gauge. |
| **Contadores** | `escenarios_incumplimiento` | Número de escenarios críticos, altos y total. |
| **Recomendación urgente** | `recomendacion_urgente` | Caja “Acción Más Urgente”. |
| **Proyección temporal** | `proyeccion_riesgo` | `ProyeccionTemporal`: barras Hoy, 30, 60, 90 días (“si no se actúa”). |
| **Escenarios de incumplimiento** | `escenarios_incumplimiento` | `EscenarioCard` por cada escenario: título, criticidad, probabilidad, elemento PSM, acción incumplida, cadena de fallos, consecuencias (personas, ambiente, activos, legal/reputación), normativa incumplida, acción de emergencia. |
| **Factores agravantes** | `factores_agravantes` | Lista en panel rojo. |
| **Factores mitigantes** | `factores_mitigantes` | Lista en panel verde. |
| **Indicadores de alerta temprana** | `indicadores_alerta_temprana` | Tarjetas con indicador, umbral y frecuencia. |

La lógica de la IA está pensada para que estos campos existan y tengan sentido en conjunto: el **pronóstico** es el resultado de esa simulación (Gemelo Digital) y la **sección Pronóstico** es la vista que expone toda esa información de forma estructurada.

---

## 9. Resumen del flujo de datos (diagrama)

```mermaid
flowchart LR
  subgraph Entradas["Entradas"]
    A[plan_accion_items pendientes]
    B[Último diagnóstico finalizado]
    B1[analisis_final_ia]
  end

  subgraph Backend["Backend POST /pronostico/generar"]
    C[Agrupar acciones por criticidad]
    D[Formatear texto acciones + hallazgos]
    E[Construir prompt (rol + contexto + misión + JSON)]
    F[geminiAnalizar(prompt)]
    G[Parsear JSON / fallback]
    H[INSERT pronosticos]
  end

  subgraph Salida["Salida"]
    I[analisis_ia JSONB]
    J[acciones_base JSONB]
  end

  A --> C
  B --> D
  B1 --> D
  C --> D
  D --> E
  E --> F
  F --> G
  G --> H
  H --> I
  H --> J
```

---

## 10. Referencia rápida

| Concepto | Dónde |
|----------|--------|
| **Entrada: acciones** | Plan de Acción: estado no Completado ni Cancelado, ordenadas por criticidad y fecha límite. |
| **Entrada: contexto** | Último diagnóstico Finalizado/Aprobado con `analisis_final_ia` (hallazgos, brechas, nivel). |
| **Modelo** | Gemini 2.5 Flash vía `geminiAnalizar()`. |
| **Prompt** | Experto PSM/Decreto 1347, Gemelo Digital, simulación de no cumplimiento, salida JSON fija. |
| **Fallback** | Si el JSON falla: objeto por defecto con riesgo 50, Amarillo, resumen = texto crudo. |
| **Persistencia** | Tabla `pronosticos`: nombre, analisis_ia (JSON), acciones_base (JSON), generado_por. |
| **APIs** | `GET /api/pronostico`, `GET /api/pronostico/:id`, `POST /api/pronostico/generar`, `DELETE /api/pronostico/:id`. |
| **Frontend** | `PaginaPronostico.jsx`: listado, detalle, gauge, proyección, escenarios, factores, indicadores. |

Con esto queda documentada de forma detallada la lógica de la inteligencia artificial que crea el pronóstico y la información que se muestra en la sección Pronóstico (Gemelo Digital).
