import { SLABadge } from "../../utils/slaHelpers.jsx";
/**
 * TarjetaTarea.jsx — v1.1.0
 * Tarjeta de tarea para el Dashboard.
 * v1.1.0: soporte para esCompleja — muestra tarjeta especial sin PLAY/FIN.
 */
import { useState } from "react";

const ESTADO_CONFIG = {
  pendiente:  { bg:"#1e3a5f", color:"#93c5fd", border:"#2563eb", label:"Pendiente",  icono:"⏳" },
  en_curso:   { bg:"#064e3b", color:"#6ee7b7", border:"#059669", label:"En curso",   icono:"▶️" },
  pausada:    { bg:"#78350f", color:"#fde68a", border:"#d97706", label:"Pausada",    icono:"⏸️" },
  completada: { bg:"#1a2e1a", color:"#86efac", border:"#16a34a", label:"Completada", icono:"✅" },
  vencida:    { bg:"#450a0a", color:"#fca5a5", border:"#ef4444", label:"Vencida",    icono:"⚠️" },
};
const PRIO_COLOR = {
  urgente:"#ef4444", alta:"#f97316", media:"#eab308", baja:"#22c55e",
};
const E = {
  btn:   { border:"none", borderRadius:"6px", cursor:"pointer", fontWeight:"600",
           fontSize:"13px", padding:"7px 14px", transition:"all 0.15s" },
  input: { background:"#111827", border:"1px solid #374151", color:"white",
           padding:"8px 10px", borderRadius:"6px", width:"100%",
           fontSize:"13px", boxSizing:"border-box" },
  label: { color:"#9ca3af", fontSize:"12px", display:"block", marginBottom:"4px" },
  badge: { fontSize:"10px", padding:"2px 7px", borderRadius:"8px",
           fontWeight:"600", display:"inline-block" },
};

function fmtTiempo(m) {
  if (!m) return "0 min";
  if (m < 60) return `${m} min`;
  return `${Math.floor(m/60)}h ${m%60}m`;
}

function ModalPausa({ onConfirmar, onCancelar }) {
  const [motivo, setMotivo] = useState("");
  const [err, setErr]       = useState("");
  function confirmar() {
    if (!motivo.trim()) { setErr("El motivo es obligatorio"); return; }
    onConfirmar(motivo.trim());
  }
  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.7)",
      display:"flex", alignItems:"center", justifyContent:"center", zIndex:9999 }}>
      <div style={{ background:"#1f2937", borderRadius:"10px", padding:"24px",
        border:"1px solid #d97706", width:"380px", maxWidth:"90vw" }}>
        <h3 style={{ margin:"0 0 16px", fontSize:"15px", color:"white" }}>⏸️ Pausar tarea</h3>
        <label style={E.label}>Motivo de la pausa *</label>
        <textarea style={{ ...E.input, height:"80px", resize:"vertical", marginBottom:"8px" }}
          value={motivo} onChange={e => setMotivo(e.target.value)}
          placeholder="Ej: Reunión imprevista, almuerzo..." />
        {err && <div style={{ color:"#fca5a5", fontSize:"12px", marginBottom:"8px" }}>⚠️ {err}</div>}
        <div style={{ display:"flex", gap:"8px", justifyContent:"flex-end" }}>
          <button style={{ ...E.btn, background:"#374151", color:"white" }} onClick={onCancelar}>Cancelar</button>
          <button style={{ ...E.btn, background:"#d97706", color:"white" }} onClick={confirmar}>⏸️ Pausar</button>
        </div>
      </div>
    </div>
  );
}

function ModalFinalizar({ onConfirmar, onCancelar }) {
  const [comentario, setComentario] = useState("");
  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.7)",
      display:"flex", alignItems:"center", justifyContent:"center", zIndex:9999 }}>
      <div style={{ background:"#1f2937", borderRadius:"10px", padding:"24px",
        border:"1px solid #059669", width:"380px", maxWidth:"90vw" }}>
        <h3 style={{ margin:"0 0 16px", fontSize:"15px", color:"white" }}>✅ Finalizar tarea</h3>
        <label style={E.label}>Comentario final (opcional)</label>
        <textarea style={{ ...E.input, height:"80px", resize:"vertical", marginBottom:"16px" }}
          value={comentario} onChange={e => setComentario(e.target.value)}
          placeholder="Observaciones, resultado..." />
        <div style={{ display:"flex", gap:"8px", justifyContent:"flex-end" }}>
          <button style={{ ...E.btn, background:"#374151", color:"white" }} onClick={onCancelar}>Cancelar</button>
          <button style={{ ...E.btn, background:"#059669", color:"white" }}
            onClick={() => onConfirmar(comentario.trim() || null)}>✅ Finalizar</button>
        </div>
      </div>
    </div>
  );
}

