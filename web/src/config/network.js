// ── Configuración de Red WiFi Permitida ──────────────────────
// Aquí se definen las IPs públicas de la red de la universidad.
// Cuando un estudiante se conecta al WiFi de la ULSA, su tráfico
// sale a internet con una IP pública específica. Solo esas IPs
// están autorizadas para usar el sistema de notificaciones.
//
// Para encontrar la IP pública de la ULSA:
// 1. Conéctate al WiFi de la universidad
// 2. Visita https://api.ipify.org en el navegador
// 3. La IP que aparece es la que debes agregar aquí

export const NETWORK_CONFIG = {
  // ── IPs públicas permitidas ──
  // Agrega aquí la(s) IP(s) públicas del WiFi de la ULSA
  // Ejemplo: ['200.23.xxx.xxx', '187.xxx.xxx.xxx']
  allowedIPs: ['208.96.129.55'],

  // ── Rangos CIDR permitidos (opcional) ──
  // Si la universidad tiene un rango de IPs, puedes usar notación CIDR
  // Ejemplo: ['200.23.100.0/24'] → permite 200.23.100.0 a 200.23.100.255
  allowedCIDRs: [],

  // ── Modo desarrollo ──
  // En true, permite acceso desde cualquier red (para desarrollo local).
  // ¡IMPORTANTE! Cambiar a false antes de desplegar en producción.
  devMode: false,

  // ── Mensaje personalizado ──
  blockedMessage: 'Para usar el Notificador ULSA, debes estar conectado a la red WiFi de la universidad.',

  // ── API para obtener IP pública ──
  ipCheckAPI: 'https://api.ipify.org?format=json',
};
