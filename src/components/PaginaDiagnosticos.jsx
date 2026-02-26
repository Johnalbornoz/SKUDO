import { useState } from 'react';
import {
  Plus, ClipboardList, CheckCircle2, Clock, BarChart2,
} from 'lucide-react';
import DiagnosticosDashboard from './DiagnosticosDashboard';

/**
 * Página dedicada del tab "Diagnóstico" en el menú lateral.
 * Muestra:
 *   - Estadísticas rápidas (total, en curso, finalizados)
 *   - Lista de diagnósticos en progreso
 *   - Historial de diagnósticos finalizados con análisis IA expandible
 *   - Botón para iniciar un nuevo diagnóstico
 */
export default function PaginaDiagnosticos({ onContinuar, onNuevoDiagnostico }) {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* ── Header de página ──────────────────────────────────────────────── */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-20">
        <div className="px-8 lg:px-10 py-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-xl">
                <ClipboardList className="w-6 h-6 text-green-700" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">Diagnósticos PSM</h1>
                <p className="text-sm text-gray-500 mt-0.5">
                  Gestiona y consulta todos los diagnósticos de seguridad de procesos
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onNuevoDiagnostico}
              className="flex items-center gap-2 px-5 py-2.5 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold rounded-xl shadow-sm transition-colors"
            >
              <Plus className="w-4 h-4" />
              Nuevo Diagnóstico
            </button>
          </div>
        </div>
      </div>

      {/* ── Contenido ────────────────────────────────────────────────────── */}
      <div className="px-8 lg:px-10 py-8">
        <DiagnosticosDashboard
          onContinuar={onContinuar}
          onNuevoDiagnostico={onNuevoDiagnostico}
          ocultarBotonNuevo
        />
      </div>
    </div>
  );
}
