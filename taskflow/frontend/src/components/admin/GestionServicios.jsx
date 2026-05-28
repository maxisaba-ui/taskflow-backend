/**
 * =============================================================
 * Archivo: GestionServicios.jsx
 * Versión: v1.1.0
 * -------------------------------------------------------------
 * DESCRIPCIÓN FUNCIONAL:
 *   Pantalla de administración de servicios del estudio contable.
 *   Permite crear, editar servicios (simples y anidados), agregar
 *   tareas con parametría de calendarización, editar y quitar tareas.
 *   v1.1.0: agrega selector de meses para recurrencia anual por meses.
 *   Cuando se selecciona un servicio padre, el panel derecho muestra
 *   primero una sección de "Sub-servicios" (hijos directos) con sus
 *   datos resumidos y navegación directa, y luego las tareas propias.
 *
 * DESCRIPCIÓN TÉCNICA:
 *   Componente React funcional con hooks. Usa el cliente HTTP
 *   centralizado (api). Incluye BuscadorDesplegable con búsqueda
 *   en tiempo real para listas largas. Los sub-servicios se cargan
 *   en paralelo con las tareas al seleccionar un servicio.
 *   La lista izquierda tiene la misma estética de badges y colores
 *   que el panel derecho para consistencia visual.
 * =============================================================
 */
import { useContext, useState, useEffect, useRef } from "react";
import { AuthContext } from "../../context/AuthContext.jsx";
import { api } from "../../api/client.js";

/* ── Constantes de calendarización ─────────────────────────── */

/** Tipos de calendarización posibles para una tarea en un servicio */
const TIPOS_CAL = [
  { value: "excepcional", label: "⚡ Excepcional (evento del cliente)" },
  { value: "manual",      label: "✋ Manual (se carga en el momento)" },
  { value: "automatica",  label: "📅 Automática (regla de fecha)" },
];

/** Reglas de fecha para calendarización automática */
const REGLAS = [
  { value: "fecha_fija_mes",       label: "Día fijo del mes (ej: día 10)" },
  { value: "dia_habil_n",          label: "Día hábil N del mes (ej: 5° día hábil)" },
  { value: "dias_habiles_despues", label: "N días hábiles después de una fecha" },
  { value: "dias_habiles_antes",   label: "N días hábiles antes de una fecha" },
  { value: "libre_mes",            label: "Libre en el mes" },
  { value: "libre_1ra_quincena",   label: "Libre 1° quincena" },
  { value: "libre_2da_quincena",   label: "Libre 2° quincena" },
  { value: "libre_semana_1",       label: "Libre semana 1" },
  { value: "libre_semana_2",       label: "Libre semana 2" },
  { value: "libre_semana_3",       label: "Libre semana 3" },
  { value: "libre_semana_4",       label: "Libre semana 4" },
];

/** Tipos de fecha de referencia para reglas antes/después */
const REFS = [
  { value: "dia_corrido", label: "Día corrido del mes (ej: día 20)" },
  { value: "dia_habil",   label: "Día hábil del mes (ej: 5° día hábil)" },
  { value: "ultimo_dia",  label: "Último día del mes" },
  { value: "primer_dia",  label: "Primer día hábil del mes" },
];

/** Reglas que requieren ingresar el valor N */
const CON_N   = ["fecha_fija_mes","dia_habil_n","dias_habiles_despues","dias_habiles_antes"];
/** Reglas que requieren definir una fecha de referencia */
const CON_REF = ["dias_habiles_despues","dias_habiles_antes"];
/** Referencias que requieren un valor numérico adicional */
const REF_CON_VAL = ["dia_corrido","dia_habil"];

/** Nombres de meses en español para el selector de recurrencia anual */
const MESES = [
  "Enero","Febrero","Marzo","Abril","Mayo","Junio",
  "Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre",
];

/* ── Paleta de colores para rubros ──────────────────────────── */
const COLORES_RUBRO = {
  impuestos:    "#7c3aed",
  contabilidad: "#0369a1",
  auditoria:    "#b45309",
  sueldos:      "#065f46",
  sindicatos:   "#9f1239",
  general:      "#374151",
};

/* ── Estilos base reutilizables ─────────────────────────────── */
const E = {
  card:     { background:"#1f2937", borderRadius:"8px", padding:"14px", marginBottom:"10px", border:"1px solid #374151" },
  btn:      { background:"#6366f1", color:"white", border:"none", padding:"8px 16px", borderRadius:"6px", cursor:"pointer", fontSize:"13px" },
  btnRojo:  { background:"#ef4444", color:"white", border:"none", padding:"4px 8px", borderRadius:"4px", cursor:"pointer", fontSize:"12px" },
  btnGris:  { background:"#374151", color:"white", border:"none", padding:"8px 16px", borderRadius:"6px", cursor:"pointer", fontSize:"13px" },
  btnAma:   { background:"#d97706", color:"white", border:"none", padding:"4px 8px", borderRadius:"4px", cursor:"pointer", fontSize:"12px" },
  btnVerde: { background:"#059669", color:"white", border:"none", padding:"4px 10px", borderRadius:"4px", cursor:"pointer", fontSize:"12px" },
  input:    { background:"#111827", border:"1px solid #374151", color:"white", padding:"8px", borderRadius:"6px", width:"100%", marginBottom:"8px", fontSize:"13px", boxSizing:"border-box" },
  label:    { color:"#9ca3af", fontSize:"12px", display:"block", marginBottom:"4px", marginTop:"8px" },
  select:   { background:"#111827", border:"1px solid #374151", color:"white", padding:"8px", borderRadius:"6px", width:"100%", marginBottom:"8px", fontSize:"13px" },
  badge:    { fontSize:"10px", padding:"2px 7px", borderRadius:"10px", fontWeight:"600", display:"inline-block" },
};

