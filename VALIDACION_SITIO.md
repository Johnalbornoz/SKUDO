# Validación de funcionalidad del sitio SKUDO PSM

**Fecha:** 26 de febrero de 2026

## Resumen

Se realizó una validación de la funcionalidad del sitio (frontend React + API Express + PostgreSQL). Se corrigieron dos fallos que impedían el arranque y el uso normal de la aplicación.

---

## 1. Estado de servicios

| Componente        | Puerto | Estado  | Notas                                      |
|------------------|--------|---------|--------------------------------------------|
| Frontend (Vite)  | 5173   | ✅ OK   | `npm run dev`                               |
| API (Express)    | 3001   | ✅ OK   | `npm run start:api` o `node server.js`     |
| Proxy Vite → API | /api   | ✅ OK   | Las peticiones a `/api` llegan a 3001      |

---

## 2. Pruebas de API realizadas

- **GET** `http://localhost:5173/` → **200** (página principal).
- **GET** `http://localhost:3001/api/config` → **200** (configuración sin auth).
- **GET** `http://localhost:5173/api/config` → **200** (mismo contenido vía proxy).
- **POST** `/api/auth/login` con body JSON → responde (credenciales dependen de la BD).
- **GET** `/api/auth/me` sin token → **401** "Token de autenticación requerido".
- **GET** `/api/plantas` sin token → **401** (rutas protegidas correctas).

---

## 3. Correcciones aplicadas

### 3.1 `_dbg is not defined` en el servidor

- **Archivo:** `server.js`
- **Problema:** Tras levantar la API, el proceso fallaba con `ReferenceError: _dbg is not defined` (región de “agent log” en el callback de `listen`).
- **Solución:** Se añadió una función no-op al inicio del archivo:  
  `function _dbg() {}`

### 3.2 `_dbg is not defined` en el frontend

- **Archivo:** `src/services/apiService.js`
- **Problema:** En el navegador, cualquier llamada que pasara por `http()` ejecutaba `_dbg(...)` y producía `ReferenceError`, pudiendo romper login y todas las peticiones autenticadas.
- **Solución:** Se añadió en el cliente:  
  `function _dbg() {}`

---

## 4. Build de producción

- **Comando:** `npm run build`
- **Resultado:** ✅ Correcto (Vite build sin errores).
- **Nota:** Rollup avisa de chunks > 500 KB; es solo informativo, no bloquea.

---

## 5. Flujos a validar manualmente en el navegador

Con la API y el frontend en marcha (`node server.js` en una terminal y `npm run dev` en otra), abre **http://localhost:5173/** y comprueba:

1. **Login**
   - Pantalla de inicio de sesión.
   - Login con un usuario existente en tu BD (ej. el que uses en desarrollo).
   - Redirección al dashboard tras login correcto.

2. **Dashboard**
   - Mensaje de bienvenida y radar de madurez.
   - Cards de acceso rápido: Diagnóstico, Plan de Acción, Pronóstico.
   - Enlace “Ir a Diagnósticos”.

3. **Navegación**
   - Sidebar: Dashboard, Diagnóstico, Plan de Acción, Pronóstico.
   - Si tu usuario es Consultor/SuperAdmin: “Bandeja de Validación”.
   - Si es Admin: “Configuración”.
   - Cerrar sesión y perfil (cambio de contraseña si aplica).

4. **Diagnóstico**
   - “Nuevo diagnóstico” → wizard de configuración (setup).
   - Listado de diagnósticos y “Continuar” en uno existente.
   - Navegación entre fases: cuestionario, documentos, recorrido, entrevistas, validación.

5. **Plan de Acción**
   - Listado de planes.
   - Crear/editar ítems y, si aplica, importar desde diagnóstico.

6. **Pronóstico**
   - Listado y generación de pronósticos (depende de Gemini/config).

7. **Configuración** (usuarios con rol Admin)
   - Pestañas: Infraestructura, Lógica IA, Matriz de Preguntas, Sedes, Criterios, Empresas, Usuarios.
   - “Probar conexión” a la base de datos.
   - Guardar cambios en configuración.

---

## 6. Posibles errores conocidos (según historial)

- **Validación Fase 5 (HITL):** En el pasado hubo un error por uso de `req.user` en lugar de `req.usuario`. En el código actual la ruta usa `req.usuario.id`; si vuelve a aparecer un fallo tipo “Cannot read properties of undefined (reading 'id')”, revisar que en esa ruta solo se use `req.usuario`.
- **Reporte Word/PDF:** Se ha visto en logs “column d.created_by does not exist”. El reporte actual usa `consultor_id` y `LEFT JOIN usuarios` para “creado_por_nombre”. Si el error reaparece, revisar que la tabla `diagnosticos` no espere una columna `created_by` en ninguna consulta (por ejemplo en `SELECT d.*`).

---

## 7. Cómo ejecutar la validación local

```bash
# Terminal 1 – API
cd /Users/jalbornoz/Documents/PROJECTS/SKUDO
node server.js

# Terminal 2 – Frontend
npm run dev
```

Luego abre **http://localhost:5173/** y sigue la lista de la sección 5.

Si usas base de datos Neon/Postgres, asegúrate de tener `DATABASE_URL` en `.env` o en el entorno. Para Gemini (triangulación, pronóstico, etc.), configura `GEMINI_API_KEY` o `VITE_GEMINI_API_KEY` según corresponda.
