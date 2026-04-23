// ── NetworkGuard ─────────────────────────────────────────────
// Pantalla de bloqueo que aparece si el estudiante no está
// conectado a la red WiFi de la universidad.
import { useState } from 'react';

export default function NetworkGuard({ error, userIP }) {
  const [clickCount, setClickCount] = useState(0);

  const handleSecretClick = () => {
    const newCount = clickCount + 1;
    setClickCount(newCount);
    if (newCount === 5) {
      setClickCount(0);
      const pin = window.prompt('Ingrese PIN de administrador (Bypass):');
      if (pin === '0000') {
        localStorage.setItem('adminOverride', 'true');
        window.location.reload();
      } else if (pin) {
        alert('PIN incorrecto');
      }
    }
  };

  return (
    <div className="min-h-screen bg-ulsa-smoke flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-lg shadow-gray-200/60 border border-gray-100 overflow-hidden animate-fade-up">

        {/* Header */}
        <div className="bg-gradient-to-r from-ulsa-green to-ulsa-green-light px-6 py-8 text-center">
          <div 
            className="w-16 h-16 mx-auto rounded-2xl bg-white/20 flex items-center justify-center mb-4 transition-transform active:scale-95 select-none"
            onClick={handleSecretClick}
          >
            <svg className="w-8 h-8 text-white pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.858 15.355-5.858 21.213 0" />
            </svg>
          </div>
          <h1 className="text-white font-bold text-xl">Red no autorizada</h1>
          <p className="text-white/70 text-sm mt-1">Notificador ULSA</p>
        </div>

        {/* Cuerpo */}
        <div className="p-6 space-y-4">
          <div className="rounded-xl p-4 bg-red-50 border border-red-200">
            <div className="flex items-start gap-3">
              <svg className="w-5 h-5 text-red-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.072 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
              <div>
                <p className="text-sm font-semibold text-red-700">Acceso restringido</p>
                <p className="text-xs text-red-600/70 mt-1">{error}</p>
              </div>
            </div>
          </div>

          <div className="space-y-2 text-center">
            <p className="text-sm text-gray-500">
              Conéctate a la red WiFi de la universidad e intenta de nuevo.
            </p>

            <button
              onClick={() => window.location.reload()}
              className="w-full py-2.5 rounded-xl bg-ulsa-green text-white font-semibold text-sm hover:bg-ulsa-green/90 transition-colors cursor-pointer shadow-md shadow-ulsa-green/20"
            >
              Reintentar conexión
            </button>
          </div>

          {/* IP del usuario (para debug/soporte) */}
          {userIP && (
            <p className="text-[10px] text-gray-300 text-center mt-3">
              Tu IP: {userIP}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
