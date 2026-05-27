// src/pages/Reportes.jsx — Panel de reportes con gráficos
import { useState, useEffect } from "react";
import { apiGet } from "../api/client";
import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid
} from "recharts";

const MESES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio",
                "Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];

export default function Reportes() {
  const hoy = new Date();
  const [anio, setAnio] = useState(hoy.getFullYear());
  const [mes, setMes] = useState(hoy.getMonth() + 1);
  const [datosRubro, setDatosRubro] = useState(null);
  const [datosCliente, setDatosCliente] = useState(null);
  const [datosComparativo, setDatosComparativo] = useState(null);
  const [cargando, setCargando] = useState(false);

  useEffect(() => { cargarTodos(); }, [anio, mes]);

  async function cargarTodos() {
    setCargando(true);
    try {
      const [rubro, cliente, comp] = await Promise.all([
        apiGet(`/reportes/por-rubro?anio=${anio}&mes=${mes}`),
        apiGet(`/reportes/por-cliente?anio=${anio}&mes=${mes}`),
        apiGet(`/reportes/comparativo-operadores?anio=${anio}&mes=${mes}`),
      ]);
      setDatosRubro(rubro);
      setDatosCliente(cliente);
      setDatosComparativo(comp);
    } catch (e) { console.error(e); }
    finally { setCargando(false); }
  }

  return (
    <div className="min-h-screen bg-gray-950 p-6">
      <div className="max-w-7xl mx-auto">

        {/* Encabezado */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white">📊 Reportes</h1>
            <p className="text-gray-400 text-sm mt-1">Métricas y análisis de rendimiento</p>
          </div>
          <div className="flex gap-3">
            <select
              value={mes}
              onChange={e => setMes(Number(e.target.value))}
              className="bg-gray-800 border border-gray-700 text-gray-300 text-sm rounded-lg px-3 py-2"
            >
              {MESES.map((m, i) => <option key={i+1} value={i+1}>{m}</option>)}
            </select>
            <select
              value={anio}
              onChange={e => setAnio(Number(e.target.value))}
              className="bg-gray-800 border border-gray-700 text-gray-300 text-sm rounded-lg px-3 py-2"
            >
              {[2024,2025,2026].map(a => <option key={a} value={a}>{a}</option>)}
            </select>
            <button
              onClick={cargarTodos}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium"
            >
              Actualizar
            </button>
          </div>
        </div>

        {cargando ? (
          <div className="flex justify-center py-20">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-500"></div>
          </div>
        ) : (
          <div className="space-y-6">

            {/* FILA 1: Torta por rubro + Barras por operador */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

              {/* Distribución por rubro */}
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                <h2 className="text-white font-semibold mb-1">Tiempo por rubro</h2>
                <p className="text-gray-500 text-xs mb-4">
                  Total: {datosRubro?.total_horas?.toFixed(1) ?? 0}h en {MESES[mes-1]} {anio}
                </p>
                {datosRubro?.rubros?.length > 0 ? (
                  <>
                    <ResponsiveContainer width="100%" height={220}>
                      <PieChart>
                        <Pie
                          data={datosRubro.rubros}
                          dataKey="horas"
                          nameKey="rubro"
                          cx="50%" cy="50%"
                          outerRadius={85}
                          label={({ rubro, porcentaje }) => `${rubro} ${porcentaje}%`}
                          labelLine={false}
                        >
                          {datosRubro.rubros.map((r, i) => (
                            <Cell key={i} fill={r.color || "#6366f1"} />
                          ))}
                        </Pie>
                        <Tooltip formatter={v => `${v}h`} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="mt-3 space-y-1">
                      {datosRubro.rubros.map((r, i) => (
                        <div key={i} className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2">
                            <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: r.color }}></div>
                            <span className="text-gray-300">{r.rubro}</span>
                          </div>
                          <span className="text-gray-400">{r.horas}h ({r.porcentaje}%)</span>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <p className="text-gray-500 text-sm text-center py-10">Sin datos para este período</p>
                )}
              </div>

              {/* Comparativo operadores */}
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                <h2 className="text-white font-semibold mb-1">Horas por operador</h2>
                <p className="text-gray-500 text-xs mb-4">{MESES[mes-1]} {anio}</p>
                {datosComparativo?.operadores?.length > 0 ? (
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={datosComparativo.operadores} margin={{ top: 5, right: 10, left: 0, bottom: 40 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                      <XAxis
                        dataKey="operador"
                        tick={{ fill: "#9CA3AF", fontSize: 11 }}
                        angle={-30}
                        textAnchor="end"
                        interval={0}
                      />
                      <YAxis tick={{ fill: "#9CA3AF", fontSize: 11 }} />
                      <Tooltip
                        contentStyle={{ backgroundColor: "#1F2937", border: "1px solid #374151", borderRadius: 8 }}
                        labelStyle={{ color: "#F9FAFB" }}
                        formatter={v => [`${v}h`, "Horas"]}
                      />
                      <Bar dataKey="horas_trabajadas" fill="#6366f1" radius={[4,4,0,0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-gray-500 text-sm text-center py-10">Sin datos para este período</p>
                )}
              </div>
            </div>

            {/* FILA 2: Tabla de operadores */}
            {datosComparativo?.operadores?.length > 0 && (
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                <h2 className="text-white font-semibold mb-4">Detalle por operador — {MESES[mes-1]} {anio}</h2>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-gray-400 border-b border-gray-800">
                        <th className="text-left py-2 pr-4">Operador</th>
                        <th className="text-right py-2 pr-4">Tareas totales</th>
                        <th className="text-right py-2 pr-4">Completadas</th>
                        <th className="text-right py-2 pr-4">Vencidas</th>
                        <th className="text-right py-2 pr-4">% Cumplimiento</th>
                        <th className="text-right py-2 pr-4">Horas</th>
                        <th className="text-right py-2">Clientes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {datosComparativo.operadores.map((op, i) => (
                        <tr key={i} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                          <td className="py-3 pr-4 text-white font-medium">{op.operador}</td>
                          <td className="py-3 pr-4 text-right text-gray-300">{op.total_tareas}</td>
                          <td className="py-3 pr-4 text-right text-green-400">{op.completadas}</td>
                          <td className="py-3 pr-4 text-right text-red-400">{op.vencidas}</td>
                          <td className="py-3 pr-4 text-right">
                            <span className={`font-bold ${
                              op.porcentaje_cumplimiento >= 90 ? "text-green-400" :
                              op.porcentaje_cumplimiento >= 70 ? "text-yellow-400" : "text-red-400"
                            }`}>
                              {op.porcentaje_cumplimiento}%
                            </span>
                          </td>
                          <td className="py-3 pr-4 text-right text-indigo-400 font-mono">{op.horas_trabajadas}h</td>
                          <td className="py-3 text-right text-gray-300">{op.clientes_atendidos}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* FILA 3: Tabla de clientes */}
            {datosCliente?.clientes?.length > 0 && (
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                <h2 className="text-white font-semibold mb-4">Tiempo por cliente — {MESES[mes-1]} {anio}</h2>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-gray-400 border-b border-gray-800">
                        <th className="text-left py-2 pr-4">Cliente</th>
                        <th className="text-right py-2 pr-4">Horas totales</th>
                        <th className="text-left py-2">Distribución por rubro</th>
                      </tr>
                    </thead>
                    <tbody>
                      {datosCliente.clientes.map((c, i) => (
                        <tr key={i} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                          <td className="py-3 pr-4 text-white font-medium">{c.cliente}</td>
                          <td className="py-3 pr-4 text-right text-indigo-400 font-mono font-bold">
                            {c.horas_totales}h
                          </td>
                          <td className="py-3">
                            <div className="flex flex-wrap gap-1">
                              {c.rubros.map((r, j) => (
                                <span
                                  key={j}
                                  className="text-xs px-2 py-0.5 rounded-full text-white"
                                  style={{ backgroundColor: r.color + "90" }}
                                >
                                  {r.rubro}: {r.horas}h
                                </span>
                              ))}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

          </div>
        )}
      </div>
    </div>
  );
}
