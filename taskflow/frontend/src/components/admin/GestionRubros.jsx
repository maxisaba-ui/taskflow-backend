/**
 * GestionRubros.jsx — v1.0.0
 * ABM de rubros de tareas.
 * Permisos: administrador, dueño y supervisor pueden crear/editar.
 * Solo administrador y dueño pueden eliminar.
 * Preparado para multi-empresa: cuando se agregue empresa_id,
 * el filtro se aplica en el backend sin cambios en el frontend.
 */
import { useState, useEffect, useContext } from "react";
import { api } from "../../api/client.js";
import { AuthContext } from "../../context/AuthContext.jsx";

const COLORES_PRESET = [
  "#6366f1","#8b5cf6","#ec4899","#ef4444","#f97316",
  "#eab308","#22c55e","#10b981","#06b6d4","#3b82f6",
  "#6b7280","#1f2937",
];

const E = {
  input:   { background:"#111827", border:"1px solid #374151", color:"white",
             padding:"8px 10px", borderRadius:"6px", fontSize:"13px",
             boxSizing:"border-box", width:"100%" },
  label:   { color:"#9ca3af", fontSize:"12px", display:"block", marginBottom:"4px" },
  btn:     { background:"#6366f1", color:"white", border:"none", padding:"8px 16px",
             borderRadius:"6px", cursor:"pointer", fontSize:"13px", fontWeight:"500" },
  btnGris: { background:"#374151", color:"white", border:"none", padding:"8px 16px",
             borderRadius:"6px", cursor:"pointer", fontSize:"13px" },
  btnRojo: { background:"#ef4444", color:"white", border:"none", padding:"4px 8px",
             borderRadius:"4px", cursor:"pointer", fontSize:"12px" },
  btnAma:  { background:"#d97706", color:"white", border:"none", padding:"4px 8px",
             borderRadius:"4px", cursor:"pointer", fontSize:"12px" },
};

const ICONOS_PRESET = ["📁","📋","💼","🔧","📊","💰","📝","⚙️","🏢","👥","📅","✅"];

function FormRubro({ inicial, onGuardar, onCancelar }) {
  const [f, setF] = useState({
    codigo:    inicial?.codigo    || "",
    nombre:    inicial?.nombre    || "",
    color_hex: inicial?.color_hex || "#6366f1",
    icono:     inicial?.icono     || "📁",
    orden:     inicial?.orden     || 99,
  });
  const [err, setErr] = useState("");

  function guardar() {
    setErr("");
    if (!f.codigo.trim()) { setErr("El código es obligatorio"); return; }
    if (!f.nombre.trim()) { setErr("El nombre es obligatorio"); return; }
    onGuardar({
      ...f,
      codigo: f.codigo.trim().toUpperCase(),
      orden:  parseInt(f.orden) || 99,
    });
  }

  return (
    <div style={{ background:"#1f2937", borderRadius:"8px", padding:"18px",
      border:"1px solid #6366f1", marginBottom:"16px" }}>
      <h3 style={{ margin:"0 0 14px", fontSize:"14px", color:"white" }}>
        {inicial ? "✏️ Editar rubro" : "Nuevo rubro"}
      </h3>

      <div style={{ display:"grid", gridTemplateColumns:"120px 1fr 80px",
        gap:"10px", marginBottom:"10px" }}>
        <div>
          <label style={E.label}>Código *</label>
          <input style={E.input} value={f.codigo}
            onChange={e => setF({...f, codigo: e.target.value.toUpperCase()})}
            placeholder="CONT" maxLength={10} />
        </div>
        <div>
          <label style={E.label}>Nombre *</label>
          <input style={E.input} value={f.nombre}
            onChange={e => setF({...f, nombre: e.target.value})}
            placeholder="Contabilidad" />
        </div>
        <div>
          <label style={E.label}>Orden</label>
          <input style={E.input} type="number" min="1" value={f.orden}
            onChange={e => setF({...f, orden: e.target.value})} />
        </div>
      </div>

      {/* Selector de ícono */}
      <div style={{ marginBottom:"10px" }}>
        <label style={E.label}>Ícono</label>
        <div style={{ display:"flex", gap:"6px", flexWrap:"wrap" }}>
          {ICONOS_PRESET.map(ic => (
            <button key={ic} onClick={() => setF({...f, icono: ic})}
              style={{ fontSize:"18px", padding:"4px 8px",
                borderRadius:"6px", cursor:"pointer", border:"1px solid",
                background: f.icono === ic ? "#374151" : "transparent",
                borderColor: f.icono === ic ? "#6366f1" : "#374151" }}>
              {ic}
            </button>
          ))}
          <input style={{ ...E.input, width:"60px", fontSize:"16px",
            textAlign:"center", padding:"4px" }}
            value={f.icono} onChange={e => setF({...f, icono: e.target.value})}
            maxLength={2} title="O ingresá tu propio emoji" />
        </div>
      </div>

      {/* Selector de color */}
      <div style={{ marginBottom:"14px" }}>
        <label style={E.label}>Color</label>
        <div style={{ display:"flex", gap:"6px", flexWrap:"wrap",
          alignItems:"center" }}>
          {COLORES_PRESET.map(col => (
            <button key={col} onClick={() => setF({...f, color_hex: col})}
              style={{ width:"28px", height:"28px", borderRadius:"50%",
                background:col, cursor:"pointer", border:"3px solid",
                borderColor: f.color_hex === col ? "white" : "transparent" }} />
          ))}
          <input type="color" value={f.color_hex}
            onChange={e => setF({...f, color_hex: e.target.value})}
            style={{ width:"32px", height:"32px", borderRadius:"6px",
              border:"none", cursor:"pointer", background:"none" }}
            title="Color personalizado" />
          <span style={{ fontSize:"12px", color:"#6b7280",
            fontFamily:"monospace" }}>{f.color_hex}</span>
        </div>
      </div>

      {/* Preview */}
      <div style={{ display:"flex", alignItems:"center", gap:"10px",
        background:"#111827", borderRadius:"6px", padding:"10px 14px",
        marginBottom:"14px", border:`2px solid ${f.color_hex}` }}>
        <span style={{ fontSize:"20px" }}>{f.icono}</span>
        <div>
          <div style={{ fontWeight:"700", fontSize:"13px", color:"white" }}>
            {f.nombre || "Nombre del rubro"}
          </div>
          <div style={{ fontSize:"11px", color:"#6b7280",
            fontFamily:"monospace" }}>
            [{f.codigo || "CÓDIGO"}]
          </div>
        </div>
        <div style={{ marginLeft:"auto", width:"12px", height:"12px",
          borderRadius:"50%", background:f.color_hex }} />
      </div>

      {err && (
        <div style={{ color:"#fca5a5", background:"#7f1d1d",
          padding:"7px 12px", borderRadius:"6px",
          fontSize:"12px", marginBottom:"12px" }}>
          ⚠️ {err}
        </div>
      )}

      <div style={{ display:"flex", gap:"8px" }}>
        <button style={E.btn} onClick={guardar}>
          {inicial ? "💾 Guardar cambios" : "✅ Crear rubro"}
        </button>
        <button style={E.btnGris} onClick={onCancelar}>Cancelar</button>
      </div>
    </div>
  );
}

