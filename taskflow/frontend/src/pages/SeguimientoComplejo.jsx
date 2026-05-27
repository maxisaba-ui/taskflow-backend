/**
 * SeguimientoComplejo.jsx — v1.1.0
 * Fix: ItemValidacion como componente separado (reglas de Hooks)
 */
import { useState, useEffect, useContext } from "react";
import { api } from "../api/client.js";
import { AuthContext } from "../context/AuthContext.jsx";

const ESTADO_ETAPA = {
  pendiente:           { color:"#93c5fd", bg:"#1e3a5f", borde:"#2563eb", label:"Pendiente" },
  en_curso:            { color:"#6ee7b7", bg:"#064e3b", borde:"#059669", label:"En curso" },
  completada:          { color:"#86efac", bg:"#1a2e1a", borde:"#16a34a", label:"Completada" },
  bloqueada:           { color:"#6b7280", bg:"#111827", borde:"#374151", label:"Bloqueada" },
  validacion_pendiente:{ color:"#fde68a", bg:"#78350f", borde:"#d97706", label:"Esperando validación" },
  rechazada:           { color:"#fca5a5", bg:"#450a0a", borde:"#ef4444", label:"Rechazada" },
};
const E = {
  btn:     { background:"#6366f1", color:"white", border:"none", padding:"7px 14px", borderRadius:"6px", cursor:"pointer", fontSize:"13px", fontWeight:"500" },
  btnGris: { background:"#374151", color:"white", border:"none", padding:"7px 14px", borderRadius:"6px", cursor:"pointer", fontSize:"13px" },
  btnVerde:{ background:"#059669", color:"white", border:"none", padding:"7px 14px", borderRadius:"6px", cursor:"pointer", fontSize:"13px", fontWeight:"500" },
  btnRojo: { background:"#ef4444", color:"white", border:"none", padding:"7px 14px", borderRadius:"6px", cursor:"pointer", fontSize:"13px" },
  badge:   { fontSize:"11px", padding:"3px 8px", borderRadius:"8px", fontWeight:"600", display:"inline-block" },
  input:   { background:"#111827", border:"1px solid #374151", color:"white", padding:"7px 10px", borderRadius:"6px", fontSize:"13px", boxSizing:"border-box" },
};
function fmtMins(m) { if (!m) return "—"; return m >= 60 ? `${Math.floor(m/60)}h ${m%60}m` : `${m}m`; }
function fmtFechaHora(iso) {
  if (!iso) return "—";
  try { const d = new Date(iso); return `${d.toLocaleDateString("es-AR")} ${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`; }
  catch { return iso; }
}

