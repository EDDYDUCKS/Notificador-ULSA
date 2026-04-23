// ── CallPanel ────────────────────────────────────────────────
// Modal/panel que aparece cuando hay una llamada activa, muestra
// la respuesta del hardware en tiempo real

const RESPUESTA_CONFIG = {
  pendiente: {
    icon: '📋',
    label: 'En fila de espera...',
    color: 'text-blue-600',
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    sublabel: 'Calculando turno...',
  },
  notificando: {
    icon: '🔊',
    label: 'Llamando en sala de maestros...',
    color: 'text-amber-600',
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    sublabel: 'Esperando respuesta del catedrático',
  },
  voy_en_camino: {
    icon: '🟢',
    label: '¡El catedrático va en camino!',
    color: 'text-ulsa-green',
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
    sublabel: 'Ha presionado el botón verde de confirmación',
  },
  ocupado: {
    icon: '🔴',
    label: 'El catedrático está ocupado',
    color: 'text-red-600',
    bg: 'bg-red-50',
    border: 'border-red-200',
    sublabel: 'Ha presionado el botón rojo. Intenta más tarde',
  },
  timeout: {
    icon: '⏱️',
    label: 'Tiempo agotado',
    color: 'text-gray-600',
    bg: 'bg-gray-100',
    border: 'border-gray-300',
    sublabel: 'El catedrático no respondió o no se encuentra cerca.',
  }
};

export default function CallPanel({ queueId, colas, turno_esp32, visible, onHide, onRelease, onCancel }) {
  if (!visible) return null;

  const miLlamada = colas && queueId ? colas[`ll_${queueId}`] : null;
  if (!miLlamada) return null;

  const respuestaHW = miLlamada.estado;
  
  // Calcular turnos reales por delante, ignorando llamadas canceladas o terminadas
  const turnosPorDelante = Object.keys(colas || {}).reduce((count, key) => {
    const id = parseInt(key.replace('ll_', ''), 10);
    // Contar los tickets que están entre el turno actual que atiende la ESP32 y el ticket del usuario
    if (!isNaN(id) && id >= turno_esp32 && id < queueId) {
      const state = colas[key]?.estado;
      if (state === 'pendiente' || state === 'notificando') {
        return count + 1;
      }
    }
    return count;
  }, 0);

  let cfg = { ...(RESPUESTA_CONFIG[respuestaHW] || RESPUESTA_CONFIG.pendiente) };

  if (respuestaHW === 'pendiente') {
    cfg.sublabel = turnosPorDelante > 0 
      ? `Hay ${turnosPorDelante} persona(s) antes de ti en la fila.` 
      : 'Eres el siguiente en la fila de llamadas.';
  }

  const respondido = respuestaHW === 'voy_en_camino' || respuestaHW === 'ocupado' || respuestaHW === 'timeout';

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center">
      {/* Overlay — solo se cierra tocando afuera si ya hay respuesta */}
      <div
        className={`absolute inset-0 bg-black/40 backdrop-blur-sm animate-fade-in ${respondido ? 'cursor-pointer' : ''}`}
        onClick={() => respondido ? onRelease() : null}
      />

      {/* Panel */}
      <div className="relative w-full max-w-md mx-4 mb-4 sm:mb-0 bg-white rounded-2xl shadow-2xl overflow-hidden animate-slide-up">
        {/* Header estandar */}
        <div className="bg-ulsa-green px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white/80 text-xs font-medium">Estado de solicitud</p>
              <h2 className="text-white font-bold text-lg leading-tight">{miLlamada.maestro_solicitado}</h2>
            </div>
            {/* Botón X para cerrar (solo visible si ya hay respuesta) */}
            {respondido && (
              <button
                onClick={onRelease}
                className="w-8 h-8 rounded-lg bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors cursor-pointer"
                aria-label="Cerrar"
              >
                <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Cuerpo — estado de respuesta */}
        <div className="p-6">
          <div className={`rounded-xl p-4 border ${cfg.bg} ${cfg.border}`}>
            <div className="flex items-center gap-3">
              <span className="text-2xl">{cfg.icon}</span>
              <div>
                <p className={`font-semibold text-sm ${cfg.color}`}>{cfg.label}</p>
                <p className="text-xs text-gray-400 mt-0.5">{cfg.sublabel}</p>
              </div>
            </div>
          </div>

          {/* Spinner + Cancelar si aún espera */}
          {(!respondido) && (
            <>
              <div className="flex justify-center mt-6">
                <div className="w-10 h-10 border-[3px] border-gray-200 border-t-ulsa-green rounded-full animate-spin"></div>
              </div>
              <button
                id="btn-cancelar-llamada"
                onClick={onCancel}
                className="mt-4 w-full py-2.5 rounded-xl border border-red-200 bg-red-50 text-red-600 font-semibold text-sm hover:bg-red-100 transition-colors cursor-pointer"
              >
                Cancelar solicitud
              </button>
            </>
          )}

          {/* Botón cerrar cuando hay respuesta */}
          {respondido && (
            <button
              id="btn-cerrar-llamada"
              onClick={onRelease}
              className="mt-5 w-full py-2.5 rounded-xl bg-ulsa-smoke text-ulsa-carbon font-semibold text-sm hover:bg-gray-200 transition-colors cursor-pointer"
            >
              Cerrar
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
