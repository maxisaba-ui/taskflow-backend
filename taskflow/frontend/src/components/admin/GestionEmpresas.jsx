/**
 * GestionEmpresas.jsx — v1.0.0
 * Lista, crea y gestiona múltiples empresas.
 * Permite asignar/quitar usuarios de cada empresa.
 * Solo visible para administradores y dueños.
 */
import { useState, useEffect } from "react";
import { api } from "../../api/client.js";

const E = {
  input:   { background:"#111827", border:"1px solid #374151", color:"white",
             padding:"8px 10px", borderRadius:"6px", fontSize:"13px",
             boxSizing:"border-box", width:"100%" },
  label:   { color:"#9ca3af", fontSize:"12px", display:"block", marginBottom:"4px" },
  btn:     { background:"#6366f1", color:"white", border:"none", padding:"8px 14px",
             borderRadius:"6px", cursor:"pointer", fontSize:"13px", fontWeight:"500" },
  btnGris: { background:"#374151", color:"white", border:"none", padding:"6px 12px",
             borderRadius:"6px", cursor:"pointer", fontSize:"12px" },
  btnVerde:{ background:"#059669", color:"white", border:"none", padding:"4px 10px",
             borderRadius:"4px", cursor:"pointer", fontSize:"12px" },
  btnRojo: { background:"#ef4444", color:"white", border:"none", padding:"4px 10px",
             borderRadius:"4px", cursor:"pointer", fontSize:"12px" },
};

function Msg({ msg, onClose }) {
  if (!msg.texto) return null;
  const ok = msg.tipo === "ok";
  return (
    <div style={{ background:ok?"#064e3b":"#7f1d1d",
      border:`1px solid ${ok?"#10b981":"#ef4444"}`, color:ok?"#10b981":"#fca5a5",
      padding:"10px 14px", borderRadius:"6px", marginBottom:"16px",
      display:"flex", justifyContent:"space-between", fontSize:"13px" }}>
      <span>{msg.texto}</span>
      <button onClick={onClose} style={{ background:"none",border:"none",color:"inherit",cursor:"pointer" }}>✕</button>
    </div>
  );
}

