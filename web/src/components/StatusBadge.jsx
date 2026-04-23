// ── StatusBadge ──────────────────────────────────────────────
// Renderiza una pill con color e ícono según el estado del maestro

const STATUS_CONFIG = {
  disponible: {
    label: 'Disponible',
    bg: 'bg-emerald-50/80 backdrop-blur-sm',
    text: 'text-emerald-700',
    dot: 'bg-ulsa-emerald',
    ring: 'ring-emerald-200/60',
    pulse: true,
  },
  ocupado: {
    label: 'Ocupado',
    bg: 'bg-red-50/80 backdrop-blur-sm',
    text: 'text-red-600',
    dot: 'bg-ulsa-coral',
    ring: 'ring-red-200/60',
    pulse: false,
  },
};

export default function StatusBadge({ estado }) {
  const cfg = STATUS_CONFIG[estado] || STATUS_CONFIG.ocupado;

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ring-1 ${cfg.bg} ${cfg.text} ${cfg.ring}`}
    >
      <span className="relative flex h-2 w-2">
        {cfg.pulse && (
          <span className={`animate-pulse-dot absolute inline-flex h-full w-full rounded-full ${cfg.dot} opacity-60`}></span>
        )}
        <span className={`relative inline-flex rounded-full h-2 w-2 ${cfg.dot}`}></span>
      </span>
      {cfg.label}
    </span>
  );
}
