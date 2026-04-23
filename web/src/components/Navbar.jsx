// ── Navbar ────────────────────────────────────────────────────
export default function Navbar({ onTogglePanel }) {
  return (
    <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-lg border-b border-gray-200/60 shadow-sm">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
        {/* Logo + Nombre */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-ulsa-green to-ulsa-green-light flex items-center justify-center shadow-md shadow-ulsa-green/25">
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
          </div>
          <div>
            <h1 className="text-base font-bold text-ulsa-carbon leading-tight">
              Notificador ULSA
            </h1>
            <p className="text-[11px] text-ulsa-silver font-medium tracking-wide">
              Sistema de Catedráticos
            </p>
          </div>
        </div>

        {/* Acciones */}
        <div className="flex items-center gap-3">
          {/* Botón Soy Maestro */}
          <button
            id="btn-soy-maestro"
            onClick={onTogglePanel}
            className="flex items-center gap-2 bg-gradient-to-r from-ulsa-green to-ulsa-green-light text-white rounded-full px-4 py-2 text-xs font-bold shadow-md shadow-ulsa-green/20 hover:shadow-lg hover:shadow-ulsa-green/30 active:scale-[0.96] transition-all cursor-pointer"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            Soy Maestro
          </button>

          {/* Indicador en vivo */}
          <div className="flex items-center gap-2 bg-ulsa-smoke rounded-full px-3 py-1.5">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-ulsa-emerald opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-ulsa-emerald"></span>
            </span>
            <span className="text-xs font-semibold text-ulsa-carbon-light">En vivo</span>
          </div>
        </div>
      </div>
    </nav>
  );
}
