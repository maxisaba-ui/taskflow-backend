/**
 * =============================================================
 * Archivo: Layout.jsx
 * Versión: v1.3.0
 * -------------------------------------------------------------
 * DESCRIPCION FUNCIONAL:
 *   Estructura base de la aplicacion. Renderiza el menu lateral
 *   de navegacion y el area de contenido principal.
 *   En mobile (< 768px) el sidebar se oculta y aparece un
 *   botón hamburguesa en la barra superior.
 *
 * DESCRIPCION TECNICA:
 *   Usa useResponsive() para detectar mobile.
 *   En mobile: overlay + sidebar deslizable desde la izquierda.
 *   En desktop: comportamiento idéntico al original (v1.2.0).
 *
 * HISTORIAL:
 *   v1.0.0 - Menu base.
 *   v1.1.0 - Agrega Agenda filtrada por perfil.
 *   v1.2.0 - Multi-empresa, selector de empresa, manual.
 *   v1.3.0 - Responsive: hamburger mobile, overlay, sidebar deslizable.
 * =============================================================
 */
import { useContext, useState, useEffect } from "react"
import { Link, useNavigate, useLocation } from "react-router-dom"
import { api } from "../api/client.js"
import { AuthContext } from "../context/AuthContext.jsx"
import { useResponsive } from "../hooks/useResponsive.js"

// Orden del menú: Dashboard → Agenda → Tareas complejas → Seguimiento → Registro → Reportes → Clientes → Administración
const MENU = [
  { path:"/",                     icono:"🏠", label:"Dashboard",          requierePerfil: null },
  { path:"/agenda",               icono:"📅", label:"Agenda",              requierePerfil: ["supervisor","dueno","administrador","operador"] },
  { path:"/seguimiento-complejo", icono:"🔀", label:"Tareas complejas",   requierePerfil: null },
  { path:"/seguimiento",          icono:"🔍", label:"Seguimiento",         requierePerfil: null },
  { path:"/registro-trabajo",     icono:"📒", label:"Registro de Trabajo", requierePerfil: null },
  { path:"/reportes",             icono:"📊", label:"Reportes",            requierePerfil: null },
  { path:"/clientes",             icono:"👥", label:"Clientes",            requierePerfil: null },
  { path:"/administracion",       icono:"⚙️", label:"Administración",      requierePerfil: ["administrador","dueno"] },
]