/**
 * DESCRIPCIÓN FUNCIONAL: Retorna el color de fondo para un badge de rubro.
 * DESCRIPCIÓN TÉCNICA: Busca en COLORES_RUBRO por nombre normalizado a minúsculas.
 */
function colorRubro(nombre) {
  if (!nombre) return COLORES_RUBRO.general;
  return COLORES_RUBRO[nombre.toLowerCase()] || COLORES_RUBRO.general;
}

/* =============================================================
   SUB-COMPONENTE: BuscadorDesplegable
   DESCRIPCIÓN FUNCIONAL:
     Desplegable con búsqueda en tiempo real para listas largas.
   DESCRIPCIÓN TÉCNICA:
     Filtra con String.includes() en minúsculas. Cierra al clic fuera
     via useRef + mousedown listener global.
   ============================================================= */
function BuscadorDesplegable({ opciones, valor, onChange, placeholder }) {
  const [busqueda, setBusqueda] = useState("");   /* Texto de filtro actual */
  const [abierto, setAbierto]   = useState(false); /* Estado del panel */
  const ref = useRef(null);                         /* Ref para detectar clic fuera */

  useEffect(() => {
    /* Registra listener global para cerrar al clic fuera del componente */
    function cerrar(e) {
      if (ref.current && !ref.current.contains(e.target)) {
        setAbierto(false);
        setBusqueda("");
      }
    }
    document.addEventListener("mousedown", cerrar);
    return () => document.removeEventListener("mousedown", cerrar); /* Cleanup al desmontar */
  }, []);

  /* Opciones filtradas por el texto de búsqueda */
  const filtradas = opciones.filter(o =>
    String(o.label).toLowerCase().includes(busqueda.toLowerCase())
  );

  /* Etiqueta de la opción seleccionada actualmente */
  const etiqueta = opciones.find(o => o.value === valor)?.label;

  return (
    <div ref={ref} style={{ position:"relative", marginBottom:"8px" }}>
      {/* Botón principal que abre/cierra el panel */}
      <div onClick={() => { setAbierto(!abierto); setBusqueda(""); }}
        style={{ background:"#111827", border:"1px solid #374151",
          color: etiqueta ? "white" : "#6b7280",
          padding:"8px 12px", borderRadius:"6px", cursor:"pointer",
          display:"flex", justifyContent:"space-between", fontSize:"13px" }}>
        <span style={{ overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
          {etiqueta || placeholder || "— Seleccionar —"}
        </span>
        <span style={{ color:"#6b7280", marginLeft:"8px" }}>{abierto ? "▲" : "▼"}</span>
      </div>

      {/* Panel desplegable: visible solo cuando abierto === true */}
      {abierto && (
        <div style={{ position:"absolute", top:"100%", left:0, right:0, background:"#1f2937",
          border:"1px solid #374151", borderRadius:"6px", zIndex:1000,
          maxHeight:"240px", overflowY:"auto", boxShadow:"0 8px 24px rgba(0,0,0,0.5)" }}>
          {/* Input de búsqueda fijo arriba */}
          <div style={{ padding:"8px", borderBottom:"1px solid #374151",
            position:"sticky", top:0, background:"#1f2937" }}>
            <input autoFocus value={busqueda} onChange={e => setBusqueda(e.target.value)}
              placeholder="Escribí para buscar..."
              style={{ background:"#111827", border:"1px solid #374151", color:"white",
                padding:"6px 10px", borderRadius:"4px", width:"100%",
                fontSize:"13px", boxSizing:"border-box" }} />
          </div>
          {/* Opción para deseleccionar */}
          <div onClick={() => { onChange(""); setAbierto(false); setBusqueda(""); }}
            style={{ padding:"8px 12px", color:"#6b7280", cursor:"pointer", fontSize:"13px" }}>
            — Ninguno —
          </div>
          {/* Sin resultados */}
          {filtradas.length === 0 && (
            <div style={{ padding:"8px 12px", color:"#6b7280", fontSize:"13px" }}>
              Sin resultados para "{busqueda}"
            </div>
          )}
          {/* Lista filtrada */}
          {filtradas.map(o => (
            <div key={o.value}
              onClick={() => { onChange(o.value); setAbierto(false); setBusqueda(""); }}
              style={{ padding:"8px 12px", cursor:"pointer", fontSize:"13px",
                background: o.value === valor ? "#312e81" : "transparent",
                color: o.value === valor ? "white" : "#d1d5db",
                borderBottom:"1px solid #374151" }}>
              {o.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* =============================================================
   SUB-COMPONENTE: FormTarea
   DESCRIPCIÓN FUNCIONAL:
     Formulario reutilizable para crear o editar una tarea dentro
     de un servicio. Creación: muestra selector de catálogo.
     Edición: muestra nombre fijo y permite cambiar parametría.
   DESCRIPCIÓN TÉCNICA:
     Estado local con validación en cascada según tipo_calendarizacion.
     Convierte strings a int antes de llamar a onGuardar.
   ============================================================= */
function FormTarea({ inicial, catalogo, modoEdicion, onGuardar, onCancelar }) {
  /* Estado del formulario inicializado con datos existentes o defaults */
  const [f, setF] = useState({
    catalogo_tarea_id:         inicial?.catalogo_tarea_id    || "",
    tipo_calendarizacion:      inicial?.tipo_calendarizacion || "excepcional",
    regla_tipo:                inicial?.regla_tipo            || "",
    regla_valor_n:             inicial?.regla_valor_n         || "",
    ref_tipo:                  inicial?.ref_tipo              || "",
    ref_valor:                 inicial?.ref_valor             || "",
    es_obligatoria:            inicial?.es_obligatoria !== undefined ? inicial.es_obligatoria : true,
    orden:                     inicial?.orden                 || 0,
    duracion_estimada_minutos: inicial?.duracion_estimada_minutos || 30,
    // meses_activos: array de números (1-12); vacío = todos los meses
    meses_activos: inicial?.meses_activos
      ? inicial.meses_activos.split(",").map(Number).filter(Boolean)
      : [],
  });
  const [err, setErr] = useState(""); /* Mensaje de error de validación */

  /**
   * DESCRIPCIÓN FUNCIONAL: Valida y envía el formulario al componente padre.
   * DESCRIPCIÓN TÉCNICA: Validaciones en cascada; convierte tipos antes de llamar onGuardar.
   */
  function guardar() {
    setErr("");
    if (!modoEdicion && !f.catalogo_tarea_id)                     { setErr("Seleccioná una tarea"); return; }
    if (f.tipo_calendarizacion === "automatica" && !f.regla_tipo) { setErr("Seleccioná una regla de fecha"); return; }
    if (CON_N.includes(f.regla_tipo) && !f.regla_valor_n)         { setErr("Ingresá el valor N"); return; }
    if (CON_REF.includes(f.regla_tipo) && !f.ref_tipo)            { setErr("Seleccioná el tipo de fecha de referencia"); return; }
    if (REF_CON_VAL.includes(f.ref_tipo) && !f.ref_valor)         { setErr("Ingresá el número de día de referencia"); return; }
    onGuardar({
      ...f,
      regla_valor_n:             f.regla_valor_n ? parseInt(f.regla_valor_n) : null,
      ref_valor:                 f.ref_valor ? parseInt(f.ref_valor) : null,
      orden:                     parseInt(f.orden) || 0,
      duracion_estimada_minutos: parseInt(f.duracion_estimada_minutos) || 30,
      // Convertir array a "1,3,6" o null si no se seleccionaron meses
      meses_activos: f.meses_activos.length > 0
        ? [...f.meses_activos].sort((a, b) => a - b).join(",")
        : null,
    });
  }

  return (
    <div>
      {/* Selector de tarea del catálogo: solo en modo creación */}
      {!modoEdicion && (
        <>
          <label style={E.label}>Tarea del catálogo *</label>
          <BuscadorDesplegable opciones={catalogo} valor={f.catalogo_tarea_id}
            onChange={v => setF({...f, catalogo_tarea_id: v})}
            placeholder="— Buscar tarea —" />
        </>
      )}
      {/* En edición: nombre de tarea como dato no editable */}
      {modoEdicion && (
        <div style={{ background:"#111827", padding:"8px 12px", borderRadius:"6px",
          marginBottom:"8px", fontSize:"13px", color:"#d1d5db" }}>
          📋 {inicial?.tarea_nombre}
        </div>
      )}

      {/* Tipo de calendarización */}
      <label style={E.label}>Tipo de calendarización</label>
      <select style={E.select} value={f.tipo_calendarizacion}
        onChange={e => setF({...f, tipo_calendarizacion: e.target.value,
          regla_tipo:"", regla_valor_n:"", ref_tipo:"", ref_valor:""})}>
        {TIPOS_CAL.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
      </select>

      {/* Campos de regla automática: solo cuando tipo = 'automatica' */}
      {f.tipo_calendarizacion === "automatica" && (
        <div style={{ background:"#111827", borderRadius:"6px", padding:"10px", marginBottom:"8px" }}>
          <label style={E.label}>Regla de fecha *</label>
          <select style={E.select} value={f.regla_tipo}
            onChange={e => setF({...f, regla_tipo: e.target.value, regla_valor_n:"", ref_tipo:"", ref_valor:""})}>
            <option value="">— Seleccionar —</option>
            {REGLAS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>

          {/* Campo N según la regla */}
          {CON_N.includes(f.regla_tipo) && (
            <>
              <label style={E.label}>
                {f.regla_tipo === "fecha_fija_mes"       && "Día del mes (ej: 10)"}
                {f.regla_tipo === "dia_habil_n"          && "N° día hábil del mes (ej: 5)"}
                {f.regla_tipo === "dias_habiles_despues" && "Cantidad de días hábiles después"}
                {f.regla_tipo === "dias_habiles_antes"   && "Cantidad de días hábiles antes"}
              </label>
              <input style={E.input} type="number" min="1" max="31"
                value={f.regla_valor_n}
                onChange={e => setF({...f, regla_valor_n: e.target.value})}
                placeholder="Ingresá N" />
            </>
          )}

          {/* Fecha de referencia para antes/después */}
          {CON_REF.includes(f.regla_tipo) && (
            <>
              <label style={E.label}>¿Antes/después de qué fecha?</label>
              <select style={E.select} value={f.ref_tipo}
                onChange={e => setF({...f, ref_tipo: e.target.value, ref_valor:""})}>
                <option value="">— Seleccionar —</option>
                {REFS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
              {REF_CON_VAL.includes(f.ref_tipo) && (
                <>
                  <label style={E.label}>
                    {f.ref_tipo === "dia_corrido" ? "Número de día corrido (ej: 20)" : "N° día hábil (ej: 5)"}
                  </label>
                  <input style={E.input} type="number" min="1" max="31"
                    value={f.ref_valor}
                    onChange={e => setF({...f, ref_valor: e.target.value})}
                    placeholder="Ej: 20" />
                </>
              )}
            </>
          )}
        </div>
      )}

      {/* Selector de meses: solo visible cuando tipo = 'automatica' */}
      {f.tipo_calendarizacion === "automatica" && (
        <div style={{ background:"#111827", borderRadius:"6px", padding:"10px", marginBottom:"8px" }}>
          <label style={{ ...E.label, marginBottom:"6px" }}>
            Limitar a meses del año (opcional)
          </label>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:"4px" }}>
            {MESES.map((nombre, i) => {
              const num = i + 1;
              const activo = f.meses_activos.includes(num);
              return (
                <label key={num} style={{
                  display:"flex", alignItems:"center", gap:"5px",
                  cursor:"pointer", fontSize:"12px",
                  color: activo ? "#6ee7b7" : "#9ca3af",
                  background: activo ? "#064e3b" : "transparent",
                  borderRadius:"4px", padding:"3px 6px",
                  border: `1px solid ${activo ? "#10b981" : "#374151"}`,
                }}>
                  <input type="checkbox" checked={activo}
                    onChange={() => {
                      const nuevos = activo
                        ? f.meses_activos.filter(m => m !== num)
                        : [...f.meses_activos, num];
                      setF({...f, meses_activos: nuevos});
                    }}
                    style={{ accentColor:"#10b981" }} />
                  {nombre}
                </label>
              );
            })}
          </div>
          {f.meses_activos.length === 0 && (
            <div style={{ fontSize:"11px", color:"#6b7280", marginTop:"6px" }}>
              Sin selección = se genera todos los meses
            </div>
          )}
          {f.meses_activos.length > 0 && (
            <div style={{ fontSize:"11px", color:"#10b981", marginTop:"6px" }}>
              Solo en: {f.meses_activos.sort((a,b)=>a-b).map(m => MESES[m-1]).join(", ")}
            </div>
          )}
        </div>
      )}

      {/* Orden y duración en dos columnas */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"8px" }}>
        <div>
          <label style={E.label}>Orden</label>
          <input style={E.input} type="number" min="0"
            value={f.orden} onChange={e => setF({...f, orden: e.target.value})} />
        </div>
        <div>
          <label style={E.label}>Duración estimada (min)</label>
          <input style={E.input} type="number" min="1"
            value={f.duracion_estimada_minutos}
            onChange={e => setF({...f, duracion_estimada_minutos: e.target.value})} />
        </div>
      </div>

      {/* Checkbox obligatoriedad */}
      <label style={{ color:"#9ca3af", fontSize:"12px", display:"flex",
        alignItems:"center", gap:"8px", cursor:"pointer", marginTop:"4px" }}>
        <input type="checkbox" checked={f.es_obligatoria}
          onChange={e => setF({...f, es_obligatoria: e.target.checked})} />
        Tarea obligatoria dentro del servicio
      </label>

      {/* Error de validación */}
      {err && (
        <div style={{ color:"#fca5a5", fontSize:"12px", marginTop:"8px",
          padding:"6px 10px", background:"#7f1d1d", borderRadius:"4px" }}>
          ⚠️ {err}
        </div>
      )}

      {/* Botones */}
      <div style={{ display:"flex", gap:"8px", marginTop:"12px" }}>
        <button style={E.btn} onClick={guardar}>
          {modoEdicion ? "💾 Guardar cambios" : "✅ Agregar"}
        </button>
        <button style={E.btnGris} onClick={onCancelar}>Cancelar</button>
      </div>
    </div>
  );
}

/* =============================================================
   SUB-COMPONENTE: TarjetaSubServicio
   DESCRIPCIÓN FUNCIONAL:
     Tarjeta azul del panel derecho que representa un sub-servicio hijo.
     Clicable para navegar directamente al sub-servicio.
   DESCRIPCIÓN TÉCNICA:
     Hover simulado con estado local. onNavegar recibe el objeto
     sub-servicio resumido; el padre busca el objeto completo.
   ============================================================= */
function TarjetaSubServicio({ sub, onNavegar }) {
  const [hover, setHover] = useState(false); /* Estado hover para efecto visual */

  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{ background: hover ? "#1e3a5f" : "#1a2e45",
        border:"1px solid #2563eb", borderRadius:"8px",
        padding:"12px 14px", marginBottom:"8px",
        cursor:"pointer", transition:"background 0.15s" }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
        <div style={{ flex:1 }}>
          {/* Nombre */}
          <div style={{ fontWeight:"600", fontSize:"13px", color:"#93c5fd",
            display:"flex", alignItems:"center", gap:"6px" }}>
            <span>📦</span>{sub.nombre}
          </div>
          {/* Código */}
          <div style={{ fontSize:"11px", color:"#60a5fa", marginTop:"3px", fontFamily:"monospace" }}>
            {sub.codigo}
          </div>
          {/* Descripción truncada */}
          {sub.descripcion && (
            <div style={{ fontSize:"11px", color:"#9ca3af", marginTop:"3px",
              overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", maxWidth:"280px" }}>
              {sub.descripcion}
            </div>
          )}
          {/* Badge de tareas */}
          <div style={{ marginTop:"6px" }}>
            <span style={{ ...E.badge, background:"#1e40af", color:"#bfdbfe" }}>
              📋 {sub.cantidad_tareas} tarea{sub.cantidad_tareas !== 1 ? "s" : ""}
            </span>
          </div>
        </div>
        {/* Botón navegar */}
        <button style={{ ...E.btnVerde, marginLeft:"10px", flexShrink:0 }}
          onClick={() => onNavegar(sub)} title="Ir a este sub-servicio">
          Ver →
        </button>
      </div>
    </div>
  );
}

/* =============================================================
   SUB-COMPONENTE: TarjetaServicio
   DESCRIPCIÓN FUNCIONAL:
     Tarjeta de la lista izquierda con la misma riqueza visual
     que el panel derecho: badges de tareas y sub-servicios,
     ícono de tipo (padre 🗂️ / hijo ↳ / simple 📄), botón editar.
   DESCRIPCIÓN TÉCNICA:
     Calcula cantHijos filtrando la lista de servicios local
     (sin llamada extra al backend). Resaltado con borde índigo
     cuando seleccionado === true.
   ============================================================= */
function TarjetaServicio({ s, seleccionado, servicios, onClick, onEditar }) {
  /* Cantidad de hijos directos: filtro local sobre la lista completa */
  const cantHijos = servicios.filter(x => x.servicio_padre_id === s.id).length;
  const esHijo    = !!s.servicio_padre_id; /* Es sub-servicio de otro */
  const esPadre   = cantHijos > 0;          /* Tiene al menos un hijo */

  return (
    <div onClick={onClick} style={{
      background:   seleccionado ? "#1e1b4b" : "#1f2937",
      borderRadius: "8px",
      padding:      "12px 14px",
      marginBottom: "8px",
      border:       `1px solid ${seleccionado ? "#6366f1" : "#374151"}`,
      cursor:       "pointer",
      transition:   "all 0.15s",
    }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
        <div style={{ flex:1, minWidth:0 }}>

          {/* Fila 1: ícono de tipo + nombre */}
          <div style={{ display:"flex", alignItems:"center", gap:"6px", marginBottom:"4px" }}>
            <span style={{ fontSize:"13px", flexShrink:0 }}>
              {esPadre ? "🗂️" : esHijo ? "↳" : "📄"}
            </span>
            <span style={{ fontWeight:"600", fontSize:"13px", color:"white",
              overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
              {s.nombre}
            </span>
          </div>

          {/* Fila 2: código + nombre del padre */}
          <div style={{ fontSize:"11px", color:"#6b7280", marginBottom:"6px",
            overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
            <span style={{ color:"#9ca3af", fontFamily:"monospace" }}>{s.codigo}</span>
            {s.servicio_padre_nombre && (
              <span style={{ color:"#818cf8", marginLeft:"8px" }}>
                ↳ {s.servicio_padre_nombre}
              </span>
            )}
          </div>

          {/* Fila 3: badges de tareas y sub-servicios */}
          <div style={{ display:"flex", gap:"5px", flexWrap:"wrap" }}>
            {/* Badge tareas propias */}
            <span style={{ ...E.badge,
              background: s.cantidad_tareas > 0 ? "#1e3a5f" : "#1f2937",
              color:       s.cantidad_tareas > 0 ? "#93c5fd" : "#4b5563",
              border:      `1px solid ${s.cantidad_tareas > 0 ? "#2563eb" : "#374151"}`,
            }}>
              📋 {s.cantidad_tareas} tarea{s.cantidad_tareas !== 1 ? "s" : ""}
            </span>
            {/* Badge sub-servicios (solo si tiene hijos) */}
            {cantHijos > 0 && (
              <span style={{ ...E.badge, background:"#1e3a2e", color:"#6ee7b7", border:"1px solid #059669" }}>
                📦 {cantHijos} sub{cantHijos !== 1 ? "s" : ""}
              </span>
            )}
          </div>
        </div>

        {/* Botón editar: stopPropagation para no seleccionar el servicio */}
        <button style={{ ...E.btnAma, marginLeft:"8px", flexShrink:0 }}
          onClick={onEditar} title="Editar servicio">✏️</button>
      </div>
    </div>
  );
}

/* =============================================================
   COMPONENTE PRINCIPAL: GestionServicios
   DESCRIPCIÓN FUNCIONAL:
     Panel de gestión con lista izquierda y detalle a la derecha.
     Sub-servicios y tareas se muestran en secciones separadas.
   DESCRIPCIÓN TÉCNICA:
     Promise.all() para carga paralela. Retry único a 700ms.
     Conteo de hijos calculado localmente sin endpoint extra.
   ============================================================= */
export default function GestionServicios() {
  const { usuario } = useContext(AuthContext);
  const esOperador = usuario?.perfiles?.includes("operador") &&
    !usuario?.perfiles?.includes("supervisor") &&
    !usuario?.perfiles?.includes("administrador") &&
    !usuario?.perfiles?.includes("dueno");
  const [servicios, setServicios]             = useState([]);
  const [catalogo, setCatalogo]               = useState([]);
  const [seleccionado, setSeleccionado]       = useState(null);
  const [tareas, setTareas]                   = useState([]);
  const [subServicios, setSubServicios]       = useState([]);
  const [cargando, setCargando]               = useState(true);
  const [msg, setMsg]                         = useState({ texto:"", tipo:"" });
  const [mostrarFormSvc, setMostrarFormSvc]   = useState(false);
  const [svcEditando, setSvcEditando]         = useState(null);
  const [mostrarAddTarea, setMostrarAddTarea] = useState(false);
  const [tareaEditando, setTareaEditando]     = useState(null);
  const [fSvc, setFSvc]                       = useState({ codigo:"", nombre:"", descripcion:"", servicio_padre_id:"" });
  const panelDerechoRef                       = useRef(null); /* Ref para scroll al navegar */

  useEffect(() => { cargarTodo(); }, []);

  /**
   * DESCRIPCIÓN FUNCIONAL: Carga servicios y catálogo en paralelo.
   * DESCRIPCIÓN TÉCNICA: Promise.all(). Catalogo se transforma a {value,label}.
   */
  async function cargarTodo() {
    setCargando(true);
    setMsg({ texto:"", tipo:"" });
    try {
      const [svcs, cat] = await Promise.all([
        api.get("/servicios/"),
        api.get("/parametros/catalogo"),
      ]);
      setServicios(svcs || []);
      setCatalogo((cat || []).map(t => ({ value: t.id, label: `[${t.codigo}] ${t.nombre}` })));
    } catch (e) {
      setMsg({ texto:"Error al cargar: " + e.message, tipo:"error" });
    }
    setCargando(false);
  }

  /**
   * DESCRIPCIÓN FUNCIONAL: Selecciona servicio y carga tareas + sub-servicios en paralelo.
   * DESCRIPCIÓN TÉCNICA: Promise.all(). Retry único a 700ms para errores transitorios.
   */
  async function seleccionar(s) {
    setSeleccionado(s);
    setMostrarAddTarea(false);
    setTareaEditando(null);
    setMsg({ texto:"", tipo:"" });
    setSubServicios([]);
    try {
      const [t, ss] = await Promise.all([
        api.get(`/servicios/${s.id}/tareas`),
        api.get(`/servicios/${s.id}/subservicios`),
      ]);
      setTareas(t || []);
      setSubServicios(ss || []);
    } catch {
      try {
        await new Promise(r => setTimeout(r, 700));
        const [t, ss] = await Promise.all([
          api.get(`/servicios/${s.id}/tareas`),
          api.get(`/servicios/${s.id}/subservicios`),
        ]);
        setTareas(t || []);
        setSubServicios(ss || []);
      } catch (e2) {
        setTareas([]);
        setSubServicios([]);
        setMsg({ texto:"Error al cargar datos: " + e2.message, tipo:"error" });
      }
    }
  }

  /**
   * DESCRIPCIÓN FUNCIONAL: Navega al sub-servicio y hace scroll al tope del panel.
   * DESCRIPCIÓN TÉCNICA: Busca el objeto completo en `servicios` antes de seleccionar.
   */
  function navegarASubServicio(sub) {
    const svcCompleto = servicios.find(s => s.id === sub.id) || sub;
    seleccionar(svcCompleto);
    if (panelDerechoRef.current) panelDerechoRef.current.scrollTop = 0;
  }

  /**
   * DESCRIPCIÓN FUNCIONAL: Abre formulario de edición con datos del servicio precargados.
   * DESCRIPCIÓN TÉCNICA: stopPropagation evita que el clic en ✏️ seleccione el card padre.
   */
  function abrirEditarSvc(s, e) {
    e.stopPropagation();
    setSvcEditando(s);
    setFSvc({ codigo: s.codigo, nombre: s.nombre, descripcion: s.descripcion || "", servicio_padre_id: s.servicio_padre_id || "" });
    setMostrarFormSvc(true);
    setMsg({ texto:"", tipo:"" });
  }

  /**
   * DESCRIPCIÓN FUNCIONAL: Crea o actualiza un servicio según svcEditando.
   * DESCRIPCIÓN TÉCNICA: POST para nuevo, PUT para edición. Recarga lista tras guardar.
   */
  async function guardarSvc() {
    if (!fSvc.nombre.trim())                 { setMsg({ texto:"El nombre es obligatorio", tipo:"error" }); return; }
    if (!svcEditando && !fSvc.codigo.trim()) { setMsg({ texto:"El código es obligatorio", tipo:"error" }); return; }
    const payload = {
      codigo:            fSvc.codigo.trim().toUpperCase(),
      nombre:            fSvc.nombre.trim(),
      descripcion:       fSvc.descripcion.trim() || null,
      servicio_padre_id: fSvc.servicio_padre_id || null,
    };
    try {
      if (svcEditando) {
        await api.put(`/servicios/${svcEditando.id}`, payload);
        setMsg({ texto:"✅ Servicio actualizado", tipo:"ok" });
      } else {
        await api.post("/servicios/", payload);
        setMsg({ texto:"✅ Servicio creado", tipo:"ok" });
      }
      setMostrarFormSvc(false);
      setSvcEditando(null);
      setFSvc({ codigo:"", nombre:"", descripcion:"", servicio_padre_id:"" });
      cargarTodo();
    } catch (e) {
      setMsg({ texto:"❌ " + (e.message || "Error"), tipo:"error" });
    }
  }

  /** Agrega tarea nueva al servicio seleccionado */
  async function agregarTarea(datos) {
    try {
      await api.post(`/servicios/${seleccionado.id}/tareas`, datos);
      setMsg({ texto:"✅ Tarea agregada", tipo:"ok" });
      setMostrarAddTarea(false);
      seleccionar(seleccionado);
    } catch (e) {
      setMsg({ texto:"❌ " + (e.message || "Error"), tipo:"error" });
    }
  }

  /** Guarda cambios de edición de una tarea */
  async function guardarEdicionTarea(datos) {
    try {
      await api.put(`/servicios/servicio-tarea/${tareaEditando.id}`, datos);
      setMsg({ texto:"✅ Tarea actualizada", tipo:"ok" });
      setTareaEditando(null);
      seleccionar(seleccionado);
    } catch (e) {
      setMsg({ texto:"❌ " + (e.message || "Error"), tipo:"error" });
    }
  }

  /** Quita tarea del servicio con confirmación previa */
  async function quitarTarea(stId) {
    if (!confirm("¿Quitar esta tarea del servicio?")) return;
    setMsg({ texto:"", tipo:"" });
    try {
      await api.delete(`/servicios/servicio-tarea/${stId}`);
      setMsg({ texto:"✅ Tarea quitada", tipo:"ok" });
      seleccionar(seleccionado);
    } catch (e) {
      setMsg({ texto:"❌ " + (e.message || "Error"), tipo:"error" });
    }
  }

  /**
   * DESCRIPCIÓN FUNCIONAL: Genera texto legible de la regla de calendarización.
   * DESCRIPCIÓN TÉCNICA: Construye el string en cascada según tipo y regla.
   */
  function descRegla(t) {
    if (t.tipo_calendarizacion === "excepcional") return "⚡ Excepcional";
    if (t.tipo_calendarizacion === "manual")      return "✋ Manual";
    if (!t.regla_tipo)                            return "📅 Automática (sin regla)";
    const r = REGLAS.find(x => x.value === t.regla_tipo);
    let d = `📅 ${r?.label || t.regla_tipo}`;
    if (t.regla_valor_n) d += ` N=${t.regla_valor_n}`;
    if (t.ref_tipo) {
      const rf = REFS.find(x => x.value === t.ref_tipo);
      d += ` → ${rf?.label || t.ref_tipo}`;
      if (t.ref_valor) d += ` ${t.ref_valor}`;
    }
    if (t.meses_activos) {
      const nombres = t.meses_activos.split(",").map(m => MESES[parseInt(m)-1]).join(", ");
      d += ` · Solo: ${nombres}`;
    }
    return d;
  }

  if (cargando) return <div style={{ color:"white", padding:"20px" }}>⏳ Cargando...</div>;

  const opcionesPadre = servicios
    .filter(s => !svcEditando || s.id !== svcEditando.id)
    .map(s => ({ value: s.id, label: s.nombre }));

  const haySubServicios = subServicios.length > 0;
  const hayTareas       = tareas.length > 0;
  const panelVacio      = !haySubServicios && !hayTareas && !mostrarAddTarea && !tareaEditando;

  return (
    <div style={{ color:"white" }}>

      {/* Encabezado */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"20px" }}>
        <h2 style={{ margin:0, fontSize:"20px" }}>🔧 Gestión de Servicios</h2>
        <button style={E.btn} onClick={() => {
          setMostrarFormSvc(!mostrarFormSvc);
          setSvcEditando(null);
          setFSvc({ codigo:"", nombre:"", descripcion:"", servicio_padre_id:"" });
          setMsg({ texto:"", tipo:"" });
        }}>
          {!esOperador && (mostrarFormSvc && !svcEditando ? "✕ Cancelar" : "+ Nuevo Servicio")}
        </button>
      </div>

      {/* Banner de mensaje */}
      {msg.texto && (
        <div style={{
          background: msg.tipo === "ok" ? "#064e3b" : "#7f1d1d",
          border:     `1px solid ${msg.tipo === "ok" ? "#10b981" : "#ef4444"}`,
          color:      msg.tipo === "ok" ? "#10b981" : "#fca5a5",
          padding:"10px 14px", borderRadius:"6px", marginBottom:"14px",
          display:"flex", justifyContent:"space-between", alignItems:"center", fontSize:"13px",
        }}>
          <span>{msg.texto}</span>
          <button onClick={() => setMsg({ texto:"", tipo:"" })}
            style={{ background:"none", border:"none", color:"inherit", cursor:"pointer", fontSize:"16px" }}>✕</button>
        </div>
      )}

      {/* Formulario de servicio */}
      {mostrarFormSvc && (
        <div style={{ ...E.card, borderColor:"#6366f1", marginBottom:"20px" }}>
          <h3 style={{ margin:"0 0 12px", fontSize:"15px" }}>
            {svcEditando ? `✏️ Editando: ${svcEditando.nombre}` : "Nuevo Servicio"}
          </h3>
          {!svcEditando && (
            <>
              <label style={E.label}>Código * (se guarda en mayúsculas)</label>
              <input style={E.input} value={fSvc.codigo}
                onChange={e => setFSvc({...fSvc, codigo: e.target.value})}
                placeholder="Ej: LIQ_SUELDOS" />
            </>
          )}
          <label style={E.label}>Nombre *</label>
          <input style={E.input} value={fSvc.nombre}
            onChange={e => setFSvc({...fSvc, nombre: e.target.value})}
            placeholder="Nombre del servicio" />
          <label style={E.label}>Descripción (opcional)</label>
          <textarea style={{ ...E.input, height:"60px", resize:"vertical" }}
            value={fSvc.descripcion}
            onChange={e => setFSvc({...fSvc, descripcion: e.target.value})} />
          <label style={E.label}>Servicio padre (si es sub-servicio)</label>
          <BuscadorDesplegable opciones={opcionesPadre} valor={fSvc.servicio_padre_id}
            onChange={v => setFSvc({...fSvc, servicio_padre_id: v})}
            placeholder="— Ninguno (raíz) —" />
          <div style={{ display:"flex", gap:"8px", marginTop:"12px" }}>
            <button style={E.btn} onClick={guardarSvc}>
              {svcEditando ? "💾 Guardar cambios" : "💾 Crear"}
            </button>
            <button style={E.btnGris} onClick={() => { setMostrarFormSvc(false); setSvcEditando(null); }}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Layout dos columnas */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1.3fr", gap:"20px" }}>

        {/* ════ COLUMNA IZQUIERDA ════ */}
        <div>
          <div style={{ color:"#9ca3af", fontSize:"11px", fontWeight:"700",
            letterSpacing:"0.08em", textTransform:"uppercase", marginBottom:"10px" }}>
            Servicios ({servicios.length})
          </div>
          {servicios.length === 0 && (
            <p style={{ color:"#6b7280", fontSize:"13px" }}>No hay servicios cargados.</p>
          )}
          {servicios.map(s => (
            <TarjetaServicio
              key={s.id}
              s={s}
              seleccionado={seleccionado?.id === s.id}
              servicios={servicios}
              onClick={() => seleccionar(s)}
              onEditar={e => abrirEditarSvc(s, e)}
            />
          ))}
        </div>

        {/* ════ COLUMNA DERECHA ════ */}
        <div ref={panelDerechoRef} style={{ overflowY:"auto", maxHeight:"80vh" }}>

          {!seleccionado ? (
            <div style={{ color:"#6b7280", textAlign:"center", paddingTop:"60px", fontSize:"14px" }}>
              ← Seleccioná un servicio
            </div>
          ) : (
            <>
              {/* Encabezado del panel derecho */}
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"12px" }}>
                <div style={{ color:"#9ca3af", fontSize:"11px", fontWeight:"700",
                  letterSpacing:"0.08em", textTransform:"uppercase" }}>
                  {seleccionado.nombre}
                </div>
                {!tareaEditando && (
                  <button style={{ ...E.btn, padding:"6px 12px", fontSize:"12px" }}
                    onClick={() => { setMostrarAddTarea(!mostrarAddTarea); setMsg({ texto:"", tipo:"" }); }}>
                    {!esOperador && (mostrarAddTarea ? "✕ Cancelar" : "+ Agregar tarea")}
                  </button>
                )}
              </div>

              {/* Sección: Sub-servicios */}
              {haySubServicios && (
                <div style={{ marginBottom:"16px" }}>
                  <div style={{ fontSize:"11px", fontWeight:"700", color:"#60a5fa",
                    letterSpacing:"0.08em", textTransform:"uppercase",
                    marginBottom:"8px", display:"flex", alignItems:"center", gap:"8px" }}>
                    <span>📦 Sub-servicios</span>
                    <span style={{ ...E.badge, background:"#1e40af", color:"#bfdbfe" }}>
                      {subServicios.length}
                    </span>
                  </div>
                  {subServicios.map(sub => (
                    <TarjetaSubServicio key={sub.id} sub={sub} onNavegar={navegarASubServicio} />
                  ))}
                  {(hayTareas || mostrarAddTarea || tareaEditando) && (
                    <div style={{ borderTop:"1px solid #374151", marginTop:"12px", marginBottom:"12px" }} />
                  )}
                </div>
              )}

              {/* Encabezado sección tareas (solo cuando también hay sub-servicios) */}
              {haySubServicios && (hayTareas || mostrarAddTarea || tareaEditando) && (
                <div style={{ fontSize:"11px", fontWeight:"700", color:"#9ca3af",
                  letterSpacing:"0.08em", textTransform:"uppercase",
                  marginBottom:"8px", display:"flex", alignItems:"center", gap:"8px" }}>
                  <span>📋 Tareas propias</span>
                  {hayTareas && (
                    <span style={{ ...E.badge, background:"#374151", color:"#d1d5db" }}>
                      {tareas.length}
                    </span>
                  )}
                </div>
              )}

              {/* Formulario agregar tarea */}
              {mostrarAddTarea && !tareaEditando && (
                <div style={{ ...E.card, borderColor:"#10b981", marginBottom:"12px" }}>
                  <h4 style={{ margin:"0 0 10px", fontSize:"14px" }}>Agregar tarea</h4>
                  <FormTarea inicial={null} catalogo={catalogo} modoEdicion={false}
                    onGuardar={agregarTarea} onCancelar={() => setMostrarAddTarea(false)} />
                </div>
              )}

              {/* Formulario edición tarea */}
              {tareaEditando && (
                <div style={{ ...E.card, borderColor:"#d97706", marginBottom:"12px" }}>
                  <h4 style={{ margin:"0 0 10px", fontSize:"14px" }}>✏️ Editando tarea</h4>
                  <FormTarea inicial={tareaEditando} catalogo={catalogo} modoEdicion={true}
                    onGuardar={guardarEdicionTarea} onCancelar={() => setTareaEditando(null)} />
                </div>
              )}

              {/* Panel vacío */}
              {panelVacio && (
                <p style={{ color:"#6b7280", fontSize:"13px" }}>
                  Este servicio no tiene tareas ni sub-servicios propios.
                </p>
              )}

              {/* Lista de tareas propias */}
              {tareas.map((t, i) => (
                <div key={t.id} style={{ ...E.card,
                  borderColor: tareaEditando?.id === t.id ? "#d97706" : "#374151",
                  opacity: tareaEditando && tareaEditando.id !== t.id ? 0.5 : 1 }}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
                    <div style={{ flex:1 }}>
                      {/* Nombre y código */}
                      <div style={{ fontWeight:"600", fontSize:"13px", marginBottom:"4px" }}>
                        {i+1}º {t.tarea_nombre}
                        <span style={{ color:"#6b7280", marginLeft:"6px", fontSize:"11px", fontFamily:"monospace" }}>
                          [{t.tarea_codigo}]
                        </span>
                      </div>
                      {/* Regla */}
                      <div style={{ fontSize:"11px", color:"#9ca3af", marginBottom:"5px" }}>
                        {descRegla(t)}
                      </div>
                      {/* Badges */}
                      <div style={{ display:"flex", gap:"5px", flexWrap:"wrap" }}>
                        <span style={{ ...E.badge,
                          background: t.es_obligatoria ? "#064e3b" : "#1f2937",
                          color:       t.es_obligatoria ? "#6ee7b7" : "#6b7280",
                          border:      `1px solid ${t.es_obligatoria ? "#059669" : "#374151"}`,
                        }}>
                          {t.es_obligatoria ? "✅ Obligatoria" : "⬜ Opcional"}
                        </span>
                        <span style={{ ...E.badge, background:"#1f2937", color:"#9ca3af", border:"1px solid #374151" }}>
                          ⏱ {t.duracion_estimada_minutos} min
                        </span>
                        {t.rubro && (
                          <span style={{ ...E.badge,
                            background: colorRubro(t.rubro) + "33",
                            color:      "#e5e7eb",
                            border:     `1px solid ${colorRubro(t.rubro)}`,
                          }}>
                            📁 {t.rubro}
                          </span>
                        )}
                      </div>
                    </div>
                    {/* Botones editar/quitar */}
                    {!tareaEditando && (
                      <div style={{ display:"flex", gap:"4px", marginLeft:"8px" }}>
                        <button style={E.btnAma} onClick={() => {
                          setTareaEditando(t);
                          setMostrarAddTarea(false);
                          setMsg({ texto:"", tipo:"" });
                        }}>✏️</button>
                        <button style={E.btnRojo} onClick={() => quitarTarea(t.id)}>✕</button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
