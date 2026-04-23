import { useState, useEffect, useRef } from 'react';
import { db } from '../firebase';
import { ref, set, remove, push } from 'firebase/database';

const ADMIN_PIN = '0000'; // PIN de administración por defecto

export default function AdminPanel({ maestros, visible, onClose }) {
  const [authenticated, setAuthenticated] = useState(false);
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState(false);
  
  // Estados para CRUD
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    id: '', // Vacío significa "nuevo"
    nombre: '',
    departamento: '',
    pista_audio: 1,
  });
  
  const [saving, setSaving] = useState(false);
  const pinInputRef = useRef(null);

  // Reset al cerrar
  useEffect(() => {
    if (!visible) {
      setAuthenticated(false);
      setPin('');
      setPinError(false);
      resetForm();
    }
  }, [visible]);

  // Focus en input de PIN al abrir
  useEffect(() => {
    if (visible && !authenticated && pinInputRef.current) {
      setTimeout(() => pinInputRef.current?.focus(), 100);
    }
  }, [visible, authenticated]);

  const handlePinSubmit = (e) => {
    e.preventDefault();
    if (pin === ADMIN_PIN) {
      setAuthenticated(true);
      setPinError(false);
    } else {
      setPinError(true);
      setPin('');
      setTimeout(() => setPinError(false), 600);
    }
  };

  const resetForm = () => {
    setFormData({ id: '', nombre: '', departamento: '', pista_audio: 1 });
    setIsEditing(false);
  };

  const handleEdit = (m) => {
    setFormData({
      id: m.id,
      nombre: m.nombre,
      departamento: m.departamento || '',
      pista_audio: m.pista_audio || 1,
    });
    setIsEditing(true);
  };

  const handleDelete = async (id, nombre) => {
    if (window.confirm(`¿Estás seguro de eliminar a ${nombre}?`)) {
      try {
        await remove(ref(db, `maestros/${id}`));
      } catch (err) {
        console.error('Error al borrar maestro:', err);
      }
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!formData.nombre) return;
    setSaving(true);
    
    try {
      if (formData.id) {
        // Actualizar existente
        await set(ref(db, `maestros/${formData.id}/nombre`), formData.nombre);
        await set(ref(db, `maestros/${formData.id}/departamento`), formData.departamento);
        await set(ref(db, `maestros/${formData.id}/pista_audio`), parseInt(formData.pista_audio));
      } else {
        // Crear nuevo
        const nuevoRef = push(ref(db, 'maestros'));
        await set(nuevoRef, {
          nombre: formData.nombre,
          departamento: formData.departamento,
          pista_audio: parseInt(formData.pista_audio),
          estado: 'disponible',
          comentario: ''
        });
      }
      resetForm();
    } catch (err) {
      console.error('Error guardando maestro:', err);
    }
    
    setSaving(false);
  };

  if (!visible) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[80] animate-fade-in" onClick={onClose} />
      
      <div className="fixed top-10 left-1/2 -translate-x-1/2 z-[90] w-[calc(100%-2rem)] max-w-lg md:max-w-2xl max-h-[85vh] overflow-y-auto animate-slide-down">
        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-gray-800 to-gray-700 px-5 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <div>
                <h3 className="text-white font-bold text-sm">Panel de Administración</h3>
                <p className="text-white/70 text-[11px]">Gestión de Catedráticos (Admin)</p>
              </div>
            </div>
            <button onClick={onClose} className="w-8 h-8 rounded-lg bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors">
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {!authenticated ? (
            /* PIN Screen */
            <form onSubmit={handlePinSubmit} className="p-8 space-y-5">
              <div className="text-center mb-6">
                <p className="text-sm text-gray-500 font-medium">Acceso para Administradores</p>
                <p className="text-xs text-gray-400">PIN por defecto: 0000</p>
              </div>
              <input
                ref={pinInputRef}
                type="password"
                inputMode="numeric"
                maxLength={4}
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                placeholder="• • • •"
                className={`w-full px-4 py-4 rounded-xl border text-center text-3xl font-bold tracking-[0.5em] transition-all focus:outline-none ${
                   pinError
                     ? 'border-ulsa-coral bg-red-50 text-ulsa-coral focus:ring-2 focus:ring-ulsa-coral/30'
                     : 'border-gray-200 bg-white text-gray-800 focus:ring-2 focus:ring-gray-400/30'
                }`}
              />
              <button
                type="submit"
                disabled={pin.length < 4}
                className={`w-full py-3.5 rounded-xl text-sm font-bold transition-all ${
                  pin.length >= 4 ? 'bg-gray-800 text-white hover:bg-gray-900 shadow-md' : 'bg-gray-100 text-gray-400'
                }`}
              >
                Entrar al Panel
              </button>
            </form>
          ) : (
            /* CRUD Dashboard */
            <div className="p-6 md:flex md:gap-6 bg-gray-50">
              {/* Columna Izquierda: Formulario */}
              <div className="md:w-1/3 mb-6 md:mb-0">
                <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm sticky top-0">
                  <h4 className="font-bold text-gray-700 mb-4 border-b pb-2">
                    {isEditing ? 'Editar Maestro' : 'Nuevo Maestro'}
                  </h4>
                  <form onSubmit={handleSave} className="space-y-3">
                    <div>
                      <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Nombre Completo</label>
                      <input 
                        type="text" required value={formData.nombre}
                        onChange={(e) => setFormData({...formData, nombre: e.target.value})}
                        className="w-full mt-1 px-3 py-2 border rounded-lg text-sm bg-gray-50 focus:bg-white focus:ring-2 focus:ring-gray-200" 
                        placeholder="Ej: Ing. Juan Pérez"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Departamento</label>
                      <input 
                        type="text" value={formData.departamento}
                        onChange={(e) => setFormData({...formData, departamento: e.target.value})}
                        className="w-full mt-1 px-3 py-2 border rounded-lg text-sm bg-gray-50 focus:bg-white focus:ring-2 focus:ring-gray-200" 
                        placeholder="Ej: IME, Sistemas..."
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Pista de Audio (MicroSD)</label>
                      <input 
                        type="number" min="1" max="255" required value={formData.pista_audio}
                        onChange={(e) => setFormData({...formData, pista_audio: e.target.value})}
                        className="w-full mt-1 px-3 py-2 border rounded-lg text-sm bg-gray-50 focus:bg-white focus:ring-2 focus:ring-gray-200" 
                      />
                      <p className="text-[10px] text-gray-400 mt-1">Archivo MP3 que sonará (ej: 1 = 0001.mp3)</p>
                    </div>

                    <div className="pt-3 flex gap-2">
                      <button type="submit" disabled={saving} className="flex-1 bg-gray-800 text-white font-bold text-xs py-2.5 rounded-lg hover:bg-gray-900 transition flex justify-center items-center">
                        {saving ? 'Guardando...' : 'Guardar'}
                      </button>
                      {isEditing && (
                        <button type="button" onClick={resetForm} className="px-3 bg-gray-200 text-gray-600 font-bold text-xs py-2.5 rounded-lg hover:bg-gray-300">
                          Cancelar
                        </button>
                      )}
                    </div>
                  </form>
                </div>
              </div>

              {/* Columna Derecha: Lista */}
              <div className="md:w-2/3">
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                  <div className="px-4 py-3 bg-gray-50 border-b border-gray-100 flex justify-between items-center">
                    <h4 className="font-bold text-gray-700 text-sm">Directorio Actual</h4>
                    <span className="text-xs bg-gray-200 text-gray-600 px-2 py-1 rounded-full font-bold">{maestros.length}</span>
                  </div>
                  <div className="divide-y divide-gray-50 max-h-[400px] overflow-y-auto">
                    {maestros.map(m => (
                      <div key={m.id} className="p-3 flex justify-between items-center hover:bg-gray-50 transition-colors group">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-gray-800 truncate">{m.nombre}</p>
                          <p className="text-xs text-gray-500 truncate">{m.departamento} • Pista: <span className="font-mono bg-gray-100 px-1 rounded text-[10px]">{m.pista_audio || 1}</span></p>
                        </div>
                        <div className="flex gap-1 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => handleEdit(m)} className="p-1.5 text-blue-500 bg-blue-50 hover:bg-blue-100 rounded-md" title="Editar">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                          </button>
                          <button onClick={() => handleDelete(m.id, m.nombre)} className="p-1.5 text-red-500 bg-red-50 hover:bg-red-100 rounded-md" title="Eliminar">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                          </button>
                        </div>
                      </div>
                    ))}
                    {maestros.length === 0 && (
                      <div className="p-8 text-center text-gray-400 text-sm">
                        No hay maestros registrados. Utiliza el formulario para crear uno.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
