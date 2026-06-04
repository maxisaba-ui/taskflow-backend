/**
 * Registro de Trabajo
 * Consulta mensual de tareas ejecutadas por cliente o por tipo de tarea.
 * Soporta exportación CSV y detalle de etapas en tareas complejas.
 */
import { useState, useEffect, useRef, useContext } from "react";
import { api } from "../api/client.js";
import { AuthContext } from "../context/AuthContext.jsx";

const MESES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio",
               "Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];

const ESTADO_CFG = {
  completada:  { color:"#86efac", border:"#16a34a", bg:"#1a2e1a" },
  vencida:     { color:"#fca5a5", border:"#ef4444", bg:"#450a0a" },
  en_curso:    { color:"#6ee7b7", border:"#059669", bg:"#064e3b" },
  pausada:     { color:"#fde68a", border:"#d97706", bg:"#78350f" },
  pendiente:   { color:"#93c5fd", border:"#2563eb", bg:"#1e3a5f" },
  validacion_pendiente: { color:"#fde68a", border:"#d97706", bg:"#78350f" },
};

const E = {
  btn:     { background:"#6366f1", color:"white", border:"none", padding:"7px 14px",
             borderRadius:"6px", cursor:"pointer", fontSize:"13px", fontWeight:"500" },
  btnGris: { background:"#374151", color:"white", border:"none", padding:"7px 14px",
             borderRadius:"6px", cursor:"pointer", fontSize:"13px" },
  th:      { textAlign:"left", padding:"9px 12px", fontWeight:"600", color:"#9ca3af",
             fontSize:"11px", whiteSpace:"nowrap", background:"#1a2030" },
  td:      { padding:"9px 12px", fontSize:"12px", verticalAlign:"top" },
  badge:   { fontSize:"10px", padding:"2px 6px", borderRadius:"8px",
             fontWeight:"600", display:"inline-block" },
  check:   { accentColor:"#6366f1", width:"14px", height:"14px", cursor:"pointer" },
};

