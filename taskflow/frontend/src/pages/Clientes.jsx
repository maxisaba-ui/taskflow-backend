/**
 * =============================================================
 * Archivo: Clientes.jsx
 * Versión: v1.1.0
 * -------------------------------------------------------------
 * DESCRIPCIÓN FUNCIONAL:
 *   Pantalla de gestión de clientes del estudio contable.
 *   Lista clientes con badge de cantidad de servicios activos.
 *   El badge abre un popover rápido con la lista de servicios
 *   (click afuera o en ✕ para cerrar).
 *   El botón Gestionar abre el panel completo con soporte de
 *   fecha_fin (baja lógica por fecha) en cada servicio.
 *
 * DESCRIPCIÓN TÉCNICA:
 *   Popover: position:fixed relativo al badge via getBoundingClientRect.
 *   Usa useRef + mousedown listener para cerrar al clic fuera.
 *   Panel de servicios: vigentes y vencidos con badge de estado.
 *   fecha_fin editable inline en el panel completo.
 *   Columna Localidad reemplazada por columna Servicios.
 *
 * HISTORIAL:
 *   v1.0.0 - ABM completo, validaciones, panel de servicios inline.
 *   v1.1.0 - Badge de servicios con popover rapido.
 *            fecha_fin en asignacion (baja logica por fecha).
 *            Campo vigente calculado en backend.
 *            Columna Localidad reemplazada por Servicios.
 * =============================================================
 */
import React, { useState, useEffect, useRef } from "react";
import { api } from "../api/client.js";

/* ── Estilos base ───────────────────────────────────────────── */
const E = {
  input:    { background:"#111827", border:"1px solid #374151", color:"white", padding:"8px 12px", borderRadius:"6px", width:"100%", fontSize:"13px", boxSizing:"border-box" },
  label:    { color:"#9ca3af", fontSize:"12px", display:"block", marginBottom:"4px" },
  btn:      { background:"#6366f1", color:"white", border:"none", padding:"8px 16px", borderRadius:"6px", cursor:"pointer", fontSize:"13px", fontWeight:"500" },
  btnGris:  { background:"#374151", color:"white", border:"none", padding:"8px 16px", borderRadius:"6px", cursor:"pointer", fontSize:"13px" },
  btnRojo:  { background:"#ef4444", color:"white", border:"none", padding:"4px 10px", borderRadius:"4px", cursor:"pointer", fontSize:"12px" },
  btnAma:   { background:"#d97706", color:"white", border:"none", padding:"4px 10px", borderRadius:"4px", cursor:"pointer", fontSize:"12px" },
  btnVerde: { background:"#059669", color:"white", border:"none", padding:"4px 10px", borderRadius:"4px", cursor:"pointer", fontSize:"12px" },
  btnAzul:  { background:"#1d4ed8", color:"white", border:"none", padding:"4px 10px", borderRadius:"4px", cursor:"pointer", fontSize:"12px" },
  card:     { background:"#1f2937", borderRadius:"8px", padding:"20px", border:"1px solid #374151", marginBottom:"16px" },
  badge:    { fontSize:"10px", padding:"2px 7px", borderRadius:"10px", fontWeight:"600", display:"inline-block" },
  select:   { background:"#111827", border:"1px solid #374151", color:"white", padding:"8px 12px", borderRadius:"6px", width:"100%", fontSize:"13px", cursor:"pointer" },
};

/** Lista de provincias argentinas */
const PROVINCIAS = [
  "Buenos Aires","CABA","Catamarca","Chaco","Chubut","Córdoba",
  "Corrientes","Entre Ríos","Formosa","Jujuy","La Pampa","La Rioja",
  "Mendoza","Misiones","Neuquén","Río Negro","Salta","San Juan",
  "San Luis","Santa Cruz","Santa Fe","Santiago del Estero",
  "Tierra del Fuego","Tucumán",
];

/**
 * DESCRIPCIÓN FUNCIONAL: Valida CUIT argentino con algoritmo AFIP módulo 11.
 * DESCRIPCIÓN TÉCNICA: Pesos [5,4,3,2,7,6,5,4,3,2]. Acepta con/sin guiones.
 */
function validarCuit(cuit) {
  const limpio = cuit.replace(/-/g, "").replace(/\s/g, "");
  if (limpio.length !== 11 || !/^\d+$/.test(limpio)) return false;
  const pesos = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
  const suma  = pesos.reduce((acc, p, i) => acc + p * parseInt(limpio[i]), 0);
  const resto = suma % 11;
  const dv    = resto === 0 ? 0 : resto === 1 ? 9 : 11 - resto;
  return parseInt(limpio[10]) === dv;
}

