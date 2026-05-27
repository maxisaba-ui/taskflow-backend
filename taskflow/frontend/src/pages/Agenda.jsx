import { SLABadge, estadoSla } from "../utils/slaHelpers.jsx";
/**
 * =============================================================
 * Archivo: Agenda.jsx
 * Versión: v1.4.0
 * -------------------------------------------------------------
 * DESCRIPCION FUNCIONAL:
 *   v1.4.0:
 *   - Botón ↻ de refresh manual en el header del calendario.
 *   - Cambio de prioridad inline en el PanelDia para tareas
 *     pendientes (supervisor puede cambiarla sin entrar a la tarea).
 *   - Botón "Heredar día" para supervisores: hereda tareas no
 *     finalizadas al siguiente día hábil.
 *   - Tareas heredadas muestran badge "↩ heredada".
 *
 * HISTORIAL:
 *   v1.3.1 - Altura fija de celdas, bullets de prioridad, filtros.
 *   v1.4.0 - Refresh manual, prioridad inline, heredar día.
 * =============================================================
 */
import React, { useState, useEffect, useRef, useContext, useCallback } from "react";
import { api } from "../api/client.js";
import { AuthContext } from "../context/AuthContext.jsx";

const DIAS_SEMANA_7 = ["Lun","Mar","Mié","Jue","Vie","Sáb","Dom"];
const DIAS_SEMANA_5 = ["Lun","Mar","Mié","Jue","Vie"];
const MESES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio",
               "Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
const PRIORIDADES = [
  { value:"urgente", label:"🔴 Urgente", color:"#ef4444" },
  { value:"alta",    label:"🟠 Alta",    color:"#f97316" },
  { value:"media",   label:"🟡 Media",   color:"#eab308" },
  { value:"baja",    label:"🟢 Baja",    color:"#22c55e" },
];
const COLOR_ESTADO = {
  pendiente:            { bg:"#1e3a5f", color:"#93c5fd", border:"#2563eb" },
  en_curso:             { bg:"#064e3b", color:"#6ee7b7", border:"#059669" },
  pausada:              { bg:"#78350f", color:"#fde68a", border:"#d97706" },
  completada:           { bg:"#1a2e1a", color:"#86efac", border:"#16a34a" },
  vencida:              { bg:"#450a0a", color:"#fca5a5", border:"#ef4444" },
  validacion_pendiente: { bg:"#78350f", color:"#fde68a", border:"#d97706" },
  rechazada:            { bg:"#450a0a", color:"#fca5a5", border:"#ef4444" },
};
const PRIO_COLOR = {
  urgente:"#ef4444", alta:"#f97316", media:"#eab308", baja:"#22c55e",
};

const E = {
  input:   { background:"#111827", border:"1px solid #374151", color:"white", padding:"7px 10px", borderRadius:"6px", width:"100%", fontSize:"13px", boxSizing:"border-box" },
  label:   { color:"#9ca3af", fontSize:"11px", display:"block", marginBottom:"3px" },
  btn:     { background:"#6366f1", color:"white", border:"none", padding:"7px 14px", borderRadius:"6px", cursor:"pointer", fontSize:"13px", fontWeight:"500" },
  btnGris: { background:"#374151", color:"white", border:"none", padding:"7px 14px", borderRadius:"6px", cursor:"pointer", fontSize:"13px" },
  btnRojo: { background:"#ef4444", color:"white", border:"none", padding:"4px 8px", borderRadius:"4px", cursor:"pointer", fontSize:"12px" },
  btnVerde:{ background:"#059669", color:"white", border:"none", padding:"7px 14px", borderRadius:"6px", cursor:"pointer", fontSize:"13px", fontWeight:"500" },
  btnAma:  { background:"#d97706", color:"white", border:"none", padding:"4px 8px", borderRadius:"4px", cursor:"pointer", fontSize:"12px" },
  select:  { background:"#111827", border:"1px solid #374151", color:"white", padding:"7px 10px", borderRadius:"6px", width:"100%", fontSize:"13px" },
  badge:   { fontSize:"10px", padding:"2px 6px", borderRadius:"8px", fontWeight:"600", display:"inline-block" },
};

function construirGrilla(anio, mes, soloLaboral) {
  const primerDia   = new Date(anio, mes - 1, 1);
  const ultimoDia   = new Date(anio, mes, 0).getDate();
  const offsetLunes = (primerDia.getDay() + 6) % 7;
  const dias = [];
  for (let i = 0; i < offsetLunes; i++) dias.push(null);
  for (let d = 1; d <= ultimoDia; d++) dias.push(d);
  while (dias.length % 7 !== 0) dias.push(null);
  const semanas = [];
  for (let i = 0; i < dias.length; i += 7) {
    const s = dias.slice(i, i + 7);
    semanas.push(soloLaboral ? s.slice(0, 5) : s);
  }
  return semanas;
}
function toISO(anio, mes, dia) {
  return `${anio}-${String(mes).padStart(2,"0")}-${String(dia).padStart(2,"0")}`;
}
function esHoy(anio, mes, dia) {
  const h = new Date();
  return h.getFullYear() === anio && h.getMonth() + 1 === mes && h.getDate() === dia;
}
function claveSug(s) { return `${s.cliente_id}__${s.servicio_tarea_id}`; }