export default function Layout({ children }) {
  const ctx            = useContext(AuthContext)
  const usuario        = ctx ? ctx.usuario        : null
  const logout         = ctx ? ctx.logout         : () => {}
  const cambiarEmpresa = ctx ? ctx.cambiarEmpresa : async () => {}
  const [empresas,        setEmpresas]        = useState([])
  const [mostrarSelector, setMostrarSelector] = useState(false)
  const [cambiando,       setCambiando]       = useState(false)
  const [menuAbierto,     setMenuAbierto]     = useState(false) /* hamburger state */

  const navigate     = useNavigate()
  const location     = useLocation()
  const { isMobile } = useResponsive()

  // Cerrar el menú mobile al cambiar de ruta
  useEffect(() => { setMenuAbierto(false) }, [location.pathname])

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
      window.location.href = "/"
    } catch(e) { console.error(e) }
    setCambiando(false)
  }

  function handleLogout() { logout(); navigate("/login") }

  function esActivo(path) {
    if (path === "/") return location.pathname === "/"
    return location.pathname === path || location.pathname.startsWith(path + "/")
  }

  function tieneAcceso(requierePerfil) {
    if (!requierePerfil) return true
    if (!usuario?.perfiles) return false
    return requierePerfil.some(p => usuario.perfiles.includes(p))
  }

  /* Contenido del sidebar — idéntico en desktop y mobile */
  const sidebarContent = (
    <div style={{ display:"flex", flexDirection:"column", gap:"4px", height:"100%" }}>
      {/* Logo y empresa */}
      <div style={{ marginBottom:"16px", paddingBottom:"16px", borderBottom:"1px solid #374151" }}>
        <div style={{ display:"flex", alignItems:"center", gap:"10px",
          marginBottom: empresas.length > 1 ? "10px" : "0" }}>
          {usuario?.logo_url && (
            <img
              src={usuario.logo_url?.startsWith('/static')
                ? `http://localhost:8000${usuario.logo_url}`
                : usuario.logo_url}
              alt="logo"
              style={{ height:"36px", maxWidth:"140px", objectFit:"contain", borderRadius:"4px" }}
            />
          )}
          <span style={{ fontSize:"14px", fontWeight:"bold",
            color: usuario?.color_primario || "#6366f1", lineHeight:"1.2" }}>
            {usuario?.empresa_nombre || "TaskFlow Pro"}
          </span>
        </div>
        {/* Selector de empresa */}
        {empresas.length > 1 && (
          <div style={{ position:"relative" }}>
            <button onClick={() => setMostrarSelector(!mostrarSelector)}
              style={{ width:"100%", background:"#1f2937", border:"1px solid #374151",
                color:"white", padding:"6px 10px", borderRadius:"6px", cursor:"pointer",
                fontSize:"12px", textAlign:"left", display:"flex",
                justifyContent:"space-between", alignItems:"center" }}>
              <span style={{ color:"#9ca3af" }}>🏢 {usuario?.empresa_nombre || "Empresa"}</span>
              <span>{mostrarSelector ? "▲" : "▼"}</span>
            </button>
            {mostrarSelector && (
              <div style={{ position:"absolute", top:"calc(100% + 4px)", left:0, right:0,
                background:"#1f2937", border:"1px solid #374151", borderRadius:"6px",
                zIndex:1100, overflow:"hidden", boxShadow:"0 8px 24px rgba(0,0,0,0.4)" }}>
                {empresas.map(emp => (
                  <button key={emp.id} onClick={() => handleCambiarEmpresa(emp.id)}
                    disabled={cambiando}
                    style={{ width:"100%",
                      background: emp.id === usuario?.empresa_id ? "#374151" : "transparent",
                      border:"none", color:"white", padding:"10px 12px", cursor:"pointer",
                      fontSize:"12px", textAlign:"left", display:"flex",
                      alignItems:"center", gap:"8px", borderBottom:"1px solid #374151" }}>
                    {emp.logo_url
                      ? <img src={emp.logo_url} alt="" style={{ height:"20px", width:"20px", objectFit:"contain", borderRadius:"2px" }} />
                      : <span style={{ fontSize:"16px" }}>🏢</span>}
                    <span>{emp.nombre}</span>
                    {emp.id === usuario?.empresa_id && (
                      <span style={{ marginLeft:"auto", color:"#10b981", fontSize:"10px" }}>✓ activa</span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Items del menú */}
      {MENU.filter(item => tieneAcceso(item.requierePerfil)).map(item => {
        const activo = esActivo(item.path)
        return (
          <Link key={item.path} to={item.path} style={{
            color:          activo ? "white"   : "#9ca3af",
            textDecoration: "none",
            padding:        "10px 12px",
            borderRadius:   "8px",
            background:     activo ? "#4f46e5" : "transparent",
            fontWeight:     activo ? "600"      : "400",
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

      {/* Manual de usuario */}
      <a href="/manual.html" target="_blank" rel="noopener noreferrer"
        style={{ color:"#9ca3af", textDecoration:"none", padding:"10px 12px",
          borderRadius:"8px", background:"transparent", fontSize:"14px",
          display:"flex", alignItems:"center", gap:"8px", marginTop:"8px",
          border:"1px solid #374151", transition:"background 0.15s" }}
        onMouseEnter={e => e.currentTarget.style.background="#1f2937"}
        onMouseLeave={e => e.currentTarget.style.background="transparent"}>
        📖 Manual de usuario
      </a>

      {/* Footer: usuario y acciones */}
      <div style={{ marginTop:"auto", paddingTop:"20px", borderTop:"1px solid #374151" }}>
        <div style={{ display:"flex", alignItems:"center", gap:"8px", marginBottom:"10px" }}>
          {usuario?.foto_url ? (
            <img src={usuario.foto_url} alt="avatar"
              style={{ width:"32px", height:"32px", borderRadius:"50%", objectFit:"cover", flexShrink:0 }} />
          ) : (
            <div style={{ width:"32px", height:"32px", borderRadius:"50%", background:"#4f46e5",
              display:"flex", alignItems:"center", justifyContent:"center", fontSize:"14px", flexShrink:0 }}>
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
        <button onClick={handleLogout}
          style={{ background:"#ef4444", color:"white", border:"none",
            padding:"8px 12px", borderRadius:"8px", cursor:"pointer",
            width:"100%", fontSize:"13px" }}>
          Cerrar sesión
        </button>
        <button onClick={() => {
          const token = localStorage.getItem("taskflow_token")
          if (token) {
            const ta = document.createElement("textarea")
            ta.value = token; ta.style.position="fixed"; ta.style.opacity="0"
            document.body.appendChild(ta); ta.focus(); ta.select()
            document.execCommand("copy"); document.body.removeChild(ta)
            alert("✅ Token copiado. Volvé al widget y hacé clic en 'Ya me logueé'")
          }
        }} style={{ background:"#1e3a5f", color:"#93c5fd", border:"1px solid #2563eb",
          borderRadius:"8px", padding:"8px 12px", cursor:"pointer",
          width:"100%", fontSize:"12px", marginTop:"6px" }}>
          📋 Conectar Widget
        </button>
      </div>
    </div>
  )

  /* ── RENDER MOBILE ── */
  if (isMobile) {
    return (
      <div style={{ minHeight:"100vh", background:"#030712", color:"white" }}>

        {/* Barra superior mobile */}
        <div style={{ position:"sticky", top:0, zIndex:200, background:"#111827",
          borderBottom:"1px solid #374151", padding:"10px 16px",
          display:"flex", alignItems:"center", justifyContent:"space-between" }}>
          <div style={{ display:"flex", alignItems:"center", gap:"10px" }}>
            {/* Hamburger */}
            <button onClick={() => setMenuAbierto(true)}
              style={{ background:"none", border:"none", color:"white", cursor:"pointer",
                padding:"4px", fontSize:"22px", lineHeight:1 }}>
              ☰
            </button>
            {usuario?.logo_url && (
              <img src={usuario.logo_url?.startsWith('/static')
                ? `http://localhost:8000${usuario.logo_url}`
                : usuario.logo_url}
                alt="logo" style={{ height:"28px", objectFit:"contain" }} />
            )}
            <span style={{ fontSize:"14px", fontWeight:"700",
              color: usuario?.color_primario || "#6366f1" }}>
              {usuario?.empresa_nombre || "TaskFlow Pro"}
            </span>
          </div>
          {/* Avatar mini */}
          {usuario?.foto_url ? (
            <img src={usuario.foto_url} alt="avatar"
              style={{ width:"28px", height:"28px", borderRadius:"50%", objectFit:"cover" }} />
          ) : (
            <div style={{ width:"28px", height:"28px", borderRadius:"50%", background:"#4f46e5",
              display:"flex", alignItems:"center", justifyContent:"center", fontSize:"12px" }}>
              {(usuario?.nombre || "U")[0].toUpperCase()}
            </div>
          )}
        </div>

        {/* Overlay oscuro cuando el menú está abierto */}
        {menuAbierto && (
          <div onClick={() => setMenuAbierto(false)}
            style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.6)",
              zIndex:300, backdropFilter:"blur(2px)" }} />
        )}

        {/* Sidebar deslizable */}
        <div style={{
          position:   "fixed",
          top:        0,
          left:       menuAbierto ? 0 : "-260px",
          width:      "250px",
          height:     "100vh",
          background: "#111827",
          zIndex:     400,
          padding:    "20px 16px",
          overflowY:  "auto",
          transition: "left 0.25s ease",
          boxShadow:  menuAbierto ? "4px 0 24px rgba(0,0,0,0.5)" : "none",
        }}>
          {/* Cerrar */}
          <button onClick={() => setMenuAbierto(false)}
            style={{ background:"none", border:"none", color:"#9ca3af",
              cursor:"pointer", fontSize:"20px", marginBottom:"12px",
              display:"block", marginLeft:"auto" }}>
            ✕
          </button>
          {sidebarContent}
        </div>

        {/* Contenido */}
        <div style={{ padding:"16px", overflowX:"hidden" }}>
          {children}
        </div>
      </div>
    )
  }

  /* ── RENDER DESKTOP (idéntico a v1.2.0) ── */
  return (
    <div style={{ display:"flex", minHeight:"100vh", background:"#030712", color:"white" }}>
      <div style={{ width:"220px", background:"#111827", padding:"20px",
        display:"flex", flexDirection:"column", gap:"4px", flexShrink:0 }}>
        {sidebarContent}
      </div>
      <div style={{ flex:1, padding:"24px", overflowY:"auto" }}>
        {children}
      </div>
    </div>
  )
}
