// ── TeacherSelfPanel ─────────────────────────────────────────
// Panel flotante para que los maestros actualicen su estado
import { useState, useEffect, useRef } from 'react';

// ── PIN de acceso (cámbialo según tu proyecto) ──
const ACCESS_PIN = '1234';

export default function TeacherSelfPanel({ maestros, colas, onActualizar, visible, onClose }) {
  const [authenticated, setAuthenticated] = useState(false);
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState(false);
  const [selectedId, setSelectedId] = useState('');
  const [isDisponible, setIsDisponible] = useState(true);
  const [comentario, setComentario] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const pinInputRef = useRef(null);

  // Reset al cerrar
  useEffect(() => {
    if (!visible) {
      setAuthenticated(false);
      setPin('');
      setPinError(false);
    }
  }, [visible]);

  // Focus en input de PIN al abrir
  useEffect(() => {
    if (visible && !authenticated && pinInputRef.current) {
      setTimeout(() => pinInputRef.current?.focus(), 100);
    }
  }, [visible, authenticated]);

  // Sincronizar estado cuando se selecciona un maestro
  useEffect(() => {
    if (selectedId) {
      const m = maestros.find((t) => t.id === selectedId);
      if (m) {
        setIsDisponible(m.estado === 'disponible');
        setComentario(m.comentario || '');
      }
    }
  }, [selectedId, maestros]);

  // Auto‑seleccionar el primero si solo hay uno
  useEffect(() => {
    if (maestros.length === 1 && !selectedId) {
      setSelectedId(maestros[0].id);
    }
  }, [maestros, selectedId]);

  const handlePinSubmit = (e) => {
    e.preventDefault();
    if (pin === ACCESS_PIN) {
      setAuthenticated(true);
      setPinError(false);
    } else {
      setPinError(true);
      setPin('');
      setTimeout(() => setPinError(false), 600);
    }
  };

  const handleSave = async () => {
    if (!selectedId) return;
    setSaving(true);
    const nuevoEstado = isDisponible ? 'disponible' : 'ocupado';
    const comentarioFinal = isDisponible ? '' : comentario;
    await onActualizar(selectedId, nuevoEstado, comentarioFinal);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  if (!visible) return null;

  const selected = maestros.find((t) => t.id === selectedId);
  const sugerencias = ['En reunión', 'En clase', 'Fuera de oficina', 'En laboratorio'];

  const misNotificaciones = Object.keys(colas || {})
    .filter(key => {
      const call = colas[key];
      return call.maestro_id === selectedId && (call.estado === 'pendiente' || call.estado === 'notificando');
    })
    .map(key => ({ id: key, ...colas[key] }))
    .sort((a, b) => a.timestamp - b.timestamp);

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/30 backdrop-blur-sm z-[60] animate-fade-in"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[70] w-[calc(100%-2rem)] max-w-md animate-slide-down">
        <div className="bg-white/90 backdrop-blur-xl rounded-2xl shadow-2xl shadow-black/10 border border-white/60 overflow-hidden">

          {/* Header */}
          <div className="bg-gradient-to-r from-ulsa-green to-ulsa-green-light px-5 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  {authenticated ? (
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  )}
                </svg>
              </div>
              <div>
                <h3 className="text-white font-bold text-sm">
                  {authenticated ? 'Panel de Maestro' : 'Acceso Maestros'}
                </h3>
                <p className="text-white/70 text-[11px]">
                  {authenticated ? 'Actualiza tu estado' : 'Ingresa tu PIN de acceso'}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors cursor-pointer"
            >
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* ── PIN Gate ── */}
          {!authenticated ? (
            <form onSubmit={handlePinSubmit} className="p-6 space-y-5">
              <div className="text-center">
                <div className={`w-16 h-16 mx-auto rounded-2xl bg-ulsa-smoke flex items-center justify-center mb-4 ${pinError ? 'animate-shake' : ''}`}>
                  <svg className={`w-8 h-8 ${pinError ? 'text-ulsa-coral' : 'text-ulsa-green'} transition-colors`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <p className="text-sm text-gray-500">
                  Ingresa el PIN para acceder al panel de maestros
                </p>
              </div>

              <div>
                <input
                  ref={pinInputRef}
                  id="input-pin"
                  type="password"
                  inputMode="numeric"
                  maxLength={4}
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                  placeholder="• • • •"
                  className={`w-full px-4 py-3.5 rounded-xl border text-center text-2xl font-bold tracking-[0.5em] transition-all focus:outline-none ${
                    pinError
                      ? 'border-ulsa-coral bg-red-50 text-ulsa-coral focus:ring-2 focus:ring-ulsa-coral/30'
                      : 'border-gray-200 bg-white text-ulsa-carbon focus:ring-2 focus:ring-ulsa-green/30 focus:border-ulsa-green'
                  }`}
                />
                {pinError && (
                  <p className="text-xs text-ulsa-coral font-medium mt-2 text-center animate-fade-in">
                    PIN incorrecto. Intenta de nuevo.
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={pin.length < 4}
                className={`w-full py-3 rounded-xl text-sm font-bold tracking-wide transition-all duration-300 flex items-center justify-center gap-2 cursor-pointer ${
                  pin.length >= 4
                    ? 'bg-gradient-to-r from-ulsa-green to-ulsa-green-light text-white shadow-md shadow-ulsa-green/25 hover:shadow-lg active:scale-[0.97]'
                    : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                }`}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
                </svg>
                Desbloquear
              </button>

              <p className="text-[10px] text-gray-300 text-center">
                Solo para uso de catedráticos autorizados
              </p>
            </form>
          ) : (
            /* ── Panel Content (after auth) ── */
            <>
              <div className="p-5 space-y-5">

                {/* Selector de maestro */}
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-2 tracking-wide uppercase">
                    ¿Quién eres?
                  </label>
                  <select
                    id="select-maestro"
                    value={selectedId}
                    onChange={(e) => {
                      setSelectedId(e.target.value);
                      setSaved(false);
                    }}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm font-medium text-ulsa-carbon focus:outline-none focus:ring-2 focus:ring-ulsa-green/30 focus:border-ulsa-green transition-all"
                  >
                    <option value="">Selecciona tu nombre...</option>
                    {maestros.map((m) => (
                      <option key={m.id} value={m.id}>{m.nombre}</option>
                    ))}
                  </select>
                </div>

                {/* ── Notificaciones de la Fila ── */}
                {selectedId && misNotificaciones.length > 0 && (
                  <div className="animate-fade-up bg-blue-50 p-4 rounded-xl border border-blue-100">
                    <h4 className="text-xs font-bold text-blue-800 uppercase tracking-wide mb-3 flex items-center gap-2">
                       <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
                       Llamadas Entrantes ({misNotificaciones.length})
                    </h4>
                    <ul className="space-y-2 max-h-40 overflow-y-auto pr-1 custom-scrollbar">
                      {misNotificaciones.map(noti => (
                        <li key={noti.id} className="bg-white p-3 rounded-lg shadow-sm border border-blue-50 text-sm flex justify-between items-center">
                           <div>
                             <p className="font-bold text-ulsa-carbon">{noti.estudiante}</p>
                             <p className="text-[10px] text-gray-400">Hace {Math.floor((Date.now() - noti.timestamp) / 60000)} min</p>
                           </div>
                           <span className={`text-[10px] px-2 py-1 rounded-full font-bold uppercase tracking-wider ${noti.estado === 'notificando' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-500'}`}>
                             {noti.estado === 'notificando' ? 'Sonando' : 'En espera'}
                           </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Toggle de estado */}
                {selectedId && (
                  <div className="animate-fade-up" style={{ animationDuration: '0.3s' }}>
                    <label className="block text-xs font-semibold text-gray-500 mb-3 tracking-wide uppercase">
                      Tu estado
                    </label>
                    <div className="flex items-center gap-4 p-4 rounded-xl bg-gray-50 border border-gray-100">
                      <button
                        onClick={() => { setIsDisponible(true); setSaved(false); }}
                        className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all duration-300 cursor-pointer ${
                          isDisponible
                            ? 'bg-gradient-to-r from-ulsa-green to-ulsa-emerald text-white shadow-lg shadow-ulsa-green/25 scale-[1.02]'
                            : 'bg-white text-gray-400 hover:text-gray-600 border border-gray-200'
                        }`}
                      >
                        <span className="flex items-center justify-center gap-2">
                          <span className="relative flex h-2.5 w-2.5">
                            {isDisponible && <span className="animate-pulse-dot absolute inline-flex h-full w-full rounded-full bg-white/60"></span>}
                            <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${isDisponible ? 'bg-white' : 'bg-gray-300'}`}></span>
                          </span>
                          Disponible
                        </span>
                      </button>
                      <button
                        onClick={() => { setIsDisponible(false); setSaved(false); }}
                        className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all duration-300 cursor-pointer ${
                          !isDisponible
                            ? 'bg-gradient-to-r from-red-400 to-ulsa-coral text-white shadow-lg shadow-red-400/25 scale-[1.02]'
                            : 'bg-white text-gray-400 hover:text-gray-600 border border-gray-200'
                        }`}
                      >
                        <span className="flex items-center justify-center gap-2">
                          <span className={`inline-flex rounded-full h-2.5 w-2.5 ${!isDisponible ? 'bg-white' : 'bg-gray-300'}`}></span>
                          No disponible
                        </span>
                      </button>
                    </div>
                  </div>
                )}

                {/* Comentario — solo cuando No disponible */}
                {selectedId && !isDisponible && (
                  <div className="animate-fade-up" style={{ animationDuration: '0.3s' }}>
                    <label className="block text-xs font-semibold text-gray-500 mb-2 tracking-wide uppercase">
                      Motivo (opcional)
                    </label>

                    {/* Sugerencias rápidas */}
                    <div className="flex flex-wrap gap-2 mb-3">
                      {sugerencias.map((s) => (
                        <button
                          key={s}
                          onClick={() => { setComentario(s); setSaved(false); }}
                          className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                            comentario === s
                              ? 'bg-ulsa-coral/10 text-ulsa-coral ring-1 ring-ulsa-coral/30'
                              : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                          }`}
                        >
                          {s}
                        </button>
                      ))}
                    </div>

                    <input
                      id="input-comentario"
                      type="text"
                      value={comentario}
                      onChange={(e) => { setComentario(e.target.value); setSaved(false); }}
                      placeholder="Ej: En A102, En reunión..."
                      maxLength={60}
                      className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm text-ulsa-carbon placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-ulsa-coral/20 focus:border-ulsa-coral/50 transition-all"
                    />
                    <p className="text-[10px] text-gray-300 mt-1.5 text-right">{comentario.length}/60</p>
                  </div>
                )}

                {/* Botón Guardar */}
                {selectedId && (
                  <button
                    id="btn-guardar-estado"
                    onClick={handleSave}
                    disabled={saving}
                    className={`w-full py-3 rounded-xl text-sm font-bold tracking-wide transition-all duration-300 flex items-center justify-center gap-2 cursor-pointer ${
                      saved
                        ? 'bg-ulsa-emerald text-white shadow-lg shadow-ulsa-emerald/25'
                        : 'bg-gradient-to-r from-ulsa-green to-ulsa-green-light text-white shadow-md shadow-ulsa-green/25 hover:shadow-lg hover:shadow-ulsa-green/35 active:scale-[0.97]'
                    }`}
                  >
                    {saving ? (
                      <>
                        <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                        </svg>
                        Guardando...
                      </>
                    ) : saved ? (
                      <>
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                        ¡Guardado!
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                        Guardar cambios
                      </>
                    )}
                  </button>
                )}
              </div>

              {/* Footer hint */}
              {selected && (
                <div className="px-5 pb-4">
                  <div className="text-[10px] text-gray-300 text-center">
                    Los estudiantes verán tu estado en tiempo real
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}
