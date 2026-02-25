/**
 * NavegacionFases.jsx
 * Barra de navegación entre fases del diagnóstico.
 * Permite regresar a cualquier fase anterior con un solo clic.
 */
import { CheckCircle2, Lock } from 'lucide-react';

export const FASES_DIAGNOSTICO = [
  { num: 1, label: 'Clasificación', sublabel: 'Motor PSM',       color: 'indigo' },
  { num: 2, label: 'Cuestionario',  sublabel: 'Normativo',        color: 'blue'   },
  { num: 3, label: 'Documentos',    sublabel: 'Evidencia',        color: 'violet' },
  { num: 4, label: 'Recorrido',     sublabel: 'Walkthrough',      color: 'teal'   },
  { num: 5, label: 'Entrevistas',   sublabel: 'Voces de campo',   color: 'indigo' },
  { num: 6, label: 'Validación',    sublabel: 'Análisis IA',      color: 'green'  },
];

const COLOR_MAP = {
  indigo: { active: 'bg-indigo-600 text-white ring-indigo-300', done: 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200', dot: 'bg-indigo-600' },
  blue:   { active: 'bg-blue-600   text-white ring-blue-300',   done: 'bg-blue-100   text-blue-700   hover:bg-blue-200',   dot: 'bg-blue-600'   },
  violet: { active: 'bg-violet-600 text-white ring-violet-300', done: 'bg-violet-100 text-violet-700 hover:bg-violet-200', dot: 'bg-violet-600' },
  teal:   { active: 'bg-teal-600   text-white ring-teal-300',   done: 'bg-teal-100   text-teal-700   hover:bg-teal-200',   dot: 'bg-teal-600'   },
  green:  { active: 'bg-green-600  text-white ring-green-300',  done: 'bg-green-100  text-green-700  hover:bg-green-200',  dot: 'bg-green-600'  },
};

/**
 * @param {number}   faseActual  - Número de fase donde está el usuario (1-6)
 * @param {function} onNavegar   - Callback: (faseNum) => void
 * @param {boolean}  soloLectura - Si true, deshabilita navegación
 */
export default function NavegacionFases({ faseActual, onNavegar, soloLectura = false }) {
  return (
    <div className="w-full overflow-x-auto">
      <ol className="flex items-center min-w-max px-1">
        {FASES_DIAGNOSTICO.map((fase, idx) => {
          const pasada   = fase.num < faseActual;
          const activa   = fase.num === faseActual;
          const futura   = fase.num > faseActual;
          const clicable = pasada && !soloLectura;
          const cfg      = COLOR_MAP[fase.color] ?? COLOR_MAP.indigo;

          return (
            <li key={fase.num} className="flex items-center">
              {/* Nodo de fase */}
              <button
                type="button"
                disabled={futura || soloLectura}
                onClick={() => clicable && onNavegar(fase.num)}
                title={clicable ? `Ir a: ${fase.label}` : undefined}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all select-none
                  ${activa   ? `${cfg.active} ring-2 ring-offset-1 shadow-sm` : ''}
                  ${pasada   ? `${cfg.done} cursor-pointer`                    : ''}
                  ${futura   ? 'bg-gray-100 text-gray-400 cursor-not-allowed'  : ''}
                  ${clicable ? 'hover:shadow-sm active:scale-95'               : ''}`}
              >
                {/* Indicador */}
                <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0
                  ${activa ? 'bg-white/30' : pasada ? 'bg-white/60' : 'bg-gray-200 text-gray-400'}`}>
                  {pasada
                    ? <CheckCircle2 className="w-3 h-3" />
                    : futura
                      ? <Lock className="w-2.5 h-2.5" />
                      : fase.num}
                </span>
                <span className="hidden sm:inline">{fase.label}</span>
              </button>

              {/* Conector */}
              {idx < FASES_DIAGNOSTICO.length - 1 && (
                <div className={`w-6 h-0.5 mx-0.5 rounded-full transition-colors ${pasada ? cfg.dot : 'bg-gray-200'}`} />
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
