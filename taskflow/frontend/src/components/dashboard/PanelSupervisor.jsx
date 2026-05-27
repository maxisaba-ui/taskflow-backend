/**
 * =============================================================
 * Archivo: PanelSupervisor.jsx
 * Versión: v1.0.1
 * -------------------------------------------------------------
 * HISTORIAL:
 *   v1.0.0 - Panel inicial.
 *   v1.0.1 - Fix: agrupa por operador_nombre en lugar de asignado_a_id.
 *            Opcion "Todos" en selector de operador del Dashboard.
 * =============================================================
 */
import { useState, useEffect } from "react";
import { api } from "../../api/client.js";

const COL = {
  pendiente:"#6b7280", en_curso:"#059669",
  pausada:"#d97706",   completada:"#16a34a", vencida:"#ef4444",
};

export default function PanelSupervisor({ fecha }) {
  const [porOperador, setPorOperador] = useState({});
  const [cargando, setCargando]       = useState(true);

  useEffect(() => { cargar(); }, [fecha]);

  async function cargar() {
    setCargando(true);
    try {
      const tareas = await api.get(`/tareas/?fecha=${fecha}`);
      /* Agrupar por operador_nombre (nombre real, no UUID) */
      const agrupado = (tareas || []).reduce((acc, t) => {
        const key = t.operador_nombre || "Sin asignar";
        if (!acc[key]) acc[key] = [];
        acc[key].push(t);
        return acc;
      }, {});
      setPorOperador(agrupado);
    } catch(e) {
      console.error("Error panel supervisor:", e);
    }
    setCargando(false);
  }

  if (cargando) {
    return (
      <div style={{ background:"#1f2937", borderRadius:"10px", padding:"16px",
        border:"1px solid #374151", color:"#6b7280", fontSize:"13px", textAlign:"center" }}>
        ⏳ Cargando...
      </div>
    );
  }

  const operadores = Object.entries(porOperador);

  return (
    <div style={{ background:"#1f2937", borderRadius:"10px", padding:"16px",
      border:"1px solid #374151" }}>
      <div style={{ fontWeight:"700", fontSize:"14px", color:"white", marginBottom:"12px" }}>
        👥 Estado del equipo
      </div>

      {operadores.length === 0 ? (
        <div style={{ fontSize:"12px", color:"#6b7280", textAlign:"center", padding:"8px" }}>
          Sin tareas asignadas para esta fecha
        </div>
      ) : (
        <div style={{ display:"flex", flexDirection:"column", gap:"8px" }}>
          {operadores.map(([nombre, tareas]) => {
            const enCurso     = tareas.find(t => t.estado === "en_curso");
            const completadas = tareas.filter(t => t.estado === "completada").length;
            const pendientes  = tareas.filter(t => t.estado === "pendiente").length;
            const pausadas    = tareas.filter(t => t.estado === "pausada").length;
            const vencidas    = tareas.filter(t => t.estado === "vencida").length;

            return (
              <div key={nombre} style={{
                background:"#111827", borderRadius:"6px", padding:"10px 12px",
                border:`1px solid ${enCurso ? "#059669" : "#1f2937"}`,
              }}>
                <div style={{ display:"flex", justifyContent:"space-between",
                  alignItems:"center", marginBottom:"6px" }}>
                  <span style={{ fontWeight:"600", fontSize:"13px", color:"white" }}>
                    {nombre}
                  </span>
                  {enCurso && (
                    <span style={{ fontSize:"10px", padding:"2px 6px", borderRadius:"8px",
                      background:"#064e3b", color:"#6ee7b7", border:"1px solid #059669",
                      fontWeight:"600" }}>
                      ▶ en curso
                    </span>
                  )}
                </div>
                {enCurso && (
                  <div style={{ fontSize:"11px", color:"#6ee7b7", marginBottom:"6px",
                    overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                    {enCurso.tarea_nombre || enCurso.nombre}
                  </div>
                )}
                <div style={{ display:"flex", gap:"6px", flexWrap:"wrap" }}>
                  {[
                    { n:completadas, l:"✅", c:COL.completada },
                    { n:enCurso?1:0, l:"▶",  c:COL.en_curso   },
                    { n:pausadas,    l:"⏸",  c:COL.pausada    },
                    { n:pendientes,  l:"⏳", c:COL.pendiente  },
                    { n:vencidas,    l:"⚠️", c:COL.vencida    },
                  ].filter(x => x.n > 0).map((x, i) => (
                    <span key={i} style={{ fontSize:"11px", padding:"1px 6px",
                      borderRadius:"6px", background:x.c+"22", color:x.c,
                      border:`1px solid ${x.c}` }}>
                      {x.l} {x.n}
                    </span>
                  ))}
                  <span style={{ fontSize:"11px", color:"#6b7280", marginLeft:"auto" }}>
                    {tareas.length} tarea{tareas.length !== 1 ? "s" : ""}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}