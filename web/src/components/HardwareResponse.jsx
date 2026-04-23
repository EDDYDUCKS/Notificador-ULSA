// ── HardwareResponse ─────────────────────────────────────────
// Barra de estado que muestra la última respuesta del hardware
// y el maestro solicitado

const RESPUESTA_MAP = {
  en_espera: {
    label: 'En espera',
    icon: '⏳',
    classes: 'bg-amber-50 text-amber-700 border-amber-200',
  },
  voy_en_camino: {
    label: 'Voy en camino',
    icon: '✅',
    classes: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  },
  ocupado: {
    label: 'Ocupado',
    icon: '🚫',
    classes: 'bg-red-50 text-red-600 border-red-200',
  },
};

export default function HardwareResponse({ respuesta, maestro }) {
  if (!maestro) return null;

  const cfg = RESPUESTA_MAP[respuesta] || RESPUESTA_MAP.en_espera;

  return (
    <div className={`flex items-center gap-3 px-4 py-3 rounded-2xl border transition-all duration-300 ${cfg.classes}`}>
      <span className="text-lg">{cfg.icon}</span>
      <div className="flex-1 min-w-0">
        <p className="text-[11px] font-medium opacity-70 leading-none">Última respuesta</p>
        <p className="text-sm font-semibold truncate mt-0.5">
          {maestro}: <span className="font-bold">{cfg.label}</span>
        </p>
      </div>
    </div>
  );
}
