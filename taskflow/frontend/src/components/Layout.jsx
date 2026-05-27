/**
 * =============================================================
 * Archivo: Layout.jsx
 * Versión: v1.1.0
 * -------------------------------------------------------------
 * DESCRIPCION FUNCIONAL:
 *   Estructura base de la aplicacion. Renderiza el menu lateral
 *   de navegacion y el area de contenido principal.
 *   El item Agenda solo se muestra a supervisores, duenos y admins.
 *
 * DESCRIPCION TECNICA:
 *   Usa useContext(AuthContext) directamente (NO el hook useAuth).
 *   La logica de item activo usa igualdad estricta para "/" y
 *   startsWith para las demas rutas.
 *   El menu de Agenda se filtra segun los perfiles del usuario.
 *
 * HISTORIAL:
 *   v1.0.0 - Menu base con fix de Seguimiento.
 *   v1.1.0 - Agrega item Agenda visible solo para supervisores.
 * =============================================================
 */
import { useContext } from "react"
import { useState } from "react"
import { Link, useNavigate, useLocation } from "react-router-dom"
import { useEffect } from "react"
import { api } from "../api/client.js"
import { AuthContext } from "../context/AuthContext.jsx"

/**
 * DESCRIPCION FUNCIONAL:
 *   Definicion completa del menu lateral.
 *   El campo requierePerfil filtra la visibilidad del item.
 * DESCRIPCION TECNICA:
 *   Si requierePerfil es null, el item se muestra a todos.
 *   Si es un array, se muestra solo si el usuario tiene alguno
 *   de esos perfiles.
 */
const MENU = [
  { path:"/",               icono:"🏠", label:"Dashboard",      requierePerfil: null },
  { path:"/clientes",       icono:"👥", label:"Clientes",        requierePerfil: null },
  { path:"/reportes",       icono:"📊", label:"Reportes",        requierePerfil: null },
  { path:"/seguimiento",    icono:"🔍", label:"Seguimiento",     requierePerfil: null },
  { path:"/agenda",         icono:"📅", label:"Agenda",          requierePerfil: ["supervisor","dueno","administrador"] },
  { path: "/seguimiento-complejo", icono: "🔀", label: "Tareas complejas",        requierePerfil: null },
  { path:"/administracion", icono:"⚙️", label:"Administración",  requierePerfil: ["administrador","dueno"] },
]