/**
 * DESCRIPCIÓN FUNCIONAL: Valida formato de email.
 * DESCRIPCIÓN TÉCNICA: Regex RFC 5322 simplificado. Extension 2-6 chars.
 */
function validarEmail(email) {
  return /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,6}$/.test(email.trim());
}

/** Formatea CUIT como XX-XXXXXXXX-X */
function formatearCuit(cuit) {
  if (!cuit) return "—";
  const limpio = cuit.replace(/-/g, "");
  if (limpio.length !== 11) return cuit;
  return `${limpio.slice(0,2)}-${limpio.slice(2,10)}-${limpio.slice(10)}`;
}

/** Formatea fecha ISO YYYY-MM-DD a DD/MM/YYYY */
function fmtFecha(f) {
  if (!f) return null;
  return f.split("-").reverse().join("/");
}

/* =============================================================
   SUB-COMPONENTE: BadgeServicios
   DESCRIPCION FUNCIONAL:
     Badge clickeable que muestra cantidad de servicios activos.
     Al hacer clic abre un popover con la lista completa.
     Cierra al hacer clic fuera o en la X.
   DESCRIPCION TECNICA:
     Carga servicios lazy (solo al primer clic).
     Popover con position:fixed para no quedar cortado por
     overflow:hidden de la tabla. getBoundingClientRect para
     posicionar debajo del badge. Ref para detectar clic fuera.
   ============================================================= */
