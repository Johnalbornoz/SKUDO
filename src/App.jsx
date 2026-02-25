import { useState, useEffect } from 'react';
import skudoLogo from '../img/Skudo Logo.svg';
import aiService from './services/aiService';
import apiService from './services/apiService';
import { useAuth } from './contexts/AuthContext';
import LoginScreen from './components/LoginScreen';
import PlantasAdmin from './components/PlantasAdmin';
import ConsultorDashboard from './components/ConsultorDashboard';
import UsuariosAdmin from './components/UsuariosAdmin';
import DiagnosticoWizard from './components/DiagnosticoWizard';
import DiagnosticosDashboard from './components/DiagnosticosDashboard';
import DiagnosticoView from './components/DiagnosticoView';
import RecorridoView from './components/RecorridoView';
import EvidenciaView from './components/EvidenciaView';
import EntrevistasView from './components/EntrevistasView';
import NavegacionFases from './components/NavegacionFases';
import {
  LayoutDashboard,
  Stethoscope,
  ListChecks,
  TrendingUp,
  Settings,
  ClipboardCheck,
  FileText,
  LogOut,
  Building2,
} from 'lucide-react';

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'diagnostico', label: 'Diagnóstico' },
  { id: 'plan', label: 'Plan de Acción' },
  { id: 'pronostico', label: 'Pronóstico' },
];

const CARDS = [
  {
    title: 'Diagnóstico Fase I',
    description: 'Evaluación inicial, análisis documental y triangulación de hallazgos en planta.',
    icon: ClipboardCheck,
    iconBg: 'bg-green-50',
    iconColor: 'text-green-600',
  },
  {
    title: 'Plan de Acción',
    description: 'Definición de medidas de mitigación y cronograma de cierre de brechas.',
    icon: FileText,
    iconBg: 'bg-blue-50',
    iconColor: 'text-blue-600',
  },
  {
    title: 'Pronóstico',
    description: 'Modelado de riesgos futuros y análisis de tendencias de seguridad.',
    icon: TrendingUp,
    iconBg: 'bg-amber-50',
    iconColor: 'text-amber-600',
  },
];

