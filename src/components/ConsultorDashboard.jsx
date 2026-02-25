import { useState, useEffect } from 'react';
import apiService from '../services/apiService';
import { useAuth } from '../contexts/AuthContext';

const ESTADO_CONFIG = {
  'Borrador':       { color: 'bg-gray-100 text-gray-600',    dot: 'bg-gray-400' },
  'En Validación':  { color: 'bg-amber-100 text-amber-700',  dot: 'bg-amber-500' },
  'Aprobado':       { color: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-500' },
};

function EstadoBadge({ estado }) {
  const cfg = ESTADO_CONFIG[estado] || ESTADO_CONFIG['Borrador'];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${cfg.color}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {estado}
    </span>
  );
}

export default function ConsultorDashboard() {
  const { usuario } = useAuth();

  const [diagnosticos,    setDiagnosticos]    = useState([]);
  const [cargando,        setCargando]        = useState(false);
  const [filtroEstado,    setFiltroEstado]    = useState('En Validación');
  const [abierto,         setAbierto]         = useState(null);  // diagnóstico seleccionado
  const [hallazgos,       setHallazgos]       = useState('');
  const [validando,       setValidando]       = useState(false);
  const [msgValidacion,   setMsgValidacion]   = useState('');

  useEffect(() => { cargar(); }, [filtroEstado]);

  async function cargar() {
    setCargando(true);
    try {
      const data = await apiService.fetchDiagnosticos(filtroEstado || undefined);
      setDiagnosticos(data);
    } catch { /* silencioso */ }
    finally { setCargando(false); }
  }

  function abrirDiagnostico(d) {
    setAbierto(d);
    setHallazgos(d.hallazgos_validados || d.resultado_ia || '');
    setMsgValidacion('');
  }

  async function validar() {
    if (!abierto) return;
    setValidando(true); setMsgValidacion('');
    try {
      await apiService.validarDiagnostico(abierto.id, hallazgos);
      setMsgValidacion('✔ Diagnóstico aprobado exitosamente.');
      setAbierto((prev) => ({ ...prev, estado: 'Aprobado', hallazgos_validados: hallazgos }));
      setDiagnosticos((prev) =>
        prev.map((d) =>
          d.id === abierto.id
            ? { ...d, estado: 'Aprobado', hallazgos_validados: hallazgos }
            : d
        )
      );
    } catch (err) {
      setMsgValidacion(`Error: ${err.message}`);
    } finally { setValidando(false); }
  }

  const canValidate = ['Consultor', 'SuperAdmin'].includes(usuario?.rol);

  return (
    <div className="flex-1 overflow-auto p-8 lg:p-10">
      <header className="mb-8">
        <h2 className="text-3xl font-bold text-gray-900 mb-1">Dashboard del Consultor</h2>
        <p className="text-gray-500">
          Diagnósticos PSM generados por IA pendientes de revisión y aprobación.
        </p>
      </header>

      {/* Filtro de estado */}
      <div className="flex gap-2 mb-6">
        {['', 'Borrador', 'En Validación', 'Aprobado'].map((est) => (
          <button
            key={est}
            type="button"
            onClick={() => setFiltroEstado(est)}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-colors ${
              filtroEstado === est
                ? 'bg-gray-900 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {est || 'Todos'}
          </button>
        ))}
      </div>

      {/* Lista de diagnósticos */}
      {cargando ? (
        <div className="text-center py-16 text-gray-400 text-sm">Cargando diagnósticos...</div>
      ) : diagnosticos.length === 0 ? (
        <div className="text-center py-16 text-gray-400 text-sm">
          No hay diagnósticos con estado "{filtroEstado || 'todos'}".
        </div>
      ) : (
        <div className="space-y-3">
          {diagnosticos.map((d) => (
            <div
              key={d.id}
              className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => abrirDiagnostico(d)}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-mono text-gray-400">#{d.id}</span>
                    <EstadoBadge estado={d.estado} />
                    {d.planta_nombre && (
                      <span className="text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                        {d.planta_nombre}
                        {d.area_nombre ? ` · ${d.area_nombre}` : ''}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-700 leading-relaxed line-clamp-2">
                    {d.escenario || 'Sin descripción de escenario.'}
                  </p>
                  <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
                    {d.consultor_nombre && <span>Consultor: {d.consultor_nombre}</span>}
                    <span>{new Date(d.created_at).toLocaleDateString('es-CO', {
                      year: 'numeric', month: 'short', day: 'numeric'
                    })}</span>
                  </div>
                </div>
                <button
                  type="button"
                  className="shrink-0 px-3 py-1.5 rounded-lg bg-green-50 hover:bg-green-100 text-green-700 text-xs font-semibold transition-colors"
                  onClick={(e) => { e.stopPropagation(); abrirDiagnostico(d); }}
                >
                  Revisar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal de validación */}
      {abierto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setAbierto(null)} />
          <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-xl flex flex-col max-h-[90vh]">

            <div className="px-6 py-4 border-b border-gray-100 shrink-0">
              <div className="flex items-center gap-3">
                <h3 className="text-base font-bold text-gray-900 flex-1">
                  Diagnóstico #{abierto.id}
                </h3>
                <EstadoBadge estado={abierto.estado} />
              </div>
              {(abierto.planta_nombre || abierto.area_nombre) && (
                <p className="text-xs text-gray-400 mt-1">
                  {[abierto.planta_nombre, abierto.area_nombre].filter(Boolean).join(' · ')}
                </p>
              )}
            </div>

            <div className="overflow-y-auto px-6 py-5 space-y-4 flex-1">
              {/* Escenario original */}
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                  Escenario descrito
                </p>
                <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-700 leading-relaxed whitespace-pre-wrap border border-gray-100">
                  {abierto.escenario || '—'}
                </div>
              </div>

              {/* Resultado IA */}
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                  Análisis generado por IA
                </p>
                <div className="bg-blue-50 rounded-lg p-4 text-sm text-blue-900 leading-relaxed whitespace-pre-wrap border border-blue-100">
                  {abierto.resultado_ia || '—'}
                </div>
              </div>

              {/* Hallazgos validados (editable por Consultor) */}
              {canValidate && (
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-2">
                    Hallazgos validados por el Consultor
                    <span className="text-gray-400 font-normal normal-case ml-1">(editable)</span>
                  </label>
                  <textarea
                    value={hallazgos}
                    onChange={(e) => setHallazgos(e.target.value)}
                    rows={6}
                    className="w-full px-4 py-3 rounded-lg border border-gray-200 text-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-y leading-relaxed"
                    placeholder="Edita, complementa o corrige los hallazgos propuestos por la IA..."
                  />
                </div>
              )}

              {msgValidacion && (
                <p className={`text-sm font-medium ${
                  msgValidacion.startsWith('✔') ? 'text-emerald-600' : 'text-rose-600'
                }`}>
                  {msgValidacion}
                </p>
              )}
            </div>

            <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3 shrink-0">
              <button
                type="button"
                onClick={() => setAbierto(null)}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors"
              >
                Cerrar
              </button>
              {canValidate && abierto.estado !== 'Aprobado' && (
                <button
                  type="button"
                  onClick={validar}
                  disabled={validando}
                  className="px-5 py-2 rounded-lg text-sm font-semibold text-white bg-green-600 hover:bg-green-700 transition-colors disabled:opacity-60"
                >
                  {validando ? 'Aprobando...' : 'Aprobar diagnóstico'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
