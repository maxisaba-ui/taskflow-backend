/**
 * =============================================================
 * Archivo: ResumenDia.jsx
 * Versión: v1.0.0
 * -------------------------------------------------------------
 * DESCRIPCION FUNCIONAL:
 *   Panel lateral del Dashboard que muestra el resumen del día:
 *   progreso visual de tareas, tiempo trabajado, y métricas
 *   por estado. Se actualiza en tiempo real con cada acción.
 *
 * DESCRIPCION TECNICA:
 *   Componente presentacional puro. Recibe el objeto stats
 *   calculado en el Dashboard. No hace llamadas al backend.
 *   La barra de progreso muestra completadas/total.
 *
 * HISTORIAL:
 *   v1.0.0 - Componente inicial con métricas y progreso visual.
 * =============================================================
 */

/**
 * DESCRIPCION FUNCIONAL: Formatea minutos como "Xh Ym".
 */
function fmtTiempo(minutos) {
  if (!minutos || minutos === 0) return "0 min";
  if (minutos < 60) return `${minutos} min`;
  return `${Math.floor(minutos / 60)}h ${minutos % 60}m`;
}

export default function ResumenDia({ stats }) {
  /* Progreso: completadas sobre total (excluyendo vencidas del denominador) */
  const total      = stats?.total || 0;
  const completadas = stats?.completadas || 0;
  const progreso   = total > 0 ? Math.round((completadas / total) * 100) : 0;

  const items = [
    { label:"Total",       valor: total,                    color:"#6366f1" },
    { label:"Pendientes",  valor: stats?.pendientes || 0,   color:"#6b7280" },
    { label:"En curso",    valor: stats?.en_curso   || 0,   color:"#059669" },
    { label:"Completadas", valor: completadas,              color:"#16a34a" },
    { label:"Vencidas",    valor: stats?.vencidas   || 0,   color:"#ef4444" },
  ];

  return (
    <div style={{
      background:   "#1f2937",
      borderRadius: "10px",
      padding:      "16px",
      border:       "1px solid #374151",
    }}>
      {/* Título */}
      <div style={{ fontWeight:"700", fontSize:"14px", color:"white",
        marginBottom:"14px" }}>
        📊 Resumen del día
      </div>

      {/* Barra de progreso */}
      <div style={{ marginBottom:"14px" }}>
        <div style={{ display:"flex", justifyContent:"space-between",
          fontSize:"12px", color:"#9ca3af", marginBottom:"6px" }}>
          <span>Progreso</span>
          <span style={{ color:"#6ee7b7", fontWeight:"700" }}>{progreso}%</span>
        </div>
        {/* Track de la barra */}
        <div style={{ background:"#111827", borderRadius:"99px",
          height:"8px", overflow:"hidden" }}>
          <div style={{
            height:"100%",
            width:`${progreso}%`,
            background:   progreso === 100 ? "#16a34a" : "#6366f1",
            borderRadius: "99px",
            transition:   "width 0.4s ease",
          }} />
        </div>
        <div style={{ fontSize:"11px", color:"#6b7280", marginTop:"4px" }}>
          {completadas} de {total} completada{completadas !== 1 ? "s" : ""}
        </div>
      </div>

      {/* Grilla de métricas */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr",
        gap:"8px", marginBottom:"14px" }}>
        {items.map(it => (
          <div key={it.label} style={{
            background:   "#111827",
            borderRadius: "6px",
            padding:      "8px 10px",
            border:       `1px solid ${it.color}33`,
          }}>
            <div style={{ fontSize:"18px", fontWeight:"700", color: it.color }}>
              {it.valor}
            </div>
            <div style={{ fontSize:"11px", color:"#9ca3af", marginTop:"2px" }}>
              {it.label}
            </div>
          </div>
        ))}
      </div>

      {/* Tiempo trabajado */}
      <div style={{
        background:   "#111827",
        borderRadius: "6px",
        padding:      "10px 12px",
        border:       "1px solid #374151",
        display:      "flex",
        justifyContent:"space-between",
        alignItems:   "center",
      }}>
        <span style={{ fontSize:"12px", color:"#9ca3af" }}>⏱ Tiempo trabajado</span>
        <span style={{ fontSize:"14px", fontWeight:"700", color:"#c4b5fd" }}>
          {fmtTiempo(stats?.minutos_trabajados || 0)}
        </span>
      </div>
    </div>
  );
}