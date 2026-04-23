// ── TeacherCard ──────────────────────────────────────────────
import StatusBadge from './StatusBadge';

export default function TeacherCard({ maestro, onLlamar, calling, globalCallActive, llamador }) {
  const isDisponible = maestro.estado === 'disponible';

  // Iniciales del nombre para el avatar
  const initials = (maestro.nombre || 'NN')
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <div
      className="group bg-white rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow duration-300 overflow-hidden"
      style={{ animationDelay: `${(maestro._index || 0) * 80}ms` }}
    >
      <div className="p-5">
        {/* Cabecera: Avatar + Info */}
        <div className="flex items-start gap-4">
          {/* Avatar con gradiente premium */}
          <div className={`
            shrink-0 w-14 h-14 rounded-2xl flex items-center justify-center text-white font-bold text-lg
            ${isDisponible
              ? 'bg-gradient-to-tr from-ulsa-green to-ulsa-emerald shadow-lg shadow-ulsa-green/30'
              : maestro.estado === 'ocupado'
                ? 'bg-gradient-to-tr from-rose-500 to-ulsa-coral shadow-lg shadow-red-500/30'
                : 'bg-gradient-to-tr from-gray-400 to-gray-300 shadow-lg shadow-gray-400/30'
            }
          `}>
            {initials}
          </div>

          {/* Nombre + Departamento */}
          <div className="flex-1 min-w-0 pr-2">
            <h3 className="font-bold text-ulsa-carbon text-[17px] truncate leading-tight group-hover:text-ulsa-green transition-colors">
              {maestro.nombre}
            </h3>
            {maestro.departamento && (
              <p className="text-xs font-semibold text-gray-400 mt-0.5 truncate tracking-wide">
                {maestro.departamento}
              </p>
            )}
            <div className="mt-2 space-y-1.5">
              <StatusBadge estado={maestro.estado} />
              {maestro.estado !== 'disponible' && maestro.comentario && (
                <p className="flex items-center gap-1.5 text-[11px] text-gray-400 italic pl-0.5">
                  <svg className="w-3 h-3 shrink-0 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                  <span className="truncate">{maestro.comentario}</span>
                </p>
              )}
            </div>
            
            {/* Llamador Entrante (Visible Públicamente) */}
            {llamador && (
              <div className="mt-3 bg-blue-50/70 rounded-xl p-2.5 border border-blue-100 flex items-center gap-2 animate-fade-up" style={{ animationDuration: '0.4s' }}>
                <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse shrink-0 shadow-[0_0_8px_rgba(59,130,246,0.5)]"></span>
                <p className="text-[11px] text-blue-900 truncate">
                  <span className="opacity-70">Llamada: </span>
                  <span className="font-bold uppercase tracking-wide">{llamador}</span>
                </p>
              </div>
            )}
            
          </div>
        </div>

        {/* Botón de Llamar Premium */}
        <div className="mt-6">
          <button
            id={`btn-llamar-${maestro.id}`}
            onClick={() => isDisponible && !globalCallActive && onLlamar(maestro)}
            disabled={!isDisponible || calling || (globalCallActive && !calling)}
            className={`
              w-full py-3.5 rounded-2xl text-sm font-bold tracking-wide transition-all duration-300 
              flex items-center justify-center gap-2 cursor-pointer
              ${isDisponible && !calling && !globalCallActive
                ? 'bg-gradient-to-r from-ulsa-green to-ulsa-emerald text-white shadow-xl shadow-ulsa-green/30 hover:shadow-2xl hover:shadow-ulsa-green/40 hover:-translate-y-0.5 active:scale-95'
                : 'bg-white/50 text-gray-400 cursor-not-allowed border border-white/40 shadow-sm'
              }
            `}
          >
          {calling ? (
            <>
              <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
              </svg>
              Llamando...
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              {isDisponible ? 'Llamar' : 'No disponible'}
            </>
          )}
          </button>
        </div>
      </div>
    </div>
  );
}
