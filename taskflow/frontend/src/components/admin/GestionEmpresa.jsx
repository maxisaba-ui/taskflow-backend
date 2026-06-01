/**
 * GestionEmpresa.jsx — v2.1.0
 * Gestión de empresa: datos, logo, color, SMTP.
 * Admin/dueño puede elegir cuál empresa editar.
 */
import { useState, useEffect, useContext } from "react";
import { AuthContext } from "../../context/AuthContext.jsx";
import { api } from "../../api/client.js";

const E = {
  input:   { background:"#111827", border:"1px solid #374151", color:"white",
             padding:"8px 10px", borderRadius:"6px", fontSize:"13px",
             boxSizing:"border-box", width:"100%" },
  label:   { color:"#9ca3af", fontSize:"12px", display:"block", marginBottom:"4px" },
  btn:     { background:"#6366f1", color:"white", border:"none", padding:"8px 16px",
             borderRadius:"6px", cursor:"pointer", fontSize:"13px", fontWeight:"500" },
  btnGris: { background:"#374151", color:"white", border:"none", padding:"8px 16px",
             borderRadius:"6px", cursor:"pointer", fontSize:"13px" },
  section: { background:"#1f2937", borderRadius:"8px", padding:"16px",
             border:"1px solid #374151", marginBottom:"16px" },
  fila:    { display:"flex", gap:"12px", alignItems:"center", fontSize:"13px" },
  lbl:     { color:"#6b7280", minWidth:"140px" },
  select:  { background:"#111827", border:"1px solid #374151", color:"white",
             padding:"8px 10px", borderRadius:"6px", fontSize:"13px", width:"100%" },
};

function Msg({ msg, onClose }) {
  if (!msg.texto) return null;
  const ok = msg.tipo === "ok";
  return (
    <div style={{ background: ok?"#064e3b":"#7f1d1d",
      border:`1px solid ${ok?"#10b981":"#ef4444"}`,
      color: ok?"#10b981":"#fca5a5",
      padding:"10px 14px", borderRadius:"6px", marginBottom:"16px",
      display:"flex", justifyContent:"space-between", fontSize:"13px" }}>
      <span>{msg.texto}</span>
      <button onClick={onClose}
        style={{ background:"none", border:"none", color:"inherit", cursor:"pointer" }}>✕</button>
    </div>
  );
}

