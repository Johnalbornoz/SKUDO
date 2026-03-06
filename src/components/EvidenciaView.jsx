/**
 * EvidenciaView.jsx — Módulo de Gestión Documental y Análisis de Evidencia PSM (Fase 2)
 *
 * Permite cargar múltiples archivos por categoría PSM, extraer texto automáticamente,
 * lanzar análisis IA por documento y exportar la Pre-calificación Documental JSON.
 */
import { useState, useEffect, useCallback, useRef, useMemo, memo } from 'react';
import {
  Upload, FileText, Trash2, Sparkles, Download, CheckCircle2,
  Clock, AlertTriangle, ChevronDown, ChevronUp, X, RefreshCw,
  FolderOpen, Lock, ArrowRight, Eye, Loader2, BarChart3, Target, AlertCircle, Building2, Calendar,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import apiService, { API_BASE_URL } from '../services/apiService';
import NavegacionFases from './NavegacionFases';


// ─── Categorías documentales: General | Estándares | Plan de Emergencias ─────

const CATEGORIAS_PSM = [
  { id: 'General',               icon: '📋', desc: 'Documentación general del diagnóstico (licencias, registros, información de contexto).' },
  { id: 'Estándares',            icon: '📐', desc: 'Normas, estándares PSM, procedimientos y criterios técnicos.' },
  { id: 'Plan de Emergencias',   icon: '🚨', desc: 'Planes de emergencia, procedimientos de respuesta y evacuación.' },
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

// ─── Skeleton Screen para estados de carga ────────────────────────────────────────

const DocumentSkeleton = memo(function DocumentSkeleton() {
  return (
    <div className="rounded-2xl border-2 border-gray-200 bg-white p-4 lg:p-5 animate-pulse">
      <div className="flex flex-col sm:flex-row sm:items-start gap-3">
        <div className="flex items-start gap-3 flex-1">
          {/* Icono skeleton */}
          <div className="p-3 rounded-xl bg-gray-200 shrink-0">
            <div className="w-5 h-5 bg-gray-300 rounded" />
          </div>
          
          {/* Contenido skeleton */}
          <div className="flex-1 space-y-2">
            <div className="h-4 bg-gray-200 rounded w-3/4" />
            <div className="flex gap-2">
              <div className="h-3 bg-gray-200 rounded w-16" />
              <div className="h-3 bg-gray-200 rounded w-20" />
            </div>
          </div>
        </div>
        
        {/* Acciones skeleton */}
        <div className="flex gap-2">
          <div className="w-24 h-11 bg-gray-200 rounded-xl" />
          <div className="w-11 h-11 bg-gray-200 rounded-xl" />
        </div>
      </div>
    </div>
  );
});

const AnalysisSkeleton = memo(function AnalysisSkeleton() {
  return (
    <div className="px-4 pb-4 space-y-4 animate-pulse">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <div className="w-4 h-4 bg-indigo-200 rounded" />
        <div className="h-4 bg-indigo-200 rounded w-40" />
      </div>
      
      {/* Content blocks */}
      <div className="space-y-3">
        <div className="h-3 bg-gray-200 rounded w-full" />
        <div className="h-3 bg-gray-200 rounded w-5/6" />
        <div className="h-3 bg-gray-200 rounded w-4/6" />
      </div>
      
      {/* Cards */}
      <div className="space-y-2">
        {[1,2,3].map(i => (
          <div key={i} className="p-3 bg-gray-100 rounded-lg">
            <div className="h-3 bg-gray-200 rounded w-3/4 mb-2" />
            <div className="h-2 bg-gray-200 rounded w-1/2" />
          </div>
        ))}
      </div>
    </div>
  );
});

// ─── Panel de análisis IA de un documento (memoizado para evitar re-renders costosos) ───

const PanelAnalisis = memo(function PanelAnalisis({ doc, onContraer }) {
  const [expandido, setExpandido] = useState(true);
  
  // Parsear análisis IA (puede ser JSON completo o string simple para compatibilidad)
  const analisisData = useMemo(() => {
    if (!doc?.analisis_ia) return null;
    
    try {
      // Si es un JSON, parsearlo
      const parsed = JSON.parse(doc.analisis_ia);
      return {
        analisis_tecnico: parsed.analisis_tecnico || doc.analisis_ia,
        resumen_ejecutivo: parsed.resumen_ejecutivo || '',
        evidencias_citadas: parsed.evidencias_citadas || [],
        inconsistencias: parsed.inconsistencias || [],
        fortalezas_identificadas: parsed.fortalezas_identificadas || [],
        brechas_identificadas: parsed.brechas_identificadas || [],
        calificaciones: parsed.calificaciones || doc.calificaciones || [],
        brechas_campo: parsed.brechas_campo || doc.brechas || []
      };
    } catch {
      // Si no es JSON, usar como string simple (compatibilidad)
      return {
        analisis_tecnico: doc.analisis_ia,
        resumen_ejecutivo: '',
        evidencias_citadas: [],
        inconsistencias: [],
        fortalezas_identificadas: [],
        brechas_identificadas: [],
        calificaciones: doc.calificaciones || [],
        brechas_campo: doc.brechas || []
      };
    }
  }, [doc?.analisis_ia, doc?.calificaciones, doc?.brechas]);
  
  const tieneContenido = !!(analisisData?.analisis_tecnico || doc?.calificaciones?.length);
  if (!tieneContenido) return null;

  return (
    <div className="mt-3 rounded-xl border border-indigo-200 bg-indigo-50/40 overflow-hidden">
      <div className="w-full flex items-center justify-between px-4 py-3 bg-indigo-50/60">
        <button
          type="button"
          onClick={() => setExpandido(!expandido)}
          className="flex-1 flex items-center gap-3 text-left hover:opacity-80 transition-opacity py-2 touch-manipulation"
          style={{ minHeight: '44px' }}
        >
          <Sparkles className="w-5 h-5 text-indigo-600" />
          <span className="text-sm font-semibold text-indigo-700">Análisis del Consultor AI</span>
          {expandido ? <ChevronUp className="w-5 h-5 text-indigo-400 ml-1" /> : <ChevronDown className="w-5 h-5 text-indigo-400 ml-1" />}
        </button>
        {onContraer && (
          <button
            type="button"
            onClick={onContraer}
            className="p-3 rounded-xl text-indigo-400 hover:text-indigo-600 hover:bg-indigo-100 transition-all touch-manipulation"
            style={{ minHeight: '44px', minWidth: '44px' }}
            title="Contraer"
          >
            <ChevronUp className="w-5 h-5" />
          </button>
        )}
      </div>

      {expandido && (
        <div className="px-4 pb-4 space-y-4">
          {/* Resumen Ejecutivo */}
          {analisisData?.resumen_ejecutivo && (
            <div>
              <p className="text-[11px] font-semibold text-indigo-600 uppercase tracking-wide mb-2">
                Resumen Ejecutivo PSM
              </p>
              <p className="text-sm text-indigo-800 font-medium leading-relaxed bg-indigo-50 p-3 rounded-lg border border-indigo-200">
                {analisisData.resumen_ejecutivo}
              </p>
            </div>
          )}

          {/* Análisis técnico en tercera persona */}
          {analisisData?.analisis_tecnico && (
            <div>
              <p className="text-[11px] font-semibold text-indigo-600 uppercase tracking-wide mb-2">
                Análisis Técnico (PSM — Dcto. 1347/2021 · Res. 5492/2024)
              </p>
              <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line bg-white p-3 rounded-lg border border-indigo-100">
                {analisisData.analisis_tecnico}
              </p>
            </div>
          )}

          {/* Inconsistencias Detectadas */}
          {analisisData?.inconsistencias?.length > 0 && (
            <div>
              <p className="text-[11px] font-semibold text-orange-600 uppercase tracking-wide mb-2">
                Inconsistencias Detectadas
              </p>
              <div className="space-y-1.5">
                {analisisData.inconsistencias.map((inconsistencia, i) => (
                  <div key={i} className="flex items-start gap-2 bg-orange-50 p-2 rounded-lg border border-orange-200">
                    <AlertCircle className="w-4 h-4 text-orange-600 shrink-0 mt-0.5" />
                    <p className="text-xs text-orange-800">{inconsistencia}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Evidencias Citadas */}
          {analisisData?.evidencias_citadas?.length > 0 && (
            <div>
              <p className="text-[11px] font-semibold text-indigo-600 uppercase tracking-wide mb-2">
                Evidencias Citadas del Documento
              </p>
              <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                {analisisData.evidencias_citadas.map((e, i) => (
                  <div key={i} className="bg-white p-3 rounded-lg border border-indigo-100">
                    <div className="flex items-start gap-2 mb-1">
                      <span className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        e.tipo_evidencia === 'Fortaleza' ? 'bg-green-100 text-green-700 border border-green-200' :
                        e.tipo_evidencia === 'Brecha' ? 'bg-red-100 text-red-700 border border-red-200' :
                        e.tipo_evidencia === 'Inconsistencia' ? 'bg-orange-100 text-orange-700 border border-orange-200' :
                        'bg-blue-100 text-blue-700 border border-blue-200'
                      }`}>
                        {e.tipo_evidencia}
                      </span>
                      <p className="text-[10px] text-gray-500 font-medium">{e.ubicacion_documento}</p>
                    </div>
                    <p className="text-xs text-gray-700 italic">"{e.texto_evidencia}"</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Fortalezas Identificadas */}
          {analisisData?.fortalezas_identificadas?.length > 0 && (
            <div>
              <p className="text-[11px] font-semibold text-green-600 uppercase tracking-wide mb-2">
                Fortalezas Identificadas
              </p>
              <div className="space-y-2">
                {analisisData.fortalezas_identificadas.map((f, i) => (
                  <div key={i} className="bg-green-50 p-3 rounded-lg border border-green-200">
                    <p className="text-xs text-green-800 font-medium mb-1">{f.descripcion}</p>
                    {f.evidencia_soporte && (
                      <p className="text-[11px] text-green-600 italic mb-1">Evidencia: "{f.evidencia_soporte}"</p>
                    )}
                    {f.impacto_psm && (
                      <p className="text-[11px] text-green-700">Impacto PSM: {f.impacto_psm}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Brechas Identificadas */}
          {analisisData?.brechas_identificadas?.length > 0 && (
            <div>
              <p className="text-[11px] font-semibold text-red-600 uppercase tracking-wide mb-2">
                Brechas Identificadas
              </p>
              <div className="space-y-2">
                {analisisData.brechas_identificadas.map((b, i) => (
                  <div key={i} className="bg-red-50 p-3 rounded-lg border border-red-200">
                    <div className="flex items-start gap-2 mb-1">
                      <span className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold ${CRITICIDAD_COLOR[b.severidad] ?? 'bg-gray-100 text-gray-500'}`}>
                        {b.severidad}
                      </span>
                      <p className="text-xs text-red-800 font-medium">{b.descripcion}</p>
                    </div>
                    {b.norma_incumplida && (
                      <p className="text-[11px] text-red-600 mb-1">Norma: {b.norma_incumplida}</p>
                    )}
                    {b.recomendacion_accion && (
                      <p className="text-[11px] text-red-700 font-medium">Acción: {b.recomendacion_accion}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Calificaciones por pregunta */}
          {analisisData?.calificaciones?.length > 0 && (
            <div>
              <p className="text-[11px] font-semibold text-indigo-600 uppercase tracking-wide mb-2">
                Calificaciones Normativas por Pregunta
              </p>
              <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                {analisisData.calificaciones.map((c, i) => (
                  <div key={i} className="bg-white p-3 rounded-lg border border-indigo-100">
                    <div className="flex items-start gap-2 mb-2">
                      <span className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold border ${CALIFICACION_COLOR[c.calificacion] ?? 'bg-gray-100 text-gray-500'}`}>
                        {c.calificacion} ({c.puntaje}%)
                      </span>
                      <p className="text-xs text-gray-700 font-medium">{c.pregunta}</p>
                    </div>
                    {c.justificacion && (
                      <p className="text-[11px] text-gray-600 mb-1">{c.justificacion}</p>
                    )}
                    {c.evidencia_soporte && (
                      <p className="text-[11px] text-gray-500 italic mb-1">Evidencia: "{c.evidencia_soporte}"</p>
                    )}
                    {c.recomendacion && (
                      <p className="text-[11px] text-indigo-700 font-medium">Recomendación: {c.recomendacion}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Brechas para verificación en campo */}
          {analisisData?.brechas_campo?.length > 0 && (
            <div>
              <p className="text-[11px] font-semibold text-indigo-600 uppercase tracking-wide mb-2">
                Brechas para Verificación en Campo
              </p>
              <div className="space-y-1.5">
                {analisisData.brechas_campo.map((b, i) => (
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
});

// ─── Fila de documento ────────────────────────────────────────────────────────

const FilaDocumento = memo(function FilaDocumento({ doc, soloLectura, onAnalizar, onEliminar, analizando }) {
  const [expandido, setExpandido] = useState(false);
  const [confirmar, setConfirmar] = useState(false);

  const tieneAnalisis = !!(doc.analisis_ia || doc.calificaciones?.length > 0);

  return (
    <div className={`relative rounded-2xl border-2 transition-all shadow-sm hover:shadow-md ${
      doc.estado === 'Analizado' 
        ? 'border-emerald-200 bg-gradient-to-r from-emerald-50 to-green-50' 
        : doc.estado === 'Procesando'
        ? 'border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50'
        : doc.estado === 'Error'
        ? 'border-red-200 bg-gradient-to-r from-red-50 to-pink-50'
        : 'border-gray-200 bg-white hover:border-gray-300'
    }`}>
      
      {/* Header Card - Mobile First Layout */}
      <div className="p-4 lg:p-5">
        <div className="flex flex-col sm:flex-row sm:items-start gap-3">
          
          {/* Icono y info principal */}
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <div className={`p-3 rounded-xl shrink-0 ${
              doc.estado === 'Analizado' ? 'bg-emerald-100' :
              doc.estado === 'Procesando' ? 'bg-blue-100' :
              doc.estado === 'Error' ? 'bg-red-100' : 'bg-gray-100'
            }`}>
              <FileText className={`w-5 h-5 ${
                doc.estado === 'Analizado' ? 'text-emerald-600' :
                doc.estado === 'Procesando' ? 'text-blue-600' :
                doc.estado === 'Error' ? 'text-red-600' : 'text-gray-500'
              }`} />
            </div>
            
            <div className="flex-1 min-w-0">
              <h4 className="text-base font-semibold text-gray-900 mb-1 break-words">
                {doc.nombre_original}
              </h4>
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 text-sm text-gray-600">
                <span className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5" />
                  {formatBytes(doc.tamano)}
                </span>
                <span className="hidden sm:inline text-gray-300">•</span>
                <span className="flex items-center">
                  <EstadoBadge estado={doc.estado} />
                </span>
              </div>
            </div>
          </div>

          {/* Acciones - Touch Optimized */}
          <div className="flex items-center justify-end gap-2 shrink-0">
            
            {/* Análisis disponible */}
            {tieneAnalisis && (
              <button
                type="button"
                onClick={() => setExpandido(!expandido)}
                className="relative flex items-center gap-2 px-3 py-2.5 rounded-xl bg-indigo-100 text-indigo-700 hover:bg-indigo-200 transition-all font-medium text-sm touch-manipulation"
                style={{ minHeight: '44px' }}
              >
                <Sparkles className="w-4 h-4" />
                <span className="hidden sm:inline">Ver Análisis IA</span>
                <span className="sm:hidden">IA</span>
                {expandido ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                
                {/* Indicador de contenido nuevo */}
                {!expandido && (
                  <div className="absolute -top-1 -right-1 w-3 h-3 bg-indigo-500 rounded-full animate-pulse" />
                )}
              </button>
            )}

            {/* Analizar/Re-analizar */}
            {!soloLectura && doc.estado !== 'Procesando' && (
              <button
                type="button"
                onClick={() => onAnalizar(doc.id)}
                disabled={analizando === doc.id}
                className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-emerald-100 text-emerald-700 hover:bg-emerald-200 transition-all font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation"
                style={{ minHeight: '44px' }}
                title={doc.estado === 'Analizado' ? 'Re-analizar con IA' : 'Analizar con IA'}
              >
                {analizando === doc.id ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="hidden sm:inline">Analizando...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span className="hidden sm:inline">
                      {doc.estado === 'Analizado' ? 'Re-analizar' : 'Analizar'}
                    </span>
                  </>
                )}
              </button>
            )}

            {/* Eliminar */}
            {!soloLectura && !confirmar && (
              <button
                type="button"
                onClick={() => setConfirmar(true)}
                className="p-3 rounded-xl text-gray-400 hover:text-red-600 hover:bg-red-50 transition-all touch-manipulation"
                style={{ minHeight: '44px', minWidth: '44px' }}
                title="Eliminar documento"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            )}

            {/* Confirmación de eliminación */}
            {confirmar && (
              <div className="flex items-center gap-2 px-3 py-2 bg-white rounded-xl border-2 border-red-200 shadow-lg">
                <span className="text-sm font-medium text-red-700 whitespace-nowrap">¿Eliminar?</span>
                <button
                  onClick={() => setConfirmar(false)}
                  className="px-3 py-1.5 text-sm font-medium text-gray-600 hover:text-gray-800 rounded-lg hover:bg-gray-100 transition-all"
                >
                  No
                </button>
                <button
                  onClick={() => { onEliminar(doc.id); setConfirmar(false); }}
                  className="px-3 py-1.5 text-sm font-medium text-white bg-red-500 hover:bg-red-600 rounded-lg transition-all"
                >
                  Sí
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Panel Análisis Expandible - Sticky cuando se despliega */}
      {tieneAnalisis && expandido && (
        <div className="border-t border-gray-200 bg-gray-50/50">
          <PanelAnalisis doc={doc} onContraer={() => setExpandido(false)} />
        </div>
      )}
      
      {/* Análisis Colapsado - Botón Persistente */}
      {tieneAnalisis && !expandido && (
        <div className="border-t border-gray-200 p-3">
          <button
            type="button"
            onClick={() => setExpandido(true)}
            className="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-gradient-to-r from-indigo-50 to-blue-50 border border-indigo-200 hover:from-indigo-100 hover:to-blue-100 transition-all text-left group shadow-sm"
          >
            <div className="flex items-center gap-3">
              <div className="p-1.5 bg-indigo-100 rounded-lg group-hover:bg-indigo-200 transition-colors">
                <Sparkles className="w-4 h-4 text-indigo-600" />
              </div>
              <div>
                <p className="text-sm font-semibold text-indigo-800">Análisis del Consultor AI</p>
                <p className="text-xs text-indigo-600">Toca para ver el análisis completo</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-indigo-500 rounded-full animate-pulse" />
              <ChevronDown className="w-5 h-5 text-indigo-500 group-hover:translate-y-0.5 transition-transform" />
            </div>
          </button>
        </div>
      )}
    </div>
  );
});

// ─── Panel Informe Consolidado — Formato Ejecutivo ───────────────────────────────

const PanelInformeConsolidado = memo(function PanelInformeConsolidado({ informe }) {
  const [expandido, setExpandido] = useState(true);
  const datos = useMemo(() => {
    if (!informe) return null;
    try {
      return typeof informe === 'string' ? JSON.parse(informe) : informe;
    } catch {
      return null;
    }
  }, [informe]);

  if (!datos) return null;

  const {
    planta,
    nivel,
    estado_diagnostico,
    fecha_generacion,
    documentos_total = 0,
    documentos_analizados = 0,
    cobertura_por_categoria = {},
    calificaciones = [],
    brechas_identificadas = [],
    brechas_criticas = [],
  } = datos;

  const pctCobertura = documentos_total > 0 ? Math.round((documentos_analizados / documentos_total) * 100) : 0;
  const categoriasCobertura = Object.entries(cobertura_por_categoria);

  return (
    <div className="sticky top-24 z-20 mb-6 rounded-2xl border-2 border-amber-200 bg-white shadow-lg shadow-amber-100/20 overflow-hidden">
      {/* Indicador de informe disponible cuando está colapsado */}
      {!expandido && (
        <div className="absolute top-0 right-0 p-2">
          <div className="w-3 h-3 bg-amber-500 rounded-full animate-pulse" />
        </div>
      )}
      
      <button
        type="button"
        onClick={() => setExpandido(!expandido)}
        className="w-full flex items-center justify-between px-4 lg:px-6 py-3 lg:py-4 bg-gradient-to-r from-amber-500 to-orange-500 text-left hover:from-amber-600 hover:to-orange-600 transition-all shadow-sm touch-manipulation"
        style={{ minHeight: '56px' }}
      >
        <div className="flex items-center gap-3">
          <div className="p-2 bg-white/20 rounded-xl">
            <BarChart3 className="w-5 h-5 lg:w-6 lg:h-6 text-white" />
          </div>
          <div>
            <span className="block text-base lg:text-lg font-bold text-white">
              Informe Ejecutivo PSM
            </span>
            <span className="block text-xs lg:text-sm text-orange-100 font-medium">
              Pre-calificación Documental — {documentos_analizados} documentos analizados
            </span>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {!expandido && (
            <div className="hidden sm:flex items-center gap-1 px-3 py-1.5 bg-white/20 rounded-full text-xs font-medium text-white">
              <Target className="w-3.5 h-3.5" />
              Ver informe
            </div>
          )}
          {expandido ? (
            <ChevronUp className="w-5 h-5 lg:w-6 lg:h-6 text-white" />
          ) : (
            <ChevronDown className="w-5 h-5 lg:w-6 lg:h-6 text-white" />
          )}
        </div>
      </button>
      {expandido && (
        <div className="p-4 lg:p-6 space-y-6 bg-gradient-to-br from-slate-50 to-gray-50">
          {/* ── Resumen Ejecutivo ───────────────────────────────────────────── */}
          <section>
            <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
              <BarChart3 className="w-4 h-4" /> Resumen Ejecutivo
            </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-white rounded-lg border border-slate-200 p-3 shadow-sm">
                <div className="flex items-center gap-2 text-slate-500 text-xs font-semibold uppercase mb-1">
                  <Building2 className="w-3.5 h-3.5" /> Planta
                </div>
                <p className="text-sm font-bold text-slate-800 truncate" title={planta}>{planta || '—'}</p>
              </div>
              <div className="bg-white rounded-lg border border-slate-200 p-3 shadow-sm">
                <div className="flex items-center gap-2 text-slate-500 text-xs font-semibold uppercase mb-1">
                  <Target className="w-3.5 h-3.5" /> Nivel PSM
                </div>
                <p className="text-sm font-bold text-slate-800">{nivel ?? '—'}</p>
              </div>
              <div className="bg-white rounded-lg border border-slate-200 p-3 shadow-sm">
                <div className="flex items-center gap-2 text-slate-500 text-xs font-semibold uppercase mb-1">Cobertura</div>
                <p className="text-lg font-bold text-indigo-600">{documentos_analizados}/{documentos_total} ({pctCobertura}%)</p>
              </div>
              <div className="bg-white rounded-lg border border-slate-200 p-3 shadow-sm">
                <div className="flex items-center gap-2 text-slate-500 text-xs font-semibold uppercase mb-1">
                  <Calendar className="w-3.5 h-3.5" /> Fecha
                </div>
                <p className="text-sm font-bold text-slate-800">
                  {fecha_generacion ? new Date(fecha_generacion).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                </p>
              </div>
            </div>
          </section>

          {/* ── Cobertura por Categoría ──────────────────────────────────────── */}
          {categoriasCobertura.length > 0 && (
            <section>
              <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
                <FolderOpen className="w-4 h-4" /> Cobertura Documental por Categoría
              </h3>
              <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-100 border-b border-slate-200">
                      <th className="text-left py-2.5 px-3 font-semibold text-slate-700">Categoría</th>
                      <th className="text-right py-2.5 px-3 font-semibold text-slate-700">Analizados</th>
                      <th className="text-right py-2.5 px-3 font-semibold text-slate-700">Total</th>
                      <th className="text-right py-2.5 px-3 font-semibold text-slate-700">%</th>
                    </tr>
                  </thead>
                  <tbody>
                    {categoriasCobertura.map(([cat, { total, analizados }]) => (
                      <tr key={cat} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                        <td className="py-2 px-3 text-slate-800">{cat}</td>
                        <td className="py-2 px-3 text-right font-medium text-slate-700">{analizados ?? 0}</td>
                        <td className="py-2 px-3 text-right text-slate-600">{total ?? 0}</td>
                        <td className="py-2 px-3 text-right">
                          <span className={`font-semibold ${(analizados ?? 0) === (total ?? 0) ? 'text-green-600' : 'text-amber-600'}`}>
                            {total > 0 ? Math.round(((analizados ?? 0) / total) * 100) : 0}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* ── Brechas Críticas (destacadas) ───────────────────────────────── */}
          {brechas_criticas?.length > 0 && (
            <section>
              <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-red-600 mb-3">
                <AlertCircle className="w-4 h-4" /> Brechas Críticas y Altas
              </h3>
              <div className="space-y-2">
                {brechas_criticas.map((b, i) => (
                  <div key={i} className="flex gap-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                    <span className={`shrink-0 px-2 py-0.5 rounded text-xs font-bold ${CRITICIDAD_COLOR[b.criticidad] ?? 'bg-red-100 text-red-700'}`}>
                      {b.criticidad ?? 'Alto'}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-800">{b.descripcion}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{b.documento} · {b.categoria}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* ── Brechas Medias y Bajas ───────────────────────────────────────── */}
          {brechas_identificadas?.filter(b => b.criticidad !== 'Crítico' && b.criticidad !== 'Alto').length > 0 && (
            <section>
              <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
                Otras Brechas Identificadas
              </h3>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {brechas_identificadas
                  .filter(b => b.criticidad !== 'Crítico' && b.criticidad !== 'Alto')
                  .map((b, i) => (
                    <div key={i} className="flex gap-3 p-2.5 bg-white border border-slate-200 rounded-lg">
                      <span className={`shrink-0 px-2 py-0.5 rounded text-xs font-bold ${CRITICIDAD_COLOR[b.criticidad] ?? 'bg-slate-100 text-slate-600'}`}>
                        {b.criticidad ?? '—'}
                      </span>
                      <p className="text-sm text-slate-700 flex-1">{b.descripcion}</p>
                      <span className="text-xs text-slate-400 shrink-0">{b.documento}</span>
                    </div>
                  ))}
              </div>
            </section>
          )}

          {/* ── Calificaciones por Pregunta ─────────────────────────────────── */}
          {calificaciones?.length > 0 && (
            <section>
              <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
                Calificaciones Normativas
              </h3>
              <div className="space-y-2 max-h-52 overflow-y-auto">
                {calificaciones.slice(0, 15).map((c, i) => (
                  <div key={i} className="flex gap-3 p-2.5 bg-white border border-slate-200 rounded-lg items-start">
                    <span className={`shrink-0 px-2 py-0.5 rounded text-xs font-bold border ${CALIFICACION_COLOR[c.calificacion] ?? 'bg-slate-100 text-slate-600'}`}>
                      {c.calificacion ?? '—'}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-slate-800">{c.pregunta}</p>
                      {c.justificacion && <p className="text-xs text-slate-500 mt-0.5">{c.justificacion}</p>}
                      <p className="text-xs text-slate-400 mt-0.5">{c.documento} · {c.categoria}</p>
                    </div>
                  </div>
                ))}
                {calificaciones.length > 15 && (
                  <p className="text-xs text-slate-500 italic">+ {calificaciones.length - 15} calificaciones más</p>
                )}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
});

// ─── Componente principal ─────────────────────────────────────────────────────

export default function EvidenciaView({ diagnosticoId, faseActual = 3, onNavegar, onCerrar, onSiguiente }) {
  const { usuario }   = useAuth();
  const [docs,         setDocs]         = useState([]);
  const [diagnostico,  setDiagnostico]   = useState(null);
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
      setDiagnostico(diagRes ?? null);
      setCategorias(docsRes.categorias ?? CATEGORIAS_PSM.map(c => c.id));
      setDiagEstado(diagRes?.estado ?? null);
    } catch { setDocs([]); setDiagnostico(null); }
    finally { setLoading(false); }
  }, [diagnosticoId]);

  useEffect(() => { cargar(); }, [cargar]);

  // Auto-guardar informe cuando hay documentos analizados y aún no está cargado
  const analizadosCount = docs.filter(d => d.estado === 'Analizado').length;
  useEffect(() => {
    if (!loading && analizadosCount > 0 && !diagnostico?.resultado_ia_fase2 && diagnosticoId) {
      apiService.fetchPrecalificacion(diagnosticoId).then((json) => {
        setDiagnostico(prev => prev ? { ...prev, resultado_ia_fase2: JSON.stringify(json, null, 2) } : prev);
      }).catch(() => {});
    }
  }, [loading, analizadosCount, diagnostico?.resultado_ia_fase2, diagnosticoId]);

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

  async function handleAnalizar(docId, skipConfirm = false) {
    const doc = docs.find(d => d.id === docId);
    const yaAnalizado = doc?.estado === 'Analizado' && (doc?.analisis_ia || doc?.calificaciones?.length > 0);
    if (yaAnalizado && !skipConfirm) {
      const ok = window.confirm('Este documento ya tiene un análisis. ¿Desea re-analizar y sobrescribir el informe anterior?');
      if (!ok) return;
    }

    setAnalizando(docId);
    setDocs(prev => prev.map(d => d.id === docId ? { ...d, estado: 'Procesando' } : d));
    try {
      const res = await fetch(`${API_BASE_URL}/diagnosticos/${diagnosticoId}/documentos/${docId}/analizar`, {
        method: 'POST',
        headers: hdr(),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setDocs(prev => prev.map(d => d.id === docId ? {
        ...d,
        estado:      'Analizado',
        analisis_ia: data.analisis?.analisis_tecnico ?? '',
        calificaciones: data.analisis?.calificaciones ?? [],
        brechas:     data.analisis?.brechas_campo ?? [],
      } : d));
      // Auto-guardar informe consolidado (el GET precalificacion persiste en backend)
      apiService.fetchPrecalificacion(diagnosticoId).then((json) => {
        setDiagnostico(prev => prev ? { ...prev, resultado_ia_fase2: JSON.stringify(json, null, 2) } : prev);
      }).catch(() => {});
    } catch (e) {
      setDocs(prev => prev.map(d => d.id === docId ? { ...d, estado: 'Error' } : d));
      alert('Error en análisis IA: ' + e.message);
    } finally {
      setAnalizando(null);
    }
  }

  async function handleEliminar(docId) {
    try {
      const res = await fetch(`${API_BASE_URL}/diagnosticos/${diagnosticoId}/documentos/${docId}`, {
        method: 'DELETE', headers: hdr(),
      });
      if (!res.ok) throw new Error('Error al eliminar');
      setDocs(prev => prev.filter(d => d.id !== docId));
      // Regenerar informe consolidado sin el documento eliminado
      apiService.fetchPrecalificacion(diagnosticoId).then((json) => {
        setDiagnostico(prev => prev ? { ...prev, resultado_ia_fase2: JSON.stringify(json, null, 2) } : prev);
      }).catch(() => {});
    } catch (e) {
      alert('Error al eliminar: ' + e.message);
    }
  }

  async function handleExportarJSON() {
    setExportando(true);
    try {
      const json = await apiService.fetchPrecalificacion(diagnosticoId);
      const informe = JSON.stringify(json, null, 2);
      setDiagnostico(prev => prev ? { ...prev, resultado_ia_fase2: informe } : { resultado_ia_fase2: informe });
      const blob = new Blob([informe], { type: 'application/json' });
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
        {/* Header Sticky Responsive */}
        <div className="sticky top-0 z-10 bg-gradient-to-r from-slate-50 via-emerald-50 to-teal-50 border-b border-gray-200 rounded-t-2xl px-4 lg:px-6 py-4 lg:py-5">
          {/* Navegación entre fases */}
          {onNavegar && (
            <div className="mb-4 pb-4 border-b border-gray-200">
              <NavegacionFases
                faseActual={faseActual}
                onNavegar={onNavegar}
                soloLectura={soloLectura}
                diagnosticoId={diagnosticoId}
                refreshKey={`${docs.length}-${docs.filter(d => d.estado === 'Analizado').length}`}
              />
            </div>
          )}

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            
            {/* Título y descripción */}
            <div className="min-w-0">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-emerald-100 rounded-xl">
                  <Building2 className="w-5 h-5 lg:w-6 lg:h-6 text-emerald-600" />
                </div>
                <h2 className="text-xl lg:text-2xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
                  Gestión Documental
                </h2>
                <span className="hidden sm:inline text-emerald-600 font-normal text-xl lg:text-2xl">— Fase 2</span>
                {soloLectura && (
                  <span className="flex items-center gap-1.5 text-xs text-amber-700 bg-amber-100 px-3 py-1.5 rounded-full border border-amber-200">
                    <Lock className="w-3.5 h-3.5" /> Solo lectura
                  </span>
                )}
              </div>
              
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 text-sm">
                <p className="text-gray-600">
                  {totalDocs === 0
                    ? 'Carga los documentos requeridos por categoría PSM'
                    : `${totalDocs} archivo${totalDocs !== 1 ? 's' : ''} cargado${totalDocs !== 1 ? 's' : ''}`}
                </p>
                {totalDocs > 0 && analizados > 0 && (
                  <>
                    <span className="hidden sm:inline text-gray-300">•</span>
                    <span className="flex items-center gap-1.5 text-emerald-700 font-semibold">
                      <CheckCircle2 className="w-4 h-4" />
                      {analizados} analizado{analizados !== 1 ? 's' : ''} por IA
                    </span>
                  </>
                )}
              </div>
            </div>

            {/* Acciones */}
            <div className="flex items-center gap-3 shrink-0">
              {totalDocs > 0 && (
                <button
                  type="button"
                  onClick={handleExportarJSON}
                  disabled={exportando}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 hover:border-gray-300 transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation"
                  style={{ minHeight: '44px' }}
                >
                  {exportando ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Download className="w-4 h-4" />
                  )}
                  <span className="hidden sm:inline">Pre-calificación</span>
                  <span className="sm:hidden">Export</span>
                  JSON
                </button>
              )}
              <button
                type="button"
                onClick={onCerrar}
                className="p-3 text-gray-400 hover:text-gray-600 hover:bg-white rounded-xl transition-all shadow-sm border border-transparent hover:border-gray-200 touch-manipulation"
                style={{ minHeight: '44px', minWidth: '44px' }}
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* ── Layout Responsive: Desktop 2 columnas, Mobile 1 columna ────── */}
        <div className="flex flex-col lg:flex-row min-h-[500px]">

          {/* Sidebar de categorías - Mobile: horizontal scroll, Desktop: vertical */}
          <nav className="w-full lg:w-64 shrink-0 border-b lg:border-b-0 lg:border-r border-gray-100 py-4 lg:space-y-1 px-4">
            
            {/* Mobile: Selector horizontal con scroll */}
            <div className="flex lg:hidden overflow-x-auto pb-2 -mx-2 px-2 space-x-2 scrollbar-none" style={{scrollbarWidth: 'none', msOverflowStyle: 'none'}}>
              {CATEGORIAS_PSM.map((cat) => {
                const count = docs.filter(d => d.categoria === cat.id).length;
                const activa = catActiva === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setCatActiva(cat.id)}
                    className={`flex items-center gap-2 px-4 py-3 rounded-xl whitespace-nowrap transition-all min-w-max touch-manipulation ${
                      activa 
                        ? 'bg-gradient-to-r from-emerald-500 to-emerald-600 text-white shadow-lg shadow-emerald-500/25' 
                        : 'bg-white text-gray-700 border border-gray-200 hover:border-emerald-200 hover:bg-emerald-50'
                    }`}
                    style={{ minHeight: '44px' }}
                  >
                    <span className="text-lg">{cat.icon}</span>
                    <div className="text-left">
                      <p className={`text-sm font-semibold ${activa ? 'text-white' : 'text-gray-800'}`}>
                        {cat.id}
                      </p>
                      {count > 0 && (
                        <p className={`text-xs ${activa ? 'text-emerald-100' : 'text-gray-500'}`}>
                          {count} archivo{count !== 1 ? 's' : ''}
                        </p>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Desktop: Lista vertical */}
            <div className="hidden lg:flex lg:flex-col space-y-1">
              {CATEGORIAS_PSM.map((cat) => {
                const count = docs.filter(d => d.categoria === cat.id).length;
                const activa = catActiva === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setCatActiva(cat.id)}
                    className={`w-full text-left flex items-start gap-3 px-4 py-3 rounded-xl transition-all ${
                      activa 
                        ? 'bg-gradient-to-r from-emerald-500 to-emerald-600 text-white shadow-lg shadow-emerald-500/25 transform scale-[1.02]' 
                        : 'text-gray-700 hover:bg-gray-50 hover:shadow-sm'
                    }`}
                  >
                    <span className="text-xl shrink-0">{cat.icon}</span>
                    <div className="min-w-0">
                      <p className={`text-sm font-semibold ${activa ? 'text-white' : 'text-gray-800'}`}>
                        {cat.id}
                      </p>
                      <p className={`text-xs mt-0.5 ${activa ? 'text-emerald-100' : 'text-gray-500'}`}>
                        {cat.desc}
                      </p>
                      {count > 0 && (
                        <p className={`text-xs font-medium mt-1 ${activa ? 'text-emerald-100' : 'text-gray-500'}`}>
                          {count} archivo{count !== 1 ? 's' : ''}
                        </p>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </nav>

          {/* Panel principal - Mobile first padding */}
          <div className="flex-1 px-4 lg:px-6 py-4 lg:py-6 overflow-y-auto">
            {loading ? (
              <div className="space-y-4">
                {/* Skeleton para descripción de categoría */}
                <div className="animate-pulse">
                  <div className="h-5 bg-gray-200 rounded w-48 mb-2" />
                  <div className="h-3 bg-gray-200 rounded w-72" />
                </div>

                {/* Skeleton para zona de carga */}
                <div className="p-8 border-2 border-dashed border-gray-200 rounded-2xl animate-pulse">
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-12 h-12 bg-gray-200 rounded-full" />
                    <div className="h-4 bg-gray-200 rounded w-64" />
                    <div className="h-3 bg-gray-200 rounded w-48" />
                  </div>
                </div>

                {/* Skeleton para lista de documentos */}
                <div className="space-y-4">
                  <DocumentSkeleton />
                  <DocumentSkeleton />
                  <DocumentSkeleton />
                </div>
              </div>
            ) : (
              <>
                {/* Informe consolidado persistente (si existe) */}
                {diagnostico?.resultado_ia_fase2 && (
                  <PanelInformeConsolidado informe={diagnostico.resultado_ia_fase2} />
                )}

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