function BadgeServicios({ clienteId, cantidad }) {
  const [abierto, setAbierto]     = useState(false);
  const [servicios, setServicios] = useState(null);   /* null = no cargado aun */
  const [cargando, setCargando]   = useState(false);
  const [pos, setPos]             = useState({ top:0, left:0 });
  const badgeRef                  = useRef(null);
  const popoverRef                = useRef(null);

  /* Cerrar al hacer clic fuera del badge Y del popover */
  useEffect(() => {
    if (!abierto) return;
    function cerrar(e) {
      if (
        badgeRef.current   && !badgeRef.current.contains(e.target) &&
        popoverRef.current && !popoverRef.current.contains(e.target)
      ) {
        setAbierto(false);
      }
    }
    document.addEventListener("mousedown", cerrar);
    return () => document.removeEventListener("mousedown", cerrar);
  }, [abierto]);

  /**
   * DESCRIPCION FUNCIONAL:
   *   Calcula posicion del popover, carga servicios si es la primera
   *   vez, y alterna apertura/cierre.
   * DESCRIPCION TECNICA:
   *   getBoundingClientRect() sobre el badge para position:fixed correcto.
   */
  async function toggle(e) {
    e.stopPropagation();
    if (abierto) { setAbierto(false); return; }

    if (badgeRef.current) {
      const rect = badgeRef.current.getBoundingClientRect();
      setPos({ top: rect.bottom + 6, left: rect.left });
    }

    if (servicios === null) {
      setCargando(true);
      try {
        const data = await api.get(`/clientes/${clienteId}/servicios`);
        setServicios(data || []);
      } catch {
        setServicios([]);
      }
      setCargando(false);
    }
    setAbierto(true);
  }

  /* Badge gris no clickeable si no hay servicios */
  if (cantidad === 0) {
    return (
      <span style={{ ...E.badge, background:"#1f2937", color:"#4b5563", border:"1px solid #374151" }}>
        0 servicios
      </span>
    );
  }

  return (
    <>
      {/* Badge clickeable */}
      <span
        ref={badgeRef}
        onClick={toggle}
        style={{
          ...E.badge,
          background:"#1e3a2e", color:"#6ee7b7", border:"1px solid #059669",
          cursor:"pointer", userSelect:"none",
        }}
        title="Click para ver servicios"
      >
        {cantidad} servicio{cantidad !== 1 ? "s" : ""}
      </span>

      {/* Popover con position:fixed */}
      {abierto && (
        <div
          ref={popoverRef}
          style={{
            position:"fixed", top:pos.top, left:pos.left,
            zIndex:9999, background:"#1f2937",
            border:"1px solid #374151", borderRadius:"8px",
            padding:"12px", minWidth:"280px", maxWidth:"380px",
            boxShadow:"0 8px 32px rgba(0,0,0,0.6)",
          }}
        >
          {/* Encabezado del popover */}
          <div style={{ display:"flex", justifyContent:"space-between",
            alignItems:"center", marginBottom:"10px" }}>
            <span style={{ fontSize:"12px", fontWeight:"700", color:"#9ca3af",
              textTransform:"uppercase", letterSpacing:"0.06em" }}>
              Servicios contratados
            </span>
            <button onClick={() => setAbierto(false)}
              style={{ background:"none", border:"none", color:"#6b7280",
                cursor:"pointer", fontSize:"16px", lineHeight:1 }}>
              ✕
            </button>
          </div>

          {cargando ? (
            <div style={{ color:"#6b7280", fontSize:"12px", textAlign:"center", padding:"8px" }}>
              ⏳ Cargando...
            </div>
          ) : servicios && servicios.length > 0 ? (
            <div style={{ display:"flex", flexDirection:"column", gap:"6px" }}>
              {servicios.map(s => (
                <div key={s.servicio_id} style={{
                  display:"flex", justifyContent:"space-between", alignItems:"center",
                  background:"#111827", borderRadius:"6px", padding:"7px 10px",
                  border:"1px solid #1f2937",
                }}>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:"12px", color:"white", fontWeight:"500",
                      overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                      {s.nombre}
                    </div>
                    <div style={{ fontSize:"10px", color:"#6b7280",
                      fontFamily:"monospace", marginTop:"1px" }}>
                      {s.codigo}
                      {s.fecha_inicio && (
                        <span style={{ marginLeft:"8px", color:"#9ca3af" }}>
                          desde {fmtFecha(s.fecha_inicio)}
                        </span>
                      )}
                      {s.fecha_fin && (
                        <span style={{ marginLeft:"8px",
                          color: s.vigente ? "#f59e0b" : "#ef4444" }}>
                          hasta {fmtFecha(s.fecha_fin)}
                        </span>
                      )}
                    </div>
                  </div>
                  <span style={{
                    ...E.badge, marginLeft:"8px", flexShrink:0,
                    background: s.vigente ? "#064e3b" : "#450a0a",
                    color:       s.vigente ? "#6ee7b7" : "#fca5a5",
                    border:      `1px solid ${s.vigente ? "#059669" : "#ef4444"}`,
                  }}>
                    {s.vigente ? "Vigente" : "Vencido"}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ color:"#6b7280", fontSize:"12px", textAlign:"center", padding:"8px" }}>
              Sin servicios asignados
            </div>
          )}
        </div>
      )}
    </>
  );
}

/* =============================================================
   SUB-COMPONENTE: FormCliente
   DESCRIPCION FUNCIONAL:
     Formulario reutilizable para crear o editar un cliente.
     Indicadores de validez en tiempo real para CUIT y email.
   ============================================================= */
function FormCliente({ inicial, onGuardar, onCancelar }) {
  const [f, setF] = useState({
    razon_social: inicial?.razon_social || "",
    cuit:         inicial?.cuit         || "",
    email:        inicial?.email        || "",
    telefono:     inicial?.telefono     || "",
    direccion:    inicial?.direccion    || "",
    localidad:    inicial?.localidad    || "",
    provincia:    inicial?.provincia    || "Buenos Aires",
    notas:        inicial?.notas        || "",
  });
  const [err, setErr] = useState("");

  function guardar() {
    setErr("");
    if (!f.razon_social.trim()) { setErr("La razón social es obligatoria"); return; }
    if (f.cuit  && f.cuit.trim()  && !validarCuit(f.cuit))   { setErr("El CUIT ingresado no es válido. Verificá el dígito verificador."); return; }
    if (f.email && f.email.trim() && !validarEmail(f.email)) { setErr("El formato del email no es válido. Ejemplo: contacto@empresa.com"); return; }
    onGuardar(f);
  }

  function indicador(valor, esValido) {
    if (!valor || !valor.trim()) return null;
    return (
      <span style={{ marginLeft:"8px", fontSize:"11px", color: esValido ? "#10b981" : "#ef4444" }}>
        {esValido ? "✓ válido" : "✗ inválido"}
      </span>
    );
  }

  return (
    <div style={E.card}>
      <h3 style={{ margin:"0 0 16px", fontSize:"15px", color:"white" }}>
        {inicial ? `✏️ Editando: ${inicial.razon_social}` : "Nuevo Cliente"}
      </h3>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"12px", marginBottom:"12px" }}>
        <div style={{ gridColumn:"1 / -1" }}>
          <label style={E.label}>Razón social *</label>
          <input style={E.input} value={f.razon_social}
            onChange={e => setF({...f, razon_social: e.target.value})}
            placeholder="Nombre o razón social del cliente" />
        </div>
        <div>
          <label style={E.label}>CUIT{indicador(f.cuit, validarCuit(f.cuit))}</label>
          <input style={E.input} value={f.cuit}
            onChange={e => setF({...f, cuit: e.target.value})}
            placeholder="XX-XXXXXXXX-X" maxLength={13} />
        </div>
        <div>
          <label style={E.label}>Email{indicador(f.email, validarEmail(f.email))}</label>
          <input style={E.input} type="text" value={f.email}
            onChange={e => setF({...f, email: e.target.value})}
            placeholder="contacto@empresa.com" />
        </div>
        <div>
          <label style={E.label}>Teléfono</label>
          <input style={E.input} value={f.telefono}
            onChange={e => setF({...f, telefono: e.target.value})}
            placeholder="011-XXXX-XXXX" />
        </div>
        <div>
          <label style={E.label}>Localidad</label>
          <input style={E.input} value={f.localidad}
            onChange={e => setF({...f, localidad: e.target.value})}
            placeholder="Ciudad" />
        </div>
        <div style={{ gridColumn:"1 / -1" }}>
          <label style={E.label}>Provincia</label>
          <select style={E.select} value={f.provincia}
            onChange={e => setF({...f, provincia: e.target.value})}>
            {PROVINCIAS.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <div style={{ gridColumn:"1 / -1" }}>
          <label style={E.label}>Dirección</label>
          <input style={E.input} value={f.direccion}
            onChange={e => setF({...f, direccion: e.target.value})}
            placeholder="Calle, número, piso" />
        </div>
        <div style={{ gridColumn:"1 / -1" }}>
          <label style={E.label}>Notas internas</label>
          <textarea style={{ ...E.input, height:"60px", resize:"vertical" }}
            value={f.notas}
            onChange={e => setF({...f, notas: e.target.value})}
            placeholder="Observaciones internas del estudio" />
        </div>
      </div>
      {err && (
        <div style={{ color:"#fca5a5", background:"#7f1d1d", padding:"8px 12px",
          borderRadius:"6px", fontSize:"13px", marginBottom:"12px" }}>
          ⚠️ {err}
        </div>
      )}
      <div style={{ display:"flex", gap:"8px" }}>
        <button style={E.btn} onClick={guardar}>
          {inicial ? "💾 Guardar cambios" : "💾 Crear cliente"}
        </button>
        <button style={E.btnGris} onClick={onCancelar}>Cancelar</button>
      </div>
    </div>
  );
}

