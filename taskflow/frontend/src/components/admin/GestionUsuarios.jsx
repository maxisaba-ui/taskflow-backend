/**
 * =============================================================
 * Archivo: GestionUsuarios.jsx
 * -------------------------------------------------------------
 * DESCRIPCIÓN FUNCIONAL:
 *   Panel de administración de usuarios del sistema.
 *   Permite crear usuarios (pre-registro de emails de Google),
 *   editar sus perfiles, desactivarlos y reactivarlos.
 *   La tabla muestra los perfiles activos de cada usuario.
 *
 * DESCRIPCIÓN TÉCNICA:
 *   Usa inline styles para consistencia con GestionServicios.
 *   Edición de perfiles vía PUT /{id}/perfiles.
 *   Toggle activos/inactivos con filtro en el listado.
 * =============================================================
 */
import { useState, useEffect } from "react";
import { api } from "../../api/client.js";

/** Perfiles disponibles en el sistema */
const PERFILES_DISPONIBLES = ["operador", "supervisor", "dueno", "administrador"];

/** Etiquetas legibles para cada perfil */
const PERFIL_LABELS = {
  operador:      "Operador",
  supervisor:    "Supervisor",
  dueno:         "Dueño",
  administrador: "Administrador",
};

/** Colores de badge por perfil */
const PERFIL_COLORES = {
  operador:      { bg:"#1e3a5f", color:"#93c5fd", border:"#2563eb" },
  supervisor:    { bg:"#1e3a2e", color:"#6ee7b7", border:"#059669" },
  dueno:         { bg:"#3b1d8a", color:"#c4b5fd", border:"#7c3aed" },
  administrador: { bg:"#78350f", color:"#fde68a", border:"#d97706" },
};

/* ── Estilos base ───────────────────────────────────────────── */
const E = {
  input:   { background:"#111827", border:"1px solid #374151", color:"white", padding:"8px 12px", borderRadius:"6px", width:"100%", fontSize:"13px", boxSizing:"border-box", marginBottom:"4px" },
  label:   { color:"#9ca3af", fontSize:"12px", display:"block", marginBottom:"4px" },
  btn:     { background:"#6366f1", color:"white", border:"none", padding:"8px 16px", borderRadius:"6px", cursor:"pointer", fontSize:"13px", fontWeight:"500" },
  btnGris: { background:"#374151", color:"white", border:"none", padding:"8px 16px", borderRadius:"6px", cursor:"pointer", fontSize:"13px" },
  btnRojo: { background:"#ef4444", color:"white", border:"none", padding:"4px 10px", borderRadius:"4px", cursor:"pointer", fontSize:"12px" },
  btnAma:  { background:"#d97706", color:"white", border:"none", padding:"4px 10px", borderRadius:"4px", cursor:"pointer", fontSize:"12px" },
  btnVerde:{ background:"#059669", color:"white", border:"none", padding:"4px 10px", borderRadius:"4px", cursor:"pointer", fontSize:"12px" },
  badge:   { fontSize:"11px", padding:"2px 8px", borderRadius:"10px", fontWeight:"600", display:"inline-block" },
};

/* =============================================================
   SUB-COMPONENTE: SelectorPerfiles
   DESCRIPCIÓN FUNCIONAL:
     Botonera para seleccionar uno o más perfiles.
     Resalta los seleccionados con el color del perfil.
   DESCRIPCIÓN TÉCNICA:
     Recibe perfiles seleccionados y callback onChange.
     Toggle: agrega si no está, quita si está.
   ============================================================= */
function SelectorPerfiles({ seleccionados, onChange }) {
  /**
   * DESCRIPCIÓN FUNCIONAL: Agrega o quita un perfil de la selección.
   * DESCRIPCIÓN TÉCNICA: Usa filter/spread para inmutabilidad.
   */
  function toggle(p) {
    if (seleccionados.includes(p)) {
      onChange(seleccionados.filter(x => x !== p));
    } else {
      onChange([...seleccionados, p]);
    }
  }

  return (
    <div style={{ display:"flex", flexWrap:"wrap", gap:"8px" }}>
      {PERFILES_DISPONIBLES.map(p => {
        const activo  = seleccionados.includes(p);
        const colores = PERFIL_COLORES[p] || { bg:"#374151", color:"white", border:"#6b7280" };
        return (
          <button key={p} type="button" onClick={() => toggle(p)}
            style={{
              padding:"6px 14px", borderRadius:"6px", fontSize:"12px",
              fontWeight:"600", cursor:"pointer", border:"1px solid",
              background: activo ? colores.bg      : "transparent",
              color:       activo ? colores.color   : "#6b7280",
              borderColor: activo ? colores.border  : "#374151",
              transition:"all 0.15s",
            }}>
            {PERFIL_LABELS[p] || p}
          </button>
        );
      })}
    </div>
  );
}

