import { useState } from "react";
import GestionUsuarios from "../components/admin/GestionUsuarios";
import GestionFeriados from "../components/admin/GestionFeriados";
import GestionEmpresa from "../components/admin/GestionEmpresa";
import GestionCatalogo from "../components/admin/GestionCatalogo";
import GestionServicios from "../components/admin/GestionServicios";
import GestionRubros   from "../components/admin/GestionRubros";

const TABS = [
  { id: "empresa",   icono: "🏢", label: "Empresa" },
  { id: "usuarios",  icono: "👤", label: "Usuarios" },
  { id: "feriados",  icono: "📅", label: "Feriados" },
  { id: "catalogo",  icono: "📋", label: "Catálogo de tareas" },
  { id: "servicios", icono: "🔧", label: "Servicios" },
  { id: "rubros",    icono: "📁", label: "Rubros" },
];

export default function Administracion() {
  const [tabActiva, setTabActiva] = useState("empresa");

  return (
    <div className="min-h-screen bg-gray-950 p-6">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-2xl font-bold text-white mb-6">⚙️ Administración del sistema</h1>
        <div className="flex gap-2 mb-6 border-b border-gray-800 flex-wrap">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setTabActiva(tab.id)}
              className={`px-4 py-3 text-sm font-medium flex items-center gap-2 border-b-2 transition-colors -mb-px ${
                tabActiva === tab.id
                  ? "border-indigo-500 text-indigo-400"
                  : "border-transparent text-gray-500 hover:text-gray-300"
              }`}
            >
              {tab.icono} {tab.label}
            </button>
          ))}
        </div>
        <div>
          {tabActiva === "empresa"   && <GestionEmpresa />}
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
