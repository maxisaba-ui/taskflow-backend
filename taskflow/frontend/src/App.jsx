/**
 * App.jsx — v1.2.0
 * Fix: ruta /seguimiento-complejo dentro del componente App.
 */
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"
import { AuthContext } from "./context/AuthContext.jsx"
import { useContext } from "react"

import Login               from "./pages/Login.jsx"
import Dashboard           from "./pages/Dashboard.jsx"
import Clientes            from "./pages/Clientes.jsx"
import Reportes            from "./pages/Reportes.jsx"
import Seguimiento         from "./pages/Seguimiento.jsx"
import Agenda              from "./pages/Agenda.jsx"
import Administracion      from "./pages/Administracion.jsx"
import SeguimientoComplejo from "./pages/SeguimientoComplejo.jsx"
import Layout              from "./components/Layout.jsx"

function RutaProtegida({ children }) {
  const { usuario, cargando } = useContext(AuthContext)
  if (cargando) return (
    <div style={{
      color:"white", background:"#111", minHeight:"100vh",
      display:"flex", alignItems:"center", justifyContent:"center", fontSize:"24px",
    }}>
      Cargando...
    </div>
  )
  if (!usuario) return <Navigate to="/login" />
  return children
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={
          <RutaProtegida><Layout><Dashboard /></Layout></RutaProtegida>
        } />
        <Route path="/clientes" element={
          <RutaProtegida><Layout><Clientes /></Layout></RutaProtegida>
        } />
        <Route path="/reportes" element={
          <RutaProtegida><Layout><Reportes /></Layout></RutaProtegida>
        } />
        <Route path="/seguimiento" element={
          <RutaProtegida><Layout><Seguimiento /></Layout></RutaProtegida>
        } />
        <Route path="/agenda" element={
          <RutaProtegida><Layout><Agenda /></Layout></RutaProtegida>
        } />
        <Route path="/administracion" element={
          <RutaProtegida><Layout><Administracion /></Layout></RutaProtegida>
        } />
        <Route path="/seguimiento-complejo" element={
          <RutaProtegida><Layout><SeguimientoComplejo /></Layout></RutaProtegida>
        } />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </BrowserRouter>
  )
}