function TarjetaEtapa({ etapa, totalEtapas, usuarioId, esSupervisor, onIniciar, onPausar, onFinalizar, onValidar, soloLectura = false }) {
  const cfg = ESTADO_ETAPA[etapa.estado] || ESTADO_ETAPA.pendiente;
  const esAsignado = etapa.asignado_id === usuarioId;
  const [comentario, setComentario] = useState("");
  const [motivo, setMotivo] = useState("");
  const [mostrando, setMostrando] = useState(null);
  return (
    <div style={{ background:"#1e293b", borderRadius:"10px", padding:"14px", marginBottom:"10px", border:`1px solid ${cfg.borde}`, opacity: etapa.estado === "bloqueada" ? 0.5 : 1 }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"8px" }}>
        <div style={{ display:"flex", alignItems:"center", gap:"10px" }}>
          <div style={{ width:"28px", height:"28px", borderRadius:"50%", background:cfg.borde, display:"flex", alignItems:"center", justifyContent:"center", fontSize:"12px", fontWeight:"700", color:"white", flexShrink:0 }}>{etapa.orden}</div>
          <div>
            <div style={{ fontWeight:"700", fontSize:"13px", color:"white" }}>{etapa.nombre}</div>
            {etapa.descripcion && <div style={{ fontSize:"11px", color:"#94a3b8", marginTop:"2px" }}>{etapa.descripcion}</div>}
          </div>
        </div>
        <span style={{ ...E.badge, background:cfg.bg, color:cfg.color, border:`1px solid ${cfg.borde}`, flexShrink:0 }}>{cfg.label}</span>
      </div>
      <div style={{ display:"flex", gap:"16px", flexWrap:"wrap", fontSize:"11px", color:"#94a3b8", marginBottom:"8px" }}>
        <span>👤 {etapa.asignado_nombre || "Sin asignar"}</span>
        {etapa.es_reasignada && <span style={{ color:"#fde68a" }}>↩ Reasignada</span>}
        {etapa.tiempo_trabajado_minutos > 0 && <span>⏱ {fmtMins(etapa.tiempo_trabajado_minutos)}</span>}
        {etapa.inicio_real && <span>▶ {fmtFechaHora(etapa.inicio_real)}</span>}
        {etapa.fin_real && <span>■ {fmtFechaHora(etapa.fin_real)}</span>}
        {etapa.estado === "validacion_pendiente" && <span style={{ color:"#c4b5fd", fontWeight:"600" }}>🔐 Esperando validación del supervisor</span>}
        {etapa.vencimiento_sla && etapa.estado === "validacion_pendiente" && (
          <span style={{ color: etapa.sla_vencido ? "#ef4444" : "#fde68a" }}>
            {etapa.sla_vencido ? "⚠️ SLA vencido" : `⏰ Vence: ${fmtFechaHora(etapa.vencimiento_sla)}`}
          </span>
        )}
      </div>
      {etapa.requiere_correccion && (
        <div style={{ background:"#450a0a", color:"#fca5a5", padding:"6px 12px",
          borderRadius:"6px", fontSize:"12px", fontWeight:"700",
          marginBottom:"8px", border:"1px solid #ef4444" }}>
          🔄 ESTE PASO REQUIERE CORRECCIÓN — Revisá los comentarios del supervisor
        </div>
      )}
      {etapa.historial_rechazos && (
        <div style={{ fontSize:"10px", color:"#fca5a5", background:"#450a0a22",
          padding:"6px 10px", borderRadius:"6px", marginBottom:"8px",
          border:"1px solid #ef444444", whiteSpace:"pre-line" }}>
          📋 Historial: {etapa.historial_rechazos}
        </div>
      )}
      {etapa.comentario_operador && <div style={{ fontSize:"11px", color:"#86efac", background:"#052e16", padding:"6px 10px", borderRadius:"6px", marginBottom:"8px" }}>📝 {etapa.comentario_operador}</div>}
      {etapa.validador_nombre && <div style={{ fontSize:"11px", color:"#a5b4fc", background:"#1e1b4b", padding:"6px 10px", borderRadius:"6px", marginBottom:"8px" }}>✅ Validado por {etapa.validador_nombre} — {fmtFechaHora(etapa.fecha_validacion)}{etapa.comentario_validacion && `: ${etapa.comentario_validacion}`}</div>}
      {esAsignado && etapa.estado === "pendiente" && !soloLectura && (
        <div style={{ marginTop:"8px" }}><button style={E.btnVerde} onClick={() => onIniciar(etapa.id)}>▶ Iniciar esta etapa</button></div>
      )}
      {esAsignado && etapa.estado === "en_curso" && !soloLectura && (
        <div style={{ marginTop:"8px", display:"flex", gap:"8px", flexWrap:"wrap" }}>
          {mostrando !== "pausa" && mostrando !== "fin" && (<><button style={{ ...E.btn, background:"#f59e0b", color:"black" }} onClick={() => setMostrando("pausa")}>⏸ Pausar</button><button style={E.btn} onClick={() => setMostrando("fin")}>■ Finalizar</button></>)}
          {mostrando === "pausa" && (<div style={{ width:"100%" }}><textarea value={motivo} onChange={e => setMotivo(e.target.value)} placeholder="Motivo de la pausa *" style={{ ...E.input, width:"100%", height:"50px", resize:"vertical", marginBottom:"6px" }} /><div style={{ display:"flex", gap:"8px" }}><button style={{ ...E.btn, background:"#f59e0b", color:"black" }} onClick={() => { onPausar(etapa.id, motivo, ""); setMostrando(null); setMotivo(""); }}>⏸ Confirmar pausa</button><button style={E.btnGris} onClick={() => setMostrando(null)}>Cancelar</button></div></div>)}
          {mostrando === "fin" && (<div style={{ width:"100%" }}><textarea value={comentario} onChange={e => setComentario(e.target.value)} placeholder="Comentario final (opcional)" style={{ ...E.input, width:"100%", height:"50px", resize:"vertical", marginBottom:"6px" }} /><div style={{ display:"flex", gap:"8px" }}><button style={E.btnVerde} onClick={() => { onFinalizar(etapa.id, comentario); setMostrando(null); setComentario(""); }}>✅ Finalizar etapa</button><button style={E.btnGris} onClick={() => setMostrando(null)}>Cancelar</button></div></div>)}
        </div>
      )}
      {esSupervisor && etapa.estado === "validacion_pendiente" && String(etapa.asignado_id) !== String(usuarioId) && (
        <div style={{ marginTop:"10px", background:"#1a1a2e", padding:"12px", borderRadius:"8px", border:"1px solid #7c3aed" }}>
          <div style={{ fontSize:"12px", color:"#c4b5fd", marginBottom:"8px", fontWeight:"600" }}>🔐 Esta etapa requiere tu validación</div>
          {mostrando !== "validar" ? (
            <div style={{ display:"flex", gap:"8px" }}><button style={E.btnVerde} onClick={() => onValidar(etapa.id, true, "")}>✅ Aprobar</button><button style={E.btnRojo} onClick={() => setMostrando("validar")}>❌ Rechazar</button></div>
          ) : (
            <div><textarea value={comentario} onChange={e => setComentario(e.target.value)} placeholder="Motivo del rechazo *" style={{ ...E.input, width:"100%", height:"50px", resize:"vertical", marginBottom:"6px" }} /><div style={{ display:"flex", gap:"8px" }}><button style={E.btnRojo} onClick={() => { onValidar(etapa.id, false, comentario); setMostrando(null); setComentario(""); }}>❌ Confirmar rechazo</button><button style={E.btnGris} onClick={() => setMostrando(null)}>Cancelar</button></div></div>
          )}
        </div>
      )}
    </div>
  );
}

