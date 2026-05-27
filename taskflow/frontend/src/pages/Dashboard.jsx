import { hoyLocal } from "../utils/dateHelpers.js";
/**
 * =============================================================
 * Archivo: Dashboard.jsx
 * Versión: v1.0.1
 * -------------------------------------------------------------
 * HISTORIAL:
 *   v1.0.0 - Dashboard completo con ejecución diaria.
 *   v1.0.1 - Fix: opcion "Todos los operadores" en el selector.
 *            Cuando se elige "Todos", el listado no filtra por usuario.
 * =============================================================
 */
import { useState, useEffect, useContext } from "react";
import { AuthContext } from "../context/AuthContext.jsx";
import { api } from "../api/client.js";
import TarjetaTarea    from "../components/tareas/TarjetaTarea.jsx";
import ResumenDia      from "../components/dashboard/ResumenDia.jsx";
import PanelSupervisor from "../components/dashboard/PanelSupervisor.jsx";

const E = {
  card:   { background:"#1f2937", borderRadius:"10px", padding:"14px 16px",
            border:"1px solid #374151" },
  select: { background:"#111827", border:"1px solid #374151", color:"white",
            padding:"7px 10px", borderRadius:"6px", fontSize:"13px" },
};

function fmtFechaLarga(iso) {
  const [a, m, d] = iso.split("-").map(Number);
  return new Date(a, m - 1, d).toLocaleDateString("es-AR", {
    weekday:"long", day:"numeric", month:"long", year:"numeric",
  });
}

function StatCard({ label, valor, color }) {
  const C = {
    indigo:   { bg:"#1e1b4b", text:"#a5b4fc", border:"#6366f1" },
    gris:     { bg:"#111827", text:"#9ca3af",  border:"#374151" },
    verde:    { bg:"#064e3b", text:"#6ee7b7",  border:"#059669" },
    esmeralda:{ bg:"#064e3b", text:"#86efac",  border:"#16a34a" },
    violeta:  { bg:"#2e1065", text:"#c4b5fd",  border:"#7c3aed" },
    rojo:     { bg:"#450a0a", text:"#fca5a5",  border:"#ef4444" },
  };
  const col = C[color] || C.gris;
  return (
    <div style={{ background:col.bg, borderRadius:"8px",
      padding:"12px 14px", border:`1px solid ${col.border}` }}>
      <div style={{ fontSize:"22px", fontWeight:"700", color:col.text }}>{valor}</div>
      <div style={{ fontSize:"11px", color:col.text+"cc", marginTop:"3px" }}>{label}</div>
    </div>
  );
}

/* TODOS_OPERADORES = valor especial para "sin filtro" */
const TODOS = "TODOS";

