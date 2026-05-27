cat > ~/Documentos/SistemaContable/taskflow-backend/taskflow/frontend/src/App.jsx << 'EOF'
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"
import { AuthContext } from "./context/AuthContext.jsx"
import { useContext } from "react"
import Login from "./pages/Login.jsx"
import Dashboard from "./pages/Dashboard.jsx"
import Clientes from "./pages/Clientes.jsx"
import Reportes from "./pages/Reportes.jsx"
import Administracion from "./pages/Administracion.jsx"
import Layout from "./components/Layout.jsx"

function RutaProtegida({ children }) {
  const { usuario, cargando } = useContext(AuthContext)
  if (cargando) return <div className="min-h-screen bg-gray-900 flex items-center justify-center text-white text-xl">Cargando...</div>
  if (!usuario) return <Navigate to="/login" />
  return children
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={
          <RutaProtegida>
            <Layout>
              <Dashboard />
            </Layout>
          </RutaProtegida>
        } />
        <Route path="/clientes" element={
          <RutaProtegida>
            <Layout>
              <Clientes />
            </Layout>
          </RutaProtegida>
        } />
        <Route path="/reportes" element={
          <RutaProtegida>
            <Layout>
              <Reportes />
            </Layout>
          </RutaProtegida>
        } />
        <Route path="/administracion" element={
          <RutaProtegida>
            <Layout>
              <Administracion />
            </Layout>
          </RutaProtegida>
        } />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </BrowserRouter>
  )
}
EOF
