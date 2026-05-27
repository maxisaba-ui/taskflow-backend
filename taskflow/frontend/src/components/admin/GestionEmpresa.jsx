/**
 * GestionEmpresa.jsx — v1.1.0
 * Gestión de datos de la empresa + subida de logo.
 */
import { useState, useEffect } from "react";
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
};

export default function GestionEmpresa() {
  const [datos, setDatos]       = useState(null);
  const [editando, setEditando] = useState(false);
  const [f, setF]               = useState({});
  const [msg, setMsg]           = useState({ texto:"", tipo:"" });
  const [subiendo, setSubiendo] = useState(false);
  const [archivoLogo, setArchivoLogo] = useState(null);
  const [previewLogo, setPreviewLogo] = useState(null);

  useEffect(() => { cargar(); }, []);

  async function cargar() {
    try {
      const data = await api.get("/parametros/empresa");
      setDatos(data);
      setF(data);
    } catch(e) {
      setMsg({ texto:"❌ Error al cargar: " + e.message, tipo:"error" });
    }
  }

  async function guardar() {
    try {
      await api.put("/parametros/empresa", f);
      setMsg({ texto:"✅ Datos actualizados", tipo:"ok" });
      setEditando(false);
      cargar();
    } catch(e) {
      setMsg({ texto:"❌ " + e.message, tipo:"error" });
    }
  }

  function handleLogoChange(e) {
    const file = e.target.files[0];
    if (!file) return;
    setArchivoLogo(file);
    const reader = new FileReader();
    reader.onload = ev => setPreviewLogo(ev.target.result);
    reader.readAsDataURL(file);
  }

  async function subirLogo() {
    if (!archivoLogo) return;
    setSubiendo(true);
    try {
      const formData = new FormData();
      formData.append("archivo", archivoLogo);
      const token = localStorage.getItem("taskflow_token");
      const resp = await fetch("/api/v1/parametros/empresa/logo", {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}` },
        body: formData,
      });
      if (!resp.ok) {
        const err = await resp.json();
        throw new Error(err.detail || "Error al subir");
      }
      setMsg({ texto:"✅ Logo actualizado. Cerrá sesión y volvé a entrar para verlo en el menú.", tipo:"ok" });
      setArchivoLogo(null);
      setPreviewLogo(null);
      cargar();
    } catch(e) {
      setMsg({ texto:"❌ " + e.message, tipo:"error" });
    }
    setSubiendo(false);
  }

  if (!datos) return (
    <div style={{ color:"#6b7280", textAlign:"center", padding:"40px" }}>⏳ Cargando...</div>
  );

  return (
    <div style={{ color:"white", maxWidth:"600px" }}>
      <h3 style={{ margin:"0 0 20px", fontSize:"16px" }}>🏢 Datos de la empresa</h3>

      {msg.texto && (
        <div style={{
          background: msg.tipo === "ok" ? "#064e3b" : "#7f1d1d",
          border:`1px solid ${msg.tipo === "ok" ? "#10b981" : "#ef4444"}`,
          color: msg.tipo === "ok" ? "#10b981" : "#fca5a5",
          padding:"10px 14px", borderRadius:"6px", marginBottom:"16px",
          display:"flex", justifyContent:"space-between", fontSize:"13px" }}>
          <span>{msg.texto}</span>
          <button onClick={() => setMsg({ texto:"", tipo:"" })}
            style={{ background:"none", border:"none", color:"inherit", cursor:"pointer" }}>✕</button>
        </div>
      )}

      {/* Logo actual + subida */}
      <div style={{ background:"#1f2937", borderRadius:"8px", padding:"16px",
        border:"1px solid #374151", marginBottom:"20px" }}>
        <div style={{ fontSize:"13px", fontWeight:"600", color:"white", marginBottom:"12px" }}>
          🖼️ Logo de la empresa
        </div>
        <div style={{ marginBottom:"12px" }}>
          {(previewLogo || datos.logo_url) ? (
            <img src={previewLogo || (datos.logo_url?.startsWith('/static') ? `http://localhost:8000${datos.logo_url}` : datos.logo_url)} alt="Logo empresa"
              style={{ height:"60px", maxWidth:"200px", objectFit:"contain",
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
          <label style={{ background:"#374151", color:"white", border:"none",
            padding:"7px 14px", borderRadius:"6px", cursor:"pointer",
            fontSize:"13px", display:"inline-block" }}>
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
          Formatos: JPG, PNG, SVG, WEBP · Máximo 2MB · Recomendado: 200×60px fondo transparente
        </div>
      </div>

      {/* Datos de la empresa */}
      {!editando ? (
        <div style={{ background:"#1f2937", borderRadius:"8px", padding:"16px",
          border:"1px solid #374151" }}>
          <div style={{ display:"grid", gap:"10px", fontSize:"13px" }}>
            {[
              ["Nombre",       datos.nombre],
              ["Zona horaria", datos.zona_horaria],
              ["Email notif.", datos.email_notificaciones],
              ["Horario",      `${datos.horario_inicio_default || "—"} → ${datos.horario_fin_default || "—"}`],
            ].map(([label, valor]) => (
              <div key={label} style={{ display:"flex", gap:"12px" }}>
                <span style={{ color:"#6b7280", minWidth:"120px" }}>{label}:</span>
                <span style={{ color:"white" }}>{valor || "—"}</span>
              </div>
            ))}
          </div>
          <button style={{ ...E.btn, marginTop:"14px" }} onClick={() => setEditando(true)}>
            ✏️ Editar datos
          </button>
        </div>
      ) : (
        <div style={{ background:"#1f2937", borderRadius:"8px", padding:"16px",
          border:"1px solid #6366f1" }}>
          <div style={{ display:"grid", gap:"10px", marginBottom:"14px" }}>
            <div>
              <label style={E.label}>Nombre de la empresa</label>
              <input style={E.input} value={f.nombre || ""}
                onChange={e => setF({...f, nombre: e.target.value})} />
            </div>
            <div>
              <label style={E.label}>Email de notificaciones</label>
              <input style={E.input} value={f.email_notificaciones || ""}
                onChange={e => setF({...f, email_notificaciones: e.target.value})} />
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"10px" }}>
              <div>
                <label style={E.label}>Horario inicio default</label>
                <input type="time" style={E.input} value={f.horario_inicio_default || ""}
                  onChange={e => setF({...f, horario_inicio_default: e.target.value})} />
              </div>
              <div>
                <label style={E.label}>Horario fin default</label>
                <input type="time" style={E.input} value={f.horario_fin_default || ""}
                  onChange={e => setF({...f, horario_fin_default: e.target.value})} />
              </div>
            </div>
          </div>
          <div style={{ display:"flex", gap:"8px" }}>
            <button style={E.btn} onClick={guardar}>💾 Guardar</button>
            <button style={E.btnGris} onClick={() => { setEditando(false); setF(datos); }}>
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
