import { useState, useEffect } from 'react';
import apiService from '../services/apiService';
import { useAuth } from '../contexts/AuthContext';

// ─── Constantes ───────────────────────────────────────────────────────────────

// Roles oficiales Skudo: valor técnico -> etiqueta visual (dropdown y tabla)
const ROLES_SISTEMA = [
  { value: 'admin_cliente',    label: 'Administrador Cliente' },
  { value: 'operativo_n1',     label: 'Responsable Operativo (Nivel 1)' },
  { value: 'verificador_n2',   label: 'Verificador / Aprobador (Nivel 2)' },
  { value: 'consultor_skudo',  label: 'Consultor Skudo' },
  { value: 'ejecutivo_lectura', label: 'Vista Ejecutiva (Solo Lectura)' },
];

const ROL_BADGE = {
  admin_cliente:     'bg-purple-100 text-purple-700',
  operativo_n1:      'bg-blue-100 text-blue-700',
  verificador_n2:    'bg-green-100 text-green-700',
  consultor_skudo:   'bg-amber-100 text-amber-700',
  ejecutivo_lectura: 'bg-gray-100 text-gray-600',
};

/** Formatea el valor técnico del rol al texto amigable para mostrar en tabla/badge. */
function getRolLabel(rol) {
  if (!rol) return '—';
  const opt = ROLES_SISTEMA.find((r) => r.value === rol);
  return opt ? opt.label : rol;
}

const USUARIO_VACIO = {
  nombre: '', email: '', password: '', rol: 'ejecutivo_lectura', tenant_id: '', activo: true,
};

// ─── Componente ───────────────────────────────────────────────────────────────

