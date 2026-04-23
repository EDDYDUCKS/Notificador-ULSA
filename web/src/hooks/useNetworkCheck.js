// ── Hook para verificar la red WiFi del usuario ──────────────
import { useState, useEffect, useRef } from 'react';
import { NETWORK_CONFIG } from '../config/network';

/**
 * Verifica si una IP está dentro de un rango CIDR.
 * Ejemplo: ipInCIDR('192.168.1.50', '192.168.1.0/24') → true
 */
function ipInCIDR(ip, cidr) {
  const [range, bits] = cidr.split('/');
  const mask = ~(2 ** (32 - parseInt(bits)) - 1);

  const ipToInt = (addr) =>
    addr.split('.').reduce((acc, octet) => (acc << 8) + parseInt(octet), 0) >>> 0;

  return (ipToInt(ip) & mask) === (ipToInt(range) & mask);
}

/**
 * useNetworkCheck()
 * Retorna:
 *   - allowed:  true si el usuario está en la red permitida
 *   - loading:  true mientras se verifica
 *   - userIP:   IP pública detectada (para debug)
 *   - error:    mensaje de error si falla la verificación
 */
export function useNetworkCheck() {
  const [state, setState] = useState({
    allowed: false,
    loading: true,
    userIP: null,
    error: null,
  });
  const checked = useRef(false);

  useEffect(() => {
    if (checked.current) return;
    checked.current = true;

    // Si hay bypass de administrador en localStorage
    if (localStorage.getItem('adminOverride') === 'true') {
      setState({ allowed: true, loading: false, userIP: 'admin-bypass', error: null });
      return;
    }

    // Si estamos en modo desarrollo, permitir acceso inmediato
    if (NETWORK_CONFIG.devMode) {
      setState({ allowed: true, loading: false, userIP: 'dev-mode', error: null });
      return;
    }

    // Si no hay IPs configuradas, bloquear con mensaje de configuración
    if (NETWORK_CONFIG.allowedIPs.length === 0 && NETWORK_CONFIG.allowedCIDRs.length === 0) {
      setState({
        allowed: false,
        loading: false,
        userIP: null,
        error: 'No se han configurado IPs permitidas. Contacta al administrador.',
      });
      return;
    }

    // Verificar la IP pública del usuario
    fetch(NETWORK_CONFIG.ipCheckAPI)
      .then((res) => res.json())
      .then((data) => {
        const userIP = data.ip;

        // Verificar si la IP está en la lista de IPs permitidas
        const ipMatch = NETWORK_CONFIG.allowedIPs.includes(userIP);

        // Verificar si la IP está en algún rango CIDR permitido
        const cidrMatch = NETWORK_CONFIG.allowedCIDRs.some((cidr) => ipInCIDR(userIP, cidr));

        const allowed = ipMatch || cidrMatch;

        setState({
          allowed,
          loading: false,
          userIP,
          error: allowed ? null : NETWORK_CONFIG.blockedMessage,
        });

        console.log(`[Network] IP: ${userIP} → ${allowed ? '✓ Permitido' : '✗ Bloqueado'}`);
      })
      .catch((err) => {
        console.error('[Network] Error al verificar IP:', err);
        // Si falla la verificación, bloqueamos por seguridad
        setState({
          allowed: false,
          loading: false,
          userIP: null,
          error: 'No se pudo verificar tu red. Asegúrate de tener conexión a internet.',
        });
      });
  }, []);

  return state;
}
