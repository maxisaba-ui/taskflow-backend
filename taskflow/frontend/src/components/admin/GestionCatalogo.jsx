/**
 * =============================================================
 * Archivo: GestionCatalogo.jsx
 * Versión: v1.0.1
 * -------------------------------------------------------------
 * DESCRIPCION FUNCIONAL:
 *   Extensión de GestionCatalogo: cuando una tarea está marcada
 *   como compleja, muestra un botón "📋 Etapas" que expande el
 *   panel de gestión de la plantilla de etapas.
 *   Este archivo es un REEMPLAZO de GestionCatalogo.jsx.
 *   Agrega el sub-componente PanelEtapasCompleja debajo de la
 *   tabla de tareas del catálogo.
 * =============================================================
 */
/* ---- INSTRUCCION: reemplazar src/components/admin/GestionCatalogo.jsx
        con este archivo ---- */

import { useContext, useState, useEffect } from "react";
import { AuthContext } from "../../context/AuthContext.jsx";
import { api } from "../../api/client.js";

const E = {
  input:    { background:"#111827", border:"1px solid #374151", color:"white", padding:"8px 10px", borderRadius:"6px", fontSize:"13px", boxSizing:"border-box", width:"100%" },
  label:    { color:"#9ca3af", fontSize:"12px", display:"block", marginBottom:"4px" },
  btn:      { background:"#6366f1", color:"white", border:"none", padding:"8px 16px", borderRadius:"6px", cursor:"pointer", fontSize:"13px", fontWeight:"500" },
  btnGris:  { background:"#374151", color:"white", border:"none", padding:"8px 16px", borderRadius:"6px", cursor:"pointer", fontSize:"13px" },
  btnRojo:  { background:"#ef4444", color:"white", border:"none", padding:"4px 8px", borderRadius:"4px", cursor:"pointer", fontSize:"12px" },
  btnAma:   { background:"#d97706", color:"white", border:"none", padding:"4px 8px", borderRadius:"4px", cursor:"pointer", fontSize:"12px" },
  btnViol:  { background:"#7c3aed", color:"white", border:"none", padding:"4px 10px", borderRadius:"4px", cursor:"pointer", fontSize:"12px" },
  select:   { background:"#111827", border:"1px solid #374151", color:"white", padding:"8px 10px", borderRadius:"6px", fontSize:"13px", width:"100%" },
  badge:    { fontSize:"10px", padding:"2px 7px", borderRadius:"10px", fontWeight:"600", display:"inline-block" },
};

