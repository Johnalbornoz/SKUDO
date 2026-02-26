/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  LayoutDashboard, 
  ClipboardCheck, 
  FileText, 
  TrendingUp, 
  Settings, 
  ChevronRight, 
  Upload, 
  Mic, 
  Users, 
  Search, 
  CheckCircle2, 
  AlertCircle,
  ArrowLeft,
  Plus,
  Trash2,
  FileSearch,
  MessageSquare,
  Eye,
  ShieldCheck
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { GoogleGenAI } from "@google/genai";
import { 
  InstallationLevel, 
  EffectivenessLevel, 
  DiagnosisSession, 
  DiagnosisResponse 
} from './types';
import { PSM_QUESTIONS } from './constants';

// --- AI Service ---
const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY });

// --- Components ---

const Logo = () => (
  <div className="flex items-center gap-2">
    <div className="relative w-8 h-8">
      <div className="absolute inset-0 bg-gradient-to-br from-[#EBB90C] to-[#BC6815] rounded-lg rotate-12 opacity-20" />
      <ShieldCheck className="relative w-8 h-8 text-[#BC6815]" />
    </div>
    <div className="flex flex-col leading-none">
      <span className="text-xl font-bold tracking-tight text-gray-900">Skudo <span className="text-brand-green">PSM</span></span>
      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Expert System</span>
    </div>
  </div>
);