function ItemValidacion({ item, onValidar }) {
  const [comentario, setComentario] = useState("");
  const [accion,     setAccion]     = useState("corregir");
  const [prioridad,  setPrioridad]  = useState("");
  const [rechazando, setRechazando] = useState(false);
  function confirmarRechazo() {
    if (!comentario.trim()) { alert("El motivo de rechazo es obligatorio"); return; }
    onValidar(item.etapa_id, false, comentario, accion, prioridad || null);
  }
  return (
    <div style={{ background:"#1e293b", borderRadius:"10px", padding:"14px", marginBottom:"10px", border:`2px solid ${item.urgente ? "#ef4444" : item.sla_vencido ? "#f97316" : "#7c3aed"}` }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:"8px" }}>
        <div>
          <div style={{ fontWeight:"700", fontSize:"13px", color:"white" }}>{item.tarea_nombre}</div>
          <div style={{ fontSize:"12px", color:"#94a3b8", marginTop:"2px" }}>Etapa {item.etapa_orden}: {item.etapa_nombre}</div>
        </div>
        {(item.urgente || item.sla_vencido) && <span style={{ background:"#450a0a", color:"#fca5a5", padding:"3px 8px", borderRadius:"6px", fontSize:"11px", fontWeight:"700", flexShrink:0 }}>{item.sla_vencido ? "⚠️ SLA VENCIDO" : "🔴 URGENTE"}</span>}
      </div>
      <div style={{ display:"flex", gap:"14px", flexWrap:"wrap", fontSize:"11px", color:"#94a3b8", marginBottom:"8px" }}>
        <span>👤 {item.operador_nombre}</span>
        {item.cliente_nombre && <span>🏢 {item.cliente_nombre}</span>}
        <span>⏱ {item.tiempo_trabajado_min ? `${item.tiempo_trabajado_min} min trabajados` : "—"}</span>
        {item.horas_restantes_sla != null && !item.sla_vencido && <span style={{ color: item.urgente ? "#fca5a5" : "#fde68a" }}>⏰ {Math.max(0, item.horas_restantes_sla).toFixed(1)}h para validar</span>}
      </div>
      {item.comentario_operador && <div style={{ fontSize:"11px", color:"#86efac", background:"#052e16", padding:"6px 10px", borderRadius:"6px", marginBottom:"8px" }}>📝 {item.comentario_operador}</div>}
      {item.historial_rechazos && <div style={{ fontSize:"10px", color:"#fca5a5", background:"#450a0a22", border:"1px solid #ef444444", padding:"6px 10px", borderRadius:"6px", marginBottom:"8px", whiteSpace:"pre-line" }}>📋 Historial: {item.historial_rechazos}</div>}
      {!rechazando ? (
        <div style={{ display:"flex", gap:"8px" }}>
          <textarea value={comentario} onChange={e => setComentario(e.target.value)} placeholder="Comentario (opcional para aprobar)" style={{ ...E.input, flex:1, height:"36px", resize:"none" }} />
          <button style={E.btnVerde} onClick={() => onValidar(item.etapa_id, true, comentario)}>✅ Aprobar</button>
          <button style={E.btnRojo} onClick={() => setRechazando(true)}>❌ Rechazar</button>
        </div>
      ) : (
        <div style={{ background:"#1a0a0a", borderRadius:"8px", padding:"12px", border:"1px solid #ef4444" }}>
          <div style={{ fontSize:"12px", color:"#fca5a5", fontWeight:"600", marginBottom:"10px" }}>❌ Configurar rechazo</div>
          <label style={{ ...E.label, color:"#fca5a5" }}>Motivo * (obligatorio)</label>
          <textarea value={comentario} onChange={e => setComentario(e.target.value)} placeholder="Describí el motivo en detalle..." style={{ ...E.input, width:"100%", height:"60px", resize:"vertical", marginBottom:"10px", borderColor: !comentario.trim() ? "#ef4444" : "#374151" }} />
          <label style={E.label}>Acción</label>
          <div style={{ display:"flex", gap:"8px", marginBottom:"10px" }}>
            <button onClick={() => setAccion("corregir")} style={{ flex:1, padding:"8px", borderRadius:"6px", cursor:"pointer", fontSize:"12px", background: accion==="corregir"?"#92400e":"#1f2937", color: accion==="corregir"?"#fde68a":"#9ca3af", border: accion==="corregir"?"1px solid #d97706":"1px solid #374151", fontWeight: accion==="corregir"?"700":"400" }}>🔄 Corregir<div style={{ fontSize:"10px", fontWeight:"400" }}>El operador rehace este paso</div></button>
            <button onClick={() => setAccion("desestimar")} style={{ flex:1, padding:"8px", borderRadius:"6px", cursor:"pointer", fontSize:"12px", background: accion==="desestimar"?"#450a0a":"#1f2937", color: accion==="desestimar"?"#fca5a5":"#9ca3af", border: accion==="desestimar"?"1px solid #ef4444":"1px solid #374151", fontWeight: accion==="desestimar"?"700":"400" }}>🗑️ Desestimar<div style={{ fontSize:"10px", fontWeight:"400" }}>Cancela toda la tarea</div></button>
          </div>
          {accion === "corregir" && (
            <div style={{ marginBottom:"10px" }}>
              <label style={E.label}>Prioridad para corrección (opcional)</label>
              <select value={prioridad} onChange={e => setPrioridad(e.target.value)} style={{ ...E.input, width:"100%" }}>
                <option value="">— Mantener la actual —</option>
                <option value="urgente">🔴 Urgente</option>
                <option value="alta">🟠 Alta</option>
                <option value="media">🟡 Media</option>
                <option value="baja">🟢 Baja</option>
              </select>
            </div>
          )}
          {accion === "desestimar" && <div style={{ fontSize:"11px", color:"#fca5a5", background:"#450a0a", padding:"8px", borderRadius:"6px", marginBottom:"10px", border:"1px solid #ef4444" }}>⚠️ Cancela TODA la tarea compleja. El operador recibirá notificación.</div>}
          <div style={{ display:"flex", gap:"8px" }}>
            <button style={E.btnRojo} onClick={confirmarRechazo}>{accion==="corregir" ? "🔄 Confirmar corrección" : "🗑️ Confirmar cancelación"}</button>
            <button style={E.btnGris} onClick={() => { setRechazando(false); setComentario(""); }}>Cancelar</button>
          </div>
        </div>
      )}
    </div>
  );
}

