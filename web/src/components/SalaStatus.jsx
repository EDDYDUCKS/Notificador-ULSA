// ── SalaStatus ───────────────────────────────────────────────
// Indicador flotante del sensor PIR de la sala de maestros

export default function SalaStatus({ movimiento }) {
  return (
    <div className={`
      inline-flex items-center gap-2.5 px-4 py-2.5 rounded-2xl border transition-all duration-500
      ${movimiento
        ? 'bg-emerald-50 border-emerald-200 shadow-sm shadow-emerald-100'
        : 'bg-gray-50 border-gray-200 shadow-sm shadow-gray-100'
      }
    `}>
      {/* Ícono de la sala */}
      <div className={`
        w-8 h-8 rounded-lg flex items-center justify-center transition-colors duration-500
        ${movimiento ? 'bg-ulsa-emerald/10' : 'bg-gray-200/60'}
      `}>
        <svg className={`w-4 h-4 transition-colors duration-500 ${movimiento ? 'text-ulsa-emerald' : 'text-gray-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      </div>

      <div>
        <p className="text-[11px] font-medium text-gray-400 leading-none">Sala de Maestros</p>
        <p className={`text-sm font-semibold leading-tight mt-0.5 transition-colors duration-500 ${movimiento ? 'text-ulsa-emerald' : 'text-gray-500'}`}>
          {movimiento ? 'Presencia detectada' : 'Sin actividad'}
        </p>
      </div>

      {/* Dot animado */}
      <span className="relative flex h-2.5 w-2.5 ml-1">
        {movimiento && (
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-ulsa-emerald opacity-75"></span>
        )}
        <span className={`relative inline-flex rounded-full h-2.5 w-2.5 transition-colors duration-500 ${movimiento ? 'bg-ulsa-emerald' : 'bg-gray-300'}`}></span>
      </span>
    </div>
  );
}
