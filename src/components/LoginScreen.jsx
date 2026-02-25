import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import apiService from '../services/apiService';
import skudoLogo from '../../img/Skudo Logo.svg';

const ROLE_LABELS = {
  SuperAdmin:     'Super Administrador',
  Consultor:      'Consultor Externo',
  AdminInquilino: 'Administrador de Empresa',
  Auditor:        'Auditor',
  Lector:         'Lector',
};

export default function LoginScreen() {
  const { login } = useAuth();
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const data = await apiService.login(email.trim(), password);
      login(data.token, data.usuario);
    } catch (err) {
      setError(err.message || 'Credenciales incorrectas. Verifica e intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-green-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">

        {/* Logo / Brand */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white shadow-lg border border-gray-100 mb-4">
            <img src={skudoLogo} alt="Skudo" className="w-10 h-10" />
          </div>
          <h1 className="text-3xl font-black text-gray-900 tracking-tight">SKUDO</h1>
          <p className="text-gray-500 text-sm mt-1">
            Plataforma de Seguridad de Procesos · PSM
          </p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
          <h2 className="text-xl font-bold text-gray-800 mb-6">Iniciar sesión</h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Correo electrónico
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                autoFocus
                className="w-full px-4 py-3 rounded-xl border border-gray-200 text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-shadow"
                placeholder="usuario@empresa.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Contraseña
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                className="w-full px-4 py-3 rounded-xl border border-gray-200 text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-shadow"
                placeholder="••••••••"
              />
            </div>

            {error && (
              <div className="flex items-start gap-2.5 bg-rose-50 border border-rose-200 rounded-xl px-4 py-3">
                <span className="text-rose-500 shrink-0 mt-0.5">✖</span>
                <p className="text-sm text-rose-700">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl bg-green-600 hover:bg-green-700 text-white font-semibold text-sm transition-colors shadow-sm disabled:opacity-60 disabled:cursor-not-allowed mt-2"
            >
              {loading ? 'Verificando credenciales...' : 'Ingresar al sistema'}
            </button>
          </form>
        </div>

        {/* Roles hint */}
        <div className="mt-4 p-4 bg-white/60 rounded-xl border border-gray-100">
          <p className="text-xs text-gray-500 font-medium mb-2">Roles del sistema:</p>
          <div className="flex flex-wrap gap-1.5">
            {Object.values(ROLE_LABELS).map((label) => (
              <span
                key={label}
                className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded-md text-xs"
              >
                {label}
              </span>
            ))}
          </div>
        </div>

        <p className="text-center text-xs text-gray-400 mt-4">
          SKUDO PSM v2.0 · Multi-tenant · RBAC
        </p>
      </div>
    </div>
  );
}