/* =============================================================
   COMPONENTE PRINCIPAL: GestionUsuarios
   ============================================================= */

// =============================================================
// PanelSupervisores — gestión de relaciones supervisor-operador
// =============================================================
function PanelSupervisores({ usuarios }) {
  const [relaciones, setRelaciones] = useState([]);
  const [cargando, setCargando]     = useState(true);
  const [supervisorId, setSuperv]   = useState("");
  const [operadorId, setOper]       = useState("");
  const [msg, setMsg]               = useState({ texto:"", tipo:"" });

  const EST = {
    select: { background:"#111827", border:"1px solid #374151", color:"white",
              padding:"7px 10px", borderRadius:"6px", fontSize:"13px", width:"100%" },
    btn:    { background:"#6366f1", color:"white", border:"none", padding:"7px 14px",
              borderRadius:"6px", cursor:"pointer", fontSize:"13px", fontWeight:"500" },
    btnRojo:{ background:"#ef4444", color:"white", border:"none", padding:"4px 8px",
              borderRadius:"4px", cursor:"pointer", fontSize:"12px" },
  };

  useEffect(() => { cargar(); }, []);

  async function cargar() {
    setCargando(true);
    try {
      const data = await api.get("/usuarios/supervisores-operadores");
      setRelaciones(data || []);
    } catch(e) {
      setMsg({ texto:"❌ " + (e.message || "Error"), tipo:"error" });
    }
    setCargando(false);
  }

  async function asignar() {
    if (!supervisorId || !operadorId) {
      setMsg({ texto:"Seleccioná supervisor y operador", tipo:"error" }); return;
    }
    if (supervisorId === operadorId) {
      setMsg({ texto:"No pueden ser la misma persona", tipo:"error" }); return;
    }
    try {
      await api.post("/usuarios/supervisores-operadores",
        { supervisor_id: supervisorId, operador_id: operadorId });
      setMsg({ texto:"✅ Relación creada", tipo:"ok" });
      setSuperv(""); setOper("");
      cargar();
    } catch(e) {
      setMsg({ texto:"❌ " + (e.message || "Error"), tipo:"error" });
    }
  }

  async function quitar(id, supNombre, opNombre) {
    if (!confirm(`¿Quitar la supervisión de ${supNombre} sobre ${opNombre}?`)) return;
    try {
      await api.delete(`/usuarios/supervisores-operadores/${id}`);
      setMsg({ texto:"✅ Relación eliminada", tipo:"ok" });
      cargar();
    } catch(e) {
      setMsg({ texto:"❌ " + (e.message || "Error"), tipo:"error" });
    }
  }

  const supervisores = usuarios.filter(u =>
    u.perfiles?.some(p => ["supervisor","dueno","administrador"].includes(p))
  );
  const operadores = usuarios.filter(u =>
    u.perfiles?.some(p => ["operador","supervisor"].includes(p))
  );

  return (
    <div style={{ marginTop:"32px", paddingTop:"24px", borderTop:"1px solid #374151" }}>
      <h3 style={{ margin:"0 0 6px", fontSize:"16px", color:"white" }}>
        👥 Relaciones Supervisor → Operador
      </h3>
      <p style={{ margin:"0 0 16px", fontSize:"13px", color:"#6b7280" }}>
        Define quién supervisa a quién. Necesario para validaciones, herencia y notificaciones.
      </p>

      <div style={{ background:"#1f2937", borderRadius:"8px", padding:"14px",
        border:"1px solid #374151", marginBottom:"16px" }}>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr auto",
          gap:"10px", alignItems:"end" }}>
          <div>
            <div style={{ fontSize:"11px", color:"#9ca3af", marginBottom:"4px" }}>Supervisor</div>
            <select style={EST.select} value={supervisorId}
              onChange={e => setSuperv(e.target.value)}>
              <option value="">— Seleccionar —</option>
              {supervisores.map(u => (
                <option key={u.id} value={u.id}>{u.nombre} {u.apellido}</option>
              ))}
            </select>
          </div>
          <div>
            <div style={{ fontSize:"11px", color:"#9ca3af", marginBottom:"4px" }}>Supervisa a</div>
            <select style={EST.select} value={operadorId}
              onChange={e => setOper(e.target.value)}>
              <option value="">— Seleccionar —</option>
              {operadores.map(u => (
                <option key={u.id} value={u.id}>{u.nombre} {u.apellido}</option>
              ))}
            </select>
          </div>
          <button style={EST.btn} onClick={asignar}>+ Asignar</button>
        </div>
        {msg.texto && (
          <div style={{ marginTop:"10px",
            background: msg.tipo==="ok" ? "#064e3b" : "#7f1d1d",
            color:      msg.tipo==="ok" ? "#10b981" : "#fca5a5",
            padding:"7px 12px", borderRadius:"6px", fontSize:"12px",
            display:"flex", justifyContent:"space-between" }}>
            <span>{msg.texto}</span>
            <button onClick={() => setMsg({ texto:"", tipo:"" })}
              style={{ background:"none", border:"none", color:"inherit", cursor:"pointer" }}>✕</button>
          </div>
        )}
      </div>

      {cargando ? (
        <div style={{ color:"#6b7280", fontSize:"13px" }}>⏳ Cargando...</div>
      ) : relaciones.length === 0 ? (
        <div style={{ color:"#6b7280", fontSize:"13px", textAlign:"center", padding:"20px" }}>
          No hay relaciones definidas
        </div>
      ) : (
        <div style={{ background:"#111827", borderRadius:"8px",
          border:"1px solid #1f2937", overflow:"hidden" }}>
          <table style={{ width:"100%", borderCollapse:"collapse", fontSize:"13px" }}>
            <thead>
              <tr style={{ background:"#1f2937" }}>
                <th style={{ textAlign:"left", padding:"10px 14px", color:"#9ca3af", fontWeight:"600" }}>Supervisor</th>
                <th style={{ textAlign:"left", padding:"10px 14px", color:"#9ca3af", fontWeight:"600" }}>Supervisa a</th>
                <th style={{ width:"60px", padding:"10px 14px" }}></th>
              </tr>
            </thead>
            <tbody>
              {relaciones.map(r => (
                <tr key={r.id} style={{ borderTop:"1px solid #1f2937" }}>
                  <td style={{ padding:"10px 14px", color:"white", fontWeight:"500" }}>
                    {r.supervisor_nombre}
                  </td>
                  <td style={{ padding:"10px 14px", color:"#9ca3af" }}>
                    {r.operador_nombre}
                  </td>
                  <td style={{ padding:"10px 14px", textAlign:"right" }}>
                    <button style={EST.btnRojo}
                      onClick={() => quitar(r.id, r.supervisor_nombre, r.operador_nombre)}>
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function GestionUsuarios() {
  const [usuarios, setUsuarios]               = useState([]);       /* Lista de usuarios */
  const [cargando, setCargando]               = useState(false);    /* Estado de carga */
  const [mostrarForm, setMostrarForm]         = useState(false);    /* Mostrar form de alta */
  const [usuarioEditando, setUsuarioEditando] = useState(null);     /* Usuario en edición de perfiles */
  const [mostrarInactivos, setMostrarInactivos] = useState(false);  /* Toggle activos/inactivos */
  const [msg, setMsg]                         = useState({ texto:"", tipo:"" }); /* Mensaje feedback */

  /* Estado del formulario de alta */
  const [form, setForm] = useState({ email:"", nombre:"", apellido:"", perfiles:["operador"] });

  /* Perfiles seleccionados en el modal de edición */
  const [perfilesEdicion, setPerfilesEdicion] = useState([]);

  useEffect(() => { cargar(); }, [mostrarInactivos]);

  /**
   * DESCRIPCIÓN FUNCIONAL: Carga la lista de usuarios según filtro de activo.
   * DESCRIPCIÓN TÉCNICA: GET con query param activo=true/false.
   */
  async function cargar() {
    setCargando(true);
    try {
      setUsuarios(await api.get(`/usuarios/?activo=${!mostrarInactivos}`));
    } catch(e) {
      setMsg({ texto:"❌ Error al cargar: " + e.message, tipo:"error" });
    }
    setCargando(false);
  }

  /**
   * DESCRIPCIÓN FUNCIONAL: Crea un nuevo usuario con los datos del formulario.
   * DESCRIPCIÓN TÉCNICA: POST al endpoint. Limpia el form y recarga la lista.
   */
  async function crear(e) {
    e.preventDefault();
    setMsg({ texto:"", tipo:"" });
    if (!form.email || !form.nombre || !form.apellido) {
      setMsg({ texto:"Todos los campos son obligatorios", tipo:"error" }); return;
    }
    if (form.perfiles.length === 0) {
      setMsg({ texto:"Asigná al menos un perfil", tipo:"error" }); return;
    }
    try {
      await api.post("/usuarios/", form);
      setMsg({ texto:"✅ Usuario registrado. Puede iniciar sesión con su cuenta de Google.", tipo:"ok" });
      setMostrarForm(false);
      setForm({ email:"", nombre:"", apellido:"", perfiles:["operador"] });
      cargar();
    } catch(e) {
      setMsg({ texto:"❌ " + e.message, tipo:"error" });
    }
  }

  /**
   * DESCRIPCIÓN FUNCIONAL: Abre el panel de edición de perfiles para un usuario.
   * DESCRIPCIÓN TÉCNICA: Inicializa perfilesEdicion con los perfiles actuales del usuario.
   */
  function abrirEdicionPerfiles(u) {
    setUsuarioEditando(u);
    setPerfilesEdicion([...(u.perfiles || [])]);
    setMostrarForm(false);
    setMsg({ texto:"", tipo:"" });
  }

  /**
   * DESCRIPCIÓN FUNCIONAL: Guarda los nuevos perfiles del usuario en edición.
   * DESCRIPCIÓN TÉCNICA: PUT al endpoint /{id}/perfiles. Recarga la lista.
   */
  async function guardarPerfiles() {
    if (perfilesEdicion.length === 0) {
      setMsg({ texto:"Asigná al menos un perfil", tipo:"error" }); return;
    }
    try {
      await api.put(`/usuarios/${usuarioEditando.id}/perfiles`, { perfiles: perfilesEdicion });
      setMsg({ texto:"✅ Perfiles actualizados", tipo:"ok" });
      setUsuarioEditando(null);
      cargar();
    } catch(e) {
      setMsg({ texto:"❌ " + e.message, tipo:"error" });
    }
  }

  /**
   * DESCRIPCIÓN FUNCIONAL: Desactiva un usuario con confirmación previa.
   * DESCRIPCIÓN TÉCNICA: PUT al endpoint /desactivar.
   */
  async function desactivar(u) {
    if (!confirm(`¿Desactivar a ${u.nombre} ${u.apellido}? No podrá acceder al sistema.`)) return;
    try {
      await api.put(`/usuarios/${u.id}/desactivar`);
      setMsg({ texto:"✅ Usuario desactivado", tipo:"ok" });
      cargar();
    } catch(e) {
      setMsg({ texto:"❌ " + e.message, tipo:"error" });
    }
  }

  /**
   * DESCRIPCIÓN FUNCIONAL: Reactiva un usuario desactivado.
   * DESCRIPCIÓN TÉCNICA: PUT al endpoint /reactivar.
   */
  async function reactivar(u) {
    try {
      await api.put(`/usuarios/${u.id}/reactivar`);
      setMsg({ texto:"✅ Usuario reactivado", tipo:"ok" });
      cargar();
    } catch(e) {
      setMsg({ texto:"❌ " + e.message, tipo:"error" });
    }
  }

  return (
    <div style={{ color:"white" }}>

      {/* Encabezado */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"16px" }}>
        <p style={{ margin:0, color:"#9ca3af", fontSize:"13px" }}>
          Pre-registrá emails de Google para que puedan acceder al sistema.
        </p>
        <button style={E.btn} onClick={() => {
          setMostrarForm(!mostrarForm);
          setUsuarioEditando(null);
          setMsg({ texto:"", tipo:"" });
        }}>
          {mostrarForm ? "✕ Cancelar" : "+ Agregar usuario"}
        </button>
      </div>

      {/* Banner de mensaje */}
      {msg.texto && (
        <div style={{
          background: msg.tipo === "ok" ? "#064e3b" : "#7f1d1d",
          border:     `1px solid ${msg.tipo === "ok" ? "#10b981" : "#ef4444"}`,
          color:      msg.tipo === "ok" ? "#10b981" : "#fca5a5",
          padding:"10px 14px", borderRadius:"6px", marginBottom:"14px",
          display:"flex", justifyContent:"space-between", fontSize:"13px",
        }}>
          <span>{msg.texto}</span>
          <button onClick={() => setMsg({ texto:"", tipo:"" })}
            style={{ background:"none", border:"none", color:"inherit", cursor:"pointer" }}>✕</button>
        </div>
      )}

      {/* Formulario de alta */}
      {mostrarForm && (
        <div style={{ background:"#1f2937", borderRadius:"8px", padding:"20px",
          border:"1px solid #6366f1", marginBottom:"16px" }}>
          <h3 style={{ margin:"0 0 16px", fontSize:"15px" }}>Nuevo usuario</h3>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"12px", marginBottom:"12px" }}>
            <div style={{ gridColumn:"1 / -1" }}>
              <label style={E.label}>Email de Google *</label>
              <input style={E.input} type="email" value={form.email}
                onChange={e => setForm({...form, email: e.target.value})}
                placeholder="usuario@gmail.com" />
            </div>
            <div>
              <label style={E.label}>Nombre *</label>
              <input style={E.input} value={form.nombre}
                onChange={e => setForm({...form, nombre: e.target.value})}
                placeholder="Juan" />
            </div>
            <div>
              <label style={E.label}>Apellido *</label>
              <input style={E.input} value={form.apellido}
                onChange={e => setForm({...form, apellido: e.target.value})}
                placeholder="Pérez" />
            </div>
          </div>
          <label style={{ ...E.label, marginBottom:"8px" }}>Perfiles *</label>
          <SelectorPerfiles seleccionados={form.perfiles}
            onChange={p => setForm({...form, perfiles: p})} />
          <div style={{ display:"flex", gap:"8px", marginTop:"16px" }}>
            <button style={E.btn} onClick={crear}>💾 Guardar</button>
            <button style={E.btnGris} onClick={() => setMostrarForm(false)}>Cancelar</button>
          </div>
        </div>
      )}

      {/* Panel de edición de perfiles */}
      {usuarioEditando && (
        <div style={{ background:"#1f2937", borderRadius:"8px", padding:"20px",
          border:"1px solid #d97706", marginBottom:"16px" }}>
          <h3 style={{ margin:"0 0 4px", fontSize:"15px" }}>
            ✏️ Editando perfiles: {usuarioEditando.nombre} {usuarioEditando.apellido}
          </h3>
          <p style={{ margin:"0 0 12px", fontSize:"12px", color:"#9ca3af" }}>
            {usuarioEditando.email}
          </p>
          <SelectorPerfiles seleccionados={perfilesEdicion} onChange={setPerfilesEdicion} />
          <div style={{ display:"flex", gap:"8px", marginTop:"16px" }}>
            <button style={E.btn} onClick={guardarPerfiles}>💾 Guardar perfiles</button>
            <button style={E.btnGris} onClick={() => setUsuarioEditando(null)}>Cancelar</button>
          </div>
        </div>
      )}

      {/* Toggle activos/inactivos */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"12px" }}>
        <label style={{ display:"flex", alignItems:"center", gap:"8px",
          color:"#9ca3af", fontSize:"13px", cursor:"pointer" }}>
          <input type="checkbox" checked={mostrarInactivos}
            onChange={e => setMostrarInactivos(e.target.checked)} />
          Ver usuarios inactivos
        </label>
        <span style={{ color:"#6b7280", fontSize:"12px" }}>
          {usuarios.length} usuario{usuarios.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Tabla de usuarios */}
      {cargando ? (
        <div style={{ textAlign:"center", padding:"40px", color:"#6b7280" }}>⏳ Cargando...</div>
      ) : (
        <div style={{ background:"#111827", borderRadius:"10px", border:"1px solid #1f2937", overflow:"hidden" }}>
          <table style={{ width:"100%", borderCollapse:"collapse", fontSize:"13px" }}>
            <thead>
              <tr style={{ background:"#1f2937", color:"#9ca3af" }}>
                <th style={{ textAlign:"left", padding:"12px 16px", fontWeight:"600" }}>Usuario</th>
                <th style={{ textAlign:"left", padding:"12px 16px", fontWeight:"600" }}>Email</th>
                <th style={{ textAlign:"left", padding:"12px 16px", fontWeight:"600" }}>Perfiles</th>
                <th style={{ textAlign:"left", padding:"12px 16px", fontWeight:"600" }}>Estado</th>
                <th style={{ padding:"12px 16px" }}></th>
              </tr>
            </thead>
            <tbody>
              {usuarios.map(u => (
                <tr key={u.id} style={{ borderTop:"1px solid #1f2937" }}>
                  {/* Avatar + nombre */}
                  <td style={{ padding:"11px 16px" }}>
                    <div style={{ display:"flex", alignItems:"center", gap:"8px" }}>
                      {u.foto_url && (
                        <img src={u.foto_url} alt=""
                          style={{ width:"28px", height:"28px", borderRadius:"50%" }} />
                      )}
                      <span style={{ color:"white", fontWeight:"500" }}>
                        {u.nombre} {u.apellido}
                      </span>
                    </div>
                  </td>
                  {/* Email */}
                  <td style={{ padding:"11px 16px", color:"#9ca3af" }}>{u.email}</td>
                  {/* Badges de perfiles */}
                  <td style={{ padding:"11px 16px" }}>
                    <div style={{ display:"flex", gap:"4px", flexWrap:"wrap" }}>
                      {(u.perfiles || []).map(p => {
                        const col = PERFIL_COLORES[p] || { bg:"#374151", color:"#d1d5db", border:"#6b7280" };
                        return (
                          <span key={p} style={{ ...E.badge,
                            background:  col.bg,
                            color:       col.color,
                            border:      `1px solid ${col.border}`,
                          }}>
                            {PERFIL_LABELS[p] || p}
                          </span>
                        );
                      })}
                      {(!u.perfiles || u.perfiles.length === 0) && (
                        <span style={{ color:"#6b7280", fontSize:"12px" }}>Sin perfiles</span>
                      )}
                    </div>
                  </td>
                  {/* Estado */}
                  <td style={{ padding:"11px 16px" }}>
                    <span style={{
                      fontSize:"11px", padding:"2px 8px", borderRadius:"10px", fontWeight:"600",
                      background: u.activo ? "#064e3b" : "#1f2937",
                      color:       u.activo ? "#10b981" : "#6b7280",
                      border:      `1px solid ${u.activo ? "#059669" : "#374151"}`,
                    }}>
                      {u.activo ? "Activo" : "Inactivo"}
                    </span>
                  </td>
                  {/* Acciones */}
                  <td style={{ padding:"11px 16px", textAlign:"right" }}>
                    <div style={{ display:"flex", gap:"6px", justifyContent:"flex-end" }}>
                      {/* Editar perfiles: solo activos */}
                      {u.activo && (
                        <button style={E.btnAma} onClick={() => abrirEdicionPerfiles(u)}>
                          ✏️ Perfiles
                        </button>
                      )}
                      {/* Desactivar o reactivar según estado */}
                      {u.activo ? (
                        <button style={E.btnRojo} onClick={() => desactivar(u)}>
                          Desactivar
                        </button>
                      ) : (
                        <button style={E.btnVerde} onClick={() => reactivar(u)}>
                          Reactivar
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {usuarios.length === 0 && (
            <div style={{ textAlign:"center", padding:"40px", color:"#6b7280" }}>
              No hay usuarios {mostrarInactivos ? "inactivos" : "registrados"}
            </div>
          )}
        </div>
      )}
      <PanelSupervisores usuarios={usuarios} />
    </div>
  );
}