// src/pages/Supervisores.jsx — Panel del supervisor
import { useState, useEffect } from "react";
import { apiGet } from "../api/client";

export default function Supervisores() {
  const [operadores, setOperadores] = useState([]);
  const [seleccionado, setSeleccionado] = useState(null);
  const [tareas, setTareas] = useState([]);
  const [fecha, setFecha] = useState(new Date().toISOString().split("T")[0]);

  useEffect(() => { apiGet("/usuarios/").then(u => setOperadores(u)).catch(()=>{}); }, []);
  useEffect(() => {
    if (seleccionado) {
      apiGet(`/tareas/?usuario_id=${seleccionado}&fecha=${fecha}`).then(setTareas).catch(()=>{});
    }
  }, [seleccionado, fecha]);

  const ESTADO_COLOR = {
    pendiente:"text-gray-400", en_curso:"text-green-400", pausada:"text-yellow-400",
    completada:"text-blue-400", vencida:"text-red-400"
  };

  return (
    <div className="min-h-screen bg-gray-950 p-6">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-2xl font-bold text-white mb-6">👥 Panel Supervisor</h1>
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Lista de operadores */}
          <div className="lg:col-span-1">
            <h2 className="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-3">Mis operadores</h2>
            <div className="space-y-2">
              {operadores.map(op => (
                <button key={op.id} onClick={() => setSeleccionado(op.id)}
                  className={`w-full text-left px-4 py-3 rounded-xl border transition-colors ${
                    seleccionado === op.id
                      ? "bg-indigo-600 border-indigo-500 text-white"
                      : "bg-gray-900 border-gray-800 text-gray-300 hover:bg-gray-800"
                  }`}>
                  <p className="font-medium text-sm">{op.nombre} {op.apellido}</p>
                  <p className="text-xs opacity-70 truncate">{op.email}</p>
                </button>
              ))}
            </div>
          </div>
          {/* Tareas del operador seleccionado */}
          <div className="lg:col-span-3">
            {seleccionado ? (
              <>
                <div className="flex items-center gap-3 mb-4">
                  <h2 className="text-white font-semibold">Tareas del operador</h2>
                  <input type="date" value={fecha} onChange={e => setFecha(e.target.value)}
                    className="bg-gray-800 border border-gray-700 text-gray-300 text-sm rounded-lg px-3 py-1.5 ml-auto" />
                </div>
                {tareas.length === 0 ? (
                  <div className="text-center py-16 text-gray-500">Sin tareas para esta fecha</div>
                ) : (
                  <div className="space-y-2">
                    {tareas.map(t => (
                      <div key={t.id} className="bg-gray-900 border border-gray-800 rounded-xl px-4 py-3 flex items-center gap-4">
                        <div className="flex-1 min-w-0">
                          <p className="text-white font-medium text-sm truncate">{t.nombre}</p>
                          <p className="text-gray-500 text-xs">{t.cliente || "Sin cliente"}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className={`text-sm font-semibold ${ESTADO_COLOR[t.estado] || "text-gray-400"}`}>
                            {t.estado.replace("_"," ")}
                          </p>
                          {t.tiempo_trabajado_minutos > 0 && (
                            <p className="text-xs text-gray-500">
                              {Math.floor(t.tiempo_trabajado_minutos/60)}h {t.tiempo_trabajado_minutos%60}m
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <div className="flex items-center justify-center h-48 text-gray-600">
                <p>← Seleccioná un operador para ver sus tareas</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