export default function GestionEmpresa() {
  const { usuario } = useContext(AuthContext);
  const esAdmin = usuario?.perfiles?.includes("administrador") ||
                  usuario?.perfiles?.includes("dueno");

  const [empresas, setEmpresas]     = useState([]);       // lista para el selector (admin)
  const [empresaId, setEmpresaId]   = useState(null);     // null = usa la activa del JWT
  const [datos, setDatos]           = useState(null);
  const [editando, setEditando]     = useState(false);
  const [f, setF]                   = useState({});
  const [msg, setMsg]               = useState({ texto:"", tipo:"" });
  const [subiendo, setSubiendo]     = useState(false);
  const [archivoLogo, setLogo]      = useState(null);
  const [previewLogo, setPreview]   = useState(null);
  const [tabSMTP, setTabSMTP]       = useState(false);

  // Cargar lista de empresas para el selector (solo admin/dueño)
  useEffect(() => {
    if (esAdmin) {
      api.get("/parametros/empresas")
        .then(data => setEmpresas(data || []))
        .catch(() => {});
    }
  }, [esAdmin]);

  // Cargar datos de la empresa seleccionada (o la activa por defecto)
  useEffect(() => { cargar(); }, [empresaId]);

  async function cargar() {
    try {
      const url = empresaId
        ? `/parametros/empresa?empresa_id_override=${empresaId}`
        : "/parametros/empresa";
      const data = await api.get(url);
      setDatos(data); setF(data);
    } catch(e) { setMsg({ texto:"❌ Error al cargar: " + e.message, tipo:"error" }); }
  }

  async function guardar() {
    try {
      const payload = { ...f };
      delete payload.id; delete payload.logo_url; delete payload.icono_url; delete payload.activa;
      if (!payload.smtp_password_enc) delete payload.smtp_password_enc;
      const url = empresaId
        ? `/parametros/empresa?empresa_id_override=${empresaId}`
        : "/parametros/empresa";
      await api.put(url, payload);
      setMsg({ texto:"✅ Datos actualizados", tipo:"ok" });
      setEditando(false); cargar();
    } catch(e) { setMsg({ texto:"❌ " + e.message, tipo:"error" }); }
  }

  function handleLogoChange(e) {
    const file = e.target.files[0]; if (!file) return;
    setLogo(file);
    const reader = new FileReader();
    reader.onload = ev => setPreview(ev.target.result);
    reader.readAsDataURL(file);
  }

  async function subirLogo() {
    if (!archivoLogo) return;
    setSubiendo(true);
    try {
      const formData = new FormData();
      formData.append("archivo", archivoLogo);
      const token  = localStorage.getItem("taskflow_token");
      const apiUrl = import.meta.env.VITE_API_URL || "/api/v1";
      const eid    = empresaId || datos?.id;
      const url    = eid
        ? `${apiUrl}/parametros/empresa/logo?empresa_id_override=${eid}`
        : `${apiUrl}/parametros/empresa/logo`;
      const resp = await fetch(url, {
        method:"POST", headers:{ "Authorization":`Bearer ${token}` }, body:formData,
      });
      if (!resp.ok) { const err = await resp.json(); throw new Error(err.detail||"Error"); }
      setMsg({ texto:"✅ Logo actualizado.", tipo:"ok" });
      setLogo(null); setPreview(null); cargar();
    } catch(e) { setMsg({ texto:"❌ " + e.message, tipo:"error" }); }
    setSubiendo(false);
  }

  if (!datos) return <div style={{ color:"#6b7280", textAlign:"center", padding:"40px" }}>⏳ Cargando...</div>;

  return (
    <div style={{ color:"white", maxWidth:"640px" }}>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between",
        marginBottom:"20px" }}>
        <h3 style={{ margin:0, fontSize:"16px" }}>🏢 Configuración de la empresa</h3>
        {/* Selector de empresa para admin/dueño */}
        {esAdmin && empresas.length > 1 && (
          <div style={{ display:"flex", alignItems:"center", gap:"8px" }}>
            <span style={{ fontSize:"12px", color:"#9ca3af" }}>Editando:</span>
            <select style={{ ...E.select, width:"200px", fontSize:"12px" }}
              value={empresaId || ""}
              onChange={e => { setEmpresaId(e.target.value || null); setEditando(false); }}>
              <option value="">— Mi empresa activa —</option>
              {empresas.map(emp => (
                <option key={emp.id} value={emp.id}>
                  {emp.nombre}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      <Msg msg={msg} onClose={() => setMsg({ texto:"", tipo:"" })} />

      {/* Logo */}
      <div style={E.section}>
        <div style={{ fontSize:"13px", fontWeight:"600", marginBottom:"12px" }}>🖼️ Logo</div>
        <div style={{ marginBottom:"12px" }}>
          {(previewLogo || datos.logo_url) ? (
            <img src={previewLogo || (datos.logo_url?.startsWith("/static")
              ? `http://localhost:8000${datos.logo_url}` : datos.logo_url)}
              alt="Logo" style={{ height:"60px", maxWidth:"200px", objectFit:"contain",
                borderRadius:"6px", background:"#111827", padding:"8px",
                border:"1px solid #374151" }} />
          ) : (
            <div style={{ height:"60px", width:"200px", background:"#111827",
              borderRadius:"6px", border:"1px dashed #374151",
              display:"flex", alignItems:"center", justifyContent:"center",
              color:"#6b7280", fontSize:"12px" }}>Sin logo</div>
          )}
        </div>
        <div style={{ display:"flex", gap:"10px", alignItems:"center", flexWrap:"wrap" }}>
          <label style={{ background:"#374151", color:"white", padding:"7px 14px",
            borderRadius:"6px", cursor:"pointer", fontSize:"13px", display:"inline-block" }}>
            📁 Elegir archivo
            <input type="file" accept=".jpg,.jpeg,.png,.svg,.webp"
              onChange={handleLogoChange} style={{ display:"none" }} />
          </label>
          {archivoLogo && (
            <>
              <span style={{ fontSize:"12px", color:"#94a3b8" }}>{archivoLogo.name}</span>
              <button style={{ ...E.btn, background:"#059669" }}
                onClick={subirLogo} disabled={subiendo}>
                {subiendo ? "⏳ Subiendo..." : "⬆️ Subir logo"}
              </button>
            </>
          )}
        </div>
        <div style={{ fontSize:"11px", color:"#6b7280", marginTop:"8px" }}>
          Formatos: JPG, PNG, SVG, WEBP · Máx 2MB · Recomendado: 200×60px fondo transparente
        </div>
      </div>

      {/* Datos principales */}
      <div style={{ ...E.section, border: editando ? "1px solid #6366f1" : "1px solid #374151" }}>
        <div style={{ fontSize:"13px", fontWeight:"600", marginBottom:"12px" }}>📋 Datos generales</div>

        {!editando ? (
          <>
            <div style={{ display:"grid", gap:"8px" }}>
              {[
                ["Nombre",        datos.nombre],
                ["Zona horaria",  datos.zona_horaria],
                ["Email notif.",  datos.email_notificaciones || "—"],
                ["Horario",       `${datos.horario_inicio_default||"—"} → ${datos.horario_fin_default||"—"}`],
              ].map(([label, valor]) => (
                <div key={label} style={E.fila}>
                  <span style={E.lbl}>{label}:</span>
                  <span style={{ color:"white" }}>{valor}</span>
                </div>
              ))}
              <div style={E.fila}>
                <span style={E.lbl}>Color primario:</span>
                <span style={{ display:"flex", alignItems:"center", gap:"8px" }}>
                  <span style={{ width:"18px", height:"18px", borderRadius:"50%",
                    background: datos.color_primario||"#6366f1",
                    display:"inline-block", border:"2px solid #374151" }} />
                  <span style={{ color:"white" }}>{datos.color_primario||"#6366f1"}</span>
                </span>
              </div>
            </div>
            <button style={{ ...E.btn, marginTop:"14px" }} onClick={() => setEditando(true)}>
              ✏️ Editar datos
            </button>
          </>
        ) : (
          <>
            <div style={{ display:"grid", gap:"10px", marginBottom:"14px" }}>
              <div>
                <label style={E.label}>Nombre de la empresa *</label>
                <input style={E.input} value={f.nombre||""}
                  onChange={e => setF({...f, nombre:e.target.value})} />
              </div>
              <div>
                <label style={E.label}>Email de notificaciones</label>
                <input style={E.input} value={f.email_notificaciones||""}
                  onChange={e => setF({...f, email_notificaciones:e.target.value})} />
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"10px" }}>
                <div>
                  <label style={E.label}>Horario inicio</label>
                  <input type="time" style={E.input} value={f.horario_inicio_default||""}
                    onChange={e => setF({...f, horario_inicio_default:e.target.value})} />
                </div>
                <div>
                  <label style={E.label}>Horario fin</label>
                  <input type="time" style={E.input} value={f.horario_fin_default||""}
                    onChange={e => setF({...f, horario_fin_default:e.target.value})} />
                </div>
              </div>
              <div>
                <label style={E.label}>Color primario</label>
                <div style={{ display:"flex", gap:"10px", alignItems:"center" }}>
                  <input type="color" value={f.color_primario||"#6366f1"}
                    onChange={e => setF({...f, color_primario:e.target.value})}
                    style={{ width:"40px", height:"36px", padding:"2px",
                      border:"1px solid #374151", borderRadius:"6px",
                      cursor:"pointer", background:"#111827" }} />
                  <input style={{ ...E.input, width:"120px" }} value={f.color_primario||"#6366f1"}
                    onChange={e => setF({...f, color_primario:e.target.value})} />
                </div>
              </div>
              <div>
                <label style={E.label}>Zona horaria</label>
                <input style={E.input} value={f.zona_horaria||""}
                  onChange={e => setF({...f, zona_horaria:e.target.value})} />
              </div>
            </div>
            <div style={{ display:"flex", gap:"8px" }}>
              <button style={E.btn} onClick={guardar}>💾 Guardar</button>
              <button style={E.btnGris}
                onClick={() => { setEditando(false); setF(datos); }}>Cancelar</button>
            </div>
          </>
        )}
      </div>

      {/* SMTP */}
      <div style={E.section}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between",
          marginBottom: tabSMTP ? "12px" : "0" }}>
          <div style={{ fontSize:"13px", fontWeight:"600" }}>📧 SMTP para envío de emails</div>
          <button style={{ ...E.btnGris, padding:"4px 10px", fontSize:"12px" }}
            onClick={() => setTabSMTP(!tabSMTP)}>
            {tabSMTP ? "▲ Ocultar" : "▼ Configurar"}
          </button>
        </div>
        {tabSMTP && (
          <div style={{ display:"grid", gap:"10px" }}>
            <div style={{ fontSize:"11px", color:"#6b7280", marginBottom:"4px" }}>
              Necesario para el envío automático de emails al completar tareas
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 120px", gap:"10px" }}>
              <div>
                <label style={E.label}>Servidor SMTP</label>
                <input style={E.input} value={f.smtp_host||""}
                  placeholder="smtp.gmail.com"
                  onChange={e => setF({...f, smtp_host:e.target.value})} />
              </div>
              <div>
                <label style={E.label}>Puerto</label>
                <input type="number" style={E.input} value={f.smtp_puerto||587}
                  onChange={e => setF({...f, smtp_puerto:parseInt(e.target.value)})} />
              </div>
            </div>
            <div>
              <label style={E.label}>Usuario SMTP (email remitente)</label>
              <input style={E.input} value={f.smtp_usuario||""}
                placeholder="notificaciones@miestudio.com"
                onChange={e => setF({...f, smtp_usuario:e.target.value})} />
            </div>
            <div>
              <label style={E.label}>Contraseña / App Password</label>
              <input type="password" style={E.input} value={f.smtp_password_enc||""}
                placeholder="Dejar vacío para no cambiarla"
                onChange={e => setF({...f, smtp_password_enc:e.target.value})} />
            </div>
            <button style={{ ...E.btn, alignSelf:"start" }} onClick={guardar}>
              💾 Guardar SMTP
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