function BandejaValidaciones({ usuario }) {
  const [items, setItems] = useState([]);
  const [cargando, setCarg] = useState(true);
  const [msg, setMsg] = useState({ texto:"", tipo:"" });
  useEffect(() => { cargar(); }, []);
  async function cargar() {
    setCarg(true);
    try { const data = await api.get("/tareas-complejas/bandeja-validaciones"); setItems(data || []); }
    catch(e) { setMsg({ texto:"❌ " + e.message, tipo:"error" }); }
    setCarg(false);
  }
  async function validar(etapaId, aprobada, comentario, accionRechazo, prioridadRechazo) {
    try {
      await api.post(`/tareas-complejas/etapa/${etapaId}/validar`, {
        aprobada, comentario,
        accion_rechazo: accionRechazo || "corregir",
        prioridad_rechazo: prioridadRechazo || null,
      });
      setMsg({ texto: aprobada ? "✅ Etapa aprobada" : "❌ Etapa rechazada/cancelada", tipo: aprobada ? "ok" : "error" });
      cargar();
    } catch(e) { setMsg({ texto:"❌ " + e.message, tipo:"error" }); }
  }
  if (cargando) return <div style={{ textAlign:"center", padding:"40px", color:"#94a3b8" }}>⏳ Cargando bandeja...</div>;
  return (
    <div>
      {msg.texto && (
        <div style={{ background: msg.tipo==="ok"?"#064e3b":"#7f1d1d", border:`1px solid ${msg.tipo==="ok"?"#10b981":"#ef4444"}`, color: msg.tipo==="ok"?"#10b981":"#fca5a5", padding:"10px 14px", borderRadius:"6px", marginBottom:"14px", display:"flex", justifyContent:"space-between", fontSize:"13px" }}>
          <span>{msg.texto}</span>
          <button onClick={() => setMsg({ texto:"", tipo:"" })} style={{ background:"none", border:"none", color:"inherit", cursor:"pointer" }}>✕</button>
        </div>
      )}
      {/* Sección 1: etapas por validar (acción del supervisor) */}
      <div style={{ marginBottom:"20px" }}>
        <div style={{ fontSize:"13px", fontWeight:"600", color:"#c4b5fd",
          marginBottom:"12px", display:"flex", alignItems:"center", gap:"8px" }}>
          <span style={{ background:"#3b1d8a", padding:"2px 8px",
            borderRadius:"6px", fontSize:"11px" }}>
            {items.length}
          </span>
          📥 Etapas que esperan tu validación
        </div>
        {items.length === 0 ? (
          <div style={{ textAlign:"center", padding:"30px", color:"#94a3b8",
            background:"#1e293b", borderRadius:"8px", border:"1px solid #334155" }}>
            <div style={{ fontSize:"24px", marginBottom:"8px" }}>🎉</div>
            <div style={{ fontSize:"13px" }}>No hay etapas pendientes de validación</div>
          </div>
        ) : (
          items.map(item => <ItemValidacion key={item.etapa_id} item={item} onValidar={validar} />)
        )}
      </div>

      {/* Sección 2: etapas propias esperando validación del supervisor */}
      <BandejaEsperandoValidacion />
    </div>
  );
}