/* =============================================================
   SUB-COMPONENTE: PanelServiciosCliente
   DESCRIPCION FUNCIONAL:
     Panel inline completo para gestionar servicios de un cliente.
     Muestra vigentes y vencidos. Permite agregar con fecha_fin,
     editar fecha_fin de existentes, y quitar completamente.
   DESCRIPCION TECNICA:
     fecha_fin: campo en alta y editable inline por servicio.
     vigente: calculado en backend (fecha_fin nula o futura).
     PUT /{id}/servicios/{servicio_id} para editar fecha_fin.
   ============================================================= */
function PanelServiciosCliente({ cliente, onCerrar }) {
  const [servicios, setServicios]         = useState([]);
  const [todos, setTodos]                 = useState([]);
  const [servicioSel, setServicioSel]     = useState("");
  const [fechaInicio, setFechaInicio]     = useState(new Date().toISOString().slice(0,10));
  const [fechaFin, setFechaFin]           = useState("");
  const [editandoBaja, setEditandoBaja]   = useState(null);
  const [nuevaFechaFin, setNuevaFechaFin] = useState("");
  const [msg, setMsg]                     = useState({ texto:"", tipo:"" });
  const [cargando, setCargando]           = useState(true);

  useEffect(() => { cargar(); }, []);

  async function cargar() {
    setCargando(true);
    try {
      const [svcs, todos_svcs] = await Promise.all([
        api.get(`/clientes/${cliente.id}/servicios`),
        api.get("/servicios/"),
      ]);
      setServicios(svcs || []);
      setTodos(todos_svcs || []);
    } catch(e) {
      setMsg({ texto:"❌ Error al cargar: " + e.message, tipo:"error" });
    }
    setCargando(false);
  }

  async function asignar() {
    if (!servicioSel) { setMsg({ texto:"Seleccioná un servicio", tipo:"error" }); return; }
    try {
      await api.post(`/clientes/${cliente.id}/servicios`, {
        servicio_id:  servicioSel,
        fecha_inicio: fechaInicio || null,
        fecha_fin:    fechaFin    || null,
      });
      setMsg({ texto:"✅ Servicio asignado", tipo:"ok" });
      setServicioSel(""); setFechaFin("");
      cargar();
    } catch(e) {
      setMsg({ texto:"❌ " + e.message, tipo:"error" });
    }
  }

  /**
   * DESCRIPCION FUNCIONAL: Guarda la fecha_fin editada de un servicio.
   * DESCRIPCION TECNICA: PUT al endpoint con { fecha_fin }.
   */
  async function guardarFechaFin(servicioId) {
    try {
      await api.put(`/clientes/${cliente.id}/servicios/${servicioId}`, {
        fecha_fin: nuevaFechaFin || null,
      });
      setMsg({ texto:"✅ Fecha de baja actualizada", tipo:"ok" });
      setEditandoBaja(null);
      cargar();
    } catch(e) {
      setMsg({ texto:"❌ " + e.message, tipo:"error" });
    }
  }

  async function quitar(servicioId, nombre) {
    if (!confirm(`¿Quitar completamente el servicio "${nombre}" de ${cliente.razon_social}?`)) return;
    try {
      await api.delete(`/clientes/${cliente.id}/servicios/${servicioId}`);
      setMsg({ texto:"✅ Servicio quitado", tipo:"ok" });
      cargar();
    } catch(e) {
      setMsg({ texto:"❌ " + e.message, tipo:"error" });
    }
  }

  const asignadosIds = new Set(servicios.filter(s => s.vigente).map(a => a.servicio_id));
  const disponibles  = todos.filter(s => !asignadosIds.has(s.id));
  const vigentes     = servicios.filter(s => s.vigente);
  const vencidos     = servicios.filter(s => !s.vigente);

  return (
    <div style={{ ...E.card, borderColor:"#1d4ed8", marginTop:"4px" }}>
      {/* Encabezado */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"14px" }}>
        <div>
          <div style={{ fontWeight:"600", fontSize:"14px", color:"white" }}>
            🔧 Servicios contratados: {cliente.razon_social}
          </div>
          <div style={{ fontSize:"12px", color:"#6b7280", marginTop:"2px" }}>
            {vigentes.length} vigente{vigentes.length !== 1 ? "s" : ""}
            {vencidos.length > 0 && ` · ${vencidos.length} vencido${vencidos.length !== 1 ? "s" : ""}`}
          </div>
        </div>
        <button style={E.btnGris} onClick={onCerrar}>✕ Cerrar</button>
      </div>

      {/* Banner */}
      {msg.texto && (
        <div style={{
          background: msg.tipo === "ok" ? "#064e3b" : "#7f1d1d",
          border:     `1px solid ${msg.tipo === "ok" ? "#10b981" : "#ef4444"}`,
          color:      msg.tipo === "ok" ? "#10b981" : "#fca5a5",
          padding:"8px 12px", borderRadius:"6px", marginBottom:"12px",
          display:"flex", justifyContent:"space-between", fontSize:"12px",
        }}>
          <span>{msg.texto}</span>
          <button onClick={() => setMsg({ texto:"", tipo:"" })}
            style={{ background:"none", border:"none", color:"inherit", cursor:"pointer" }}>✕</button>
        </div>
      )}

      {/* Formulario de alta de servicio */}
      <div style={{ background:"#111827", borderRadius:"6px", padding:"12px", marginBottom:"14px" }}>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 140px 140px auto",
          gap:"8px", alignItems:"flex-end" }}>
          <div>
            <label style={E.label}>Servicio a asignar</label>
            <select style={E.select} value={servicioSel}
              onChange={e => setServicioSel(e.target.value)}>
              <option value="">— Seleccionar —</option>
              {disponibles.map(s => (
                <option key={s.id} value={s.id}>{s.nombre} [{s.codigo}]</option>
              ))}
            </select>
          </div>
          <div>
            <label style={E.label}>Fecha inicio</label>
            <input type="date" style={E.input} value={fechaInicio}
              onChange={e => setFechaInicio(e.target.value)} />
          </div>
          <div>
            <label style={E.label}>Fecha baja (opcional)</label>
            <input type="date" style={E.input} value={fechaFin}
              onChange={e => setFechaFin(e.target.value)} />
          </div>
          <button style={{ ...E.btn, alignSelf:"flex-end" }} onClick={asignar}>
            + Asignar
          </button>
        </div>
      </div>

      {/* Lista de servicios */}
      {cargando ? (
        <div style={{ textAlign:"center", padding:"20px", color:"#6b7280" }}>⏳ Cargando...</div>
      ) : servicios.length === 0 ? (
        <div style={{ textAlign:"center", padding:"16px", color:"#6b7280", fontSize:"13px" }}>
          Este cliente no tiene servicios asignados todavía
        </div>
      ) : (
        <div style={{ display:"flex", flexDirection:"column", gap:"6px" }}>
          {[...vigentes, ...vencidos].map(s => (
            <div key={s.servicio_id} style={{
              background:"#111827", borderRadius:"6px", padding:"10px 14px",
              border:`1px solid ${s.vigente ? "#1f2937" : "#450a0a"}`,
            }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
                <div style={{ flex:1 }}>
                  {/* Nombre + código + badge */}
                  <div style={{ display:"flex", alignItems:"center", gap:"8px" }}>
                    <span style={{ fontWeight:"500", color: s.vigente ? "white" : "#9ca3af", fontSize:"13px" }}>
                      {s.nombre}
                    </span>
                    <span style={{ color:"#6b7280", fontSize:"11px", fontFamily:"monospace" }}>
                      [{s.codigo}]
                    </span>
                    <span style={{
                      ...E.badge,
                      background: s.vigente ? "#064e3b" : "#450a0a",
                      color:       s.vigente ? "#6ee7b7" : "#fca5a5",
                      border:      `1px solid ${s.vigente ? "#059669" : "#ef4444"}`,
                    }}>
                      {s.vigente ? "Vigente" : "Vencido"}
                    </span>
                  </div>
                  {/* Fechas */}
                  <div style={{ fontSize:"11px", color:"#9ca3af", marginTop:"4px", display:"flex", gap:"12px" }}>
                    {s.fecha_inicio && <span>Inicio: {fmtFecha(s.fecha_inicio)}</span>}
                    {s.fecha_fin ? (
                      <span style={{ color: s.vigente ? "#f59e0b" : "#ef4444" }}>
                        Baja: {fmtFecha(s.fecha_fin)}
                      </span>
                    ) : s.vigente && (
                      <span style={{ color:"#059669" }}>Sin fecha de baja</span>
                    )}
                  </div>

                  {/* Input inline de edición de fecha_fin */}
                  {editandoBaja === s.servicio_id && (
                    <div style={{ display:"flex", gap:"8px", alignItems:"center", marginTop:"8px" }}>
                      <input type="date" style={{ ...E.input, maxWidth:"160px" }}
                        value={nuevaFechaFin}
                        onChange={e => setNuevaFechaFin(e.target.value)} />
                      <button style={E.btnVerde}
                        onClick={() => guardarFechaFin(s.servicio_id)}>
                        💾 Guardar
                      </button>
                      <button style={E.btnGris}
                        onClick={() => setEditandoBaja(null)}>
                        Cancelar
                      </button>
                    </div>
                  )}
                </div>

                {/* Botones */}
                <div style={{ display:"flex", gap:"5px", marginLeft:"10px", flexShrink:0 }}>
                  {editandoBaja !== s.servicio_id && (
                    <button style={E.btnAma}
                      title="Editar fecha de baja"
                      onClick={() => {
                        setEditandoBaja(s.servicio_id);
                        setNuevaFechaFin(s.fecha_fin || "");
                      }}>
                      📅 Baja
                    </button>
                  )}
                  <button style={E.btnRojo}
                    title="Quitar completamente"
                    onClick={() => quitar(s.servicio_id, s.nombre)}>
                    ✕
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* =============================================================
   COMPONENTE PRINCIPAL: Clientes
   ============================================================= */
export default function Clientes() {
  const [clientes, setClientes]                 = useState([]);
  const [cargando, setCargando]                 = useState(false);
  const [mostrarForm, setMostrarForm]           = useState(false);
  const [clienteEditando, setClienteEditando]   = useState(null);
  const [clienteServicios, setClienteServicios] = useState(null);
  const [busqueda, setBusqueda]                 = useState("");
  const [mostrarInactivos, setMostrarInactivos] = useState(false);
  const [msg, setMsg]                           = useState({ texto:"", tipo:"" });

  useEffect(() => { cargar(); }, [busqueda, mostrarInactivos]);

  async function cargar() {
    setCargando(true);
    try {
      let url = `/clientes/?activo=${!mostrarInactivos}`;
      if (busqueda.trim()) url += `&busqueda=${encodeURIComponent(busqueda.trim())}`;
      setClientes(await api.get(url));
    } catch(e) {
      setMsg({ texto:"❌ Error al cargar: " + e.message, tipo:"error" });
    }
    setCargando(false);
  }

  async function crearCliente(datos) {
    try {
      await api.post("/clientes/", datos);
      setMsg({ texto:"✅ Cliente creado correctamente", tipo:"ok" });
      setMostrarForm(false); cargar();
    } catch(e) { setMsg({ texto:"❌ " + e.message, tipo:"error" }); }
  }

  async function editarCliente(datos) {
    try {
      await api.put(`/clientes/${clienteEditando.id}`, datos);
      setMsg({ texto:"✅ Cliente actualizado", tipo:"ok" });
      setClienteEditando(null); cargar();
    } catch(e) { setMsg({ texto:"❌ " + e.message, tipo:"error" }); }
  }

  async function desactivar(c) {
    if (!confirm(`¿Desactivar a "${c.razon_social}"?`)) return;
    try {
      await api.put(`/clientes/${c.id}/desactivar`);
      setMsg({ texto:"✅ Cliente desactivado", tipo:"ok" }); cargar();
    } catch(e) { setMsg({ texto:"❌ " + e.message, tipo:"error" }); }
  }

  async function reactivar(c) {
    try {
      await api.put(`/clientes/${c.id}/reactivar`);
      setMsg({ texto:"✅ Cliente reactivado", tipo:"ok" }); cargar();
    } catch(e) { setMsg({ texto:"❌ " + e.message, tipo:"error" }); }
  }

  return (
    <div style={{ minHeight:"100vh", background:"#030712", padding:"24px", color:"white" }}>
      <div style={{ maxWidth:"1200px", margin:"0 auto" }}>

        {/* Encabezado */}
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"20px" }}>
          <h1 style={{ margin:0, fontSize:"22px" }}>🏢 Clientes</h1>
          <button style={E.btn} onClick={() => {
            setMostrarForm(!mostrarForm);
            setClienteEditando(null); setClienteServicios(null);
            setMsg({ texto:"", tipo:"" });
          }}>
            {mostrarForm ? "✕ Cancelar" : "+ Nuevo cliente"}
          </button>
        </div>

        {/* Banner */}
        {msg.texto && (
          <div style={{
            background: msg.tipo === "ok" ? "#064e3b" : "#7f1d1d",
            border:     `1px solid ${msg.tipo === "ok" ? "#10b981" : "#ef4444"}`,
            color:      msg.tipo === "ok" ? "#10b981" : "#fca5a5",
            padding:"10px 14px", borderRadius:"6px", marginBottom:"16px",
            display:"flex", justifyContent:"space-between", alignItems:"center", fontSize:"13px",
          }}>
            <span>{msg.texto}</span>
            <button onClick={() => setMsg({ texto:"", tipo:"" })}
              style={{ background:"none", border:"none", color:"inherit", cursor:"pointer" }}>✕</button>
          </div>
        )}

        {/* Formulario alta */}
        {mostrarForm && !clienteEditando && (
          <FormCliente inicial={null} onGuardar={crearCliente}
            onCancelar={() => setMostrarForm(false)} />
        )}

        {/* Formulario edición */}
        {clienteEditando && (
          <FormCliente inicial={clienteEditando} onGuardar={editarCliente}
            onCancelar={() => setClienteEditando(null)} />
        )}

        {/* Filtros */}
        <div style={{ display:"flex", gap:"12px", marginBottom:"16px", alignItems:"center" }}>
          <input style={{ ...E.input, maxWidth:"340px" }}
            value={busqueda} onChange={e => setBusqueda(e.target.value)}
            placeholder="🔍 Buscar por razón social o CUIT..." />
          <label style={{ display:"flex", alignItems:"center", gap:"8px",
            color:"#9ca3af", fontSize:"13px", cursor:"pointer" }}>
            <input type="checkbox" checked={mostrarInactivos}
              onChange={e => setMostrarInactivos(e.target.checked)} />
            Ver inactivos
          </label>
          <span style={{ color:"#6b7280", fontSize:"12px", marginLeft:"auto" }}>
            {clientes.length} cliente{clientes.length !== 1 ? "s" : ""}
          </span>
        </div>

        {/* Tabla */}
        {cargando ? (
          <div style={{ textAlign:"center", padding:"40px", color:"#6b7280" }}>⏳ Cargando...</div>
        ) : (
          <div style={{ background:"#111827", borderRadius:"10px",
            border:"1px solid #1f2937", overflow:"hidden" }}>
            <table style={{ width:"100%", borderCollapse:"collapse", fontSize:"13px" }}>
              <thead>
                <tr style={{ background:"#1f2937", color:"#9ca3af" }}>
                  <th style={{ textAlign:"left", padding:"12px 16px", fontWeight:"600" }}>Razón social</th>
                  <th style={{ textAlign:"left", padding:"12px 16px", fontWeight:"600" }}>CUIT</th>
                  <th style={{ textAlign:"left", padding:"12px 16px", fontWeight:"600" }}>Email</th>
                  <th style={{ textAlign:"left", padding:"12px 16px", fontWeight:"600" }}>Servicios</th>
                  <th style={{ textAlign:"left", padding:"12px 16px", fontWeight:"600" }}>Estado</th>
                  <th style={{ padding:"12px 16px" }}></th>
                </tr>
              </thead>
              <tbody>
                {clientes.map(c => (
                  <React.Fragment key={c.id}>
                    <tr style={{
                      borderTop:"1px solid #1f2937",
                      background: clienteServicios?.id === c.id ? "#1a2235" : "transparent",
                    }}>
                      {/* Razón social */}
                      <td style={{ padding:"11px 16px", color:"white", fontWeight:"500" }}>
                        {c.razon_social}
                        {c.notas && (
                          <span title={c.notas}
                            style={{ marginLeft:"6px", color:"#6b7280", cursor:"help" }}>📝</span>
                        )}
                      </td>
                      {/* CUIT */}
                      <td style={{ padding:"11px 16px", color:"#9ca3af", fontFamily:"monospace" }}>
                        {formatearCuit(c.cuit)}
                      </td>
                      {/* Email */}
                      <td style={{ padding:"11px 16px", color:"#9ca3af" }}>{c.email || "—"}</td>
                      {/* Badge de servicios con popover */}
                      <td style={{ padding:"11px 16px" }}>
                        <BadgeServicios
                          clienteId={c.id}
                          cantidad={c.cantidad_servicios || 0}
                        />
                      </td>
                      {/* Estado */}
                      <td style={{ padding:"11px 16px" }}>
                        <span style={{
                          ...E.badge,
                          background: c.activo ? "#064e3b" : "#1f2937",
                          color:       c.activo ? "#10b981" : "#6b7280",
                          border:      `1px solid ${c.activo ? "#059669" : "#374151"}`,
                        }}>
                          {c.activo ? "Activo" : "Inactivo"}
                        </span>
                      </td>
                      {/* Acciones */}
                      <td style={{ padding:"11px 16px", textAlign:"right" }}>
                        <div style={{ display:"flex", gap:"5px", justifyContent:"flex-end" }}>
                          {c.activo && (
                            <>
                              <button style={{
                                ...E.btnAzul,
                                background: clienteServicios?.id === c.id ? "#1e40af" : "#1d4ed8",
                              }} onClick={() => {
                                setClienteServicios(clienteServicios?.id === c.id ? null : c);
                                setClienteEditando(null); setMostrarForm(false);
                              }}>
                                🔧 Gestionar
                              </button>
                              <button style={E.btnAma} onClick={() => {
                                setClienteEditando(c);
                                setMostrarForm(false); setClienteServicios(null);
                                window.scrollTo({ top:0, behavior:"smooth" });
                              }}>
                                ✏️
                              </button>
                            </>
                          )}
                          {c.activo ? (
                            <button style={E.btnRojo} onClick={() => desactivar(c)}>Desactivar</button>
                          ) : (
                            <button style={E.btnVerde} onClick={() => reactivar(c)}>Reactivar</button>
                          )}
                        </div>
                      </td>
                    </tr>

                    {/* Fila expandible panel de gestión de servicios */}
                    {clienteServicios?.id === c.id && (
                      <tr>
                        <td colSpan={6} style={{ padding:"0 16px 16px", background:"#0f172a" }}>
                          <PanelServiciosCliente
                            cliente={c}
                            onCerrar={() => setClienteServicios(null)}
                          />
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
            {clientes.length === 0 && (
              <div style={{ textAlign:"center", padding:"40px", color:"#6b7280" }}>
                {busqueda ? `Sin resultados para "${busqueda}"` : "No hay clientes cargados"}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}