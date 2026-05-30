/**
 * =============================================================
 * Archivo: Seguimiento.jsx
 * Versión: v1.1.0
 * -------------------------------------------------------------
 * DESCRIPCION FUNCIONAL:
 *   v1.1.0: historial y auditoría no cargan al entrar.
 *   La pantalla espera que el usuario elija al menos un filtro
 *   y presione "Buscar" antes de traer datos. Esto evita
 *   traer cientos de registros sin filtrar al abrir la pantalla.
 *
 * HISTORIAL:
 *   v1.0.0 - Pantalla inicial.
 *   v1.1.0 - No carga automáticamente al montar. Espera acción.
 * =============================================================
 */
import { useState, useContext } from "react";
import { api } from "../api/client.js";
import { AuthContext } from "../context/AuthContext.jsx";

const ESTADO_CONFIG = {
  pendiente:  { color:"#93c5fd", border:"#2563eb", bg:"#1e3a5f" },
  en_curso:   { color:"#6ee7b7", border:"#059669", bg:"#064e3b" },
  pausada:    { color:"#fde68a", border:"#d97706", bg:"#78350f" },
  completada: { color:"#86efac", border:"#16a34a", bg:"#1a2e1a" },
  vencida:    { color:"#fca5a5", border:"#ef4444", bg:"#450a0a" },
};
const PRIO_COLOR = {
  urgente:"#ef4444", alta:"#f97316", media:"#eab308", baja:"#22c55e",
};

const E = {
  input:   { background:"#111827", border:"1px solid #374151", color:"white",
             padding:"7px 10px", borderRadius:"6px", fontSize:"13px", boxSizing:"border-box" },
  select:  { background:"#111827", border:"1px solid #374151", color:"white",
             padding:"7px 10px", borderRadius:"6px", fontSize:"13px" },
  btn:     { background:"#6366f1", color:"white", border:"none", padding:"7px 14px",
             borderRadius:"6px", cursor:"pointer", fontSize:"13px", fontWeight:"500" },
  btnGris: { background:"#374151", color:"white", border:"none", padding:"7px 14px",
             borderRadius:"6px", cursor:"pointer", fontSize:"13px" },
  badge:   { fontSize:"10px", padding:"2px 7px", borderRadius:"8px",
             fontWeight:"600", display:"inline-block" },
  th:      { textAlign:"left", padding:"10px 14px", fontWeight:"600",
             color:"#9ca3af", fontSize:"12px", whiteSpace:"nowrap" },
  td:      { padding:"10px 14px", fontSize:"12px", verticalAlign:"top" },
};

function fmtFecha(iso) {
  if (!iso) return "—";
  return iso.split("T")[0].split("-").reverse().join("/");
}
function fmtFechaHora(iso) {
  if (!iso) return "—";
  const [f, h] = iso.split("T");
  return `${f.split("-").reverse().join("/")} ${h?.slice(0,5)||""}`;
}
function fmtTiempo(m) {
  if (!m) return "—";
  if (m < 60) return `${m} min`;
  return `${Math.floor(m/60)}h ${m%60}m`;
}