function SidebarLink({ label, isActive, onClick, icon: Icon }) {
  return (
    <button
      type="button"
      onClick={() => onClick(label)}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left font-medium transition-colors ${
        isActive
          ? 'bg-green-100 text-gray-800'
          : 'text-gray-600 hover:bg-gray-50 hover:text-gray-800'
      }`}
    >
      <Icon className={`w-5 h-5 shrink-0 ${isActive ? 'text-gray-700' : 'text-gray-400'}`} />
      {label}
    </button>
  );
}

function Card({ title, description, icon: Icon, iconBg, iconColor, onClick }) {
  return (
    <article
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => e.key === 'Enter' && onClick() : undefined}
      onClick={onClick || undefined}
      className={`bg-white rounded-xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition-shadow ${
        onClick ? 'cursor-pointer focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2' : ''
      }`}
    >
      <div className={`w-12 h-12 rounded-lg ${iconBg} flex items-center justify-center mb-4`}>
        <Icon className={`w-6 h-6 ${iconColor}`} />
      </div>
      <h3 className="text-lg font-semibold text-gray-900 mb-2">{title}</h3>
      <p className="text-gray-600 text-sm leading-relaxed">{description}</p>
    </article>
  );
}

const SIDEBAR_ICONS = {
  Dashboard: LayoutDashboard,
  Diagnóstico: Stethoscope,
  'Plan de Acción': ListChecks,
  Pronóstico: TrendingUp,
  'Consultor': Building2,
  Configuración: Settings,
};

// ── Campos del formulario de edición de preguntas ────────────────────────
const PREGUNTA_VACIA = {
  complejidad: 1, elemento: '', pregunta: '',
  plan_escasa: '', plan_al_menos: '', plan_no_evidencia: '',
  evidencia_suficiente: '', evidencia_escasa: '', evidencia_al_menos: '',
  evidencia_no_evidencia: '', evidencia_no_aplica: '',
  guia_suficiente: '', guia_escasa: '', guia_al_menos: '',
  guia_no_evidencia: '', guia_no_aplica: '', legislacion: '', herramienta: '',
};

const CAMPOS_PREGUNTA = [
  {
    seccion: 'Básico',
    campos: [
      { key: 'complejidad', label: 'Complejidad', type: 'number' },
      { key: 'elemento', label: 'Elemento PSM', type: 'text' },
      { key: 'pregunta', label: 'Pregunta normativa', type: 'textarea', rows: 4 },
    ],
  },
  {
    seccion: 'Plan de Acción',
    campos: [
      { key: 'plan_escasa', label: 'Escasa evidencia (varios procesos)', type: 'textarea', rows: 3 },
      { key: 'plan_al_menos', label: 'Al menos una evidencia', type: 'textarea', rows: 3 },
      { key: 'plan_no_evidencia', label: 'No hay evidencia', type: 'textarea', rows: 3 },
    ],
  },
  {
    seccion: 'Evidencia',
    campos: [
      { key: 'evidencia_suficiente', label: 'Suficiente, sistemática y periódica', type: 'textarea', rows: 3 },
      { key: 'evidencia_escasa', label: 'Escasa (varios procesos)', type: 'textarea', rows: 3 },
      { key: 'evidencia_al_menos', label: 'Al menos una evidencia', type: 'textarea', rows: 3 },
      { key: 'evidencia_no_evidencia', label: 'No hay evidencia', type: 'textarea', rows: 3 },
      { key: 'evidencia_no_aplica', label: 'No aplica', type: 'textarea', rows: 3 },
    ],
  },
  {
    seccion: 'Guía del Auditor',
    campos: [
      { key: 'guia_suficiente', label: 'Nivel suficiente', type: 'textarea', rows: 3 },
      { key: 'guia_escasa', label: 'Nivel escasa evidencia', type: 'textarea', rows: 3 },
      { key: 'guia_al_menos', label: 'Nivel al menos una evidencia', type: 'textarea', rows: 3 },
      { key: 'guia_no_evidencia', label: 'Nivel no hay evidencia', type: 'textarea', rows: 3 },
      { key: 'guia_no_aplica', label: 'No aplica', type: 'textarea', rows: 3 },
    ],
  },
  {
    seccion: 'Normativo',
    campos: [
      { key: 'legislacion', label: 'Legislación que Aplica', type: 'textarea', rows: 3 },
      { key: 'herramienta', label: 'Herramienta Tecnológica', type: 'textarea', rows: 3 },
    ],
  },
];

function MatrizPreguntas() {
  const [preguntas, setPreguntas] = useState([]);
  const [busqueda, setBusqueda] = useState('');
  const [cargando, setCargando] = useState(false);
  const [cargandoId, setCargandoId] = useState(null);
  const [editando, setEditando] = useState(null);
  const [esNueva, setEsNueva] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [confirmarId, setConfirmarId] = useState(null);
  const [errMsg, setErrMsg] = useState('');

  useEffect(() => { cargar(); }, []);

  async function cargar() {
    setCargando(true);
    try {
      const data = await apiService.fetchPreguntas();
      setPreguntas(data);
    } catch { /* silencioso */ }
    finally { setCargando(false); }
  }

  async function abrirEditar(id) {
    const numId = Number(id);
    setCargandoId(numId);
    try {
      const full = await apiService.fetchPregunta(numId);
      setEditando(full);
      setEsNueva(false);
    } catch (err) {
      alert(`Error al cargar detalle: ${err.message}`);
    } finally { setCargandoId(null); }
  }

  function abrirNueva() { setEditando({ ...PREGUNTA_VACIA }); setEsNueva(true); setErrMsg(''); }
  function cerrarModal() { setEditando(null); setErrMsg(''); }

  async function guardar() {
    setGuardando(true); setErrMsg('');
    try {
      // Normalizar tipos antes de enviar al backend
      const payload = {
        ...editando,
        complejidad: parseInt(editando.complejidad, 10) || 1,
      };
      if (esNueva) {
        await apiService.createPregunta(payload);
      } else {
        await apiService.updatePregunta(Number(editando.id), payload);
      }
      await cargar();
      cerrarModal();
    } catch (err) {
      setErrMsg(`Error: ${err.message}`);
    } finally { setGuardando(false); }
  }

  async function confirmarEliminar(id) {
    const numId = Number(id);
    try {
      await apiService.deletePregunta(numId);
      // Actualización optimista: elimina la fila visualmente de inmediato
      setPreguntas((prev) => prev.filter((p) => Number(p.id) !== numId));
      setConfirmarId(null);
    } catch (err) {
      alert(`Error al eliminar: ${err.message}`);
    }
  }

  const filtradas = preguntas.filter((p) =>
    !busqueda ||
    p.elemento?.toLowerCase().includes(busqueda.toLowerCase()) ||
    p.pregunta?.toLowerCase().includes(busqueda.toLowerCase())
  );

  return (
    <div>
      {/* Toolbar */}
      <div className="flex items-center gap-3 mb-4">
        <input
          type="text"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar por elemento o pregunta..."
          className="flex-1 px-4 py-2 rounded-lg border border-gray-200 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
        />
        <button
          type="button"
          onClick={abrirNueva}
          className="px-4 py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white text-sm font-semibold transition-colors whitespace-nowrap"
        >
          + Adicionar
        </button>
      </div>

      <p className="text-xs text-gray-400 mb-3">
        {cargando
          ? 'Cargando preguntas...'
          : `${filtradas.length} pregunta${filtradas.length !== 1 ? 's' : ''}${busqueda ? ' encontradas' : ' en la matriz'}`}
      </p>

      {/* Tabla */}
      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 w-10">#</th>
              <th className="px-3 py-2.5 text-center text-xs font-semibold text-gray-500 w-12">Cmpl.</th>
              <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 w-44">Elemento</th>
              <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500">Pregunta normativa</th>
              <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-500 w-32">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtradas.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-10 text-center text-gray-400 text-sm">
                  {cargando ? 'Cargando...' : 'No se encontraron preguntas. Ejecuta npm run seed:preguntas para cargar el CSV.'}
                </td>
              </tr>
            )}
            {filtradas.map((p) => (
              <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-3 py-2.5 text-gray-400 font-mono text-xs">{p.id}</td>
                <td className="px-3 py-2.5 text-center">
                  <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-50 text-blue-700 text-xs font-bold">
                    {p.complejidad}
                  </span>
                </td>
                <td className="px-3 py-2.5 text-gray-700 text-xs font-medium">{p.elemento}</td>
                <td className="px-3 py-2.5 text-gray-500 text-xs leading-relaxed max-w-xs">
                  {p.pregunta?.length > 130 ? p.pregunta.slice(0, 130) + '…' : p.pregunta}
                </td>
                <td className="px-3 py-2.5 text-right">
                  <div className="flex items-center justify-end gap-1.5">
                    <button
                      type="button"
                      onClick={() => abrirEditar(p.id)}
                      disabled={cargandoId === p.id}
                      className="px-2.5 py-1 rounded-md bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-medium transition-colors disabled:opacity-50"
                    >
                      {cargandoId === p.id ? '...' : 'Editar'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmarId(p.id)}
                      className="px-2.5 py-1 rounded-md bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-medium transition-colors"
                    >
                      Borrar
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal Editar / Nueva */}
      {editando && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" aria-modal="true" role="dialog">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={cerrarModal} aria-hidden="true" />
          <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-xl flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-gray-100 shrink-0">
              <h2 className="text-lg font-bold text-gray-900">
                {esNueva ? 'Nueva Pregunta Normativa' : `Editar Pregunta #${editando.id}`}
              </h2>
            </div>

            <div className="overflow-y-auto px-6 py-5 space-y-6 flex-1">
              {CAMPOS_PREGUNTA.map(({ seccion, campos }) => (
                <div key={seccion}>
                  <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 pb-1 border-b border-gray-100">
                    {seccion}
                  </h3>
                  <div className="space-y-3">
                    {campos.map(({ key, label, type, rows }) => (
                      <div key={key}>
                        <label className="block text-xs font-medium text-gray-700 mb-1">{label}</label>
                        {type === 'textarea' ? (
                          <textarea
                            value={editando[key] ?? ''}
                            onChange={(e) => setEditando({ ...editando, [key]: e.target.value })}
                            rows={rows}
                            className="w-full px-3 py-2 rounded-lg border border-gray-200 text-gray-800 text-xs focus:outline-none focus:ring-2 focus:ring-green-500 resize-y leading-relaxed"
                          />
                        ) : (
                          <input
                            type={type}
                            value={editando[key] ?? ''}
                            onChange={(e) => setEditando({ ...editando, [key]: e.target.value })}
                            className="w-full px-3 py-2 rounded-lg border border-gray-200 text-gray-800 text-xs focus:outline-none focus:ring-2 focus:ring-green-500"
                          />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              {errMsg && <p className="text-xs text-rose-600 font-medium">{errMsg}</p>}
            </div>

            <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3 shrink-0">
              <button
                type="button"
                onClick={cerrarModal}
                className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={guardar}
                disabled={guardando}
                className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-green-600 hover:bg-green-700 transition-colors disabled:opacity-60"
              >
                {guardando ? 'Guardando...' : 'Guardar pregunta'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmación de borrado */}
      {confirmarId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" aria-modal="true" role="dialog">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setConfirmarId(null)} aria-hidden="true" />
          <div className="relative w-full max-w-md bg-white rounded-2xl shadow-xl p-6">
            <div className="w-12 h-12 rounded-full bg-rose-100 flex items-center justify-center mb-4">
              <span className="text-rose-600 text-xl">⚠</span>
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">Eliminar pregunta normativa</h3>
            <p className="text-sm text-gray-600 mb-6">
              ¿Deseas eliminar la pregunta <strong>#{confirmarId}</strong> de la matriz?{' '}
              <span className="text-rose-600 font-semibold">Esta acción es irreversible.</span>
            </p>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setConfirmarId(null)}
                className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => confirmarEliminar(confirmarId)}
                className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-rose-600 hover:bg-rose-700 transition-colors"
              >
                Sí, eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const ADMIN_TABS = [
  { id: 'infraestructura',  label: 'Infraestructura',        roles: null },
  { id: 'logica-ia',        label: 'Lógica IA',              roles: null },
  { id: 'matriz-preguntas', label: 'Matriz de Preguntas',    roles: null },
  { id: 'empresas',         label: 'Empresas',               roles: ['SuperAdmin'] },
  { id: 'sedes',            label: 'Sedes',                  roles: ['SuperAdmin','AdminInquilino'] },
  { id: 'criterios',        label: 'Criterios de Puntuación',roles: null },
  { id: 'usuarios',         label: 'Usuarios',               roles: ['SuperAdmin','AdminInquilino'] },
];

const ROL_LABELS = {
  SuperAdmin:     'Super Admin',
  Consultor:      'Consultor',
  AdminInquilino: 'Admin Empresa',
  Auditor:        'Auditor',
  Lector:         'Lector',
};

// ─── Componente: Gestión de Empresas (Tenants) ───────────────────────────────

const PLAN_TIPOS = ['Básico', 'Profesional', 'Enterprise'];

function EmpresasAdmin() {
  const [tenants, setTenants]     = useState([]);
  const [loading, setLoading]     = useState(true);
  const [modalAbierto, setModal]  = useState(false);
  const [editando, setEditando]   = useState(null); // null = nuevo
  const [form, setForm]           = useState({ nombre: '', nit: '', logo_url: '', plan_tipo: 'Básico' });
  const [error, setError]         = useState('');
  const [guardando, setGuardando] = useState(false);

  useEffect(() => { cargar(); }, []);

  async function cargar() {
    setLoading(true);
    try { setTenants(await apiService.fetchTenants()); }
    catch { setTenants([]); }
    finally { setLoading(false); }
  }

  function abrirNuevo() {
    setEditando(null);
    setForm({ nombre: '', nit: '', logo_url: '', plan_tipo: 'Básico' });
    setError('');
    setModal(true);
  }

  function abrirEditar(t) {
    setEditando(t);
    setForm({ nombre: t.nombre, nit: t.nit || '', logo_url: t.logo_url || '', plan_tipo: t.plan_tipo || 'Básico' });
    setError('');
    setModal(true);
  }

  async function guardar() {
    if (!form.nombre.trim()) { setError('El nombre de la empresa es obligatorio.'); return; }
    setGuardando(true);
    setError('');
    try {
      if (editando) {
        const updated = await apiService.updateTenant(editando.id, form);
        setTenants((prev) => prev.map((t) => (t.id === editando.id ? updated : t)));
      } else {
        const created = await apiService.createTenant(form);
        setTenants((prev) => [...prev, created]);
      }
      setModal(false);
    } catch (err) {
      setError(err?.message || 'Error al guardar');
    } finally {
      setGuardando(false);
    }
  }

  const PLAN_BADGE = {
    'Básico':       'bg-gray-100 text-gray-600',
    'Profesional':  'bg-blue-100 text-blue-700',
    'Enterprise':   'bg-purple-100 text-purple-700',
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="text-base font-semibold text-gray-800">Empresas cliente (Tenants)</h3>
          <p className="text-sm text-gray-500 mt-0.5">Administra las organizaciones que usan SKUDO.</p>
        </div>
        <button
          onClick={abrirNuevo}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white text-sm font-semibold transition-colors shadow-sm"
        >
          <span className="text-base leading-none">+</span> Nueva empresa
        </button>
      </div>

      {loading ? (
        <p className="text-sm text-gray-400 py-8 text-center">Cargando...</p>
      ) : tenants.length === 0 ? (
        <div className="text-center py-16 text-gray-400 text-sm">
          No hay empresas registradas. Crea la primera con el botón de arriba.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-100">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide">
              <tr>
                <th className="px-4 py-3 text-left">Empresa</th>
                <th className="px-4 py-3 text-left">NIT</th>
                <th className="px-4 py-3 text-left">Plan</th>
                <th className="px-4 py-3 text-left">Creada</th>
                <th className="px-4 py-3 text-right">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {tenants.map((t) => (
                <tr key={t.id} className="hover:bg-gray-50/60 transition-colors">
                  <td className="px-4 py-3 font-medium text-gray-800">{t.nombre}</td>
                  <td className="px-4 py-3 text-gray-500">{t.nit || '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${PLAN_BADGE[t.plan_tipo] ?? 'bg-gray-100 text-gray-600'}`}>
                      {t.plan_tipo || 'Básico'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-400">
                    {t.created_at ? new Date(t.created_at).toLocaleDateString('es-CO') : '—'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => abrirEditar(t)}
                      className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-100 text-gray-600 font-medium transition-colors"
                    >
                      Editar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal de creación/edición */}
      {modalAbierto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setModal(false)} aria-hidden="true" />
          <div className="relative w-full max-w-md bg-white rounded-2xl shadow-xl border border-gray-100 p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">
              {editando ? 'Editar empresa' : 'Nueva empresa'}
            </h3>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wide">Nombre *</label>
                <input
                  value={form.nombre}
                  onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-green-500"
                  placeholder="Ej. Petroquímica del Norte S.A."
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wide">NIT</label>
                <input
                  value={form.nit}
                  onChange={(e) => setForm({ ...form, nit: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-green-500"
                  placeholder="Ej. 900.123.456-7"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wide">URL del Logo</label>
                <input
                  value={form.logo_url}
                  onChange={(e) => setForm({ ...form, logo_url: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-green-500"
                  placeholder="https://..."
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wide">Plan</label>
                <select
                  value={form.plan_tipo}
                  onChange={(e) => setForm({ ...form, plan_tipo: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-green-500"
                >
                  {PLAN_TIPOS.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
            </div>

            {error && <p className="mt-3 text-sm text-red-600 font-medium">{error}</p>}

            <div className="flex gap-3 mt-5">
              <button
                onClick={() => setModal(false)}
                className="flex-1 px-4 py-2.5 rounded-lg text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={guardar}
                disabled={guardando}
                className="flex-1 px-4 py-2.5 rounded-lg text-sm font-semibold text-white bg-green-600 hover:bg-green-700 transition-colors disabled:opacity-60"
              >
                {guardando ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Componente principal App ─────────────────────────────────────────────────

export default function App() {
  const { isAuthenticated, usuario, logout } = useAuth();

  const [activeNav, setActiveNav] = useState('Dashboard');
  const [activeAdminTab, setActiveAdminTab] = useState('infraestructura');
  // Router de páginas: view = null (dashboard/nav normal) | 'wizard' | 'cuestionario' | 'documentos' | 'recorrido' | 'entrevistas' | 'validacion'
  const [currentPage, setCurrentPage] = useState({ view: null, diagId: null, nivel: null });
  const [diagnosticoText, setDiagnosticoText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [geminiResponse, setGeminiResponse] = useState('');
  const [diagnosticoGuardado, setDiagnosticoGuardado] = useState(false);
  // Selector de planta/área en el modal de diagnóstico
  const [modalPlantas, setModalPlantas] = useState([]);
  const [modalAreas, setModalAreas] = useState([]);
  const [modalAllAreas, setModalAllAreas] = useState([]);
  const [plantaId, setPlantaId] = useState('');
  const [areaId, setAreaId] = useState('');
  const [configEmpresa, setConfigEmpresa] = useState('');
  const [configSector, setConfigSector] = useState('');
  const [configResponsable, setConfigResponsable] = useState('');
  const [configSystemPrompt, setConfigSystemPrompt] = useState('');
  const [configSaveMessage, setConfigSaveMessage] = useState('');
  const [dbTestStatus, setDbTestStatus] = useState('idle'); // 'idle' | 'loading' | 'success' | 'error'
  const [dbTestLog, setDbTestLog] = useState([]);
  const [dbTestResult, setDbTestResult] = useState(null);
  // Mi Perfil
  const [perfilAbierto, setPerfilAbierto]   = useState(false);
  const [passActual,    setPassActual]       = useState('');
  const [passNuevo,     setPassNuevo]        = useState('');
  const [passConfirm,   setPassConfirm]      = useState('');
  const [passMsg,       setPassMsg]          = useState(null); // { tipo: 'ok'|'err', texto }
  const [passCargando,  setPassCargando]     = useState(false);

  // Helpers de navegación
  function irAlDashboard() {
    setCurrentPage({ view: null, diagId: null, nivel: null });
  }
  function irAFase(view, diagId, nivel = null) {
    setCurrentPage({ view, diagId, nivel });
  }

  // Carga la jerarquía cuando se abre la página de validación IA
  useEffect(() => {
    if (currentPage.view !== 'validacion') return;
    apiService.fetchHierarchy().then(({ plantas, areas }) => {
      setModalPlantas(plantas || []);
      setModalAllAreas(areas || []);
      setModalAreas(areas || []);
    }).catch(() => {
      setModalPlantas([]);
      setModalAllAreas([]);
      setModalAreas([]);
    });
  }, [currentPage.view]);

  // Filtra áreas según la planta seleccionada
  useEffect(() => {
    if (!plantaId) {
      setModalAreas(modalAllAreas);
    } else {
      setModalAreas(modalAllAreas.filter((a) => String(a.planta_id) === String(plantaId)));
    }
    setAreaId('');
  }, [plantaId, modalAllAreas]);

  // Cierra la página de validación y resetea su estado
  function cerrarModal() {
    irAlDashboard();
    setDiagnosticoText('');
    setGeminiResponse('');
    setDiagnosticoGuardado(false);
    setPlantaId('');
    setAreaId('');
  }

  useEffect(() => {
    if (activeNav !== 'Configuración' || currentPage.view !== null) return;
    apiService
      .fetchConfig()
      .then((data) => {
        setConfigEmpresa(data.empresa ?? '');
        setConfigSector(data.sector ?? '');
        setConfigResponsable(data.responsable ?? '');
        setConfigSystemPrompt(data.system_prompt ?? '');
      })
      .catch(() => {
        setConfigEmpresa('');
        setConfigSector('');
        setConfigResponsable('');
        setConfigSystemPrompt('');
      });
  }, [activeNav]);

  async function handleCambiarPassword() {
    if (!passActual || !passNuevo) {
      setPassMsg({ tipo: 'err', texto: 'Completa todos los campos.' });
      return;
    }
    if (passNuevo !== passConfirm) {
      setPassMsg({ tipo: 'err', texto: 'Las contraseñas nuevas no coinciden.' });
      return;
    }
    if (passNuevo.length < 6) {
      setPassMsg({ tipo: 'err', texto: 'La nueva contraseña debe tener al menos 6 caracteres.' });
      return;
    }
    setPassCargando(true);
    setPassMsg(null);
    try {
      await apiService.changePassword(passActual, passNuevo);
      setPassMsg({ tipo: 'ok', texto: 'Contraseña actualizada correctamente.' });
      setPassActual(''); setPassNuevo(''); setPassConfirm('');
    } catch (err) {
      setPassMsg({ tipo: 'err', texto: err?.message || 'Error al cambiar la contraseña.' });
    } finally {
      setPassCargando(false);
    }
  }

  // Navegar a una fase específica desde cualquier vista del diagnóstico
  function handleNavegar(diagId, faseTarget) {
    const VISTAS = { 1: 'wizard', 2: 'cuestionario', 3: 'documentos', 4: 'recorrido', 5: 'entrevistas', 6: 'validacion' };
    setCurrentPage({ view: VISTAS[faseTarget] ?? null, diagId, nivel: currentPage.nivel });
  }

  function handleContinuarDiagnostico(diag) {
    const paso = diag.paso_actual ?? estadoAPasoApp(diag.estado);
    const nivel = diag.nivel_calculado ?? null;
    if (diag.estado === 'Finalizado' || diag.estado === 'Aprobado') {
      irAFase('cuestionario', diag.id, nivel);
      return;
    }
    if (paso <= 1) {
      irAFase('wizard', null, null);
    } else if (paso === 2) {
      irAFase(diag.estado === 'Carga' ? 'cuestionario' : 'documentos', diag.id, nivel);
    } else if (paso === 3) {
      irAFase('recorrido', diag.id, nivel);
    } else if (paso === 4) {
      irAFase('entrevistas', diag.id, nivel);
    } else {
      irAFase('validacion', diag.id, nivel);
    }
  }

  // Mapa estado → paso (igual que en DiagnosticosDashboard, replicado para App)
  function estadoAPasoApp(estado) {
    const m = { Configuracion:1, Carga:2, Recorrido:3, Entrevistas:4, Validacion:5, Finalizado:6,
                Borrador:2, 'En Validación':5, Aprobado:6 };
    return m[estado] ?? 1;
  }

  // Auth guard — debe estar DESPUÉS de todos los hooks
  if (!isAuthenticated) return <LoginScreen />;

  async function handleGuardarConfig() {
    setConfigSaveMessage('');
    try {
      await apiService.saveConfig({
        empresa: configEmpresa,
        sector: configSector,
        responsable: configResponsable,
        system_prompt: configSystemPrompt,
      });
      setConfigSaveMessage('Guardado en Postgres');
    } catch {
      setConfigSaveMessage('Error al conectar con la API');
    }
  }

  async function handleTestDatabase() {
    setDbTestStatus('loading');
    setDbTestResult(null);
    const log = [];
    const addLog = (msg) => { log.push(msg); setDbTestLog([...log]); };

    addLog('> Iniciando handshake con Neon PostgreSQL...');
    await new Promise((r) => setTimeout(r, 600));
    addLog('> Verificando credenciales y certificado SSL...');
    await new Promise((r) => setTimeout(r, 700));

    try {
      const result = await apiService.testDatabaseConnection();
      if (result.success) {
        addLog(`> Conexión establecida. Latencia: ${result.latency_ms}ms`);
        setDbTestStatus('success');
        setDbTestResult(result.message);
      } else {
        addLog(`> Fallo de conexión: ${result.error}`);
        setDbTestStatus('error');
        setDbTestResult(result.error);
      }
    } catch (err) {
      addLog(`> Error de red: no se pudo alcanzar la API (${err.message ?? err})`);
      setDbTestStatus('error');
      setDbTestResult('No se pudo contactar con el servidor de la API.');
    }
  }

  async function handleAnalizarRiesgos() {
    const userText = diagnosticoText.trim();
    if (!userText) {
      setGeminiResponse('Escribe un escenario o problema de seguridad antes de analizar.');
      return;
    }
    setIsLoading(true);
    setGeminiResponse('');
    setDiagnosticoGuardado(false);
    try {
      // Cargar preguntas filtradas y datos de clasificación para enriquecer el contexto de la IA
      let preguntasFiltradas = [];
      let clasificacion      = null;
      if (currentPage.diagId) {
        try {
          preguntasFiltradas = await apiService.fetchPreguntasParaIA(currentPage.diagId);
        } catch { /* no bloquear si falla */ }
        try {
          const diag = await apiService.fetchDiagnostico(currentPage.diagId);
          if (diag?.data_setup && diag?.nivel_calculado) {
            clasificacion = { dataSetup: diag.data_setup, nivel: diag.nivel_calculado };
          }
        } catch { /* no bloquear si falla */ }
      }
      const text = await aiService.analyzeRisk(userText, configSystemPrompt, preguntasFiltradas, clasificacion);
      setGeminiResponse(text);
      try {
        if (currentPage.diagId) {
          await apiService.updateDiagnostico(currentPage.diagId, {
            escenario: userText,
            resultado_ia: text,
            estado: 'En Validación',
            planta_id: plantaId ? Number(plantaId) : null,
            area_id: areaId ? Number(areaId) : null,
          });
        } else {
          await apiService.createDiagnostico({
            planta_id: plantaId ? Number(plantaId) : null,
            area_id: areaId ? Number(areaId) : null,
            escenario: userText,
            resultado_ia: text,
            estado: 'En Validación',
          });
        }
        setDiagnosticoGuardado(true);
      } catch {
        // No bloqueamos la UI si falla el guardado
      }
    } catch (err) {
      setGeminiResponse(
        err?.message || `Error al conectar con el servicio de IA: ${String(err)}`
      );
    } finally {
      setIsLoading(false);
    }
  }

  const esConsultor    = ['Consultor','SuperAdmin'].includes(usuario?.rol);
  const esAdmin        = ['SuperAdmin','AdminInquilino'].includes(usuario?.rol);

  return (
    <div className="flex min-h-screen bg-gray-100 text-gray-800 antialiased">
      {/* Sidebar */}
      <aside className="w-64 min-h-screen bg-white border-r border-gray-200 flex flex-col shadow-sm">
        <div className="p-5 border-b border-gray-100">
          <div className="flex items-center gap-2.5">
            <img src={skudoLogo} alt="Skudo" className="w-7 h-7 shrink-0" />
            <div>
              <h1 className="text-base font-bold text-gray-800 tracking-tight leading-tight">Skudo PSM</h1>
              <span className="text-xs text-gray-500 font-medium">Expert System</span>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {NAV_ITEMS.map((item) => (
            <SidebarLink
              key={item.id}
              label={item.label}
              isActive={activeNav === item.label && currentPage.view === null}
              onClick={(label) => { setActiveNav(label); irAlDashboard(); }}
              icon={SIDEBAR_ICONS[item.label]}
            />
          ))}
          {esConsultor && (
            <SidebarLink
              label="Bandeja de Validación"
              isActive={activeNav === 'Consultor' && currentPage.view === null}
              onClick={() => { setActiveNav('Consultor'); irAlDashboard(); }}
              icon={Building2}
            />
          )}
        </nav>

        <div className="p-4 border-t border-gray-100 space-y-1">
          {esAdmin && (
            <SidebarLink
              label="Configuración"
              isActive={activeNav === 'Configuración' && currentPage.view === null}
              onClick={(label) => { setActiveNav(label); irAlDashboard(); }}
              icon={Settings}
            />
          )}
          {/* Usuario activo + logout */}
          <div className="flex items-center gap-2 px-3 py-2 mt-2 rounded-lg bg-gray-50 border border-gray-100">
            <button
              type="button"
              onClick={() => { setPerfilAbierto(true); setPassMsg(null); setPassActual(''); setPassNuevo(''); setPassConfirm(''); }}
              className="flex-1 min-w-0 text-left hover:opacity-80 transition-opacity"
              title="Ver mi perfil"
            >
              <p className="text-xs font-semibold text-gray-700 truncate">{usuario?.nombre}</p>
              <p className="text-xs text-gray-400">{ROL_LABELS[usuario?.rol] ?? usuario?.rol}</p>
            </button>
            <button
              type="button"
              onClick={logout}
              title="Cerrar sesión"
              className="p-1.5 rounded-md text-gray-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-auto">

        {/* ══════════════════════════════════════════════════════
            PÁGINAS DE FASES DEL DIAGNÓSTICO (sin popup)
        ══════════════════════════════════════════════════════ */}
        {currentPage.view === 'wizard' && (
          <DiagnosticoWizard
            onCerrar={irAlDashboard}
            onSiguiente={(diagId, nivel) => irAFase('cuestionario', diagId, nivel)}
          />
        )}
        {currentPage.view === 'cuestionario' && (
          <DiagnosticoView
            diagnosticoId={currentPage.diagId}
            faseActual={2}
            onNavegar={(f) => handleNavegar(currentPage.diagId, f)}
            onCerrar={irAlDashboard}
            onIrAIA={(diagId) => irAFase('documentos', diagId, currentPage.nivel)}
          />
        )}
        {currentPage.view === 'documentos' && (
          <EvidenciaView
            diagnosticoId={currentPage.diagId}
            faseActual={3}
            onNavegar={(f) => handleNavegar(currentPage.diagId, f)}
            onCerrar={irAlDashboard}
            onSiguiente={(diagId) => irAFase('recorrido', diagId, currentPage.nivel)}
          />
        )}
        {currentPage.view === 'recorrido' && (
          <RecorridoView
            diagnosticoId={currentPage.diagId}
            faseActual={4}
            onNavegar={(f) => handleNavegar(currentPage.diagId, f)}
            onCerrar={irAlDashboard}
            onSiguiente={(diagId) => irAFase('entrevistas', diagId, currentPage.nivel)}
          />
        )}
        {currentPage.view === 'entrevistas' && (
          <EntrevistasView
            diagnosticoId={currentPage.diagId}
            faseActual={5}
            onNavegar={(f) => handleNavegar(currentPage.diagId, f)}
            onCerrar={irAlDashboard}
            onSiguiente={(diagId) => irAFase('validacion', diagId, currentPage.nivel)}
          />
        )}
        {currentPage.view === 'validacion' && (
          <div className="min-h-screen bg-gray-50 py-8 px-4">
            <div className="max-w-xl mx-auto">
              {/* Navegación entre fases */}
              <div className="mb-6">
                <NavegacionFases faseActual={6} onNavegar={(f) => handleNavegar(currentPage.diagId, f)} />
              </div>
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">Asistente de Diagnóstico PSM</h2>
                    <p className="text-sm text-gray-500 mt-0.5">
                      El análisis quedará en estado <span className="font-semibold text-amber-600">En Validación</span> para revisión del Consultor.
                    </p>
                  </div>
                  <button type="button" onClick={cerrarModal} className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors" title="Volver al Dashboard">✕</button>
                </div>

                {currentPage.nivel && (
                  <div className="mb-4 flex items-center gap-2 px-3 py-2 rounded-lg bg-green-50 border border-green-200">
                    <span className="text-xs font-bold text-green-700">Nivel {currentPage.nivel}</span>
                    <span className="text-xs text-green-600">— Profundidad de diagnóstico calculada por el Motor de Clasificación.</span>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wide">Planta</label>
                    <select value={plantaId} onChange={(e) => setPlantaId(e.target.value)} disabled={isLoading}
                      className="w-full px-3 py-2 rounded-lg border border-gray-200 text-gray-700 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-60">
                      <option value="">— Seleccionar —</option>
                      {modalPlantas.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wide">Área</label>
                    <select value={areaId} onChange={(e) => setAreaId(e.target.value)} disabled={isLoading || !plantaId}
                      className="w-full px-3 py-2 rounded-lg border border-gray-200 text-gray-700 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-60">
                      <option value="">— Seleccionar —</option>
                      {modalAreas.map((a) => <option key={a.id} value={a.id}>{a.nombre}</option>)}
                    </select>
                  </div>
                </div>

                <textarea value={diagnosticoText} onChange={(e) => setDiagnosticoText(e.target.value)} disabled={isLoading}
                  className="w-full min-h-[160px] px-4 py-3 rounded-lg border border-gray-200 text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 resize-y disabled:opacity-60"
                  placeholder="Describa el escenario o problema de seguridad..." />

                {geminiResponse && (
                  <div className="mt-4 p-4 rounded-lg bg-gray-50 border border-gray-100 text-gray-800 text-sm leading-relaxed whitespace-pre-wrap">{geminiResponse}</div>
                )}
                {diagnosticoGuardado && (
                  <div className="mt-3 flex items-center gap-2 text-sm text-green-700 font-medium">
                    <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/></svg>
                    Diagnóstico guardado — pendiente de validación en la Bandeja del Consultor.
                  </div>
                )}

                <div className="flex flex-col-reverse sm:flex-row gap-3 mt-5">
                  <button type="button" onClick={cerrarModal} disabled={isLoading}
                    className="px-4 py-2.5 rounded-lg font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors disabled:opacity-60">
                    Volver al Dashboard
                  </button>
                  <button type="button" onClick={handleAnalizarRiesgos} disabled={isLoading}
                    className="flex-1 px-4 py-2.5 rounded-lg font-semibold text-white bg-green-600 hover:bg-green-700 transition-colors shadow-sm disabled:opacity-70">
                    {isLoading ? 'Analizando...' : 'Analizar Riesgos con IA'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════
            NAVEGACIÓN NORMAL (sidebar)  — visible solo cuando no hay fase activa
        ══════════════════════════════════════════════════════ */}
        {currentPage.view === null && (activeNav === 'Consultor' ? (
          <ConsultorDashboard />
        ) : activeNav === 'Configuración' ? (
          <div className="p-8 lg:p-10">
            {/* Encabezado */}
            <header className="mb-8">
              <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-1">
                Consola de Administración
              </h2>
              <p className="text-gray-500 text-base">
                Gestión de variables críticas, lógica de IA y parámetros normativos.
              </p>
            </header>

            {/* Contenedor principal */}
            <div className="max-w-4xl">
              {/* Tab Bar — filtrado por rol */}
              <div className="flex flex-wrap gap-1 bg-gray-100 p-1 rounded-xl mb-6 border border-gray-200 w-fit">
                {ADMIN_TABS
                  .filter((tab) => !tab.roles || tab.roles.includes(usuario?.rol))
                  .map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setActiveAdminTab(tab.id)}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                        activeAdminTab === tab.id
                          ? 'bg-white text-gray-900 shadow-sm border border-gray-200'
                          : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
              </div>

              {/* Panel de contenido */}
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">

                {/* ── Infraestructura ── */}
                {activeAdminTab === 'infraestructura' && (
                  <div className="space-y-8">

                    {/* Datos de la Empresa */}
                    <div>
                      <h3 className="text-base font-semibold text-gray-800 mb-4">Datos de la Empresa</h3>
                      <div className="space-y-4">
                        <div>
                          <label htmlFor="config-empresa" className="block text-sm font-medium text-gray-700 mb-1">Empresa</label>
                          <input
                            id="config-empresa"
                            type="text"
                            value={configEmpresa}
                            onChange={(e) => setConfigEmpresa(e.target.value)}
                            className="w-full px-4 py-2 rounded-lg border border-gray-200 text-gray-800 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                            placeholder="Nombre de la empresa"
                          />
                        </div>
                        <div>
                          <label htmlFor="config-sector" className="block text-sm font-medium text-gray-700 mb-1">Sector</label>
                          <input
                            id="config-sector"
                            type="text"
                            value={configSector}
                            onChange={(e) => setConfigSector(e.target.value)}
                            className="w-full px-4 py-2 rounded-lg border border-gray-200 text-gray-800 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                            placeholder="Sector industrial"
                          />
                        </div>
                        <div>
                          <label htmlFor="config-responsable" className="block text-sm font-medium text-gray-700 mb-1">Responsable</label>
                          <input
                            id="config-responsable"
                            type="text"
                            value={configResponsable}
                            onChange={(e) => setConfigResponsable(e.target.value)}
                            className="w-full px-4 py-2 rounded-lg border border-gray-200 text-gray-800 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                            placeholder="Nombre del responsable"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Card de conexión a BD */}
                    <div className="border-t border-gray-100 pt-6">
                      <h3 className="text-base font-semibold text-gray-800 mb-1">Estado de la Infraestructura</h3>
                      <p className="text-sm text-gray-400 mb-5">
                        Conexión principal para persistencia de datos y estados del sistema.
                      </p>

                      <div className="rounded-xl border border-gray-200 bg-gray-50 p-5">
                        {/* Detalles de conexión */}
                        <div className="grid grid-cols-2 gap-x-6 gap-y-3 mb-5 text-sm">
                          <div>
                            <span className="text-gray-400 text-xs uppercase tracking-wide">Proveedor</span>
                            <p className="font-medium text-gray-800 mt-0.5">Neon Serverless Postgres</p>
                          </div>
                          <div>
                            <span className="text-gray-400 text-xs uppercase tracking-wide">Región</span>
                            <p className="font-medium text-gray-800 mt-0.5">US-West-2 (AWS)</p>
                          </div>
                          <div>
                            <span className="text-gray-400 text-xs uppercase tracking-wide">Host</span>
                            <p className="font-mono text-gray-700 mt-0.5 text-xs">ep-purple-hill-***.neon.tech</p>
                          </div>
                          <div>
                            <span className="text-gray-400 text-xs uppercase tracking-wide">SSL</span>
                            <p className="font-medium text-gray-800 mt-0.5">Requerido · rejectUnauthorized: false</p>
                          </div>
                          <div className="col-span-2">
                            <span className="text-gray-400 text-xs uppercase tracking-wide">Variable de entorno</span>
                            <p className="mt-0.5">
                              <code className="bg-gray-200 text-gray-700 px-2 py-0.5 rounded text-xs font-mono">DATABASE_URL</code>
                              <span className="text-gray-400 text-xs ml-2">·· **** oculta por seguridad</span>
                            </p>
                          </div>
                        </div>

                        {/* Botón de test */}
                        <button
                          type="button"
                          onClick={handleTestDatabase}
                          disabled={dbTestStatus === 'loading'}
                          className="w-full py-2.5 rounded-lg font-semibold text-white bg-gray-800 hover:bg-gray-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed text-sm"
                        >
                          {dbTestStatus === 'loading' ? 'Conectando...' : 'Probar Conexión'}
                        </button>

                        {/* Consola de log */}
                        {dbTestLog.length > 0 && (
                          <div className="mt-4 rounded-lg bg-gray-900 p-4 font-mono text-xs leading-relaxed space-y-1">
                            {dbTestLog.map((line, i) => (
                              <p key={i} className="text-gray-300">{line}</p>
                            ))}
                          </div>
                        )}

                        {/* Resultado final */}
                        {dbTestStatus === 'success' && (
                          <div className="mt-4 flex items-start gap-3 p-4 rounded-lg bg-emerald-50 border border-emerald-200">
                            <span className="text-emerald-500 mt-0.5 shrink-0">✔</span>
                            <p className="text-sm text-emerald-800 font-medium">{dbTestResult}</p>
                          </div>
                        )}
                        {dbTestStatus === 'error' && (
                          <div className="mt-4 flex items-start gap-3 p-4 rounded-lg bg-rose-50 border border-rose-200">
                            <span className="text-rose-500 mt-0.5 shrink-0">✖</span>
                            <p className="text-sm text-rose-800 font-medium">{dbTestResult}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* ── Lógica IA ── */}
                {activeAdminTab === 'logica-ia' && (
                  <div className="space-y-4">
                    <div>
                      <h3 className="text-base font-semibold text-gray-800 mb-1">
                        Cerebro del Consultor{' '}
                        <span className="text-gray-400 font-normal text-sm">(System Prompt)</span>
                      </h3>
                      <p className="text-sm text-gray-400 mb-3">
                        Define cómo debe comportarse el asistente de IA al analizar los escenarios de seguridad.
                        Este texto se antepone a cada análisis de riesgos.
                      </p>
                      <textarea
                        id="config-system-prompt"
                        value={configSystemPrompt}
                        onChange={(e) => setConfigSystemPrompt(e.target.value)}
                        rows={12}
                        className="w-full px-4 py-3 rounded-lg border border-gray-200 text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent resize-y font-mono text-sm leading-relaxed"
                        placeholder="Actúa como un experto en Seguridad de Procesos (PSM). Analiza este escenario y dame 3 recomendaciones breves:"
                      />
                    </div>
                    <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-100 rounded-lg">
                      <span className="text-amber-500 text-sm">⚠</span>
                      <p className="text-xs text-amber-700">
                        Modificar este prompt cambia el comportamiento global del asistente para todos los diagnósticos.
                      </p>
                    </div>
                  </div>
                )}

                {/* ── Matriz de Preguntas ── */}
                {activeAdminTab === 'matriz-preguntas' && <MatrizPreguntas />}

                {/* ── Sedes (Plantas y Áreas) ── */}
                {activeAdminTab === 'sedes' && <PlantasAdmin />}

                {/* ── Criterios de Puntuación ── */}
                {activeAdminTab === 'criterios' && (
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <div className="w-14 h-14 rounded-xl bg-green-50 flex items-center justify-center mb-4">
                      <span className="text-2xl">📊</span>
                    </div>
                    <h3 className="text-base font-semibold text-gray-700 mb-1">Próximamente</h3>
                    <p className="text-sm text-gray-400 max-w-sm">
                      Configura los rangos de Efectividad:{' '}
                      <span className="text-green-600 font-medium">Suficiente</span>,{' '}
                      <span className="text-amber-500 font-medium">Escasa</span>,{' '}
                      <span className="text-red-500 font-medium">Deficiente</span>{' '}
                      y sus umbrales porcentuales.
                    </p>
                  </div>
                )}

                {/* ── Empresas (Tenants) ── */}
                {activeAdminTab === 'empresas' && (
                  <EmpresasAdmin />
                )}

                {/* ── Usuarios ── */}
                {activeAdminTab === 'usuarios' && (
                  <UsuariosAdmin />
                )}
              </div>

              {/* Barra de guardado global (siempre visible) */}
              <div className="flex items-center justify-between mt-6 px-1">
                {configSaveMessage ? (
                  <p className="text-sm font-medium text-green-600">{configSaveMessage}</p>
                ) : (
                  <span />
                )}
                <button
                  type="button"
                  onClick={handleGuardarConfig}
                  className="px-5 py-2.5 rounded-lg font-semibold text-white bg-green-600 hover:bg-green-700 transition-colors shadow-sm"
                >
                  Guardar cambios
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-8 lg:p-10">
            <header className="mb-10">
              <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-2">
                Bienvenido, {usuario?.nombre?.split(' ')[0] ?? 'Usuario'}
              </h2>
              <p className="text-gray-600 text-lg max-w-2xl">
                Gestione el diagnóstico de seguridad de procesos con rigor técnico y cumplimiento
                normativo bajo la metodología CCPS.
              </p>
            </header>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {CARDS.map((card) => (
                <Card
                  key={card.title}
                  title={card.title}
                  description={card.description}
                  icon={card.icon}
                  iconBg={card.iconBg}
                  iconColor={card.iconColor}
                  onClick={card.title === 'Diagnóstico Fase I' ? () => irAFase('wizard', null, null) : undefined}
                />
              ))}
            </div>

            {/* ── Dashboard de diagnósticos en curso e histórico ─────── */}
            <DiagnosticosDashboard onContinuar={handleContinuarDiagnostico} />
          </div>
        ))}
      </main>

      {/* ── Modal Mi Perfil ─────────────────────────────────────────────────── */}
      {perfilAbierto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setPerfilAbierto(false)} aria-hidden="true" />
          <div className="relative w-full max-w-sm bg-white rounded-2xl shadow-xl border border-gray-100 p-6">
            {/* Avatar */}
            <div className="flex items-center gap-3 mb-5">
              <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center text-green-700 text-xl font-bold flex-shrink-0">
                {usuario?.nombre?.[0]?.toUpperCase() ?? '?'}
              </div>
              <div>
                <p className="font-bold text-gray-900">{usuario?.nombre}</p>
                <p className="text-xs text-gray-400">{usuario?.email}</p>
                <span className="mt-0.5 inline-block px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700">
                  {ROL_LABELS[usuario?.rol] ?? usuario?.rol}
                </span>
              </div>
            </div>

            <hr className="border-gray-100 mb-4" />

            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">Cambiar contraseña</p>
            <div className="space-y-2">
              <input
                type="password"
                value={passActual}
                onChange={(e) => setPassActual(e.target.value)}
                placeholder="Contraseña actual"
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-green-500"
              />
              <input
                type="password"
                value={passNuevo}
                onChange={(e) => setPassNuevo(e.target.value)}
                placeholder="Nueva contraseña (mín. 6 caracteres)"
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-green-500"
              />
              <input
                type="password"
                value={passConfirm}
                onChange={(e) => setPassConfirm(e.target.value)}
                placeholder="Confirmar nueva contraseña"
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>

            {passMsg && (
              <p className={`mt-2 text-xs font-medium ${passMsg.tipo === 'ok' ? 'text-green-600' : 'text-rose-600'}`}>
                {passMsg.texto}
              </p>
            )}

            <div className="flex gap-2 mt-4">
              <button
                type="button"
                onClick={() => setPerfilAbierto(false)}
                className="flex-1 px-4 py-2 rounded-lg text-sm font-medium bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors"
              >
                Cerrar
              </button>
              <button
                type="button"
                onClick={handleCambiarPassword}
                disabled={passCargando}
                className="flex-1 px-4 py-2 rounded-lg text-sm font-semibold text-white bg-green-600 hover:bg-green-700 transition-colors disabled:opacity-60"
              >
                {passCargando ? 'Guardando...' : 'Actualizar'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