/* ── BuscadorDesplegable ────────────────────────────────────── */
function BuscadorDesplegable({ opciones, valor, onChange, placeholder, disabled }) {
  const [busqueda, setBusqueda] = useState("");
  const [abierto, setAbierto]   = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    function cerrar(e) {
      if (ref.current && !ref.current.contains(e.target)) {
        setAbierto(false); setBusqueda("");
      }
    }
    document.addEventListener("mousedown", cerrar);
    return () => document.removeEventListener("mousedown", cerrar);
  }, []);
  const filtradas = opciones.filter(o =>
    String(o.label).toLowerCase().includes(busqueda.toLowerCase())
  );
  const etiqueta = opciones.find(o => o.value === valor)?.label;
  return (
    <div ref={ref} style={{ position:"relative", marginBottom:"6px" }}>
      <div onClick={() => { if (!disabled) { setAbierto(!abierto); setBusqueda(""); } }}
        style={{ background:"#111827", border:"1px solid #374151",
          color: etiqueta ? "white" : "#6b7280",
          padding:"7px 10px", borderRadius:"6px",
          cursor: disabled ? "not-allowed" : "pointer",
          display:"flex", justifyContent:"space-between",
          fontSize:"13px", opacity: disabled ? 0.5 : 1 }}>
        <span style={{ overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
          {etiqueta || placeholder || "— Seleccionar —"}
        </span>
        <span style={{ color:"#6b7280", marginLeft:"8px" }}>{abierto ? "▲" : "▼"}</span>
      </div>
      {abierto && (
        <div style={{ position:"absolute", top:"100%", left:0, right:0,
          background:"#1f2937", border:"1px solid #374151",
          borderRadius:"6px", zIndex:1000,
          maxHeight:"220px", overflowY:"auto",
          boxShadow:"0 8px 24px rgba(0,0,0,0.5)" }}>
          <div style={{ padding:"6px", borderBottom:"1px solid #374151",
            position:"sticky", top:0, background:"#1f2937" }}>
            <input autoFocus value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
              placeholder="Escribí para buscar..."
              style={{ ...E.input, padding:"5px 8px", fontSize:"12px" }} />
          </div>
          <div onClick={() => { onChange(""); setAbierto(false); setBusqueda(""); }}
            style={{ padding:"7px 10px", color:"#6b7280", cursor:"pointer", fontSize:"12px" }}>
            — Ninguno —
          </div>
          {filtradas.length === 0 && (
            <div style={{ padding:"7px 10px", color:"#6b7280", fontSize:"12px" }}>
              Sin resultados para "{busqueda}"
            </div>
          )}
          {filtradas.map(o => (
            <div key={o.value}
              onClick={() => { onChange(o.value); setAbierto(false); setBusqueda(""); }}
              style={{ padding:"7px 10px", cursor:"pointer", fontSize:"12px",
                background: o.value === valor ? "#312e81" : "transparent",
                color: o.value === valor ? "white" : "#d1d5db",
                borderBottom:"1px solid #1f2937" }}>
              {o.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── SelectorPrioridad compacto ─────────────────────────────── */
function SelectorPrioridad({ valor, onChange }) {
  return (
    <div style={{ display:"flex", gap:"4px", flexWrap:"wrap" }}>
      {PRIORIDADES.map(p => (
        <button key={p.value} onClick={() => onChange(p.value)}
          style={{ padding:"3px 8px", borderRadius:"4px", fontSize:"11px",
            cursor:"pointer", border:"1px solid",
            background:   valor === p.value ? p.color+"33" : "transparent",
            color:        valor === p.value ? p.color : "#6b7280",
            borderColor:  valor === p.value ? p.color : "#374151",
            fontWeight:   valor === p.value ? "700" : "400",
            transition:"all 0.15s" }}>
          {p.label}
        </button>
      ))}
    </div>
  );
}

/* ── PipTarea — bullet de color de prioridad ────────────────── */
function PipTarea({ tarea }) {
  const colPrio = PRIO_COLOR[tarea.prioridad] || "#6b7280";
  return (
    <div style={{ display:"flex", alignItems:"center", gap:"4px",
      marginBottom:"2px", overflow:"hidden" }}>
      <div style={{ width:"6px", height:"6px", borderRadius:"50%",
        flexShrink:0, background:colPrio }} />
      <span style={{ fontSize:"10px", color:"#d1d5db",
        overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", flex:1 }}>
        {tarea.tarea_nombre}
      </span>
    </div>
  );
}

/* =============================================================
   PanelDia — con cambio de prioridad inline
   ============================================================= */
function PanelDia({ fecha, tareas, onCerrar, onTareaCreada, onEliminar,
                    operadores, esSupervisor }) {
  const [mostrarForm, setMostrarForm]           = useState(false);
  const [clientes, setClientes]                 = useState([]);
  const [rubros, setRubros]                     = useState([]);
  const [catalogo, setCatalogo]                 = useState([]);
  const [serviciosCliente, setServiciosCliente] = useState([]);
  const [msg, setMsg]                           = useState({ texto:"", tipo:"" });
  const [guardando, setGuardando]               = useState(false);
  const [cambiandoPrio, setCambiandoPrio]       = useState({}); /* {tareaId: bool} */

  const [f, setF] = useState({
    rubro_id:"", catalogo_tarea_id:"", nombre_personalizado:"",
    asignado_a_id:"", cliente_id:"", servicio_id:"",
    prioridad:"media", comentario_supervisor:"",
  });

  useEffect(() => {
    if (!mostrarForm) return;
    Promise.all([
      api.get("/clientes/?activo=true"),
      api.get("/parametros/rubros"),
      api.get("/parametros/catalogo"),
    ]).then(([c, r, cat]) => {
      setClientes(c || []); setRubros(r || []); setCatalogo(cat || []);
    }).catch(e => setMsg({ texto:"❌ Error: " + e.message, tipo:"error" }));
  }, [mostrarForm]);

  useEffect(() => {
    if (!f.cliente_id) { setServiciosCliente([]); return; }
    api.get(`/clientes/${f.cliente_id}/servicios`)
      .then(s => setServiciosCliente(s || []))
      .catch(() => setServiciosCliente([]));
  }, [f.cliente_id]);

  function elegirTareaCatalogo(id) {
    const tarea = catalogo.find(t => t.id === id);
    setF(prev => ({
      ...prev,
      catalogo_tarea_id:    id,
      nombre_personalizado: "",
      prioridad:            tarea?.prioridad_default || "media",
    }));
  }

  /**
   * DESCRIPCION FUNCIONAL:
   *   Cambia la prioridad de una tarea existente via PUT /tareas/{id}/prioridad.
   *   Solo disponible para supervisores en tareas pendientes o pausadas.
   */
  async function cambiarPrioridad(tareaId, nuevaPrioridad) {
    setCambiandoPrio(prev => ({...prev, [tareaId]: true}));
    try {
      await api.put(`/tareas/${tareaId}/prioridad`, { prioridad: nuevaPrioridad });
      setMsg({ texto:"✅ Prioridad actualizada", tipo:"ok" });
      onTareaCreada(); /* Recargar el panel */
    } catch(e) {
      setMsg({ texto:"❌ " + e.message, tipo:"error" });
    }
    setCambiandoPrio(prev => ({...prev, [tareaId]: false}));
  }

  const catalogoFiltrado = f.rubro_id ? catalogo.filter(t => t.rubro_id === f.rubro_id) : catalogo;
  const opsCatalogo   = catalogoFiltrado.map(t => ({ value:t.id, label:`[${t.codigo}] ${t.nombre}` }));
  const opsClientes   = clientes.map(c => ({ value:c.id, label:c.razon_social+(c.cuit?` — ${c.cuit}`:"") }));
  const opsServicios  = serviciosCliente.filter(s => s.vigente).map(s => ({ value:s.servicio_id, label:`${s.nombre} [${s.codigo}]` }));
  const opsOperadores = operadores.map(u => ({ value:u.id, label:`${u.nombre} ${u.apellido}` }));

  async function crear() {
    setMsg({ texto:"", tipo:"" });
    if (!f.asignado_a_id) { setMsg({ texto:"Seleccioná un operador", tipo:"error" }); return; }
    if (!f.rubro_id)      { setMsg({ texto:"Seleccioná un rubro",    tipo:"error" }); return; }
    if (!f.catalogo_tarea_id && !f.nombre_personalizado.trim()) {
      setMsg({ texto:"Seleccioná una tarea o ingresá un nombre", tipo:"error" }); return;
    }
    setGuardando(true);
    try {
      await api.post("/tareas/", {
        catalogo_tarea_id:     f.catalogo_tarea_id    || null,
        nombre_personalizado:  f.nombre_personalizado.trim() || null,
        rubro_id:              f.rubro_id,
        asignado_a_id:         f.asignado_a_id,
        cliente_id:            f.cliente_id           || null,
        servicio_id:           f.servicio_id          || null,
        fecha_planificada:     fecha,
        prioridad:             f.prioridad,
        comentario_supervisor: f.comentario_supervisor || null,
      });
      setMsg({ texto:"✅ Tarea agregada al calendario", tipo:"ok" });
      setMostrarForm(false);
      setF({ rubro_id:"", catalogo_tarea_id:"", nombre_personalizado:"",
             asignado_a_id:"", cliente_id:"", servicio_id:"",
             prioridad:"media", comentario_supervisor:"", sla_horas:"" });
      onTareaCreada();
    } catch(e) {
      setMsg({ texto:"❌ " + (e.message || "Error al guardar"), tipo:"error" });
    }
    setGuardando(false);
  }

  const [a, m, d] = fecha.split("-").map(Number);

  return (
    <div style={{ background:"#111827", borderRadius:"10px", padding:"16px",
      border:"1px solid #374151", overflowY:"auto", maxHeight:"85vh" }}>
      <div style={{ display:"flex", justifyContent:"space-between",
        alignItems:"center", marginBottom:"14px" }}>
        <div>
          <div style={{ fontWeight:"700", fontSize:"14px", color:"white" }}>
            📅 {d} de {MESES[m - 1]} de {a}
          </div>
          <div style={{ fontSize:"12px", color:"#6b7280", marginTop:"2px" }}>
            {tareas.length} tarea{tareas.length !== 1 ? "s" : ""}
          </div>
        </div>
        <button style={E.btnGris} onClick={onCerrar}>✕</button>
      </div>

      {msg.texto && (
        <div style={{
          background: msg.tipo === "ok" ? "#064e3b" : "#7f1d1d",
          border:`1px solid ${msg.tipo === "ok" ? "#10b981" : "#ef4444"}`,
          color: msg.tipo === "ok" ? "#10b981" : "#fca5a5",
          padding:"8px 10px", borderRadius:"6px", marginBottom:"10px",
          display:"flex", justifyContent:"space-between", fontSize:"12px" }}>
          <span>{msg.texto}</span>
          <button onClick={() => setMsg({ texto:"", tipo:"" })}
            style={{ background:"none", border:"none", color:"inherit", cursor:"pointer" }}>✕</button>
        </div>
      )}

      {/* Lista de tareas del dia */}
      <div style={{ marginBottom:"14px" }}>
        {tareas.length === 0 ? (
          <div style={{ color:"#6b7280", fontSize:"12px", textAlign:"center", padding:"12px" }}>
            No hay tareas para este día
          </div>
        ) : (
          tareas
          .filter(t => !["validacion_pendiente", "rechazada"].includes(t.estado))
          .map(t => {
            const col     = COLOR_ESTADO[t.estado] || COLOR_ESTADO.pendiente;
            const colPrio = PRIO_COLOR[t.prioridad] || "#6b7280";
            const puedeCambiarPrio = esSupervisor &&
              (t.estado === "pendiente" || t.estado === "pausada");

            return (
              <div key={t.id} style={{ background:"#1f2937", borderRadius:"6px",
                padding:"10px 12px", marginBottom:"6px",
                border:`1px solid ${col.border}` }}>
                <div style={{ display:"flex", justifyContent:"space-between",
                  alignItems:"flex-start" }}>
                  <div style={{ flex:1 }}>
                    {/* Nombre */}
                    <div style={{ fontWeight:"600", fontSize:"12px", color:"white",
                      marginBottom:"3px" }}>
                      {t.tarea_nombre}
                      {t.tarea_codigo && (
                        <span style={{ color:"#6b7280", fontFamily:"monospace",
                          fontSize:"10px", marginLeft:"6px" }}>[{t.tarea_codigo}]</span>
                      )}
                    </div>
                    {/* Operador */}
                    {t.operador_nombre && (
                      <div style={{ fontSize:"11px", color:"#9ca3af" }}>
                        👤 {t.operador_nombre}
                      </div>
                    )}
                    {/* Cliente */}
                    {t.cliente_nombre && (
                      <div style={{ fontSize:"11px", color:"#9ca3af" }}>
                        🏢 {t.cliente_nombre}
                        {t.servicio_nombre && ` · 🔧 ${t.servicio_nombre}`}
                      </div>
                    )}
                    {/* Badges */}
                    <div style={{ display:"flex", gap:"4px", marginTop:"5px",
                      flexWrap:"wrap", alignItems:"center" }}>
                      <SLABadge tarea={t} />
                      {t.tarea_nombre?.startsWith("✅ Validar:") && (
                        <span style={{ ...E.badge, background:"#1a1a2e",
                          color:"#c4b5fd", border:"1px solid #7c3aed",
                          fontWeight:"700" }}>
                          🔐 Validación pendiente
                        </span>
                      )}
                      <span style={{ ...E.badge, background:col.bg,
                        color:col.color, border:`1px solid ${col.border}` }}>
                        {t.estado.replace("_"," ")}
                      </span>
                      <span style={{ ...E.badge, background:colPrio+"22",
                        color:colPrio, border:`1px solid ${colPrio}` }}>
                        {t.prioridad}
                      </span>
                      {t.es_heredada && (
                        <span style={{ ...E.badge, background:"#1e1b4b",
                          color:"#a5b4fc", border:"1px solid #6366f1" }}>
                          ↩ heredada
                        </span>
                      )}
                    </div>

                    {/* Cambio de prioridad inline — solo supervisor, pendiente/pausada */}
                    {puedeCambiarPrio && (
                      <div style={{ marginTop:"8px" }}>
                        <div style={{ fontSize:"10px", color:"#6b7280",
                          marginBottom:"4px" }}>
                          Cambiar prioridad:
                        </div>
                        <div style={{ opacity: cambiandoPrio[t.id] ? 0.5 : 1 }}>
                          <SelectorPrioridad
                            valor={t.prioridad}
                            onChange={v => cambiarPrioridad(t.id, v)} />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Botón eliminar */}
                  {t.estado === "pendiente" && (
                    <button style={{ ...E.btnRojo, marginLeft:"8px", flexShrink:0 }}
                      onClick={() => onEliminar(t.id, t.tarea_nombre)}>✕</button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Formulario de alta */}
      {!mostrarForm ? (
        <button style={{ ...E.btn, width:"100%" }} onClick={() => setMostrarForm(true)}>
          + Agregar tarea
        </button>
      ) : (
        <div style={{ background:"#1f2937", borderRadius:"8px", padding:"12px",
          border:"1px solid #6366f1" }}>
          <div style={{ fontWeight:"600", fontSize:"13px", color:"white",
            marginBottom:"10px" }}>
            Nueva tarea — {d}/{m}/{a}
          </div>
          <label style={E.label}>Asignar a *</label>
          <BuscadorDesplegable opciones={opsOperadores} valor={f.asignado_a_id}
            onChange={v => setF({...f, asignado_a_id: v})} placeholder="— Buscar operador —" />
          <label style={E.label}>Rubro *</label>
          <select style={{ ...E.select, marginBottom:"6px" }} value={f.rubro_id}
            onChange={e => setF({...f, rubro_id: e.target.value, catalogo_tarea_id:""})}>
            <option value="">— Seleccionar rubro —</option>
            {rubros.map(r => <option key={r.id} value={r.id}>{r.nombre}</option>)}
          </select>
          <label style={E.label}>
            Tarea del catálogo{f.rubro_id ? ` (${catalogoFiltrado.length})` : ""}
          </label>
          <BuscadorDesplegable opciones={opsCatalogo} valor={f.catalogo_tarea_id}
            onChange={elegirTareaCatalogo} placeholder="— Buscar tarea —"
            disabled={!f.rubro_id} />
          {!f.catalogo_tarea_id && (
            <>
              <label style={E.label}>O nombre libre</label>
              <input style={{ ...E.input, marginBottom:"6px" }}
                value={f.nombre_personalizado}
                onChange={e => setF({...f, nombre_personalizado: e.target.value})}
                placeholder="Nombre de la tarea" />
            </>
          )}
          <label style={E.label}>Cliente (opcional)</label>
          <BuscadorDesplegable opciones={opsClientes} valor={f.cliente_id}
            onChange={v => setF({...f, cliente_id: v, servicio_id:""})}
            placeholder="— Buscar cliente —" />
          {f.cliente_id && opsServicios.length > 0 && (
            <>
              <label style={E.label}>Servicio (opcional)</label>
              <BuscadorDesplegable opciones={opsServicios} valor={f.servicio_id}
                onChange={v => setF({...f, servicio_id: v})} placeholder="— Buscar servicio —" />
            </>
          )}
          <label style={E.label}>Prioridad</label>
          <div style={{ marginBottom:"8px" }}>
            <SelectorPrioridad valor={f.prioridad} onChange={v => setF({...f, prioridad: v})} />
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"8px", marginBottom:"8px" }}>
            <div>
              <label style={E.label}>Fecha vencimiento (SLA)</label>
              <input type="date" style={E.input}
                value={f.fecha_vencimiento || ""}
                onChange={e => setF({...f, fecha_vencimiento: e.target.value})} />
            </div>
            <div>
              <label style={E.label}>SLA horas hábiles</label>
              <input type="number" min="1" style={E.input}
                value={f.sla_horas || ""}
                onChange={e => setF({...f, sla_horas: e.target.value})}
                placeholder="ej: 24 = 3 días" />
            </div>
          </div>
          <label style={E.label}>Instrucciones para el operador</label>
          <textarea style={{ ...E.input, height:"48px", resize:"vertical", marginBottom:"10px" }}
            value={f.comentario_supervisor}
            onChange={e => setF({...f, comentario_supervisor: e.target.value})}
            placeholder="Aclaraciones opcionales" />
          <div style={{ display:"flex", gap:"8px" }}>
            <button style={{ ...E.btn, opacity: guardando ? 0.6 : 1 }}
              onClick={crear} disabled={guardando}>
              {guardando ? "⏳ Guardando..." : "✅ Agregar"}
            </button>
            <button style={E.btnGris}
              onClick={() => { setMostrarForm(false); setMsg({ texto:"", tipo:"" }); }}>
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── PanelSugerencias (igual que v1.3.1, sin cambios) ───────── */
function PanelSugerencias({ anio, mes, onConfirmada, onCerrar, operadores, catalogo }) {
  const [sugerencias, setSugerencias]         = useState([]);
  const [cargando, setCargando]               = useState(true);
  const [operadorPorSug, setOperadorPorSug]   = useState({});
  const [prioridadPorSug, setPrioridadPorSug] = useState({});
  const [msg, setMsg]                         = useState({ texto:"", tipo:"" });
  const [confirmadas, setConfirmadas]         = useState(new Set());
  const [descartadas, setDescartadas]         = useState(new Set());
  const [seleccionadas, setSeleccionadas]     = useState(new Set());
  const [operadorMasivo, setOperadorMasivo]   = useState("");
  const [prioridadMasiva, setPrioridadMasiva] = useState("");
  const [guardandoIds, setGuardandoIds]       = useState(new Set());
  const [filtroCliente, setFiltroCliente]     = useState("");
  const [filtroTarea, setFiltroTarea]         = useState("");

  const opsOperadores = operadores.map(u => ({ value:u.id, label:`${u.nombre} ${u.apellido}` }));

  useEffect(() => { cargar(); }, []);

  async function cargar() {
    setCargando(true);
    try {
      const data = await api.get(`/tareas/agenda/sugerencias?anio=${anio}&mes=${mes}`);
      const sugs = data.sugerencias || [];
      setSugerencias(sugs);
      const priosIniciales = {};
      sugs.forEach(s => {
        const tcat = catalogo.find(t => t.id === s.catalogo_tarea_id);
        priosIniciales[claveSug(s)] = tcat?.prioridad_default || "media";
      });
      setPrioridadPorSug(priosIniciales);
    } catch(e) {
      setMsg({ texto:"❌ Error: " + e.message, tipo:"error" });
    }
    setCargando(false);
  }

  async function confirmarUna(s, operadorId, prioridad) {
    const clave = claveSug(s);
    if (!operadorId) {
      setMsg({ texto:`Asigná un operador para "${s.tarea_nombre} — ${s.cliente_nombre}"`, tipo:"error" });
      return false;
    }
    setGuardandoIds(prev => new Set([...prev, clave]));
    try {
      await api.post("/tareas/", {
        catalogo_tarea_id:     s.catalogo_tarea_id,
        rubro_id:              s.rubro_id,
        asignado_a_id:         operadorId,
        cliente_id:            s.cliente_id,
        servicio_id:           s.servicio_id,
        fecha_planificada:     s.fecha_sugerida,
        prioridad:             prioridad || "media",
        comentario_supervisor: `Calendarización automática: ${s.servicio_nombre}`,
      });
      setConfirmadas(prev => new Set([...prev, clave]));
      setGuardandoIds(prev => { const n = new Set(prev); n.delete(clave); return n; });
      return true;
    } catch(e) {
      setMsg({ texto:`❌ ${s.tarea_nombre} (${s.cliente_nombre}): ${e.message}`, tipo:"error" });
      setGuardandoIds(prev => { const n = new Set(prev); n.delete(clave); return n; });
      return false;
    }
  }

  async function confirmar(s) {
    const clave = claveSug(s);
    const ok = await confirmarUna(s, operadorPorSug[clave], prioridadPorSug[clave] || "media");
    if (ok) {
      setMsg({ texto:`✅ "${s.tarea_nombre}" (${s.cliente_nombre}) → ${s.fecha_sugerida.split("-").reverse().join("/")}`, tipo:"ok" });
      onConfirmada();
    }
  }

  async function confirmarMasivo() {
    if (!operadorMasivo) {
      setMsg({ texto:"Seleccioná un operador para la asignación masiva", tipo:"error" }); return;
    }
    if (seleccionadas.size === 0) {
      setMsg({ texto:"Seleccioná al menos una sugerencia", tipo:"error" }); return;
    }
    let ok = 0; let err = 0;
    for (const s of sugerencias) {
      const clave = claveSug(s);
      if (!seleccionadas.has(clave) || confirmadas.has(clave) || descartadas.has(clave)) continue;
      const prio   = prioridadMasiva || prioridadPorSug[clave] || "media";
      const result = await confirmarUna(s, operadorMasivo, prio);
      result ? ok++ : err++;
    }
    setSeleccionadas(new Set());
    onConfirmada();
    setMsg({
      texto: err > 0 ? `⚠️ ${ok} confirmadas, ${err} con error`
                     : `✅ ${ok} tarea${ok !== 1 ? "s" : ""} confirmada${ok !== 1 ? "s" : ""}`,
      tipo:  err > 0 ? "error" : "ok",
    });
  }

  function toggleSeleccion(clave) {
    setSeleccionadas(prev => { const n = new Set(prev); n.has(clave) ? n.delete(clave) : n.add(clave); return n; });
  }

  const pendientesFiltradas = sugerencias.filter(s => {
    if (confirmadas.has(claveSug(s)) || descartadas.has(claveSug(s))) return false;
    if (filtroCliente && s.cliente_id !== filtroCliente) return false;
    if (filtroTarea   && s.catalogo_tarea_id !== filtroTarea) return false;
    return true;
  });

  function toggleTodas() {
    const claves = pendientesFiltradas.map(claveSug);
    const todas  = claves.every(c => seleccionadas.has(c));
    setSeleccionadas(todas ? new Set() : new Set(claves));
  }

  const todasSel = pendientesFiltradas.length > 0 &&
    pendientesFiltradas.every(s => seleccionadas.has(claveSug(s)));

  const clientesUnicos = [...new Map(sugerencias.map(s => [s.cliente_id, { value:s.cliente_id, label:s.cliente_nombre }])).values()];
  const tareasUnicas   = [...new Map(sugerencias.map(s => [s.catalogo_tarea_id, { value:s.catalogo_tarea_id, label:`[${s.tarea_codigo}] ${s.tarea_nombre}` }])).values()];
  const pendientesTotales = sugerencias.filter(s => !confirmadas.has(claveSug(s)) && !descartadas.has(claveSug(s)));

  return (
    <div style={{ background:"#111827", borderRadius:"10px", padding:"16px",
      border:"1px solid #7c3aed", overflowY:"auto", maxHeight:"85vh" }}>
      <div style={{ display:"flex", justifyContent:"space-between",
        alignItems:"center", marginBottom:"14px" }}>
        <div>
          <div style={{ fontWeight:"700", fontSize:"14px", color:"#c4b5fd" }}>
            🤖 Sugerencias del mes
          </div>
          <div style={{ fontSize:"12px", color:"#6b7280", marginTop:"2px" }}>
            {MESES[mes-1]} {anio} · {pendientesTotales.length} pendiente{pendientesTotales.length!==1?"s":""}
            {confirmadas.size > 0 && ` · ✅ ${confirmadas.size}`}
            {descartadas.size > 0 && ` · 🗑️ ${descartadas.size}`}
          </div>
        </div>
        <button style={E.btnGris} onClick={onCerrar}>✕ Cerrar</button>
      </div>

      {msg.texto && (
        <div style={{
          background: msg.tipo === "ok" ? "#064e3b" : "#7f1d1d",
          border:`1px solid ${msg.tipo === "ok" ? "#10b981" : "#ef4444"}`,
          color: msg.tipo === "ok" ? "#10b981" : "#fca5a5",
          padding:"8px 10px", borderRadius:"6px", marginBottom:"10px",
          display:"flex", justifyContent:"space-between", fontSize:"12px" }}>
          <span>{msg.texto}</span>
          <button onClick={() => setMsg({ texto:"", tipo:"" })}
            style={{ background:"none", border:"none", color:"inherit", cursor:"pointer" }}>✕</button>
        </div>
      )}

      {cargando ? (
        <div style={{ textAlign:"center", padding:"20px", color:"#6b7280" }}>⏳ Calculando...</div>
      ) : sugerencias.length === 0 ? (
        <div style={{ textAlign:"center", padding:"20px", color:"#6b7280", fontSize:"13px" }}>
          No hay tareas automáticas configuradas
        </div>
      ) : (
        <>
          {pendientesTotales.length > 0 && (
            <div style={{ background:"#1f2937", borderRadius:"6px", padding:"10px",
              marginBottom:"12px", border:"1px solid #374151" }}>
              <div style={{ fontSize:"11px", color:"#9ca3af", marginBottom:"8px", fontWeight:"600" }}>
                ASIGNACIÓN MASIVA
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr",
                gap:"6px", marginBottom:"8px" }}>
                <div>
                  <div style={{ fontSize:"10px", color:"#6b7280", marginBottom:"3px" }}>Filtrar por cliente:</div>
                  <select style={{ ...E.select, fontSize:"11px", padding:"5px 8px" }}
                    value={filtroCliente}
                    onChange={e => { setFiltroCliente(e.target.value); setSeleccionadas(new Set()); }}>
                    <option value="">Todos los clientes</option>
                    {clientesUnicos.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                </div>
                <div>
                  <div style={{ fontSize:"10px", color:"#6b7280", marginBottom:"3px" }}>Filtrar por tarea:</div>
                  <select style={{ ...E.select, fontSize:"11px", padding:"5px 8px" }}
                    value={filtroTarea}
                    onChange={e => { setFiltroTarea(e.target.value); setSeleccionadas(new Set()); }}>
                    <option value="">Todas las tareas</option>
                    {tareasUnicas.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
              </div>
              <div style={{ display:"flex", gap:"8px", alignItems:"center", flexWrap:"wrap", marginBottom:"8px" }}>
                <label style={{ display:"flex", alignItems:"center", gap:"6px",
                  color:"#9ca3af", fontSize:"12px", cursor:"pointer", whiteSpace:"nowrap" }}>
                  <input type="checkbox" checked={todasSel} onChange={toggleTodas} />
                  Todas ({seleccionadas.size} sel.)
                </label>
                <div style={{ flex:1, minWidth:"160px" }}>
                  <BuscadorDesplegable opciones={opsOperadores} valor={operadorMasivo}
                    onChange={setOperadorMasivo} placeholder="— Operador —" />
                </div>
                <button
                  style={{ ...E.btnVerde, fontSize:"12px", padding:"5px 10px",
                    opacity: seleccionadas.size === 0 || !operadorMasivo ? 0.5 : 1 }}
                  onClick={confirmarMasivo}
                  disabled={seleccionadas.size === 0 || !operadorMasivo}>
                  ✅ Confirmar ({seleccionadas.size})
                </button>
              </div>
              <div>
                <div style={{ fontSize:"10px", color:"#6b7280", marginBottom:"4px" }}>Prioridad para las seleccionadas:</div>
                <div style={{ display:"flex", gap:"4px", flexWrap:"wrap" }}>
                  <button onClick={() => setPrioridadMasiva("")}
                    style={{ padding:"3px 8px", borderRadius:"4px", fontSize:"11px",
                      cursor:"pointer", border:"1px solid",
                      background: prioridadMasiva==="" ? "#374151" : "transparent",
                      color:      prioridadMasiva==="" ? "white"   : "#6b7280",
                      borderColor:prioridadMasiva==="" ? "#6b7280" : "#374151" }}>
                    Del catálogo
                  </button>
                  {PRIORIDADES.map(p => (
                    <button key={p.value} onClick={() => setPrioridadMasiva(p.value)}
                      style={{ padding:"3px 8px", borderRadius:"4px", fontSize:"11px",
                        cursor:"pointer", border:"1px solid",
                        background:   prioridadMasiva===p.value ? p.color+"33" : "transparent",
                        color:        prioridadMasiva===p.value ? p.color : "#6b7280",
                        borderColor:  prioridadMasiva===p.value ? p.color : "#374151" }}>
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
              {(filtroCliente || filtroTarea) && (
                <div style={{ fontSize:"11px", color:"#9ca3af", marginTop:"6px" }}>
                  Mostrando {pendientesFiltradas.length} de {pendientesTotales.length} pendientes
                </div>
              )}
            </div>
          )}

          <div style={{ display:"flex", flexDirection:"column", gap:"8px" }}>
            {sugerencias.filter(s => {
              if (filtroCliente && s.cliente_id !== filtroCliente) return false;
              if (filtroTarea   && s.catalogo_tarea_id !== filtroTarea) return false;
              return true;
            }).map(s => {
              const clave   = claveSug(s);
              const yaConf  = confirmadas.has(clave);
              const yaDesc  = descartadas.has(clave);
              const enProc  = guardandoIds.has(clave);
              const [a,m,d] = s.fecha_sugerida.split("-").map(Number);
              const prio    = prioridadPorSug[clave] || "media";
              const colPrio = PRIORIDADES.find(p => p.value === prio)?.color || "#6b7280";

              return (
                <div key={clave} style={{
                  background:"#1f2937", borderRadius:"6px", padding:"10px 12px",
                  border:`1px solid ${yaConf?"#059669":yaDesc?"#374151":"#7c3aed"}`,
                  opacity: yaDesc ? 0.5 : 1, transition:"opacity 0.2s" }}>
                  <div style={{ display:"flex", gap:"8px", alignItems:"flex-start" }}>
                    {!yaConf && !yaDesc && (
                      <input type="checkbox"
                        checked={seleccionadas.has(clave)}
                        onChange={() => toggleSeleccion(clave)}
                        style={{ marginTop:"3px", flexShrink:0, cursor:"pointer" }} />
                    )}
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:"11px", fontWeight:"700", marginBottom:"3px",
                        color: yaConf?"#10b981":yaDesc?"#6b7280":"#c4b5fd" }}>
                        📅 {d}/{m}/{a}
                        {yaConf && " ✅ Confirmada"}
                        {yaDesc && " 🗑️ Descartada"}
                        {enProc && " ⏳ Guardando..."}
                      </div>
                      <div style={{ fontWeight:"600", fontSize:"12px", color:"white" }}>
                        {s.tarea_nombre}
                        <span style={{ color:"#6b7280", fontFamily:"monospace",
                          fontSize:"10px", marginLeft:"6px" }}>[{s.tarea_codigo}]</span>
                      </div>
                      <div style={{ fontSize:"11px", color:"#9ca3af", marginTop:"2px" }}>
                        🏢 {s.cliente_nombre} · 🔧 {s.servicio_nombre}
                      </div>
                      {!yaConf && !yaDesc && (
                        <div style={{ marginTop:"6px", display:"flex", flexDirection:"column", gap:"5px" }}>
                          <BuscadorDesplegable opciones={opsOperadores}
                            valor={operadorPorSug[clave] || ""}
                            onChange={v => setOperadorPorSug(prev => ({...prev, [clave]: v}))}
                            placeholder="— Asignar operador —" />
                          <div>
                            <div style={{ fontSize:"10px", color:"#6b7280", marginBottom:"3px" }}>Prioridad:</div>
                            <SelectorPrioridad valor={prio}
                              onChange={v => setPrioridadPorSug(prev => ({...prev, [clave]: v}))} />
                          </div>
                        </div>
                      )}
                      {yaConf && (
                        <span style={{ ...E.badge, marginTop:"4px",
                          background:colPrio+"22", color:colPrio, border:`1px solid ${colPrio}` }}>
                          {prio}
                        </span>
                      )}
                    </div>
                    <div style={{ display:"flex", flexDirection:"column", gap:"4px", flexShrink:0 }}>
                      {!yaConf && !yaDesc && (
                        <>
                          <button style={{ ...E.btnVerde, fontSize:"11px", padding:"4px 8px",
                            opacity: enProc ? 0.5 : 1 }}
                            onClick={() => confirmar(s)} disabled={enProc}>✅</button>
                          <button style={{ ...E.btnRojo, fontSize:"11px", padding:"4px 8px" }}
                            onClick={() => setDescartadas(prev => new Set([...prev, clave]))}>🗑️</button>
                        </>
                      )}
                      {yaDesc && (
                        <button style={{ ...E.btnAma, fontSize:"11px", padding:"4px 8px" }}
                          onClick={() => setDescartadas(prev => { const n = new Set(prev); n.delete(clave); return n; })}>↩️</button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

/* ── SelectorVista ──────────────────────────────────────────── */
function SelectorVista({ vista, onChange }) {
  return (
    <div style={{ display:"flex", gap:"2px", background:"#1f2937",
      borderRadius:"6px", padding:"2px", border:"1px solid #374151" }}>
      {[{v:"7",l:"7 días"},{v:"5",l:"Lu-Vi"},{v:"dia",l:"Día"}].map(o => (
        <button key={o.v} onClick={() => onChange(o.v)} style={{
          background: vista===o.v ? "#6366f1" : "transparent",
          color:      vista===o.v ? "white"   : "#9ca3af",
          border:"none", padding:"5px 10px", borderRadius:"4px",
          cursor:"pointer", fontSize:"12px",
          fontWeight: vista===o.v ? "600" : "400", transition:"all 0.15s" }}>
          {o.l}
        </button>
      ))}
    </div>
  );
}

/* =============================================================
   COMPONENTE PRINCIPAL: Agenda v1.4.0
   ============================================================= */
export default function Agenda() {
  const { usuario } = useContext(AuthContext);
  const hoy  = new Date();
  const [anio, setAnio]   = useState(hoy.getFullYear());
  const [mes,  setMes]    = useState(hoy.getMonth() + 1);
  const [vista, setVista] = useState("7");
  const [porDia, setPorDia]     = useState({});
  const [cargando, setCargando] = useState(true);
  const [refreshing, setRefreshing] = useState(false); /* Para el botón ↻ */
  const [diaSeleccionado, setDiaSeleccionado]       = useState(null);
  const [mostrarSugerencias, setMostrarSugerencias] = useState(false);
  const [operadores, setOperadores] = useState([]);
  const [catalogo, setCatalogo]     = useState([]);
  const [operadorFiltro, setOperadorFiltro] = useState("");
  const [msgHeredar, setMsgHeredar] = useState({ texto:"", tipo:"" });

  const esSupervisor =
    usuario?.perfiles?.includes("supervisor") ||
    usuario?.perfiles?.includes("dueno")      ||
    usuario?.perfiles?.includes("administrador");

  useEffect(() => {
    Promise.all([
      api.get("/usuarios/"),
      api.get("/parametros/catalogo"),
    ]).then(([u, c]) => {
      setOperadores(u || []);
      setCatalogo(c  || []);
    }).catch(() => {});
  }, []);

  useEffect(() => { cargar(); }, [anio, mes, operadorFiltro]);

  const cargar = useCallback(async (silencioso = false) => {
    if (!silencioso) setCargando(true);
    else setRefreshing(true);
    try {
      let url = `/tareas/agenda/mes?anio=${anio}&mes=${mes}`;
      if (operadorFiltro) url += `&usuario_id=${operadorFiltro}`;
      const data = await api.get(url);
      setPorDia(data.por_dia || {});
    } catch { setPorDia({}); }
    if (!silencioso) setCargando(false);
    else setRefreshing(false);
  }, [anio, mes, operadorFiltro]);

  async function eliminarTarea(tareaId, nombre) {
    if (!confirm(`¿Quitar "${nombre}" del calendario?`)) return;
    try { await api.delete(`/tareas/${tareaId}`); cargar(true); }
    catch(e) { alert("❌ " + e.message); }
  }

  /**
   * DESCRIPCION FUNCIONAL:
   *   Hereda las tareas no finalizadas del día anterior al siguiente hábil.
   *   Solo disponible para supervisores.
   */
  const [modalHeredar, setModalHeredar] = useState(false);
  const [fechaHeredarDestino, setFechaHeredarDestino] = useState("");

  function abrirModalHeredar() {
    // Calcular próximo día hábil sugerido desde el día seleccionado
    const base = diaSeleccionado
      ? new Date(anio, mes-1, diaSeleccionado)
      : new Date();
    // Avanzar al próximo día hábil (saltear fines de semana)
    let siguiente = new Date(base);
    siguiente.setDate(siguiente.getDate() + 1);
    while (siguiente.getDay() === 0 || siguiente.getDay() === 6) {
      siguiente.setDate(siguiente.getDate() + 1);
    }
    const iso = `${siguiente.getFullYear()}-${String(siguiente.getMonth()+1).padStart(2,"0")}-${String(siguiente.getDate()).padStart(2,"0")}`;
    setFechaHeredarDestino(iso);
    setModalHeredar(true);
  }

  async function confirmarHeredar() {
    // diaSeleccionado puede ser número o string ISO — normalizar
    let fechaOrigen;
    if (!diaSeleccionado) {
      fechaOrigen = toISO(anio, mes, new Date().getDate());
    } else if (typeof diaSeleccionado === "string" && diaSeleccionado.includes("-")) {
      fechaOrigen = diaSeleccionado; // ya es ISO
    } else {
      fechaOrigen = toISO(anio, mes, diaSeleccionado);
    }
    try {
      const data = await api.post(`/tareas/heredar-dia?fecha=${fechaOrigen}&fecha_destino=${fechaHeredarDestino}`);
      setMsgHeredar({ texto:`✅ ${data.mensaje}`, tipo:"ok" });
      setModalHeredar(false);
      cargar(true);
    } catch(e) {
      setMsgHeredar({ texto:`❌ ${e.message}`, tipo:"error" });
    }
    setTimeout(() => setMsgHeredar({ texto:"", tipo:"" }), 5000);
  }

  function heredarDia() { abrirModalHeredar(); }

  function mesPrevio() {
    if (mes===1) { setAnio(a=>a-1); setMes(12); } else setMes(m=>m-1);
    setDiaSeleccionado(null);
  }
  function mesSiguiente() {
    if (mes===12) { setAnio(a=>a+1); setMes(1); } else setMes(m=>m+1);
    setDiaSeleccionado(null);
  }

  const hoyISO  = toISO(hoy.getFullYear(), hoy.getMonth()+1, hoy.getDate());
  const opsOps  = operadores.map(u => ({ value:u.id, label:`${u.nombre} ${u.apellido}` }));

  if (!esSupervisor) {
    return (
      <div style={{ minHeight:"100vh", background:"#030712", padding:"24px",
        color:"white", display:"flex", alignItems:"center", justifyContent:"center" }}>
        <div style={{ textAlign:"center" }}>
          <div style={{ fontSize:"48px", marginBottom:"16px" }}>🔒</div>
          <div style={{ fontSize:"16px", color:"#9ca3af" }}>
            La agenda solo está disponible para supervisores y dueños
          </div>
        </div>
      </div>
    );
  }

  const totalTareas = Object.values(porDia).flat().length;
  const completadas = Object.values(porDia).flat().filter(t=>t.estado==="completada").length;

  /* Vista dia unico */
  if (vista === "dia") {
    const fechaDia  = diaSeleccionado || hoyISO;
    const tareasDia = porDia[fechaDia] || [];
    const [a,m,d]   = fechaDia.split("-").map(Number);
    return (
      <div style={{ minHeight:"100vh", background:"#030712", padding:"24px", color:"white" }}>
        <div style={{ maxWidth:"900px", margin:"0 auto" }}>
          <div style={{ display:"flex", justifyContent:"space-between",
            alignItems:"center", marginBottom:"20px", flexWrap:"wrap", gap:"12px" }}>
            <h1 style={{ margin:0, fontSize:"22px" }}>📅 {d} de {MESES[m-1]} de {a}</h1>
            <div style={{ display:"flex", gap:"8px", alignItems:"center" }}>
              <SelectorVista vista={vista} onChange={v=>setVista(v)} />
              <input type="date" style={{ ...E.input, maxWidth:"160px" }}
                value={fechaDia} onChange={e=>setDiaSeleccionado(e.target.value)} />
            </div>
          </div>
          <PanelDia fecha={fechaDia} tareas={tareasDia}
            onCerrar={() => setVista("7")} onTareaCreada={() => cargar(true)}
            onEliminar={eliminarTarea} operadores={operadores}
            esSupervisor={esSupervisor} />
        </div>
      </div>
    );
  }

  const soloLaboral = vista === "5";
  const diasSemana  = soloLaboral ? DIAS_SEMANA_5 : DIAS_SEMANA_7;
  const semanas     = construirGrilla(anio, mes, soloLaboral);
  const tareasDiaSel = diaSeleccionado ? (porDia[diaSeleccionado] || []) : [];

  return (
    <div style={{ minHeight:"100vh", background:"#030712", padding:"24px", color:"white" }}>
      <div style={{ maxWidth:"1400px", margin:"0 auto" }}>

        {/* Encabezado con botón refresh ↻ */}
        <div style={{ display:"flex", justifyContent:"space-between",
          alignItems:"center", marginBottom:"16px", flexWrap:"wrap", gap:"12px" }}>
          <div>
            <h1 style={{ margin:0, fontSize:"22px" }}>📅 Agenda Mensual</h1>
            <div style={{ fontSize:"12px", color:"#6b7280", marginTop:"4px" }}>
              {totalTareas} tarea{totalTareas!==1?"s":""} en el mes
              {completadas>0 && ` · ${completadas} completada${completadas!==1?"s":""}`}
            </div>
          </div>
          <div style={{ display:"flex", gap:"8px", alignItems:"center", flexWrap:"wrap" }}>
            {/* Botón de refresh manual */}
            <button
              style={{ ...E.btnGris, padding:"7px 10px",
                opacity: refreshing ? 0.6 : 1 }}
              onClick={() => cargar(true)}
              disabled={refreshing}
              title="Actualizar calendario">
              {refreshing ? "⏳" : "↻"} Actualizar
            </button>

            <SelectorVista vista={vista} onChange={v => {
              setVista(v);
              if (v==="dia") setDiaSeleccionado(hoyISO);
            }} />

            <div style={{ minWidth:"200px" }}>
              <BuscadorDesplegable
                opciones={[{value:"",label:"Todos los operadores"},...opsOps]}
                valor={operadorFiltro} onChange={setOperadorFiltro}
                placeholder="Todos los operadores" />
            </div>

            <button style={{ ...E.btn, background:"#7c3aed" }}
              onClick={() => { setMostrarSugerencias(!mostrarSugerencias); setDiaSeleccionado(null); }}>
              🤖 Sugerir mes
            </button>

            {/* Botón heredar día — solo supervisores */}
            <button style={{ ...E.btn, background:"#0f766e" }}
              onClick={heredarDia}
              title="Hereda las tareas no finalizadas de hoy al siguiente día hábil">
              ↩ Heredar día
            </button>
          </div>
        </div>

        {/* Mensaje del heredar día */}
        {msgHeredar.texto && (
          <div style={{
            background: msgHeredar.tipo === "ok" ? "#064e3b" : "#7f1d1d",
            border:`1px solid ${msgHeredar.tipo === "ok" ? "#10b981" : "#ef4444"}`,
            color: msgHeredar.tipo === "ok" ? "#10b981" : "#fca5a5",
            padding:"10px 14px", borderRadius:"6px", marginBottom:"12px",
            display:"flex", justifyContent:"space-between", fontSize:"13px" }}>
            <span>{msgHeredar.texto}</span>
            <button onClick={() => setMsgHeredar({ texto:"", tipo:"" })}
              style={{ background:"none", border:"none", color:"inherit", cursor:"pointer" }}>✕</button>
          </div>
        )}

        {/* Navegacion mes */}
        <div style={{ display:"flex", alignItems:"center", gap:"16px", marginBottom:"16px" }}>
          <button style={E.btnGris} onClick={mesPrevio}>← Anterior</button>
          <h2 style={{ margin:0, fontSize:"18px", minWidth:"200px", textAlign:"center" }}>
            {MESES[mes-1]} {anio}
          </h2>
          <button style={E.btnGris} onClick={mesSiguiente}>Siguiente →</button>
          <button style={{ ...E.btnGris, fontSize:"12px" }}
            onClick={() => { setAnio(hoy.getFullYear()); setMes(hoy.getMonth()+1); }}>
            Hoy
          </button>
        </div>

        {/* Layout */}
        <div style={{ display:"grid",
          gridTemplateColumns: (diaSeleccionado||mostrarSugerencias) ? "1fr 340px" : "1fr",
          gap:"20px", alignItems:"start" }}>

          <div>
            {/* Cabecera dias */}
            <div style={{ display:"grid",
              gridTemplateColumns:`repeat(${diasSemana.length},1fr)`,
              gap:"2px", marginBottom:"2px" }}>
              {diasSemana.map(d=>(
                <div key={d} style={{ textAlign:"center", fontSize:"11px",
                  fontWeight:"700", color:"#6b7280", padding:"6px 0" }}>{d}</div>
              ))}
            </div>

            {cargando ? (
              <div style={{ textAlign:"center", padding:"60px", color:"#6b7280" }}>
                ⏳ Cargando agenda...
              </div>
            ) : (
              semanas.map((semana, si) => (
                <div key={si} style={{ display:"grid",
                  gridTemplateColumns:`repeat(${diasSemana.length},1fr)`,
                  gap:"2px", marginBottom:"2px" }}>
                  {semana.map((dia, di) => {
                    if (!dia) return (
                      <div key={di} style={{ background:"#0a0f1a", borderRadius:"6px",
                        height:"90px", border:"1px solid #1f2937" }} />
                    );
                    const fechaISO    = toISO(anio, mes, dia);
                    const todasTareas = porDia[fechaISO] || [];
                    const tareasDia   = todasTareas.filter(t => t.estado !== "completada");
                    const sel         = diaSeleccionado === fechaISO;
                    const hoyF        = esHoy(anio, mes, dia);

                    return (
                      <div key={di}
                        onClick={() => {
                          setDiaSeleccionado(sel ? null : fechaISO);
                          setMostrarSugerencias(false);
                        }}
                        style={{
                          background:   sel ? "#1e1b4b" : hoyF ? "#172554" : "#111827",
                          borderRadius: "6px",
                          height:       "90px",
                          overflow:     "hidden",
                          padding:      "6px",
                          cursor:       "pointer",
                          border:       `1px solid ${sel?"#6366f1":hoyF?"#3b82f6":"#1f2937"}`,
                          transition:   "all 0.1s",
                          boxSizing:    "border-box",
                        }}>
                        <div style={{ fontSize:"12px", fontWeight:hoyF?"700":"600",
                          color:hoyF?"#60a5fa":"white",
                          marginBottom:"4px", display:"flex", alignItems:"center", gap:"4px" }}>
                          {dia}
                          {hoyF && (
                            <span style={{ fontSize:"9px", background:"#3b82f6",
                              color:"white", padding:"0 4px", borderRadius:"8px" }}>hoy</span>
                          )}
                          {todasTareas.length > 0 && (
                            <span style={{ marginLeft:"auto", fontSize:"9px",
                              background:"#374151", color:"#9ca3af",
                              padding:"0 4px", borderRadius:"8px" }}>
                              {todasTareas.length}
                            </span>
                          )}
                        </div>
                        <div style={{ overflow:"hidden" }}>
                          {tareasDia.filter(t => !["validacion_pendiente","rechazada"].includes(t.estado)).slice(0, 3).map(t => <PipTarea key={t.id} tarea={t} />)}
                          {tareasDia.length > 3 && (
                            <div style={{ fontSize:"9px", color:"#6b7280" }}>
                              +{tareasDia.length - 3} más
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))
            )}
          </div>

          {diaSeleccionado && !mostrarSugerencias && (
            <PanelDia fecha={diaSeleccionado} tareas={tareasDiaSel}
              onCerrar={() => setDiaSeleccionado(null)}
              onTareaCreada={() => cargar(true)}
              onEliminar={eliminarTarea}
              operadores={operadores}
              esSupervisor={esSupervisor} />
          )}
          {mostrarSugerencias && !diaSeleccionado && (
            <PanelSugerencias anio={anio} mes={mes}
              onConfirmada={() => cargar(true)}
              onCerrar={() => setMostrarSugerencias(false)}
              operadores={operadores} catalogo={catalogo} />
          )}
        </div>
      </div>
      {/* Modal heredar día */}
      {modalHeredar && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.7)",
          display:"flex", alignItems:"center", justifyContent:"center", zIndex:9999 }}>
          <div style={{ background:"#1f2937", borderRadius:"10px", padding:"24px",
            border:"1px solid #6366f1", width:"380px", maxWidth:"90vw" }}>
            <h3 style={{ margin:"0 0 16px", fontSize:"15px", color:"white" }}>
              ↩ Heredar tareas al día siguiente
            </h3>
            <p style={{ fontSize:"13px", color:"#94a3b8", marginBottom:"14px" }}>
              Las tareas pendientes, pausadas y en curso del día seleccionado
              se moverán al día que elijas.
            </p>
            <label style={{ color:"#9ca3af", fontSize:"12px", display:"block",
              marginBottom:"4px" }}>
              Día destino (sugerido: próximo día hábil)
            </label>
            <input type="date" value={fechaHeredarDestino}
              onChange={e => setFechaHeredarDestino(e.target.value)}
              style={{ background:"#111827", border:"1px solid #374151",
                color:"white", padding:"8px 10px", borderRadius:"6px",
                width:"100%", fontSize:"13px", boxSizing:"border-box",
                marginBottom:"16px" }} />
            <div style={{ display:"flex", gap:"8px", justifyContent:"flex-end" }}>
              <button onClick={() => setModalHeredar(false)}
                style={{ background:"#374151", color:"white", border:"none",
                  padding:"8px 16px", borderRadius:"6px", cursor:"pointer" }}>
                Cancelar
              </button>
              <button onClick={confirmarHeredar}
                style={{ background:"#6366f1", color:"white", border:"none",
                  padding:"8px 16px", borderRadius:"6px", cursor:"pointer",
                  fontWeight:"600" }}>
                ↩ Confirmar herencia
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}