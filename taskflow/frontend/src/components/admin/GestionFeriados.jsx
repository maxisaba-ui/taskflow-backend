/**
 * =============================================================
 * Archivo: GestionFeriados.jsx
 * -------------------------------------------------------------
 * DESCRIPCIÓN FUNCIONAL:
 *   Panel de gestión de feriados del sistema.
 *   Permite agregar, editar y eliminar feriados individualmente.
 *   Incluye función "Duplicar año": copia todos los feriados de un
 *   año de referencia al año destino, ajustando automáticamente
 *   las fechas. Solo copia los que no existan ya en el año destino.
 *
 * DESCRIPCIÓN TÉCNICA:
 *   Edición inline: la fila se reemplaza por inputs al hacer clic en ✏️.
 *   Duplicar año: llama al endpoint POST /parametros/feriados/duplicar-anio
 *   con { anio_origen, anio_destino }. El backend ajusta las fechas
 *   sumando la diferencia de años y salta los que ya existen (ON CONFLICT).
 *   Selector de año: año actual ± 2.
 * =============================================================
 */
import { useState, useEffect } from "react";
import { api } from "../../api/client.js";

/* ── Estilos base ───────────────────────────────────────────── */
const E = {
  input:   { background:"#111827", border:"1px solid #374151", color:"white", padding:"7px 10px", borderRadius:"6px", fontSize:"13px", boxSizing:"border-box" },
  label:   { color:"#9ca3af", fontSize:"12px", display:"block", marginBottom:"4px" },
  btn:     { background:"#6366f1", color:"white", border:"none", padding:"8px 16px", borderRadius:"6px", cursor:"pointer", fontSize:"13px", fontWeight:"500" },
  btnGris: { background:"#374151", color:"white", border:"none", padding:"6px 12px", borderRadius:"4px", cursor:"pointer", fontSize:"12px" },
  btnRojo: { background:"#ef4444", color:"white", border:"none", padding:"4px 8px", borderRadius:"4px", cursor:"pointer", fontSize:"12px" },
  btnAma:  { background:"#d97706", color:"white", border:"none", padding:"4px 8px", borderRadius:"4px", cursor:"pointer", fontSize:"12px" },
  btnVerde:{ background:"#059669", color:"white", border:"none", padding:"6px 12px", borderRadius:"4px", cursor:"pointer", fontSize:"12px" },
  btnMorado:{ background:"#7c3aed", color:"white", border:"none", padding:"7px 14px", borderRadius:"6px", cursor:"pointer", fontSize:"13px", fontWeight:"500" },
  select:  { background:"#111827", border:"1px solid #374151", color:"white", padding:"7px 10px", borderRadius:"6px", fontSize:"13px" },
};

/** Opciones de tipo de feriado */
const TIPOS = [
  { value:"nacional", label:"Nacional" },
  { value:"local",    label:"Local"    },
  { value:"empresa",  label:"Empresa"  },
];

/** Colores de badge por tipo */
const TIPO_COLORES = {
  nacional: { bg:"#1e3a5f", color:"#93c5fd", border:"#2563eb" },
  local:    { bg:"#064e3b", color:"#6ee7b7", border:"#059669" },
  empresa:  { bg:"#3b1d8a", color:"#c4b5fd", border:"#7c3aed" },
};

/* =============================================================
   COMPONENTE PRINCIPAL: GestionFeriados
   ============================================================= */