export default function GestionEmpresas() {
  const [empresas, setEmpresas]   = useState([]);
  const [usuarios, setUsuarios]   = useState([]);   // todos los usuarios del sistema
  const [creando, setCreando]     = useState(false);
  const [nueva, setNueva]         = useState({ nombre:"", zona_horaria:"America/Argentina/Buenos_Aires", color_primario:"#6366f1", email_notificaciones:"" });
  const [selEmpresa, setSelEmp]   = useState(null);  // empresa seleccionada para ver usuarios
  const [miembros, setMiembros]   = useState([]);
  const [msg, setMsg]             = useState({ texto:"", tipo:"" });
  const [cargando, setCarg]       = useState(false);

  useEffect(() => { cargar(); }, []);

  async function cargar() {
    try {
      const [emps, usrs] = await Promise.all([
        api.get("/parametros/empresas"),
        api.get("/usuarios/"),
      ]);
      setEmpresas(emps || []);
      setUsuarios(usrs || []);
    } catch(e) { setMsg({ texto:"❌ " + e.message, tipo:"error" }); }
  }

  async function crearEmpresa() {
    if (!nueva.nombre.trim()) return;
    try {
      await api.post("/parametros/empresas", nueva);
      setMsg({ texto:`✅ Empresa "${nueva.nombre}" creada`, tipo:"ok" });
      setCreando(false);
      setNueva({ nombre:"", zona_horaria:"America/Argentina/Buenos_Aires", color_primario:"#6366f1", email_notificaciones:"" });
      cargar();
    } catch(e) { setMsg({ texto:"❌ " + e.message, tipo:"error" }); }
  }

  async function verMiembros(empresa) {
    setSelEmp(empresa); setCarg(true);
    try {
      const data = await api.get(`/parametros/empresas/${empresa.id}/usuarios`);
      setMiembros(data || []);
    } catch(e) { setMsg({ texto:"❌ " + e.message, tipo:"error" }); }
    setCarg(false);
  }

  async function asignarUsuario(usuarioId) {
    if (!selEmpresa) return;
    try {
      await api.post(`/parametros/empresas/${selEmpresa.id}/usuarios/${usuarioId}`, {});
      setMsg({ texto:"✅ Usuario asignado", tipo:"ok" });
      verMiembros(selEmpresa);
    } catch(e) { setMsg({ texto:"❌ " + e.message, tipo:"error" }); }
  }

  async function quitarUsuario(usuarioId) {
    if (!selEmpresa) return;
    try {
      await api.delete(`/parametros/empresas/${selEmpresa.id}/usuarios/${usuarioId}`);
      setMsg({ texto:"✅ Usuario quitado de la empresa", tipo:"ok" });
      verMiembros(selEmpresa);
    } catch(e) { setMsg({ texto:"❌ " + e.message, tipo:"error" }); }
  }

  const miembrosIds = new Set(miembros.filter(m => m.asignado_activo).map(m => m.id));

  return (
    <div style={{ color:"white" }}>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between",
        marginBottom:"20px" }}>
        <h3 style={{ margin:0, fontSize:"16px" }}>🏢 Gestión de Empresas</h3>
        <button style={E.btn} onClick={() => setCreando(!creando)}>
          {creando ? "✕ Cancelar" : "+ Nueva empresa"}
        </button>
      </div>

      <Msg msg={msg} onClose={() => setMsg({ texto:"", tipo:"" })} />

      {/* Formulario nueva empresa */}
      {creando && (
        <div style={{ background:"#1f2937", borderRadius:"8px", padding:"16px",
          border:"1px solid #6366f1", marginBottom:"20px" }}>
          <div style={{ fontSize:"13px", fontWeight:"600", marginBottom:"12px" }}>
            Nueva empresa
          </div>
          <div style={{ display:"grid", gap:"10px" }}>
            <div>
              <label style={E.label}>Nombre *</label>
              <input style={E.input} value={nueva.nombre}
                placeholder="Ej: Estudio Norte"
                onChange={e => setNueva({...nueva, nombre:e.target.value})} />
            </div>
            <div>
              <label style={E.label}>Email de notificaciones</label>
              <input style={E.input} value={nueva.email_notificaciones}
                placeholder="notif@estudio.com"
                onChange={e => setNueva({...nueva, email_notificaciones:e.target.value})} />
            </div>
            <div style={{ display:"flex", gap:"10px", alignItems:"center" }}>
              <div>
                <label style={E.label}>Color primario</label>
                <div style={{ display:"flex", gap:"8px", alignItems:"center" }}>
                  <input type="color" value={nueva.color_primario}
                    onChange={e => setNueva({...nueva, color_primario:e.target.value})}
                    style={{ width:"36px", height:"34px", padding:"2px",
                      border:"1px solid #374151", borderRadius:"6px",
                      cursor:"pointer", background:"#111827" }} />
                  <span style={{ fontSize:"12px", color:"#9ca3af" }}>{nueva.color_primario}</span>
                </div>
              </div>
            </div>
          </div>
          <div style={{ display:"flex", gap:"8px", marginTop:"12px" }}>
            <button style={E.btn} onClick={crearEmpresa}>💾 Crear empresa</button>
            <button style={E.btnGris} onClick={() => setCreando(false)}>Cancelar</button>
          </div>
        </div>
      )}

      <div style={{ display:"grid", gridTemplateColumns: selEmpresa ? "1fr 1fr" : "1fr",
        gap:"16px" }}>

        {/* Lista de empresas */}
        <div>
          {empresas.length === 0 ? (
            <div style={{ color:"#6b7280", textAlign:"center", padding:"40px", fontSize:"13px" }}>
              No hay empresas registradas
            </div>
          ) : (
            <div style={{ display:"flex", flexDirection:"column", gap:"8px" }}>
              {empresas.map(emp => (
                <div key={emp.id} style={{
                  background: selEmpresa?.id === emp.id ? "#1e1b4b" : "#1f2937",
                  borderRadius:"8px", padding:"14px",
                  border:`1px solid ${selEmpresa?.id === emp.id ? "#6366f1" : "#374151"}`,
                  cursor:"pointer",
                }} onClick={() => selEmpresa?.id === emp.id ? setSelEmp(null) : verMiembros(emp)}>
                  <div style={{ display:"flex", alignItems:"center", gap:"10px" }}>
                    {/* Círculo de color */}
                    <div style={{ width:"12px", height:"12px", borderRadius:"50%",
                      background: emp.color_primario, flexShrink:0 }} />
                    <div style={{ flex:1 }}>
                      <div style={{ fontWeight:"600", fontSize:"13px" }}>{emp.nombre}</div>
                      <div style={{ fontSize:"11px", color:"#9ca3af", marginTop:"2px" }}>
                        {emp.total_usuarios} usuario{emp.total_usuarios !== 1 ? "s" : ""}
                        {emp.email_notificaciones && ` · ${emp.email_notificaciones}`}
                      </div>
                    </div>
                    <div style={{ display:"flex", alignItems:"center", gap:"6px" }}>
                      <span style={{ fontSize:"10px", padding:"2px 6px", borderRadius:"8px",
                        background: emp.activa ? "#064e3b" : "#374151",
                        color: emp.activa ? "#10b981" : "#9ca3af" }}>
                        {emp.activa ? "activa" : "inactiva"}
                      </span>
                      <span style={{ fontSize:"12px", color:"#6b7280" }}>
                        {selEmpresa?.id === emp.id ? "▲" : "▼ usuarios"}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Panel de usuarios de la empresa seleccionada */}
        {selEmpresa && (
          <div style={{ background:"#1f2937", borderRadius:"8px", padding:"14px",
            border:"1px solid #6366f1" }}>
            <div style={{ fontSize:"13px", fontWeight:"600", marginBottom:"12px",
              color:"#c4b5fd" }}>
              👥 Usuarios — {selEmpresa.nombre}
            </div>

            {cargando ? (
              <div style={{ color:"#6b7280", fontSize:"12px" }}>⏳ Cargando...</div>
            ) : (
              <>
                {/* Asignar usuario */}
                <div style={{ marginBottom:"12px" }}>
                  <label style={E.label}>Agregar usuario</label>
                  <select
                    style={{ ...E.input, marginBottom:"6px" }}
                    defaultValue=""
                    onChange={e => { if (e.target.value) { asignarUsuario(e.target.value); e.target.value=""; } }}>
                    <option value="">— Seleccionar usuario —</option>
                    {usuarios
                      .filter(u => !miembrosIds.has(u.id) && u.activo)
                      .map(u => (
                        <option key={u.id} value={u.id}>
                          {u.nombre} {u.apellido} ({u.email})
                        </option>
                      ))}
                  </select>
                </div>

                {/* Lista de miembros actuales */}
                <div style={{ display:"flex", flexDirection:"column", gap:"6px",
                  maxHeight:"320px", overflowY:"auto" }}>
                  {miembros.filter(m => m.asignado_activo).length === 0 ? (
                    <div style={{ color:"#6b7280", fontSize:"12px" }}>
                      Sin usuarios asignados
                    </div>
                  ) : (
                    miembros.filter(m => m.asignado_activo).map(m => (
                      <div key={m.id} style={{ display:"flex", alignItems:"center", gap:"8px",
                        padding:"7px 10px", background:"#111827", borderRadius:"6px",
                        border:"1px solid #374151" }}>
                        {m.foto_url ? (
                          <img src={m.foto_url} alt="" style={{ width:"26px", height:"26px",
                            borderRadius:"50%", objectFit:"cover" }} />
                        ) : (
                          <div style={{ width:"26px", height:"26px", borderRadius:"50%",
                            background:"#374151", display:"flex", alignItems:"center",
                            justifyContent:"center", fontSize:"11px", flexShrink:0 }}>
                            {(m.nombre||"U")[0].toUpperCase()}
                          </div>
                        )}
                        <div style={{ flex:1 }}>
                          <div style={{ fontSize:"12px", fontWeight:"600" }}>
                            {m.nombre} {m.apellido}
                          </div>
                          <div style={{ fontSize:"10px", color:"#9ca3af" }}>{m.email}</div>
                        </div>
                        <button style={E.btnRojo} onClick={() => quitarUsuario(m.id)}
                          title="Quitar de esta empresa">✕</button>
                      </div>
                    ))
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
