import { useState, useEffect, useCallback } from 'react';
import {
  Plus, Pencil, Trash2, RefreshCw, AlertTriangle,
  CheckCircle2, Clock, XCircle, ChevronDown, ChevronUp,
  Sparkles, Filter, CalendarDays, User, Target, Layers,
  Loader2, X, Save, AlertCircle, Brain, Bell, BellOff,
  Mail, Send,
} from 'lucide-react';
import apiService from '../services/apiService';
import { useAuth } from '../contexts/AuthContext';

// ─── Constantes de UI ────────────────────────────────────────────────────────

const CRITICIDADES = ['Crítico', 'Alto', 'Medio', 'Bajo'];
const ESTADOS      = ['Pendiente', 'En Progreso', 'Completado', 'Cancelado'];

const CRITICIDAD_CFG = {
  Crítico: { color: 'text-red-700',    bg: 'bg-red-100',    border: 'border-red-300',    dot: 'bg-red-500'    },
  Alto:    { color: 'text-orange-700', bg: 'bg-orange-100', border: 'border-orange-300', dot: 'bg-orange-500' },
  Medio:   { color: 'text-yellow-700', bg: 'bg-yellow-100', border: 'border-yellow-300', dot: 'bg-yellow-500' },
  Bajo:    { color: 'text-green-700',  bg: 'bg-green-100',  border: 'border-green-300',  dot: 'bg-green-500'  },
};

const ESTADO_CFG = {
  Pendiente:     { color: 'text-gray-600',   bg: 'bg-gray-100',   icon: Clock       },
  'En Progreso': { color: 'text-blue-700',   bg: 'bg-blue-100',   icon: RefreshCw   },
  Completado:    { color: 'text-green-700',  bg: 'bg-green-100',  icon: CheckCircle2 },
  Cancelado:     { color: 'text-red-600',    bg: 'bg-red-50',     icon: XCircle     },
};

// ─── Badges ──────────────────────────────────────────────────────────────────

function CriticidadBadge({ value }) {
  const cfg = CRITICIDAD_CFG[value] || CRITICIDAD_CFG.Medio;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${cfg.bg} ${cfg.color} border ${cfg.border}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {value}
    </span>
  );
}