export default function Layout({ children }) {
  /* Contexto de autenticacion: usuario logueado y funcion de logout */
  const ctx            = useContext(AuthContext)
  const usuario        = ctx ? ctx.usuario        : null
  const logout         = ctx ? ctx.logout         : () => {}
  const cambiarEmpresa = ctx ? ctx.cambiarEmpresa : async () => {}
  const [empresas,        setEmpresas]        = useState([])
  const [mostrarSelector, setMostrarSelector] = useState(false)
  const [cambiando,       setCambiando]       = useState(false)

  const navigate = useNavigate()

  // Cargar lista de empresas del usuario al montar
  useEffect(() => {
    api.get("/auth/mis-empresas")
      .then(data => setEmpresas(data || []))
      .catch(() => setEmpresas([]))
  }, [usuario?.id])

  async function handleCambiarEmpresa(empresaId) {
    if (cambiando || empresaId === usuario?.empresa_id) return
    setCambiando(true)
    try {
      await cambiarEmpresa(empresaId)
      setMostrarSelector(false)
      // Recargar la página para que todos los datos se actualicen
      window.location.reload()
    } catch(e) {
      console.error(e)
    }
    setCambiando(false)
  }
  const location = useLocation()

  /**
   * DESCRIPCION FUNCIONAL: Ejecuta el logout y redirige al login.
   */
  function handleLogout() {
    logout()
    navigate("/login")
  }

  /**
   * DESCRIPCION FUNCIONAL:
   *   Determina si un item del menu esta activo segun la ruta actual.
   * DESCRIPCION TECNICA:
   *   Para "/" usa igualdad estricta para evitar que Dashboard quede
   *   activo en todas las rutas (todas empiezan con "/").
   *   Para el resto usa startsWith para cubrir sub-rutas.
   */
  function esActivo(path) {
    if (path === "/") return location.pathname === "/"
    return location.pathname === path || location.pathname.startsWith(path + "/")
  }

  /**
   * DESCRIPCION FUNCIONAL:
   *   Determina si el usuario tiene acceso a un item del menu.
   * DESCRIPCION TECNICA:
   *   Si requierePerfil es null, acceso universal.
   *   Si es array, verifica intersection con los perfiles del usuario.
   */
  function tieneAcceso(requierePerfil) {
    if (!requierePerfil) return true
    if (!usuario?.perfiles) return false
    return requierePerfil.some(p => usuario.perfiles.includes(p))
  }

  return (
    <div style={{ display:"flex", minHeight:"100vh", background:"#030712", color:"white" }}>

      {/* ── Menu lateral ── */}
      <div style={{
        width:"220px",
        background:"#111827",
        padding:"20px",
        display:"flex",
        flexDirection:"column",
        gap:"4px",
        flexShrink:0,
      }}>
        {/* Logo / titulo */}
        {/* ── Logo y nombre de empresa ── */}
        <div style={{ marginBottom:"16px", paddingBottom:"16px",
          borderBottom:"1px solid #374151" }}>
          {/* Logo de la empresa */}
          <div style={{ display:"flex", alignItems:"center", gap:"10px",
            marginBottom: empresas.length > 1 ? "10px" : "0" }}>
            {usuario?.logo_url && (
              <img src={usuario.logo_url?.startsWith('/static') ? `http://localhost:8000${usuario.logo_url}` : usuario.logo_url} alt="logo"
                style={{ height:"36px", maxWidth:"140px",
                  objectFit:"contain", borderRadius:"4px" }} />
            )}
            <span style={{ fontSize:"14px", fontWeight:"bold",
              color: usuario?.color_primario || "#6366f1",
              lineHeight:"1.2" }}>
              {usuario?.empresa_nombre || "TaskFlow Pro"}
            </span>
          </div>
          {/* Selector de empresa — solo si tiene más de una */}
          {empresas.length > 1 && (
            <div style={{ position:"relative" }}>
              <button
                onClick={() => setMostrarSelector(!mostrarSelector)}
                style={{ width:"100%", background:"#1f2937",
                  border:"1px solid #374151", color:"white",
                  padding:"6px 10px", borderRadius:"6px",
                  cursor:"pointer", fontSize:"12px", textAlign:"left",
                  display:"flex", justifyContent:"space-between",
                  alignItems:"center" }}>
                <span style={{ color:"#9ca3af" }}>
                  🏢 {usuario?.empresa_nombre || "Empresa"}
                </span>
                <span>{mostrarSelector ? "▲" : "▼"}</span>
              </button>
              {mostrarSelector && (
                <div style={{ position:"absolute", top:"calc(100% + 4px)",
                  left:0, right:0, background:"#1f2937",
                  border:"1px solid #374151", borderRadius:"6px",
                  zIndex:1000, overflow:"hidden", boxShadow:"0 8px 24px rgba(0,0,0,0.4)" }}>
                  {empresas.map(emp => (
                    <button key={emp.id}
                      onClick={() => handleCambiarEmpresa(emp.id)}
                      disabled={cambiando}
                      style={{ width:"100%", background:
                        emp.id === usuario?.empresa_id ? "#374151" : "transparent",
                        border:"none", color:"white", padding:"10px 12px",
                        cursor:"pointer", fontSize:"12px", textAlign:"left",
                        display:"flex", alignItems:"center", gap:"8px",
                        borderBottom:"1px solid #374151" }}>
                      {emp.logo_url ? (
                        <img src={emp.logo_url} alt=""
                          style={{ height:"20px", width:"20px",
                            objectFit:"contain", borderRadius:"2px" }} />
                      ) : (
                        <span style={{ fontSize:"16px" }}>🏢</span>
                      )}
                      <span>{emp.nombre}</span>
                      {emp.id === usuario?.empresa_id && (
                        <span style={{ marginLeft:"auto", color:"#10b981",
                          fontSize:"10px" }}>✓ activa</span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Items del menu filtrados por perfil */}
        {MENU.filter(item => tieneAcceso(item.requierePerfil)).map(item => {
          const activo = esActivo(item.path)
          return (
            <Link key={item.path} to={item.path} style={{
              color:          activo ? "white"    : "#9ca3af",
              textDecoration: "none",
              padding:        "10px 12px",
              borderRadius:   "8px",
              background:     activo ? "#4f46e5"  : "transparent",
              fontWeight:     activo ? "600"       : "400",
              fontSize:       "14px",
              display:        "flex",
              alignItems:     "center",
              gap:            "8px",
              transition:     "background 0.15s",
            }}>
              {item.icono} {item.label}
            </Link>
          )
        })}

        {/* Footer del menu: usuario y logout */}
        <div style={{ marginTop:"auto", paddingTop:"20px", borderTop:"1px solid #374151" }}>
          <div style={{ display:"flex", alignItems:"center", gap:"8px", marginBottom:"10px" }}>
            {usuario?.foto_url ? (
              <img src={usuario.foto_url} alt="avatar"
                style={{ width:"32px", height:"32px", borderRadius:"50%",
                  objectFit:"cover", flexShrink:0 }} />
            ) : (
              <div style={{ width:"32px", height:"32px", borderRadius:"50%",
                background:"#4f46e5", display:"flex", alignItems:"center",
                justifyContent:"center", fontSize:"14px", flexShrink:0 }}>
                {(usuario?.nombre || "U")[0].toUpperCase()}
              </div>
            )}
            <div style={{ overflow:"hidden" }}>
              <div style={{ fontSize:"12px", color:"white", fontWeight:"500",
                overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                {usuario?.nombre} {usuario?.apellido}
              </div>
              <div style={{ fontSize:"10px", color:"#6b7280",
                overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                {usuario?.email}
              </div>
            </div>
          </div>
          <button onClick={handleLogout} style={{
            background:"#ef4444", color:"white", border:"none",
            padding:"8px 12px", borderRadius:"8px", cursor:"pointer",
            width:"100%", fontSize:"13px",
          }}>
            Cerrar sesión
          </button>
        </div>
      </div>

      {/* ── Area de contenido principal ── */}
      <div style={{ flex:1, padding:"24px", overflowY:"auto" }}>
        {children}
      </div>
    </div>
  )
}