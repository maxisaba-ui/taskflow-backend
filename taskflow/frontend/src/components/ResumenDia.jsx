// src/components/ResumenDia.jsx
export default function ResumenDia({ estadisticas, fecha }) {
  const pct = estadisticas.total > 0
    ? Math.round(estadisticas.completadas / estadisticas.total * 100)
    : 0;
  const hs = Math.floor(estadisticas.minutosHoy / 60);
  const ms = estadisticas.minutosHoy % 60;

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
      <h3 className="text-white font-semibold mb-4">Resumen del día</h3>
      <p className="text-gray-500 text-xs mb-4">
        {new Date(fecha + "T12:00:00").toLocaleDateString("es-AR", { weekday:"long", day:"numeric", month:"long" })}
      </p>

      {/* Barra de progreso */}
      <div className="mb-4">
        <div className="flex justify-between text-xs text-gray-400 mb-1">
          <span>Completadas</span>
          <span className="font-bold text-white">{pct}%</span>
        </div>
        <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-indigo-500 rounded-full transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* Stats */}
      <div className="space-y-2">
        {[
          { label: "Total de tareas",   valor: estadisticas.total,       color: "text-white" },
          { label: "Completadas",       valor: estadisticas.completadas,  color: "text-green-400" },
          { label: "En curso",          valor: estadisticas.enCurso,      color: "text-blue-400" },
          { label: "Pausadas",          valor: estadisticas.pausadas,     color: "text-yellow-400" },
          { label: "Pendientes",        valor: estadisticas.pendientes,   color: "text-gray-400" },
          { label: "Vencidas",          valor: estadisticas.vencidas,     color: "text-red-400" },
          { label: "Tiempo registrado", valor: `${hs}h ${ms}m`,          color: "text-indigo-400" },
        ].map(({ label, valor, color }) => (
          <div key={label} className="flex justify-between items-center">
            <span className="text-gray-400 text-sm">{label}</span>
            <span className={`font-bold text-sm ${color}`}>{valor}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
