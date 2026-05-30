import { useState, useContext } from "react";
import { AuthContext } from "../context/AuthContext.jsx";
import GestionUsuarios  from "../components/admin/GestionUsuarios";
import GestionFeriados  from "../components/admin/GestionFeriados";
import GestionEmpresa   from "../components/admin/GestionEmpresa";
import GestionEmpresas  from "../components/admin/GestionEmpresas";
import GestionCatalogo  from "../components/admin/GestionCatalogo";
import GestionServicios from "../components/admin/GestionServicios";
import GestionRubros    from "../components/admin/GestionRubros";

const TABS_BASE = [
  { id:"empresa",   icono:"🏢", label:"Mi Empresa" },
  { id:"usuarios",  icono:"👤", label:"Usuarios" },
  { id:"feriados",  icono:"📅", label:"Feriados" },
  { id:"catalogo",  icono:"📋", label:"Catálogo" },
  { id:"servicios", icono:"🔧", label:"Servicios" },
  { id:"rubros",    icono:"📁", label:"Rubros" },
];
// Pestaña extra solo para admin/dueño con múltiples empresas
const TAB_EMPRESAS = { id:"empresas", icono:"🏢🏢", label:"Gestión empresas" };

export default function Administracion() {
  const { usuario } = useContext(AuthContext);
  const [tabActiva, setTabActiva] = useState("empresa");

  const esAdmin = usuario?.perfiles?.includes("administrador") ||
                  usuario?.perfiles?.includes("dueno");

  const TABS = esAdmin ? [...TABS_BASE, TAB_EMPRESAS] : TABS_BASE;

  return (
    <div className="min-h-screen bg-gray-950 p-6">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-2xl font-bold text-white mb-6">⚙️ Administración del sistema</h1>
        <div className="flex gap-2 mb-6 border-b border-gray-800 flex-wrap">
          {TABS.map(tab => (
            <button key={tab.id} onClick={() => setTabActiva(tab.id)}
              className={`px-4 py-3 text-sm font-medium flex items-center gap-2 border-b-2 transition-colors -mb-px ${
                tabActiva === tab.id
                  ? "border-indigo-500 text-indigo-400"
                  : "border-transparent text-gray-500 hover:text-gray-300"
              }`}>
              {tab.icono} {tab.label}
            </button>
          ))}
        </div>
        <div>
          {tabActiva === "empresa"   && <GestionEmpresa />}
          {tabActiva === "empresas"  && <GestionEmpresas />}
          {tabActiva === "usuarios"  && <GestionUsuarios />}
          {tabActiva === "feriados"  && <GestionFeriados />}
          {tabActiva === "catalogo"  && <GestionCatalogo />}
          {tabActiva === "servicios" && <GestionServicios />}
          {tabActiva === "rubros"    && <GestionRubros />}
        </div>
      </div>
    </div>
  );
}