export default function UsuariosAdmin() {
  const { usuario: yo } = useAuth();
  const esSuperAdmin = yo?.rol === 'SuperAdmin';
  const rolesDisponibles = ROLES_SISTEMA;

  const [usuarios,   setUsuarios]   = useState([]);
  const [tenants,    setTenants]    = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [modal,      setModal]      = useState(false);
  const [editando,   setEditando]   = useState(null);
  const [form,       setForm]       = useState({ ...USUARIO_VACIO });
  const [error,      setError]      = useState('');
  const [guardando,  setGuardando]  = useState(false);
  const [confirmId,  setConfirmId]  = useState(null);

  useEffect(() => {
    cargar();
    if (esSuperAdmin) cargarTenants();
  }, []);

  async function cargar() {
    setLoading(true);
    try { setUsuarios(await apiService.fetchUsuarios()); }
    catch { setUsuarios([]); }
    finally { setLoading(false); }
  }

  async function cargarTenants() {
    try { setTenants(await apiService.fetchTenants()); }
    catch { setTenants([]); }
  }

  function tenantNombre(tid) {
    if (!tid) return '—';
    const t = tenants.find((x) => x.id === tid || String(x.id) === String(tid));
    return t ? t.nombre : `#${tid}`;
  }

  // ── Abrir modal ─────────────────────────────────────────────────────────────

  function abrirNuevo() {
    setEditando(null);
    setForm({ ...USUARIO_VACIO });
    setError('');
    setModal(true);
  }

  function abrirEditar(u) {
    setEditando(u);
    setForm({
      nombre:    u.nombre,
      email:     u.email,
      password:  '',
      rol:       u.rol,
      tenant_id: u.tenant_id ? String(u.tenant_id) : '',
      activo:    u.activo !== false,
    });
    setError('');
    setModal(true);
  }

  // ── Guardar ─────────────────────────────────────────────────────────────────

  async function guardar() {
    if (!form.nombre.trim() || !form.email.trim()) {
      setError('Nombre y email son obligatorios.');
      return;
    }
    if (!form.rol || !ROLES_SISTEMA.some((r) => r.value === form.rol)) {
      setError('Debe seleccionar un rol válido.');
      return;
    }
    if (!editando && !form.password.trim()) {
      setError('La contraseña es obligatoria para nuevos usuarios.');
      return;
    }
    setGuardando(true);
    setError('');
    try {
      const payload = {
        nombre:    form.nombre.trim(),
        email:     form.email.trim(),
        rol:       form.rol,
        activo:    form.activo,
        ...(form.password ? { password: form.password } : {}),
        ...(esSuperAdmin ? { tenant_id: form.tenant_id || null } : {}),
      };
      if (editando) {
        await apiService.updateUsuario(editando.id, payload);
      } else {
        await apiService.createUsuario(payload);
      }
      await cargar();
      setModal(false);
    } catch (err) {
      setError(err?.message || 'Error al guardar');
    } finally {
      setGuardando(false);
    }
  }

  // ── Toggle activo ───────────────────────────────────────────────────────────

  async function toggleActivo(u) {
    if (u.id === yo?.id) return; // no auto-desactivar
    try {
      await apiService.updateUsuario(u.id, {
        nombre: u.nombre, rol: u.rol, activo: !u.activo,
      });
      setUsuarios((prev) => prev.map((x) => x.id === u.id ? { ...x, activo: !u.activo } : x));
    } catch (err) { alert(err?.message || 'Error'); }
  }

  // ── Eliminar ────────────────────────────────────────────────────────────────

  async function eliminar() {
    if (!confirmId) return;
    try {
      await apiService.deleteUsuario(confirmId);
      setUsuarios((prev) => prev.filter((u) => u.id !== confirmId));
      setConfirmId(null);
    } catch (err) { alert(err?.message || 'Error al eliminar'); }
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div>
      {/* Cabecera */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="text-base font-semibold text-gray-800">Gestión de Usuarios</h3>
          <p className="text-sm text-gray-500 mt-0.5">
            Administra perfiles, roles y accesos al sistema.
          </p>
        </div>
        <button
          onClick={abrirNuevo}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white text-sm font-semibold transition-colors shadow-sm"
        >
          <span className="text-base leading-none">+</span> Nuevo Usuario
        </button>
      </div>

      {/* Tabla */}
      {loading ? (
        <p className="text-sm text-gray-400 py-10 text-center">Cargando...</p>
      ) : usuarios.length === 0 ? (
        <div className="text-center py-16 text-gray-400 text-sm">
          No hay usuarios registrados.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-100">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide">
              <tr>
                <th className="px-4 py-3 text-left">Nombre</th>
                <th className="px-4 py-3 text-left">Email</th>
                <th className="px-4 py-3 text-left">Rol</th>
                {esSuperAdmin && <th className="px-4 py-3 text-left">Empresa</th>}
                <th className="px-4 py-3 text-center">Estado</th>
                <th className="px-4 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {usuarios.map((u) => {
                const soyYo = u.id === yo?.id;
                return (
                  <tr key={u.id} className="hover:bg-gray-50/60 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-green-100 flex items-center justify-center text-green-700 text-xs font-bold flex-shrink-0">
                          {u.nombre?.[0]?.toUpperCase() ?? '?'}
                        </div>
                        <span className="font-medium text-gray-800">
                          {u.nombre}
                          {soyYo && <span className="ml-1.5 text-xs text-gray-400">(tú)</span>}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-500">{u.email}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${ROL_BADGE[u.rol] ?? 'bg-gray-100 text-gray-600'}`}>
                        {getRolLabel(u.rol)}
                      </span>
                    </td>
                    {esSuperAdmin && (
                      <td className="px-4 py-3 text-gray-500 text-xs">{tenantNombre(u.tenant_id)}</td>
                    )}
                    <td className="px-4 py-3 text-center">
                      <button
                        type="button"
                        onClick={() => toggleActivo(u)}
                        disabled={soyYo}
                        title={soyYo ? 'No puedes desactivarte' : (u.activo ? 'Desactivar' : 'Activar')}
                        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${u.activo ? 'bg-green-500' : 'bg-gray-300'} ${soyYo ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                      >
                        <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${u.activo ? 'translate-x-4' : 'translate-x-0.5'}`} />
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => abrirEditar(u)}
                          className="px-2.5 py-1 rounded-md bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-medium transition-colors"
                        >
                          Editar
                        </button>
                        {!soyYo && (
                          <button
                            type="button"
                            onClick={() => setConfirmId(u.id)}
                            className="px-2.5 py-1 rounded-md bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-medium transition-colors"
                          >
                            Eliminar
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Modal Crear / Editar ────────────────────────────────────────────── */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setModal(false)} aria-hidden="true" />
          <div className="relative w-full max-w-md bg-white rounded-2xl shadow-xl border border-gray-100">
            <div className="px-6 py-4 border-b border-gray-100">
              <h3 className="text-base font-bold text-gray-900">
                {editando ? 'Editar usuario' : 'Nuevo usuario'}
              </h3>
            </div>
            <div className="px-6 py-5 space-y-3">
              {/* Nombre */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wide">Nombre completo *</label>
                <input
                  value={form.nombre}
                  onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                  placeholder="Nombre Apellido"
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
              {/* Email */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wide">Email *</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="usuario@empresa.com"
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
              {/* Password */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wide">
                  Contraseña {editando ? '(dejar vacío para no cambiar)' : '*'}
                </label>
                <input
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  placeholder={editando ? '••••••••' : 'Mínimo 6 caracteres'}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
              {/* Rol */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wide">Rol del usuario *</label>
                <select
                  value={form.rol}
                  onChange={(e) => setForm({ ...form, rol: e.target.value })}
                  required
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-green-500 bg-white"
                >
                  <option value="">— Seleccione un rol —</option>
                  {form.rol && !ROLES_SISTEMA.some((r) => r.value === form.rol) && (
                    <option value={form.rol}>{form.rol} (actual — migrar a uno de abajo)</option>
                  )}
                  {rolesDisponibles.map((r) => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>
              </div>
              {/* Empresa (solo SuperAdmin) */}
              {esSuperAdmin && (
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wide">Empresa</label>
                  <select
                    value={form.tenant_id}
                    onChange={(e) => setForm({ ...form, tenant_id: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-green-500 bg-white"
                  >
                    <option value="">— Sin empresa (Consultor externo) —</option>
                    {tenants.map((t) => (
                      <option key={t.id} value={String(t.id)}>
                        {t.nombre}{t.nit ? ` · ${t.nit}` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              {/* Activo (solo en edición) */}
              {editando && editando.id !== yo?.id && (
                <div className="flex items-center gap-3 pt-1">
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Estado</label>
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, activo: !form.activo })}
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${form.activo ? 'bg-green-500' : 'bg-gray-300'}`}
                  >
                    <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${form.activo ? 'translate-x-4' : 'translate-x-0.5'}`} />
                  </button>
                  <span className="text-xs text-gray-500">{form.activo ? 'Activo' : 'Inactivo'}</span>
                </div>
              )}
              {error && <p className="text-xs text-rose-600 font-medium">{error}</p>}
            </div>
            <div className="px-6 pb-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setModal(false)}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={guardar}
                disabled={guardando}
                className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-green-600 hover:bg-green-700 transition-colors disabled:opacity-60"
              >
                {guardando ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Confirmar eliminación ───────────────────────────────────────────── */}
      {confirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setConfirmId(null)} aria-hidden="true" />
          <div className="relative w-full max-w-sm bg-white rounded-2xl shadow-xl p-6">
            <h3 className="text-base font-bold text-gray-900 mb-2">Confirmar eliminación</h3>
            <p className="text-sm text-gray-600 mb-5">
              Se eliminará este usuario de forma permanente.{' '}
              <span className="font-semibold text-rose-600">Esta acción es irreversible.</span>
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmId(null)}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-gray-100 hover:bg-gray-200 text-gray-700"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={eliminar}
                className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-rose-600 hover:bg-rose-700"
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
