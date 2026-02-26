/**
 * EntrevistasView.jsx — Fase 5: Entrevistas y Análisis de Cultura PSM
 *
 * - Roles PSM críticos predefinidos + libre
 * - STT con reinicio automático (patrón crearReconocedor)
 * - Panel de estadísticas: cobertura de roles, score promedio, top brechas
 * - Análisis IA: cumplimiento sistemático vs informal, sesgos, triangulación
 * - Calificación normativa bajo Decreto 1347/2021 y 20 elementos CCPS
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Mic, MicOff, StopCircle, Sparkles, Trash2, AlertTriangle,
  CheckCircle2, ChevronDown, ChevronUp, X, RefreshCw,
  Lock, ArrowRight, User, Loader2, Plus, GitMerge,
  AlertCircle, ThumbsUp, ThumbsDown, HelpCircle,
  BarChart2, Users, TrendingUp, Award, MessageSquare,
  ShieldAlert, Info,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import apiService, { API_BASE_URL } from '../services/apiService';
import NavegacionFases from './NavegacionFases';


// ─── Roles críticos PSM (según listado de documentos) ─────────────────────────────

const ROLES_PSM = [
  'Líder de Seguridad de Procesos',
  'Mantenimiento',
  'Producción',
  'Ingeniería',
  'HSE',
  'Gerente General',
  'Otro (especificar)',
];

// ─── Constantes de estilo ──────────────────────────────────────────────────────

const ESTADO_COLOR = {
  Borrador:  'bg-gray-100 text-gray-600',
  Analizado: 'bg-green-100 text-green-700',
  Error:     'bg-red-100 text-red-700',
};

const CRITICIDAD_COLOR = {
  Bajo:    'bg-slate-100 text-slate-600',
  Medio:   'bg-yellow-100 text-yellow-700',
  Alto:    'bg-orange-100 text-orange-700',
  Crítico: 'bg-red-100 text-red-700',
};

const CALIFICACION_COLOR = {
  'Suficiente':   'bg-green-100  text-green-700  border-green-200',
  'Escasa':       'bg-yellow-100 text-yellow-700 border-yellow-200',
  'Al menos una': 'bg-blue-100   text-blue-700   border-blue-200',
  'No hay':       'bg-red-100    text-red-700    border-red-200',
};

const CUMPLIMIENTO_STYLE = {
  'Sistemático':    'bg-green-50 text-green-700 border-green-200',
  'Informal':       'bg-amber-50 text-amber-700 border-amber-200',
  'Desconocimiento':'bg-red-50   text-red-700   border-red-200',
};

const ERRORES_STT = {
  network:      'Sin conexión a Internet. El reconocimiento de voz requiere acceso a la red.',
  'not-allowed':'Permiso de micrófono denegado. Habilita el acceso en la configuración del navegador.',
  'no-speech':  'No se detectó voz. Habla más cerca del micrófono.',
  aborted:      null,
};

function efectividadLabel(puntaje) {
  if (puntaje >= 75) return { label: 'Suficiente',    color: 'text-green-600  bg-green-50  border-green-200' };
  if (puntaje >= 50) return { label: 'Escasa',         color: 'text-yellow-700 bg-yellow-50 border-yellow-200' };
  if (puntaje > 0)   return { label: 'Al menos una',   color: 'text-blue-600   bg-blue-50   border-blue-200' };
  return               { label: 'No hay',              color: 'text-red-600    bg-red-50    border-red-200' };
}

function formatSeg(s) {
  if (!s) return '';
  const m = Math.floor(s / 60), sg = s % 60;
  return `${m}:${String(sg).padStart(2, '0')}`;
}

// ─── Hook de grabación STT con reinicio automático ────────────────────────────

function useSpeechRecognition() {
  const [soportado]      = useState(() => !!(window.SpeechRecognition || window.webkitSpeechRecognition));
  const [grabando,       setGrabando]      = useState(false);
  const [transcripcion,  setTranscripcion] = useState('');
  const [interino,       setInterino]      = useState('');
  const [sttError,       setSttError]      = useState(null);
  const continuarRef   = useRef(false);
  const recognitionRef = useRef(null);
  const acumuladoRef   = useRef('');

  const crearReconocedor = useCallback((onStop) => {
    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRec) return null;
    const rec = new SpeechRec();
    rec.lang = 'es-CO';
    rec.continuous = true;
    rec.interimResults = true;

    rec.onresult = (e) => {
      let final = '', interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) final += e.results[i][0].transcript + ' ';
        else interim += e.results[i][0].transcript;
      }
      if (final) {
        acumuladoRef.current += final;
        setTranscripcion(acumuladoRef.current);
      }
      setInterino(interim);
    };

    rec.onerror = (e) => {
      if (e.error === 'aborted') return;
      const msg = ERRORES_STT[e.error] ?? `Error de reconocimiento: ${e.error}`;
      if (msg) setSttError(msg);
      continuarRef.current = false;
      setGrabando(false);
      setInterino('');
    };

    rec.onend = () => {
      setInterino('');
      if (continuarRef.current) {
        const nuevo = crearReconocedor(onStop);
        if (nuevo) {
          recognitionRef.current = nuevo;
          try { nuevo.start(); } catch { /* ya iniciado */ }
        }
      } else {
        setGrabando(false);
        if (onStop) onStop();
      }
    };

    return rec;
  }, []);

  function iniciar(onStop) {
    setSttError(null);
    acumuladoRef.current = transcripcion;
    continuarRef.current = true;
    const rec = crearReconocedor(onStop);
    if (!rec) return;
    recognitionRef.current = rec;
    try {
      rec.start();
      setGrabando(true);
    } catch (e) {
      setSttError('No se pudo iniciar el micrófono: ' + e.message);
      continuarRef.current = false;
    }
  }

  function detener() {
    continuarRef.current = false;
    recognitionRef.current?.stop();
    setGrabando(false);
    setInterino('');
  }

  function limpiar() {
    acumuladoRef.current = '';
    setTranscripcion('');
    setInterino('');
    setSttError(null);
  }

  return { soportado, grabando, transcripcion, interino, sttError, setSttError, setTranscripcion, iniciar, detener, limpiar };
}