export default function GestionRubros() {
  const { usuario } = useContext(AuthContext);
  const [rubros, setRubros]       = useState([]);
  const [mostrarForm, setForm]    = useState(false);
  const [editando, setEditando]   = useState(null);
  const [msg, setMsg]             = useState({ texto:"", tipo:"" });

  const esSupervisor =
    usuario?.perfiles?.includes("supervisor")    ||
    usuario?.perfiles?.includes("administrador") ||
    usuario?.perfiles?.includes("dueno");

  const esAdmin =
    usuario?.perfiles?.includes("administrador") ||
    usuario?.perfiles?.includes("dueno");

  useEffect(() => { cargar(); }, []);

  async function cargar() {
    try {
      const data = await api.get("/parametros/rubros");
      setRubros(data || []);
    } catch(e) {
      setMsg({ texto:"❌ Error al cargar: " + e.message, tipo:"error" });
    }
  }

  async function crear(datos) {
    try {
      await api.post("/parametros/rubros", datos);
      setMsg({ texto:"✅ Rubro creado correctamente", tipo:"ok" });
      setForm(false);
      cargar();
    } catch(e) { setMsg({ texto:"❌ " + e.message, tipo:"error" }); }
  }

  async function editar(datos) {
    try {
      await api.put(`/parametros/rubros/${editando.id}`, datos);
      setMsg({ texto:"✅ Rubro actualizado", tipo:"ok" });
      setEditando(null);
      cargar();
    } catch(e) { setMsg({ texto:"❌ " + e.message, tipo:"error" }); }
  }

  async function eliminar(r) {
    if (!confirm(`¿Desactivar el rubro "${r.nombre}" [${r.codigo}]?\nSolo es posible si no tiene tareas asignadas.`))
      return;
    try {
      await api.delete(`/parametros/rubros/${r.id}`);
      setMsg({ texto:"✅ Rubro desactivado", tipo:"ok" });
      cargar();
    } catch(e) { setMsg({ texto:"❌ " + e.message, tipo:"error" }); }
  }

  if (!esSupervisor) return (
    <div style={{ color:"#6b7280", textAlign:"center", padding:"40px" }}>
      🔒 Solo supervisores y administradores pueden gestionar rubros
    </div>
  );

  return (
    <div style={{ color:"white" }}>
      <div style={{ display:"flex", justifyContent:"space-between",
        alignItems:"center", marginBottom:"16px", flexWrap:"wrap", gap:"10px" }}>
        <div>
          <p style={{ margin:"0 0 4px", color:"#9ca3af", fontSize:"13px" }}>
            Categorizan las tareas del catálogo. Cada tarea pertenece a un rubro.
          </p>
          <p style={{ margin:0, color:"#6b7280", fontSize:"12px" }}>
            💡 Al implementar multi-empresa, cada empresa tendrá sus propios rubros.
          </p>
        </div>
        <button style={E.btn}
          onClick={() => { setForm(!mostrarForm); setEditando(null); }}>
          {mostrarForm ? "✕ Cancelar" : "+ Nuevo rubro"}
        </button>
      </div>

      {msg.texto && (
        <div style={{
          background: msg.tipo === "ok" ? "#064e3b" : "#7f1d1d",
          border:`1px solid ${msg.tipo === "ok" ? "#10b981" : "#ef4444"}`,
          color: msg.tipo === "ok" ? "#10b981" : "#fca5a5",
          padding:"10px 14px", borderRadius:"6px", marginBottom:"14px",
          display:"flex", justifyContent:"space-between", fontSize:"13px" }}>
          <span>{msg.texto}</span>
          <button onClick={() => setMsg({ texto:"", tipo:"" })}
            style={{ background:"none", border:"none",
              color:"inherit", cursor:"pointer" }}>✕</button>
        </div>
      )}

      {mostrarForm && (
        <FormRubro onGuardar={crear}
          onCancelar={() => setForm(false)} />
      )}
      {editando && (
        <FormRubro inicial={editando} onGuardar={editar}
          onCancelar={() => setEditando(null)} />
      )}

      {/* Tabla de rubros */}
      {rubros.length === 0 ? (
        <div style={{ textAlign:"center", padding:"40px", color:"#6b7280" }}>
          No hay rubros definidos
        </div>
      ) : (
        <div style={{ background:"#111827", borderRadius:"8px",
          border:"1px solid #1f2937", overflow:"hidden" }}>
          <table style={{ width:"100%", borderCollapse:"collapse",
            fontSize:"13px" }}>
            <thead>
              <tr style={{ background:"#1f2937" }}>
                <th style={{ textAlign:"left", padding:"10px 14px",
                  color:"#9ca3af", fontWeight:"600", width:"50px" }}>Color</th>
                <th style={{ textAlign:"left", padding:"10px 14px",
                  color:"#9ca3af", fontWeight:"600", width:"80px" }}>Código</th>
                <th style={{ textAlign:"left", padding:"10px 14px",
                  color:"#9ca3af", fontWeight:"600" }}>Nombre</th>
                <th style={{ textAlign:"left", padding:"10px 14px",
                  color:"#9ca3af", fontWeight:"600", width:"60px" }}>Orden</th>
                <th style={{ padding:"10px 14px", width:"100px" }}></th>
              </tr>
            </thead>
            <tbody>
              {rubros.map(r => (
                <tr key={r.id} style={{ borderTop:"1px solid #1f2937" }}>
                  <td style={{ padding:"10px 14px" }}>
                    <div style={{ display:"flex", alignItems:"center", gap:"8px" }}>
                      <div style={{ width:"14px", height:"14px",
                        borderRadius:"50%", background:r.color_hex || "#6b7280",
                        flexShrink:0 }} />
                      <span style={{ fontSize:"16px" }}>{r.icono || "📁"}</span>
                    </div>
                  </td>
                  <td style={{ padding:"10px 14px", fontFamily:"monospace",
                    color:"#818cf8", fontWeight:"600" }}>
                    {r.codigo}
                  </td>
                  <td style={{ padding:"10px 14px", color:"white",
                    fontWeight:"500" }}>
                    {r.nombre}
                  </td>
                  <td style={{ padding:"10px 14px", color:"#6b7280",
                    textAlign:"center" }}>
                    {r.orden}
                  </td>
                  <td style={{ padding:"10px 14px", textAlign:"right" }}>
                    <div style={{ display:"flex", gap:"4px",
                      justifyContent:"flex-end" }}>
                      <button style={E.btnAma}
                        onClick={() => {
                          setEditando(r);
                          setForm(false);
                          window.scrollTo({ top:0, behavior:"smooth" });
                        }}>✏️</button>
                      {esAdmin && (
                        <button style={E.btnRojo}
                          onClick={() => eliminar(r)}>✕</button>
                      )}
                    </div>
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