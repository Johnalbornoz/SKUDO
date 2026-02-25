import { useState, useEffect } from 'react';
import apiService from '../services/apiService';
import { useAuth } from '../contexts/AuthContext';

const PLANTA_VACIA  = { nombre: '', ubicacion: '', responsable: '', tenant_id: '' };
const AREA_VACIA    = { nombre: '', descripcion: '', planta_id: '' };

function ModalForm({ titulo, campos, valores, onChange, onGuardar, onCerrar, guardando, errMsg }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onCerrar} />
      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-xl">
        <div className="px-6 py-4 border-b border-gray-100">
          <h3 className="text-base font-bold text-gray-900">{titulo}</h3>
        </div>
        <div className="px-6 py-5 space-y-3">
          {campos.map(({ key, label, placeholder, type = 'text', options }) => (
            <div key={key}>
              <label className="block text-xs font-medium text-gray-700 mb-1">{label}</label>
              {type === 'select' ? (
                <select
                  value={valores[key] ?? ''}
                  onChange={(e) => onChange({ ...valores, [key]: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-green-500 bg-white"
                >
                  <option value="">— Seleccionar empresa —</option>
                  {(options ?? []).map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              ) : (
                <input
                  type={type}
                  value={valores[key] ?? ''}
                  onChange={(e) => onChange({ ...valores, [key]: e.target.value })}
                  placeholder={placeholder}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              )}
            </div>
          ))}
          {errMsg && <p className="text-xs text-rose-600">{errMsg}</p>}
        </div>
        <div className="px-6 pb-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCerrar}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onGuardar}
            disabled={guardando}
            className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-green-600 hover:bg-green-700 transition-colors disabled:opacity-60"
          >
            {guardando ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function PlantasAdmin() {
  const { usuario } = useAuth();

  const [plantas,   setPlantas]   = useState([]);
  const [areas,     setAreas]     = useState({});    // { planta_id: [area,...] }
  const [tenants,   setTenants]   = useState([]);
  const [expandida, setExpandida] = useState(null);  // planta_id expandida

  const [modalPlanta, setModalPlanta]   = useState(null); // null | objeto planta
  const [modalArea,   setModalArea]     = useState(null); // null | objeto area
  const [esNuevoP,    setEsNuevoP]      = useState(false);
  const [esNuevoA,    setEsNuevoA]      = useState(false);
  const [guardando,   setGuardando]     = useState(false);
  const [errMsg,      setErrMsg]        = useState('');
  const [confirmId,   setConfirmId]     = useState(null); // { tipo, id }

  const esSuperAdmin = usuario?.rol === 'SuperAdmin';

  useEffect(() => {
    cargarPlantas();
    if (esSuperAdmin) cargarTenants();
  }, []);

  async function cargarPlantas() {
    try { setPlantas(await apiService.fetchPlantas()); }
    catch { /* silencioso */ }
  }

  async function cargarAreas(planta_id) {
    try {
      const data = await apiService.fetchAreas(planta_id);
      setAreas((prev) => ({ ...prev, [planta_id]: data }));
    } catch { /* silencioso */ }
  }

  async function cargarTenants() {
    try { setTenants(await apiService.fetchTenants()); }
    catch { /* silencioso */ }
  }

  function toggleExpandir(planta_id) {
    if (expandida === planta_id) {
      setExpandida(null);
    } else {
      setExpandida(planta_id);
      if (!areas[planta_id]) cargarAreas(planta_id);
    }
  }

  // ── Guardar planta ────────────────────────────────────────────────────────
  async function guardarPlanta() {
    setGuardando(true); setErrMsg('');
    try {
      const payload = { ...modalPlanta };
      if (!esSuperAdmin) payload.tenant_id = usuario.tenant_id;
      if (esNuevoP) await apiService.createPlanta(payload);
      else          await apiService.updatePlanta(modalPlanta.id, payload);
      await cargarPlantas();
      setModalPlanta(null);
    } catch (err) {
      setErrMsg(err.message);
    } finally { setGuardando(false); }
  }

  // ── Guardar área ───────────────────────────────────────────────────────────
  async function guardarArea() {
    setGuardando(true); setErrMsg('');
    try {
      if (esNuevoA) await apiService.createArea(modalArea);
      else          await apiService.updateArea(modalArea.id, modalArea);
      if (modalArea.planta_id) await cargarAreas(modalArea.planta_id);
      setModalArea(null);
    } catch (err) {
      setErrMsg(err.message);
    } finally { setGuardando(false); }
  }

  // ── Eliminar ───────────────────────────────────────────────────────────────
  async function eliminar() {
    if (!confirmId) return;
    try {
      if (confirmId.tipo === 'planta') {
        await apiService.deletePlanta(confirmId.id);
        setPlantas((prev) => prev.filter((p) => p.id !== confirmId.id));
      } else {
        await apiService.deleteArea(confirmId.id);
        const pid = confirmId.planta_id;
        setAreas((prev) => ({
          ...prev,
          [pid]: (prev[pid] || []).filter((a) => a.id !== confirmId.id),
        }));
      }
      setConfirmId(null);
    } catch (err) { alert(err.message); }
  }

  const camposPlanta = [
    { key: 'nombre',      label: 'Nombre de la planta', placeholder: 'Planta Norte' },
    { key: 'ubicacion',   label: 'Ubicación',            placeholder: 'Ciudad, Departamento' },
    { key: 'responsable', label: 'Responsable PSM',      placeholder: 'Nombre del responsable' },
    ...(esSuperAdmin ? [{
      key: 'tenant_id',
      label: 'Empresa (Tenant)',
      type: 'select',
      options: tenants.map((t) => ({ value: String(t.id), label: `${t.nombre}${t.nit ? ` · ${t.nit}` : ''}` })),
    }] : []),
  ];

  const camposArea = [
    { key: 'nombre',      label: 'Nombre del área',  placeholder: 'Área de Compresores' },
    { key: 'descripcion', label: 'Descripción',       placeholder: 'Descripción del proceso' },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="text-base font-semibold text-gray-800">Plantas y Áreas</h3>
          <p className="text-xs text-gray-400 mt-0.5">
            Gestión jerárquica de sedes e instalaciones de proceso.
          </p>
        </div>
        <button
          type="button"
          onClick={() => { setModalPlanta({ ...PLANTA_VACIA }); setEsNuevoP(true); setErrMsg(''); }}
          className="px-4 py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white text-sm font-semibold transition-colors"
        >
          + Nueva Planta
        </button>
      </div>

      {plantas.length === 0 ? (
        <div className="text-center py-12 text-gray-400 text-sm">
          No hay plantas registradas. Crea la primera.
        </div>
      ) : (
        <div className="space-y-2">
          {plantas.map((planta) => (
            <div key={planta.id} className="border border-gray-200 rounded-xl overflow-hidden">
              {/* Fila planta */}
              <div className="flex items-center gap-3 px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors">
                <button
                  type="button"
                  onClick={() => toggleExpandir(planta.id)}
                  className="text-gray-400 hover:text-gray-700 shrink-0 transition-colors"
                  aria-label="Expandir áreas"
                >
                  <span className="text-xs font-mono">{expandida === planta.id ? '▼' : '▶'}</span>
                </button>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-800 truncate">{planta.nombre}</p>
                  <p className="text-xs text-gray-400 truncate">
                    {planta.ubicacion || 'Sin ubicación'} · {planta.responsable || 'Sin responsable'}
                    {esSuperAdmin && planta.tenant_nombre && (
                      <span className="ml-2 text-blue-500">({planta.tenant_nombre})</span>
                    )}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      setModalPlanta({ ...planta });
                      setEsNuevoP(false); setErrMsg('');
                    }}
                    className="px-2.5 py-1 rounded-md bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-medium transition-colors"
                  >
                    Editar
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmId({ tipo: 'planta', id: planta.id })}
                    className="px-2.5 py-1 rounded-md bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-medium transition-colors"
                  >
                    Eliminar
                  </button>
                </div>
              </div>

              {/* Áreas expandidas */}
              {expandida === planta.id && (
                <div className="px-4 pb-3 pt-2 space-y-2 bg-white border-t border-gray-100">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Áreas</span>
                    <button
                      type="button"
                      onClick={() => {
                        setModalArea({ ...AREA_VACIA, planta_id: planta.id });
                        setEsNuevoA(true); setErrMsg('');
                      }}
                      className="text-xs text-green-700 hover:text-green-900 font-semibold"
                    >
                      + Añadir área
                    </button>
                  </div>
                  {(areas[planta.id] || []).length === 0 ? (
                    <p className="text-xs text-gray-400 py-2">Sin áreas registradas.</p>
                  ) : (
                    (areas[planta.id] || []).map((area) => (
                      <div key={area.id} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-gray-50 border border-gray-100">
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-gray-700 truncate">{area.nombre}</p>
                          {area.descripcion && (
                            <p className="text-xs text-gray-400 truncate">{area.descripcion}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => {
                              setModalArea({ ...area }); setEsNuevoA(false); setErrMsg('');
                            }}
                            className="px-2 py-0.5 rounded bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-medium"
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmId({ tipo: 'area', id: area.id, planta_id: planta.id })}
                            className="px-2 py-0.5 rounded bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-medium"
                          >
                            Borrar
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Modal planta */}
      {modalPlanta && (
        <ModalForm
          titulo={esNuevoP ? 'Nueva Planta' : 'Editar Planta'}
          campos={camposPlanta}
          valores={modalPlanta}
          onChange={setModalPlanta}
          onGuardar={guardarPlanta}
          onCerrar={() => setModalPlanta(null)}
          guardando={guardando}
          errMsg={errMsg}
        />
      )}

      {/* Modal área */}
      {modalArea && (
        <ModalForm
          titulo={esNuevoA ? 'Nueva Área' : 'Editar Área'}
          campos={camposArea}
          valores={modalArea}
          onChange={setModalArea}
          onGuardar={guardarArea}
          onCerrar={() => setModalArea(null)}
          guardando={guardando}
          errMsg={errMsg}
        />
      )}

      {/* Confirmación eliminar */}
      {confirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setConfirmId(null)} />
          <div className="relative w-full max-w-sm bg-white rounded-2xl shadow-xl p-6">
            <h3 className="text-base font-bold text-gray-900 mb-2">Confirmar eliminación</h3>
            <p className="text-sm text-gray-600 mb-5">
              {confirmId.tipo === 'planta'
                ? 'Se eliminarán la planta y todas sus áreas. '
                : 'Se eliminará el área. '}
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
