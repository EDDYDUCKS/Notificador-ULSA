import { useState, useEffect, useRef, useCallback } from 'react';
import { db } from '../firebase';
import { ref, onValue, set, get, runTransaction, remove } from 'firebase/database';

/**
 * useFirebase()
 * Retorna:
 *   - maestros:    Array de objetos { id, ...datos }
 *   - sistema:     Objeto con llamada_activa, respuesta_hardware, movimiento_sala, maestro_solicitado
 *   - llamarMaestro(nombre): Activa la llamada en Firebase
 *   - actualizarEstadoMaestro(id, estado, comentario): Cambia estado y comentario de un maestro
 */
export function useFirebase() {
  const [maestros, setMaestros] = useState([]);
  const [loadingMaestros, setLoadingMaestros] = useState(true);
  const [colas, setColas] = useState({}); // <--- Nuevo estado para la Cola
  const [sistema, setSistema] = useState({
    llamada_activa: false,
    respuesta_hardware: 'en_espera',
    movimiento_sala: false,
    maestro_solicitado: '',
    pista_solicitada: 0,
    cola_ultimo_id: 0,
    turno_esp32: 1
  });
  const seeded = useRef(false);
  const initialized = useRef(false);

  // ── Inicialización: Limpiar estado residual de sesiones anteriores ──
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    // Resetear /sistema solo si no existen contadores
    get(ref(db, 'sistema/cola_ultimo_id')).then((snap) => {
      if (!snap.exists()) {
        const sistemaReset = {
          movimiento_sala: false,
          cola_ultimo_id: 0,
          turno_esp32: 1
        };
        set(ref(db, 'sistema'), sistemaReset);
      }
    });
  }, []);

  // ── Seed: Crear maestro de muestra si no hay datos ──
  useEffect(() => {
    if (seeded.current) return;
    seeded.current = true;
    const maestrosRef = ref(db, 'maestros');
    get(maestrosRef).then((snapshot) => {
      if (!snapshot.exists()) {
        set(ref(db, 'maestros/ing_luis_isaac'), {
          nombre: 'Ing. Luis Isaac',
          pista_audio: 1, // <- Campo de pista
          departamento: 'Ingeniería',
          estado: 'disponible',
          comentario: '',
        });
      }
    }).catch((err) => console.error('[Firebase] Seed error:', err));
  }, []);

  // ── Listener: /maestros ──
  useEffect(() => {
    const maestrosRef = ref(db, 'maestros');
    const unsub = onValue(maestrosRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const lista = Object.entries(data).map(([id, val]) => ({ id, ...val }));
        setMaestros(lista);
      } else {
        setMaestros([]);
      }
      setLoadingMaestros(false);
    });
    return () => unsub();
  }, []);

  // ── Listener: /sistema ──
  useEffect(() => {
    const sistemaRef = ref(db, 'sistema');
    const unsub = onValue(sistemaRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setSistema((prev) => ({ ...prev, ...data }));
      }
    });
    return () => unsub();
  }, []);

  // ── Listener: /colas ──
  useEffect(() => {
    const colasRef = ref(db, 'colas');
    const unsub = onValue(colasRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setColas(data);
      } else {
        setColas({});
      }
    });
    return () => unsub();
  }, []);

  // ── Acción: Agregar llamada a la Cola ──
  const llamarMaestro = useCallback(async (nombre, pistaAudio = 1, estudiante = "Anónimo", maestroId = "") => {
    try {
      const colaCountRef = ref(db, 'sistema/cola_ultimo_id');
      const result = await runTransaction(colaCountRef, (currentData) => {
        return (currentData || 0) + 1;
      });
      
      if (result.committed) {
        const nuevoId = result.snapshot.val();
        await set(ref(db, `colas/ll_${nuevoId}`), {
           maestro_id: maestroId,
           maestro_solicitado: nombre,
           pista_audio: pistaAudio,
           estudiante: estudiante,
           estado: 'pendiente', // pendiente -> notificando -> voy_en_camino | ocupado | timeout
           timestamp: Date.now()
        });
        return nuevoId; 
      }
    } catch (error) {
      console.error('[Firebase] Error al hacer queue:', error);
    }
  }, []);

  // ── Acción: Resetear (ya no necesario globalmente, solo cerrar UI local) ──
  const resetearSistema = useCallback(async () => {
     // No hacemos nada para no afectar la cola
  }, []);

  // ── Acción: Actualizar estado de un maestro ──
  const actualizarEstadoMaestro = async (maestroId, nuevoEstado, comentario = '') => {
    try {
      await set(ref(db, `maestros/${maestroId}/estado`), nuevoEstado);
      await set(ref(db, `maestros/${maestroId}/comentario`), comentario);
    } catch (error) {
      console.error('[Firebase] Error al actualizar estado:', error);
    }
  };

  // ── Acción: Cancelar llamada activa de un estudiante ──
  const cancelarLlamada = async (queueId) => {
    try {
      await remove(ref(db, `colas/ll_${queueId}`));
    } catch (error) {
      console.error('[Firebase] Error al cancelar llamada:', error);
    }
  };

  return { maestros, loadingMaestros, colas, sistema, llamarMaestro, cancelarLlamada, actualizarEstadoMaestro, resetearSistema };
}
