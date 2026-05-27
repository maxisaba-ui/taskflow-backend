/**
 * dateHelpers.js — v1.0.0
 * Funciones para formatear fechas respetando timezone local.
 * Las fechas del backend vienen en UTC. El browser convierte
 * automáticamente a la hora local del OS al usar new Date().
 */

/**
 * Formatea una fecha ISO a hora local HH:MM
 * @param {string} iso - Fecha ISO (ej: "2026-05-22T21:40:00+00:00")
 * @returns {string} Hora local (ej: "18:40" en Argentina UTC-3)
 */
export function fmtHora(iso) {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString("es-AR", {
      hour: "2-digit", minute: "2-digit", hour12: false
    });
  } catch { return iso; }
}

/**
 * Formatea fecha ISO a DD/MM/YYYY
 */
export function fmtFecha(iso) {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("es-AR", {
      day: "2-digit", month: "2-digit", year: "numeric"
    });
  } catch { return iso.split("T")[0].split("-").reverse().join("/"); }
}

/**
 * Formatea fecha ISO a DD/MM/YYYY HH:MM hora local
 */
export function fmtFechaHora(iso) {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return d.toLocaleString("es-AR", {
      day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit", hour12: false
    });
  } catch { return iso; }
}

/**
 * Retorna la fecha de hoy en formato YYYY-MM-DD en hora local
 * (no UTC — evita que a las 21:00 ARG diga que es "mañana")
 */
export function hoyLocal() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