const SidebarItem = ({ icon: Icon, label, active, onClick }: any) => (
  <button 
    onClick={onClick}
    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
      active 
      ? 'bg-brand-green/10 text-brand-green font-semibold' 
      : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
    }`}
  >
    <Icon className={`w-5 h-5 ${active ? 'text-brand-green' : 'text-gray-400'}`} />
    <span className="text-sm">{label}</span>
  </button>
);

const AccessCard = ({ title, description, icon: Icon, colorClass, onClick }: any) => (
  <button 
    onClick={onClick}
    className={`artisanal-card ${colorClass} text-left group w-full`}
  >
    <div className="flex items-start justify-between mb-4">
      <div className={`p-3 rounded-xl bg-gray-50 group-hover:scale-110 transition-transform`}>
        <Icon className="w-6 h-6 text-gray-700" />
      </div>
      <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-brand-green transition-colors" />
    </div>
    <h3 className="text-lg font-bold text-gray-900 mb-2">{title}</h3>
    <p className="text-sm text-gray-500 leading-relaxed">{description}</p>
  </button>
);

const Header = ({ title, subtitle, onBack }: any) => (
  <div className="mb-8 flex items-center gap-4">
    {onBack && (
      <button onClick={onBack} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
        <ArrowLeft className="w-6 h-6 text-gray-600" />
      </button>
    )}
    <div>
      <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
      <p className="text-sm text-gray-500">{subtitle}</p>
    </div>
  </div>
);

// --- Main App ---

export default function App() {
  const [view, setView] = useState<'home' | 'diagnosis' | 'config' | 'plan' | 'forecast'>('home');
  const [diagnosisStep, setDiagnosisStep] = useState<'setup' | 'docs' | 'walkthrough' | 'interviews' | 'validation' | 'action_plan'>('setup');
  const [session, setSession] = useState<DiagnosisSession | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [recentSessions, setRecentSessions] = useState<any[]>([]);
  const [dbStatus, setDbStatus] = useState<{ status: string, message: string, data?: any, database_url?: string } | null>(null);
  const [systemPrompt, setSystemPrompt] = useState('');
  const [isSavingConfig, setIsSavingConfig] = useState(false);
  const [questions, setQuestions] = useState<any[]>([]);
  const [criteria, setCriteria] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [activeConfigTab, setActiveConfigTab] = useState<'logic' | 'questions' | 'criteria' | 'users' | 'infra'>('logic');
  const [isAdmin, setIsAdmin] = useState(true); // Mock admin status

  // Cargar sesiones, config y preguntas al inicio
  useEffect(() => {
    fetchSessions();
    fetchConfig();
    fetchQuestions();
    fetchCriteria();
    fetchUsers();
  }, []);

  const fetchQuestions = async () => {
    try {
      const res = await fetch('/api/questions');
      if (res.ok) {
        const data = await res.json();
        setQuestions(data);
      }
    } catch (err) {
      console.error("Error fetching questions:", err);
    }
  };

  const fetchCriteria = async () => {
    try {
      const res = await fetch('/api/criteria');
      if (res.ok) {
        const data = await res.json();
        setCriteria(data);
      }
    } catch (err) {
      console.error("Error fetching criteria:", err);
    }
  };

  const fetchUsers = async () => {
    try {
      const res = await fetch('/api/users');
      if (res.ok) {
        const data = await res.json();
        setUsers(data);
      }
    } catch (err) {
      console.error("Error fetching users:", err);
    }
  };

  const fetchConfig = async () => {
    try {
      const res = await fetch('/api/config');
      if (res.ok) {
        const data = await res.json();
        setSystemPrompt(data.system_prompt);
      }
    } catch (err) {
      console.error("Error fetching config:", err);
    }
  };

  const saveConfig = async () => {
    setIsSavingConfig(true);
    try {
      const res = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ systemPrompt })
      });
      if (res.ok) {
        alert("Configuración guardada correctamente");
      }
    } catch (err) {
      console.error("Error saving config:", err);
    } finally {
      setIsSavingConfig(false);
    }
  };

  const testDbConnection = async () => {
    setDbStatus({ status: 'loading', message: 'Probando conexión...' });
    try {
      const res = await fetch('/api/db-test');
      const data = await res.json();
      if (!res.ok) {
        setDbStatus({ 
          status: 'error', 
          message: data.message || 'Error en el servidor',
          data: data.error ? { error: data.error } : undefined
        });
      } else {
        setDbStatus(data);
      }
    } catch (err) {
      setDbStatus({ status: 'error', message: 'No se pudo contactar con el servidor. Verifique que el backend esté corriendo.' });
    }
  };

  const fetchSessions = async () => {
    try {
      const res = await fetch('/api/sessions');
      if (res.ok) {
        const data = await res.json();
        setRecentSessions(data);
      }
    } catch (err) {
      console.error("Error fetching sessions:", err);
    }
  };

  // --- Handlers ---

  const startDiagnosis = async (data: Partial<DiagnosisSession>) => {
    const newSession: DiagnosisSession = {
      id: Math.random().toString(36).substr(2, 9),
      installationName: data.installationName || '',
      level: data.level || InstallationLevel.LEVEL_1,
      sector: data.sector || '',
      substances: data.substances || '',
      staffCount: data.staffCount || 0,
      age: data.age || 0,
      responses: [],
      status: 'draft',
      createdAt: new Date().toISOString(),
      fieldNotes: [],
      interviews: []
    };

    try {
      const res = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: newSession.id,
          installationName: newSession.installationName,
          level: newSession.level,
          sector: newSession.sector,
          substances: newSession.substances,
          staffCount: newSession.staffCount,
          age: newSession.age,
          status: newSession.status
        })
      });
      
      if (res.ok) {
        setSession(newSession);
        setDiagnosisStep('docs');
      }
    } catch (err) {
      console.error("Error creating session in DB:", err);
      // Fallback local para demo si falla el server
      setSession(newSession);
      setDiagnosisStep('docs');
    }
  };

  const handleAnalyzeEvidence = async () => {
    if (!session) return;
    setIsAnalyzing(true);
    
    try {
      // Simulación de procesamiento IA
      setTimeout(async () => {
        const activeQuestions = questions.length > 0 ? questions : PSM_QUESTIONS;
        const mockResponses: DiagnosisResponse[] = activeQuestions
          .filter(q => q.applicable_levels ? q.applicable_levels.includes(session.level) : q.applicableLevels.includes(session.level))
          .map(q => ({
            questionId: q.id,
            score: 65,
            effectiveness: EffectivenessLevel.SCARCE,
            finding: {
              situation: "Se observa una implementación parcial de los protocolos de seguridad.",
              evidence: "Documento: Manual de Operaciones v2.0; Entrevista: Jefe de Planta.",
              recommendation: "Actualizar la matriz de riesgos y formalizar los registros de capacitación."
            },
            triangulation: {
              documents: ["Manual de Operaciones", "P&ID-001"],
              observations: ["Falta de señalización en área crítica"],
              interviews: ["Operador menciona desconocer el plan de emergencia"]
            }
          }));
        
        // Guardar respuestas en DB
        try {
          await fetch(`/api/sessions/${session.id}/responses`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ responses: mockResponses })
          });
        } catch (err) {
          console.error("Error saving responses to DB:", err);
        }

        setSession({ ...session, responses: mockResponses });
        setIsAnalyzing(false);
        setDiagnosisStep('walkthrough');
        fetchSessions(); // Actualizar lista
      }, 2000);

    } catch (error) {
      console.error("Error analyzing evidence:", error);
      setIsAnalyzing(false);
    }
  };

  // --- Layout Wrapper ---
  const Layout = ({ children }: { children: React.ReactNode }) => (
    <div className="flex min-h-screen bg-surface-bg">
      {/* Sidebar - White as requested */}
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col fixed h-full z-10">
        <div className="p-6 border-b border-gray-100">
          <Logo />
        </div>
        <nav className="flex-1 p-4 space-y-2">
          <SidebarItem 
            icon={LayoutDashboard} 
            label="Dashboard" 
            active={view === 'home'} 
            onClick={() => setView('home')} 
          />
          <SidebarItem 
            icon={ClipboardCheck} 
            label="Diagnóstico" 
            active={view === 'diagnosis'} 
            onClick={() => setView('diagnosis')} 
          />
          <SidebarItem 
            icon={FileText} 
            label="Plan de Acción" 
            active={view === 'plan'} 
            onClick={() => setView('plan')} 
          />
          <SidebarItem 
            icon={TrendingUp} 
            label="Pronóstico" 
            active={view === 'forecast'} 
            onClick={() => setView('forecast')} 
          />
        </nav>
        <div className="p-4 border-t border-gray-100">
          <SidebarItem 
            icon={Settings} 
            label="Configuración del Sistema" 
            active={view === 'config'} 
            onClick={() => setView('config')} 
          />
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 ml-64">
        {children}
      </main>
    </div>
  );

  // --- Views ---

  const HomeView = () => (
    <div className="max-w-6xl mx-auto py-12 px-8">
      <div className="mb-12">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">Bienvenido, Consultor</h1>
        <p className="text-lg text-gray-500 max-w-2xl">Gestione el diagnóstico de seguridad de procesos con rigor técnico y cumplimiento normativo bajo la metodología CCPS.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <AccessCard 
          title="Diagnóstico Fase I" 
          description="Evaluación inicial, análisis documental y triangulación de hallazgos en planta."
          icon={ClipboardCheck}
          colorClass="card-emerald"
          onClick={() => setView('diagnosis')}
        />
        <AccessCard 
          title="Plan de Acción" 
          description="Definición de medidas de mitigación y cronograma de cierre de brechas."
          icon={FileText}
          colorClass="card-blue"
          onClick={() => setView('plan')}
        />
        <AccessCard 
          title="Pronóstico" 
          description="Modelado de riesgos futuros y análisis de tendencias de seguridad."
          icon={TrendingUp}
          colorClass="card-amber"
          onClick={() => setView('forecast')}
        />
      </div>

      <div className="mt-12 bg-white rounded-2xl p-8 border border-gray-200 shadow-sm">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-xl font-bold">Diagnósticos Recientes</h2>
          <button className="text-brand-green font-medium flex items-center gap-2 hover:underline text-sm">
            Ver todos <ChevronRight className="w-4 h-4" />
          </button>
        </div>
        <div className="space-y-4">
          {recentSessions.length > 0 ? recentSessions.slice(0, 5).map((s, i) => (
            <div key={s.id} className="flex items-center justify-between p-4 rounded-xl hover:bg-gray-50 transition-colors border border-transparent hover:border-gray-100">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-brand-green/10 rounded-lg flex items-center justify-center text-brand-green">
                  <FileSearch className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-semibold text-gray-900">{s.installation_name} - Nivel {s.level}</h4>
                  <p className="text-xs text-gray-400">Creado el {new Date(s.created_at).toLocaleDateString()} • ID: {s.id}</p>
                </div>
              </div>
              <div className="flex items-center gap-6">
                <div className="text-right">
                  <div className="text-sm font-bold text-brand-green">{s.status === 'completed' ? '100%' : 'En Proceso'}</div>
                  <div className="text-[10px] uppercase font-bold text-gray-400">{s.status}</div>
                </div>
                <button className="p-2 hover:bg-white rounded-lg shadow-sm border border-gray-200">
                  <Eye className="w-4 h-4 text-gray-400" />
                </button>
              </div>
            </div>
          )) : (
            <div className="text-center py-12 text-gray-400 italic">No hay diagnósticos registrados aún.</div>
          )}
        </div>
      </div>
    </div>
  );

  const DiagnosisView = () => {
    const [formData, setFormData] = useState({
      name: '',
      level: InstallationLevel.LEVEL_1,
      sector: '',
      substances: '',
      staffCount: 0,
      age: 0
    });

    if (diagnosisStep === 'setup') {
      const levelDescriptions = [
        "Nivel 1: Instalaciones con cantidades mínimas de sustancias peligrosas. Riesgo bajo.",
        "Nivel 2: Procesos industriales estándar con almacenamiento moderado.",
        "Nivel 3: Instalaciones con riesgo significativo de accidente mayor. Requiere PHA detallado.",
        "Nivel 4: Complejos industriales de alta complejidad y grandes volúmenes de sustancias.",
        "Nivel 5: Instalaciones críticas de escala nacional con máximo potencial de afectación."
      ];

      return (
        <div className="max-w-4xl mx-auto py-12 px-8">
          <Header 
            title="Configuración de Diagnóstico" 
            subtitle="Paso Cero: Definición del alcance técnico y nivel de riesgo."
            onBack={() => setView('home')}
          />
          <div className="bg-white rounded-2xl p-10 shadow-sm border border-gray-200">
            <div className="space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <section>
                  <label className="block text-xs font-bold text-gray-400 mb-3 uppercase tracking-widest">Nombre de la Instalación</label>
                  <div className="relative">
                    <input 
                      type="text" 
                      value={formData.name}
                      onChange={(e) => setFormData({...formData, name: e.target.value})}
                      placeholder="Ej: Refinería Central"
                      className="w-full pl-12 pr-4 py-4 rounded-xl border border-gray-200 focus:ring-2 focus:ring-brand-green/20 focus:border-brand-green outline-none transition-all text-lg font-medium"
                    />
                    <ShieldCheck className="absolute left-4 top-1/2 -translate-y-1/2 w-6 h-6 text-gray-300" />
                  </div>
                </section>
                <section>
                  <label className="block text-xs font-bold text-gray-400 mb-3 uppercase tracking-widest">Sector Industrial</label>
                  <select 
                    value={formData.sector}
                    onChange={(e) => setFormData({...formData, sector: e.target.value})}
                    className="w-full px-4 py-4 rounded-xl border border-gray-200 focus:ring-2 focus:ring-brand-green/20 focus:border-brand-green outline-none transition-all text-lg font-medium"
                  >
                    <option value="">Seleccione un sector</option>
                    <option value="petroquimico">Petroquímico</option>
                    <option value="alimentos">Alimentos y Bebidas</option>
                    <option value="farmaceutico">Farmacéutico</option>
                    <option value="energia">Energía</option>
                    <option value="mineria">Minería</option>
                  </select>
                </section>
              </div>

              <section>
                <label className="block text-xs font-bold text-gray-400 mb-3 uppercase tracking-widest">Inventario de Sustancias Peligrosas</label>
                <textarea 
                  value={formData.substances}
                  onChange={(e) => setFormData({...formData, substances: e.target.value})}
                  placeholder="Liste las sustancias y cantidades aproximadas..."
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-brand-green/20 focus:border-brand-green outline-none transition-all h-24"
                />
              </section>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <section>
                  <label className="block text-xs font-bold text-gray-400 mb-3 uppercase tracking-widest">Cantidad de Personal</label>
                  <input 
                    type="number" 
                    value={formData.staffCount}
                    onChange={(e) => setFormData({...formData, staffCount: parseInt(e.target.value)})}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-brand-green/20 focus:border-brand-green outline-none transition-all"
                  />
                </section>
                <section>
                  <label className="block text-xs font-bold text-gray-400 mb-3 uppercase tracking-widest">Antigüedad de la Planta (Años)</label>
                  <input 
                    type="number" 
                    value={formData.age}
                    onChange={(e) => setFormData({...formData, age: parseInt(e.target.value)})}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-brand-green/20 focus:border-brand-green outline-none transition-all"
                  />
                </section>
              </div>

              <section>
                <div className="flex items-center justify-between mb-4">
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest">Nivel de Complejidad (Decreto 1347)</label>
                  <span className="px-3 py-1 bg-brand-green/10 text-brand-green rounded-full text-[10px] font-bold uppercase">Requerido</span>
                </div>
                <div className="grid grid-cols-5 gap-4 mb-6">
                  {[1, 2, 3, 4, 5].map(l => (
                    <button
                      key={l}
                      onClick={() => setFormData({...formData, level: l as InstallationLevel})}
                      className={`group relative py-6 rounded-2xl border-2 transition-all ${
                        formData.level === l 
                        ? 'border-brand-green bg-brand-green/5 text-brand-green' 
                        : 'border-gray-100 hover:border-gray-200 text-gray-400'
                      }`}
                    >
                      <span className="text-2xl font-black block mb-1">{l}</span>
                      <span className="text-[9px] uppercase font-bold opacity-60">Nivel</span>
                      {formData.level === l && (
                        <motion.div layoutId="activeLevel" className="absolute -top-2 -right-2 w-6 h-6 bg-brand-green text-white rounded-full flex items-center justify-center shadow-lg">
                          <CheckCircle2 className="w-4 h-4" />
                        </motion.div>
                      )}
                    </button>
                  ))}
                </div>
                
                <AnimatePresence mode="wait">
                  <motion.div 
                    key={formData.level}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="p-4 bg-gray-50 rounded-xl border border-gray-100 flex gap-3 items-start"
                  >
                    <AlertCircle className="w-5 h-5 text-brand-green mt-0.5 shrink-0" />
                    <p className="text-sm text-gray-600 leading-relaxed">
                      {levelDescriptions[formData.level - 1]}
                    </p>
                  </motion.div>
                </AnimatePresence>
              </section>

              <div className="pt-4">
                <button 
                  disabled={!formData.name || !formData.sector}
                  onClick={() => startDiagnosis({
                    installationName: formData.name,
                    level: formData.level,
                    sector: formData.sector,
                    substances: formData.substances,
                    staffCount: formData.staffCount,
                    age: formData.age
                  })}
                  className="w-full py-5 bg-gray-900 text-white rounded-2xl font-bold text-xl hover:bg-gray-800 transition-all disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-3 shadow-2xl shadow-gray-900/20"
                >
                  Iniciar Consultoría Técnica <ChevronRight className="w-6 h-6" />
                </button>
                <p className="text-center mt-4 text-[10px] text-gray-400 uppercase tracking-widest font-medium">
                  Al iniciar, se habilitará el log de 188 preguntas normativas.
                </p>
              </div>
            </div>
          </div>
        </div>
      );
    }

    if (diagnosisStep === 'docs') {
      return (
        <div className="max-w-5xl mx-auto py-12 px-8">
          <Header 
            title="Análisis Documental IA" 
            subtitle={`Carga masiva y extracción automática para ${session?.installationName}`}
            onBack={() => setDiagnosisStep('setup')}
          />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="md:col-span-2">
              <div className="bg-white rounded-2xl p-12 border-2 border-dashed border-gray-200 flex flex-col items-center justify-center text-center group hover:border-brand-green transition-colors cursor-pointer">
                <div className="w-16 h-16 bg-brand-green/5 rounded-full flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                  <Upload className="w-8 h-8 text-brand-green" />
                </div>
                <h3 className="text-lg font-bold mb-2">Arrastre sus documentos técnicos</h3>
                <p className="text-sm text-gray-400 mb-6">P&ID, HAZOP, Planos, Manuales de Mantenimiento.</p>
                <button className="px-6 py-2 bg-gray-900 text-white rounded-lg font-medium text-sm">Seleccionar Archivos</button>
              </div>

              <div className="mt-8 space-y-4">
                <h4 className="font-bold text-gray-400 uppercase text-[10px] tracking-widest">Evidencias Detectadas por IA</h4>
                <div className="space-y-3">
                  {[
                    { file: 'HAZOP_2023.pdf', status: 'Analizado', findings: 12 },
                    { file: 'PID_Planta_A.dwg', status: 'Analizado', findings: 8 },
                    { file: 'Manual_Operaciones_v2.pdf', status: 'Analizado', findings: 15 }
                  ].map(doc => (
                    <div key={doc.file} className="flex items-center justify-between p-4 bg-white rounded-xl border border-gray-100">
                      <div className="flex items-center gap-3">
                        <FileText className="w-5 h-5 text-brand-blue" />
                        <div>
                          <p className="text-sm font-bold text-gray-900">{doc.file}</p>
                          <p className="text-[10px] text-gray-400 uppercase font-bold">{doc.status}</p>
                        </div>
                      </div>
                      <span className="px-3 py-1 bg-brand-green/10 text-brand-green rounded-full text-[10px] font-bold">
                        {doc.findings} Hallazgos
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <div className="bg-gray-900 text-white rounded-2xl p-6 shadow-xl">
                <h4 className="font-bold mb-4 flex items-center gap-2 text-sm">
                  <ShieldCheck className="w-5 h-5 text-brand-green" />
                  Motor de Extracción
                </h4>
                <p className="text-xs text-gray-400 mb-6 leading-relaxed">La IA está lista para correlacionar los documentos con los 188 ítems normativos.</p>
                <button 
                  onClick={handleAnalyzeEvidence}
                  disabled={isAnalyzing}
                  className="w-full py-3 bg-brand-green hover:bg-brand-green-dark text-white rounded-xl font-bold transition-all flex items-center justify-center gap-2 text-sm"
                >
                  {isAnalyzing ? (
                    <>Procesando... <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /></>
                  ) : (
                    <>Ejecutar Análisis IA <ChevronRight className="w-4 h-4" /></>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    if (diagnosisStep === 'walkthrough') {
      return (
        <div className="max-w-4xl mx-auto py-12 px-8">
          <Header 
            title="Recorrido de Campo" 
            subtitle="Validación de realidad operativa y registro de notas de campo."
            onBack={() => setDiagnosisStep('docs')}
          />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="md:col-span-2 space-y-6">
              <div className="bg-white rounded-2xl p-8 border border-gray-200 shadow-sm">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-bold">Registro de Notas de Campo</h3>
                  <button className="p-3 bg-red-50 text-red-600 rounded-full hover:bg-red-100 transition-colors">
                    <Mic className="w-6 h-6" />
                  </button>
                </div>
                <textarea 
                  placeholder="Describa sus observaciones o use el registro por voz..."
                  className="w-full h-40 p-4 rounded-xl border border-gray-100 focus:ring-2 focus:ring-brand-green/20 outline-none transition-all mb-4"
                />
                <button className="w-full py-3 bg-gray-900 text-white rounded-xl font-bold text-sm">Guardar Observación</button>
              </div>

              <div className="space-y-4">
                <h4 className="font-bold text-gray-400 uppercase text-[10px] tracking-widest">Minuta de Visita</h4>
                {[
                  "Se observa falta de señalización en el área de descarga de amoníaco.",
                  "Válvulas de alivio sin precinto de seguridad visible.",
                  "Operadores portan EPP completo pero se detecta fatiga en turno nocturno."
                ].map((note, i) => (
                  <div key={i} className="p-4 bg-white rounded-xl border border-gray-100 flex gap-3">
                    <div className="w-2 h-2 rounded-full bg-brand-green mt-1.5" />
                    <p className="text-sm text-gray-600">{note}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-6">
              <div className="bg-brand-green text-white rounded-2xl p-6 shadow-xl">
                <h4 className="font-bold mb-2">Fase de Campo</h4>
                <p className="text-xs opacity-80 mb-6">Sus notas serán transcritas y correlacionadas con los pilares PSM automáticamente.</p>
                <button 
                  onClick={() => setDiagnosisStep('interviews')}
                  className="w-full py-3 bg-white text-brand-green rounded-xl font-bold text-sm flex items-center justify-center gap-2"
                >
                  Siguiente: Entrevistas <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    if (diagnosisStep === 'interviews') {
      return (
        <div className="max-w-4xl mx-auto py-12 px-8">
          <Header 
            title="Entrevistas Técnicas" 
            subtitle="Evaluación de cultura de seguridad y disciplina operativa."
            onBack={() => setDiagnosisStep('walkthrough')}
          />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="md:col-span-2 space-y-6">
              <div className="bg-white rounded-2xl p-8 border border-gray-200 shadow-sm">
                <h3 className="text-lg font-bold mb-6">Nueva Entrevista</h3>
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <input placeholder="Nombre del entrevistado" className="px-4 py-2 rounded-lg border border-gray-100 outline-none focus:ring-2 focus:ring-brand-green/20" />
                  <input placeholder="Cargo / Rol" className="px-4 py-2 rounded-lg border border-gray-100 outline-none focus:ring-2 focus:ring-brand-green/20" />
                </div>
                <textarea 
                  placeholder="Resumen de testimonios y respuestas clave..."
                  className="w-full h-32 p-4 rounded-xl border border-gray-100 focus:ring-2 focus:ring-brand-green/20 outline-none transition-all mb-4"
                />
                <button className="w-full py-3 bg-gray-900 text-white rounded-xl font-bold text-sm">Registrar Entrevista</button>
              </div>

              <div className="space-y-4">
                <h4 className="font-bold text-gray-400 uppercase text-[10px] tracking-widest">Análisis de Cultura IA</h4>
                <div className="p-6 bg-brand-blue/5 rounded-2xl border border-brand-blue/10">
                  <div className="flex items-center gap-3 mb-4">
                    <Users className="w-6 h-6 text-brand-blue" />
                    <h4 className="font-bold text-brand-blue">Detección de Brechas</h4>
                  </div>
                  <p className="text-sm text-gray-600 leading-relaxed">
                    La IA detecta una discrepancia entre el conocimiento teórico de los líderes y la ejecución práctica de los operadores en el pilar de "Gestión de Cambios".
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <div className="bg-gray-900 text-white rounded-2xl p-6 shadow-xl">
                <h4 className="font-bold mb-2">Consolidación</h4>
                <p className="text-xs text-gray-400 mb-6">Una vez terminadas las entrevistas, procederemos a la triangulación final de datos.</p>
                <button 
                  onClick={() => setDiagnosisStep('validation')}
                  className="w-full py-3 bg-brand-green text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2"
                >
                  Consola de Validación <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    if (diagnosisStep === 'validation') {
      return (
        <div className="max-w-7xl mx-auto py-12 px-8">
          <div className="flex items-center justify-between mb-8">
            <Header 
              title="Consola de Validación Experta" 
              subtitle={`Triangulación final para ${session?.installationName}`}
              onBack={() => setDiagnosisStep('interviews')}
            />
            <div className="flex gap-3">
              <button 
                onClick={() => setDiagnosisStep('action_plan')}
                className="px-6 py-2 bg-brand-green text-white rounded-xl font-bold text-sm hover:bg-brand-green-dark shadow-lg shadow-brand-green/20 flex items-center gap-2"
              >
                Generar Plan de Acción <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
              {session?.responses.map((resp, idx) => {
                const activeQuestions = questions.length > 0 ? questions : PSM_QUESTIONS;
                const question = activeQuestions.find(q => q.id === resp.questionId);
                
                // Determinar guía del auditor según score
                let guide = "";
                if (resp.score >= 75) guide = question?.auditor_guide_sufficient;
                else if (resp.score >= 50) guide = question?.auditor_guide_scarce;
                else if (resp.score >= 1) guide = question?.auditor_guide_at_least_one;
                else guide = question?.auditor_guide_none;

                return (
                  <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.1 }}
                    key={resp.questionId} 
                    className="bg-white rounded-2xl p-8 border border-gray-200 shadow-sm"
                  >
                    <div className="flex items-start justify-between mb-6">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="px-2 py-0.5 bg-gray-100 text-gray-500 rounded text-[9px] font-bold uppercase tracking-widest">{question?.category}</span>
                          <span className="text-[10px] text-gray-300 font-mono">{resp.questionId}</span>
                        </div>
                        <h3 className="text-lg font-bold text-gray-900 leading-tight">{question?.text}</h3>
                      </div>
                      <div className="text-right ml-4">
                        <select 
                          value={resp.score}
                          onChange={(e) => {
                            const newScore = parseInt(e.target.value);
                            const newResponses = [...session.responses];
                            newResponses[idx].score = newScore;
                            setSession({...session, responses: newResponses});
                          }}
                          className="text-lg font-bold text-brand-green bg-transparent border-none outline-none cursor-pointer"
                        >
                          <option value="100">100%</option>
                          <option value="75">75%</option>
                          <option value="50">50%</option>
                          <option value="25">25%</option>
                          <option value="0">0%</option>
                        </select>
                        <div className="text-[9px] uppercase font-bold text-gray-400">{resp.effectiveness}</div>
                      </div>
                    </div>

                    {guide && (
                      <div className="mb-6 p-4 bg-amber-50 rounded-xl border border-amber-100 text-xs text-amber-800 italic">
                        <strong>Guía Auditor:</strong> {guide}
                      </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                      <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                        <div className="flex items-center gap-2 mb-2 text-gray-400">
                          <FileText className="w-3.5 h-3.5" />
                          <span className="text-[9px] font-bold uppercase tracking-widest">IA (Documentos)</span>
                        </div>
                        <ul className="text-[11px] space-y-1 text-gray-600">
                          {resp.triangulation.documents.map((d, i) => <li key={i} className="flex items-center gap-1.5"><CheckCircle2 className="w-3 h-3 text-brand-green" /> {d}</li>)}
                        </ul>
                      </div>
                      <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                        <div className="flex items-center gap-2 mb-2 text-gray-400">
                          <Eye className="w-3.5 h-3.5" />
                          <span className="text-[9px] font-bold uppercase tracking-widest">Campo (Observación)</span>
                        </div>
                        <ul className="text-[11px] space-y-1 text-gray-600">
                          {resp.triangulation.observations.map((o, i) => <li key={i} className="flex items-center gap-1.5 text-amber-600"><AlertCircle className="w-3 h-3" /> {o}</li>)}
                        </ul>
                      </div>
                      <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                        <div className="flex items-center gap-2 mb-2 text-gray-400">
                          <MessageSquare className="w-3.5 h-3.5" />
                          <span className="text-[9px] font-bold uppercase tracking-widest">Testimonios</span>
                        </div>
                        <ul className="text-[11px] space-y-1 text-gray-600">
                          {resp.triangulation.interviews.map((e, i) => <li key={i} className="flex items-center gap-1.5"><Users className="w-3 h-3 text-brand-blue" /> {e}</li>)}
                        </ul>
                      </div>
                    </div>

                    <div className="space-y-4 border-t border-gray-50 pt-6">
                      <div className="flex justify-between items-start gap-4">
                        <div className="flex-1">
                          <h4 className="text-[10px] font-bold text-gray-400 uppercase mb-2 tracking-widest">Juicio Técnico Definitivo</h4>
                          <textarea 
                            value={resp.finding.situation}
                            onChange={(e) => {
                              const newResponses = [...session.responses];
                              newResponses[idx].finding.situation = e.target.value;
                              setSession({...session, responses: newResponses});
                            }}
                            className="w-full p-3 rounded-xl border border-gray-100 text-sm text-gray-700 leading-relaxed focus:ring-1 focus:ring-brand-green/20 outline-none"
                          />
                        </div>
                        <div className="w-1/3">
                          <h4 className="text-[10px] font-bold text-gray-400 uppercase mb-2 tracking-widest">Legislación</h4>
                          <p className="text-[10px] text-gray-500 bg-gray-50 p-2 rounded-lg border border-gray-100">{question?.legislation || 'N/A'}</p>
                        </div>
                      </div>
                      <div>
                        <h4 className="text-[10px] font-bold text-gray-400 uppercase mb-2 tracking-widest">Recomendación Profesional</h4>
                        <textarea 
                          value={resp.finding.recommendation}
                          onChange={(e) => {
                            const newResponses = [...session.responses];
                            newResponses[idx].finding.recommendation = e.target.value;
                            setSession({...session, responses: newResponses});
                          }}
                          className="w-full p-3 bg-brand-green/5 text-brand-green-dark rounded-xl text-sm border border-brand-green/10 font-medium focus:ring-1 focus:ring-brand-green/20 outline-none"
                        />
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>

            <div className="space-y-6">
              <div className="bg-white rounded-2xl p-8 border border-gray-200 sticky top-8 shadow-sm">
                <h3 className="text-lg font-bold mb-6">Scorecard de Cumplimiento</h3>
                <div className="space-y-6">
                  <div>
                    <div className="flex justify-between text-xs mb-2">
                      <span className="text-gray-400">Puntuación Global</span>
                      <span className="font-bold text-gray-900">65.4%</span>
                    </div>
                    <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-brand-green w-[65.4%]" />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-brand-green/5 rounded-xl border border-brand-green/10 text-center">
                      <div className="text-2xl font-bold text-brand-green">12</div>
                      <div className="text-[9px] font-bold text-brand-green uppercase tracking-widest">Fortalezas</div>
                    </div>
                    <div className="p-4 bg-amber-50 rounded-xl border border-amber-100 text-center">
                      <div className="text-2xl font-bold text-amber-600">8</div>
                      <div className="text-[9px] font-bold text-amber-600 uppercase tracking-widest">Brechas</div>
                    </div>
                  </div>

                  <div className="pt-6 border-t border-gray-100">
                    <button className="w-full py-4 bg-gray-900 text-white rounded-xl font-bold hover:bg-gray-800 transition-all flex items-center justify-center gap-2 text-sm shadow-xl shadow-gray-900/10">
                      Borrador Informe <FileText className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    }

    if (diagnosisStep === 'action_plan') {
      const handleSaveActionPlan = async () => {
        if (!session) return;
        
        // Recopilar acciones de los inputs (simplificado para el demo)
        const actions = session.responses.filter(r => r.score < 75).map(resp => {
          const activeQuestions = questions.length > 0 ? questions : PSM_QUESTIONS;
          const question = activeQuestions.find(q => q.id === resp.questionId);
          let suggestedAction = "";
          if (resp.score >= 50) suggestedAction = question?.action_plan_scarce;
          else if (resp.score >= 1) suggestedAction = question?.action_plan_at_least_one;
          else suggestedAction = question?.action_plan_none;

          return {
            questionId: resp.questionId,
            actionText: suggestedAction || "Definir acción correctiva...",
            priority: "Alta", // Default
            status: "Pendiente",
            responsible: "Por definir",
            deadline: new Date().toISOString().split('T')[0]
          };
        });

        try {
          const res = await fetch(`/api/sessions/${session.id}/actions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ actions })
          });
          if (res.ok) {
            alert('Plan de Acción guardado exitosamente.');
            setView('home');
          }
        } catch (err) {
          console.error("Error saving action plan", err);
        }
      };

      return (
        <div className="max-w-6xl mx-auto py-12 px-8">
          <Header 
            title="Plan de Acción" 
            subtitle={`Medidas de mitigación para ${session?.installationName}`}
            onBack={() => setDiagnosisStep('validation')}
          />

          <div className="grid grid-cols-1 gap-6">
            {session?.responses.filter(r => r.score < 75).map((resp, idx) => {
              const activeQuestions = questions.length > 0 ? questions : PSM_QUESTIONS;
              const question = activeQuestions.find(q => q.id === resp.questionId);
              
              // Sugerir acción según score
              let suggestedAction = "";
              if (resp.score >= 50) suggestedAction = question?.action_plan_scarce;
              else if (resp.score >= 1) suggestedAction = question?.action_plan_at_least_one;
              else suggestedAction = question?.action_plan_none;

              return (
                <motion.div 
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  key={resp.questionId}
                  className="bg-white rounded-2xl p-8 border border-gray-200 shadow-sm"
                >
                  <div className="flex items-center gap-3 mb-4">
                    <span className="px-2 py-0.5 bg-red-50 text-red-600 rounded text-[9px] font-bold uppercase tracking-widest">Brecha Detectada</span>
                    <h4 className="font-bold text-gray-900">{question?.text}</h4>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-4">
                      <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest">Acción de Mitigación</label>
                      <textarea 
                        defaultValue={suggestedAction || "Definir acción correctiva..."}
                        className="w-full h-32 p-4 rounded-xl border border-gray-100 focus:ring-2 focus:ring-brand-green/20 outline-none text-sm"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-4">
                        <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest">Prioridad</label>
                        <select className="w-full p-3 rounded-xl border border-gray-100 text-sm">
                          <option value="Alta">Alta</option>
                          <option value="Media">Media</option>
                          <option value="Baja">Baja</option>
                        </select>
                      </div>
                      <div className="space-y-4">
                        <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest">Plazo</label>
                        <input type="date" className="w-full p-3 rounded-xl border border-gray-100 text-sm" />
                      </div>
                      <div className="col-span-2 space-y-4">
                        <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest">Responsable</label>
                        <input placeholder="Cargo o nombre..." className="w-full p-3 rounded-xl border border-gray-100 text-sm" />
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>

          <div className="mt-12 flex justify-center">
            <button 
              onClick={handleSaveActionPlan}
              className="px-12 py-4 bg-gray-900 text-white rounded-2xl font-bold text-lg hover:bg-gray-800 shadow-2xl shadow-gray-900/20"
            >
              Finalizar y Guardar Plan de Acción
            </button>
          </div>
        </div>
      );
    }
  };

  const ConfigView = () => {
    const [editingItem, setEditingItem] = useState<any>(null);

    const handleSaveQuestion = async (q: any) => {
      try {
        const res = await fetch('/api/questions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(q)
        });
        if (res.ok) {
          fetchQuestions();
          setEditingItem(null);
        }
      } catch (err) { console.error(err); }
    };

    const handleDeleteQuestion = async (id: string) => {
      if (!confirm('¿Eliminar pregunta?')) return;
      try {
        const res = await fetch(`/api/questions/${id}`, { method: 'DELETE' });
        if (res.ok) fetchQuestions();
      } catch (err) { console.error(err); }
    };

    const handleSaveUser = async (u: any) => {
      try {
        const res = await fetch('/api/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(u)
        });
        if (res.ok) {
          fetchUsers();
          setEditingItem(null);
        }
      } catch (err) { console.error(err); }
    };

    const handleSaveCriteria = async (c: any) => {
      try {
        const res = await fetch('/api/criteria', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(c)
        });
        if (res.ok) {
          fetchCriteria();
          setEditingItem(null);
        }
      } catch (err) { console.error(err); }
    };

    if (!isAdmin) {
      return (
        <div className="max-w-4xl mx-auto py-24 text-center">
          <ShieldCheck className="w-16 h-16 text-gray-200 mx-auto mb-6" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Acceso Restringido</h2>
          <p className="text-gray-500">Solo los administradores pueden gestionar las variables del sistema.</p>
          <button onClick={() => setView('home')} className="mt-8 px-6 py-2 bg-gray-900 text-white rounded-xl font-bold">Volver al Inicio</button>
        </div>
      );
    }

    return (
      <div className="max-w-6xl mx-auto py-12 px-8">
        <Header 
          title="Consola de Administración" 
          subtitle="Gestión de variables críticas, lógica de IA y parámetros normativos."
          onBack={() => setView('home')}
        />

        <div className="flex gap-2 mb-8 bg-white p-1 rounded-2xl border border-gray-100 w-fit overflow-x-auto">
          {[
            { id: 'logic', label: 'Lógica IA', icon: MessageSquare },
            { id: 'questions', label: 'Matriz de Preguntas', icon: ClipboardCheck },
            { id: 'criteria', label: 'Criterios de Puntuación', icon: TrendingUp },
            { id: 'users', label: 'Usuarios', icon: Users },
            { id: 'infra', label: 'Infraestructura', icon: Settings }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => { setActiveConfigTab(tab.id as any); setEditingItem(null); }}
              className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${
                activeConfigTab === tab.id 
                ? 'bg-gray-900 text-white shadow-lg' 
                : 'text-gray-500 hover:bg-gray-50'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-8">
          {activeConfigTab === 'logic' && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-white rounded-2xl p-8 border border-gray-200 shadow-sm">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-bold">System Prompt (Cerebro del Agente)</h3>
                <button 
                  onClick={saveConfig}
                  disabled={isSavingConfig}
                  className="px-6 py-2 bg-brand-green text-white rounded-xl font-bold text-sm hover:bg-brand-green-dark transition-all disabled:opacity-50"
                >
                  {isSavingConfig ? 'Guardando...' : 'Guardar Cambios'}
                </button>
              </div>
              <textarea 
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
                className="w-full h-[500px] p-6 rounded-xl border border-gray-200 font-mono text-sm leading-relaxed focus:ring-2 focus:ring-brand-green/20 outline-none bg-gray-50/50"
              />
            </motion.div>
          )}

          {activeConfigTab === 'questions' && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-bold">Matriz de 188 Preguntas Normativas</h3>
                <button 
                  onClick={() => setEditingItem({ id: '', text: '', category: '', applicable_levels: [1,2,3,4,5] })}
                  className="px-4 py-2 bg-gray-900 text-white rounded-xl text-sm font-bold flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" /> Nueva Pregunta
                </button>
              </div>

              {editingItem && activeConfigTab === 'questions' && (
                <div className="bg-gray-50 p-6 rounded-2xl border border-gray-200 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <input 
                      placeholder="Código (ej: PSM-001)" 
                      value={editingItem.id} 
                      onChange={e => setEditingItem({...editingItem, id: e.target.value})}
                      className="px-4 py-2 rounded-lg border border-gray-200 outline-none"
                    />
                    <input 
                      placeholder="Categoría" 
                      value={editingItem.category} 
                      onChange={e => setEditingItem({...editingItem, category: e.target.value})}
                      className="px-4 py-2 rounded-lg border border-gray-200 outline-none"
                    />
                  </div>
                  <textarea 
                    placeholder="Texto de la pregunta..." 
                    value={editingItem.text} 
                    onChange={e => setEditingItem({...editingItem, text: e.target.value})}
                    className="w-full px-4 py-2 rounded-lg border border-gray-200 outline-none h-24"
                  />
                  <div className="flex justify-end gap-3">
                    <button onClick={() => setEditingItem(null)} className="px-4 py-2 text-gray-500 font-bold">Cancelar</button>
                    <button onClick={() => handleSaveQuestion(editingItem)} className="px-6 py-2 bg-brand-green text-white rounded-xl font-bold">Guardar Pregunta</button>
                  </div>
                </div>
              )}

              <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                <table className="w-full text-left text-sm">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                      <th className="px-6 py-4 font-bold text-gray-400 uppercase text-[10px]">ID</th>
                      <th className="px-6 py-4 font-bold text-gray-400 uppercase text-[10px]">Pregunta</th>
                      <th className="px-6 py-4 font-bold text-gray-400 uppercase text-[10px]">Categoría</th>
                      <th className="px-6 py-4 font-bold text-gray-400 uppercase text-[10px]">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {questions.map(q => (
                      <tr key={q.id} className="hover:bg-gray-50/50 transition-colors">
                        <td className="px-6 py-4 font-mono text-xs text-gray-400">{q.id}</td>
                        <td className="px-6 py-4 font-medium text-gray-900">{q.text}</td>
                        <td className="px-6 py-4"><span className="px-2 py-1 bg-gray-100 rounded text-[10px] font-bold text-gray-500">{q.category}</span></td>
                        <td className="px-6 py-4">
                          <div className="flex gap-2">
                            <button onClick={() => setEditingItem(q)} className="p-1.5 hover:bg-white rounded border border-transparent hover:border-gray-200"><Eye className="w-4 h-4 text-gray-400" /></button>
                            <button onClick={() => handleDeleteQuestion(q.id)} className="p-1.5 hover:bg-white rounded border border-transparent hover:border-gray-200"><Trash2 className="w-4 h-4 text-red-400" /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </motion.div>
          )}

          {activeConfigTab === 'criteria' && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
              <h3 className="text-lg font-bold">Criterios de Efectividad y Puntuación</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {criteria.map(c => (
                  <div key={c.id} className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
                    <div className="flex justify-between items-start mb-4">
                      <h4 className="font-bold text-gray-900">{c.level_name}</h4>
                      <span className="px-3 py-1 bg-brand-green/10 text-brand-green rounded-full text-xs font-bold">{c.min_score}% - {c.max_score}%</span>
                    </div>
                    <p className="text-sm text-gray-500 mb-6 leading-relaxed">{c.description}</p>
                    <button 
                      onClick={() => setEditingItem(c)}
                      className="text-xs font-bold text-gray-400 hover:text-brand-green transition-colors"
                    >
                      Editar Parámetros
                    </button>
                  </div>
                ))}
              </div>

              {editingItem && activeConfigTab === 'criteria' && (
                <div className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                  <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl">
                    <h3 className="text-xl font-bold mb-6">Editar Criterio</h3>
                    <div className="space-y-4">
                      <input value={editingItem.level_name} onChange={e => setEditingItem({...editingItem, level_name: e.target.value})} className="w-full px-4 py-2 rounded-xl border border-gray-200" placeholder="Nombre del Nivel" />
                      <div className="grid grid-cols-2 gap-4">
                        <input type="number" value={editingItem.min_score} onChange={e => setEditingItem({...editingItem, min_score: parseInt(e.target.value)})} className="px-4 py-2 rounded-xl border border-gray-200" placeholder="Min %" />
                        <input type="number" value={editingItem.max_score} onChange={e => setEditingItem({...editingItem, max_score: parseInt(e.target.value)})} className="px-4 py-2 rounded-xl border border-gray-200" placeholder="Max %" />
                      </div>
                      <textarea value={editingItem.description} onChange={e => setEditingItem({...editingItem, description: e.target.value})} className="w-full px-4 py-2 rounded-xl border border-gray-200 h-32" placeholder="Descripción técnica..." />
                    </div>
                    <div className="flex justify-end gap-3 mt-8">
                      <button onClick={() => setEditingItem(null)} className="px-4 py-2 font-bold text-gray-400">Cancelar</button>
                      <button onClick={() => handleSaveCriteria(editingItem)} className="px-8 py-2 bg-gray-900 text-white rounded-xl font-bold">Guardar</button>
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {activeConfigTab === 'users' && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-bold">Gestión de Consultores y Expertos</h3>
                <button 
                  onClick={() => setEditingItem({ id: '', name: '', email: '', role: 'consultant' })}
                  className="px-4 py-2 bg-gray-900 text-white rounded-xl text-sm font-bold flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" /> Agregar Usuario
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {users.map(u => (
                  <div key={u.id} className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm flex items-center gap-4">
                    <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center text-gray-400">
                      <Users className="w-6 h-6" />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-bold text-gray-900">{u.name}</h4>
                      <p className="text-xs text-gray-400">{u.email}</p>
                      <span className={`inline-block mt-2 px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-widest ${u.role === 'admin' ? 'bg-purple-100 text-purple-600' : 'bg-blue-100 text-blue-600'}`}>
                        {u.role}
                      </span>
                    </div>
                    <button onClick={() => setEditingItem(u)} className="p-2 hover:bg-gray-50 rounded-lg"><Eye className="w-4 h-4 text-gray-300" /></button>
                  </div>
                ))}
              </div>

              {editingItem && activeConfigTab === 'users' && (
                <div className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                  <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl">
                    <h3 className="text-xl font-bold mb-6">Gestionar Usuario</h3>
                    <div className="space-y-4">
                      <input value={editingItem.name} onChange={e => setEditingItem({...editingItem, name: e.target.value})} className="w-full px-4 py-2 rounded-xl border border-gray-200" placeholder="Nombre Completo" />
                      <input value={editingItem.email} onChange={e => setEditingItem({...editingItem, email: e.target.value})} className="w-full px-4 py-2 rounded-xl border border-gray-200" placeholder="Email" />
                      <select value={editingItem.role} onChange={e => setEditingItem({...editingItem, role: e.target.value})} className="w-full px-4 py-2 rounded-xl border border-gray-200">
                        <option value="consultant">Consultor</option>
                        <option value="admin">Administrador</option>
                        <option value="viewer">Visualizador</option>
                      </select>
                    </div>
                    <div className="flex justify-end gap-3 mt-8">
                      <button onClick={() => setEditingItem(null)} className="px-4 py-2 font-bold text-gray-400">Cancelar</button>
                      <button onClick={() => handleSaveUser(editingItem)} className="px-8 py-2 bg-gray-900 text-white rounded-xl font-bold">Guardar</button>
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          )}
          {activeConfigTab === 'infra' && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
              <div className="bg-white rounded-2xl p-8 border border-gray-200 shadow-sm">
                <h3 className="text-lg font-bold mb-6">Estado de la Infraestructura</h3>
                <div className="space-y-6">
                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-100">
                    <div>
                      <h4 className="font-bold text-gray-900">Base de Datos (PostgreSQL)</h4>
                      <p className="text-xs text-gray-500">Conexión principal para persistencia de datos.</p>
                    </div>
                    <button 
                      onClick={testDbConnection}
                      className="px-6 py-2 bg-gray-900 text-white rounded-xl font-bold text-sm hover:bg-gray-800 transition-all"
                    >
                      Probar Conexión
                    </button>
                  </div>

                  {dbStatus && (
                    <motion.div 
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className={`p-6 rounded-2xl border ${
                        dbStatus.status === 'success' ? 'bg-emerald-50 border-emerald-100' : 
                        dbStatus.status === 'loading' ? 'bg-blue-50 border-blue-100' : 
                        'bg-red-50 border-red-100'
                      }`}
                    >
                      <div className="flex items-start gap-4">
                        {dbStatus.status === 'success' ? (
                          <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" />
                        ) : dbStatus.status === 'loading' ? (
                          <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin shrink-0" />
                        ) : (
                          <AlertCircle className="w-6 h-6 text-red-600 shrink-0" />
                        )}
                        <div className="flex-1">
                          <h5 className={`font-bold mb-1 ${
                            dbStatus.status === 'success' ? 'text-emerald-900' : 
                            dbStatus.status === 'loading' ? 'text-blue-900' : 
                            'text-red-900'
                          }`}>
                            {dbStatus.status === 'success' ? 'Conexión Exitosa' : 
                             dbStatus.status === 'loading' ? 'Verificando...' : 
                             'Error de Conexión'}
                          </h5>
                          <p className={`text-sm ${
                            dbStatus.status === 'success' ? 'text-emerald-700' : 
                            dbStatus.status === 'loading' ? 'text-blue-700' : 
                            'text-red-700'
                          }`}>
                            {dbStatus.message}
                          </p>
                          {dbStatus.database_url && (
                            <div className="mt-4 p-3 bg-white/50 rounded-lg border border-current/10 font-mono text-[10px] break-all">
                              URL: {dbStatus.database_url}
                            </div>
                          )}
                          {dbStatus.data && (
                            <div className="mt-2 text-[10px] font-mono opacity-60">
                              Server Time: {dbStatus.data.time} | DB: {dbStatus.data.db}
                            </div>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </div>
      </div>
    );
  };

  return (
    <Layout>
      <AnimatePresence mode="wait">
        {view === 'home' && (
          <motion.div 
            key="home"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            <HomeView />
          </motion.div>
        )}
        {view === 'diagnosis' && (
          <motion.div 
            key="diagnosis"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
          >
            <DiagnosisView />
          </motion.div>
        )}
        {view === 'config' && (
          <motion.div 
            key="config"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
          >
            <ConfigView />
          </motion.div>
        )}
      </AnimatePresence>
    </Layout>
  );
}