export default function GestionFeriados() {
  const anioActual = new Date().getFullYear();

  const [feriados, setFeriados]               = useState([]);       /* Lista del año seleccionado */
  const [anio, setAnio]                       = useState(anioActual); /* Año visualizado */
  const [feriadoEditando, setFeriadoEditando] = useState(null);     /* ID del feriado en edición inline */
  const [msg, setMsg]                         = useState({ texto:"", tipo:"" });

  /* Estado del formulario de alta */
  const [form, setForm]         = useState({ fecha:"", nombre:"", tipo:"nacional" });
  /* Estado del formulario de edición inline */
  const [formEdit, setFormEdit] = useState({ fecha:"", nombre:"", tipo:"nacional" });

  /* Estado del panel de duplicar año */
  const [mostrarDuplicar, setMostrarDuplicar] = useState(false);
  const [anioOrigen, setAnioOrigen]           = useState(anioActual);
  const [anioDestino, setAnioDestino]         = useState(anioActual + 1);
  const [duplicando, setDuplicando]           = useState(false);

  useEffect(() => { cargar(); }, [anio]);

  /**
   * DESCRIPCIÓN FUNCIONAL: Carga los feriados del año seleccionado.
   * DESCRIPCIÓN TÉCNICA: GET con query param anio.
   */
  async function cargar() {
    try {
      setFeriados(await api.get(`/parametros/feriados?anio=${anio}`));
    } catch(e) {
      setMsg({ texto:"❌ Error al cargar: " + e.message, tipo:"error" });
    }
  }

  /**
   * DESCRIPCIÓN FUNCIONAL: Agrega un feriado nuevo al sistema.
   * DESCRIPCIÓN TÉCNICA: POST al endpoint. Limpia el form y recarga.
   */
  async function agregar(e) {
    e.preventDefault();
    if (!form.fecha || !form.nombre.trim()) {
      setMsg({ texto:"La fecha y el nombre son obligatorios", tipo:"error" }); return;
    }
    try {
      await api.post("/parametros/feriados", form);
      setMsg({ texto:"✅ Feriado guardado", tipo:"ok" });
      setForm({ fecha:"", nombre:"", tipo:"nacional" });
      cargar();
    } catch(e) {
      setMsg({ texto:"❌ " + e.message, tipo:"error" });
    }
  }

  /**
   * DESCRIPCIÓN FUNCIONAL: Abre el formulario inline de edición para un feriado.
   * DESCRIPCIÓN TÉCNICA: Inicializa formEdit con los datos del feriado seleccionado.
   */
  function abrirEdicion(f) {
    setFeriadoEditando(f.id);
    setFormEdit({ fecha: f.fecha, nombre: f.nombre, tipo: f.tipo });
    setMsg({ texto:"", tipo:"" });
  }

  /**
   * DESCRIPCIÓN FUNCIONAL: Guarda los cambios del feriado en edición inline.
   * DESCRIPCIÓN TÉCNICA: PUT al endpoint con el ID. Cierra la edición y recarga.
   */
  async function guardarEdicion() {
    if (!formEdit.fecha || !formEdit.nombre.trim()) {
      setMsg({ texto:"La fecha y el nombre son obligatorios", tipo:"error" }); return;
    }
    try {
      await api.put(`/parametros/feriados/${feriadoEditando}`, formEdit);
      setMsg({ texto:"✅ Feriado actualizado", tipo:"ok" });
      setFeriadoEditando(null);
      cargar();
    } catch(e) {
      setMsg({ texto:"❌ " + e.message, tipo:"error" });
    }
  }

  /**
   * DESCRIPCIÓN FUNCIONAL: Elimina (baja lógica) un feriado con confirmación.
   * DESCRIPCIÓN TÉCNICA: DELETE al endpoint con el ID del feriado.
   */
  async function eliminar(f) {
    if (!confirm(`¿Eliminar el feriado "${f.nombre}" (${f.fecha.split("-").reverse().join("/")})?`)) return;
    try {
      await api.delete(`/parametros/feriados/${f.id}`);
      setMsg({ texto:"✅ Feriado eliminado", tipo:"ok" });
      cargar();
    } catch(e) {
      setMsg({ texto:"❌ " + e.message, tipo:"error" });
    }
  }

  /**
   * DESCRIPCIÓN FUNCIONAL:
   *   Duplica todos los feriados del año origen al año destino.
   *   Ajusta las fechas sumando la diferencia de años.
   *   Solo copia los que no existen ya en el año destino.
   * DESCRIPCIÓN TÉCNICA:
   *   Llama al endpoint POST /parametros/feriados/duplicar-anio.
   *   Si el año destino coincide con el visualizado, recarga la lista.
   *   Cambia la vista al año destino para mostrar el resultado.
   */
  async function duplicarAnio() {
    if (anioOrigen === anioDestino) {
      setMsg({ texto:"El año origen y destino deben ser diferentes", tipo:"error" }); return;
    }
    if (!confirm(
      `¿Copiar los feriados de ${anioOrigen} al año ${anioDestino}?\n` +
      `Los feriados que ya existan en ${anioDestino} no se tocarán.`
    )) return;

    setDuplicando(true);
    try {
      const res = await api.post("/parametros/feriados/duplicar-anio", {
        anio_origen:  anioOrigen,
        anio_destino: anioDestino,
      });
      setMsg({
        texto: `✅ ${res.copiados} feriado${res.copiados !== 1 ? "s" : ""} copiado${res.copiados !== 1 ? "s" : ""} al año ${anioDestino}` +
               (res.omitidos > 0 ? ` (${res.omitidos} ya existían y no se modificaron)` : ""),
        tipo:"ok",
      });
      setMostrarDuplicar(false);
      setAnio(anioDestino); /* Cambiar la vista al año destino para ver el resultado */
    } catch(e) {
      setMsg({ texto:"❌ " + e.message, tipo:"error" });
    }
    setDuplicando(false);
  }

  /* Años disponibles para los selectores: año actual ± 3 */
  const aniosDisponibles = [anioActual - 2, anioActual - 1, anioActual, anioActual + 1, anioActual + 2];

  return (
    <div style={{ color:"white" }}>

      {/* Descripción */}
      <p style={{ color:"#9ca3af", fontSize:"13px", marginBottom:"16px" }}>
        El sistema usa estos feriados para calcular días hábiles en la calendarización automática.
      </p>

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
      <div style={{ background:"#1f2937", borderRadius:"8px", padding:"16px",
        border:"1px solid #374151", marginBottom:"16px" }}>
        <h3 style={{ margin:"0 0 12px", fontSize:"14px" }}>Agregar feriado</h3>
        <div style={{ display:"grid", gridTemplateColumns:"160px 1fr 150px auto",
          gap:"10px", alignItems:"flex-end" }}>
          <div>
            <label style={E.label}>Fecha *</label>
            <input type="date" style={{ ...E.input, width:"100%" }}
              value={form.fecha} onChange={e => setForm({...form, fecha: e.target.value})} />
          </div>
          <div>
            <label style={E.label}>Nombre *</label>
            <input style={{ ...E.input, width:"100%" }}
              value={form.nombre} onChange={e => setForm({...form, nombre: e.target.value})}
              placeholder="Ej: Día de la Independencia" />
          </div>
          <div>
            <label style={E.label}>Tipo</label>
            <select style={{ ...E.select, width:"100%" }}
              value={form.tipo} onChange={e => setForm({...form, tipo: e.target.value})}>
              {TIPOS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <button style={{ ...E.btn, alignSelf:"flex-end" }} onClick={agregar}>
            + Agregar
          </button>
        </div>
      </div>

      {/* Panel de duplicar año */}
      {mostrarDuplicar && (
        <div style={{ background:"#1f2937", borderRadius:"8px", padding:"16px",
          border:"1px solid #7c3aed", marginBottom:"16px" }}>
          <h3 style={{ margin:"0 0 4px", fontSize:"14px", color:"#c4b5fd" }}>
            📋 Duplicar feriados de un año a otro
          </h3>
          <p style={{ margin:"0 0 12px", fontSize:"12px", color:"#9ca3af" }}>
            Copia todos los feriados del año origen al año destino ajustando las fechas.
            Los feriados que ya existan en el año destino no se modifican.
          </p>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr auto auto",
            gap:"12px", alignItems:"flex-end" }}>
            <div>
              <label style={E.label}>Año origen (referencia)</label>
              <select style={{ ...E.select, width:"100%" }}
                value={anioOrigen} onChange={e => setAnioOrigen(parseInt(e.target.value))}>
                {aniosDisponibles.map(a => (
                  <option key={a} value={a}>{a} {a === anioActual ? "(actual)" : ""}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={E.label}>Año destino (nuevo)</label>
              <select style={{ ...E.select, width:"100%" }}
                value={anioDestino} onChange={e => setAnioDestino(parseInt(e.target.value))}>
                {aniosDisponibles.map(a => (
                  <option key={a} value={a}>{a} {a === anioActual ? "(actual)" : ""}</option>
                ))}
              </select>
            </div>
            <button
              style={{ ...E.btnMorado, alignSelf:"flex-end",
                opacity: duplicando ? 0.6 : 1,
                cursor:  duplicando ? "wait" : "pointer" }}
              onClick={duplicarAnio}
              disabled={duplicando}>
              {duplicando ? "⏳ Copiando..." : "📋 Duplicar"}
            </button>
            <button style={{ ...E.btnGris, alignSelf:"flex-end" }}
              onClick={() => setMostrarDuplicar(false)}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Barra: selector de año + contador + botón duplicar */}
      <div style={{ display:"flex", justifyContent:"space-between",
        alignItems:"center", marginBottom:"12px" }}>
        {/* Botones de año */}
        <div style={{ display:"flex", gap:"6px", alignItems:"center" }}>
          {aniosDisponibles.map(a => (
            <button key={a} onClick={() => setAnio(a)}
              style={{
                padding:"5px 14px", borderRadius:"6px", fontSize:"13px",
                cursor:"pointer", border:"1px solid",
                background:  a === anio ? "#6366f1" : "transparent",
                color:       a === anio ? "white"   : "#9ca3af",
                borderColor: a === anio ? "#6366f1" : "#374151",
              }}>
              {a}
            </button>
          ))}
        </div>
        {/* Contador y botón duplicar */}
        <div style={{ display:"flex", gap:"10px", alignItems:"center" }}>
          <span style={{ color:"#6b7280", fontSize:"12px" }}>
            {feriados.length} feriado{feriados.length !== 1 ? "s" : ""} en {anio}
          </span>
          <button style={E.btnMorado}
            onClick={() => {
              setMostrarDuplicar(!mostrarDuplicar);
              setAnioOrigen(anio);            /* Pre-seleccionar el año visualizado como origen */
              setAnioDestino(anio + 1);       /* Pre-seleccionar el año siguiente como destino */
            }}>
            📋 Duplicar año
          </button>
        </div>
      </div>

      {/* Tabla de feriados */}
      <div style={{ background:"#111827", borderRadius:"10px",
        border:"1px solid #1f2937", overflow:"hidden",
        overflowX:"auto", WebkitOverflowScrolling:"touch" }}>
        <table style={{ width:"100%", borderCollapse:"collapse", fontSize:"13px", minWidth:"480px" }}>
          <thead>
            <tr style={{ background:"#1f2937", color:"#9ca3af" }}>
              <th style={{ textAlign:"left", padding:"11px 16px", fontWeight:"600", width:"130px" }}>Fecha</th>
              <th style={{ textAlign:"left", padding:"11px 16px", fontWeight:"600" }}>Nombre</th>
              <th style={{ textAlign:"left", padding:"11px 16px", fontWeight:"600", width:"110px" }}>Tipo</th>
              <th style={{ padding:"11px 16px", width:"100px" }}></th>
            </tr>
          </thead>
          <tbody>
            {feriados.map(f => (
              feriadoEditando === f.id ? (
                /* ── Fila en modo edición inline ── */
                <tr key={f.id} style={{ borderTop:"1px solid #1f2937", background:"#1a2235" }}>
                  <td style={{ padding:"8px 12px" }}>
                    <input type="date" style={{ ...E.input, width:"140px" }}
                      value={formEdit.fecha}
                      onChange={e => setFormEdit({...formEdit, fecha: e.target.value})} />
                  </td>
                  <td style={{ padding:"8px 12px" }}>
                    <input style={{ ...E.input, width:"100%" }}
                      value={formEdit.nombre}
                      onChange={e => setFormEdit({...formEdit, nombre: e.target.value})} />
                  </td>
                  <td style={{ padding:"8px 12px" }}>
                    <select style={E.select}
                      value={formEdit.tipo}
                      onChange={e => setFormEdit({...formEdit, tipo: e.target.value})}>
                      {TIPOS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                  </td>
                  <td style={{ padding:"8px 12px", textAlign:"right" }}>
                    <div style={{ display:"flex", gap:"6px", justifyContent:"flex-end" }}>
                      <button style={E.btnVerde} onClick={guardarEdicion}>💾</button>
                      <button style={E.btnGris} onClick={() => setFeriadoEditando(null)}>✕</button>
                    </div>
                  </td>
                </tr>
              ) : (
                /* ── Fila normal ── */
                <tr key={f.id} style={{ borderTop:"1px solid #1f2937" }}>
                  {/* Fecha formateada DD/MM/YYYY */}
                  <td style={{ padding:"11px 16px", color:"#d1d5db", fontFamily:"monospace" }}>
                    {f.fecha.split("-").reverse().join("/")}
                  </td>
                  {/* Nombre del feriado */}
                  <td style={{ padding:"11px 16px", color:"white", fontWeight:"500" }}>
                    {f.nombre}
                  </td>
                  {/* Badge de tipo */}
                  <td style={{ padding:"11px 16px" }}>
                    {(() => {
                      const col = TIPO_COLORES[f.tipo] || { bg:"#374151", color:"#d1d5db", border:"#6b7280" };
                      return (
                        <span style={{
                          fontSize:"11px", padding:"2px 8px", borderRadius:"10px", fontWeight:"600",
                          background: col.bg, color: col.color, border:`1px solid ${col.border}`,
                        }}>
                          {TIPOS.find(t => t.value === f.tipo)?.label || f.tipo}
                        </span>
                      );
                    })()}
                  </td>
                  {/* Acciones */}
                  <td style={{ padding:"11px 16px", textAlign:"right" }}>
                    <div style={{ display:"flex", gap:"6px", justifyContent:"flex-end" }}>
                      <button style={E.btnAma} onClick={() => abrirEdicion(f)}>✏️</button>
                      <button style={E.btnRojo} onClick={() => eliminar(f)}>✕</button>
                    </div>
                  </td>
                </tr>
              )
            ))}
          </tbody>
        </table>
        {feriados.length === 0 && (
          <div style={{ textAlign:"center", padding:"32px", color:"#6b7280" }}>
            No hay feriados cargados para {anio}
          </div>
        )}
      </div>
    </div>
  );
}