export default function TarjetaTarea({
  tarea,
  puedeControlar,
  hayTareaEnCurso,
  onIniciar,
  onPausar,
  onReanudar,
  onFinalizar,
  esCompleja = false,
}) {
  const [mostrarPausa,     setMostrarPausa]     = useState(false);
  const [mostrarFinalizar, setMostrarFinalizar] = useState(false);
  const [ejecutando,       setEjecutando]       = useState(false);

  const cfg      = ESTADO_CONFIG[tarea.estado] || ESTADO_CONFIG.pendiente;
  const colPrio  = PRIO_COLOR[tarea.prioridad] || "#6b7280";
  const nombreTarea = tarea.tarea_nombre || tarea.nombre || "Sin nombre";

  async function ejecutar(accion) {
    setEjecutando(true);
    try { await accion(); } finally { setEjecutando(false); }
  }

  const puedeIniciar   = puedeControlar && tarea.estado === "pendiente" && !hayTareaEnCurso;
  const puedeReanudar  = puedeControlar && tarea.estado === "pausada"   && !hayTareaEnCurso;
  const puedePausar    = puedeControlar && tarea.estado === "en_curso";
  const puedeFinalizar = puedeControlar && tarea.estado === "en_curso";
  const yaTerminada    = tarea.estado === "completada" || tarea.estado === "vencida";

  // ── Tarjeta especial para tareas complejas ──────────────────────────
  if (esCompleja) {
    return (
      <div style={{
        background:"#1a1a2e", borderRadius:"10px",
        padding:"14px 16px", marginBottom:"8px",
        border:"2px solid #7c3aed",
        opacity: ejecutando ? 0.7 : 1,
      }}>
        <div style={{ display:"flex", alignItems:"center", gap:"8px",
          marginBottom:"8px", flexWrap:"wrap" }}>
          <span style={{ fontSize:"10px", background:"#3b1d8a",
            color:"#c4b5fd", padding:"2px 8px", borderRadius:"8px",
            border:"1px solid #7c3aed", fontWeight:"700" }}>
            🔀 TAREA COMPLEJA
            {tarea.etapa_actual && tarea.total_etapas
              ? ` — Etapa ${tarea.etapa_actual}/${tarea.total_etapas}` : ""}
          </span>
          <span style={{ fontSize:"10px", background:colPrio+"22",
            color:colPrio, padding:"2px 7px", borderRadius:"8px",
            border:`1px solid ${colPrio}`, fontWeight:"600" }}>
            {tarea.prioridad}
          </span>
          {tarea.es_heredada && (
            <span style={{ fontSize:"10px", background:"#1e1b4b",
              color:"#a5b4fc", padding:"2px 7px", borderRadius:"8px",
              border:"1px solid #6366f1" }}>↩ heredada</span>
          )}
        </div>
        <div style={{ fontWeight:"700", fontSize:"14px", color:"white", marginBottom:"4px" }}>
          {nombreTarea}
          {tarea.tarea_codigo && (
            <span style={{ color:"#6b7280", fontFamily:"monospace",
              fontSize:"11px", marginLeft:"8px" }}>[{tarea.tarea_codigo}]</span>
          )}
        </div>
        {tarea.cliente_nombre && (
          <div style={{ fontSize:"12px", color:"#94a3b8", marginBottom:"4px" }}>
            🏢 {tarea.cliente_nombre}
            {tarea.servicio_nombre && ` · 🔧 ${tarea.servicio_nombre}`}
          </div>
        )}
        {tarea.comentario_supervisor && (
          <div style={{ fontSize:"12px", color:"#fde68a",
            background:"#78350f22", border:"1px solid #d97706",
            borderRadius:"5px", padding:"5px 8px", marginBottom:"8px" }}>
            💬 {tarea.comentario_supervisor}
          </div>
        )}
        {/* Barra de progreso de etapas */}
        {tarea.etapa_actual && tarea.total_etapas && (
          <div style={{ background:"#0f172a", borderRadius:"6px",
            padding:"6px 10px", marginBottom:"8px" }}>
            <div style={{ display:"flex", justifyContent:"space-between",
              fontSize:"11px", marginBottom:"4px" }}>
              <span style={{ color:"#94a3b8" }}>
                Paso <strong style={{ color:"#c4b5fd" }}>
                  {tarea.etapa_actual}/{tarea.total_etapas}
                </strong>
              </span>
              <span style={{ color: tarea.estado === "en_curso" ? "#10b981"
                : tarea.estado === "pausada" ? "#f59e0b"
                : tarea.estado === "completada" ? "#22c55e" : "#3b82f6",
                fontWeight:"600", fontSize:"10px" }}>
                ● {tarea.estado?.replace("_"," ") || "pendiente"}
              </span>
            </div>
            <div style={{ background:"#1e293b", borderRadius:"3px", height:"4px" }}>
              <div style={{
                width:`${Math.round(((tarea.etapa_actual-1)/tarea.total_etapas)*100)}%`,
                height:"100%", background:"#7c3aed", borderRadius:"3px"
              }} />
            </div>
          </div>
        )}

        <div style={{ marginTop:"10px", paddingTop:"8px",
          borderTop:"1px solid #334155", display:"flex",
          justifyContent:"space-between", alignItems:"center" }}>
          <span style={{ fontSize:"11px", color:"#94a3b8" }}>
            {cfg.icono} {cfg.label} · Ejecutar por etapas
          </span>
          <a href="/seguimiento-complejo"
            style={{ fontSize:"11px", color:"#818cf8", textDecoration:"none",
              fontWeight:"600", background:"#1e1b4b", padding:"3px 10px",
              borderRadius:"6px", border:"1px solid #6366f1" }}>
            Ver etapas →
          </a>
        </div>
      </div>
    );
  }

  // ── Tarjeta normal ──────────────────────────────────────────────────
  return (
    <>
      {mostrarPausa && (
        <ModalPausa
          onConfirmar={m => { setMostrarPausa(false); ejecutar(() => onPausar(m)); }}
          onCancelar={() => setMostrarPausa(false)} />
      )}
      {mostrarFinalizar && (
        <ModalFinalizar
          onConfirmar={c => { setMostrarFinalizar(false); ejecutar(() => onFinalizar(c)); }}
          onCancelar={() => setMostrarFinalizar(false)} />
      )}
      <div style={{
        background:"#1f2937", borderRadius:"10px", padding:"14px 16px",
        border:`1px solid ${cfg.border}`,
        opacity: ejecutando ? 0.7 : 1, transition:"all 0.2s",
      }}>
        <div style={{ display:"flex", alignItems:"center", gap:"8px",
          marginBottom:"10px", flexWrap:"wrap" }}>
          <span style={{ ...E.badge, background:cfg.bg, color:cfg.color,
            border:`1px solid ${cfg.border}` }}>
            {cfg.icono} {cfg.label}
          </span>
          <span style={{ ...E.badge, background:colPrio+"22", color:colPrio,
            border:`1px solid ${colPrio}` }}>
            {tarea.prioridad}
          </span>
          {tarea.tiempo_trabajado_minutos > 0 && (
            <span style={{ ...E.badge, background:"#1f2937", color:"#9ca3af",
              border:"1px solid #374151", marginLeft:"auto" }}>
              ⏱ {fmtTiempo(tarea.tiempo_trabajado_minutos)}
            </span>
          )}
          {tarea.es_heredada && (
            <span style={{ ...E.badge, background:"#1e1b4b", color:"#a5b4fc",
              border:"1px solid #6366f1" }}>↩ heredada</span>
          )}
          <SLABadge tarea={tarea} style={{ marginLeft:"auto" }} />
        </div>
        <div style={{ fontWeight:"700", fontSize:"14px", color:"white", marginBottom:"4px" }}>
          {nombreTarea}
          {tarea.tarea_codigo && (
            <span style={{ color:"#6b7280", fontFamily:"monospace",
              fontSize:"11px", marginLeft:"8px" }}>[{tarea.tarea_codigo}]</span>
          )}
        </div>
        {tarea.operador_nombre && (
          <div style={{ fontSize:"12px", color:"#9ca3af", marginBottom:"3px" }}>
            👤 {tarea.operador_nombre}
          </div>
        )}
        {tarea.cliente_nombre && (
          <div style={{ fontSize:"12px", color:"#9ca3af", marginBottom:"4px" }}>
            🏢 {tarea.cliente_nombre}
            {tarea.servicio_nombre && ` · 🔧 ${tarea.servicio_nombre}`}
          </div>
        )}
        {tarea.comentario_supervisor && (
          <div style={{ fontSize:"12px", color:"#fde68a",
            background:"#78350f22", border:"1px solid #d97706",
            borderRadius:"5px", padding:"5px 8px", marginBottom:"8px" }}>
            💬 {tarea.comentario_supervisor}
          </div>
        )}
        {!yaTerminada && (
          <div style={{ display:"flex", gap:"8px", marginTop:"10px",
            paddingTop:"10px", borderTop:"1px solid #374151", flexWrap:"wrap" }}>
            {puedeIniciar && (
              <button style={{ ...E.btn, background:"#059669", color:"white" }}
                onClick={() => ejecutar(onIniciar)}>▶ Iniciar</button>
            )}
            {puedeReanudar && (
              <button style={{ ...E.btn, background:"#059669", color:"white" }}
                onClick={() => ejecutar(onReanudar)}>▶ Reanudar</button>
            )}
            {puedePausar && (
              <button style={{ ...E.btn, background:"#d97706", color:"white" }}
                onClick={() => setMostrarPausa(true)}>⏸ Pausar</button>
            )}
            {puedeFinalizar && (
              <button style={{ ...E.btn, background:"#6366f1", color:"white" }}
                onClick={() => setMostrarFinalizar(true)}>■ Finalizar</button>
            )}
            {puedeControlar && tarea.estado === "pendiente" && hayTareaEnCurso && (
              <span style={{ fontSize:"12px", color:"#6b7280", alignSelf:"center" }}>
                Terminá la tarea en curso primero
              </span>
            )}
          </div>
        )}
      </div>
    </>
  );
}
