/**
 * RecorridoView.jsx  —  Fase 3: Captura Sensorial de Campo
 *
 * Módulo multimodal para registrar la realidad operativa durante el recorrido:
 *  · Notas de voz con Speech-to-Text (Web Speech API)
 *  · Captura fotográfica de evidencia
 *  · Análisis IA de inconsistencias vs Fase 2 (documentación)
 *  · Timeline cronológico con hallazgos por severidad
 *  · Triangulación global campo ↔ documentos ↔ cuestionario
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Mic, MicOff, Camera, Upload, Trash2, Sparkles, AlertTriangle,
  CheckCircle2, ChevronDown, ChevronUp, RefreshCw, Lock,
  ArrowRight, MapPin, Clock, X, Plus, GitMerge,
  AlertCircle, ZapOff, Shield, TrendingDown, Eye, Image,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import apiService from '../services/apiService';
import NavegacionFases from './NavegacionFases';

const API_URL = import.meta.env.VITE_API_BASE_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:3000/api');
const SERVER_BASE = import.meta.env.VITE_SERVER_BASE_URL || (import.meta.env.PROD ? '' : 'http://localhost:3000');

// ─── Constantes ───────────────────────────────────────────────────────────────

const AREAS_PSM = [
  'Sala de Control',
  'Área de Proceso / Planta',
  'Almacenamiento de Productos Peligrosos',
  'Sistemas de Ventilación y Detección de Gas',
  'Sistemas de Seguridad (ESD / F&G)',
  'Accesos y Rutas de Evacuación',
  'Taller de Mantenimiento',
  'Sala Eléctrica / Subestación',
  'Torre de Enfriamiento',
  'Servicios Industriales (vapor, aire, nitrógeno)',
];

const CATEGORIAS = [
  'Estado de Equipos',
  'Conducta Operativa',
  'Interacción con Personal',
  'Sistema de Seguridad',
  'Documentación en Planta',
  'Almacenamiento',
  'Mantenimiento',
  'Otro',
];

const SEV_CFG = {
  Bajo:    { ring: 'ring-slate-300',  bg: 'bg-slate-50',   text: 'text-slate-700',  badge: 'bg-slate-100 text-slate-700',   dot: 'bg-slate-400'  },
  Medio:   { ring: 'ring-yellow-300', bg: 'bg-yellow-50',  text: 'text-yellow-800', badge: 'bg-yellow-100 text-yellow-800', dot: 'bg-yellow-500' },
  Alto:    { ring: 'ring-orange-400', bg: 'bg-orange-50',  text: 'text-orange-800', badge: 'bg-orange-100 text-orange-800', dot: 'bg-orange-500' },
  Crítico: { ring: 'ring-red-500',    bg: 'bg-red-50',     text: 'text-red-800',    badge: 'bg-red-100 text-red-800',       dot: 'bg-red-600'    },
};

function SeveridadBadge({ valor, small = false }) {
  if (!valor) return null;
  const cfg = SEV_CFG[valor] ?? SEV_CFG.Medio;
  return (
    <span className={`inline-flex items-center gap-1 font-semibold rounded-full border border-current/20
      ${small ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-0.5 text-xs'} ${cfg.badge}`}>
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${cfg.dot}`} />
      {valor}
    </span>
  );
}

function CalifBadge({ valor }) {
  const map = {
    'Suficiente':   'bg-green-100 text-green-800',
    'Escasa':       'bg-yellow-100 text-yellow-800',
    'Al menos una': 'bg-orange-100 text-orange-800',
    'No hay':       'bg-red-100 text-red-800',
  };
  if (!valor) return null;
  return <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${map[valor]??'bg-gray-100 text-gray-700'}`}>{valor}</span>;
}

function hora(ts) {
  if (!ts) return '';
  return new Date(ts).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
}

// ─── Modal de nueva nota (STT + foto) ────────────────────────────────────────

function ModalNuevaNota({ diagnosticoId, notaInicial, onGuardada, onCerrar, apiBase }) {
  const [area,        setArea]       = useState(notaInicial?.area       ?? '');
  const [areaCustom,  setAreaCustom] = useState(!AREAS_PSM.includes(notaInicial?.area ?? '') ? (notaInicial?.area ?? '') : '');
  const [usarCustom,  setUsarCustom] = useState(!AREAS_PSM.includes(notaInicial?.area ?? '') && !!notaInicial?.area);
  const [categoria,   setCategoria]  = useState(notaInicial?.categoria  ?? 'Estado de Equipos');
  const [transcripcion, setTranscripcion] = useState(notaInicial?.transcripcion ?? '');
  const [criticidad,  setCriticidad] = useState(notaInicial?.criticidad ?? '');
  const [foto,        setFoto]       = useState(null);        // File object
  const [fotoPreview, setFotoPreview]= useState(notaInicial?.foto_url ? `${apiBase}${notaInicial.foto_url}` : null);
  const [guardando,   setGuardando]  = useState(false);
  const [escuchando,  setEscuchando] = useState(false);
  const [sttError,    setSttError]   = useState('');

  const reconRef   = useRef(null);
  const fotoRef    = useRef(null);
  const areaFinal  = usarCustom ? areaCustom.trim() : area;

  // ── Web Speech API ─────────────────────────────────────────────────────────
  const ERRORES_STT = {
    network:       'Sin conexión a internet. Chrome necesita red para el reconocimiento de voz. Escribe el texto manualmente.',
    'not-allowed': 'Permiso de micrófono denegado. Actívalo en la configuración del navegador.',
    'no-speech':   'No se detectó audio. Habla más cerca del micrófono e inténtalo de nuevo.',
    'audio-capture': 'No se encontró micrófono. Conecta uno e inténtalo de nuevo.',
    aborted:       'Grabación cancelada.',
  };

  // Ref para controlar si debe seguir grabando tras un onend inesperado
  const continuarRef = useRef(false);

  const crearReconocedor = useCallback((acumuladoInicial) => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const rec = new SR();
    rec.lang           = 'es-CO';
    rec.continuous     = true;
    rec.interimResults = true;
    let acumulado = acumuladoInicial;

    rec.onresult = (e) => {
      let parcial = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) { acumulado += (acumulado ? ' ' : '') + t; }
        else { parcial = t; }
      }
      setTranscripcion(acumulado + (parcial ? ' ' + parcial : ''));
    };

    rec.onerror = (e) => {
      if (e.error === 'aborted') return; // ignorar cuando nosotros mismos detenemos
      const msg = ERRORES_STT[e.error] ?? `Error de reconocimiento (${e.error}). Escribe manualmente.`;
      setSttError(msg);
      continuarRef.current = false;
      setEscuchando(false);
    };

    // Chrome a veces termina el reconocimiento solo; lo reiniciamos con una nueva instancia
    rec.onend = () => {
      if (continuarRef.current) {
        // Crear nueva instancia para reiniciar (no se puede reusar la anterior)
        const nuevo = crearReconocedor(acumulado);
        reconRef.current = nuevo;
        try { nuevo.start(); } catch { continuarRef.current = false; setEscuchando(false); }
      } else {
        setEscuchando(false);
      }
    };

    return rec;
  }, []);

  const iniciarGrabacion = useCallback(() => {
    setSttError('');
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      setSttError('Tu navegador no soporta voz. Usa Chrome o Edge y escribe manualmente.');
      return;
    }
    continuarRef.current = true;
    const rec = crearReconocedor(transcripcion);
    reconRef.current = rec;
    try {
      rec.start();
      setEscuchando(true);
    } catch (err) {
      setSttError(`No se pudo iniciar el micrófono: ${err.message}`);
    }
  }, [transcripcion, crearReconocedor]);

  const detenerGrabacion = useCallback(() => {
    continuarRef.current = false;
    reconRef.current?.stop();
    setEscuchando(false);
  }, []);

  useEffect(() => () => reconRef.current?.stop(), []);

  // ── Foto ───────────────────────────────────────────────────────────────────
  function handleFoto(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    setFoto(f);
    setFotoPreview(URL.createObjectURL(f));
  }

  // ── Guardar ────────────────────────────────────────────────────────────────
  async function handleGuardar(e) {
    e.preventDefault();
    if (!areaFinal) return;
    setGuardando(true);
    try {
      let nota;
      const payload = { area: areaFinal, categoria, transcripcion: transcripcion.trim() || null,
                        criticidad: criticidad || null };
      if (notaInicial) {
        await apiService.actualizarNotaCampo(diagnosticoId, notaInicial.id, payload);
        nota = { ...notaInicial, ...payload };
      } else {
        nota = await apiService.crearNotaCampo(diagnosticoId, payload);
      }
      if (foto) {
        const { foto_url } = await apiService.subirFotoCampo(diagnosticoId, nota.id, foto);
        nota.foto_url = foto_url;
      }
      onGuardada(nota, !!notaInicial);
    } catch (err) {
      alert('Error al guardar: ' + err.message);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] bg-black/60 flex items-start justify-center overflow-y-auto py-6 px-4">
      <div className="w-full max-w-xl bg-white rounded-2xl shadow-2xl border border-gray-100">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <h3 className="font-bold text-gray-900">{notaInicial ? 'Editar nota' : 'Nueva Nota de Campo'}</h3>
            <p className="text-xs text-gray-400 mt-0.5">Capture observaciones con voz o texto</p>
          </div>
          <button onClick={onCerrar} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleGuardar} className="p-5 space-y-4">
          {/* Área */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Área de la Instalación *</label>
            {!usarCustom ? (
              <select value={area} onChange={e => setArea(e.target.value)} required={!usarCustom}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-teal-500">
                <option value="">— Seleccionar área —</option>
                {AREAS_PSM.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            ) : (
              <input value={areaCustom} onChange={e => setAreaCustom(e.target.value)} required
                placeholder="Nombre del área" className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-teal-500" />
            )}
            <button type="button" onClick={() => { setUsarCustom(!usarCustom); setArea(''); setAreaCustom(''); }}
              className="mt-1 text-xs text-teal-600 hover:underline">
              {usarCustom ? '← Seleccionar de la lista' : '+ Área personalizada'}
            </button>
          </div>

          {/* Categoría */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Categoría de Observación</label>
            <div className="flex flex-wrap gap-1.5">
              {CATEGORIAS.map(c => (
                <button key={c} type="button" onClick={() => setCategoria(c)}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                    categoria === c ? 'bg-teal-600 text-white border-teal-600' : 'bg-white text-gray-600 border-gray-200 hover:border-teal-400'}`}>
                  {c}
                </button>
              ))}
            </div>
          </div>

          {/* STT Recorder */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
              Transcripción de Voz / Texto
            </label>
            <div className="flex gap-2 mb-2 flex-wrap">
              <button type="button"
                onClick={escuchando ? detenerGrabacion : iniciarGrabacion}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors ${
                  escuchando
                    ? 'bg-red-100 text-red-700 hover:bg-red-200 animate-pulse'
                    : 'bg-teal-100 text-teal-700 hover:bg-teal-200'}`}>
                {escuchando
                  ? <><MicOff className="w-4 h-4" /> Detener</>
                  : <><Mic className="w-4 h-4" /> Grabar voz</>}
              </button>
              {escuchando && (
                <span className="text-xs text-red-500 self-center animate-pulse">● Escuchando…</span>
              )}
              {sttError && !escuchando && (
                <button type="button" onClick={iniciarGrabacion}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-gray-100 text-gray-600 hover:bg-gray-200">
                  <RefreshCw className="w-3 h-3" /> Reintentar
                </button>
              )}
            </div>

            {sttError && (
              <div className="flex items-start gap-2 mb-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-800">{sttError}</p>
              </div>
            )}

            <textarea
              value={transcripcion}
              onChange={e => setTranscripcion(e.target.value)}
              rows={4}
              placeholder={sttError
                ? 'Escribe aquí el texto de tu observación de campo…'
                : 'La transcripción aparece aquí automáticamente, o escribe manualmente…'}
              className={`w-full px-3 py-2 rounded-lg border text-sm text-gray-800 resize-y focus:outline-none focus:ring-2 focus:ring-teal-500 transition-colors ${
                sttError ? 'border-amber-300 bg-amber-50/30' : 'border-gray-200'}`}
            />
            {sttError && (
              <p className="text-[11px] text-gray-400 mt-1">
                El micrófono requiere internet (Chrome). Puedes escribir el texto directamente arriba.
              </p>
            )}
          </div>

          {/* Criticidad manual */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Severidad Preliminar</label>
            <div className="flex gap-1.5 flex-wrap">
              {['Bajo','Medio','Alto','Crítico'].map(c => {
                const cfg = SEV_CFG[c];
                return (
                  <button key={c} type="button" onClick={() => setCriticidad(criticidad === c ? '' : c)}
                    className={`px-3 py-1 rounded-full text-xs font-semibold border transition-all ${
                      criticidad === c ? `${cfg.badge} ring-2 ring-offset-1 ${cfg.ring}` : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'}`}>
                    {c}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Foto */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Evidencia Fotográfica</label>
            <input ref={fotoRef} type="file" accept="image/*" capture="environment" onChange={handleFoto} className="hidden" />
            {fotoPreview ? (
              <div className="relative inline-block">
                <img src={fotoPreview} alt="Evidencia" className="h-32 w-auto rounded-xl border border-gray-200 object-cover" />
                <button type="button" onClick={() => { setFoto(null); setFotoPreview(null); }}
                  className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center">
                  <X className="w-3 h-3" />
                </button>
              </div>
            ) : (
              <button type="button" onClick={() => fotoRef.current?.click()}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 border-dashed border-gray-300 text-sm text-gray-500 hover:border-teal-400 hover:text-teal-600 transition-colors w-full justify-center">
                <Camera className="w-4 h-4" />
                Capturar foto o seleccionar archivo
              </button>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onCerrar} className="px-4 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50">Cancelar</button>
            <button type="submit" disabled={!areaFinal || guardando}
              className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold disabled:opacity-60 transition-colors">
              {guardando ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
              {notaInicial ? 'Actualizar nota' : 'Guardar nota'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Tarjeta de nota en el timeline ──────────────────────────────────────────

function NotaCampoCard({ nota, soloLectura, apiBase, onEditar, onEliminar, onAnalizar }) {
  const [expandida,  setExpandida]  = useState(false);
  const [analizando, setAnalizando] = useState(false);
  const [confirmar,  setConfirmar]  = useState(false);

  const sev     = nota.severidad_ia   || nota.criticidad;
  const sevCfg  = SEV_CFG[sev] ?? {};
  const tieneIA = !!(nota.analisis_ia || (nota.inconsistencias && JSON.parse(typeof nota.inconsistencias === 'string' ? nota.inconsistencias : '[]').length));

  const inconsistencias = (() => {
    try {
      const raw = nota.inconsistencias;
      if (!raw) return [];
      return typeof raw === 'string' ? JSON.parse(raw) : raw;
    } catch { return []; }
  })();

  async function handleAnalizar() {
    setAnalizando(true);
    try { await onAnalizar(nota.id); }
    finally { setAnalizando(false); }
  }

  return (
    <div className={`relative rounded-xl border transition-all
      ${sev ? `${sevCfg.ring} ring-1 ${sevCfg.bg}` : 'border-gray-200 bg-white'}`}>
      {/* Linea de tiempo dot */}
      <div className={`absolute -left-[21px] top-4 w-3 h-3 rounded-full border-2 border-white shadow-sm
        ${sev ? sevCfg.dot : 'bg-teal-400'}`} />

      {/* Header de la tarjeta */}
      <div className="flex items-start gap-3 p-3.5">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="flex items-center gap-1 text-xs font-semibold text-gray-700">
              <MapPin className="w-3 h-3 text-teal-600 shrink-0" />{nota.area}
            </span>
            {nota.categoria && nota.categoria !== 'Estado de Equipos' && (
              <span className="px-1.5 py-0.5 rounded-full bg-teal-50 text-teal-700 text-[10px] font-medium border border-teal-200">{nota.categoria}</span>
            )}
            {sev && <SeveridadBadge valor={sev} small />}
            {nota.calificacion_ia && <CalifBadge valor={nota.calificacion_ia} />}
            {tieneIA && <span className="flex items-center gap-0.5 text-[10px] text-indigo-600 font-medium"><Sparkles className="w-3 h-3" /> Analizado</span>}
          </div>
          <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1">
            <Clock className="w-3 h-3" />{hora(nota.created_at)}
          </p>
          {/* Transcripción preview */}
          {(nota.transcripcion || nota.observacion) && (
            <p className="text-sm text-gray-700 mt-1.5 line-clamp-2">
              {nota.transcripcion || nota.observacion}
            </p>
          )}
        </div>

        {/* Foto thumbnail */}
        {nota.foto_url && (
          <img src={`${apiBase}${nota.foto_url}`} alt="Evidencia"
            className="w-14 h-14 rounded-lg object-cover border border-gray-200 shrink-0 cursor-pointer"
            onClick={() => window.open(`${apiBase}${nota.foto_url}`, '_blank')} />
        )}

        <button onClick={() => setExpandida(!expandida)} className="p-1 text-gray-400 hover:text-gray-600 rounded shrink-0">
          {expandida ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>

      {/* Cuerpo expandido */}
      {expandida && (
        <div className="border-t border-gray-100 px-4 pb-4 pt-3 space-y-3">
          {/* Texto completo */}
          {(nota.transcripcion || nota.observacion) && (
            <div>
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">Transcripción / Observación</p>
              <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{nota.transcripcion || nota.observacion}</p>
            </div>
          )}

          {/* Hallazgo narrativo IA */}
          {nota.analisis_ia && (
            <div className="p-3 rounded-lg bg-indigo-50 border border-indigo-200">
              <p className="text-[10px] font-bold text-indigo-600 uppercase tracking-wide mb-1 flex items-center gap-1">
                <Sparkles className="w-3 h-3" /> Hallazgo del Consultor AI
              </p>
              <p className="text-xs text-indigo-900 leading-relaxed">{nota.analisis_ia}</p>
            </div>
          )}

          {/* Inconsistencias detectadas */}
          {inconsistencias.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold text-red-500 uppercase tracking-wide mb-2 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" /> Inconsistencias con Fase 2
              </p>
              <div className="space-y-2">
                {inconsistencias.map((inc, i) => (
                  <div key={i} className={`p-2.5 rounded-lg border ${SEV_CFG[inc.severidad]?.bg ?? 'bg-gray-50'} border-current/20`}>
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <SeveridadBadge valor={inc.severidad} small />
                      {inc.norma_aplicable && <span className="text-[10px] text-gray-500">{inc.norma_aplicable}</span>}
                    </div>
                    <p className="text-xs text-gray-800">{inc.descripcion}</p>
                    {inc.documento_referencia && (
                      <p className="text-[10px] text-gray-500 mt-0.5">Referencia: {inc.documento_referencia}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Cultura de seguridad */}
          {nota.cultura_seguridad && (
            <div className="p-3 rounded-lg bg-amber-50 border border-amber-200">
              <p className="text-[10px] font-bold text-amber-700 uppercase tracking-wide mb-1 flex items-center gap-1">
                <Shield className="w-3 h-3" /> Cultura de Seguridad
              </p>
              <p className="text-xs text-amber-900 leading-relaxed">{nota.cultura_seguridad}</p>
            </div>
          )}

          {/* Foto grande */}
          {nota.foto_url && (
            <div>
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1 flex items-center gap-1"><Image className="w-3 h-3" /> Evidencia fotográfica</p>
              <img src={`${apiBase}${nota.foto_url}`} alt="Evidencia de campo"
                className="rounded-xl w-full max-h-64 object-cover border border-gray-200 cursor-pointer"
                onClick={() => window.open(`${apiBase}${nota.foto_url}`, '_blank')} />
            </div>
          )}

          {/* Acciones */}
          {!soloLectura && (
            <div className="flex flex-wrap gap-2 pt-1">
              {!confirmar ? (
                <>
                  <button onClick={() => onEditar(nota)}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-gray-200 text-xs text-gray-600 hover:bg-gray-50">
                    Editar
                  </button>
                  <button onClick={handleAnalizar} disabled={analizando}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-50 border border-indigo-200 text-xs text-indigo-700 hover:bg-indigo-100 disabled:opacity-60">
                    {analizando ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                    {analizando ? 'Analizando…' : tieneIA ? 'Re-analizar' : 'Analizar con IA'}
                  </button>
                  <button onClick={() => setConfirmar(true)}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-red-200 text-xs text-red-600 hover:bg-red-50">
                    <Trash2 className="w-3.5 h-3.5" /> Eliminar
                  </button>
                </>
              ) : (
                <>
                  <p className="text-xs text-red-600 flex items-center gap-1 mr-2">
                    <AlertTriangle className="w-3.5 h-3.5" /> ¿Confirmar eliminación?
                  </p>
                  <button onClick={() => setConfirmar(false)} className="px-3 py-1.5 rounded-lg border border-gray-200 text-xs text-gray-600">No</button>
                  <button onClick={() => onEliminar(nota.id)} className="px-3 py-1.5 rounded-lg bg-red-600 text-white text-xs">Sí, eliminar</button>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function RecorridoView({ diagnosticoId, faseActual = 4, onNavegar, onCerrar, onSiguiente }) {
  const { usuario } = useAuth();
  const [notas,           setNotas]           = useState([]);
  const [loading,         setLoading]         = useState(true);
  const [errorMsg,        setErrorMsg]        = useState('');
  const [modalAbierto,    setModalAbierto]    = useState(false);
  const [editando,        setEditando]        = useState(null);
  const [avanzando,       setAvanzando]       = useState(false);
  const [triangulando,    setTriangulando]    = useState(false);
  const [triangulacion,   setTriangulacion]   = useState(null);
  const [mostrarTriang,   setMostrarTriang]   = useState(false);
  const [diagEstado,      setDiagEstado]      = useState(null);

  const soloLectura = diagEstado === 'Finalizado' || diagEstado === 'Aprobado' || usuario?.rol === 'Lector';

  // ── Cargar notas ───────────────────────────────────────────────────────────
  const cargar = useCallback(async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const [notas, diag] = await Promise.all([
        apiService.fetchNotasCampo(diagnosticoId),
        fetch(`${API_URL}/diagnosticos/${diagnosticoId}`, {
          headers: { Authorization: `Bearer ${localStorage.getItem('skudo_token')}` },
        }).then(r => r.json()),
      ]);
      setNotas(Array.isArray(notas) ? notas : []);
      setDiagEstado(diag?.estado ?? null);
    } catch (e) {
      setErrorMsg(e.message);
      setNotas([]);
    } finally {
      setLoading(false);
    }
  }, [diagnosticoId]);

  useEffect(() => { cargar(); }, [cargar]);

  // ── Guardar nota (nueva o editada) ─────────────────────────────────────────
  function handleGuardada(nota, esEdicion) {
    setNotas(prev => esEdicion ? prev.map(n => n.id === nota.id ? { ...n, ...nota } : n) : [...prev, nota]);
    setModalAbierto(false);
    setEditando(null);
  }

  // ── Analizar una nota con IA ───────────────────────────────────────────────
  async function handleAnalizar(itemId) {
    const resultado = await apiService.analizarNotaCampo(diagnosticoId, itemId);
    setNotas(prev => prev.map(n => n.id === itemId
      ? { ...n,
          analisis_ia:       resultado.hallazgo_narrativo ?? '',
          inconsistencias:   resultado.inconsistencias    ?? [],
          severidad_ia:      resultado.severidad_global   ?? '',
          calificacion_ia:   resultado.calificacion       ?? '',
          cultura_seguridad: resultado.cultura_seguridad  ?? '',
        }
      : n));
  }

  // ── Eliminar nota ─────────────────────────────────────────────────────────
  async function handleEliminar(itemId) {
    await apiService.eliminarNotaCampo(diagnosticoId, itemId);
    setNotas(prev => prev.filter(n => n.id !== itemId));
  }

  // ── Triangulación global ───────────────────────────────────────────────────
  async function handleTriangular() {
    setTriangulando(true);
    setMostrarTriang(true);
    try {
      const resultado = await apiService.triangularCampo(diagnosticoId);
      setTriangulacion(resultado);
    } catch (e) {
      setTriangulacion({ error: e.message });
    } finally {
      setTriangulando(false);
    }
  }

  // ── Avanzar a Fase 4 ───────────────────────────────────────────────────────
  async function handleAvanzar() {
    setAvanzando(true);
    try {
      await apiService.patchProgreso(diagnosticoId, { estado: 'Entrevistas', paso_actual: 4 });
      onSiguiente(diagnosticoId);
    } catch (e) {
      alert('Error al avanzar: ' + e.message);
    } finally {
      setAvanzando(false);
    }
  }

  // ── Stats ──────────────────────────────────────────────────────────────────
  const criticos   = notas.filter(n => (n.severidad_ia || n.criticidad) === 'Crítico').length;
  const altos      = notas.filter(n => (n.severidad_ia || n.criticidad) === 'Alto').length;
  const analizadas = notas.filter(n => !!n.analisis_ia).length;

  // ── Calificación color global de triangulación ─────────────────────────────
  const califGlobalMap = {
    'Suficiente':   'text-green-700 bg-green-50 border-green-200',
    'Escasa':       'text-yellow-700 bg-yellow-50 border-yellow-200',
    'Al menos una': 'text-orange-700 bg-orange-50 border-orange-200',
    'No hay':       'text-red-700 bg-red-50 border-red-200',
  };

  return (
    <div className="bg-gray-50 min-h-screen">
      <div className="max-w-4xl mx-auto">

        {/* ── Header sticky ─────────────────────────────────────────────────── */}
        <div className="sticky top-0 z-10 bg-white border-b border-gray-100 px-6 py-4">
          {onNavegar && (
            <div className="mb-3 pb-3 border-b border-gray-100">
              <NavegacionFases faseActual={faseActual} onNavegar={onNavegar} soloLectura={soloLectura} />
            </div>
          )}
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-0.5">
                <Eye className="w-5 h-5 text-teal-600" />
                <h2 className="text-lg font-bold text-gray-900">Captura Sensorial de Campo — Fase 3</h2>
                {soloLectura && (
                  <span className="flex items-center gap-1 text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                    <Lock className="w-3 h-3" /> Solo lectura
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-500">
                Registra observaciones con voz, texto y foto · La IA detecta inconsistencias vs documentación
              </p>
            </div>
            <button onClick={onCerrar}
              className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors shrink-0">
              ✕
            </button>
          </div>

          {/* Stats bar */}
          {notas.length > 0 && (
            <div className="flex items-center gap-4 mt-3 pt-3 border-t border-gray-100">
              <span className="text-xs text-gray-500">{notas.length} nota{notas.length !== 1 ? 's' : ''}</span>
              {criticos > 0 && <span className="flex items-center gap-1 text-xs text-red-600 font-semibold"><AlertCircle className="w-3 h-3" />{criticos} Crítico{criticos !== 1 ? 's' : ''}</span>}
              {altos    > 0 && <span className="flex items-center gap-1 text-xs text-orange-600 font-medium"><AlertTriangle className="w-3 h-3" />{altos} Alto{altos !== 1 ? 's' : ''}</span>}
              {analizadas > 0 && <span className="flex items-center gap-1 text-xs text-indigo-600"><Sparkles className="w-3 h-3" />{analizadas} analizada{analizadas !== 1 ? 's' : ''}</span>}
            </div>
          )}
        </div>

        {/* ── Barra de herramientas ──────────────────────────────────────────── */}
        {!soloLectura && (
          <div className="flex items-center gap-3 px-6 py-3 bg-white border-b border-gray-100">
            <button onClick={() => { setEditando(null); setModalAbierto(true); }}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold transition-colors shadow-sm">
              <Plus className="w-4 h-4" /> Nueva Nota de Campo
            </button>
            <button onClick={handleTriangular} disabled={triangulando || notas.length === 0}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-700 text-sm font-semibold hover:bg-indigo-100 disabled:opacity-50 transition-colors">
              {triangulando ? <RefreshCw className="w-4 h-4 animate-spin" /> : <GitMerge className="w-4 h-4" />}
              {triangulando ? 'Triangulando…' : 'Triangular con Fase 2'}
            </button>
          </div>
        )}

        {/* ── Panel de triangulación global ─────────────────────────────────── */}
        {mostrarTriang && (
          <div className="mx-6 mt-4 rounded-xl border border-indigo-200 bg-indigo-50/60 overflow-hidden">
            <button onClick={() => setMostrarTriang(!mostrarTriang)}
              className="flex items-center justify-between w-full px-4 py-3 text-left">
              <span className="flex items-center gap-2 text-sm font-bold text-indigo-800">
                <GitMerge className="w-4 h-4" /> Triangulación Global: Campo ↔ Documentación ↔ Cuestionario
              </span>
              {triangulacion && !triangulando && (
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${califGlobalMap[triangulacion.calificacion_global] ?? 'text-gray-700 bg-gray-50 border-gray-200'}`}>
                  {triangulacion.calificacion_global ?? '…'}
                </span>
              )}
              <ChevronDown className="w-4 h-4 text-indigo-600" />
            </button>

            {triangulando ? (
              <div className="px-4 pb-4 flex items-center gap-2 text-sm text-indigo-600">
                <RefreshCw className="w-4 h-4 animate-spin" /> Procesando triangulación con IA…
              </div>
            ) : triangulacion?.error ? (
              <p className="px-4 pb-4 text-sm text-red-600">{triangulacion.error}</p>
            ) : triangulacion && (
              <div className="px-4 pb-5 space-y-4">
                {/* Resumen ejecutivo */}
                {triangulacion.resumen_ejecutivo && (
                  <div className="p-3 bg-white rounded-lg border border-indigo-200 text-xs text-indigo-900 leading-relaxed">
                    {triangulacion.resumen_ejecutivo}
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Brechas críticas */}
                  {triangulacion.brechas_criticas?.length > 0 && (
                    <div>
                      <p className="text-[10px] font-bold text-red-600 uppercase tracking-wide mb-2 flex items-center gap-1">
                        <ZapOff className="w-3 h-3" /> Brechas Críticas
                      </p>
                      <div className="space-y-1.5">
                        {triangulacion.brechas_criticas.map((b, i) => (
                          <div key={i} className={`p-2 rounded-lg text-xs border ${SEV_CFG[b.severidad]?.bg ?? 'bg-gray-50'}`}>
                            <div className="flex items-center gap-1 mb-0.5">
                              <SeveridadBadge valor={b.severidad} small />
                              <span className="font-medium text-gray-700">{b.area}</span>
                            </div>
                            <p className="text-gray-700">{b.descripcion}</p>
                            {b.norma && <p className="text-gray-400 mt-0.5">{b.norma}</p>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Fortalezas */}
                  {triangulacion.fortalezas?.length > 0 && (
                    <div>
                      <p className="text-[10px] font-bold text-green-600 uppercase tracking-wide mb-2 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> Fortalezas Confirmadas
                      </p>
                      <div className="space-y-1.5">
                        {triangulacion.fortalezas.map((f, i) => (
                          <div key={i} className="p-2 rounded-lg text-xs bg-green-50 border border-green-200">
                            <p className="font-medium text-green-800">{f.area}</p>
                            <p className="text-green-700">{f.descripcion}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Cultura de seguridad */}
                {triangulacion.cultura_seguridad?.narrativa && (
                  <div className="p-3 rounded-lg bg-amber-50 border border-amber-200">
                    <p className="text-[10px] font-bold text-amber-700 uppercase tracking-wide mb-1 flex items-center gap-1">
                      <Shield className="w-3 h-3" /> Cultura de Seguridad — Nivel: {triangulacion.cultura_seguridad.nivel}
                    </p>
                    <p className="text-xs text-amber-900 leading-relaxed">{triangulacion.cultura_seguridad.narrativa}</p>
                  </div>
                )}

                {/* Prioridades */}
                {triangulacion.prioridades_accion?.length > 0 && (
                  <div>
                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1">
                      <TrendingDown className="w-3 h-3" /> Top Prioridades de Acción
                    </p>
                    <ol className="space-y-1">
                      {triangulacion.prioridades_accion.map((p, i) => (
                        <li key={i} className="flex items-start gap-2 text-xs text-gray-700">
                          <span className="w-4 h-4 rounded-full bg-red-100 text-red-700 font-bold flex items-center justify-center shrink-0 text-[10px]">{i+1}</span>
                          {p}
                        </li>
                      ))}
                    </ol>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── Error / Loading ────────────────────────────────────────────────── */}
        {errorMsg && (
          <div className="mx-6 mt-4 flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">
            <AlertTriangle className="w-4 h-4 shrink-0" />{errorMsg}
            <button onClick={cargar} className="ml-auto text-xs underline">Reintentar</button>
          </div>
        )}

        {/* ── Timeline de notas ─────────────────────────────────────────────── */}
        <div className="px-6 py-6">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-gray-400">
              <RefreshCw className="w-5 h-5 animate-spin mr-2" /> Cargando notas de campo…
            </div>
          ) : notas.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-16 h-16 bg-teal-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Eye className="w-8 h-8 text-teal-400" />
              </div>
              <h3 className="font-semibold text-gray-700 mb-1">Sin notas de campo</h3>
              <p className="text-sm text-gray-400 max-w-sm mx-auto">
                Usa el botón <strong>"Nueva Nota de Campo"</strong> para capturar observaciones durante el recorrido. Puedes grabar tu voz o escribir manualmente.
              </p>
            </div>
          ) : (
            <div className="relative">
              {/* Línea vertical del timeline */}
              <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-gray-200 rounded-full" />

              <div className="pl-6 space-y-4">
                {notas.map(nota => (
                  <NotaCampoCard
                    key={nota.id}
                    nota={nota}
                    soloLectura={soloLectura}
                    apiBase={SERVER_BASE}
                    onEditar={(n) => { setEditando(n); setModalAbierto(true); }}
                    onEliminar={handleEliminar}
                    onAnalizar={handleAnalizar}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── Footer ────────────────────────────────────────────────────────── */}
        <div className="sticky bottom-0 bg-white border-t border-gray-100 px-6 py-4 flex items-center justify-between gap-4">
          <div className="text-xs text-gray-400">
            {notas.length} nota{notas.length !== 1 ? 's' : ''} registrada{notas.length !== 1 ? 's' : ''}
            {criticos + altos > 0 && ` · ${criticos + altos} hallazgo${criticos + altos !== 1 ? 's' : ''} de alto impacto`}
          </div>
          {!soloLectura && (
            <button onClick={handleAvanzar} disabled={avanzando}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold transition-colors shadow-sm disabled:opacity-60">
              {avanzando ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
              {avanzando ? 'Avanzando…' : 'Siguiente: Entrevistas (Fase 4)'}
            </button>
          )}
        </div>
      </div>

      {/* Modal de nueva/editar nota */}
      {modalAbierto && (
        <ModalNuevaNota
          diagnosticoId={diagnosticoId}
          notaInicial={editando}
          apiBase={SERVER_BASE}
          onGuardada={handleGuardada}
          onCerrar={() => { setModalAbierto(false); setEditando(null); }}
        />
      )}
    </div>
  );
}