/* Sección inferior: etapas del usuario esperando validación del supervisor */
function BandejaEsperandoValidacion() {
  const { usuario } = useContext(AuthContext);
  const [items, setItems]   = useState([]);
  const [cargando, setCarg] = useState(true);

  useEffect(() => { cargar(); }, []);

  async function cargar() {
    setCarg(true);
    try {
      const data = await api.get("/tareas-complejas/bandeja-operador");
      setItems(data || []);
    } catch { setItems([]); }
    setCarg(false);
  }

  if (cargando) return null;

  return (
    <div style={{ marginTop:"8px" }}>
      <div style={{ fontSize:"13px", fontWeight:"600", color:"#94a3b8",
        marginBottom:"12px", display:"flex", alignItems:"center", gap:"8px" }}>
        <span style={{ background:"#1e293b", padding:"2px 8px",
          borderRadius:"6px", fontSize:"11px", border:"1px solid #334155" }}>
          {items.length}
        </span>
        ⏳ Tus etapas esperando validación del supervisor
      </div>
      {items.length === 0 ? (
        <div style={{ textAlign:"center", padding:"20px", color:"#6b7280",
          background:"#1e293b", borderRadius:"8px", border:"1px solid #334155",
          fontSize:"13px" }}>
          No tenés etapas esperando validación
        </div>
      ) : items.map(item => (
        <div key={item.etapa_id}
          style={{ background:"#1e293b", borderRadius:"10px", padding:"12px",
            marginBottom:"8px",
            border:`1px solid ${item.requiere_correccion ? "#ef4444" : "#d97706"}` }}>
          {/* Badge de estado */}
          {item.requiere_correccion && (
            <div style={{ background:"#450a0a", color:"#fca5a5",
              padding:"4px 10px", borderRadius:"6px", fontSize:"11px",
              fontWeight:"700", marginBottom:"8px", display:"inline-block" }}>
              🔄 REQUIERE CORRECCIÓN
            </div>
          )}
          {!item.requiere_correccion && (
            <div style={{ background:"#78350f", color:"#fde68a",
              padding:"4px 10px", borderRadius:"6px", fontSize:"11px",
              fontWeight:"700", marginBottom:"8px", display:"inline-block" }}>
              ⏳ ESPERANDO VALIDACIÓN
            </div>
          )}
          <div style={{ fontWeight:"700", fontSize:"13px", color:"white",
            marginBottom:"4px" }}>
            {item.tarea_nombre}
          </div>
          <div style={{ fontSize:"12px", color:"#94a3b8", marginBottom:"6px" }}>
            Etapa {item.etapa_orden}: {item.etapa_nombre}
          </div>
          {item.comentario_validacion && (
            <div style={{ fontSize:"11px", color:"#fca5a5", background:"#450a0a22",
              padding:"6px 10px", borderRadius:"6px", marginBottom:"6px",
              border:"1px solid #ef444444" }}>
              💬 Supervisor: {item.comentario_validacion}
            </div>
          )}
          {item.historial_rechazos && (
            <div style={{ fontSize:"10px", color:"#9ca3af", background:"#111827",
              padding:"6px 10px", borderRadius:"6px", whiteSpace:"pre-line",
              border:"1px solid #1f2937" }}>
              📋 {item.historial_rechazos}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
function DetalleTareaCompleja({ tareaId, onVolver }) {
  const { usuario } = useContext(AuthContext);
  const [datos, setDatos] = useState(null);
  const [cargando, setCarg] = useState(true);
  const [msg, setMsg] = useState({ texto:"", tipo:"" });
  const esSupervisor = usuario?.perfiles?.includes("supervisor") || usuario?.perfiles?.includes("dueno") || usuario?.perfiles?.includes("administrador");
  useEffect(() => { cargar(); }, [tareaId]);
  async function cargar() {
    setCarg(true);
    try { const data = await api.get(`/tareas-complejas/tarea/${tareaId}/etapas`); setDatos(data); }
    catch(e) { setMsg({ texto:"❌ " + e.message, tipo:"error" }); }
    setCarg(false);
  }
  async function accion(url, payload) {
    try { await api.post(url, payload); cargar(); }
    catch(e) { setMsg({ texto:"❌ " + e.message, tipo:"error" }); }
  }
  if (cargando) return <div style={{ textAlign:"center", padding:"40px", color:"#94a3b8" }}>⏳</div>;
  if (!datos) return <div style={{ color:"#fca5a5" }}>{msg.texto || "Sin datos"}</div>;
  const completadas = datos.etapas.filter(e => e.estado === "completada").length;
  const pct = Math.round(completadas / datos.total_etapas * 100);
  return (
    <div>
      <div style={{ display:"flex", alignItems:"center", gap:"12px", marginBottom:"16px" }}>
        {onVolver && <button style={E.btnGris} onClick={onVolver}>← Volver</button>}
        <div>
          <div style={{ fontWeight:"700", fontSize:"16px", color:"white" }}>🔀 Seguimiento detallado</div>
          <div style={{ fontSize:"12px", color:"#94a3b8" }}>Etapa {datos.etapa_actual} de {datos.total_etapas} · Estado: {datos.estado_general}</div>
        </div>
      </div>
      <div style={{ background:"#1e293b", borderRadius:"8px", padding:"12px", marginBottom:"16px", border:"1px solid #334155" }}>
        <div style={{ display:"flex", justifyContent:"space-between", fontSize:"12px", color:"#94a3b8", marginBottom:"6px" }}><span>Progreso</span><span>{completadas}/{datos.total_etapas} etapas ({pct}%)</span></div>
        <div style={{ background:"#334155", borderRadius:"4px", height:"8px", overflow:"hidden" }}><div style={{ width:`${pct}%`, height:"100%", background: pct===100?"#16a34a":"#6366f1", transition:"width 0.4s", borderRadius:"4px" }} /></div>
      </div>
      {msg.texto && <div style={{ background: msg.tipo==="ok"?"#064e3b":"#7f1d1d", border:`1px solid ${msg.tipo==="ok"?"#10b981":"#ef4444"}`, color: msg.tipo==="ok"?"#10b981":"#fca5a5", padding:"10px 14px", borderRadius:"6px", marginBottom:"14px", display:"flex", justifyContent:"space-between", fontSize:"13px" }}><span>{msg.texto}</span><button onClick={() => setMsg({ texto:"", tipo:"" })} style={{ background:"none", border:"none", color:"inherit", cursor:"pointer" }}>✕</button></div>}
      {datos.etapas.map(etapa => (
        <TarjetaEtapa key={etapa.id} etapa={etapa} totalEtapas={datos.total_etapas} usuarioId={usuario?.id} esSupervisor={esSupervisor} soloLectura={false}
          onIniciar={id => accion(`/tareas-complejas/etapa/${id}/iniciar`, {})}
          onPausar={(id, mot, com) => accion(`/tareas-complejas/etapa/${id}/pausar`, { motivo: mot, comentario: com })}
          onFinalizar={(id, com) => accion(`/tareas-complejas/etapa/${id}/finalizar`, { comentario: com })}
          onValidar={(id, ap, com) => accion(`/tareas-complejas/etapa/${id}/validar`, { aprobada: ap, comentario: com })} />
      ))}
    </div>
  );
}

export default function SeguimientoComplejo() {
  const { usuario } = useContext(AuthContext);
  const [tab, setTab] = useState("bandeja");
  const [tareaId, setTareaId] = useState(null);
  const esSupervisor = usuario?.perfiles?.includes("supervisor") || usuario?.perfiles?.includes("dueno") || usuario?.perfiles?.includes("administrador");
  return (
    <div style={{ color:"white" }}>
      <div style={{ marginBottom:"20px" }}><h1 style={{ margin:"0 0 4px", fontSize:"22px" }}>🔀 Tareas Complejas</h1><div style={{ fontSize:"13px", color:"#6b7280" }}>Seguimiento por etapas y bandeja de validaciones</div></div>
      {!tareaId && (
        <div style={{ display:"flex", gap:"4px", marginBottom:"20px", borderBottom:"1px solid #374151" }}>
          {[{ id:"bandeja", label:"📥 Bandeja de validaciones", visible: esSupervisor }, { id:"mis-etapas", label:"🔀 Mis etapas complejas", visible: true }].filter(t => t.visible).map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{ background: tab===t.id?"#1f2937":"transparent", color: tab===t.id?"white":"#6b7280", border: tab===t.id?"1px solid #374151":"1px solid transparent", borderBottom: tab===t.id?"1px solid #1f2937":"1px solid transparent", padding:"8px 16px", borderRadius:"6px 6px 0 0", cursor:"pointer", fontSize:"13px", fontWeight: tab===t.id?"600":"400", marginBottom:"-1px" }}>{t.label}</button>
          ))}
        </div>
      )}
      {tareaId ? <DetalleTareaCompleja tareaId={tareaId} onVolver={() => setTareaId(null)} /> : tab === "bandeja" && esSupervisor ? <BandejaValidaciones usuario={usuario} /> : <MisEtapasComplejas onVerDetalle={setTareaId} usuarioId={usuario?.id} />}
    </div>
  );
}

function MisEtapasComplejas({ onVerDetalle, usuarioId }) {
  function fechaHoyLocal() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; }
  const [fecha, setFecha] = useState(fechaHoyLocal());
  const [tareas, setTareas] = useState([]);
  const [cargando, setCarg] = useState(true);
  useEffect(() => { cargar(fecha); }, [fecha]);
  async function cargar(f) {
    setCarg(true);
    try { const data = await api.get(`/tareas/?fecha=${f}`); setTareas((data||[]).filter(t => t.es_tarea_compleja === true && String(t.asignado_a_id) === String(usuarioId))); }
    catch { setTareas([]); }
    setCarg(false);
  }
  const PRIO_COLOR = { urgente:"#ef4444", alta:"#f97316", media:"#eab308", baja:"#22c55e" };
  const EST_COLOR  = { pendiente:"#3b82f6", en_curso:"#10b981", pausada:"#f59e0b", completada:"#22c55e", vencida:"#ef4444", validacion_pendiente:"#d97706" };
  return (
    <div>
      <div style={{ display:"flex", alignItems:"center", gap:"10px", marginBottom:"16px", background:"#1e293b", padding:"10px 14px", borderRadius:"8px", border:"1px solid #334155", flexWrap:"wrap" }}>
        <span style={{ fontSize:"13px", color:"#94a3b8" }}>📅 Fecha:</span>
        <input type="date" value={fecha} onChange={e => setFecha(e.target.value)} style={{ background:"#0f172a", border:"1px solid #475569", color:"white", padding:"4px 8px", borderRadius:"6px", fontSize:"13px" }} />
        <button onClick={() => setFecha(fechaHoyLocal())} style={{ background:"#334155", color:"white", border:"none", padding:"4px 10px", borderRadius:"6px", cursor:"pointer", fontSize:"12px" }}>Hoy</button>
      </div>
      {cargando ? <div style={{ textAlign:"center", padding:"40px", color:"#94a3b8" }}>⏳ Cargando...</div>
      : tareas.length === 0 ? <div style={{ textAlign:"center", padding:"40px", color:"#94a3b8" }}><div style={{ fontSize:"32px", marginBottom:"10px" }}>🔀</div><div>Sin tareas complejas para esta fecha</div></div>
      : tareas.map(t => {
        const colPrio = PRIO_COLOR[t.prioridad]||"#6b7280", colEst = EST_COLOR[t.estado]||"#6b7280";
        const pct = t.etapa_actual && t.total_etapas ? Math.round(((t.etapa_actual-1)/t.total_etapas)*100) : 0;
        return (
          <div key={t.id} onClick={() => onVerDetalle(t.id)} style={{ background:"#1e293b", borderRadius:"10px", padding:"14px 16px", marginBottom:"10px", border:"2px solid #7c3aed", cursor:"pointer" }}>
            <div style={{ display:"flex", gap:"6px", marginBottom:"8px", flexWrap:"wrap" }}>
              <span style={{ fontSize:"10px", background:"#3b1d8a", color:"#c4b5fd", padding:"2px 8px", borderRadius:"8px", border:"1px solid #7c3aed", fontWeight:"700" }}>🔀 COMPLEJA</span>
              <span style={{ fontSize:"10px", background:colPrio+"22", color:colPrio, padding:"2px 7px", borderRadius:"8px", border:`1px solid ${colPrio}`, fontWeight:"600" }}>{t.prioridad}</span>
              {t.es_heredada && <span style={{ fontSize:"10px", background:"#1e1b4b", color:"#a5b4fc", padding:"2px 7px", borderRadius:"8px", border:"1px solid #6366f1" }}>↩ heredada</span>}
            </div>
            <div style={{ fontWeight:"700", fontSize:"14px", color:"white", marginBottom:"4px" }}>{t.tarea_nombre}{t.tarea_codigo && <span style={{ color:"#6b7280", fontFamily:"monospace", fontSize:"11px", marginLeft:"8px" }}>[{t.tarea_codigo}]</span>}</div>
            {t.cliente_nombre && <div style={{ fontSize:"12px", color:"#94a3b8", marginBottom:"6px" }}>🏢 {t.cliente_nombre}{t.servicio_nombre && ` · 🔧 ${t.servicio_nombre}`}</div>}
            <div style={{ background:"#0f172a", borderRadius:"6px", padding:"8px 10px", marginBottom:"8px" }}>
              <div style={{ display:"flex", justifyContent:"space-between", fontSize:"11px", marginBottom:"4px" }}>
                <span style={{ color:"#94a3b8" }}>Etapa <strong style={{ color:"#c4b5fd" }}>{t.etapa_actual||"?"}/{t.total_etapas||"?"}</strong></span>
                <span style={{ color:colEst, fontWeight:"600" }}>● {t.estado?.replace("_"," ")||"pendiente"}</span>
              </div>
              <div style={{ background:"#1e293b", borderRadius:"3px", height:"5px" }}><div style={{ width:`${pct}%`, height:"100%", background:"#7c3aed", borderRadius:"3px" }} /></div>
            </div>
            <div style={{ fontSize:"11px", color:"#818cf8", textAlign:"right" }}>Ver etapas en detalle →</div>
          </div>
        );
      })}
    </div>
  );
}
