/**
 * Home — Página de Inicio (Inicio / Home). Hero de oferta de valor + grid de 3 pilares (CTAs).
 * Estilo Enterprise SaaS; navegación por estado (onNavigate) sin rutas URL.
 */
import {
  ClipboardList, Radar, CheckSquare, ArrowRight,
} from 'lucide-react';

const PILLAR_CARDS = [
  {
    id: 'diagnostico',
    navLabel: 'Diagnóstico',
    title: 'Diagnósticos Inteligentes',
    copy: 'Evalúa el cumplimiento normativo mediante triangulación de documentos, entrevistas y auditoría en campo asistida por IA.',
    buttonLabel: 'Ir a Diagnósticos',
    icon: ClipboardList,
    iconBg: 'bg-emerald-100',
    iconColor: 'text-emerald-700',
    cardBorder: 'border-emerald-200',
    cardHover: 'hover:border-emerald-300 hover:shadow-lg',
    buttonClass: 'bg-emerald-600 hover:bg-emerald-700 text-white',
  },
  {
    id: 'radar',
    navLabel: 'Radar de Madurez',
    title: 'Radar de Madurez',
    copy: 'Visualiza el mapa de calor de tu instalación. Identifica áreas críticas de los 20 elementos del CCPS en tiempo real y prioriza tus recursos.',
    buttonLabel: 'Ver Radar',
    icon: Radar,
    iconBg: 'bg-indigo-100',
    iconColor: 'text-indigo-700',
    cardBorder: 'border-indigo-200',
    cardHover: 'hover:border-indigo-300 hover:shadow-lg',
    buttonClass: 'bg-indigo-600 hover:bg-indigo-700 text-white',
  },
  {
    id: 'plan',
    navLabel: 'Plan de Acción',
    title: 'Plan de Acción',
    copy: 'Gestiona hallazgos, aprueba evidencias con nuestro flujo Maker-Checker y cierra brechas de seguridad de forma auditable.',
    buttonLabel: 'Ir a Planes de Acción',
    icon: CheckSquare,
    iconBg: 'bg-amber-100',
    iconColor: 'text-amber-700',
    cardBorder: 'border-amber-200',
    cardHover: 'hover:border-amber-300 hover:shadow-lg',
    buttonClass: 'bg-amber-600 hover:bg-amber-700 text-white',
  },
];

export default function Home({ onNavigate }) {
  return (
    <div className="flex-1 overflow-auto min-h-0">
      <div className="min-h-full">

        {/* ── Sección A: Hero Banner (Oferta de valor) ─────────────────────── */}
        <section className="relative px-6 pt-10 pb-14 lg:px-10 lg:pt-14 lg:pb-20 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-50/90 via-white to-teal-50/80 pointer-events-none" />
          <div className="absolute top-0 right-0 w-1/2 h-full bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-emerald-100/40 to-transparent pointer-events-none" />
          <div className="relative max-w-4xl mx-auto text-center">
            <h1 className="text-3xl font-bold text-gray-900 tracking-tight sm:text-4xl lg:text-5xl">
              Bienvenido a Skudo PSM
            </h1>
            <p className="mt-4 text-lg text-gray-600 leading-relaxed sm:text-xl max-w-2xl mx-auto">
              La plataforma integral para evaluar, visualizar y elevar la madurez de la Seguridad de Procesos en tu centro de trabajo.
            </p>
          </div>
        </section>

        {/* ── Sección B: Grid de los 3 pilares (CTAs) ────────────────────────── */}
        <section className="px-6 pb-14 lg:px-10 lg:pb-20">
          <div className="max-w-6xl mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
              {PILLAR_CARDS.map((card) => {
                const Icon = card.icon;
                return (
                  <article
                    key={card.id}
                    className={`
                      relative rounded-2xl border-2 bg-white p-6 lg:p-8
                      transition-all duration-300 ease-out
                      ${card.cardBorder} ${card.cardHover}
                    `}
                  >
                    <div className={`inline-flex p-3 rounded-xl ${card.iconBg} ${card.iconColor}`}>
                      <Icon className="w-8 h-8" />
                    </div>
                    <h2 className="mt-5 text-xl font-bold text-gray-900">
                      {card.title}
                    </h2>
                    <p className="mt-3 text-gray-600 text-sm leading-relaxed">
                      {card.copy}
                    </p>
                    <button
                      type="button"
                      onClick={() => onNavigate && onNavigate(card.navLabel)}
                      className={`
                        mt-6 w-full inline-flex items-center justify-center gap-2
                        px-4 py-3 rounded-xl text-sm font-semibold
                        transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-400
                        ${card.buttonClass}
                      `}
                    >
                      {card.buttonLabel}
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

      </div>
    </div>
  );
}
