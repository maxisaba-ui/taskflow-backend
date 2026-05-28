import { hoyLocal } from "../utils/dateHelpers.js";
/**
 * =============================================================
 * Archivo: Dashboard.jsx
 * Versión: v1.1.0
 * -------------------------------------------------------------
 * HISTORIAL:
 *   v1.0.0 - Dashboard completo con ejecución diaria.
 *   v1.0.1 - Fix: opcion "Todos los operadores" en el selector.
 *   v1.1.0 - Tab "Mi Jornada" con timeline, selector de operador
 *            para supervisores, y stat "tiempo sin actividad" (ítem 6 + 7).
 * =============================================================
 */
import { useState, useEffect, useContext, useRef } from "react";
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
    naranja:  { bg:"#431407", text:"#fdba74",  border:"#ea580c" },
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

// ── Helpers de tiempo ──────────────────────────────────────

function fmtMinutos(mins) {
  if (!mins || mins <= 0) return "0m";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function fmtHora(iso) {
  if (!iso) return "—";
  // Extrae HH:MM de ISO datetime
  const parte = iso.includes("T") ? iso.split("T")[1] : iso.split(" ")[1] || "";
  return parte.slice(0, 5) || iso.slice(11, 16) || "—";
}

/**
 * Calcula el tiempo sin actividad del día:
 * Desde la primera tarea iniciada hasta ahora (o último fin_real),
 * restando el tiempo efectivamente trabajado.
 */
function calcularTiempoSinActividad(tareas) {
  const conInicio = tareas.filter(t => t.inicio_real);
  if (conInicio.length === 0) return null;

  const ahora = new Date();
  const primerInicio = conInicio.reduce((min, t) =>
    t.inicio_real < min ? t.inicio_real : min, conInicio[0].inicio_real
  );

  // Fin de referencia: última fin_real si todas completadas, sino ahora
  const todasCompletadas = tareas.every(t =>
    t.estado === "completada" || t.estado === "vencida"
  );
  let refFin = ahora;
  if (todasCompletadas) {
    const conFin = tareas.filter(t => t.fin_real);
    if (conFin.length > 0) {
      const ultimo = conFin.reduce((max, t) =>
        t.fin_real > max ? t.fin_real : max, conFin[0].fin_real
      );
      refFin = new Date(ultimo);
    }
  }

  const minsTotales = Math.floor((refFin - new Date(primerInicio)) / 60000);
  const minsTrabajados = tareas.reduce((s, t) => s + (t.tiempo_trabajado_minutos || 0), 0);
  const sinActividad = Math.max(0, minsTotales - minsTrabajados);
  return sinActividad;
}

// ── Componente Mi Jornada ──────────────────────────────────

function MiJornada({ fecha, usuario, esSupervisor, esAdmin }) {
  const [items, setItems]     = useState([]);
  const [cargando, setCarg]   = useState(true);
  const [uidVer, setUidVer]   = useState(usuario?.id || "");
  const [operadores, setOps]  = useState([]);
  const [expandidos, setExp]  = useState({});  // tarea_id → bool

  // Cargar lista de usuarios si es supervisor/admin
  useEffect(() => {
    if (esSupervisor || esAdmin) {
      api.get("/usuarios/").then(u => setOps(u || [])).catch(() => {});
    }
  }, [esSupervisor, esAdmin]);

  // Cargar jornada cuando cambia fecha o usuario seleccionado
  useEffect(() => {
    cargar();
  }, [fecha, uidVer]);

  async function cargar() {
    setCarg(true);
    try {
      let url = `/tareas/para-jornada?fecha=${fecha}`;
      // Supervisor/admin puede ver la jornada de otro usuario
      if (uidVer && uidVer !== usuario?.id) {
        url += `&usuario_id=${uidVer}`;
      }
      const data = await api.get(url);
      setItems(Array.isArray(data) ? data : []);
    } catch(e) {
      console.error("Error cargando jornada:", e);
      setItems([]);
    } finally {
      setCarg(false);
    }
  }

  // Calcular stats de la jornada
  const totalMins    = items.reduce((s, i) => s + (i.tiempo_trabajado_minutos || 0), 0);
  const completadas  = items.filter(i => i.estado === "completada").length;
  const tiempoSinAct = calcularTiempoSinActividad(items);

  // Agrupar etapas complejas bajo su tarea_id
  const grupos = {};   // tarea_id → lista etapas
  const simples = [];
  for (const item of items) {
    if (item.tipo === "etapa_compleja") {
      if (!grupos[item.tarea_id]) grupos[item.tarea_id] = [];
      grupos[item.tarea_id].push(item);
    } else {
      simples.push(item);
    }
  }

  const COLORES_ESTADO = {
    pendiente:           "#6b7280",
    en_curso:            "#10b981",
    pausada:             "#f59e0b",
    completada:          "#3b82f6",
    validacion_pendiente:"#a855f7",
    vencida:             "#ef4444",
  };

  function toggleExp(id) {
    setExp(prev => ({ ...prev, [id]: !prev[id] }));
  }

  return (
    <div style={{ color:"white" }}>

      {/* Selector de operador para supervisores */}
      {(esSupervisor || esAdmin) && (
        <div style={{ ...E.card, marginBottom:"16px", display:"flex",
          alignItems:"center", gap:"12px", flexWrap:"wrap" }}>
          <label style={{ color:"#9ca3af", fontSize:"13px" }}>Ver jornada de:</label>
          <select style={E.select}
            value={uidVer}
            onChange={e => setUidVer(e.target.value)}>
            <option value={usuario?.id}>Mi jornada</option>
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

      {/* Stats de jornada */}
      <div style={{ display:"grid",
        gridTemplateColumns:"repeat(auto-fit, minmax(120px, 1fr))",
        gap:"10px", marginBottom:"20px" }}>
        <StatCard label="Ítems jornada"   valor={items.length}          color="gris"    />
        <StatCard label="Completadas"      valor={completadas}            color="esmeralda"/>
        <StatCard label="Tiempo trabajado" valor={fmtMinutos(totalMins)}  color="violeta"  />
        {tiempoSinAct !== null && (
          <StatCard
            label="Sin actividad"
            valor={fmtMinutos(tiempoSinAct)}
            color={tiempoSinAct > 60 ? "naranja" : "gris"}
          />
        )}
      </div>

      {/* Timeline */}
      {cargando ? (
        <div style={{ textAlign:"center", padding:"40px", color:"#6b7280" }}>
          ⏳ Cargando jornada...
        </div>
      ) : items.length === 0 ? (
        <div style={{ ...E.card, textAlign:"center", padding:"40px" }}>
          <div style={{ fontSize:"32px", marginBottom:"10px" }}>📅</div>
          <div style={{ color:"#9ca3af", fontSize:"14px" }}>
            No hay actividad registrada para este día
          </div>
        </div>
      ) : (
        <div style={{ display:"flex", flexDirection:"column", gap:"6px" }}>

          {/* Tareas simples */}
          {simples.map(item => {
            const color = COLORES_ESTADO[item.estado] || "#6b7280";
            return (
              <div key={item.id} style={{ ...E.card, padding:"10px 14px",
                borderLeft:`4px solid ${color}`, display:"flex",
                alignItems:"center", gap:"12px" }}>
                {/* Hora de inicio y fin */}
                <div style={{ minWidth:"58px", textAlign:"center",
                  fontSize:"12px", color:"#9ca3af" }}>
                  <div style={{ fontWeight:"600" }}>{fmtHora(item.inicio_real)}</div>
                  <div>{fmtHora(item.fin_real) || "—"}</div>
                </div>

                {/* Separador */}
                <div style={{ width:"2px", alignSelf:"stretch",
                  background:color, borderRadius:"2px", flexShrink:0 }} />

                {/* Info tarea */}
                <div style={{ flex:1 }}>
                  <div style={{ fontWeight:"600", fontSize:"13px",
                    color:"white", marginBottom:"2px" }}>
                    {item.tarea_nombre}
                  </div>
                  <div style={{ fontSize:"11px", color:"#9ca3af" }}>
                    {item.cliente_nombre || item.servicio_nombre || "—"}
                    {" · "}⏱ {fmtMinutos(item.tiempo_trabajado_minutos)}
                  </div>
                </div>

                {/* Badge estado */}
                <div style={{ fontSize:"11px", padding:"2px 8px",
                  borderRadius:"8px", background:`${color}22`, color,
                  fontWeight:"600", whiteSpace:"nowrap" }}>
                  {item.estado.replace("_"," ")}
                </div>
              </div>
            );
          })}

          {/* Grupos de tareas complejas */}
          {Object.entries(grupos).map(([tarea_id, etapas]) => {
            const tarea_nombre = etapas[0]?.tarea_nombre || "Tarea compleja";
            const totalGrupo   = etapas.reduce((s, e) => s + (e.tiempo_trabajado_minutos || 0), 0);
            const abierto      = expandidos[tarea_id];

            return (
              <div key={tarea_id} style={{
                background:"#1e1b4b",
                borderRadius:"10px",
                border:"1px solid #4c1d95",
                overflow:"hidden" }}>

                {/* Cabecera del grupo */}
                <div
                  onClick={() => toggleExp(tarea_id)}
                  style={{ display:"flex", alignItems:"center", gap:"10px",
                    padding:"10px 14px", cursor:"pointer",
                    borderBottom: abierto ? "1px solid #4c1d95" : "none" }}>
                  <span style={{ fontSize:"16px" }}>🔀</span>
                  <div style={{ flex:1 }}>
                    <div style={{ fontWeight:"600", fontSize:"13px", color:"#c4b5fd" }}>
                      {tarea_nombre}
                    </div>
                    <div style={{ fontSize:"11px", color:"#9ca3af" }}>
                      {etapas.length} etapa{etapas.length!==1?"s":""} · ⏱ {fmtMinutos(totalGrupo)}
                    </div>
                  </div>
                  <span style={{ color:"#c4b5fd", fontSize:"12px" }}>
                    {abierto ? "▲ Colapsar" : "▼ Expandir"}
                  </span>
                </div>

                {/* Detalle de etapas */}
                {abierto && (
                  <div style={{ padding:"8px 14px 10px" }}>
                    {etapas
                      .sort((a, b) => (a.etapa_orden || 0) - (b.etapa_orden || 0))
                      .map(et => {
                        const colorEt = COLORES_ESTADO[et.estado] || "#6b7280";
                        // Etapas de otro usuario: mostrar como "en espera de"
                        const esPropio = et.asignado_a_id === usuario?.id;
                        if (!esPropio) {
                          const valNom = et.validador_nombre || "otro usuario";
                          return (
                            <div key={et.id} style={{ display:"flex",
                              alignItems:"center", gap:"8px",
                              padding:"5px 0", borderBottom:"1px solid #2e2260",
                              fontSize:"12px", color:"#818cf8", fontStyle:"italic" }}>
                              <span>⏳</span>
                              <span>{et.etapa_nombre} — en espera de {valNom}</span>
                            </div>
                          );
                        }
                        return (
                          <div key={et.id} style={{ display:"flex",
                            alignItems:"center", gap:"10px",
                            padding:"5px 0", borderBottom:"1px solid #2e2260" }}>
                            <span style={{ fontSize:"11px", color:colorEt,
                              fontWeight:"700", minWidth:"18px" }}>
                              {et.etapa_orden}.
                            </span>
                            <div style={{ minWidth:"90px", fontSize:"11px",
                              color:"#9ca3af", textAlign:"center" }}>
                              <div>{fmtHora(et.inicio_real)}</div>
                              <div>{fmtHora(et.fin_real) || "—"}</div>
                            </div>
                            <div style={{ flex:1, fontSize:"12px", color:"white" }}>
                              {et.etapa_nombre}
                            </div>
                            <div style={{ fontSize:"11px", color:colorEt,
                              whiteSpace:"nowrap" }}>
                              ⏱ {fmtMinutos(et.tiempo_trabajado_minutos)}
                            </div>
                          </div>
                        );
                      })
                    }
                  </div>
                )}
              </div>
            );
          })}

        </div>
      )}
    </div>
  );
}

// ── Componente principal Dashboard ────────────────────────

export default function Dashboard() {
  const { usuario } = useContext(AuthContext);
  const hoyISO = hoyLocal();

  const [tab, setTab]                   = useState("tareas");  // "tareas" | "jornada"
  const [fecha, setFecha]               = useState(hoyISO);
  const [operadorFiltro, setOperadorFiltro] = useState(usuario?.id || TODOS);
  const [tareas, setTareas]     = useState([]);
  const [cargando, setCargando] = useState(true);
  const [msgAccion, setMsgAccion] = useState({ texto:"", tipo:"" });
  const [operadores, setOperadores] = useState([]);

  const esSupervisor =
    usuario?.perfiles?.includes("supervisor") ||
    usuario?.perfiles?.includes("dueno")      ||
    usuario?.perfiles?.includes("administrador");

  const esAdmin =
    usuario?.perfiles?.includes("dueno") ||
    usuario?.perfiles?.includes("administrador");

  useEffect(() => {
    if (esSupervisor) {
      api.get("/usuarios/").then(u => setOperadores(u || [])).catch(() => {});
    }
  }, [esSupervisor]);

  useEffect(() => {
    if (tab === "tareas") cargarTareas();
    const iv = setInterval(() => { if (tab === "tareas") cargarTareas(); }, 30_000);
    return () => clearInterval(iv);
  }, [fecha, operadorFiltro, tab]);

  async function cargarTareas() {
    try {
      let url = `/tareas/?fecha=${fecha}`;
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

  // Stats con tiempo sin actividad (ítem 7)
  const stats = {
    total:              tareas.length,
    pendientes:         tareas.filter(t => t.estado === "pendiente").length,
    en_curso:           tareas.filter(t => t.estado === "en_curso").length,
    completadas:        tareas.filter(t => t.estado === "completada").length,
    vencidas:           tareas.filter(t => t.estado === "vencida").length,
    minutos_trabajados: tareas.reduce((s, t) => s + (t.tiempo_trabajado_minutos || 0), 0),
    sin_actividad:      calcularTiempoSinActividad(tareas),
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

      {/* Tabs: Tareas del Día | Mi Jornada */}
      <div style={{ display:"flex", gap:"0", marginBottom:"16px",
        background:"#111827", borderRadius:"8px", padding:"4px",
        border:"1px solid #374151", width:"fit-content" }}>
        {[
          { id:"tareas",  label:"📋 Tareas del día" },
          { id:"jornada", label:"📅 Mi Jornada" },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            background: tab === t.id ? "#6366f1" : "transparent",
            color:      tab === t.id ? "white" : "#9ca3af",
            border:     "none",
            padding:    "7px 16px",
            borderRadius:"6px",
            cursor:     "pointer",
            fontSize:   "13px",
            fontWeight: tab === t.id ? "600" : "400",
            transition: "all 0.15s",
          }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Tab: Tareas del Día ── */}
      {tab === "tareas" && (<>

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

          {esSupervisor && (
            <div style={{ marginLeft:"auto", display:"flex", alignItems:"center", gap:"8px" }}>
              <label style={{ color:"#9ca3af", fontSize:"13px" }}>Operador:</label>
              <select style={E.select}
                value={operadorFiltro}
                onChange={e => setOperadorFiltro(e.target.value)}>
                <option value={TODOS}>Todos los operadores</option>
                <option value={usuario?.id}>Mis tareas</option>
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

        {/* Estadísticas (ítem 7: incluye tiempo sin actividad) */}
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
          {/* Tiempo sin actividad: tiempo desde primer inicio hasta ahora, minus trabajado */}
          {stats.sin_actividad !== null && stats.sin_actividad > 0 && (
            <StatCard
              label="Sin actividad"
              valor={stats.sin_actividad >= 60
                ? `${Math.floor(stats.sin_actividad/60)}h ${stats.sin_actividad%60}m`
                : `${stats.sin_actividad}m`}
              color={stats.sin_actividad > 60 ? "naranja" : "gris"} />
          )}
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

          {esSupervisor && (
            <div style={{ display:"flex", flexDirection:"column", gap:"12px" }}>
              <ResumenDia stats={stats} />
              <PanelSupervisor fecha={fecha} />
            </div>
          )}
        </div>

        {!esSupervisor && tareas.length > 0 && (
          <div style={{ marginTop:"20px" }}>
            <ResumenDia stats={stats} />
          </div>
        )}

      </>)}

      {/* ── Tab: Mi Jornada ── */}
      {tab === "jornada" && (
        <MiJornada
          fecha={fecha}
          usuario={usuario}
          esSupervisor={esSupervisor}
          esAdmin={esAdmin}
        />
      )}

    </div>
  );
}
