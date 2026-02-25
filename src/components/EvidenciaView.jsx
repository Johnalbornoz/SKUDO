/**
 * EvidenciaView.jsx — Módulo de Gestión Documental y Análisis de Evidencia PSM (Fase 2)
 *
 * Permite cargar múltiples archivos por categoría PSM, extraer texto automáticamente,
 * lanzar análisis IA por documento y exportar la Pre-calificación Documental JSON.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Upload, FileText, Trash2, Sparkles, Download, CheckCircle2,
  Clock, AlertTriangle, ChevronDown, ChevronUp, X, RefreshCw,
  FolderOpen, Lock, ArrowRight, Eye, Loader2,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import apiService, { API_BASE_URL } from '../services/apiService';
import NavegacionFases from './NavegacionFases';


// ─── Configuración de categorías PSM ─────────────────────────────────────────

const CATEGORIAS_PSM = [
  { id: 'Información General',              icon: '📋', desc: 'Licencias, RUC, pólizas, registro de instalación.' },
  { id: 'Dirección y Organización',         icon: '🏢', desc: 'Organigrama, política HSE, compromisos de la dirección.' },
  { id: 'Análisis de Riesgos (HAZOP/LOPA)', icon: '⚠️', desc: 'HAZOP, LOPA, What-if, registro de escenarios de riesgo.' },
  { id: 'Documentos de Proceso (P&IDs)',    icon: '🗺️', desc: 'P&ID actualizados, layout de planta, diagramas de flujo.' },
  { id: 'Desempeño y KPIs',                 icon: '📊', desc: 'Indicadores de seguridad, registro de incidentes, auditorías.' },
  { id: 'Normativos y Regulatorios',        icon: '⚖️', desc: 'Decreto 1347/2021, Res. 5492/2024, permisos ambientales.' },
  { id: 'Procedimientos Operacionales',     icon: '📖', desc: 'SOP críticos, permisos de trabajo, LOTO.' },
  { id: 'Registros de Mantenimiento',       icon: '🔧', desc: 'Plan de mantenimiento, historial de equipos críticos, órdenes.' },
];

// ─── Estado / badge helpers ───────────────────────────────────────────────────

const ESTADO_CONFIG = {
  Cargado:     { color: 'bg-blue-100 text-blue-700 border-blue-200',   icon: <Clock className="w-3 h-3" />,         label: 'Cargado' },
  Procesando:  { color: 'bg-amber-100 text-amber-700 border-amber-200', icon: <Loader2 className="w-3 h-3 animate-spin" />, label: 'Analizando…' },
  Analizado:   { color: 'bg-green-100 text-green-700 border-green-200', icon: <CheckCircle2 className="w-3 h-3" />,  label: 'Analizado' },
  Error:       { color: 'bg-red-100 text-red-700 border-red-200',       icon: <AlertTriangle className="w-3 h-3" />, label: 'Error' },
};

const CRITICIDAD_COLOR = {
  Bajo:    'bg-slate-100 text-slate-600',
  Medio:   'bg-yellow-100 text-yellow-700',
  Alto:    'bg-orange-100 text-orange-700',
  Crítico: 'bg-red-100 text-red-700',
};

const CALIFICACION_COLOR = {
  'Suficiente':   'bg-green-100 text-green-700  border-green-200',
  'Escasa':       'bg-yellow-100 text-yellow-700 border-yellow-200',
  'Al menos una': 'bg-blue-100   text-blue-700   border-blue-200',
  'No hay':       'bg-red-100    text-red-700    border-red-200',
};

function EstadoBadge({ estado }) {
  const cfg = ESTADO_CONFIG[estado] ?? ESTADO_CONFIG.Cargado;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border ${cfg.color}`}>
      {cfg.icon} {cfg.label}
    </span>
  );
}

function formatBytes(b) {
  if (!b) return '';
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / (1024 * 1024)).toFixed(1)} MB`;
}

// ─── Zona de drag & drop ──────────────────────────────────────────────────────

function DropZone({ categoria, onSubir, subiendo }) {
  const [dragging, setDragging]   = useState(false);
  const inputRef                  = useRef(null);

  function handleFiles(files) {
    if (!files.length || !categoria) return;
    onSubir(files, categoria);
  }

  return (
    <div
      className={`relative flex flex-col items-center justify-center gap-2 py-8 px-4 rounded-xl border-2 border-dashed transition-colors cursor-pointer
        ${dragging ? 'border-indigo-400 bg-indigo-50' : 'border-gray-200 hover:border-indigo-300 hover:bg-gray-50'}`}
      onClick={() => inputRef.current?.click()}
      onDragEnter={(e) => { e.preventDefault(); setDragging(true); }}
      onDragOver={(e)  => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => { e.preventDefault(); setDragging(false); handleFiles(e.dataTransfer.files); }}
    >
      <input
        ref={inputRef}
        type="file"
        multiple
        accept=".pdf,.jpg,.jpeg,.png,.tif,.tiff,.xls,.xlsx,.doc,.docx,.txt"
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
      {subiendo
        ? <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
        : <Upload className="w-8 h-8 text-gray-300" />}
      <p className="text-sm font-medium text-gray-500">
        {subiendo ? 'Cargando archivos…' : 'Arrastra archivos aquí o haz clic para seleccionar'}
      </p>
      <p className="text-xs text-gray-400">PDF, Word, Excel, imágenes — máx. 25 MB por archivo</p>
    </div>
  );
}

// ─── Panel de análisis IA de un documento ─────────────────────────────────────

function PanelAnalisis({ doc }) {
  const [expandido, setExpandido] = useState(true);
  if (!doc.analisis_ia && !doc.calificaciones?.length) return null;

  return (
    <div className="mt-3 rounded-xl border border-indigo-200 bg-indigo-50/40 overflow-hidden">
      <button
        type="button"
        onClick={() => setExpandido(!expandido)}
        className="w-full flex items-center justify-between px-4 py-2.5 text-left hover:bg-indigo-50 transition-colors"
      >
        <span className="flex items-center gap-2 text-sm font-semibold text-indigo-700">
          <Sparkles className="w-4 h-4" /> Análisis del Consultor AI
        </span>
        {expandido ? <ChevronUp className="w-4 h-4 text-indigo-400" /> : <ChevronDown className="w-4 h-4 text-indigo-400" />}
      </button>

      {expandido && (
        <div className="px-4 pb-4 space-y-4">
          {/* Análisis técnico en tercera persona */}
          {doc.analisis_ia && (
            <div>
              <p className="text-[11px] font-semibold text-indigo-600 uppercase tracking-wide mb-2">
                Análisis Técnico (PSM — Dcto. 1347/2021 · Res. 5492/2024)
              </p>
              <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line bg-white p-3 rounded-lg border border-indigo-100">
                {doc.analisis_ia}
              </p>
            </div>
          )}

          {/* Calificaciones por pregunta */}
          {doc.calificaciones?.length > 0 && (
            <div>
              <p className="text-[11px] font-semibold text-indigo-600 uppercase tracking-wide mb-2">
                Calificaciones Propuestas por Pregunta
              </p>
              <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
                {doc.calificaciones.map((c, i) => (
                  <div key={i} className="flex items-start gap-2 bg-white p-2 rounded-lg border border-indigo-100">
                    <span className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold border ${CALIFICACION_COLOR[c.calificacion] ?? 'bg-gray-100 text-gray-500'}`}>
                      {c.calificacion}
                    </span>
                    <div className="min-w-0">
                      <p className="text-xs text-gray-700 font-medium truncate">{c.pregunta}</p>
                      {c.justificacion && <p className="text-[11px] text-gray-500 mt-0.5">{c.justificacion}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Brechas para verificación en campo */}
          {doc.brechas?.length > 0 && (
            <div>
              <p className="text-[11px] font-semibold text-indigo-600 uppercase tracking-wide mb-2">
                Brechas para Verificación en Campo
              </p>
              <div className="space-y-1.5">
                {doc.brechas.map((b, i) => (
                  <div key={i} className="flex items-start gap-2 bg-white p-2 rounded-lg border border-indigo-100">
                    <span className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold ${CRITICIDAD_COLOR[b.criticidad] ?? 'bg-gray-100 text-gray-500'}`}>
                      {b.criticidad ?? '—'}
                    </span>
                    <p className="text-xs text-gray-700">{b.descripcion}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Fila de documento ────────────────────────────────────────────────────────

function FilaDocumento({ doc, soloLectura, onAnalizar, onEliminar, analizando }) {
  const [expandido, setExpandido] = useState(false);
  const [confirmar, setConfirmar] = useState(false);

  return (
    <div className={`rounded-xl border transition-all ${doc.estado === 'Analizado' ? 'border-green-200 bg-green-50/20' : 'border-gray-200 bg-white'}`}>
      <div className="flex items-center gap-3 p-3">
        <FileText className="w-5 h-5 text-gray-400 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-800 truncate">{doc.nombre_original}</p>
          <p className="text-xs text-gray-400">{formatBytes(doc.tamano)}</p>
        </div>
        <EstadoBadge estado={doc.estado} />

        {/* Acciones */}
        <div className="flex items-center gap-1 shrink-0">
          {(doc.analisis_ia || doc.calificaciones?.length > 0) && (
            <button
              type="button"
              onClick={() => setExpandido(!expandido)}
              className="p-1.5 rounded-lg text-indigo-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
              title="Ver análisis"
            >
              <Eye className="w-4 h-4" />
            </button>
          )}
          {!soloLectura && doc.estado !== 'Procesando' && (
            <button
              type="button"
              onClick={() => onAnalizar(doc.id)}
              disabled={analizando === doc.id}
              className="p-1.5 rounded-lg text-purple-400 hover:text-purple-600 hover:bg-purple-50 transition-colors disabled:opacity-40"
              title={doc.estado === 'Analizado' ? 'Re-analizar con IA' : 'Analizar con IA'}
            >
              {analizando === doc.id
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : <Sparkles className="w-4 h-4" />}
            </button>
          )}
          {!soloLectura && !confirmar && (
            <button
              type="button"
              onClick={() => setConfirmar(true)}
              className="p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors"
              title="Eliminar"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
          {confirmar && (
            <div className="flex items-center gap-1">
              <button onClick={() => setConfirmar(false)} className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1 rounded border border-gray-200">No</button>
              <button onClick={() => { onEliminar(doc.id); setConfirmar(false); }} className="text-xs text-white bg-red-500 hover:bg-red-600 px-2 py-1 rounded">Sí</button>
            </div>
          )}
        </div>
      </div>

      {/* Panel análisis expandible */}
      {expandido && <div className="px-3 pb-3"><PanelAnalisis doc={doc} /></div>}
      {!expandido && doc.estado === 'Analizado' && (doc.analisis_ia || doc.calificaciones?.length > 0) && (
        <div className="px-3 pb-3">
          <PanelAnalisis doc={doc} />
        </div>
      )}
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function EvidenciaView({ diagnosticoId, faseActual = 3, onNavegar, onCerrar, onSiguiente }) {
  const { usuario }   = useAuth();
  const [docs,         setDocs]         = useState([]);
  const [categorias,   setCategorias]   = useState([]);
  const [catActiva,    setCatActiva]     = useState(CATEGORIAS_PSM[0].id);
  const [loading,      setLoading]      = useState(true);
  const [subiendo,     setSubiendo]     = useState(false);
  const [analizando,   setAnalizando]   = useState(null);
  const [exportando,   setExportando]   = useState(false);
  const [diagEstado,   setDiagEstado]   = useState(null);
  const [avanzando,    setAvanzando]    = useState(false);

  const soloLectura = diagEstado === 'Finalizado' || diagEstado === 'Aprobado' || usuario?.rol === 'Lector';

  const token = () => localStorage.getItem('skudo_token');
  const hdr   = (extra = {}) => ({ Authorization: `Bearer ${token()}`, ...extra });

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const [docsRes, diagRes] = await Promise.all([
        fetch(`${API_BASE_URL}/diagnosticos/${diagnosticoId}/documentos`, { headers: hdr() }).then(r => r.json()),
        fetch(`${API_BASE_URL}/diagnosticos/${diagnosticoId}`,            { headers: hdr() }).then(r => r.json()),
      ]);
      setDocs(docsRes.documentos ?? []);
      setCategorias(docsRes.categorias ?? CATEGORIAS_PSM.map(c => c.id));
      setDiagEstado(diagRes?.estado ?? null);
    } catch { setDocs([]); }
    finally { setLoading(false); }
  }, [diagnosticoId]);

  useEffect(() => { cargar(); }, [cargar]);

  async function handleSubir(files, categoria) {
    setSubiendo(true);
    const fd = new FormData();
    fd.append('categoria', categoria);
    for (const f of files) fd.append('archivos', f);
    try {
      const res = await fetch(`${API_BASE_URL}/diagnosticos/${diagnosticoId}/documentos`, {
        method: 'POST',
        headers: hdr(),
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Error al subir');
      await cargar();
    } catch (e) {
      alert('Error al subir: ' + e.message);
    } finally {
      setSubiendo(false);
    }
  }

  async function handleAnalizar(docId) {
    setAnalizando(docId);
    setDocs(prev => prev.map(d => d.id === docId ? { ...d, estado: 'Procesando' } : d));
    try {
      const res = await fetch(`${API_BASE_URL}/diagnosticos/${diagnosticoId}/documentos/${docId}/analizar`, {
        method: 'POST',
        headers: hdr(),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      // Refrescar solo el doc analizado
      setDocs(prev => prev.map(d => d.id === docId ? {
        ...d,
        estado:      'Analizado',
        analisis_ia: data.analisis?.analisis_tecnico ?? '',
        calificaciones: data.analisis?.calificaciones ?? [],
        brechas:     data.analisis?.brechas_campo ?? [],
      } : d));
    } catch (e) {
      setDocs(prev => prev.map(d => d.id === docId ? { ...d, estado: 'Error' } : d));
      alert('Error en análisis IA: ' + e.message);
    } finally {
      setAnalizando(null);
    }
  }

  async function handleEliminar(docId) {
    await fetch(`${API_BASE_URL}/diagnosticos/${diagnosticoId}/documentos/${docId}`, {
      method: 'DELETE', headers: hdr(),
    });
    setDocs(prev => prev.filter(d => d.id !== docId));
  }

  async function handleExportarJSON() {
    setExportando(true);
    try {
      const res  = await fetch(`${API_BASE_URL}/diagnosticos/${diagnosticoId}/precalificacion`, { headers: hdr() });
      const json = await res.json();
      const blob = new Blob([JSON.stringify(json, null, 2)], { type: 'application/json' });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = `pre-calificacion-diag-${diagnosticoId}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      alert('Error al exportar: ' + e.message);
    } finally {
      setExportando(false);
    }
  }

  async function handleAvanzar() {
    setAvanzando(true);
    try {
      await apiService.patchProgreso(diagnosticoId, { estado: 'Recorrido', paso_actual: 3 });
      onSiguiente(diagnosticoId);
    } catch (e) {
      alert('Error: ' + e.message);
    } finally {
      setAvanzando(false);
    }
  }

  const docsDeCat    = docs.filter(d => d.categoria === catActiva);
  const totalDocs    = docs.length;
  const analizados   = docs.filter(d => d.estado === 'Analizado').length;
  const catConDocs   = new Set(docs.map(d => d.categoria));

  return (
    <div className="bg-white min-h-screen">
      <div className="max-w-5xl mx-auto">

        {/* ── Header ─────────────────────────────────────────────────── */}
        <div className="sticky top-0 z-10 bg-white border-b border-gray-100 rounded-t-2xl px-6 py-4">
          {/* Navegación entre fases */}
          {onNavegar && (
            <div className="mb-3 pb-3 border-b border-gray-100">
              <NavegacionFases faseActual={faseActual} onNavegar={onNavegar} soloLectura={soloLectura} />
            </div>
          )}

          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <FolderOpen className="w-5 h-5 text-violet-600" />
                <h2 className="text-lg font-bold text-gray-900">Gestión Documental — Fase 2</h2>
                {soloLectura && (
                  <span className="flex items-center gap-1 text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                    <Lock className="w-3 h-3" /> Solo lectura
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-500">
                {totalDocs === 0
                  ? 'Carga los documentos requeridos por categoría PSM.'
                  : `${totalDocs} archivo${totalDocs !== 1 ? 's' : ''} cargado${totalDocs !== 1 ? 's' : ''}`}
                {totalDocs > 0 && analizados > 0 && (
                  <span className="text-green-600 font-semibold ml-1">{analizados} analizado{analizados !== 1 ? 's' : ''} por IA</span>
                )}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {totalDocs > 0 && (
                <button
                  type="button"
                  onClick={handleExportarJSON}
                  disabled={exportando}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-xs text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  {exportando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                  Pre-calificación JSON
                </button>
              )}
              <button
                type="button"
                onClick={onCerrar}
                className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* ── Layout 2 columnas ───────────────────────────────────────── */}
        <div className="flex min-h-[500px]">

          {/* Sidebar de categorías */}
          <nav className="w-56 shrink-0 border-r border-gray-100 py-4 space-y-0.5 px-2">
            {CATEGORIAS_PSM.map((cat) => {
              const count   = docs.filter(d => d.categoria === cat.id).length;
              const activa  = catActiva === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setCatActiva(cat.id)}
                  className={`w-full text-left flex items-start gap-2 px-3 py-2.5 rounded-xl transition-colors ${
                    activa ? 'bg-violet-50 text-violet-700' : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <span className="text-base shrink-0 leading-none mt-0.5">{cat.icon}</span>
                  <div className="min-w-0">
                    <p className={`text-xs font-semibold leading-tight ${activa ? 'text-violet-700' : 'text-gray-700'}`}>
                      {cat.id}
                    </p>
                    {count > 0 && (
                      <p className="text-[10px] text-gray-400 mt-0.5">{count} archivo{count !== 1 ? 's' : ''}</p>
                    )}
                  </div>
                </button>
              );
            })}
          </nav>

          {/* Panel principal */}
          <div className="flex-1 p-6 overflow-y-auto">
            {loading ? (
              <div className="flex items-center gap-2 text-gray-400 justify-center py-20">
                <RefreshCw className="w-5 h-5 animate-spin" /> Cargando…
              </div>
            ) : (
              <>
                {/* Descripción de la categoría */}
                <div className="mb-4">
                  <p className="text-sm font-semibold text-gray-800">
                    {CATEGORIAS_PSM.find(c => c.id === catActiva)?.icon} {catActiva}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {CATEGORIAS_PSM.find(c => c.id === catActiva)?.desc}
                  </p>
                </div>

                {/* Zona de carga */}
                {!soloLectura && (
                  <div className="mb-5">
                    <DropZone
                      categoria={catActiva}
                      onSubir={handleSubir}
                      subiendo={subiendo}
                    />
                  </div>
                )}

                {/* Lista de documentos de la categoría */}
                {docsDeCat.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-8">
                    No hay documentos en esta categoría.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {docsDeCat.map(doc => (
                      <FilaDocumento
                        key={doc.id}
                        doc={doc}
                        soloLectura={soloLectura}
                        onAnalizar={handleAnalizar}
                        onEliminar={handleEliminar}
                        analizando={analizando}
                      />
                    ))}
                  </div>
                )}

                {/* Acción "Analizar todos" si hay docs sin analizar */}
                {!soloLectura && docsDeCat.some(d => d.estado === 'Cargado' || d.estado === 'Error') && (
                  <button
                    type="button"
                    onClick={() => {
                      docsDeCat
                        .filter(d => d.estado === 'Cargado' || d.estado === 'Error')
                        .forEach(d => handleAnalizar(d.id));
                    }}
                    className="mt-4 w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 border-dashed border-violet-200 text-violet-600 hover:border-violet-400 hover:bg-violet-50 transition-colors text-sm font-medium"
                  >
                    <Sparkles className="w-4 h-4" /> Analizar todos los documentos de esta categoría con IA
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        {/* ── Footer ─────────────────────────────────────────────────── */}
        <div className="sticky bottom-0 bg-white border-t border-gray-100 rounded-b-2xl px-6 py-4 flex items-center justify-between gap-3">
          <div className="text-xs text-gray-400">
            {analizados > 0
              ? `${analizados}/${totalDocs} documentos analizados · descarga la Pre-calificación para llevar a campo`
              : 'Analiza los documentos con IA para obtener calificaciones y brechas'}
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onCerrar}
              className="px-4 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50"
            >
              Cerrar
            </button>
            {!soloLectura && onSiguiente && (
              <button
                type="button"
                onClick={handleAvanzar}
                disabled={avanzando}
                className="flex items-center gap-2 px-5 py-2 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold transition-colors shadow-sm disabled:opacity-60"
              >
                {avanzando
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Avanzando…</>
                  : <><ArrowRight className="w-4 h-4" /> Siguiente: Recorrido Técnico</>}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
