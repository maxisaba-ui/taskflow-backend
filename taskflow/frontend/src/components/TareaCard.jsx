// TaskFlow Pro — Componente TareaCard
// src/components/TareaCard.jsx

import { useState } from "react";
import { apiPost } from "../api/client";

const ESTADO_CONFIG = {
  pendiente:  { label: "Pendiente",  color: "bg-gray-700 text-gray-300",    dot: "bg-gray-400" },
  en_curso:   { label: "En curso",   color: "bg-green-900 text-green-300",   dot: "bg-green-400 animate-pulse" },
  pausada:    { label: "Pausada",    color: "bg-yellow-900 text-yellow-300", dot: "bg-yellow-400" },
  completada: { label: "Completada", color: "bg-blue-900 text-blue-300",     dot: "bg-blue-400" },
  vencida:    { label: "Vencida",    color: "bg-red-900 text-red-300",       dot: "bg-red-400" },
};

const PRIORIDAD_COLOR = {
  alta:  "border-l-red-500",
  media: "border-l-yellow-500",
  baja:  "border-l-gray-600",
};

export default function TareaCard({ tarea, onActualizar }) {
  const [cargando, setCargando] = useState(false);
  const [mostrarDetalle, setMostrarDetalle] = useState(false);
  const [motivoPausa, setMotivoPausa] = useState("");
  const [pedirMotivo, setPedirMotivo] = useState(false);
  const [comentarioFinal, setComentarioFinal] = useState("");
  const [pedirFinalizar, setPedirFinalizar] = useState(false);
  const [error, setError] = useState("");

  const cfg = ESTADO_CONFIG[tarea.estado] || ESTADO_CONFIG.pendiente;
  const borderColor = PRIORIDAD_COLOR[tarea.prioridad] || PRIORIDAD_COLOR.media;

  const mins = tarea.tiempo_trabajado_minutos || 0;
  const tiempoStr = mins > 0
    ? `${Math.floor(mins / 60)}h ${String(mins % 60).padStart(2, "0")}m`
    : null;

  async function llamarApi(endpoint, datos = {}) {
    setCargando(true);
    setError("");
    try {
      await apiPost(endpoint, datos);
      onActualizar();
    } catch (e) {
      setError(e.message || "Error al comunicarse con el servidor");
    } finally {
      setCargando(false);
    }
  }

  function confirmarPausa() {
    if (!motivoPausa.trim()) return;
    setPedirMotivo(false);
    llamarApi(`/tareas/${tarea.id}/pausar`, { motivo: motivoPausa });
    setMotivoPausa("");
  }

  function confirmarFinalizar() {
    setPedirFinalizar(false);
    llamarApi(`/tareas/${tarea.id}/finalizar`, { comentario_operador: comentarioFinal || null });
    setComentarioFinal("");
  }

  return (
    <div className={`bg-gray-900 rounded-xl border border-gray-800 border-l-4 ${borderColor} overflow-hidden`}>
      {/* Cabecera de la card */}
      <div
        className="p-4 cursor-pointer hover:bg-gray-800/50 transition-colors"
        onClick={() => setMostrarDetalle(!mostrarDetalle)}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full ${cfg.color}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`}></span>
                {cfg.label}
              </span>
              {tarea.es_heredada && (
                <span className="text-xs bg-purple-900/50 text-purple-300 px-2 py-0.5 rounded-full">
                  🔁 Heredada
                </span>
              )}
            </div>
            <h3 className="text-white font-semibold text-base leading-tight truncate">
              {tarea.nombre}
            </h3>
            {tarea.cliente && (
              <p className="text-gray-400 text-sm mt-0.5 truncate">
                📁 {tarea.cliente}
              </p>
            )}
          </div>
          {tiempoStr && (
            <div className="text-right shrink-0">
              <span className="text-indigo-400 font-mono text-sm font-bold">
                ⏱ {tiempoStr}
              </span>
            </div>
          )}
        </div>

        {/* Comentario del supervisor */}
        {tarea.comentario_supervisor && (
          <div className="mt-2 bg-indigo-950/50 rounded-lg px-3 py-2">
            <p className="text-indigo-300 text-xs italic">
              💬 {tarea.comentario_supervisor}
            </p>
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="px-4 pb-2">
          <p className="text-red-400 text-xs bg-red-950/50 rounded p-2">{error}</p>
        </div>
      )}

      {/* Botones de acción */}
      <div className="px-4 pb-4 flex flex-wrap gap-2">
        {tarea.estado === "pendiente" && (
          <BtnAccion
            onClick={() => llamarApi(`/tareas/${tarea.id}/iniciar`)}
            color="green"
            disabled={cargando}
          >
            ▶ Iniciar
          </BtnAccion>
        )}

        {tarea.estado === "en_curso" && (
          <>
            <BtnAccion onClick={() => setPedirMotivo(true)} color="yellow" disabled={cargando}>
              ⏸ Pausar
            </BtnAccion>
            <BtnAccion onClick={() => setPedirFinalizar(true)} color="blue" disabled={cargando}>
              ⏹ Finalizar
            </BtnAccion>
          </>
        )}

        {tarea.estado === "pausada" && (
          <>
            <BtnAccion
              onClick={() => llamarApi(`/tareas/${tarea.id}/reanudar`)}
              color="green"
              disabled={cargando}
            >
              ▶ Reanudar
            </BtnAccion>
            <BtnAccion onClick={() => setPedirFinalizar(true)} color="blue" disabled={cargando}>
              ⏹ Finalizar
            </BtnAccion>
          </>
        )}

        {cargando && (
          <span className="text-gray-500 text-sm flex items-center gap-2">
            <span className="animate-spin text-indigo-400">⟳</span> Procesando...
          </span>
        )}
      </div>

      {/* Detalle expandido */}
      {mostrarDetalle && (
        <div className="border-t border-gray-800 px-4 py-3 bg-gray-900/50">
          <div className="grid grid-cols-2 gap-2 text-xs text-gray-400">
            <span>Prioridad: <b className="text-gray-200">{tarea.prioridad}</b></span>
            <span>Tipo: <b className="text-gray-200">{tarea.tipo_creacion}</b></span>
            {tarea.inicio_real && (
              <span>Inicio real: <b className="text-gray-200">{new Date(tarea.inicio_real).toLocaleTimeString("es-AR")}</b></span>
            )}
            {tarea.fin_real && (
              <span>Fin real: <b className="text-gray-200">{new Date(tarea.fin_real).toLocaleTimeString("es-AR")}</b></span>
            )}
          </div>
          {tarea.comentario_operador && (
            <p className="mt-2 text-xs text-gray-400 italic">
              Operador: {tarea.comentario_operador}
            </p>
          )}
        </div>
      )}

      {/* Modal: motivo de pausa */}
      {pedirMotivo && (
        <div className="border-t border-yellow-800/50 bg-yellow-950/30 px-4 py-3">
          <p className="text-yellow-300 text-sm font-medium mb-2">¿Por qué pausás esta tarea?</p>
          <textarea
            className="w-full bg-gray-800 text-gray-200 text-sm rounded-lg p-2 border border-gray-700 resize-none"
            rows={2}
            placeholder="Ej: Reunión de equipo, llamada de cliente..."
            value={motivoPausa}
            onChange={(e) => setMotivoPausa(e.target.value)}
            autoFocus
          />
          <div className="flex gap-2 mt-2">
            <button
              onClick={() => setPedirMotivo(false)}
              className="text-sm text-gray-400 hover:text-gray-200 px-3 py-1"
            >
              Cancelar
            </button>
            <button
              onClick={confirmarPausa}
              disabled={!motivoPausa.trim()}
              className="bg-yellow-600 hover:bg-yellow-700 disabled:opacity-40 text-white text-sm px-4 py-1 rounded-lg font-medium"
            >
              Confirmar pausa
            </button>
          </div>
        </div>
      )}

      {/* Modal: comentario al finalizar */}
      {pedirFinalizar && (
        <div className="border-t border-blue-800/50 bg-blue-950/30 px-4 py-3">
          <p className="text-blue-300 text-sm font-medium mb-2">Finalizar tarea (comentario opcional)</p>
          <textarea
            className="w-full bg-gray-800 text-gray-200 text-sm rounded-lg p-2 border border-gray-700 resize-none"
            rows={2}
            placeholder="¿Algo que quieras registrar sobre esta tarea?"
            value={comentarioFinal}
            onChange={(e) => setComentarioFinal(e.target.value)}
          />
          <div className="flex gap-2 mt-2">
            <button
              onClick={() => setPedirFinalizar(false)}
              className="text-sm text-gray-400 hover:text-gray-200 px-3 py-1"
            >
              Cancelar
            </button>
            <button
              onClick={confirmarFinalizar}
              className="bg-blue-600 hover:bg-blue-700 text-white text-sm px-4 py-1 rounded-lg font-medium"
            >
              ✅ Finalizar tarea
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function BtnAccion({ children, onClick, color, disabled }) {
  const colores = {
    green:  "bg-green-700 hover:bg-green-600 text-white",
    yellow: "bg-yellow-700 hover:bg-yellow-600 text-white",
    blue:   "bg-blue-700 hover:bg-blue-600 text-white",
    red:    "bg-red-700 hover:bg-red-600 text-white",
  };
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors disabled:opacity-40 ${colores[color]}`}
    >
      {children}
    </button>
  );
}