/* ── Formulario de tarea del catálogo ──────────────────────── */
function FormTareaCatalogo({ inicial, rubros, onGuardar, onCancelar, titulo }) {
  const [f, setF] = useState({
    codigo:                    inicial?.codigo                    || "",
    nombre:                    inicial?.nombre                    || "",
    descripcion:               inicial?.descripcion               || "",
    rubro_id:                  inicial?.rubro_id                  || "",
    duracion_estimada_minutos: inicial?.duracion_estimada_minutos || "",
    requiere_cliente:          inicial?.requiere_cliente !== undefined ? inicial.requiere_cliente : true,
    es_compleja:               inicial?.es_compleja               || false,
    // prioridad_default: campo del catálogo para herencia al crear tareas
    prioridad_default:         inicial?.prioridad_default         || "media",
    // sla_horas_default: se convierte a null si vacío para evitar 422
    sla_horas_default:         inicial?.sla_horas_default         || "",
  });
  const [err, setErr] = useState("");

  function guardar() {
    setErr("");
    if (!f.codigo.trim()) { setErr("El código es obligatorio"); return; }
    if (!f.nombre.trim()) { setErr("El nombre es obligatorio"); return; }
    if (!f.rubro_id)      { setErr("Seleccioná un rubro"); return; }
    onGuardar({
      ...f,
      codigo: f.codigo.trim().toUpperCase(),
      // Convertir strings vacíos a null para que Pydantic no rechace con 422
      duracion_estimada_minutos: f.duracion_estimada_minutos ? parseInt(f.duracion_estimada_minutos) : null,
      sla_horas_default:         f.sla_horas_default         ? parseInt(f.sla_horas_default)         : null,
    });
  }

  return (
    <div style={{ background:"#1f2937", borderRadius:"8px", padding:"18px",
      border:"1px solid #6366f1", marginBottom:"16px" }}>
      <h3 style={{ margin:"0 0 14px", fontSize:"14px", color:"white" }}>
        {titulo || (inicial ? "✏️ Editar tarea" : "Nueva tarea del catálogo")}
      </h3>
      <div style={{ display:"grid", gridTemplateColumns:"150px 1fr", gap:"10px", marginBottom:"10px" }}>
        <div>
          <label style={E.label}>Código * (mayúsculas)</label>
          <input style={E.input} value={f.codigo}
            onChange={e => setF({...f, codigo: e.target.value.toUpperCase()})}
            placeholder="T001" maxLength={10} />
        </div>
        <div>
          <label style={E.label}>Nombre *</label>
          <input style={E.input} value={f.nombre}
            onChange={e => setF({...f, nombre: e.target.value})}
            placeholder="Nombre de la tarea" />
        </div>
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 140px", gap:"10px", marginBottom:"10px" }}>
        <div>
          <label style={E.label}>Rubro *</label>
          <select style={E.select} value={f.rubro_id}
            onChange={e => setF({...f, rubro_id: e.target.value})}>
            <option value="">— Seleccionar rubro —</option>
            {rubros.map(r => <option key={r.id} value={r.id}>{r.nombre}</option>)}
          </select>
        </div>
        <div>
          <label style={E.label}>Duración (min)</label>
          <input style={E.input} type="number" min="1"
            value={f.duracion_estimada_minutos}
            onChange={e => setF({...f, duracion_estimada_minutos: e.target.value})}
            placeholder="30" />
        </div>
      </div>
      <div style={{ marginBottom:"10px" }}>
        <label style={E.label}>Descripción (opcional)</label>
        <textarea style={{ ...E.input, height:"56px", resize:"vertical" }}
          value={f.descripcion}
          onChange={e => setF({...f, descripcion: e.target.value})} />
      </div>
      <div style={{ display:"flex", gap:"20px", marginBottom:"14px", flexWrap:"wrap" }}>
        <label style={{ display:"flex", alignItems:"center", gap:"8px",
          color:"#9ca3af", fontSize:"12px", cursor:"pointer" }}>
          <input type="checkbox" checked={f.requiere_cliente}
            onChange={e => setF({...f, requiere_cliente: e.target.checked})} />
          Requiere cliente asignado
        </label>
        <label style={{ display:"flex", alignItems:"center", gap:"8px",
          color:"#c4b5fd", fontSize:"12px", cursor:"pointer" }}>
          <input type="checkbox" checked={f.es_compleja}
            onChange={e => setF({...f, es_compleja: e.target.checked})} />
          🔀 Tarea compleja (con etapas)
        </label>
        {/* Prioridad default: se hereda al asignar desde sugerencias */}
        <div style={{ display:"flex", alignItems:"center", gap:"8px" }}>
          <label style={{ color:"#9ca3af", fontSize:"12px", whiteSpace:"nowrap" }}>
            🎯 Prioridad default:
          </label>
          <select style={{ ...E.select, width:"110px" }}
            value={f.prioridad_default}
            onChange={e => setF({...f, prioridad_default: e.target.value})}>
            <option value="urgente">🔴 Urgente</option>
            <option value="alta">🟠 Alta</option>
            <option value="media">🟡 Media</option>
            <option value="baja">🟢 Baja</option>
          </select>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:"8px" }}>
          <label style={{ color:"#9ca3af", fontSize:"12px", whiteSpace:"nowrap" }}>
            ⏰ SLA default (hs hábiles):
          </label>
          <input type="number" min="1" style={{ ...E.input, width:"90px" }}
            value={f.sla_horas_default || ""}
            onChange={e => setF({...f, sla_horas_default: e.target.value})}
            placeholder="24" />
        </div>
      </div>
      {err && (
        <div style={{ color:"#fca5a5", background:"#7f1d1d", padding:"7px 12px",
          borderRadius:"6px", fontSize:"12px", marginBottom:"12px" }}>
          ⚠️ {err}
        </div>
      )}
      <div style={{ display:"flex", gap:"8px" }}>
        <button style={E.btn} onClick={guardar}>
          {inicial ? "💾 Guardar cambios" : "✅ Agregar tarea"}
        </button>
        <button style={E.btnGris} onClick={onCancelar}>Cancelar</button>
      </div>
    </div>
  );
}