export default function Dashboard() {
  const { usuario } = useContext(AuthContext);
  const hoyISO = hoyLocal();

  const [fecha, setFecha]               = useState(hoyISO);
  /* "TODOS" = ver todos los operadores; usuario?.id = solo el propio */
  const [operadorFiltro, setOperadorFiltro] = useState(usuario?.id || TODOS);
  const [tareas, setTareas]     = useState([]);
  const [cargando, setCargando] = useState(true);
  const [msgAccion, setMsgAccion] = useState({ texto:"", tipo:"" });
  const [operadores, setOperadores] = useState([]);

  const esSupervisor =
    usuario?.perfiles?.includes("supervisor") ||
    usuario?.perfiles?.includes("dueno")      ||
    usuario?.perfiles?.includes("administrador");

  useEffect(() => {
    if (esSupervisor) {
      api.get("/usuarios/").then(u => setOperadores(u || [])).catch(() => {});
    }
  }, [esSupervisor]);

  useEffect(() => {
    cargarTareas();
    const iv = setInterval(cargarTareas, 30_000);
    return () => clearInterval(iv);
  }, [fecha, operadorFiltro]);

  async function cargarTareas() {
    try {
      /* Si es TODOS, no filtrar por usuario_id */
      let url = `/tareas/?fecha=${fecha}`;
      if (operadorFiltro !== TODOS && operadorFiltro !== usuario?.id) {
        url += `&usuario_id=${operadorFiltro}`;
      } else if (operadorFiltro === usuario?.id && !esSupervisor) {
        /* Operador normal: el backend ya filtra por el usuario actual */
      }
      /* Si es supervisor con TODOS: no agrega usuario_id → backend devuelve todos */
      if (esSupervisor && operadorFiltro !== TODOS && operadorFiltro) {
        url = `/tareas/?fecha=${fecha}&usuario_id=${operadorFiltro}`;
      } else if (esSupervisor && operadorFiltro === TODOS) {
        url = `/tareas/?fecha=${fecha}`;
      }
      const data = await api.get(url);
      setTareas(Array.isArray(data) ? data : []);
    } catch(e) {
      console.error("Error cargando tareas:", e);
    } finally {
      setCargando(false);
    }
  }

  async function accionTarea(tareaId, accion, datos = {}) {
    try {
      await api.post(`/tareas/${tareaId}/${accion}`, datos);
      setMsgAccion({ texto:"✅ Acción registrada", tipo:"ok" });
      setTimeout(() => setMsgAccion({ texto:"", tipo:"" }), 3000);
      await cargarTareas();
    } catch(e) {
      setMsgAccion({ texto:`❌ ${e.message}`, tipo:"error" });
      setTimeout(() => setMsgAccion({ texto:"", tipo:"" }), 4000);
    }
  }

  const ORDEN = { en_curso:0, pendiente:1, pausada:2, completada:3, vencida:4 };
  const tareasOrdenadas = [...tareas].sort((a, b) =>
    (ORDEN[a.estado] ?? 5) - (ORDEN[b.estado] ?? 5)
  );

  const hayEnCurso = tareas.some(t => t.estado === "en_curso");

  const stats = {
    total:              tareas.length,
    pendientes:         tareas.filter(t => t.estado === "pendiente").length,
    en_curso:           tareas.filter(t => t.estado === "en_curso").length,
    completadas:        tareas.filter(t => t.estado === "completada").length,
    vencidas:           tareas.filter(t => t.estado === "vencida").length,
    minutos_trabajados: tareas.reduce((s, t) => s + (t.tiempo_trabajado_minutos || 0), 0),
  };

  return (
    <div style={{ color:"white" }}>

      {/* Encabezado */}
      <div style={{ ...E.card, marginBottom:"20px" }}>
        <div style={{ display:"flex", justifyContent:"space-between",
          alignItems:"center", flexWrap:"wrap", gap:"12px" }}>
          <div>
            <div style={{ fontSize:"20px", fontWeight:"700" }}>✅ TaskFlow Pro</div>
            <div style={{ fontSize:"13px", color:"#9ca3af", marginTop:"2px",
              textTransform:"capitalize" }}>
              {fmtFechaLarga(fecha)}
            </div>
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:"10px" }}>
            {usuario?.foto_url && (
              <img src={usuario.foto_url} alt=""
                style={{ width:"32px", height:"32px", borderRadius:"50%",
                  border:"2px solid #6366f1" }} />
            )}
            <span style={{ fontSize:"13px", color:"#9ca3af" }}>
              {usuario?.nombre} {usuario?.apellido}
            </span>
          </div>
        </div>
      </div>

      {/* Selector de fecha + operador */}
      <div style={{ ...E.card, marginBottom:"20px",
        display:"flex", alignItems:"center", gap:"12px", flexWrap:"wrap" }}>
        <label style={{ color:"#9ca3af", fontSize:"13px" }}>Ver tareas del día:</label>
        <input type="date" value={fecha}
          onChange={e => setFecha(e.target.value)}
          style={E.select} />
        <button style={{ background:"none", border:"none", color:"#6366f1",
          cursor:"pointer", fontSize:"13px", padding:"0" }}
          onClick={() => setFecha(hoyISO)}>
          Hoy
        </button>

        {/* Selector de operador con opción "Todos" */}
        {esSupervisor && (
          <div style={{ marginLeft:"auto", display:"flex", alignItems:"center", gap:"8px" }}>
            <label style={{ color:"#9ca3af", fontSize:"13px" }}>Operador:</label>
            <select style={E.select}
              value={operadorFiltro}
              onChange={e => setOperadorFiltro(e.target.value)}>
              {/* Opción "Todos los operadores" */}
              <option value={TODOS}>Todos los operadores</option>
              {/* Opción "Mis tareas" */}
              <option value={usuario?.id}>Mis tareas</option>
              {/* Resto de operadores */}
              {operadores
                .filter(u => u.id !== usuario?.id)
                .map(u => (
                  <option key={u.id} value={u.id}>
                    {u.nombre} {u.apellido}
                  </option>
                ))}
            </select>
          </div>
        )}
      </div>

      {/* Estadísticas */}
      <div style={{ display:"grid",
        gridTemplateColumns:"repeat(auto-fit, minmax(130px, 1fr))",
        gap:"10px", marginBottom:"20px" }}>
        <StatCard label="Total"       valor={stats.total}       color="gris"       />
        <StatCard label="Pendientes"  valor={stats.pendientes}  color="gris"       />
        <StatCard label="En curso"    valor={stats.en_curso}    color="verde"      />
        <StatCard label="Completadas" valor={stats.completadas} color="esmeralda"  />
        {stats.vencidas > 0 && (
          <StatCard label="Vencidas" valor={stats.vencidas} color="rojo" />
        )}
        <StatCard
          label="Tiempo trabajado"
          valor={stats.minutos_trabajados >= 60
            ? `${Math.floor(stats.minutos_trabajados/60)}h ${stats.minutos_trabajados%60}m`
            : `${stats.minutos_trabajados}m`}
          color="violeta" />
      </div>

      {/* Mensaje de acción */}
      {msgAccion.texto && (
        <div style={{
          background: msgAccion.tipo === "ok" ? "#064e3b" : "#450a0a",
          border:`1px solid ${msgAccion.tipo === "ok" ? "#059669" : "#ef4444"}`,
          color:      msgAccion.tipo === "ok" ? "#6ee7b7" : "#fca5a5",
          padding:"10px 14px", borderRadius:"6px", marginBottom:"16px", fontSize:"13px",
        }}>
          {msgAccion.texto}
        </div>
      )}

      {/* Layout: tareas + panel lateral */}
      <div style={{ display:"grid",
        gridTemplateColumns: esSupervisor ? "1fr 280px" : "1fr",
        gap:"20px", alignItems:"start" }}>

        {/* Lista de tareas */}
        <div>
          <div style={{ display:"flex", justifyContent:"space-between",
            alignItems:"center", marginBottom:"12px" }}>
            <h2 style={{ margin:0, fontSize:"16px", fontWeight:"700" }}>Tareas del día</h2>
            <span style={{ fontSize:"12px", color:"#6b7280" }}>
              {tareas.length} tarea{tareas.length !== 1 ? "s" : ""}
            </span>
          </div>

          {cargando ? (
            <div style={{ textAlign:"center", padding:"48px", color:"#6b7280" }}>
              ⏳ Cargando tareas...
            </div>
          ) : tareasOrdenadas.length === 0 ? (
            <div style={{ ...E.card, textAlign:"center", padding:"48px" }}>
              <div style={{ fontSize:"36px", marginBottom:"12px" }}>🎉</div>
              <div style={{ color:"#9ca3af", fontSize:"14px" }}>No hay tareas para este día</div>
            </div>
          ) : (
            <div style={{ display:"flex", flexDirection:"column", gap:"10px" }}>
              {tareasOrdenadas.map(tarea => (
                <TarjetaTarea
                  key={tarea.id}
                  tarea={tarea}
                  puedeControlar={false}
                  hayTareaEnCurso={hayEnCurso && tarea.estado !== "en_curso"}
                  esCompleja={!!tarea.es_tarea_compleja}
                  onIniciar={()           => accionTarea(tarea.id, "iniciar")}
                  onPausar={motivo        => accionTarea(tarea.id, "pausar",    { motivo })}
                  onReanudar={()          => accionTarea(tarea.id, "reanudar")}
                  onFinalizar={comentario => accionTarea(tarea.id, "finalizar", { comentario_operador: comentario })}
                />
              ))}
            </div>
          )}
        </div>

        {/* Panel lateral supervisor */}
        {esSupervisor && (
          <div style={{ display:"flex", flexDirection:"column", gap:"12px" }}>
            <ResumenDia stats={stats} />
            <PanelSupervisor fecha={fecha} />
          </div>
        )}
      </div>

      {/* ResumenDia para operadores */}
      {!esSupervisor && tareas.length > 0 && (
        <div style={{ marginTop:"20px" }}>
          <ResumenDia stats={stats} />
        </div>
      )}
    </div>
  );
}