/* ── helpers ─────────────────────────────────────────────── */
function fmtFecha(iso) {
  if (!iso) return "—";
  const d = iso.split("T")[0].split("-");
  return `${d[2]}/${d[1]}/${d[0]}`;
}
function fmtTiempo(m) {
  if (!m) return "—";
  if (m < 60) return `${m}m`;
  return `${Math.floor(m/60)}h${m%60 ? ` ${m%60}m` : ""}`;
}
function exportarCSV(datos, nombre) {
  if (!datos.length) return;
  const cols   = Object.keys(datos[0]);
  const lineas = [
    cols.join(","),
    ...datos.map(r => cols.map(c => `"${String(r[c]??'').replace(/"/g,'""')}"`).join(",")),
  ];
  const blob = new Blob([lineas.join("\n")], { type:"text/csv;charset=utf-8;" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href = url; a.download = nombre; a.click();
  URL.revokeObjectURL(url);
}
function pasosDe(instancias) {
  const map = {};
  instancias.forEach(t => (t.etapas||[]).forEach(e => {
    if (!map[e.orden]) map[e.orden] = e.nombre;
  }));
  return Object.entries(map)
    .sort(([a],[b]) => +a - +b)
    .map(([orden, nombre]) => ({ orden: +orden, nombre }));
}

/* ── MultiSelect con checkboxes ────────────────────────── */
function MultiSelect({ opciones, seleccionados, onChange, placeholder }) {
  const [abierto, setAbierto] = useState(false);
  const ref = useRef();

  useEffect(() => {
    function h(e) { if (ref.current && !ref.current.contains(e.target)) setAbierto(false); }
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  function toggle(id) {
    onChange(seleccionados.includes(id)
      ? seleccionados.filter(x => x !== id)
      : [...seleccionados, id]);
  }
  function toggleAll() {
    onChange(seleccionados.length === opciones.length ? [] : opciones.map(o => o.id));
  }

  const label = seleccionados.length === 0 ? placeholder
    : seleccionados.length === opciones.length ? "Todos"
    : `${seleccionados.length} seleccionado${seleccionados.length > 1 ? "s" : ""}`;

  return (
    <div ref={ref} style={{ position:"relative" }}>
      <button onClick={() => setAbierto(!abierto)} style={{
        background:"#111827", border:"1px solid #374151", color:"white",
        padding:"7px 10px", borderRadius:"6px", fontSize:"13px", cursor:"pointer",
        width:"100%", textAlign:"left", display:"flex", justifyContent:"space-between",
        alignItems:"center", gap:"8px",
      }}>
        <span style={{ color: seleccionados.length ? "white" : "#6b7280",
          overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
          {label}
        </span>
        <span style={{ color:"#6b7280", fontSize:"10px", flexShrink:0 }}>
          {abierto ? "▲" : "▼"}
        </span>
      </button>
      {abierto && (
        <div style={{
          position:"absolute", top:"calc(100% + 2px)", left:0, right:0, zIndex:100,
          background:"#1f2937", border:"1px solid #374151", borderRadius:"6px",
          maxHeight:"240px", overflowY:"auto", boxShadow:"0 6px 16px #00000077",
        }}>
          <div onClick={toggleAll} style={{
            padding:"8px 12px", cursor:"pointer", fontSize:"12px",
            color:"#9ca3af", borderBottom:"1px solid #374151",
            display:"flex", gap:"8px", alignItems:"center",
            background: seleccionados.length === opciones.length ? "#374151" : "transparent",
          }}>
            <input type="checkbox" readOnly style={E.check}
              checked={seleccionados.length === opciones.length} />
            <span>Todos</span>
          </div>
          {opciones.map(o => (
            <div key={o.id} onClick={() => toggle(o.id)} style={{
              padding:"7px 12px", cursor:"pointer", fontSize:"12px",
              display:"flex", gap:"8px", alignItems:"center",
              color: seleccionados.includes(o.id) ? "white" : "#9ca3af",
              background: seleccionados.includes(o.id) ? "#2d3748" : "transparent",
            }}>
              <input type="checkbox" readOnly style={E.check}
                checked={seleccionados.includes(o.id)} />
              <span>{o.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Badge estado ───────────────────────────────────────── */
function EstadoBadge({ estado }) {
  const cfg = ESTADO_CFG[estado] || ESTADO_CFG.pendiente;
  return (
    <span style={{ ...E.badge, background:cfg.bg,
      color:cfg.color, border:`1px solid ${cfg.border}` }}>
      {estado?.replace("_"," ") || "—"}
    </span>
  );
}

/* ── Badge "fue vencida" ─────────────────────────────────── */
function BadgeVencida() {
  return (
    <span style={{ ...E.badge, background:"#431407", color:"#fb923c",
      border:"1px solid #ea580c" }}>
      ⚠ fue vencida
    </span>
  );
}

/* ── Tabla modo "por cliente" ────────────────────────────── */
function TablaPorCliente({ tareas, mostrarVencida, mostrarSLA, esSupervisor }) {
  const [expandidas, setExp] = useState({});
  const [todasExp,   setTodas] = useState(false);

  const grupos = {};
  tareas.forEach(t => {
    const k = t.cliente_id || "__sin__";
    if (!grupos[k]) grupos[k] = { nombre: t.cliente_nombre || "Sin cliente", tareas:[] };
    grupos[k].tareas.push(t);
  });

  const hayComplejas = tareas.some(t => t.es_tarea_compleja && t.etapas?.length);

  function expandirTodas(val) {
    setTodas(val);
    const n = {};
    tareas.filter(t => t.es_tarea_compleja).forEach(t => { n[t.id] = val; });
    setExp(n);
  }

  function csvData() {
    const filas = [];
    tareas.forEach(t => {
      filas.push({
        cliente:     t.cliente_nombre || "",
        fecha:       t.fecha_planificada || "",
        tarea:       t.tarea_nombre,
        codigo:      t.tarea_codigo,
        tipo:        t.es_tarea_compleja ? "compleja" : "simple",
        operador:    t.operador_nombre,
        estado:      t.estado,
        fue_vencida: t.fue_vencida ? "sí" : "no",
        tiempo_min:  t.tiempo_trabajado_minutos || 0,
      });
      if (t.es_tarea_compleja) {
        (t.etapas||[]).forEach(e => filas.push({
          cliente:     "",
          fecha:       e.fin_real?.split("T")[0] || "",
          tarea:       `  └ Paso ${e.orden}: ${e.nombre}`,
          codigo:      "",
          tipo:        "etapa",
          operador:    "",
          estado:      e.estado,
          fue_vencida: e.sla_vencido ? "sí" : "no",
          tiempo_min:  e.tiempo_trabajado_minutos || 0,
        }));
      }
    });
    return filas;
  }

  return (
    <div>
      <div style={{ display:"flex", gap:"8px", justifyContent:"flex-end",
        marginBottom:"10px", flexWrap:"wrap" }}>
        {hayComplejas && (
          <button style={E.btnGris} onClick={() => expandirTodas(!todasExp)}>
            {todasExp ? "⊖ Comprimir todas" : "⊕ Expandir todas"}
          </button>
        )}
        <button style={E.btnGris} onClick={() => exportarCSV(csvData(), "registro_por_cliente.csv")}>
          ⬇ Exportar CSV
        </button>
      </div>

      {Object.values(grupos).map((g, gi) => (
        <div key={gi} style={{ marginBottom:"16px", background:"#111827",
          borderRadius:"8px", border:"1px solid #1f2937", overflow:"hidden" }}>
          {/* Cabecera cliente */}
          <div style={{ background:"#1f2937", padding:"10px 14px",
            borderBottom:"1px solid #374151",
            display:"flex", alignItems:"center", gap:"8px", flexWrap:"wrap" }}>
            <span style={{ fontSize:"14px", fontWeight:"700", color:"white" }}>
              🏢 {g.nombre}
            </span>
            <span style={{ fontSize:"11px", color:"#6b7280" }}>
              {g.tareas.length} tarea{g.tareas.length !== 1 ? "s" : ""}
            </span>
          </div>

          <table style={{ width:"100%", borderCollapse:"collapse", fontSize:"12px" }}>
            <thead>
              <tr>
                <th style={E.th}>Fecha</th>
                <th style={E.th}>Tarea</th>
                {esSupervisor && <th style={E.th}>Operador</th>}
                <th style={E.th}>Estado</th>
                {mostrarVencida && <th style={E.th}>Vencida</th>}
                <th style={E.th}>Tiempo</th>
              </tr>
            </thead>
            <tbody>
              {g.tareas.map(t => {
                const exp = expandidas[t.id];
                const tieneEtapas = t.es_tarea_compleja && t.etapas?.length > 0;
                return (
                  <>
                    <tr key={t.id} style={{ borderTop:"1px solid #1f2937" }}>
                      <td style={{ ...E.td, color:"#9ca3af", whiteSpace:"nowrap" }}>
                        {fmtFecha(t.fecha_planificada)}
                      </td>
                      <td style={E.td}>
                        <div style={{ display:"flex", alignItems:"center", gap:"6px", flexWrap:"wrap" }}>
                          {tieneEtapas && (
                            <button onClick={() => setExp(p => ({...p,[t.id]:!p[t.id]}))}
                              style={{ background:"none", border:"none", cursor:"pointer",
                                color:"#6366f1", fontSize:"12px", padding:0 }}>
                              {exp ? "▼" : "▶"}
                            </button>
                          )}
                          <span style={{ color:"white", fontWeight:"500" }}>{t.tarea_nombre}</span>
                          {t.tarea_codigo && (
                            <span style={{ color:"#6b7280", fontFamily:"monospace", fontSize:"10px" }}>
                              [{t.tarea_codigo}]
                            </span>
                          )}
                          {t.es_tarea_compleja && (
                            <span style={{ ...E.badge, background:"#1e1b4b",
                              color:"#a5b4fc", border:"1px solid #6366f1" }}>
                              🔀 compleja
                            </span>
                          )}
                        </div>
                      </td>
                      {esSupervisor && (
                        <td style={{ ...E.td, color:"#9ca3af" }}>{t.operador_nombre || "—"}</td>
                      )}
                      <td style={E.td}><EstadoBadge estado={t.estado} /></td>
                      {mostrarVencida && (
                        <td style={E.td}>{t.fue_vencida ? <BadgeVencida /> : <span style={{ color:"#374151" }}>—</span>}</td>
                      )}
                      <td style={{ ...E.td, color:"#9ca3af", whiteSpace:"nowrap" }}>
                        {fmtTiempo(t.tiempo_trabajado_minutos)}
                      </td>
                    </tr>
                    {tieneEtapas && exp && (t.etapas||[]).map((e, ei) => (
                      <tr key={ei} style={{ borderTop:"1px solid #0d1117", background:"#0a0f1a" }}>
                        <td style={{ ...E.td, color:"#374151", paddingLeft:"28px", whiteSpace:"nowrap" }}>
                          {fmtFecha(e.fin_real)}
                        </td>
                        <td style={{ ...E.td, paddingLeft:"28px" }}>
                          <div style={{ display:"flex", alignItems:"center", gap:"6px", flexWrap:"wrap" }}>
                            <span style={{ color:"#2d3748" }}>└</span>
                            <span style={{ color:"#475569" }}>#{e.orden}</span>
                            <span style={{ color:"#94a3b8" }}>{e.nombre}</span>
                            {e.sla_vencido && (
                              <span style={{ ...E.badge, background:"#450a0a",
                                color:"#fca5a5", border:"1px solid #ef4444" }}>
                                ⚠ SLA vencido
                              </span>
                            )}
                            {mostrarSLA && e.vencimiento_sla && (
                              <span style={{ fontSize:"10px", color:"#4b5563" }}>
                                SLA: {fmtFecha(e.vencimiento_sla)}
                              </span>
                            )}
                          </div>
                        </td>
                        {esSupervisor && <td style={{ ...E.td, color:"#374151" }}>—</td>}
                        <td style={E.td}><EstadoBadge estado={e.estado} /></td>
                        {mostrarVencida && (
                          <td style={E.td}>
                            {e.sla_vencido
                              ? <span style={{ ...E.badge, background:"#431407",
                                  color:"#fb923c", border:"1px solid #ea580c" }}>⚠ SLA</span>
                              : <span style={{ color:"#1f2937" }}>—</span>}
                          </td>
                        )}
                        <td style={{ ...E.td, color:"#4b5563", whiteSpace:"nowrap" }}>
                          {fmtTiempo(e.tiempo_trabajado_minutos)}
                        </td>
                      </tr>
                    ))}
                  </>
                );
              })}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}

/* ── Grupo de tarea en modo "por tarea" ─────────────────── */
function GrupoTarea({ grupo, mostrarVencida, mostrarSLA, esSupervisor }) {
  const pasos = grupo.es_compleja ? pasosDe(grupo.instancias) : [];

  return (
    <div style={{ marginBottom:"16px", background:"#111827",
      borderRadius:"8px", border:"1px solid #1f2937", overflow:"hidden" }}>
      {/* Cabecera tarea */}
      <div style={{ background:"#1f2937", padding:"10px 14px",
        borderBottom:"1px solid #374151",
        display:"flex", alignItems:"center", gap:"8px", flexWrap:"wrap" }}>
        <span style={{ fontSize:"14px", fontWeight:"700", color:"white" }}>
          📋 {grupo.nombre}
        </span>
        {grupo.codigo && (
          <span style={{ fontFamily:"monospace", fontSize:"11px", color:"#6b7280" }}>
            [{grupo.codigo}]
          </span>
        )}
        {grupo.es_compleja && (
          <span style={{ ...E.badge, background:"#1e1b4b",
            color:"#a5b4fc", border:"1px solid #6366f1" }}>
            🔀 compleja · {pasos.length} pasos
          </span>
        )}
        <span style={{ fontSize:"11px", color:"#6b7280", marginLeft:"auto" }}>
          {grupo.instancias.length} cliente{grupo.instancias.length !== 1 ? "s" : ""}
        </span>
      </div>

      <div style={{ overflowX:"auto" }}>
        <table style={{ width:"100%", borderCollapse:"collapse", fontSize:"12px",
          minWidth: grupo.es_compleja ? `${300 + pasos.length * 160}px` : "auto" }}>
          <thead>
            <tr>
              {!grupo.es_compleja ? (
                <>
                  <th style={E.th}>Fecha</th>
                  <th style={E.th}>Cliente</th>
                  {esSupervisor && <th style={E.th}>Operador</th>}
                  <th style={E.th}>Estado</th>
                  {mostrarVencida && <th style={E.th}>Vencida</th>}
                  <th style={E.th}>Tiempo</th>
                </>
              ) : (
                <>
                  <th style={{ ...E.th, minWidth:"160px" }}>Cliente</th>
                  {esSupervisor && <th style={E.th}>Operador</th>}
                  {mostrarVencida && <th style={E.th}>Vencida</th>}
                  {pasos.map(p => (
                    <th key={p.orden} style={{ ...E.th, minWidth:"150px",
                      borderLeft:"1px solid #2d3748" }}>
                      <div style={{ color:"#6b7280", fontWeight:"400", marginBottom:"2px" }}>
                        Paso {p.orden}
                      </div>
                      <div style={{ color:"#e2e8f0", fontSize:"11px" }}>{p.nombre}</div>
                      {mostrarSLA && (
                        <div style={{ color:"#4b5563", fontSize:"10px", fontWeight:"400" }}>
                          fecha · tiempo · SLA
                        </div>
                      )}
                    </th>
                  ))}
                  <th style={E.th}>Tiempo total</th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {grupo.instancias.map((t, ti) => !grupo.es_compleja ? (
              <tr key={ti} style={{ borderTop:"1px solid #1f2937" }}>
                <td style={{ ...E.td, color:"#9ca3af", whiteSpace:"nowrap" }}>
                  {fmtFecha(t.fecha_planificada)}
                </td>
                <td style={{ ...E.td, color:"white", fontWeight:"500" }}>
                  {t.cliente_nombre || "—"}
                </td>
                {esSupervisor && (
                  <td style={{ ...E.td, color:"#9ca3af" }}>{t.operador_nombre || "—"}</td>
                )}
                <td style={E.td}><EstadoBadge estado={t.estado} /></td>
                {mostrarVencida && (
                  <td style={E.td}>
                    {t.fue_vencida ? <BadgeVencida /> : <span style={{ color:"#374151" }}>—</span>}
                  </td>
                )}
                <td style={{ ...E.td, color:"#9ca3af", whiteSpace:"nowrap" }}>
                  {fmtTiempo(t.tiempo_trabajado_minutos)}
                </td>
              </tr>
            ) : (
              <tr key={ti} style={{ borderTop:"1px solid #1f2937" }}>
                <td style={{ ...E.td, color:"white", fontWeight:"500" }}>
                  {t.cliente_nombre || "—"}
                </td>
                {esSupervisor && (
                  <td style={{ ...E.td, color:"#9ca3af" }}>{t.operador_nombre || "—"}</td>
                )}
                {mostrarVencida && (
                  <td style={E.td}>
                    {t.fue_vencida ? <BadgeVencida /> : <span style={{ color:"#374151" }}>—</span>}
                  </td>
                )}
                {pasos.map(p => {
                  const e = (t.etapas||[]).find(e => e.orden === p.orden);
                  return (
                    <td key={p.orden} style={{ ...E.td, borderLeft:"1px solid #1a2030",
                      background: e?.sla_vencido ? "#150808" : "transparent" }}>
                      {e ? (
                        <div style={{ display:"flex", flexDirection:"column", gap:"3px" }}>
                          {e.fin_real && (
                            <div style={{ color:"#9ca3af", fontSize:"11px" }}>
                              📅 {fmtFecha(e.fin_real)}
                            </div>
                          )}
                          <EstadoBadge estado={e.estado} />
                          {e.tiempo_trabajado_minutos > 0 && (
                            <div style={{ color:"#6b7280", fontSize:"11px" }}>
                              ⏱ {fmtTiempo(e.tiempo_trabajado_minutos)}
                            </div>
                          )}
                          {mostrarSLA && e.vencimiento_sla && (
                            <div style={{ color:"#4b5563", fontSize:"10px" }}>
                              SLA: {fmtFecha(e.vencimiento_sla)}
                            </div>
                          )}
                          {e.sla_vencido && (
                            <span style={{ ...E.badge, background:"#450a0a",
                              color:"#fca5a5", border:"1px solid #ef4444", fontSize:"9px" }}>
                              ⚠ SLA vencido
                            </span>
                          )}
                        </div>
                      ) : (
                        <span style={{ color:"#2d3748" }}>—</span>
                      )}
                    </td>
                  );
                })}
                <td style={{ ...E.td, color:"#9ca3af", whiteSpace:"nowrap", fontWeight:"500" }}>
                  {fmtTiempo(t.tiempo_trabajado_minutos)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ── Tabla modo "por tarea" ─────────────────────────────── */
function TablaPorTarea({ tareas, mostrarVencida, mostrarSLA, esSupervisor }) {
  const grupos = {};
  tareas.forEach(t => {
    const k = t.catalogo_tarea_id || ("__" + t.tarea_nombre);
    if (!grupos[k]) grupos[k] = {
      nombre:      t.tarea_nombre,
      codigo:      t.tarea_codigo,
      es_compleja: t.es_tarea_compleja,
      instancias:  [],
    };
    grupos[k].instancias.push(t);
  });

  function csvData() {
    const filas = [];
    Object.values(grupos).forEach(g => {
      if (!g.es_compleja) {
        g.instancias.forEach(t => filas.push({
          tarea:       g.nombre, codigo: g.codigo, tipo: "simple",
          cliente:     t.cliente_nombre, operador: t.operador_nombre,
          fecha:       t.fecha_planificada, estado: t.estado,
          fue_vencida: t.fue_vencida ? "sí" : "no",
          tiempo_min:  t.tiempo_trabajado_minutos || 0,
        }));
      } else {
        const ps = pasosDe(g.instancias);
        g.instancias.forEach(t => {
          const row = {
            tarea: g.nombre, codigo: g.codigo, tipo: "compleja",
            cliente: t.cliente_nombre, operador: t.operador_nombre,
            fue_vencida: t.fue_vencida ? "sí" : "no",
            tiempo_total_min: t.tiempo_trabajado_minutos || 0,
          };
          ps.forEach((p, i) => {
            const e = (t.etapas||[]).find(e => e.orden === p.orden);
            row[`p${i+1}_${p.nombre.slice(0,12).replace(/\s/g,"_")}`] = e
              ? `${fmtFecha(e.fin_real)} ${fmtTiempo(e.tiempo_trabajado_minutos)}`
              : "—";
          });
          filas.push(row);
        });
      }
    });
    return filas;
  }

  return (
    <div>
      <div style={{ display:"flex", justifyContent:"flex-end", marginBottom:"10px" }}>
        <button style={E.btnGris} onClick={() => exportarCSV(csvData(), "registro_por_tarea.csv")}>
          ⬇ Exportar CSV
        </button>
      </div>
      {Object.values(grupos).map((g, gi) => (
        <GrupoTarea key={gi} grupo={g} mostrarVencida={mostrarVencida}
          mostrarSLA={mostrarSLA} esSupervisor={esSupervisor} />
      ))}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   COMPONENTE PRINCIPAL
   ══════════════════════════════════════════════════════════ */
export default function RegistroTrabajo() {
  const { usuario } = useContext(AuthContext);
  const hoy = new Date();

  const esSupervisor = usuario?.perfiles?.some(p =>
    ["supervisor","dueno","administrador"].includes(p));

  const [anio,  setAnio]  = useState(hoy.getFullYear());
  const [mes,   setMes]   = useState(hoy.getMonth() + 1);
  const [modo,  setModo]  = useState("por_cliente");

  const [clientes,     setClientes]    = useState([]);
  const [catalogo,     setCatalogo]    = useState([]);
  const [clienteSel,   setClienteSel]  = useState([]);
  const [catalogoSel,  setCatalogoSel] = useState([]);

  const [mostrarVencida, setMostrarVencida] = useState(true);
  const [mostrarSLA,     setMostrarSLA]     = useState(false);

  const [tareas,   setTareas]   = useState(null);
  const [cargando, setCargando] = useState(false);
  const [maestros, setMaestros] = useState(false);

  /* Cargar maestros una vez */
  useEffect(() => {
    Promise.all([
      api.get("/clientes/?activo=true"),
      api.get("/parametros/catalogo?activo=true"),
    ]).then(([cl, cat]) => {
      setClientes((cl||[]).map(c => ({ id:c.id, label:c.razon_social })));
      setCatalogo((cat||[]).map(c => ({ id:c.id, label:`${c.codigo ? `[${c.codigo}] ` : ""}${c.nombre}` })));
      setMaestros(true);
    }).catch(() => setMaestros(true));
  }, []);

  /* Navegación de mes */
  function mesAnterior() {
    if (mes === 1) { setMes(12); setAnio(a => a - 1); }
    else setMes(m => m - 1);
  }
  function mesSiguiente() {
    if (mes === 12) { setMes(1); setAnio(a => a + 1); }
    else setMes(m => m + 1);
  }

  async function buscar() {
    setCargando(true);
    setTareas(null);
    try {
      let url = `/reportes/registro-trabajo?anio=${anio}&mes=${mes}`;
      if (clienteSel.length)  url += `&cliente_ids=${clienteSel.join(",")}`;
      if (catalogoSel.length) url += `&catalogo_ids=${catalogoSel.join(",")}`;
      const data = await api.get(url);
      setTareas(data?.tareas || []);
    } catch(e) {
      console.error("Error registro-trabajo:", e);
      setTareas([]);
    }
    setCargando(false);
  }

  const stats = tareas ? {
    total:       tareas.length,
    completadas: tareas.filter(t => t.estado === "completada").length,
    fueVencidas: tareas.filter(t => t.fue_vencida).length,
    mins:        tareas.reduce((s, t) => s + (t.tiempo_trabajado_minutos || 0), 0),
  } : null;

  return (
    <div style={{ color:"white" }}>
      {/* Encabezado */}
      <div style={{ marginBottom:"20px" }}>
        <h1 style={{ margin:"0 0 4px", fontSize:"22px" }}>📒 Registro de Trabajo</h1>
        <div style={{ fontSize:"13px", color:"#6b7280" }}>
          Consulta mensual de tareas ejecutadas · exportable a CSV
        </div>
      </div>

      {/* Panel de controles */}
      <div style={{ background:"#1f2937", borderRadius:"8px", padding:"16px",
        border:"1px solid #374151", marginBottom:"16px" }}>

        {/* Navegación de mes */}
        <div style={{ display:"flex", alignItems:"center", gap:"12px",
          marginBottom:"14px", flexWrap:"wrap" }}>
          <button onClick={mesAnterior} style={{ ...E.btnGris, padding:"6px 12px",
            fontSize:"16px", lineHeight:1 }}>‹</button>
          <span style={{ fontSize:"18px", fontWeight:"700", color:"white",
            minWidth:"180px", textAlign:"center" }}>
            {MESES[mes-1]} {anio}
          </span>
          <button onClick={mesSiguiente} style={{ ...E.btnGris, padding:"6px 12px",
            fontSize:"16px", lineHeight:1 }}>›</button>

          {/* Toggle de modo */}
          <div style={{ marginLeft:"auto", display:"flex", gap:"4px" }}>
            {[
              { id:"por_cliente", label:"Por cliente" },
              { id:"por_tarea",   label:"Por tarea" },
            ].map(m => (
              <button key={m.id} onClick={() => setModo(m.id)} style={{
                background: modo === m.id ? "#6366f1" : "#111827",
                color:      modo === m.id ? "white"   : "#9ca3af",
                border:     `1px solid ${modo === m.id ? "#6366f1" : "#374151"}`,
                padding:"6px 14px", borderRadius:"6px", cursor:"pointer",
                fontSize:"13px", fontWeight: modo === m.id ? "600" : "400",
              }}>
                {m.label}
              </button>
            ))}
          </div>
        </div>

        {/* Filtros */}
        <div style={{ display:"grid", gap:"10px",
          gridTemplateColumns:"repeat(auto-fill, minmax(220px, 1fr))",
          marginBottom:"12px" }}>
          <div>
            <div style={{ fontSize:"11px", color:"#9ca3af", marginBottom:"3px" }}>
              Clientes {clienteSel.length > 0 ? `(${clienteSel.length})` : "(todos)"}
            </div>
            <MultiSelect
              opciones={clientes}
              seleccionados={clienteSel}
              onChange={setClienteSel}
              placeholder="Todos los clientes"
            />
          </div>
          <div>
            <div style={{ fontSize:"11px", color:"#9ca3af", marginBottom:"3px" }}>
              Tareas del catálogo {catalogoSel.length > 0 ? `(${catalogoSel.length})` : "(todas)"}
            </div>
            <MultiSelect
              opciones={catalogo}
              seleccionados={catalogoSel}
              onChange={setCatalogoSel}
              placeholder="Todas las tareas"
            />
          </div>
        </div>

        {/* Opciones visuales + búsqueda */}
        <div style={{ display:"flex", alignItems:"center", gap:"16px",
          flexWrap:"wrap" }}>
          <button style={E.btn} onClick={buscar} disabled={cargando}>
            {cargando ? "⏳ Buscando..." : "🔍 Ver registro"}
          </button>

          <label style={{ display:"flex", alignItems:"center", gap:"6px",
            cursor:"pointer", fontSize:"13px", color:"#9ca3af" }}>
            <input type="checkbox" style={E.check}
              checked={mostrarVencida}
              onChange={e => setMostrarVencida(e.target.checked)} />
            Mostrar si fue vencida
          </label>

          <label style={{ display:"flex", alignItems:"center", gap:"6px",
            cursor:"pointer", fontSize:"13px", color:"#9ca3af" }}>
            <input type="checkbox" style={E.check}
              checked={mostrarSLA}
              onChange={e => setMostrarSLA(e.target.checked)} />
            Mostrar SLA de pasos
          </label>

          {tareas !== null && (
            <span style={{ color:"#6b7280", fontSize:"12px", marginLeft:"auto" }}>
              {tareas.length} tarea{tareas.length !== 1 ? "s" : ""}
            </span>
          )}
        </div>
      </div>

      {/* Estado inicial */}
      {tareas === null && !cargando && (
        <div style={{ textAlign:"center", padding:"60px 20px", color:"#6b7280" }}>
          <div style={{ fontSize:"40px", marginBottom:"12px" }}>📒</div>
          <div style={{ fontSize:"14px" }}>
            Seleccioná el mes y presioná{" "}
            <strong style={{ color:"#6366f1" }}>Ver registro</strong>
          </div>
          <div style={{ fontSize:"12px", marginTop:"8px", color:"#4b5563" }}>
            Filtrá por cliente o por tipo de tarea para acotar los resultados
          </div>
        </div>
      )}

      {cargando && (
        <div style={{ textAlign:"center", padding:"50px", color:"#6b7280" }}>
          ⏳ Cargando registro...
        </div>
      )}

      {/* Tarjetas de resumen */}
      {stats && tareas.length > 0 && (
        <div style={{ display:"grid", gap:"8px",
          gridTemplateColumns:"repeat(auto-fill, minmax(130px,1fr))",
          marginBottom:"16px" }}>
          {[
            { l:"Total",          v:stats.total,       c:"#6366f1" },
            { l:"Completadas",    v:stats.completadas, c:"#16a34a" },
            { l:"Alguna vez venc.",v:stats.fueVencidas,c:"#f97316" },
            { l:"Tiempo total",   v:fmtTiempo(stats.mins), c:"#7c3aed" },
          ].map(s => (
            <div key={s.l} style={{ background:"#111827", borderRadius:"6px",
              padding:"8px 10px", border:`1px solid ${s.c}33` }}>
              <div style={{ fontSize:"16px", fontWeight:"700", color:s.c }}>{s.v}</div>
              <div style={{ fontSize:"11px", color:"#9ca3af", marginTop:"2px" }}>{s.l}</div>
            </div>
          ))}
        </div>
      )}

      {tareas !== null && !cargando && tareas.length === 0 && (
        <div style={{ textAlign:"center", padding:"40px", color:"#6b7280", fontSize:"13px" }}>
          Sin tareas en {MESES[mes-1]} {anio} para los filtros seleccionados
        </div>
      )}

      {/* Tabla según modo */}
      {tareas && tareas.length > 0 && modo === "por_cliente" && (
        <TablaPorCliente
          tareas={tareas}
          mostrarVencida={mostrarVencida}
          mostrarSLA={mostrarSLA}
          esSupervisor={esSupervisor}
        />
      )}
      {tareas && tareas.length > 0 && modo === "por_tarea" && (
        <TablaPorTarea
          tareas={tareas}
          mostrarVencida={mostrarVencida}
          mostrarSLA={mostrarSLA}
          esSupervisor={esSupervisor}
        />
      )}
    </div>
  );
}