/* ── Panel de etapas de una tarea compleja ─────────────────── */
function PanelEtapasCompleja({ catalogoTareaId, tituloTarea, usuarios }) {
  const [etapas, setEtapas]       = useState([]);
  const [mostrarForm, setForm]    = useState(false);
  const [editando, setEditando]   = useState(null);
  const [msg, setMsg]             = useState({ texto:"", tipo:"" });

  const vacio = {
    orden: (etapas.length + 1),
    nombre: "",
    descripcion: "",
    responsable_tipo: "operador_asignado",
    usuario_especifico_id: null,
    requiere_validacion_supervisor: false,
    sla_validacion_horas: "",
  };
  const [f, setF] = useState(vacio);

  useEffect(() => { cargar(); }, [catalogoTareaId]);

  async function cargar() {
    try {
      const data = await api.get(`/tareas-complejas/catalogo/${catalogoTareaId}/etapas`);
      setEtapas(data || []);
    } catch {}
  }

  async function guardar() {
    if (!f.nombre.trim()) { setMsg({ texto:"El nombre del paso es obligatorio", tipo:"error" }); return; }
    const payload = {
      ...f,
      sla_validacion_horas: f.sla_validacion_horas ? parseInt(f.sla_validacion_horas) : null,
      orden: parseInt(f.orden),
    };
    try {
      if (editando) {
        await api.put(`/tareas-complejas/catalogo/etapas/${editando.id}`, payload);
        setMsg({ texto:"✅ Paso actualizado", tipo:"ok" });
        setEditando(null);
      } else {
        await api.post(`/tareas-complejas/catalogo/${catalogoTareaId}/etapas`, payload);
        setMsg({ texto:"✅ Paso agregado", tipo:"ok" });
        setForm(false);
      }
      setF({ ...vacio, orden: etapas.length + 2 });
      cargar();
    } catch(e) {
      setMsg({ texto:"❌ " + e.message, tipo:"error" });
    }
  }

  async function eliminar(etapaId) {
    if (!confirm("¿Eliminar este paso?")) return;
    try {
      await api.delete(`/tareas-complejas/catalogo/etapas/${etapaId}`);
      cargar();
    } catch(e) { setMsg({ texto:"❌ " + e.message, tipo:"error" }); }
  }

  const RESP_TIPOS = [
    { value:"operador_asignado", label:"El mismo operador de la tarea" },
    { value:"supervisor",        label:"Su supervisor" },
    { value:"usuario_especifico",label:"Un usuario específico" },
  ];

  return (
    <div style={{ background:"#0f172a", borderRadius:"8px", padding:"14px",
      border:"1px solid #7c3aed", marginTop:"8px" }}>
      <div style={{ display:"flex", justifyContent:"space-between",
        alignItems:"center", marginBottom:"12px" }}>
        <div>
          <div style={{ fontSize:"12px", fontWeight:"700", color:"#c4b5fd",
            letterSpacing:"0.06em" }}>
            🔀 ETAPAS DE: {tituloTarea}
          </div>
          <div style={{ fontSize:"11px", color:"#6b7280", marginTop:"2px" }}>
            {etapas.length} paso{etapas.length !== 1 ? "s" : ""} definido{etapas.length !== 1 ? "s" : ""}
          </div>
        </div>
        <button style={{ ...E.btn, background:"#7c3aed", fontSize:"12px", padding:"5px 10px" }}
          onClick={() => { setForm(!mostrarForm); setEditando(null);
            setF({ ...vacio, orden: etapas.length + 1 }); }}>
          {mostrarForm ? "✕ Cancelar" : "+ Agregar paso"}
        </button>
      </div>

      {msg.texto && (
        <div style={{
          background: msg.tipo === "ok" ? "#064e3b" : "#7f1d1d",
          color: msg.tipo === "ok" ? "#10b981" : "#fca5a5",
          padding:"6px 10px", borderRadius:"6px", fontSize:"12px",
          marginBottom:"10px", display:"flex", justifyContent:"space-between" }}>
          <span>{msg.texto}</span>
          <button onClick={() => setMsg({ texto:"", tipo:"" })}
            style={{ background:"none", border:"none", color:"inherit", cursor:"pointer" }}>✕</button>
        </div>
      )}

      {/* Formulario de alta/edición */}
      {(mostrarForm || editando) && (
        <div style={{ background:"#1a1a2e", borderRadius:"6px", padding:"12px",
          marginBottom:"12px", border:"1px solid #4c1d95" }}>
          <div style={{ display:"grid", gridTemplateColumns:"60px 1fr", gap:"8px", marginBottom:"8px" }}>
            <div>
              <label style={E.label}>Orden</label>
              <input style={E.input} type="number" min="1" value={f.orden}
                onChange={e => setF({...f, orden: e.target.value})} />
            </div>
            <div>
              <label style={E.label}>Nombre del paso *</label>
              <input style={E.input} value={f.nombre}
                onChange={e => setF({...f, nombre: e.target.value})}
                placeholder="Ej: Preparar documentación" />
            </div>
          </div>
          <div style={{ marginBottom:"8px" }}>
            <label style={E.label}>Descripción (opcional)</label>
            <input style={E.input} value={f.descripcion || ""}
              onChange={e => setF({...f, descripcion: e.target.value})}
              placeholder="Detalle del paso" />
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"8px", marginBottom:"8px" }}>
            <div>
              <label style={E.label}>Responsable del paso</label>
              <select style={E.select} value={f.responsable_tipo}
                onChange={e => setF({...f, responsable_tipo: e.target.value,
                  usuario_especifico_id: null})}>
                {RESP_TIPOS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </div>
            {f.responsable_tipo === "usuario_especifico" && (
              <div>
                <label style={E.label}>Usuario específico</label>
                <select style={E.select} value={f.usuario_especifico_id || ""}
                  onChange={e => setF({...f, usuario_especifico_id: e.target.value})}>
                  <option value="">— Seleccionar —</option>
                  {usuarios.map(u => (
                    <option key={u.id} value={u.id}>{u.nombre} {u.apellido}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
          <div style={{ display:"flex", gap:"16px", alignItems:"center", marginBottom:"10px" }}>
            <label style={{ display:"flex", alignItems:"center", gap:"8px",
              color:"#c4b5fd", fontSize:"12px", cursor:"pointer" }}>
              <input type="checkbox" checked={f.requiere_validacion_supervisor}
                onChange={e => setF({...f, requiere_validacion_supervisor: e.target.checked})} />
              Requiere validación del supervisor al completar
            </label>
            {f.requiere_validacion_supervisor && (
              <div style={{ display:"flex", alignItems:"center", gap:"8px" }}>
                <label style={{ ...E.label, margin:0, whiteSpace:"nowrap" }}>SLA (horas):</label>
                <input style={{ ...E.input, width:"70px" }} type="number" min="1"
                  value={f.sla_validacion_horas || ""}
                  onChange={e => setF({...f, sla_validacion_horas: e.target.value})}
                  placeholder="24" />
              </div>
            )}
          </div>
          <div style={{ display:"flex", gap:"8px" }}>
            <button style={{ ...E.btn, background:"#7c3aed", fontSize:"12px" }}
              onClick={guardar}>
              {editando ? "💾 Guardar" : "✅ Agregar"}
            </button>
            <button style={E.btnGris} onClick={() => { setForm(false); setEditando(null); }}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Lista de etapas */}
      {etapas.length === 0 ? (
        <div style={{ color:"#6b7280", fontSize:"12px", textAlign:"center", padding:"16px" }}>
          No hay pasos definidos. Agregá el primer paso.
        </div>
      ) : (
        etapas.map((et, i) => (
          <div key={et.id} style={{ background:"#1e1b4b", borderRadius:"6px",
            padding:"10px 12px", marginBottom:"6px",
            border:"1px solid #4c1d95" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
              <div style={{ flex:1 }}>
                <div style={{ display:"flex", alignItems:"center", gap:"8px", marginBottom:"3px" }}>
                  <span style={{ background:"#7c3aed", color:"white", fontSize:"10px",
                    padding:"1px 6px", borderRadius:"8px", fontWeight:"700" }}>
                    {et.orden}
                  </span>
                  <span style={{ fontWeight:"600", fontSize:"12px", color:"white" }}>
                    {et.nombre}
                  </span>
                </div>
                {et.descripcion && (
                  <div style={{ fontSize:"11px", color:"#9ca3af", marginBottom:"3px" }}>
                    {et.descripcion}
                  </div>
                )}
                <div style={{ display:"flex", gap:"6px", flexWrap:"wrap" }}>
                  <span style={{ ...E.badge, background:"#1e3a5f",
                    color:"#93c5fd", border:"1px solid #2563eb" }}>
                    👤 {RESP_TIPOS.find(r => r.value === et.responsable_tipo)?.label || et.responsable_tipo}
                  </span>
                  {et.usuario_especifico_nombre && (
                    <span style={{ ...E.badge, background:"#064e3b",
                      color:"#6ee7b7", border:"1px solid #059669" }}>
                      {et.usuario_especifico_nombre}
                    </span>
                  )}
                  {et.requiere_validacion_supervisor && (
                    <span style={{ ...E.badge, background:"#3b1d8a",
                      color:"#c4b5fd", border:"1px solid #7c3aed" }}>
                      🔐 validación {et.sla_validacion_horas ? `${et.sla_validacion_horas}h` : ""}
                    </span>
                  )}
                </div>
              </div>
              <div style={{ display:"flex", gap:"4px", marginLeft:"8px" }}>
                <button style={E.btnAma} onClick={() => {
                  setEditando(et);
                  setF({
                    orden:                         et.orden,
                    nombre:                        et.nombre,
                    descripcion:                   et.descripcion || "",
                    responsable_tipo:              et.responsable_tipo,
                    usuario_especifico_id:         et.usuario_especifico_id,
                    requiere_validacion_supervisor:et.requiere_validacion_supervisor,
                    sla_validacion_horas:          et.sla_validacion_horas || "",
                  });
                  setForm(false);
                }}>✏️</button>
                <button style={E.btnRojo} onClick={() => eliminar(et.id)}>✕</button>
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  );
}

/* =============================================================
   COMPONENTE PRINCIPAL: GestionCatalogo
   ============================================================= */
export default function GestionCatalogo() {
  const { usuario } = useContext(AuthContext);
  const esOperador = usuario?.perfiles?.includes("operador") &&
    !usuario?.perfiles?.includes("supervisor") &&
    !usuario?.perfiles?.includes("administrador") &&
    !usuario?.perfiles?.includes("dueno");
  const [tareas, setTareas]               = useState([]);
  const [rubros, setRubros]               = useState([]);
  const [usuarios, setUsuarios]           = useState([]);
  const [mostrarForm, setMostrarForm]     = useState(false);
  const [tareaEditando, setTareaEditando] = useState(null);
  const [busqueda, setBusqueda]           = useState("");
  const [rubroFiltro, setRubroFiltro]     = useState("");
  const [panelEtapas, setPanelEtapas]     = useState(null); /* { id, nombre } */
  const [msg, setMsg]                     = useState({ texto:"", tipo:"" });

  useEffect(() => { cargarTodo(); }, []);

  async function cargarTodo() {
    try {
      const [cat, rubs, usrs] = await Promise.all([
        api.get("/parametros/catalogo"),
        api.get("/parametros/rubros"),
        api.get("/usuarios/"),
      ]);
      setTareas(cat  || []);
      setRubros(rubs || []);
      setUsuarios(usrs || []);
    } catch(e) {
      setMsg({ texto:"❌ Error al cargar: " + e.message, tipo:"error" });
    }
  }

  async function crearTarea(datos) {
    try {
      await api.post("/parametros/catalogo", datos);
      setMsg({ texto:"✅ Tarea agregada al catálogo", tipo:"ok" });
      setMostrarForm(false);
      cargarTodo();
    } catch(e) { setMsg({ texto:"❌ " + e.message, tipo:"error" }); }
  }

  async function editarTarea(datos) {
    try {
      await api.put(`/parametros/catalogo/${tareaEditando.id}`, datos);
      setMsg({ texto:"✅ Tarea actualizada", tipo:"ok" });
      setTareaEditando(null);
      cargarTodo();
    } catch(e) { setMsg({ texto:"❌ " + e.message, tipo:"error" }); }
  }

  async function desactivarTarea(t) {
    if (!confirm(`¿Desactivar la tarea "${t.nombre}" [${t.codigo}]?`)) return;
    try {
      await api.delete(`/parametros/catalogo/${t.id}`);
      setMsg({ texto:"✅ Tarea desactivada", tipo:"ok" });
      cargarTodo();
    } catch(e) { setMsg({ texto:"❌ " + e.message, tipo:"error" }); }
  }

  const tareasFiltradas = tareas.filter(t => {
    const textOk  = !busqueda    || [t.codigo, t.nombre].some(s => s?.toLowerCase().includes(busqueda.toLowerCase()));
    const rubroOk = !rubroFiltro || t.rubro_id === rubroFiltro;
    return textOk && rubroOk;
  });

  const porRubro = tareasFiltradas.reduce((acc, t) => {
    const r = t.rubro || "Sin rubro";
    if (!acc[r]) acc[r] = [];
    acc[r].push(t);
    return acc;
  }, {});

  return (
    <div style={{ color:"white" }}>
      <p style={{ color:"#9ca3af", fontSize:"13px", marginBottom:"16px" }}>
        Catálogo de tareas predefinidas. Las marcadas como <strong>🔀 complejas</strong> permiten definir etapas de seguimiento.
      </p>

      <div style={{ display:"flex", justifyContent:"space-between",
        alignItems:"center", marginBottom:"14px", gap:"12px", flexWrap:"wrap" }}>
        <div style={{ display:"flex", gap:"10px", alignItems:"center", flex:1 }}>
          <input style={{ ...E.input, maxWidth:"260px" }}
            value={busqueda} onChange={e => setBusqueda(e.target.value)}
            placeholder="🔍 Código o nombre..." />
          <select style={{ ...E.select, maxWidth:"180px" }}
            value={rubroFiltro} onChange={e => setRubroFiltro(e.target.value)}>
            <option value="">Todos los rubros</option>
            {rubros.map(r => <option key={r.id} value={r.id}>{r.nombre}</option>)}
          </select>
        </div>
        <div style={{ display:"flex", gap:"8px", alignItems:"center" }}>
          <span style={{ color:"#6b7280", fontSize:"12px" }}>
            {tareasFiltradas.length} tareas
          </span>
          <button style={E.btn} onClick={() => {
            setMostrarForm(!mostrarForm); setTareaEditando(null);
            setMsg({ texto:"", tipo:"" });
          }}>
            {mostrarForm ? "✕ Cancelar" : "+ Nueva tarea"}
          </button>
        </div>
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
            style={{ background:"none", border:"none", color:"inherit", cursor:"pointer" }}>✕</button>
        </div>
      )}

      {mostrarForm && (
        <FormTareaCatalogo inicial={null} rubros={rubros}
          onGuardar={crearTarea} onCancelar={() => setMostrarForm(false)} />
      )}
      {tareaEditando && (
        <FormTareaCatalogo inicial={tareaEditando} rubros={rubros}
          onGuardar={editarTarea} onCancelar={() => setTareaEditando(null)}
          titulo={`✏️ Editando: [${tareaEditando.codigo}] ${tareaEditando.nombre}`} />
      )}

      {/* Panel de etapas expandible */}
      {panelEtapas && (
        <PanelEtapasCompleja
          catalogoTareaId={panelEtapas.id}
          tituloTarea={panelEtapas.nombre}
          usuarios={usuarios}
        />
      )}

      {Object.keys(porRubro).length === 0 ? (
        <div style={{ textAlign:"center", padding:"40px", color:"#6b7280" }}>
          {busqueda || rubroFiltro ? "Sin resultados" : "No hay tareas en el catálogo"}
        </div>
      ) : (
        Object.entries(porRubro).map(([rubro, lista]) => (
          <div key={rubro} style={{ marginBottom:"20px" }}>
            <div style={{ fontSize:"11px", fontWeight:"700", color:"#9ca3af",
              letterSpacing:"0.08em", textTransform:"uppercase",
              marginBottom:"8px", display:"flex", alignItems:"center", gap:"8px" }}>
              <span>📁 {rubro}</span>
              <span style={{ ...E.badge, background:"#1f2937",
                color:"#6b7280", border:"1px solid #374151" }}>{lista.length}</span>
            </div>
            <div style={{ background:"#111827", borderRadius:"8px",
              border:"1px solid #1f2937", overflow:"hidden" }}>
              <table style={{ width:"100%", borderCollapse:"collapse", fontSize:"13px" }}>
                <thead>
                  <tr style={{ background:"#1a2235", color:"#9ca3af" }}>
                    <th style={{ textAlign:"left", padding:"9px 14px", fontWeight:"600", width:"90px" }}>Código</th>
                    <th style={{ textAlign:"left", padding:"9px 14px", fontWeight:"600" }}>Nombre</th>
                    <th style={{ textAlign:"left", padding:"9px 14px", fontWeight:"600", width:"90px" }}>Duración</th>
                    <th style={{ textAlign:"left", padding:"9px 14px", fontWeight:"600", width:"140px" }}>Atributos</th>
                    <th style={{ padding:"9px 14px", width:"120px" }}></th>
                  </tr>
                </thead>
                <tbody>
                  {lista.map(t => (
                    <tr key={t.id} style={{ borderTop:"1px solid #1f2937",
                      background: panelEtapas?.id === t.id ? "#1e1b4b" :
                                  tareaEditando?.id === t.id ? "#1e1b4b" : "transparent" }}>
                      <td style={{ padding:"10px 14px", fontFamily:"monospace",
                        fontSize:"12px", color:"#818cf8", fontWeight:"600" }}>
                        {t.codigo}
                      </td>
                      <td style={{ padding:"10px 14px", color:"white" }}>
                        {t.nombre}
                        {t.descripcion && (
                          <span title={t.descripcion}
                            style={{ marginLeft:"6px", color:"#6b7280", cursor:"help" }}>📝</span>
                        )}
                      </td>
                      <td style={{ padding:"10px 14px", color:"#9ca3af" }}>
                        {t.duracion_estimada_minutos ? `${t.duracion_estimada_minutos} min` : "—"}
                      </td>
                      <td style={{ padding:"10px 14px" }}>
                        <div style={{ display:"flex", gap:"4px", flexWrap:"wrap" }}>
                          {t.requiere_cliente && (
                            <span style={{ ...E.badge, background:"#1e3a5f",
                              color:"#93c5fd", border:"1px solid #2563eb" }}>
                              👤 cliente
                            </span>
                          )}
                          {t.es_compleja && (
                            <span style={{ ...E.badge, background:"#3b1d8a",
                              color:"#c4b5fd", border:"1px solid #7c3aed" }}>
                              🔀 compleja
                            </span>
                          )}
                        </div>
                      </td>
                      <td style={{ padding:"10px 14px", textAlign:"right" }}>
                        <div style={{ display:"flex", gap:"4px", justifyContent:"flex-end" }}>
                          {/* Botón de etapas — solo para tareas complejas */}
                          {t.es_compleja && (
                            <button style={E.btnViol}
                              onClick={() => setPanelEtapas(
                                panelEtapas?.id === t.id ? null : { id: t.id, nombre: t.nombre }
                              )}
                              title="Gestionar etapas">
                              {panelEtapas?.id === t.id ? "✕" : "📋"}
                            </button>
                          )}
                          <button style={E.btnAma} onClick={() => {
                            setTareaEditando(t); setMostrarForm(false);
                            setPanelEtapas(null);
                            setMsg({ texto:"", tipo:"" });
                            window.scrollTo({ top:0, behavior:"smooth" });
                          }}>✏️</button>
                          <button style={E.btnRojo}
                            onClick={() => desactivarTarea(t)}>✕</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))
      )}
    </div>
  );
}