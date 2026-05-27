cat > ~/Documentos/SistemaContable/taskflow-backend/taskflow/frontend/src/components/Layout.jsx << 'EOF'
import { useContext } from "react"
import { Link, useNavigate } from "react-router-dom"
import { AuthContext } from "../context/AuthContext.jsx"

export default function Layout({ children }) {
  const { usuario, logout } = useContext(AuthContext)
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate("/login")
  }

  return (
    <div style={{display:"flex", minHeight:"100vh", background:"#030712", color:"white"}}>
      {/* Sidebar */}
      <div style={{width:"220px", background:"#111827", padding:"20px", display:"flex", flexDirection:"column", gap:"8px"}}>
        <div style={{fontSize:"20px", fontWeight:"bold", marginBottom:"20px", color:"#6366f1"}}>
          TaskFlow Pro
        </div>
        <Link to="/" style={{color:"#d1d5db", textDecoration:"none", padding:"8px 12px", borderRadius:"8px", background:"#1f2937"}}>🏠 Dashboard</Link>
        <Link to="/clientes" style={{color:"#d1d5db", textDecoration:"none", padding:"8px 12px", borderRadius:"8px"}}>👥 Clientes</Link>
        <Link to="/reportes" style={{color:"#d1d5db", textDecoration:"none", padding:"8px 12px", borderRadius:"8px"}}>📊 Reportes</Link>
        <Link to="/administracion" style={{color:"#d1d5db", textDecoration:"none", padding:"8px 12px", borderRadius:"8px"}}>⚙️ Administración</Link>
        <div style={{marginTop:"auto"}}>
          <div style={{fontSize:"12px", color:"#9ca3af", marginBottom:"8px"}}>{usuario?.email}</div>
          <button onClick={handleLogout} style={{background:"#ef4444", color:"white", border:"none", padding:"8px 12px", borderRadius:"8px", cursor:"pointer", width:"100%"}}>
            Cerrar sesión
          </button>
        </div>
      </div>
      {/* Contenido */}
      <div style={{flex:1, padding:"24px", overflowY:"auto"}}>
        {children}
      </div>
    </div>
  )
}
EOF