// ─── Visualizador de ondas (AnalyserNode + canvas) ─────────────────────────────

function VisualizadorOndas({ stream, activo, className = '' }) {
  const canvasRef = useRef(null);
  const animRef  = useRef(null);
  const ctxRef   = useRef(null);

  useEffect(() => {
    if (!stream || !activo || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctxRef.current = ctx;

    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const source = audioCtx.createMediaStreamSource(stream);
    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.8;
    source.connect(analyser);

    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    const W = canvas.width;
    const H = canvas.height;
    const barCount = Math.min(32, dataArray.length);
    const barW = Math.max(2, (W / barCount) - 2);

    function draw() {
      if (!ctxRef.current) return;
      analyser.getByteFrequencyData(dataArray);
      const ctx = ctxRef.current;
      ctx.fillStyle = 'rgba(248,250,252,0.95)';
      ctx.fillRect(0, 0, W, H);
      for (let i = 0; i < barCount; i++) {
        const v = dataArray[Math.floor((i / barCount) * dataArray.length)] || 0;
        const h = Math.max(2, (v / 255) * H * 0.8);
        const x = i * (barW + 2) + 1;
        ctx.fillStyle = `hsl(${210 + (v / 255) * 60}, 70%, 50%)`;
        ctx.fillRect(x, H - h, barW, h);
      }
      animRef.current = requestAnimationFrame(draw);
    }
    draw();

    return () => {
      cancelAnimationFrame(animRef.current);
      audioCtx.close();
      ctxRef.current = null;
    };
  }, [stream, activo]);

  if (!activo) return null;
  return (
    <canvas
      ref={canvasRef}
      width={280}
      height={48}
      className={`rounded-lg border border-indigo-200 bg-slate-50 ${className}`}
    />
  );
}

// ─── Panel de estadísticas ────────────────────────────────────────────────────

function PanelEstadisticas({ entrevistas }) {
  const analizadas = entrevistas.filter(e => e.estado === 'Analizado');
  const scores     = analizadas.map(e => e.puntuacion_efectividad).filter(n => n != null);
  const scoreAvg   = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;
  const efLabel    = scoreAvg != null ? efectividadLabel(scoreAvg) : null;

  // Roles cubiertos
  const rolesCubiertos = new Set(entrevistas.map(e => e.cargo).filter(Boolean));
  const rolesCriticos  = ROLES_PSM.slice(0, 8);
  const cobertura      = rolesCriticos.filter(r => rolesCubiertos.has(r)).length;

  // Top brechas
  const todasBrechas = analizadas.flatMap(e => Array.isArray(e.brechas) ? e.brechas : []);
  const brechasCrit  = todasBrechas
    .sort((a, b) => ['Crítico','Alto','Medio','Bajo'].indexOf(a.criticidad) - ['Crítico','Alto','Medio','Bajo'].indexOf(b.criticidad))
    .slice(0, 3);

  if (entrevistas.length === 0) return null;

  return (
    <div className="rounded-xl border border-indigo-100 bg-indigo-50/30 p-4 space-y-4">
      <p className="text-[11px] font-bold text-indigo-500 uppercase tracking-widest flex items-center gap-1.5">
        <BarChart2 className="w-3.5 h-3.5" /> Panel de Cobertura — Fase 5
      </p>

      <div className="grid grid-cols-3 gap-3">
        {/* Total */}
        <div className="bg-white rounded-xl border border-gray-100 p-3 text-center">
          <p className="text-2xl font-bold text-gray-800">{entrevistas.length}</p>
          <p className="text-[11px] text-gray-400 mt-0.5">Entrevistas</p>
          <p className="text-[10px] text-indigo-500 font-semibold mt-0.5">{analizadas.length} analizadas</p>
        </div>

        {/* Cobertura de roles */}
        <div className="bg-white rounded-xl border border-gray-100 p-3 text-center">
          <p className="text-2xl font-bold text-gray-800">{cobertura}<span className="text-base text-gray-300">/{rolesCriticos.length}</span></p>
          <p className="text-[11px] text-gray-400 mt-0.5">Roles cubiertos</p>
          <div className="mt-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full bg-indigo-400 rounded-full transition-all" style={{ width: `${(cobertura / rolesCriticos.length) * 100}%` }} />
          </div>
        </div>

        {/* Score promedio */}
        <div className="bg-white rounded-xl border border-gray-100 p-3 text-center">
          {efLabel ? (
            <>
              <p className="text-2xl font-bold text-gray-800">{scoreAvg}<span className="text-sm text-gray-300">%</span></p>
              <p className="text-[11px] text-gray-400 mt-0.5">Efectividad prom.</p>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${efLabel.color}`}>{efLabel.label}</span>
            </>
          ) : (
            <>
              <p className="text-2xl font-bold text-gray-300">—</p>
              <p className="text-[11px] text-gray-400 mt-0.5">Sin análisis aún</p>
            </>
          )}
        </div>
      </div>

      {/* Roles faltantes */}
      {cobertura < rolesCriticos.length && (
        <div>
          <p className="text-[11px] font-semibold text-amber-600 mb-1.5 flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" /> Roles críticos sin entrevistar:
          </p>
          <div className="flex flex-wrap gap-1.5">
            {rolesCriticos.filter(r => !rolesCubiertos.has(r)).map(r => (
              <span key={r} className="text-[10px] bg-amber-50 border border-amber-200 text-amber-700 px-2 py-0.5 rounded-full">{r}</span>
            ))}
          </div>
        </div>
      )}

      {/* Top 3 brechas */}
      {brechasCrit.length > 0 && (
        <div>
          <p className="text-[11px] font-bold text-red-500 uppercase tracking-widest mb-1.5 flex items-center gap-1">
            <ShieldAlert className="w-3 h-3" /> Top 3 brechas detectadas
          </p>
          <div className="space-y-1.5">
            {brechasCrit.map((b, i) => (
              <div key={i} className="flex items-start gap-2 bg-white border border-red-100 rounded-lg p-2">
                <span className={`shrink-0 px-2 py-0.5 rounded-full text-[9px] font-bold ${CRITICIDAD_COLOR[b.criticidad] ?? 'bg-gray-100'}`}>
                  {b.criticidad}
                </span>
                <div>
                  <p className="text-[11px] text-gray-700">{b.descripcion}</p>
                  {b.norma_aplicable && <p className="text-[10px] text-indigo-400 mt-0.5">{b.norma_aplicable}</p>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Modal de grabación / nueva entrevista ─────────────────────────────────────

function ModalGrabacion({ diagnosticoId, entrevistaInicial, onGuardado, onCerrar }) {
  const { soportado, grabando, transcripcion, interino, sttError, setSttError, setTranscripcion, iniciar, detener, limpiar } = useSpeechRecognition();
  const [nombre,        setNombre]        = useState(entrevistaInicial?.participante ?? '');
  const [cargo,         setCargo]         = useState(entrevistaInicial?.cargo        ?? '');
  const [cargoCustom,   setCargoCustom]   = useState('');
  const [areaId,        setAreaId]        = useState(entrevistaInicial?.area_id ?? '');
  const [notasConsultor, setNotasConsultor] = useState(entrevistaInicial?.notas_consultor ?? '');
  const [areas,         setAreas]         = useState([]);
  const [stream,        setStream]        = useState(null);
  const [mediaRecorder, setMediaRecorder] = useState(null);
  const [transcribiendo, setTranscribiendo] = useState(false);
  const [guardando,     setGuardando]     = useState(false);
  const [tiempo,        setTiempo]        = useState(0);
  const timerRef = useRef(null);
  const token = () => localStorage.getItem('skudo_token');
  const hdr   = () => ({ Authorization: `Bearer ${token()}` });

  useEffect(() => {
    if (entrevistaInicial?.transcripcion) setTranscripcion(entrevistaInicial.transcripcion);
  }, []);

  useEffect(() => {
    if (!diagnosticoId) return;
    fetch(`${API_BASE_URL}/diagnosticos/${diagnosticoId}`, { headers: hdr() })
      .then(r => r.json())
      .then(diag => {
        if (diag?.planta_id) {
          fetch(`${API_BASE_URL}/areas?planta_id=${diag.planta_id}`, { headers: hdr() })
            .then(r => r.json())
            .then(arr => setAreas(Array.isArray(arr) ? arr : []))
            .catch(() => setAreas([]));
        } else {
          fetch(`${API_BASE_URL}/areas`, { headers: hdr() })
            .then(r => r.json())
            .then(arr => setAreas(Array.isArray(arr) ? arr : []))
            .catch(() => setAreas([]));
        }
      })
      .catch(() => setAreas([]));
  }, [diagnosticoId]);

  async function toggleGrabacion() {
    if (grabando) {
      detener();
      clearInterval(timerRef.current);
      if (mediaRecorder?.state === 'recording') {
        mediaRecorder.stop();
      }
      stream?.getTracks?.().forEach(t => t.stop());
      setStream(null);
      setMediaRecorder(null);
    } else {
      setSttError(null);
      try {
        const streamObj = await navigator.mediaDevices.getUserMedia({ audio: true });
        setStream(streamObj);
        const rec = new MediaRecorder(streamObj);
        const chunks = [];
        rec.ondataavailable = e => chunks.push(e.data);
        rec.onstop = () => {
          const blob = new Blob(chunks, { type: 'audio/webm' });
          window.__lastAudioBlob = blob;
        };
        rec.start();
        setMediaRecorder(rec);
      } catch (e) {
        setSttError('No se pudo acceder al micrófono: ' + e.message);
      }
      iniciar(() => clearInterval(timerRef.current));
      timerRef.current = setInterval(() => setTiempo(t => t + 1), 1000);
    }
  }

  async function handleTranscribirIA() {
    const blob = window.__lastAudioBlob;
    if (!blob) return;
    setTranscribiendo(true);
    try {
      const fd = new FormData();
      fd.append('audio', blob, 'grabacion.webm');
      const res = await fetch(`${API_BASE_URL}/diagnosticos/${diagnosticoId}/transcribir`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token()}` },
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      if (data.transcripcion) setTranscripcion(prev => prev ? prev + '\n\n' + data.transcripcion : data.transcripcion);
    } catch (e) {
      setSttError('Transcripción IA: ' + e.message);
    } finally {
      setTranscribiendo(false);
    }
  }

  const cargoFinal = cargo === 'Otro (especificar)' ? cargoCustom : cargo;

  async function handleGuardar() {
    if (!transcripcion.trim()) return;
    setGuardando(true);
    try {
      const body = { participante: nombre, cargo: cargoFinal, area_id: areaId ? Number(areaId) : null, transcripcion, duracion_seg: tiempo, notas_consultor: notasConsultor || null };
      if (entrevistaInicial) {
        await fetch(`${API_BASE_URL}/diagnosticos/${diagnosticoId}/entrevistas/${entrevistaInicial.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', ...hdr() },
          body: JSON.stringify(body),
        });
        onGuardado({ ...entrevistaInicial, ...body });
      } else {
        const res = await fetch(`${API_BASE_URL}/diagnosticos/${diagnosticoId}/entrevistas`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...hdr() },
          body: JSON.stringify(body),
        });
        const nueva = await res.json();
        onGuardado(nueva);
      }
      window.__lastAudioBlob = null;
      onCerrar();
    } catch (e) {
      alert('Error al guardar: ' + e.message);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] bg-black/70 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white z-10">
          <div className="flex items-center gap-2">
            <Mic className="w-5 h-5 text-indigo-600" />
            <h3 className="text-base font-bold text-gray-900">
              {entrevistaInicial ? 'Editar entrevista' : 'Nueva entrevista'}
            </h3>
          </div>
          <button type="button" onClick={onCerrar} className="p-2 text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-100">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {/* Nombre */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">
              Nombre del participante <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={nombre}
              onChange={e => setNombre(e.target.value)}
              placeholder="Ej: Carlos Rodríguez"
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
          </div>

          {/* Cargo / Rol */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">
              Cargo / Rol PSM <span className="text-red-400">*</span>
            </label>
            <select
              value={cargo}
              onChange={e => setCargo(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
            >
              <option value="">— Seleccionar rol —</option>
              {ROLES_PSM.map(r => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
            {cargo === 'Otro (especificar)' && (
              <input
                type="text"
                value={cargoCustom}
                onChange={e => setCargoCustom(e.target.value)}
                placeholder="Especifique el cargo..."
                className="mt-2 w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
            )}
          </div>

          {/* Área */}
          {areas.length > 0 && (
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Área</label>
              <select
                value={areaId}
                onChange={e => setAreaId(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
              >
                <option value="">— Seleccionar área —</option>
                {areas.map(a => (
                  <option key={a.id} value={a.id}>{a.nombre}</option>
                ))}
              </select>
            </div>
          )}

          {/* Error STT */}
          {sttError && (
            <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg p-3">
              <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-xs font-semibold text-amber-700">Error de reconocimiento de voz</p>
                <p className="text-xs text-amber-600 mt-0.5">{sttError}</p>
                <p className="text-xs text-amber-500 mt-1">Puedes escribir la transcripción manualmente.</p>
              </div>
              <button onClick={() => setSttError(null)} className="text-amber-400 hover:text-amber-600">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Transcripción */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-semibold text-gray-600">
                Transcripción <span className="text-red-400">*</span>
              </label>
              {transcripcion && (
                <button type="button" onClick={limpiar} className="text-xs text-red-400 hover:text-red-600">Limpiar</button>
              )}
            </div>
            <div className="relative">
              <textarea
                value={transcripcion + (interino ? ` [${interino}]` : '')}
                onChange={e => setTranscripcion(e.target.value)}
                rows={9}
                placeholder={
                  sttError
                    ? 'Error de voz — escribe aquí la transcripción manualmente…'
                    : soportado
                      ? 'Haz clic en el micrófono para grabar, o escribe directamente…'
                      : 'Tu navegador no soporta grabación. Escribe la transcripción manualmente…'
                }
                className={`w-full px-3 py-2 rounded-lg border text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-400 font-mono leading-relaxed
                  ${grabando ? 'border-red-300 bg-red-50/30' : sttError ? 'border-amber-300 bg-amber-50/20' : 'border-gray-200'}`}
              />
              {grabando && (
                <div className="absolute top-2 right-2 flex items-center gap-1.5 bg-red-500 text-white text-xs px-2 py-1 rounded-full">
                  <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
                  {formatSeg(tiempo)}
                </div>
              )}
            </div>
          </div>

          {/* Visualizador de ondas */}
          <VisualizadorOndas stream={stream} activo={grabando} className="w-full" />

          {/* Controles STT */}
          <div className="flex items-center gap-3 flex-wrap">
            {soportado && (
              <button
                type="button"
                onClick={toggleGrabacion}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm transition-all shadow-sm
                  ${grabando
                    ? 'bg-red-500 hover:bg-red-600 text-white animate-pulse'
                    : 'bg-indigo-600 hover:bg-indigo-700 text-white'}`}
              >
                {grabando
                  ? <><StopCircle className="w-4 h-4" /> Detener grabación</>
                  : <><Mic className="w-4 h-4" /> {transcripcion ? 'Continuar grabando' : 'Iniciar grabación'}</>}
              </button>
            )}
            {!grabando && window.__lastAudioBlob && (
              <button
                type="button"
                onClick={handleTranscribirIA}
                disabled={transcribiendo}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-indigo-200 text-xs text-indigo-700 hover:bg-indigo-50 disabled:opacity-60"
              >
                {transcribiendo ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                Transcribir con IA
              </button>
            )}
            {sttError && soportado && (
              <button
                type="button"
                onClick={() => { setSttError(null); toggleGrabacion(); }}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-amber-200 text-xs text-amber-700 hover:bg-amber-50"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Reintentar
              </button>
            )}
            {!grabando && !sttError && soportado && (
              <p className="text-xs text-gray-400">Idioma: es-CO · Puedes editar el texto libremente</p>
            )}
            {!soportado && (
              <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg p-2 flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                Tu navegador no soporta grabación. Usa Chrome o Edge para esta función.
              </p>
            )}
          </div>

          {/* Notas del Consultor */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Notas del Consultor</label>
            <textarea
              value={notasConsultor}
              onChange={e => setNotasConsultor(e.target.value)}
              rows={3}
              placeholder="Observaciones adicionales del consultor sobre esta entrevista o el contexto del entrevistado…"
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 sticky bottom-0 bg-white">
          <button type="button" onClick={onCerrar} className="px-4 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50">
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleGuardar}
            disabled={!transcripcion.trim() || !cargoFinal || guardando}
            className="flex items-center gap-2 px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold disabled:opacity-60 transition-colors"
          >
            {guardando ? <><Loader2 className="w-4 h-4 animate-spin" /> Guardando…</> : 'Guardar entrevista'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Panel de análisis IA ─────────────────────────────────────────────────────

function PanelAnalisisEntrevista({ ent }) {
  const [expandido, setExpandido] = useState(true);
  const cal          = ent.calificaciones ?? {};
  const efectividad  = ent.puntuacion_efectividad ?? cal.efectividad;
  const efLabel      = efectividad != null ? efectividadLabel(efectividad) : null;
  const cumplStyle   = CUMPLIMIENTO_STYLE[ent.tipo_cumplimiento] ?? 'bg-gray-50 text-gray-600 border-gray-200';

  return (
    <div className="mt-3 rounded-xl border border-indigo-200 bg-indigo-50/40 overflow-hidden">
      <button
        type="button"
        onClick={() => setExpandido(!expandido)}
        className="w-full flex items-center justify-between px-4 py-2.5 text-left hover:bg-indigo-50 transition-colors"
      >
        <div className="flex items-center gap-2 flex-wrap">
          <Sparkles className="w-4 h-4 text-indigo-600" />
          <span className="text-sm font-semibold text-indigo-700">Análisis del Consultor AI</span>
          {efLabel && (
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${efLabel.color}`}>
              {efLabel.label} {efectividad != null ? `(${efectividad}%)` : ''}
            </span>
          )}
          {ent.tipo_cumplimiento && (
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${cumplStyle}`}>
              {ent.tipo_cumplimiento}
            </span>
          )}
        </div>
        {expandido ? <ChevronUp className="w-4 h-4 text-indigo-400" /> : <ChevronDown className="w-4 h-4 text-indigo-400" />}
      </button>

      {expandido && (
        <div className="px-4 pb-4 space-y-4">

          {/* Análisis técnico */}
          {ent.analisis_ia && (
            <div className="text-sm text-gray-700 leading-relaxed bg-white p-3 rounded-lg border border-indigo-100 whitespace-pre-line">
              {ent.analisis_ia}
            </div>
          )}

          {/* Citas clave */}
          {cal.citas_clave?.length > 0 && (
            <div>
              <p className="text-[11px] font-bold text-indigo-600 uppercase tracking-wide mb-1.5">Citas clave que sustentan la calificación</p>
              <ul className="space-y-1.5">
                {cal.citas_clave.map((c, i) => (
                  <li key={i} className="text-xs text-gray-700 bg-indigo-50 border-l-4 border-indigo-300 pl-3 py-1.5 italic">
                    "{c}"
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Tipo de cumplimiento + sesgos */}
          {(ent.tipo_cumplimiento || cal.tipo_cumplimiento_justificacion) && (
            <div className={`rounded-lg border px-3 py-2 ${cumplStyle}`}>
              <p className="text-[11px] font-bold uppercase tracking-wide mb-0.5">
                Tipo de cumplimiento: {ent.tipo_cumplimiento}
              </p>
              {cal.tipo_cumplimiento_justificacion && (
                <p className="text-[11px] leading-relaxed">{cal.tipo_cumplimiento_justificacion}</p>
              )}
            </div>
          )}

          {/* Sesgos */}
          {cal.sesgos_detectados?.length > 0 && (
            <div>
              <p className="text-[11px] font-bold text-orange-600 uppercase tracking-wide mb-1.5 flex items-center gap-1">
                <Info className="w-3 h-3" /> Sesgos de respuesta detectados
              </p>
              <ul className="space-y-1">
                {cal.sesgos_detectados.map((s, i) => (
                  <li key={i} className="text-xs text-gray-700 bg-orange-50 border border-orange-100 rounded-lg px-3 py-1.5">{s}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Confirmaciones */}
          {cal.confirmaciones?.length > 0 && (
            <div>
              <p className="text-[11px] font-bold text-green-600 uppercase tracking-wide mb-1.5 flex items-center gap-1">
                <ThumbsUp className="w-3 h-3" /> Confirmaciones con documentación
              </p>
              <ul className="space-y-1">
                {cal.confirmaciones.map((c, i) => (
                  <li key={i} className="text-xs text-gray-700 bg-green-50 border border-green-100 rounded-lg px-3 py-1.5 flex items-start gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-green-500 shrink-0 mt-0.5" /> {c}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Contradicciones */}
          {cal.contradicciones?.length > 0 && (
            <div>
              <p className="text-[11px] font-bold text-red-600 uppercase tracking-wide mb-1.5 flex items-center gap-1">
                <ThumbsDown className="w-3 h-3" /> Contradicciones detectadas
              </p>
              <ul className="space-y-1">
                {cal.contradicciones.map((c, i) => (
                  <li key={i} className="text-xs text-gray-700 bg-red-50 border border-red-100 rounded-lg px-3 py-1.5 flex items-start gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 text-red-500 shrink-0 mt-0.5" /> {c}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Conocimiento informal */}
          {cal.conocimiento_informal?.length > 0 && (
            <div>
              <p className="text-[11px] font-bold text-amber-600 uppercase tracking-wide mb-1.5 flex items-center gap-1">
                <HelpCircle className="w-3 h-3" /> Prácticas informales sin respaldo documental
              </p>
              <ul className="space-y-1">
                {cal.conocimiento_informal.map((c, i) => (
                  <li key={i} className="text-xs text-gray-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-1.5">{c}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Calificaciones por elemento */}
          {cal.items?.length > 0 && (
            <div>
              <p className="text-[11px] font-bold text-indigo-600 uppercase tracking-wide mb-1.5">Calificaciones por elemento CCPS</p>
              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                {cal.items.map((c, i) => (
                  <div key={i} className="flex items-start gap-2 bg-white p-2 rounded-lg border border-indigo-100">
                    <span className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold border ${CALIFICACION_COLOR[c.calificacion] ?? 'bg-gray-100 text-gray-500'}`}>
                      {c.calificacion}
                    </span>
                    <div>
                      {c.elemento_ccps && (
                        <p className="text-[10px] text-indigo-500 font-semibold">{c.elemento_ccps}</p>
                      )}
                      <p className="text-xs text-gray-700 font-medium">{c.pregunta}</p>
                      {c.justificacion && <p className="text-[11px] text-gray-400 mt-0.5">{c.justificacion}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Brechas */}
          {Array.isArray(ent.brechas) && ent.brechas.length > 0 && (
            <div>
              <p className="text-[11px] font-bold text-indigo-600 uppercase tracking-wide mb-1.5">Brechas para verificación en campo</p>
              <div className="space-y-1.5">
                {ent.brechas.map((b, i) => (
                  <div key={i} className="flex items-start gap-2 bg-white p-2 rounded-lg border border-indigo-100">
                    <span className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold ${CRITICIDAD_COLOR[b.criticidad] ?? 'bg-gray-100'}`}>
                      {b.criticidad}
                    </span>
                    <div>
                      <p className="text-xs text-gray-700">{b.descripcion}</p>
                      {b.norma_aplicable && <p className="text-[10px] text-indigo-500 mt-0.5">{b.norma_aplicable}</p>}
                      {b.accion_verificacion && <p className="text-[10px] text-green-600 mt-0.5 font-medium">→ {b.accion_verificacion}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recomendación seguimiento */}
          {cal.recomendacion_seguimiento && (
            <div className="bg-indigo-50 rounded-lg border border-indigo-100 px-3 py-2">
              <p className="text-[11px] font-bold text-indigo-600 mb-0.5">Próxima acción recomendada</p>
              <p className="text-xs text-indigo-700">{cal.recomendacion_seguimiento}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Panel de Triangulación Global ───────────────────────────────────────────

function PanelTriangulacion({ resultado, cargando }) {
  if (cargando) return (
    <div className="flex items-center gap-2 text-sm text-gray-400 py-6 justify-center">
      <Loader2 className="w-4 h-4 animate-spin" /> Triangulando todas las fuentes con IA…
    </div>
  );
  if (!resultado) return null;

  const efLabel = resultado.calificacion_global ? efectividadLabel(resultado.calificacion_global.puntaje) : null;

  return (
    <div className="rounded-xl border border-purple-200 bg-purple-50/40 overflow-hidden">
      <div className="px-4 py-3 bg-purple-50 flex items-center justify-between border-b border-purple-100">
        <div className="flex items-center gap-2">
          <GitMerge className="w-4 h-4 text-purple-600" />
          <span className="text-sm font-bold text-purple-700">Triangulación PSM Global</span>
        </div>
        {efLabel && (
          <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full border ${efLabel.color}`}>
            {efLabel.label} — {resultado.calificacion_global?.puntaje}%
          </span>
        )}
      </div>

      <div className="p-4 space-y-4">
        {resultado.conclusion_diagnostica && (
          <div className="text-sm text-gray-700 leading-relaxed bg-white p-3 rounded-lg border border-purple-100 italic">
            "{resultado.conclusion_diagnostica}"
          </div>
        )}
        {resultado.hallazgos_triangulacion?.length > 0 && (
          <div>
            <p className="text-[11px] font-bold text-purple-600 uppercase tracking-wide mb-2">Hallazgos de triangulación</p>
            <div className="space-y-2">
              {resultado.hallazgos_triangulacion.map((h, i) => (
                <div key={i} className={`p-3 rounded-lg border text-xs ${h.tipo === 'Contradicción' ? 'bg-red-50 border-red-200' : h.tipo === 'Brecha' ? 'bg-amber-50 border-amber-200' : 'bg-green-50 border-green-200'}`}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`font-bold px-2 py-0.5 rounded-full text-[10px] ${CRITICIDAD_COLOR[h.criticidad] ?? 'bg-gray-100 text-gray-600'}`}>
                      {h.criticidad}
                    </span>
                    <span className="font-semibold text-gray-700">{h.tipo}</span>
                    <span className="text-gray-400">{h.fuentes_comparadas?.join(' ↔ ')}</span>
                  </div>
                  <p className="text-gray-700">{h.hallazgo}</p>
                </div>
              ))}
            </div>
          </div>
        )}
        {resultado.brechas_prioritarias?.length > 0 && (
          <div>
            <p className="text-[11px] font-bold text-purple-600 uppercase tracking-wide mb-2">Brechas prioritarias</p>
            <div className="space-y-1.5">
              {resultado.brechas_prioritarias.map((b, i) => (
                <div key={i} className="p-2 rounded-lg bg-white border border-purple-100 text-xs">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className={`font-bold px-2 py-0.5 rounded-full text-[10px] ${CRITICIDAD_COLOR[b.criticidad] ?? 'bg-gray-100'}`}>{b.criticidad}</span>
                    {b.norma && <span className="text-indigo-500">{b.norma}</span>}
                  </div>
                  <p className="text-gray-700">{b.descripcion}</p>
                  {b.accion_recomendada && <p className="text-green-700 mt-0.5 font-medium">→ {b.accion_recomendada}</p>}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Fila de entrevista ───────────────────────────────────────────────────────

function FilaEntrevista({ ent, soloLectura, onEditar, onEliminar, onAnalizar, analizando }) {
  const [expandido, setExpandido] = useState(false);
  const [confirmar, setConfirmar] = useState(false);

  const efectividad = ent.puntuacion_efectividad ?? (ent.calificaciones?.efectividad);
  const efLabel     = efectividad != null ? efectividadLabel(efectividad) : null;
  const cumplStyle  = CUMPLIMIENTO_STYLE[ent.tipo_cumplimiento] ?? '';

  return (
    <div className={`rounded-xl border transition-all ${ent.estado === 'Analizado' ? 'border-green-200 bg-green-50/20' : 'border-gray-200 bg-white'}`}>
      <div className="flex items-center gap-3 p-3">
        <div className="w-9 h-9 rounded-full bg-indigo-100 flex items-center justify-center shrink-0">
          <User className="w-4 h-4 text-indigo-600" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold text-gray-800">{ent.participante || 'Sin nombre'}</p>
            {ent.cargo && <span className="text-xs text-gray-400">— {ent.cargo}</span>}
          </div>
          <p className="text-xs text-gray-400 mt-0.5">
            {new Date(ent.created_at).toLocaleDateString('es-CO')}
            {ent.area_nombre ? ` · ${ent.area_nombre}` : ''}
            {ent.duracion_seg ? ` · ${formatSeg(ent.duracion_seg)}` : ''}
            {ent.transcripcion ? ` · ${ent.transcripcion.split(' ').length} palabras` : ''}
          </p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${ESTADO_COLOR[ent.estado] ?? 'bg-gray-100 text-gray-600'}`}>
            {ent.estado}
          </span>
          {efLabel && (
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${efLabel.color}`}>
              {efLabel.label}
            </span>
          )}
          {ent.tipo_cumplimiento && (
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border hidden sm:inline ${cumplStyle}`}>
              {ent.tipo_cumplimiento}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button type="button" onClick={() => setExpandido(!expandido)} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100">
            {expandido ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          {!soloLectura && (
            <>
              <button type="button" onClick={() => onAnalizar(ent.id)} disabled={analizando === ent.id}
                className="p-1.5 rounded-lg text-purple-400 hover:text-purple-600 hover:bg-purple-50 disabled:opacity-40 transition-colors" title="Analizar con IA">
                {analizando === ent.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              </button>
              <button type="button" onClick={() => onEditar(ent)}
                className="p-1.5 rounded-lg text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors" title="Editar">
                <Mic className="w-4 h-4" />
              </button>
              {!confirmar
                ? <button type="button" onClick={() => setConfirmar(true)} className="p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors"><Trash2 className="w-4 h-4" /></button>
                : <>
                    <button onClick={() => setConfirmar(false)} className="text-xs text-gray-500 px-2 py-1 rounded border border-gray-200">No</button>
                    <button onClick={() => onEliminar(ent.id)} className="text-xs text-white bg-red-500 px-2 py-1 rounded">Sí</button>
                  </>}
            </>
          )}
        </div>
      </div>

      {expandido && (
        <div className="px-4 pb-4 border-t border-gray-100 pt-3 space-y-3">
          {ent.notas_consultor && (
            <div>
              <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-1">Notas del Consultor</p>
              <p className="text-sm text-gray-600 bg-amber-50 border border-amber-100 rounded-lg p-2 italic">{ent.notas_consultor}</p>
            </div>
          )}
          {ent.transcripcion && (
            <div>
              <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-1">Transcripción</p>
              <p className="text-sm text-gray-700 leading-relaxed bg-gray-50 p-3 rounded-lg border border-gray-100 max-h-48 overflow-y-auto whitespace-pre-wrap">
                {ent.transcripcion}
              </p>
            </div>
          )}
          {(ent.analisis_ia || ent.calificaciones) && <PanelAnalisisEntrevista ent={ent} />}
        </div>
      )}
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function EntrevistasView({ diagnosticoId, faseActual = 5, onNavegar, onCerrar, onSiguiente }) {
  const { usuario }    = useAuth();
  const [entrevistas,  setEntrevistas]  = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [modalAbierto, setModalAbierto] = useState(false);
  const [editando,     setEditando]     = useState(null);
  const [analizando,   setAnalizando]   = useState(null);
  const [diagEstado,   setDiagEstado]   = useState(null);
  const [triangulando, setTriangulando] = useState(false);
  const [resultTriang, setResultTriang] = useState(null);
  const [avanzando,    setAvanzando]    = useState(false);

  const soloLectura = diagEstado === 'Finalizado' || diagEstado === 'Aprobado' || usuario?.rol === 'Lector';
  const token = () => localStorage.getItem('skudo_token');
  const hdr   = () => ({ Authorization: `Bearer ${token()}` });

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const [ents, diag] = await Promise.all([
        fetch(`${API_BASE_URL}/diagnosticos/${diagnosticoId}/entrevistas`, { headers: hdr() }).then(r => r.json()),
        fetch(`${API_BASE_URL}/diagnosticos/${diagnosticoId}`,             { headers: hdr() }).then(r => r.json()),
      ]);
      setEntrevistas(Array.isArray(ents) ? ents : []);
      setDiagEstado(diag?.estado ?? null);
    } catch { setEntrevistas([]); }
    finally { setLoading(false); }
  }, [diagnosticoId]);

  useEffect(() => { cargar(); }, [cargar]);

  function handleGuardada(ent) {
    setEntrevistas(prev => {
      const idx = prev.findIndex(e => e.id === ent.id);
      return idx >= 0 ? prev.map((e, i) => i === idx ? ent : e) : [...prev, ent];
    });
  }

  async function handleAnalizar(entId) {
    setAnalizando(entId);
    try {
      const res  = await fetch(`${API_BASE_URL}/diagnosticos/${diagnosticoId}/entrevistas/${entId}/analizar`, {
        method: 'POST', headers: hdr(),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setEntrevistas(prev => prev.map(e => e.id === entId ? {
        ...e,
        estado:                 'Analizado',
        analisis_ia:            data.analisis?.analisis_tecnico ?? '',
        tipo_cumplimiento:      data.analisis?.tipo_cumplimiento ?? null,
        puntuacion_efectividad: data.analisis?.efectividad ?? null,
        calificaciones: {
          items:                        data.analisis?.calificaciones           ?? [],
          efectividad:                  data.analisis?.efectividad,
          citas_clave:                  data.analisis?.citas_clave,
          confirmaciones:               data.analisis?.confirmaciones,
          contradicciones:              data.analisis?.contradicciones,
          conocimiento_informal:        data.analisis?.conocimiento_informal,
          sesgos_detectados:            data.analisis?.sesgos_detectados,
          tipo_cumplimiento_justificacion: data.analisis?.tipo_cumplimiento_justificacion,
          recomendacion_seguimiento:    data.analisis?.recomendacion_seguimiento,
        },
        brechas: data.analisis?.brechas_campo ?? [],
      } : e));
    } catch (e) {
      alert('Error en análisis IA: ' + e.message);
      setEntrevistas(prev => prev.map(e => e.id === entId ? { ...e, estado: 'Error' } : e));
    } finally {
      setAnalizando(null);
    }
  }

  async function handleEliminar(entId) {
    await fetch(`${API_BASE_URL}/diagnosticos/${diagnosticoId}/entrevistas/${entId}`, { method: 'DELETE', headers: hdr() });
    setEntrevistas(prev => prev.filter(e => e.id !== entId));
  }

  async function handleTriangular() {
    setTriangulando(true);
    setResultTriang(null);
    try {
      const res  = await fetch(`${API_BASE_URL}/diagnosticos/${diagnosticoId}/triangular`, { method: 'POST', headers: hdr() });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setResultTriang(data);
    } catch (e) {
      alert('Error en triangulación: ' + e.message);
    } finally {
      setTriangulando(false);
    }
  }

  async function handleAvanzar() {
    setAvanzando(true);
    try {
      await apiService.patchProgreso(diagnosticoId, { estado: 'Validacion', paso_actual: 5 });
      onSiguiente(diagnosticoId);
    } catch (e) {
      alert('Error: ' + e.message);
    } finally {
      setAvanzando(false);
    }
  }

  const analizadas = entrevistas.filter(e => e.estado === 'Analizado').length;

  return (
    <>
      <div className="bg-white min-h-screen">
        <div className="max-w-4xl mx-auto">

          {/* Header */}
          <div className="sticky top-0 z-10 bg-white border-b border-gray-100 rounded-t-2xl px-6 py-4">
            {onNavegar && (
              <div className="mb-3 pb-3 border-b border-gray-100">
                <NavegacionFases
                  faseActual={faseActual}
                  onNavegar={onNavegar}
                  soloLectura={soloLectura}
                  diagnosticoId={diagnosticoId}
                  refreshKey={entrevistas?.length}
                />
              </div>
            )}
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Mic className="w-5 h-5 text-indigo-600" />
                  <h2 className="text-lg font-bold text-gray-900">Entrevistas — Fase 5</h2>
                  {soloLectura && (
                    <span className="flex items-center gap-1 text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                      <Lock className="w-3 h-3" /> Solo lectura
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-500">
                  {entrevistas.length === 0
                    ? 'Captura las declaraciones de los actores clave del sistema PSM.'
                    : `${entrevistas.length} entrevista${entrevistas.length !== 1 ? 's' : ''} registrada${entrevistas.length !== 1 ? 's' : ''}`}
                  {analizadas > 0 && <span className="ml-1 text-green-600 font-semibold">· {analizadas} analizada{analizadas !== 1 ? 's' : ''}</span>}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {entrevistas.length > 1 && (
                  <button
                    type="button"
                    onClick={handleTriangular}
                    disabled={triangulando}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-purple-200 text-xs text-purple-700 hover:bg-purple-50 transition-colors disabled:opacity-60"
                  >
                    {triangulando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <GitMerge className="w-3.5 h-3.5" />}
                    Triangular fuentes
                  </button>
                )}
                <button type="button" onClick={onCerrar} className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Cuerpo */}
          <div className="p-6 space-y-4">
            {loading ? (
              <div className="flex items-center gap-2 text-gray-400 justify-center py-12">
                <RefreshCw className="w-5 h-5 animate-spin" /> Cargando…
              </div>
            ) : (
              <>
                {/* Panel de estadísticas */}
                <PanelEstadisticas entrevistas={entrevistas} />

                {entrevistas.length === 0 && (
                  <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 py-12 text-center">
                    <Users className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                    <p className="text-sm font-medium text-gray-400 mb-1">
                      {soloLectura ? 'No se registraron entrevistas.' : 'Comienza por entrevistar a los actores clave.'}
                    </p>
                    {!soloLectura && (
                      <p className="text-xs text-gray-400">
                        Se recomienda cubrir: Líder PSM, Supervisor, Operador, Jefe de Mantenimiento y HSE.
                      </p>
                    )}
                  </div>
                )}

                {entrevistas.map(ent => (
                  <FilaEntrevista
                    key={ent.id}
                    ent={ent}
                    soloLectura={soloLectura}
                    onEditar={(e) => { setEditando(e); setModalAbierto(true); }}
                    onEliminar={handleEliminar}
                    onAnalizar={handleAnalizar}
                    analizando={analizando}
                  />
                ))}

                {!soloLectura && (
                  <button
                    type="button"
                    onClick={() => { setEditando(null); setModalAbierto(true); }}
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed border-indigo-200 text-indigo-600 hover:border-indigo-400 hover:bg-indigo-50 transition-colors text-sm font-medium"
                  >
                    <Plus className="w-4 h-4" /> Nueva entrevista
                  </button>
                )}

                {/* Panel de triangulación */}
                <PanelTriangulacion resultado={resultTriang} cargando={triangulando} />
              </>
            )}
          </div>

          {/* Footer */}
          <div className="sticky bottom-0 bg-white border-t border-gray-100 rounded-b-2xl px-6 py-4 flex items-center justify-between gap-3">
            <button type="button" onClick={onCerrar} className="px-4 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50">
              Cerrar
            </button>
            {!soloLectura && onSiguiente && (
              <button
                type="button"
                onClick={handleAvanzar}
                disabled={avanzando}
                className="flex items-center gap-2 px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition-colors shadow-sm disabled:opacity-60"
              >
                {avanzando
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Avanzando…</>
                  : <><ArrowRight className="w-4 h-4" /> Siguiente: Validación</>}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Modal de grabación */}
      {modalAbierto && (
        <ModalGrabacion
          diagnosticoId={diagnosticoId}
          entrevistaInicial={editando}
          onGuardado={handleGuardada}
          onCerrar={() => { setModalAbierto(false); setEditando(null); }}
        />
      )}
    </>
  );
}
