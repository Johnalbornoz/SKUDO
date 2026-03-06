# Cómo ver los cambios del Radar dinámico

## 1. Reiniciar el servidor backend (obligatorio)

Los cambios del radar están en `server.js`. **Si no reinicias Node, seguirás usando la versión anterior.**

En la terminal donde corre el backend:

1. Detener: `Ctrl + C`
2. Arrancar de nuevo: `node server.js`

Debe aparecer algo como: `Servidor escuchando en puerto 3002` (o el puerto que uses).

---

## 2. Refrescar el frontend

- Si usas **Vite** (`npm run dev`): guarda un archivo del frontend o recarga la página con **Ctrl+Shift+R** (o Cmd+Shift+R en Mac) para evitar caché.
- Si la app está compilada: vuelve a ejecutar `npm run build` y recarga la página.

---

## 3. Dónde se notan los cambios

### Cálculo del radar (nueva fórmula)

- **Dashboard** (pantalla principal): el bloque “Radar de Madurez PSM” usa ya la fórmula  
  `puntaje_base + ((100 - puntaje_base) / total_acciones) * acciones_completadas`.
- Al **completar acciones** en Plan de Acción (estado “Completado”), los elementos con acciones de ese diagnóstico subirán de puntaje en el radar.

### Comportamiento

1. Entra en **Plan de Acción** y cambia el estado de una acción a **Completado** (o edita y guarda).
2. Vuelve al **Dashboard** (o, si tenías el radar visible en otra pestaña, recarga esa vista).
3. El radar debería mostrar puntajes actualizados según las acciones completadas.

Si el radar no se actualiza al volver al Dashboard, pulsa el botón **Actualizar** (icono de refresco) del propio componente del radar.

---

## 4. Si sigue igual

- Comprueba en la terminal del backend que no haya errores al cargar la página del Dashboard o al cambiar estado en Plan de Acción.
- En el navegador (F12 → Red): al abrir el Dashboard debería hacerse una petición a `/api/dashboard/madurez`. Revisa que devuelva 200 y que la respuesta incluya `elementos` con `puntaje`, `total_acciones` y `acciones_completadas` por elemento.