function EstadoBadge({ value }) {
  const cfg = ESTADO_CFG[value] || ESTADO_CFG.Pendiente;
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${cfg.bg} ${cfg.color}`}>
      <Icon className="w-3 h-3" />
      {value}
    </span>
  );
}

// ─── Modal para crear / editar acción ────────────────────────────────────────

function ModalAccion({ item, diagnosticos, onGuardar, onCerrar }) {
  const esNuevo = !item?.id;
  const [form, setForm] = useState({
    nombre:                 item?.nombre                 || '',
    descripcion:            item?.descripcion            || '',
    responsable:            item?.responsable            || '',
    responsable_email:      item?.responsable_email      || '',
    fecha_limite:           item?.fecha_limite           ? item.fecha_limite.split('T')[0] : '',
    criticidad:             item?.criticidad             || 'Medio',
    estado:                 item?.estado                 || 'Pendiente',
    diagnostico_id:         item?.diagnostico_id         || '',
    elemento_psm:           item?.elemento_psm           || '',
    notificaciones_activas: item?.notificaciones_activas ?? false,
  });
  const [guardando, setGuardando] = useState(false);
  const [error, setError]         = useState('');

  async function handleGuardar() {
    if (!form.nombre.trim()) { setError('El nombre es obligatorio.'); return; }
    setGuardando(true);
    setError('');
    try {
      await onGuardar({ ...form, diagnostico_id: form.diagnostico_id || null });
      onCerrar();
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardando(false);
    }
  }

  const campo = (label, key, type = 'text', extra = {}) => (
    <div key={key}>
      <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide">{label}</label>
      <input
        type={type}
        value={form[key]}
        onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
        className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-green-500"
        {...extra}
      />
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onCerrar} />
      <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900">
            {esNuevo ? 'Nueva Acción de Corrección' : 'Editar Acción'}
          </h2>
          <button onClick={onCerrar} className="p-2 text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-100">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-auto px-6 py-5 space-y-4">
          {/* Nombre */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide">
              Nombre de la Acción <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.nombre}
              onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))}
              placeholder="Ej. Actualizar procedimiento de bloqueo de energía..."
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>

          {/* Descripción */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide">Descripción / Detalle</label>
            <textarea
              value={form.descripcion}
              onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))}
              rows={3}
              placeholder="Describe las actividades específicas a realizar..."
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
            />
          </div>

          {/* Fila 2: Responsable + Email */}
          <div className="grid grid-cols-2 gap-4">
            {campo('Responsable', 'responsable', 'text', { placeholder: 'Nombre del responsable' })}
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide">
                Correo Electrónico
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="email"
                  value={form.responsable_email}
                  onChange={e => setForm(f => ({ ...f, responsable_email: e.target.value }))}
                  placeholder="responsable@empresa.com"
                  className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
            </div>
          </div>

          {/* Fecha límite */}
          <div className="grid grid-cols-2 gap-4">
            {campo('Fecha Límite', 'fecha_limite', 'date')}
            <div />
          </div>

          {/* Fila 3: Criticidad + Estado */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide">
                Nivel de Criticidad
              </label>
              <select
                value={form.criticidad}
                onChange={e => setForm(f => ({ ...f, criticidad: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                {CRITICIDADES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide">Estado</label>
              <select
                value={form.estado}
                onChange={e => setForm(f => ({ ...f, estado: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                {ESTADOS.map(e => <option key={e} value={e}>{e}</option>)}
              </select>
            </div>
          </div>

          {/* Fila 4: Elemento PSM + Diagnóstico origen */}
          <div className="grid grid-cols-2 gap-4">
            {campo('Elemento PSM', 'elemento_psm', 'text', { placeholder: 'Ej. Análisis de Peligros (PHA)' })}
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide">Diagnóstico Origen</label>
              <select
                value={form.diagnostico_id}
                onChange={e => setForm(f => ({ ...f, diagnostico_id: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                <option value="">Sin diagnóstico asociado</option>
                {diagnosticos.map(d => (
                  <option key={d.id} value={d.id}>
                    {d.planta_nombre ?? `Diagnóstico #${d.id}`}{d.area_nombre ? ` / ${d.area_nombre}` : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Panel de Notificaciones */}
          <div className={`rounded-xl border-2 p-4 transition-colors ${
            form.notificaciones_activas ? 'border-green-200 bg-green-50' : 'border-gray-100 bg-gray-50'
          }`}>
            <div className="flex items-start gap-3">
              <div className="flex items-center gap-2 flex-1">
                <div className={`p-2 rounded-lg ${form.notificaciones_activas ? 'bg-green-100' : 'bg-gray-200'}`}>
                  {form.notificaciones_activas
                    ? <Bell className="w-4 h-4 text-green-700" />
                    : <BellOff className="w-4 h-4 text-gray-500" />}
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-800">Notificaciones por Email</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Envía recordatorios automáticos al responsable <strong>10, 5, 3 y 2 días</strong> antes de la fecha límite.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setForm(f => ({ ...f, notificaciones_activas: !f.notificaciones_activas }))}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors shrink-0 ${
                  form.notificaciones_activas ? 'bg-green-600' : 'bg-gray-300'
                }`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                  form.notificaciones_activas ? 'translate-x-6' : 'translate-x-1'
                }`} />
              </button>
            </div>

            {form.notificaciones_activas && (
              <div className="mt-3 pt-3 border-t border-green-200">
                {!form.responsable_email?.trim() ? (
                  <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    Se requiere un correo electrónico del responsable para activar las notificaciones.
                  </div>
                ) : !form.fecha_limite ? (
                  <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    Se requiere una fecha límite para programar los recordatorios.
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-xs text-green-700">
                    <Send className="w-3.5 h-3.5" />
                    <span>
                      Notificaciones activas para <strong>{form.responsable_email}</strong>.
                      Se enviarán recordatorios a los <strong>10, 5, 3 y 2</strong> días antes del{' '}
                      <strong>{new Date(form.fecha_limite + 'T00:00:00').toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric' })}</strong>.
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>

          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              <AlertCircle className="w-4 h-4 shrink-0" /> {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100">
          <button onClick={onCerrar} className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50">
            Cancelar
          </button>
          <button
            onClick={handleGuardar}
            disabled={guardando}
            className="flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white bg-green-600 hover:bg-green-700 rounded-lg disabled:opacity-60"
          >
            {guardando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {esNuevo ? 'Crear Acción' : 'Guardar Cambios'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Modal importar desde IA ─────────────────────────────────────────────────

function ModalImportarIA({ diagnosticos, onImportar, onCerrar }) {
  const [diagSeleccionado, setDiagSeleccionado] = useState('');
  const [importando, setImportando]             = useState(false);
  const [error, setError]                       = useState('');

  const diag = diagnosticos.find(d => String(d.id) === diagSeleccionado);
  const planIA = diag?.analisis_final_ia?.plan_accion || [];

  async function handleImportar() {
    if (!diagSeleccionado) { setError('Selecciona un diagnóstico.'); return; }
    setImportando(true);
    setError('');
    try {
      await onImportar(parseInt(diagSeleccionado));
      onCerrar();
    } catch (err) {
      setError(err.message);
    } finally {
      setImportando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onCerrar} />
      <div className="relative w-full max-w-xl bg-white rounded-2xl shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Brain className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg font-bold text-gray-900">Importar Plan desde Análisis IA</h2>
          </div>
          <button onClick={onCerrar} className="p-2 text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-100">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          <p className="text-sm text-gray-600">
            Selecciona un diagnóstico finalizado para importar automáticamente su plan de acción generado por la IA.
          </p>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide">Diagnóstico</label>
            <select
              value={diagSeleccionado}
              onChange={e => setDiagSeleccionado(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">— Seleccionar diagnóstico —</option>
              {diagnosticos.map(d => (
                <option key={d.id} value={d.id}>
                  #{d.id} — {d.planta_nombre ?? 'Sin planta'}{d.area_nombre ? ` / ${d.area_nombre}` : ''}
                  {d.analisis_final_ia?.puntaje_global != null ? ` (${d.analisis_final_ia.puntaje_global}%)` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Preview del plan IA */}
          {planIA.length > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-2">
              <p className="text-xs font-bold text-blue-700 uppercase">
                {planIA.length} acciones identificadas por la IA:
              </p>
              {planIA.map((p, i) => (
                <div key={i} className="flex items-start gap-2">
                  <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-[10px] font-black flex items-center justify-center shrink-0 mt-0.5">
                    {p.prioridad || i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-blue-900 leading-snug">{p.accion}</p>
                    {p.plazo && (
                      <span className="text-[10px] text-blue-500 font-semibold">⏱ {p.plazo}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {diagSeleccionado && planIA.length === 0 && (
            <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-700">
              Este diagnóstico no tiene un plan de acción en su análisis IA.
            </div>
          )}

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100">
          <button onClick={onCerrar} className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50">
            Cancelar
          </button>
          <button
            onClick={handleImportar}
            disabled={importando || !diagSeleccionado || planIA.length === 0}
            className="flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-lg disabled:opacity-50"
          >
            {importando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            Importar {planIA.length > 0 ? `${planIA.length} Acciones` : ''}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Fila de acción ──────────────────────────────────────────────────────────

function FilaAccion({ item, onEditar, onEliminar, onCambiarEstado }) {
  const [expandido,  setExpandido]  = useState(false);
  const [eliminando, setEliminando] = useState(false);
  const [confirmar,  setConfirmar]  = useState(false);

  const vencido = item.fecha_limite &&
    new Date(item.fecha_limite) < new Date() &&
    item.estado !== 'Completado' &&
    item.estado !== 'Cancelado';

  async function handleEliminar() {
    setEliminando(true);
    await onEliminar(item.id);
    setEliminando(false);
    setConfirmar(false);
  }

  return (
    <>
      <tr className={`border-b border-gray-50 hover:bg-gray-50/60 transition-colors ${vencido ? 'bg-red-50/30' : ''}`}>
        {/* Nombre */}
        <td className="px-4 py-3">
          <div className="flex items-start gap-2">
            <button onClick={() => setExpandido(v => !v)} className="mt-0.5 text-gray-300 hover:text-gray-600">
              {expandido ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
            <div>
              <p className="text-sm font-semibold text-gray-800 leading-snug">
                {item.nombre}
                {item.origen_ia && (
                  <span className="ml-2 inline-flex items-center gap-0.5 text-[10px] text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded-full font-bold">
                    <Sparkles className="w-2.5 h-2.5" /> IA
                  </span>
                )}
              </p>
              {item.elemento_psm && (
                <p className="text-xs text-gray-400 mt-0.5">{item.elemento_psm}</p>
              )}
              {item.planta_nombre && (
                <p className="text-xs text-gray-400">📍 {item.planta_nombre}</p>
              )}
            </div>
          </div>
        </td>

        {/* Responsable + email + notif */}
        <td className="px-4 py-3">
          {item.responsable ? (
            <div className="space-y-0.5">
              <div className="flex items-center gap-1.5 text-sm text-gray-700">
                <User className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                <span>{item.responsable}</span>
              </div>
              {item.responsable_email && (
                <div className="flex items-center gap-1.5">
                  <Mail className="w-3 h-3 text-gray-300 shrink-0" />
                  <span className="text-xs text-gray-400 truncate max-w-[160px]">{item.responsable_email}</span>
                  {item.notificaciones_activas
                    ? <Bell className="w-3 h-3 text-green-500 shrink-0" title="Notificaciones activas" />
                    : <BellOff className="w-3 h-3 text-gray-300 shrink-0" title="Notificaciones inactivas" />}
                </div>
              )}
            </div>
          ) : (
            <span className="text-gray-400 text-sm">—</span>
          )}
        </td>

        {/* Fecha */}
        <td className="px-4 py-3">
          {item.fecha_limite ? (
            <div className={`flex items-center gap-1.5 text-sm font-medium ${vencido ? 'text-red-600' : 'text-gray-700'}`}>
              <CalendarDays className={`w-3.5 h-3.5 ${vencido ? 'text-red-500' : 'text-gray-400'}`} />
              {new Date(item.fecha_limite).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })}
              {vencido && <span className="text-[10px] font-bold text-red-500 bg-red-50 px-1 rounded">VENCIDO</span>}
            </div>
          ) : (
            item.plazo_ia
              ? <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">{item.plazo_ia}</span>
              : <span className="text-gray-400 text-sm">—</span>
          )}
        </td>

        {/* Criticidad */}
        <td className="px-4 py-3"><CriticidadBadge value={item.criticidad} /></td>

        {/* Estado */}
        <td className="px-4 py-3">
          <select
            value={item.estado}
            onChange={e => onCambiarEstado(item.id, e.target.value)}
            className="text-xs rounded-lg border border-gray-200 px-2 py-1 bg-white focus:outline-none focus:ring-2 focus:ring-green-500"
          >
            {ESTADOS.map(e => <option key={e} value={e}>{e}</option>)}
          </select>
        </td>

        {/* Acciones */}
        <td className="px-4 py-3 text-right">
          {confirmar ? (
            <div className="flex items-center gap-1 justify-end">
              <button onClick={() => setConfirmar(false)} className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1">Cancelar</button>
              <button onClick={handleEliminar} disabled={eliminando}
                className="text-xs text-white bg-red-600 hover:bg-red-700 px-2 py-1 rounded-lg disabled:opacity-60">
                {eliminando ? '...' : 'Eliminar'}
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1 justify-end">
              <button onClick={() => onEditar(item)} title="Editar"
                className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                <Pencil className="w-3.5 h-3.5" />
              </button>
              <button onClick={() => setConfirmar(true)} title="Eliminar"
                className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </td>
      </tr>

      {/* Fila expandida con descripción */}
      {expandido && (
        <tr className="bg-blue-50/30 border-b border-gray-50">
          <td colSpan={6} className="px-10 pb-4 pt-1">
            {item.descripcion ? (
              <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{item.descripcion}</p>
            ) : (
              <p className="text-sm text-gray-400 italic">Sin descripción adicional.</p>
            )}
          </td>
        </tr>
      )}
    </>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function PlanDeAccion() {
  const { usuario } = useAuth();

  const [items,         setItems]         = useState([]);
  const [diagnosticos,  setDiagnosticos]  = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [modalAbierto,  setModalAbierto]  = useState(false);
  const [modalImportar, setModalImportar] = useState(false);
  const [editando,      setEditando]      = useState(null);   // null = nuevo
  const [filtroCrit,    setFiltroCrit]    = useState('');
  const [filtroEstado,  setFiltroEstado]  = useState('');
  const [filtroDiag,    setFiltroDiag]    = useState('');

  const [enviandoNotif, setEnviandoNotif] = useState(false);

  async function handleProbarNotificaciones() {
    setEnviandoNotif(true);
    try {
      const r = await apiService.enviarNotificacionesPlan();
      alert(`Ciclo completado:\n✓ ${r.enviados} notificación(es) enviada(s)\n✗ ${r.errores} error(es)\n\n${r.enviados === 0 ? 'No había acciones que cumplieran los criterios (10, 5, 3 o 2 días para vencer).' : ''}`);
    } catch (err) {
      alert(`Error: ${err.message}`);
    } finally {
      setEnviandoNotif(false);
    }
  }

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const [itemsData, diagData] = await Promise.all([
        apiService.fetchPlanAccion({ criticidad: filtroCrit, estado: filtroEstado, diagnostico_id: filtroDiag }),
        apiService.fetchDiagnosticosFinalizados(),
      ]);
      setItems(itemsData);
      setDiagnosticos(diagData);
    } catch { setItems([]); }
    finally { setLoading(false); }
  }, [filtroCrit, filtroEstado, filtroDiag]);

  useEffect(() => { cargar(); }, [cargar]);

  async function handleGuardar(form) {
    if (editando?.id) {
      const updated = await apiService.updatePlanAccionItem(editando.id, form);
      setItems(prev => prev.map(i => i.id === editando.id ? { ...i, ...updated } : i));
    } else {
      const created = await apiService.createPlanAccionItem(form);
      setItems(prev => [created, ...prev]);
    }
  }

  async function handleEliminar(id) {
    await apiService.deletePlanAccionItem(id);
    setItems(prev => prev.filter(i => i.id !== id));
  }

  async function handleCambiarEstado(id, nuevoEstado) {
    const item = items.find(i => i.id === id);
    if (!item) return;
    const updated = await apiService.updatePlanAccionItem(id, { ...item, estado: nuevoEstado });
    setItems(prev => prev.map(i => i.id === id ? { ...i, estado: nuevoEstado } : i));
  }

  async function handleImportarIA(diagId) {
    await apiService.importarPlanIA(diagId);
    await cargar();
  }

  function abrirNuevo()       { setEditando(null); setModalAbierto(true);  }
  function abrirEditar(item)  { setEditando(item); setModalAbierto(true);  }

  // ── Métricas rápidas ────────────────────────────────────────────────────
  const total      = items.length;
  const pendiente  = items.filter(i => i.estado === 'Pendiente').length;
  const enProgreso = items.filter(i => i.estado === 'En Progreso').length;
  const completado = items.filter(i => i.estado === 'Completado').length;
  const criticos   = items.filter(i => i.criticidad === 'Crítico' && i.estado !== 'Completado' && i.estado !== 'Cancelado').length;

  return (
    <div className="min-h-screen bg-gray-50">

      {/* ── Header sticky ─────────────────────────────────────────────────── */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-20">
        <div className="px-8 lg:px-10 py-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-100 rounded-xl">
                <Target className="w-6 h-6 text-amber-700" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">Plan de Acción</h1>
                <p className="text-sm text-gray-500 mt-0.5">
                  Acciones correctivas derivadas de los diagnósticos PSM
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={cargar} className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg" title="Actualizar">
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </button>
              <button
                onClick={handleProbarNotificaciones}
                disabled={enviandoNotif}
                className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 border border-gray-200 rounded-xl transition-colors disabled:opacity-50"
                title="Ejecutar ciclo de notificaciones ahora (para probar)"
              >
                {enviandoNotif ? <Loader2 className="w-4 h-4 animate-spin" /> : <Bell className="w-4 h-4" />}
                Enviar Notificaciones
              </button>
              <button
                onClick={() => setModalImportar(true)}
                disabled={diagnosticos.length === 0}
                className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-xl transition-colors disabled:opacity-50"
                title={diagnosticos.length === 0 ? 'No hay diagnósticos finalizados con análisis IA' : 'Importar desde análisis IA'}
              >
                <Brain className="w-4 h-4" /> Importar desde IA
              </button>
              <button
                onClick={abrirNuevo}
                className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-green-600 hover:bg-green-700 rounded-xl shadow-sm transition-colors"
              >
                <Plus className="w-4 h-4" /> Nueva Acción
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="px-8 lg:px-10 py-8 space-y-6">

        {/* ── Métricas ──────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {[
            { label: 'Total',       value: total,      color: 'text-gray-700',   bg: 'bg-white',         icon: Layers    },
            { label: 'Pendientes',  value: pendiente,  color: 'text-gray-600',   bg: 'bg-gray-50',       icon: Clock     },
            { label: 'En Progreso', value: enProgreso, color: 'text-blue-700',   bg: 'bg-blue-50',       icon: RefreshCw },
            { label: 'Completadas', value: completado, color: 'text-green-700',  bg: 'bg-green-50',      icon: CheckCircle2 },
            { label: 'Críticas',    value: criticos,   color: 'text-red-700',    bg: 'bg-red-50',        icon: AlertTriangle },
          ].map(({ label, value, color, bg, icon: Icon }) => (
            <div key={label} className={`${bg} rounded-xl border border-gray-100 shadow-sm p-4 flex items-center gap-3`}>
              <Icon className={`w-5 h-5 ${color}`} />
              <div>
                <p className="text-xs text-gray-500">{label}</p>
                <p className={`text-2xl font-black ${color}`}>{value}</p>
              </div>
            </div>
          ))}
        </div>

        {/* ── Filtros ───────────────────────────────────────────────────────── */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm px-5 py-3">
          <div className="flex items-center gap-4 flex-wrap">
            <Filter className="w-4 h-4 text-gray-400 shrink-0" />
            <select value={filtroCrit} onChange={e => setFiltroCrit(e.target.value)}
              className="px-3 py-1.5 rounded-lg border border-gray-200 text-sm bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-green-500">
              <option value="">Todas las criticidades</option>
              {CRITICIDADES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <select value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)}
              className="px-3 py-1.5 rounded-lg border border-gray-200 text-sm bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-green-500">
              <option value="">Todos los estados</option>
              {ESTADOS.map(e => <option key={e} value={e}>{e}</option>)}
            </select>
            <select value={filtroDiag} onChange={e => setFiltroDiag(e.target.value)}
              className="px-3 py-1.5 rounded-lg border border-gray-200 text-sm bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-green-500">
              <option value="">Todos los diagnósticos</option>
              {diagnosticos.map(d => (
                <option key={d.id} value={d.id}>
                  {d.planta_nombre ?? `Diagnóstico #${d.id}`}
                </option>
              ))}
            </select>
            {(filtroCrit || filtroEstado || filtroDiag) && (
              <button onClick={() => { setFiltroCrit(''); setFiltroEstado(''); setFiltroDiag(''); }}
                className="text-xs text-gray-400 hover:text-gray-700 underline">Limpiar</button>
            )}
            <span className="ml-auto text-xs text-gray-400">{items.length} acciones</span>
          </div>
        </div>

        {/* ── Tabla principal ──────────────────────────────────────────────── */}
        {loading ? (
          <div className="flex items-center justify-center py-16 bg-white rounded-xl shadow-sm border border-gray-100">
            <Loader2 className="w-6 h-6 text-green-500 animate-spin mr-2" />
            <span className="text-gray-500">Cargando plan de acción…</span>
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-xl shadow-sm border border-gray-100">
            <Target className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-600 font-semibold mb-1">No hay acciones registradas</p>
            <p className="text-gray-400 text-sm mb-6">
              {diagnosticos.length > 0
                ? 'Importa el plan de acción desde el análisis IA o crea acciones manualmente.'
                : 'Crea una acción manualmente o finaliza un diagnóstico para importar desde IA.'}
            </p>
            <div className="flex items-center justify-center gap-3">
              {diagnosticos.length > 0 && (
                <button onClick={() => setModalImportar(true)}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100">
                  <Brain className="w-4 h-4" /> Importar desde IA
                </button>
              )}
              <button onClick={abrirNuevo}
                className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-green-600 rounded-lg hover:bg-green-700">
                <Plus className="w-4 h-4" /> Nueva Acción
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide">
                  <tr>
                    <th className="px-4 py-3 text-left">Acción Correctiva</th>
                    <th className="px-4 py-3 text-left">Responsable</th>
                    <th className="px-4 py-3 text-left">Fecha Límite</th>
                    <th className="px-4 py-3 text-left">Criticidad</th>
                    <th className="px-4 py-3 text-left">Estado</th>
                    <th className="px-4 py-3 text-right">Editar</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map(item => (
                    <FilaAccion
                      key={item.id}
                      item={item}
                      onEditar={abrirEditar}
                      onEliminar={handleEliminar}
                      onCambiarEstado={handleCambiarEstado}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* ── Modales ───────────────────────────────────────────────────────── */}
      {modalAbierto && (
        <ModalAccion
          item={editando}
          diagnosticos={diagnosticos}
          onGuardar={handleGuardar}
          onCerrar={() => { setModalAbierto(false); setEditando(null); }}
        />
      )}
      {modalImportar && (
        <ModalImportarIA
          diagnosticos={diagnosticos}
          onImportar={handleImportarIA}
          onCerrar={() => setModalImportar(false)}
        />
      )}
    </div>
  );
}