function exportarCSV(datos, nombre) {
  if (!datos.length) return;
  const cols  = Object.keys(datos[0]);
  const lineas = [
    cols.join(","),
    ...datos.map(r => cols.map(c =>
      `"${String(r[c] ?? "").replace(/"/g,'""')}"`).join(","))
  ];
  const blob = new Blob([lineas.join("\n")], { type:"text/csv;charset=utf-8;" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href = url; a.download = nombre; a.click();
  URL.revokeObjectURL(url);
}

/* =============================================================
   TabHistorial — espera búsqueda manual
   ============================================================= */
function TabHistorial({ esSupervisor }) {
  const hoy = new Date().toISOString().split("T")[0];
  const [tareas, setTareas]         = useState(null); /* null = sin buscar aún */
  const [cargando, setCargando]     = useState(false);
  const [operadores, setOperadores] = useState([]);
  const [clientes, setClientes]     = useState([]);
  const [datosOk, setDatosOk]       = useState(false);

  const [filtros, setFiltros] = useState({
    fecha_desde: hoy,
    fecha_hasta: hoy,
    usuario_id:  "",
    cliente_id:  "",
    estado:      "",
    prioridad:   "",
  });

  /* Cargar maestros solo cuando el usuario abre el tab por primera vez */
  function cargarMaestros() {
    if (datosOk || !esSupervisor) return;
    Promise.all([
      api.get("/usuarios/"),
      api.get("/clientes/?activo=true"),
    ]).then(([u, c]) => {
      setOperadores(u || []);
      setClientes(c   || []);
      setDatosOk(true);
    }).catch(() => setDatosOk(true));
  }

  async function buscar() {
    cargarMaestros();
    setCargando(true);
    setTareas(null);
    try {
      let url = `/tareas/historial?fecha_desde=${filtros.fecha_desde}&fecha_hasta=${filtros.fecha_hasta}`;
      if (filtros.usuario_id) url += `&usuario_id=${filtros.usuario_id}`;
      if (filtros.cliente_id) url += `&cliente_id=${filtros.cliente_id}`;
      if (filtros.estado)     url += `&estado=${filtros.estado}`;
      let data = await api.get(url);
      if (!Array.isArray(data)) data = [];
      /* Filtro de prioridad en cliente (no está en el backend) */
      if (filtros.prioridad) data = data.filter(t => t.prioridad === filtros.prioridad);
      setTareas(data);
    } catch(e) {
      console.error("Error historial:", e);
      setTareas([]);
    }
    setCargando(false);
  }

  function setF(campo, valor) {
    setFiltros(prev => ({ ...prev, [campo]: valor }));
  }

  const stats = tareas ? {
    total:       tareas.length,
    completadas: tareas.filter(t => t.estado === "completada").length,
    vencidas:    tareas.filter(t => t.estado === "vencida").length,
    mins:        tareas.reduce((s, t) => s + (t.tiempo_trabajado_minutos || 0), 0),
  } : null;

  return (
    <div>
      {/* Panel de filtros */}
      <div style={{ background:"#1f2937", borderRadius:"8px", padding:"14px",
        border:"1px solid #374151", marginBottom:"16px" }}>
        <div style={{ display:"grid", gap:"10px",
          gridTemplateColumns:"repeat(auto-fill, minmax(160px, 1fr))" }}>
          <div>
            <div style={{ fontSize:"11px", color:"#9ca3af", marginBottom:"3px" }}>Desde *</div>
            <input type="date" style={E.input} value={filtros.fecha_desde}
              onChange={e => setF("fecha_desde", e.target.value)} />
          </div>
          <div>
            <div style={{ fontSize:"11px", color:"#9ca3af", marginBottom:"3px" }}>Hasta *</div>
            <input type="date" style={E.input} value={filtros.fecha_hasta}
              onChange={e => setF("fecha_hasta", e.target.value)} />
          </div>
          {esSupervisor && (
            <div>
              <div style={{ fontSize:"11px", color:"#9ca3af", marginBottom:"3px" }}>Operador</div>
              <select style={E.select} value={filtros.usuario_id}
                onChange={e => setF("usuario_id", e.target.value)}
                onClick={cargarMaestros}>
                <option value="">Todos</option>
                {operadores.map(u => (
                  <option key={u.id} value={u.id}>{u.nombre} {u.apellido}</option>
                ))}
              </select>
            </div>
          )}
          {esSupervisor && (
            <div>
              <div style={{ fontSize:"11px", color:"#9ca3af", marginBottom:"3px" }}>Cliente</div>
              <select style={E.select} value={filtros.cliente_id}
                onChange={e => setF("cliente_id", e.target.value)}
                onClick={cargarMaestros}>
                <option value="">Todos</option>
                {clientes.map(c => (
                  <option key={c.id} value={c.id}>{c.razon_social}</option>
                ))}
              </select>
            </div>
          )}
          <div>
            <div style={{ fontSize:"11px", color:"#9ca3af", marginBottom:"3px" }}>Estado</div>
            <select style={E.select} value={filtros.estado}
              onChange={e => setF("estado", e.target.value)}>
              <option value="">Todos</option>
              <option value="pendiente">Pendiente</option>
              <option value="en_curso">En curso</option>
              <option value="pausada">Pausada</option>
              <option value="completada">Completada</option>
              <option value="vencida">Vencida</option>
            </select>
          </div>
          <div>
            <div style={{ fontSize:"11px", color:"#9ca3af", marginBottom:"3px" }}>Prioridad</div>
            <select style={E.select} value={filtros.prioridad}
              onChange={e => setF("prioridad", e.target.value)}>
              <option value="">Todas</option>
              <option value="urgente">🔴 Urgente</option>
              <option value="alta">🟠 Alta</option>
              <option value="media">🟡 Media</option>
              <option value="baja">🟢 Baja</option>
            </select>
          </div>
        </div>
        <div style={{ display:"flex", gap:"8px", marginTop:"12px", alignItems:"center" }}>
          <button style={E.btn} onClick={buscar} disabled={cargando}>
            {cargando ? "⏳ Buscando..." : "🔍 Buscar"}
          </button>
          {tareas && tareas.length > 0 && (
            <button style={E.btnGris} onClick={() => exportarCSV(
              tareas.map(t => ({
                fecha:      t.fecha_planificada,
                tarea:      t.tarea_nombre,
                operador:   t.operador_nombre,
                cliente:    t.cliente_nombre || "",
                estado:     t.estado,
                prioridad:  t.prioridad,
                tiempo_min: t.tiempo_trabajado_minutos || 0,
              })),
              `tareas_${filtros.fecha_desde}_${filtros.fecha_hasta}.csv`
            )}>
              ⬇ CSV
            </button>
          )}
          {tareas !== null && (
            <span style={{ color:"#6b7280", fontSize:"12px", marginLeft:"auto" }}>
              {tareas.length} resultado{tareas.length !== 1 ? "s" : ""}
            </span>
          )}
        </div>
      </div>

      {/* Estado inicial — esperando búsqueda */}
      {tareas === null && !cargando && (
        <div style={{ textAlign:"center", padding:"60px", color:"#6b7280" }}>
          <div style={{ fontSize:"36px", marginBottom:"12px" }}>🔍</div>
          <div style={{ fontSize:"14px" }}>
            Elegí un rango de fechas y presioná <strong style={{ color:"#6366f1" }}>Buscar</strong>
          </div>
          <div style={{ fontSize:"12px", marginTop:"8px", color:"#4b5563" }}>
            Podés combinar múltiples filtros antes de buscar
          </div>
        </div>
      )}

      {/* Cargando */}
      {cargando && (
        <div style={{ textAlign:"center", padding:"40px", color:"#6b7280" }}>
          ⏳ Buscando tareas...
        </div>
      )}

      {/* Resumen rápido */}
      {stats && tareas.length > 0 && (
        <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)",
          gap:"8px", marginBottom:"14px" }}>
          {[
            { l:"Total",       v:stats.total,       c:"#6366f1" },
            { l:"Completadas", v:stats.completadas, c:"#16a34a" },
            { l:"Vencidas",    v:stats.vencidas,    c:"#ef4444" },
            { l:"Tiempo total",v:fmtTiempo(stats.mins), c:"#7c3aed" },
          ].map(s => (
            <div key={s.l} style={{ background:"#111827", borderRadius:"6px",
              padding:"8px 10px", border:`1px solid ${s.c}33` }}>
              <div style={{ fontSize:"16px", fontWeight:"700", color:s.c }}>{s.v}</div>
              <div style={{ fontSize:"11px", color:"#9ca3af", marginTop:"2px" }}>{s.l}</div>
            </div>
          ))}
        </div>
      )}

      {/* Sin resultados */}
      {tareas !== null && !cargando && tareas.length === 0 && (
        <div style={{ textAlign:"center", padding:"40px", color:"#6b7280", fontSize:"13px" }}>
          Sin resultados para los filtros aplicados
        </div>
      )}

      {/* Tabla */}
      {tareas && tareas.length > 0 && (
        <div style={{ background:"#111827", borderRadius:"8px",
          border:"1px solid #1f2937", overflowX:"auto" }}>
          <table style={{ width:"100%", borderCollapse:"collapse", fontSize:"12px" }}>
            <thead>
              <tr style={{ background:"#1f2937" }}>
                <th style={E.th}>Fecha</th>
                <th style={E.th}>Tarea</th>
                {esSupervisor && <th style={E.th}>Operador</th>}
                <th style={E.th}>Cliente</th>
                <th style={E.th}>Estado</th>
                <th style={E.th}>Prioridad</th>
                <th style={E.th}>Tiempo</th>
              </tr>
            </thead>
            <tbody>
              {tareas.map(t => {
                const cfg     = ESTADO_CONFIG[t.estado] || ESTADO_CONFIG.pendiente;
                const colPrio = PRIO_COLOR[t.prioridad] || "#6b7280";
                return (
                  <tr key={t.id} style={{ borderTop:"1px solid #1f2937" }}>
                    <td style={{ ...E.td, color:"#9ca3af", whiteSpace:"nowrap" }}>
                      {fmtFecha(t.fecha_planificada)}
                    </td>
                    <td style={{ ...E.td, color:"white", fontWeight:"500" }}>
                      {t.tarea_nombre}
                      {t.tarea_codigo && (
                        <span style={{ color:"#6b7280", fontFamily:"monospace",
                          fontSize:"10px", marginLeft:"6px" }}>
                          [{t.tarea_codigo}]
                        </span>
                      )}
                      {t.es_heredada && (
                        <span style={{ marginLeft:"6px", fontSize:"10px",
                          background:"#1e1b4b", color:"#a5b4fc",
                          padding:"1px 5px", borderRadius:"6px",
                          border:"1px solid #6366f1" }}>
                          ↩ heredada
                        </span>
                      )}
                      {t.comentario_supervisor && (
                        <div style={{ fontSize:"11px", color:"#9ca3af", marginTop:"2px" }}>
                          💬 {t.comentario_supervisor}
                        </div>
                      )}
                    </td>
                    {esSupervisor && (
                      <td style={{ ...E.td, color:"#9ca3af", whiteSpace:"nowrap" }}>
                        {t.operador_nombre || "—"}
                      </td>
                    )}
                    <td style={{ ...E.td, color:"#9ca3af" }}>
                      {t.cliente_nombre || "—"}
                      {t.servicio_nombre && (
                        <div style={{ fontSize:"10px", color:"#6b7280" }}>
                          🔧 {t.servicio_nombre}
                        </div>
                      )}
                    </td>
                    <td style={{ ...E.td, whiteSpace:"nowrap" }}>
                      <span style={{ ...E.badge, background:cfg.bg,
                        color:cfg.color, border:`1px solid ${cfg.border}` }}>
                        {t.estado.replace("_"," ")}
                      </span>
                    </td>
                    <td style={E.td}>
                      <span style={{ ...E.badge, background:colPrio+"22",
                        color:colPrio, border:`1px solid ${colPrio}` }}>
                        {t.prioridad}
                      </span>
                    </td>
                    <td style={{ ...E.td, color:"#9ca3af", whiteSpace:"nowrap" }}>
                      {(() => {
                        let mins = t.tiempo_trabajado_minutos || 0;
                        if (t.estado === "en_curso" && t.inicio_real) {
                          mins += Math.floor((Date.now() - new Date(t.inicio_real)) / 60000);
                        }
                        const s = fmtTiempo(mins);
                        return t.estado === "en_curso"
                          ? <span style={{ color:"#10b981" }}>{s} ▶</span>
                          : t.estado === "pausada"
                          ? <span style={{ color:"#f59e0b" }}>{s} ⏸</span>
                          : s;
                      })()}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* =============================================================
   TabAuditoria — espera búsqueda manual
   ============================================================= */
function TabAuditoria() {
  const [logs, setLogs]       = useState(null); /* null = sin buscar aún */
  const [cargando, setCargando] = useState(false);
  const hoy = new Date().toISOString().split("T")[0];
  const [desde, setDesde]     = useState(hoy);
  const [hasta, setHasta]     = useState(hoy);
  const [tabla, setTabla]     = useState("");
  const [operacion, setOper]  = useState("");

  async function buscar() {
    setCargando(true);
    setLogs(null);
    try {
      let url = `/auditoria/?desde=${desde}&hasta=${hasta}`;
      if (tabla)     url += `&tabla=${tabla}`;
      if (operacion) url += `&operacion=${operacion}`;
      const data = await api.get(url);
      setLogs(Array.isArray(data) ? data : []);
    } catch(e) {
      console.error("Error auditoria:", e);
      setLogs([]);
    }
    setCargando(false);
  }

  const OP_COLOR = {
    INSERT: { bg:"#064e3b", color:"#6ee7b7", border:"#059669" },
    UPDATE: { bg:"#1e3a5f", color:"#93c5fd", border:"#2563eb" },
    DELETE: { bg:"#450a0a", color:"#fca5a5", border:"#ef4444" },
  };

  return (
    <div>
      {/* Filtros */}
      <div style={{ background:"#1f2937", borderRadius:"8px", padding:"14px",
        border:"1px solid #374151", marginBottom:"16px" }}>
        <div style={{ display:"grid", gap:"10px",
          gridTemplateColumns:"repeat(auto-fill, minmax(150px, 1fr))" }}>
          <div>
            <div style={{ fontSize:"11px", color:"#9ca3af", marginBottom:"3px" }}>Desde *</div>
            <input type="date" style={E.input} value={desde}
              onChange={e => setDesde(e.target.value)} />
          </div>
          <div>
            <div style={{ fontSize:"11px", color:"#9ca3af", marginBottom:"3px" }}>Hasta *</div>
            <input type="date" style={E.input} value={hasta}
              onChange={e => setHasta(e.target.value)} />
          </div>
          <div>
            <div style={{ fontSize:"11px", color:"#9ca3af", marginBottom:"3px" }}>Tabla</div>
            <select style={E.select} value={tabla} onChange={e => setTabla(e.target.value)}>
              <option value="">Todas</option>
              <option value="tareas">tareas</option>
              <option value="clientes">clientes</option>
              <option value="usuarios">usuarios</option>
              <option value="cliente_servicios">cliente_servicios</option>
              <option value="catalogo_tareas">catalogo_tareas</option>
            </select>
          </div>
          <div>
            <div style={{ fontSize:"11px", color:"#9ca3af", marginBottom:"3px" }}>Operación</div>
            <select style={E.select} value={operacion} onChange={e => setOper(e.target.value)}>
              <option value="">Todas</option>
              <option value="INSERT">INSERT</option>
              <option value="UPDATE">UPDATE</option>
              <option value="DELETE">DELETE</option>
            </select>
          </div>
        </div>
        <div style={{ display:"flex", gap:"8px", marginTop:"12px", alignItems:"center" }}>
          <button style={E.btn} onClick={buscar} disabled={cargando}>
            {cargando ? "⏳ Buscando..." : "🔍 Buscar"}
          </button>
          {logs !== null && (
            <span style={{ color:"#6b7280", fontSize:"12px", marginLeft:"auto" }}>
              {logs.length} evento{logs.length !== 1 ? "s" : ""}
            </span>
          )}
        </div>
      </div>

      {/* Estado inicial */}
      {logs === null && !cargando && (
        <div style={{ textAlign:"center", padding:"60px", color:"#6b7280" }}>
          <div style={{ fontSize:"36px", marginBottom:"12px" }}>🔐</div>
          <div style={{ fontSize:"14px" }}>
            Elegí un rango de fechas y presioná <strong style={{ color:"#6366f1" }}>Buscar</strong>
          </div>
        </div>
      )}

      {cargando && (
        <div style={{ textAlign:"center", padding:"40px", color:"#6b7280" }}>
          ⏳ Buscando eventos...
        </div>
      )}

      {logs !== null && !cargando && logs.length === 0 && (
        <div style={{ textAlign:"center", padding:"40px", color:"#6b7280", fontSize:"13px" }}>
          Sin eventos para los filtros aplicados
        </div>
      )}

      {logs && logs.length > 0 && (
        <div style={{ background:"#111827", borderRadius:"8px",
          border:"1px solid #1f2937", overflowX:"auto" }}>
          <table style={{ width:"100%", borderCollapse:"collapse", fontSize:"12px" }}>
            <thead>
              <tr style={{ background:"#1f2937" }}>
                <th style={E.th}>Timestamp</th>
                <th style={E.th}>Operación</th>
                <th style={E.th}>Tabla</th>
                <th style={E.th}>Usuario</th>
                <th style={E.th}>Campo</th>
                <th style={E.th}>Anterior</th>
                <th style={E.th}>Nuevo</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((l, i) => {
                const op = OP_COLOR[l.operacion] || OP_COLOR.UPDATE;
                return (
                  <tr key={i} style={{ borderTop:"1px solid #1f2937" }}>
                    <td style={{ ...E.td, color:"#9ca3af", whiteSpace:"nowrap" }}>
                      {fmtFechaHora(l.timestamp_accion)}
                    </td>
                    <td style={E.td}>
                      <span style={{ ...E.badge, background:op.bg,
                        color:op.color, border:`1px solid ${op.border}` }}>
                        {l.operacion}
                      </span>
                    </td>
                    <td style={{ ...E.td, color:"#818cf8", fontFamily:"monospace" }}>
                      {l.tabla_afectada}
                    </td>
                    <td style={{ ...E.td, color:"#9ca3af" }}>{l.usuario_nombre || "—"}</td>
                    <td style={{ ...E.td, color:"#9ca3af", fontFamily:"monospace" }}>
                      {l.campo_modificado || "—"}
                    </td>
                    <td style={{ ...E.td, color:"#fca5a5", maxWidth:"120px",
                      overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                      {l.valor_anterior || "—"}
                    </td>
                    <td style={{ ...E.td, color:"#6ee7b7", maxWidth:"120px",
                      overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                      {l.valor_nuevo || "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* =============================================================
   COMPONENTE PRINCIPAL: Seguimiento
   ============================================================= */
export default function Seguimiento() {
  const { usuario } = useContext(AuthContext);
  const [tab, setTab] = useState("historial");

  const esSupervisor =
    usuario?.perfiles?.includes("supervisor") ||
    usuario?.perfiles?.includes("dueno")      ||
    usuario?.perfiles?.includes("administrador");

  const esAdmin =
    usuario?.perfiles?.includes("administrador") ||
    usuario?.perfiles?.includes("dueno");

  return (
    <div style={{ color:"white" }}>
      <div style={{ marginBottom:"20px" }}>
        <h1 style={{ margin:"0 0 4px", fontSize:"22px" }}>🔍 Seguimiento</h1>
        <div style={{ fontSize:"13px", color:"#6b7280" }}>
          Historial de tareas y log de auditoría
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display:"flex", gap:"4px", marginBottom:"20px",
        borderBottom:"1px solid #374151" }}>
        {[
          { id:"historial", label:"📋 Historial de tareas" },
          ...(esAdmin ? [{ id:"auditoria", label:"🔐 Log de auditoría" }] : []),
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{
              background:   tab === t.id ? "#1f2937" : "transparent",
              color:        tab === t.id ? "white"   : "#6b7280",
              border:       tab === t.id ? "1px solid #374151" : "1px solid transparent",
              borderBottom: tab === t.id ? "1px solid #1f2937" : "1px solid transparent",
              padding:"8px 16px", borderRadius:"6px 6px 0 0",
              cursor:"pointer", fontSize:"13px",
              fontWeight: tab === t.id ? "600" : "400",
              marginBottom:"-1px",
            }}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === "historial" && <TabHistorial esSupervisor={esSupervisor} />}
      {tab === "auditoria" && esAdmin && <TabAuditoria />}
    </div>
  );
}