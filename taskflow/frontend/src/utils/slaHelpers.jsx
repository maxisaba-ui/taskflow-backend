/**
 * slaHelpers.js — v1.0.0
 * Funciones para calcular y mostrar el SLA efectivo de una tarea.
 * El SLA efectivo es el más próximo entre fecha_vencimiento y
 * fecha_planificada + sla_horas (en horas hábiles, 8h/día laboral).
 */

/**
 * Convierte horas hábiles a milisegundos corridos aproximados.
 * 1 día hábil = 8 horas hábiles = 24h corridas aprox (sin considerar feriados).
 * Para SLA de alertas, es suficientemente preciso.
 */
function horasHabilesAMs(horas) {
  // 1h hábil ≈ 3h corridas (8h hábiles en 24h)
  return horas * 3 * 60 * 60 * 1000;
}

/**
 * Calcula el SLA efectivo de una tarea.
 * Retorna el Date más próximo entre fecha_vencimiento y
 * fecha_planificada + sla_horas (horas hábiles).
 * Si no hay ninguno, retorna null.
 */
export function calcularSlaEfectivo(tarea) {
  const candidatos = [];

  if (tarea.fecha_vencimiento) {
    // fecha_vencimiento es date (YYYY-MM-DD) → vence al final del día
    const d = new Date(tarea.fecha_vencimiento + "T23:59:59");
    if (!isNaN(d)) candidatos.push(d);
  }

  if (tarea.sla_horas && tarea.fecha_planificada) {
    const base = new Date(tarea.fecha_planificada + "T08:00:00");
    if (!isNaN(base)) {
      const d = new Date(base.getTime() + horasHabilesAMs(tarea.sla_horas));
      candidatos.push(d);
    }
  }

  if (candidatos.length === 0) return null;
  // Retornar el más próximo (menor timestamp)
  return candidatos.reduce((a, b) => a < b ? a : b);
}

/**
 * Retorna el estado visual del SLA de una tarea.
 * color:   color CSS del indicador
 * icono:   emoji del indicador  
 * texto:   texto descriptivo
 * urgente: true si está vencido o vence en menos de 2h hábiles
 */
export function estadoSla(tarea) {
  if (tarea.estado === "completada" || tarea.estado === "vencida") return null;

  const slaEfectivo = calcularSlaEfectivo(tarea);
  if (!slaEfectivo) return null;

  const ahora       = new Date();
  const msRestantes = slaEfectivo - ahora;
  // 2h hábiles ≈ 6h corridas
  const DOS_H_HABILES = 6 * 60 * 60 * 1000;
  // 1 día hábil ≈ 24h corridas
  const UN_DIA_HABIL  = 24 * 60 * 60 * 1000;

  if (msRestantes < 0) {
    const hVencido = Math.abs(msRestantes) / (3 * 60 * 60 * 1000);
    return {
      color:   "#ef4444",
      icono:   "⚠️",
      texto:   `SLA vencido (${hVencido < 24 ? hVencido.toFixed(0)+"h" : (hVencido/8).toFixed(1)+"d hábiles"})`,
      urgente: true,
    };
  }

  if (msRestantes < DOS_H_HABILES) {
    const mins = Math.round(msRestantes / 60000);
    return {
      color:   "#ef4444",
      icono:   "🔴",
      texto:   `Vence en ${mins < 60 ? mins+"min" : (mins/60).toFixed(1)+"h"}`,
      urgente: true,
    };
  }

  if (msRestantes < UN_DIA_HABIL) {
    const horas = (msRestantes / (60 * 60 * 1000)).toFixed(1);
    return {
      color:   "#f59e0b",
      icono:   "🟡",
      texto:   `Vence en ${horas}h`,
      urgente: false,
    };
  }

  // Más de 1 día hábil — solo mostrar fecha
  const opts = { day:"2-digit", month:"2-digit", hour:"2-digit", minute:"2-digit" };
  return {
    color:   "#6b7280",
    icono:   "⏰",
    texto:   `SLA: ${slaEfectivo.toLocaleString("es-AR", opts)}`,
    urgente: false,
  };
}

/**
 * Componente React inline para mostrar el badge de SLA.
 * Uso: <SLABadge tarea={tarea} />
 */
export function SLABadge({ tarea, style = {} }) {
  const sla = estadoSla(tarea);
  if (!sla) return null;
  return (
    <span style={{
      fontSize:"10px", padding:"2px 7px", borderRadius:"8px",
      fontWeight:"600", display:"inline-block",
      background: sla.color + "22",
      color:       sla.color,
      border:      `1px solid ${sla.color}`,
      ...style,
    }}>
      {sla.icono} {sla.texto}
    </span>
  );
}
