// ── App.jsx ──────────────────────────────────────────────────
import { useState, useCallback, useEffect } from 'react';
import { useFirebase } from './hooks/useFirebase';
import { useNetworkCheck } from './hooks/useNetworkCheck';
import Navbar from './components/Navbar';
import TeacherCard from './components/TeacherCard';
import CallPanel from './components/CallPanel';
import SalaStatus from './components/SalaStatus';
import TeacherSelfPanel from './components/TeacherSelfPanel';
import NetworkGuard from './components/NetworkGuard';
import AdminPanel from './components/AdminPanel';

export default function App() {
  const { allowed, loading: networkLoading, userIP, error: networkError } = useNetworkCheck();
  const { maestros, loadingMaestros, colas, sistema, llamarMaestro, cancelarLlamada, actualizarEstadoMaestro, resetearSistema } = useFirebase();
  const [showCallPanel, setShowCallPanel] = useState(() => {
    return !!localStorage.getItem('ulsa_active_call_id');
  });
  const [activeQueueId, setActiveQueueId] = useState(() => {
    return localStorage.getItem('ulsa_active_call_id') || null;
  });
  const [callingId, setCallingId] = useState(null);
  const [showTeacherPanel, setShowTeacherPanel] = useState(false);
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Modal de Identidad del Estudiante
  const [showStudentModal, setShowStudentModal] = useState(false);
  const [pendingMaestroCall, setPendingMaestroCall] = useState(null);
  const [studentNameInput, setStudentNameInput] = useState('');

  // ── Buscar Maestros en tiempo real ──
  const filteredMaestros = maestros.filter(m => {
    const nombreStr = m.nombre ? m.nombre.toLowerCase() : '';
    const dptoStr = m.departamento ? m.departamento.toLowerCase() : '';
    const query = searchTerm.toLowerCase();
    return nombreStr.includes(query) || dptoStr.includes(query);
  });

  // ── Verificar si un estudiante ya tiene llamada activa en la cola ──
  const estudianteYaTieneLlamada = useCallback((nombre) => {
    if (!colas || !nombre) return false;
    const nombreNorm = nombre.trim().toLowerCase();
    return Object.values(colas).some(ll => {
      const est = (ll.estudiante || '').trim().toLowerCase();
      return est === nombreNorm && (ll.estado === 'pendiente' || ll.estado === 'notificando');
    });
  }, [colas]);

  // ── Manejar la acción de llamar ──
  const handleLlamar = useCallback((maestro) => {
    // Verificar bloqueo por dispositivo leyendo directamente de localStorage (evitar stale closure)
    const existingCallId = localStorage.getItem('ulsa_active_call_id');
    if (existingCallId) {
      alert("Ya tienes un llamado activo en curso. Por favor espera a que finalice para solicitar otro.");
      return;
    }

    const savedName = localStorage.getItem('ulsa_student_name');
    if (savedName && savedName.trim() !== '') {
      ejecutarLlamada(maestro, savedName);
    } else {
      setPendingMaestroCall(maestro);
      setStudentNameInput('');
      setShowStudentModal(true);
    }
  }, []);

  const submitStudentName = (e) => {
    e.preventDefault();
    if (studentNameInput.trim().length > 2) {
      // Verificar duplicado de nombre antes de guardar
      if (estudianteYaTieneLlamada(studentNameInput.trim())) {
        alert(`El nombre "${studentNameInput.trim()}" ya tiene una solicitud activa. Si eres la misma persona, espera a que se atienda tu llamado.`);
        return;
      }
      localStorage.setItem('ulsa_student_name', studentNameInput.trim());
      setShowStudentModal(false);
      if (pendingMaestroCall) {
        ejecutarLlamada(pendingMaestroCall, studentNameInput.trim());
      }
    }
  };

  const ejecutarLlamada = async (maestro, estudianteName) => {
    // Doble verificación: localStorage (fuente de verdad) + state
    const existingCallId = localStorage.getItem('ulsa_active_call_id');
    if (existingCallId || activeQueueId) {
      alert("Ya tienes un llamado activo en curso. Por favor espera a que finalice para solicitar otro.");
      return;
    }
    // Verificar si este nombre de estudiante ya tiene llamada activa
    if (estudianteYaTieneLlamada(estudianteName)) {
      alert(`"${estudianteName}" ya tiene una solicitud activa en la cola. Espera a que sea atendida.`);
      return;
    }
    setCallingId(maestro.nombre);
    const pista = maestro.pista_audio || 1; 
    const queueId = await llamarMaestro(maestro.nombre, pista, estudianteName, maestro.id);
    if (queueId) {
      setActiveQueueId(queueId);
      localStorage.setItem('ulsa_active_call_id', queueId.toString());
      setShowCallPanel(true);
    }
    setCallingId(null);
  };

  // Solo oculta el panel, NO libera el bloqueo del dispositivo
  const handleHidePanel = useCallback(() => {
    setShowCallPanel(false);
  }, []);

  // Libera el bloqueo del dispositivo y borra la llamada de base de datos
  const handleReleaseCall = useCallback(async () => {
    if (activeQueueId) {
      await cancelarLlamada(activeQueueId);
    }
    setShowCallPanel(false);
    setActiveQueueId(null);
    localStorage.removeItem('ulsa_active_call_id');
  }, [activeQueueId, cancelarLlamada]);

  const handleCancelCall = useCallback(async () => {
    if (activeQueueId) {
      handleReleaseCall();
    }
  }, [activeQueueId, handleReleaseCall]);

  // ── Auto-liberar cuando el hardware responde o por Timeout ──
  useEffect(() => {
    let timer;
    if (activeQueueId && colas) {
      const miLlamada = colas[`ll_${activeQueueId}`];
      if (miLlamada) {
        if (miLlamada.estado === 'voy_en_camino' || miLlamada.estado === 'ocupado' || miLlamada.estado === 'timeout') {
          // Libera el bloqueo a los 6s de haber respondido
          timer = setTimeout(() => {
            handleReleaseCall();
          }, 6000);
        }
      } else if (Object.keys(colas).length > 0) {
        // La llamada ya no existe en la base de datos, liberar
        handleReleaseCall();
      }
    }
    return () => clearTimeout(timer);
  }, [activeQueueId, colas, handleReleaseCall]);

  // Estadísticas rápidas
  const disponibles = maestros.filter((m) => m.estado === 'disponible').length;
  const ocupados = maestros.filter((m) => m.estado === 'ocupado').length;

  // ── Verificación de red WiFi (Mover aquí para respetar Reglas de Hooks) ──
  if (networkLoading) {
    return (
      <div className="min-h-screen bg-ulsa-smoke flex items-center justify-center">
        <div className="text-center space-y-4 animate-fade-up">
          <div className="w-12 h-12 mx-auto border-[3px] border-gray-200 border-t-ulsa-green rounded-full animate-spin"></div>
          <p className="text-sm text-gray-400 font-medium">Verificando red...</p>
        </div>
      </div>
    );
  }

  if (!allowed) {
    return <NetworkGuard error={networkError} userIP={userIP} />;
  }

  return (
    <div className="min-h-screen bg-ulsa-smoke font-sans text-ulsa-carbon">
      
      <div className="flex flex-col min-h-screen">
        <Navbar onTogglePanel={() => setShowTeacherPanel((v) => !v)} />

        <main className="flex-1 max-w-6xl w-full mx-auto px-5 py-8 space-y-8">

        {/* ── Dashboard: Indicadores rápidos ── */}
        <div className="flex flex-col sm:flex-row gap-4 relative z-20">
          {/* Sensor PIR */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-1">
            <SalaStatus movimiento={sistema.movimiento_sala} />
          </div>

          {/* Buscador de Catedráticos */}
          <div className="flex-1 bg-white rounded-2xl border border-gray-100 shadow-sm p-3 px-5 flex items-center gap-3 transition-colors focus-within:border-ulsa-green focus-within:ring-2 focus-within:ring-ulsa-green/20">
            <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Buscar por profesor o clase..."
              className="w-full bg-transparent outline-none text-ulsa-carbon placeholder-gray-400 font-medium"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            {searchTerm && (
              <button aria-label="Limpiar buscador" onClick={() => setSearchTerm('')} className="text-gray-400 hover:text-gray-600 cursor-pointer">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* ── Estadísticas Premium ── */}
        <div className="grid grid-cols-2 gap-5">
          <div className="bg-white rounded-2xl border border-gray-100 p-6 flex flex-col items-center justify-center shadow-sm">
            <div className="w-12 h-12 rounded-full bg-ulsa-emerald/10 flex items-center justify-center mb-3 text-ulsa-emerald">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="text-4xl font-bold text-ulsa-carbon tracking-tight">{disponibles}</p>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mt-1">Disponibles</p>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 p-6 flex flex-col items-center justify-center shadow-sm">
            <div className="w-12 h-12 rounded-full bg-ulsa-coral/10 flex items-center justify-center mb-3 text-ulsa-coral">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="text-4xl font-bold text-ulsa-carbon tracking-tight">{ocupados}</p>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mt-1">Ocupados</p>
          </div>
        </div>

        {/* ── Sección de Título ── */}
        <div className="flex justify-between items-end pb-2 border-b border-gray-200/50">
          <div>
            <h2 className="text-2xl font-bold text-ulsa-carbon tracking-tight">Directorio de Catedráticos</h2>
            <p className="text-sm text-gray-500 font-medium mt-1">
              {maestros.length} profesores registrados · Presiona el botón verde para notificar
            </p>
          </div>
        </div>

        {/* ── Grid de Tarjetas ── */}
        {loadingMaestros ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 animate-pulse">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-gray-200"></div>
                  <div className="flex-1 space-y-2 mt-1">
                    <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                    <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                    <div className="h-4 w-16 bg-gray-200 rounded-full mt-3"></div>
                  </div>
                </div>
                <div className="mt-4 w-full h-10 rounded-xl bg-gray-200"></div>
              </div>
            ))}
          </div>
        ) : filteredMaestros.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredMaestros.map((m, i) => {
              const llamadasDeEsteMaestro = Object.values(colas || {}).filter(c => 
                c.maestro_id === m.id && (c.estado === 'pendiente' || c.estado === 'notificando')
              );
              const llamadaActiva = llamadasDeEsteMaestro.sort((a, b) => a.timestamp - b.timestamp)[0];
              const llamador = llamadaActiva ? llamadaActiva.estudiante : null;

              return (
                <TeacherCard
                  key={m.id}
                  maestro={{ ...m, _index: i }}
                  onLlamar={handleLlamar}
                  calling={callingId === m.nombre}
                  globalCallActive={!!activeQueueId}
                  llamador={llamador}
                />
              );
            })}
          </div>
        ) : maestros.length > 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center shadow-sm">
            <p className="text-gray-500 font-medium tracking-wide">No se encontraron profesores coincidiendo con "<span className="text-ulsa-carbon font-bold">{searchTerm}</span>"</p>
          </div>
        ) : (
          /* Estado vacío */
          <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center shadow-sm">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-ulsa-smoke flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <h3 className="text-base font-semibold text-ulsa-carbon">Sin catedráticos</h3>
            <p className="text-sm text-gray-400 mt-1">
              Agrega maestros al nodo <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded font-mono">maestros/</code> en Firebase
            </p>
          </div>
        )}
      </main>

      {/* ── Footer ── */}
      <footer className="w-full bg-white border-t border-gray-200 mt-8">
        <div className="max-w-6xl mx-auto px-6 py-6 flex flex-col sm:flex-row justify-between items-center gap-2">
          <p className="text-xs font-semibold text-gray-500">
            Universidad Tecnológica La Salle · Notificador IoT · {new Date().getFullYear()}
          </p>
          <button 
            onClick={() => setShowAdminPanel(true)} 
            className="text-[10px] bg-white/60 px-3 py-1.5 rounded-full text-gray-500 hover:text-ulsa-carbon hover:bg-white shadow-sm border border-gray-200 transition-all font-bold tracking-wide cursor-pointer"
          >
            Administración
          </button>
        </div>
      </footer>

      </div> {/* <-- Cierra el flex-col min-h-screen */}

      {/* ── Modal para identificar al Estudiante ── */}
      {showStudentModal && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowStudentModal(false)} />
          <div className="bg-white rounded-2xl w-full max-w-sm mx-4 p-6 relative z-[90] shadow-2xl animate-fade-up">
            <h3 className="text-lg font-bold text-ulsa-carbon mb-2">¿Quién solicita?</h3>
            <p className="text-sm text-gray-500 mb-5">Ingresa tu nombre para que el catedrático sepa a quién atender. Solo te lo pediremos una vez.</p>
            <form onSubmit={submitStudentName}>
              <input
                type="text"
                autoFocus
                placeholder="Ej. Juan Pérez - IME"
                value={studentNameInput}
                onChange={(e) => setStudentNameInput(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-ulsa-carbon focus:outline-none focus:ring-2 focus:ring-ulsa-green/30 focus:border-ulsa-green transition-all"
              />
              <div className="flex gap-3 mt-6">
                <button type="button" onClick={() => setShowStudentModal(false)} className="flex-1 py-2.5 rounded-xl font-semibold text-gray-500 hover:bg-gray-100 transition-colors cursor-pointer">
                  Cancelar
                </button>
                <button type="submit" disabled={studentNameInput.trim().length <= 2} className="flex-1 py-2.5 rounded-xl font-bold bg-ulsa-green text-white shadow-md shadow-ulsa-green/20 hover:bg-ulsa-green-light disabled:opacity-50 transition-colors cursor-pointer">
                  Confirmar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal de Llamada Activa (Cola) ── */}
      <CallPanel
        queueId={activeQueueId}
        colas={colas}
        turno_esp32={sistema.turno_esp32}
        visible={showCallPanel}
        onHide={handleHidePanel}
        onRelease={handleReleaseCall}
        onCancel={handleCancelCall}
      />

      {/* ── Panel de Maestro (Auto‑Servicio) ── */}
      <TeacherSelfPanel
        maestros={maestros}
        colas={colas}
        onActualizar={actualizarEstadoMaestro}
        visible={showTeacherPanel}
        onClose={() => setShowTeacherPanel(false)}
      />

      {/* ── Panel de Administración ── */}
      <AdminPanel
        maestros={maestros}
        visible={showAdminPanel}
        onClose={() => setShowAdminPanel(false)}
      />
    </div>
  );
}
