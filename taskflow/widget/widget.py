"""
TaskFlow Pro — Widget de Escritorio Windows
Framework: PyQt6
Versión: v2.0.0
Función: Controlar tareas (play/pausa/fin) + validaciones supervisor + Mi Jornada
Cambios v2.0.0:
  - Usa /tareas/para-widget en lugar de /tareas/ (nombres de campos correctos)
  - Detecta tareas de validación supervisor (✅ Validar:) y muestra Aceptar/Rechazar
  - Agrega DialogValidar con campo comentario y opciones devolver/desestimar
  - Agrega VistaJornada: timeline del día con CSV (botón en área de stats)
  - Agrupa etapas de la misma tarea compleja en VistaJornada (ítem 8)
  - Corrige nombres de campos: tarea_nombre, cliente_nombre, servicio_nombre
Instalación: pip install PyQt6 requests pyinstaller
Distribución: pyinstaller --onefile --windowed --icon=icon.ico widget.py
"""

import sys
import json
import csv
import io
import os
import socket
import requests
from datetime import datetime, date

# ── Control de instancia única ────────────────────────────────
# Abre un socket en un puerto local exclusivo. Si ya hay una instancia
# corriendo el bind falla y esta nueva instancia se cierra silenciosamente.
_instancia_socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
_instancia_socket.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 0)
try:
    _instancia_socket.bind(("127.0.0.1", 47291))
except OSError:
    sys.exit(0)  # Ya hay una instancia — salir sin mostrar error
from PyQt6.QtWidgets import (
    QApplication, QMainWindow, QWidget, QVBoxLayout, QHBoxLayout,
    QPushButton, QLabel, QListWidget, QListWidgetItem, QDialog,
    QTextEdit, QLineEdit, QSystemTrayIcon, QMenu, QMessageBox,
    QSplashScreen, QFrame, QScrollArea, QButtonGroup, QRadioButton,
    QFileDialog, QSizePolicy
)
from PyQt6.QtCore import Qt, QTimer, QThread, pyqtSignal, QSettings, QSize
from PyQt6.QtGui import QIcon, QColor, QPalette, QFont, QPixmap, QAction

# ============================================================
# CONFIGURACIÓN
# ============================================================
API_BASE_URL = "https://taskflow-backend-wtn8.onrender.com/api/v1"
APP_NAME = "TaskFlow Pro Widget"
VERSION = "2.0.0"

COLORES = {
    "pendiente":          "#6B7280",
    "en_curso":           "#10B981",
    "pausada":            "#F59E0B",
    "completada":         "#3B82F6",
    "validacion_pendiente":"#A855F7",
    "vencida":            "#EF4444",
    "fondo":              "#1F2937",
    "fondo_card":         "#374151",
    "fondo_validacion":   "#2D1B69",
    "texto":              "#F9FAFB",
    "texto_sec":          "#9CA3AF",
    "acento":             "#6366F1",
    "verde":              "#10B981",
    "rojo":               "#EF4444",
    "amarillo":           "#F59E0B",
}

# Color del borde superior según prioridad
PRIO_COLOR = {
    "urgente": "#EF4444",
    "alta":    "#F97316",
    "media":   "#EAB308",
    "baja":    "#22C55E",
}


# ============================================================
# HILO PARA LLAMADAS A LA API (no bloquea la UI)
# ============================================================
class ApiWorker(QThread):
    resultado = pyqtSignal(object)  # dict o list
    error     = pyqtSignal(str)

    def __init__(self, metodo, endpoint, datos=None, token=None):
        super().__init__()
        self.metodo   = metodo
        self.endpoint = endpoint
        self.datos    = datos
        self.token    = token

    def run(self):
        try:
            headers = {"Content-Type": "application/json"}
            if self.token:
                headers["Authorization"] = f"Bearer {self.token}"

            url = f"{API_BASE_URL}{self.endpoint}"

            if self.metodo == "GET":
                resp = requests.get(url, headers=headers, timeout=15)
            elif self.metodo == "POST":
                resp = requests.post(url, headers=headers, json=self.datos, timeout=15)
            elif self.metodo == "PUT":
                resp = requests.put(url, headers=headers, json=self.datos, timeout=15)

            if resp.status_code < 300:
                self.resultado.emit(resp.json() if resp.text else {})
            else:
                self.error.emit(f"Error {resp.status_code}: {resp.text[:200]}")

        except requests.exceptions.ConnectionError:
            self.error.emit("Sin conexión al servidor. Verificá tu internet.")
        except Exception as e:
            self.error.emit(str(e))


# ============================================================
# DIÁLOGO: Motivo de Pausa
# ============================================================
class DialogPausa(QDialog):
    def __init__(self, parent=None):
        super().__init__(parent)
        self.setWindowTitle("¿Por qué pausás la tarea?")
        self.setFixedSize(400, 200)
        self.setStyleSheet(f"background-color: {COLORES['fondo']}; color: {COLORES['texto']};")

        layout = QVBoxLayout(self)
        layout.setSpacing(12)
        layout.setContentsMargins(20, 20, 20, 20)

        lbl = QLabel("Motivo de la pausa:")
        lbl.setFont(QFont("Segoe UI", 11))
        layout.addWidget(lbl)

        self.texto = QTextEdit()
        self.texto.setPlaceholderText("Ej: Reunión con cliente, corte de luz, almuerzo...")
        self.texto.setMaximumHeight(80)
        self.texto.setStyleSheet(f"""
            QTextEdit {{
                background: {COLORES['fondo_card']};
                color: {COLORES['texto']};
                border: 1px solid #4B5563;
                border-radius: 6px;
                padding: 8px;
                font-size: 13px;
            }}
        """)
        layout.addWidget(self.texto)

        botones = QHBoxLayout()
        btn_cancelar  = QPushButton("Cancelar")
        btn_confirmar = QPushButton("Pausar tarea")
        btn_confirmar.clicked.connect(self.accept)
        btn_cancelar.clicked.connect(self.reject)
        btn_confirmar.setStyleSheet(f"""
            QPushButton {{
                background-color: {COLORES['pausada']};
                color: white; border: none;
                border-radius: 6px; padding: 8px 20px; font-weight: bold;
            }}
        """)
        botones.addWidget(btn_cancelar)
        botones.addWidget(btn_confirmar)
        layout.addLayout(botones)

    def obtener_motivo(self):
        return self.texto.toPlainText().strip()


# ============================================================
# DIÁLOGO: Validación de supervisor
# ============================================================
class DialogValidar(QDialog):
    """
    Permite al supervisor aprobar, rechazar (devolver al operador)
    o desestimar una etapa que está en validacion_pendiente.
    """
    def __init__(self, etapa_nombre: str, parent=None):
        super().__init__(parent)
        self.setWindowTitle(f"Validar: {etapa_nombre}")
        self.setFixedSize(460, 300)
        self.setStyleSheet(f"background-color: {COLORES['fondo']}; color: {COLORES['texto']};")

        self._accion  = "aprobar"   # aprobar | rechazar | desestimar
        self._comentario = ""

        layout = QVBoxLayout(self)
        layout.setSpacing(10)
        layout.setContentsMargins(20, 16, 20, 16)

        # Título
        lbl_tit = QLabel(f"📋 {etapa_nombre}")
        lbl_tit.setFont(QFont("Segoe UI", 11, QFont.Weight.Bold))
        lbl_tit.setWordWrap(True)
        layout.addWidget(lbl_tit)

        # Opciones de acción
        lbl_acc = QLabel("Decisión:")
        lbl_acc.setFont(QFont("Segoe UI", 10))
        layout.addWidget(lbl_acc)

        row_acc = QHBoxLayout()

        self.rb_aprobar    = QRadioButton("✅ Aprobar")
        self.rb_rechazar   = QRadioButton("🔁 Devolver al operador")
        self.rb_desestimar = QRadioButton("❌ Desestimar")

        # Estilo radios
        radio_style = f"color: {COLORES['texto']}; font-size: 12px;"
        self.rb_aprobar.setStyleSheet(radio_style)
        self.rb_rechazar.setStyleSheet(radio_style)
        self.rb_desestimar.setStyleSheet(radio_style)

        self.rb_aprobar.setChecked(True)
        self.rb_aprobar.toggled.connect(lambda c: c and self._set_accion("aprobar"))
        self.rb_rechazar.toggled.connect(lambda c: c and self._set_accion("rechazar"))
        self.rb_desestimar.toggled.connect(lambda c: c and self._set_accion("desestimar"))

        row_acc.addWidget(self.rb_aprobar)
        row_acc.addWidget(self.rb_rechazar)
        row_acc.addWidget(self.rb_desestimar)
        layout.addLayout(row_acc)

        # Campo de comentario (obligatorio para rechazar/desestimar)
        self.lbl_com = QLabel("Comentario (obligatorio para rechazar/desestimar):")
        self.lbl_com.setFont(QFont("Segoe UI", 10))
        self.lbl_com.setStyleSheet(f"color: {COLORES['texto_sec']};")
        layout.addWidget(self.lbl_com)

        self.texto = QTextEdit()
        self.texto.setPlaceholderText("Ej: Falta adjuntar el comprobante de pago...")
        self.texto.setMaximumHeight(80)
        self.texto.setStyleSheet(f"""
            QTextEdit {{
                background: {COLORES['fondo_card']};
                color: {COLORES['texto']};
                border: 1px solid #4B5563;
                border-radius: 6px;
                padding: 8px; font-size: 12px;
            }}
        """)
        layout.addWidget(self.texto)

        # Mensaje de error
        self.lbl_err = QLabel("")
        self.lbl_err.setStyleSheet("color: #FCA5A5; font-size: 11px;")
        layout.addWidget(self.lbl_err)

        # Botones
        row_btns = QHBoxLayout()
        btn_cancelar  = QPushButton("Cancelar")
        btn_cancelar.clicked.connect(self.reject)
        self.btn_confirmar = QPushButton("Confirmar")
        self.btn_confirmar.clicked.connect(self._confirmar)
        self.btn_confirmar.setStyleSheet(f"""
            QPushButton {{
                background-color: {COLORES['acento']};
                color: white; border: none;
                border-radius: 6px; padding: 8px 20px; font-weight: bold;
            }}
        """)
        row_btns.addWidget(btn_cancelar)
        row_btns.addWidget(self.btn_confirmar)
        layout.addLayout(row_btns)

    def _set_accion(self, accion: str):
        self._accion = accion
        # Para aprobar el comentario es opcional
        obligatorio = accion in ("rechazar", "desestimar")
        self.lbl_com.setStyleSheet(
            f"color: {'#FCA5A5' if obligatorio else COLORES['texto_sec']}; font-size: 10px;"
        )

    def _confirmar(self):
        comentario = self.texto.toPlainText().strip()
        if self._accion in ("rechazar", "desestimar") and not comentario:
            self.lbl_err.setText("⚠️ El comentario es obligatorio para rechazar o desestimar.")
            return
        self._comentario = comentario
        self.accept()

    def obtener_resultado(self):
        """Retorna (accion, comentario) donde accion = 'aprobar'|'rechazar'|'desestimar'."""
        return self._accion, self._comentario


# ============================================================
# DIÁLOGO: Fin de Jornada
# ============================================================
class DialogFinJornada(QDialog):
    def __init__(self, hora_esperada: str, parent=None):
        super().__init__(parent)
        self.setWindowTitle("Cerrar jornada")
        self.setFixedSize(420, 260)
        self.setStyleSheet(f"background-color: {COLORES['fondo']}; color: {COLORES['texto']};")

        layout = QVBoxLayout(self)
        layout.setSpacing(12)
        layout.setContentsMargins(20, 20, 20, 20)

        ahora    = datetime.now().strftime("%H:%M")
        diff_msg = ""
        self.tipo = "normal"
        try:
            h_esp      = datetime.strptime(hora_esperada, "%H:%M")
            h_ahora    = datetime.now().replace(second=0, microsecond=0)
            h_esp_full = h_ahora.replace(hour=h_esp.hour, minute=h_esp.minute)
            diff       = (h_ahora - h_esp_full).total_seconds() / 60
            if diff < -15:
                diff_msg  = f"⚠️ Cerrás {int(abs(diff))} min antes de tu horario ({hora_esperada})"
                self.tipo = "anticipado"
            elif diff > 15:
                diff_msg  = f"⏰ Cerrás {int(diff)} min después de tu horario ({hora_esperada})"
                self.tipo = "horas_extra"
            else:
                diff_msg  = "✅ Cerrás en horario normal"
        except Exception:
            diff_msg = f"Hora actual: {ahora}"

        lbl_diff = QLabel(diff_msg)
        lbl_diff.setFont(QFont("Segoe UI", 10))
        lbl_diff.setWordWrap(True)
        layout.addWidget(lbl_diff)

        lbl = QLabel("Comentario de cierre (opcional):")
        lbl.setFont(QFont("Segoe UI", 11))
        layout.addWidget(lbl)

        self.comentario = QTextEdit()
        self.comentario.setPlaceholderText(
            "Ej: Terminé antes por cita médica / Horas extra autorizadas por gerencia..."
        )
        self.comentario.setMaximumHeight(80)
        self.comentario.setStyleSheet(f"""
            QTextEdit {{
                background: {COLORES['fondo_card']};
                color: {COLORES['texto']};
                border: 1px solid #4B5563;
                border-radius: 6px; padding: 8px; font-size: 13px;
            }}
        """)
        layout.addWidget(self.comentario)

        botones = QHBoxLayout()
        btn_cancelar = QPushButton("Cancelar")
        btn_cancelar.clicked.connect(self.reject)
        btn_cerrar = QPushButton("🔚 Cerrar jornada")
        btn_cerrar.clicked.connect(self.accept)
        btn_cerrar.setStyleSheet(f"""
            QPushButton {{
                background-color: {COLORES['acento']};
                color: white; border: none;
                border-radius: 6px; padding: 8px 20px;
                font-weight: bold; font-size: 13px;
            }}
        """)
        botones.addWidget(btn_cancelar)
        botones.addWidget(btn_cerrar)
        layout.addLayout(botones)

    def obtener_datos(self):
        return {"tipo": self.tipo, "comentario": self.comentario.toPlainText().strip()}


# ============================================================
# CARD de tarea — detecta tipo y muestra botones apropiados
# ============================================================
class TareaCard(QFrame):
    signal_iniciar      = pyqtSignal(str)
    signal_pausar       = pyqtSignal(str)
    signal_reanudar     = pyqtSignal(str)
    signal_finalizar    = pyqtSignal(str)
    signal_iniciar_etapa   = pyqtSignal(str)
    signal_pausar_etapa    = pyqtSignal(str)
    signal_reanudar_etapa  = pyqtSignal(str)
    signal_finalizar_etapa = pyqtSignal(str)
    signal_validar      = pyqtSignal(str, str)  # (tarea_id, etapa_id)

    def __init__(self, item: dict, parent=None):
        super().__init__(parent)
        # item puede ser tarea_simple o etapa_compleja (viene de /para-widget)
        self.item_id    = item.get("id", "")
        self.item       = item
        self._construir_ui()

    def _construir_ui(self):
        tipo      = self.item.get("tipo", "tarea_simple")
        estado    = self.item.get("estado", "pendiente")
        nombre    = self.item.get("tarea_nombre", "Sin nombre")
        cliente   = self.item.get("cliente_nombre") or self.item.get("servicio_nombre") or "—"
        prioridad = self.item.get("prioridad", "media")

        color_estado    = COLORES.get(estado, COLORES["pendiente"])
        color_prioridad = PRIO_COLOR.get(prioridad, "#EAB308")

        es_validacion = (
            nombre.startswith("✅ Validar:") and
            self.item.get("etapa_id_validacion") is not None
        )
        if es_validacion:
            fondo_card = COLORES["fondo_validacion"]
        elif tipo == "etapa_compleja":
            fondo_card = "#1A1533"
        else:
            fondo_card = COLORES["fondo_card"]

        # Borde superior = color de prioridad; sin borde izquierdo
        self.setStyleSheet(f"""
            QFrame {{
                background-color: {fondo_card};
                border-radius: 10px;
                border-top: 4px solid {color_prioridad};
                margin: 4px 2px;
            }}
        """)

        layout = QVBoxLayout(self)
        layout.setContentsMargins(12, 10, 12, 10)
        layout.setSpacing(4)

        # Header especial para etapas de tarea compleja
        if tipo == "etapa_compleja":
            etapa_ord = self.item.get("etapa_orden", "?")
            total_et  = self.item.get("total_etapas", "?")
            etapa_nom = self.item.get("etapa_nombre", "")

            # Bloque violeta que identifica visualmente la tarea compleja
            header_frame = QFrame()
            header_frame.setStyleSheet("""
                QFrame {
                    background: #2D1B69;
                    border-radius: 6px;
                    border: 1px solid #7C3AED;
                }
            """)
            lay_h = QVBoxLayout(header_frame)
            lay_h.setContentsMargins(8, 5, 8, 5)
            lay_h.setSpacing(2)

            lbl_tipo_badge = QLabel("🔀  TAREA COMPLEJA")
            lbl_tipo_badge.setFont(QFont("Segoe UI", 8, QFont.Weight.Bold))
            lbl_tipo_badge.setStyleSheet("color: #A78BFA; border: none;")
            lay_h.addWidget(lbl_tipo_badge)

            lbl_nombre_complejo = QLabel(nombre)
            lbl_nombre_complejo.setFont(QFont("Segoe UI", 11, QFont.Weight.Bold))
            lbl_nombre_complejo.setStyleSheet("color: #EDE9FE; border: none;")
            lbl_nombre_complejo.setWordWrap(True)
            lay_h.addWidget(lbl_nombre_complejo)

            layout.addWidget(header_frame)

            # Paso actual — prominente
            lbl_paso = QLabel(f"   ↳  Paso {etapa_ord} de {total_et}:  {etapa_nom}")
            lbl_paso.setFont(QFont("Segoe UI", 11, QFont.Weight.Bold))
            lbl_paso.setStyleSheet("color: #C4B5FD; border: none;")
            lbl_paso.setWordWrap(True)
            layout.addWidget(lbl_paso)

        else:
            lbl_nombre = QLabel(nombre)
            lbl_nombre.setFont(QFont("Segoe UI", 12, QFont.Weight.Bold))
            lbl_nombre.setStyleSheet(f"color: {COLORES['texto']}; border: none;")
            lbl_nombre.setWordWrap(True)
            layout.addWidget(lbl_nombre)

        # Fila meta: cliente · prioridad · estado
        row_meta = QHBoxLayout()
        heredada_txt = "  🔁" if self.item.get("es_heredada") else ""
        lbl_info = QLabel(f"📁 {cliente}{heredada_txt}")
        lbl_info.setFont(QFont("Segoe UI", 10))
        lbl_info.setStyleSheet(f"color: {COLORES['texto_sec']}; border: none;")
        row_meta.addWidget(lbl_info)
        row_meta.addStretch()

        lbl_prio = QLabel(f"● {prioridad.upper()}")
        lbl_prio.setFont(QFont("Segoe UI", 9, QFont.Weight.Bold))
        lbl_prio.setStyleSheet(f"color: {color_prioridad}; border: none;")
        row_meta.addWidget(lbl_prio)

        lbl_est = QLabel(f"  {estado.replace('_', ' ').upper()}")
        lbl_est.setFont(QFont("Segoe UI", 8))
        lbl_est.setStyleSheet(f"color: {color_estado}; border: none;")
        row_meta.addWidget(lbl_est)
        layout.addLayout(row_meta)

        # Tiempo trabajado
        mins = self.item.get("tiempo_trabajado_minutos") or 0
        if mins > 0:
            hs = mins // 60; ms = mins % 60
            lbl_t = QLabel(f"⏱ {hs}h {ms:02d}m trabajados")
            lbl_t.setFont(QFont("Segoe UI", 10))
            lbl_t.setStyleSheet(f"color: {color_estado}; border: none;")
            layout.addWidget(lbl_t)

        # Comentario del supervisor
        com_sup = self.item.get("comentario_supervisor") or ""
        if com_sup:
            lbl_sup = QLabel(f"👤 Supervisor: {com_sup}")
            lbl_sup.setFont(QFont("Segoe UI", 9))
            lbl_sup.setStyleSheet("color: #93C5FD; border: none; font-style: italic;")
            lbl_sup.setWordWrap(True)
            layout.addWidget(lbl_sup)

        # Comentario del operador
        com_op = self.item.get("comentario_operador") or ""
        if com_op:
            lbl_op = QLabel(f"💬 {com_op}")
            lbl_op.setFont(QFont("Segoe UI", 9))
            lbl_op.setStyleSheet(f"color: {COLORES['texto_sec']}; border: none; font-style: italic;")
            lbl_op.setWordWrap(True)
            layout.addWidget(lbl_op)

        # Aviso de corrección pendiente
        if self.item.get("requiere_correccion"):
            com_val = self.item.get("comentario_validacion") or ""
            lbl_rech = QLabel(f"⚠️ Corregir: {com_val}")
            lbl_rech.setFont(QFont("Segoe UI", 9))
            lbl_rech.setStyleSheet("color: #FCA5A5; border: none; font-weight: bold;")
            lbl_rech.setWordWrap(True)
            layout.addWidget(lbl_rech)

        # Botones de acción
        row_btns = QHBoxLayout()
        row_btns.setSpacing(6)

        if es_validacion:
            etapa_id_val = self.item.get("etapa_id_validacion", "")
            btn_ok = self._crear_boton("✅ Aceptar", COLORES["verde"])
            btn_ok.clicked.connect(
                lambda _, eid=etapa_id_val: self.signal_validar.emit(self.item_id, eid)
            )
            row_btns.addWidget(btn_ok)
            btn_rech = self._crear_boton("❌ Rechazar", COLORES["rojo"])
            btn_rech.clicked.connect(
                lambda _, eid=etapa_id_val: self.signal_validar.emit("rechazar:" + self.item_id, eid)
            )
            row_btns.addWidget(btn_rech)

        elif tipo == "etapa_compleja":
            etapa_id = self.item_id
            if estado == "pendiente":
                btn = self._crear_boton("▶ Iniciar paso", COLORES["en_curso"])
                btn.clicked.connect(lambda _, eid=etapa_id: self.signal_iniciar_etapa.emit(eid))
                row_btns.addWidget(btn)
            elif estado == "en_curso":
                btn_p = self._crear_boton("⏸ Pausar", COLORES["pausada"])
                btn_f = self._crear_boton("⏹ Finalizar paso", COLORES["completada"])
                btn_p.clicked.connect(lambda _, eid=etapa_id: self.signal_pausar_etapa.emit(eid))
                btn_f.clicked.connect(lambda _, eid=etapa_id: self.signal_finalizar_etapa.emit(eid))
                row_btns.addWidget(btn_p)
                row_btns.addWidget(btn_f)
            elif estado == "pausada":
                btn_r = self._crear_boton("▶ Reanudar paso", COLORES["en_curso"])
                btn_r.clicked.connect(lambda _, eid=etapa_id: self.signal_reanudar_etapa.emit(eid))
                row_btns.addWidget(btn_r)
            elif estado == "validacion_pendiente":
                lbl_val = QLabel("⏳ Esperando validación del supervisor")
                lbl_val.setStyleSheet(f"color: {COLORES['validacion_pendiente']}; border: none; font-size: 11px;")
                row_btns.addWidget(lbl_val)
            elif estado == "completada":
                lbl_ok = QLabel("✅ Paso completado")
                lbl_ok.setStyleSheet(f"color: {COLORES['completada']}; border: none; font-weight: bold;")
                row_btns.addWidget(lbl_ok)

        else:
            tid = self.item_id
            if estado == "pendiente":
                btn = self._crear_boton("▶ Iniciar", COLORES["en_curso"])
                btn.clicked.connect(lambda _, t=tid: self.signal_iniciar.emit(t))
                row_btns.addWidget(btn)
            elif estado == "en_curso":
                btn_p = self._crear_boton("⏸ Pausar",    COLORES["pausada"])
                btn_f = self._crear_boton("⏹ Finalizar", COLORES["completada"])
                btn_p.clicked.connect(lambda _, t=tid: self.signal_pausar.emit(t))
                btn_f.clicked.connect(lambda _, t=tid: self.signal_finalizar.emit(t))
                row_btns.addWidget(btn_p)
                row_btns.addWidget(btn_f)
            elif estado == "pausada":
                # Solo Reanudar — no se puede finalizar desde estado pausada
                btn_r = self._crear_boton("▶ Reanudar", COLORES["en_curso"])
                btn_r.clicked.connect(lambda _, t=tid: self.signal_reanudar.emit(t))
                row_btns.addWidget(btn_r)
            elif estado == "completada":
                lbl_ok = QLabel("✅ Completada")
                lbl_ok.setStyleSheet(f"color: {COLORES['completada']}; border: none; font-weight: bold;")
                row_btns.addWidget(lbl_ok)

        layout.addLayout(row_btns)

    def _crear_boton(self, texto: str, color: str) -> QPushButton:
        btn = QPushButton(texto)
        btn.setFixedHeight(32)
        btn.setFont(QFont("Segoe UI", 10, QFont.Weight.Bold))
        btn.setStyleSheet(f"""
            QPushButton {{
                background-color: {color};
                color: white; border: none;
                border-radius: 6px; padding: 4px 12px;
            }}
            QPushButton:hover {{ opacity: 0.85; }}
        """)
        return btn


# ============================================================
# DIÁLOGO: Vista Mi Jornada (timeline + CSV)
# ============================================================
class VistaJornada(QDialog):
    """
    Muestra la línea de tiempo de la jornada del día.
    El botón CSV está en la barra de stats (no en extremo derecho).
    Las etapas de la misma tarea compleja se agrupan en un bloque expandible.
    """

    def __init__(self, token: str, parent=None):
        super().__init__(parent)
        self.token   = token
        self.items   = []
        self.workers = []

        self.setWindowTitle("Mi Jornada — TaskFlow Pro")
        self.setFixedWidth(500)
        self.setMinimumHeight(500)
        self.setMaximumHeight(900)
        self.setStyleSheet(f"background-color: {COLORES['fondo']}; color: {COLORES['texto']};")

        self._construir_ui()
        self._cargar()

    def _construir_ui(self):
        main = QVBoxLayout(self)
        main.setContentsMargins(14, 14, 14, 14)
        main.setSpacing(10)

        # ── Encabezado ──────────────────────────────────────
        row_header = QHBoxLayout()
        lbl_tit = QLabel("📅  Mi Jornada")
        lbl_tit.setFont(QFont("Segoe UI", 14, QFont.Weight.Bold))
        lbl_tit.setStyleSheet(f"color: {COLORES['acento']};")

        self.lbl_fecha = QLabel(datetime.now().strftime("%A %d/%m/%Y"))
        self.lbl_fecha.setFont(QFont("Segoe UI", 10))
        self.lbl_fecha.setStyleSheet(f"color: {COLORES['texto_sec']};")

        row_header.addWidget(lbl_tit)
        row_header.addStretch()
        row_header.addWidget(self.lbl_fecha)
        main.addLayout(row_header)

        # ── Barra de stats + CSV (ítem 5: botón en área de stats, no extremo derecho) ──
        self.row_stats = QHBoxLayout()
        self.row_stats.setSpacing(8)

        # Stats se llenan en _actualizar_stats()
        self.lbl_total   = self._crear_stat_lbl("—", "Total")
        self.lbl_completadas = self._crear_stat_lbl("—", "Completadas")
        self.lbl_tiempo  = self._crear_stat_lbl("—h —m", "Trabajados")

        self.row_stats.addWidget(self.lbl_total)
        self.row_stats.addWidget(self.lbl_completadas)
        self.row_stats.addWidget(self.lbl_tiempo)

        # Botón CSV junto a los stats (ítem 5: no separado al extremo)
        btn_csv = QPushButton("⬇ CSV")
        btn_csv.setFixedHeight(36)
        btn_csv.setFont(QFont("Segoe UI", 10))
        btn_csv.setStyleSheet(f"""
            QPushButton {{
                background-color: #064E3B;
                color: #6EE7B7;
                border: 1px solid #059669;
                border-radius: 6px;
                padding: 4px 12px;
            }}
            QPushButton:hover {{ background-color: #065F46; }}
        """)
        btn_csv.clicked.connect(self._exportar_csv)
        btn_csv.setToolTip("Exportar jornada a CSV")
        self.row_stats.addWidget(btn_csv)

        main.addLayout(self.row_stats)

        # ── Área scrollable de items ────────────────────────
        scroll = QScrollArea()
        scroll.setWidgetResizable(True)
        scroll.setStyleSheet("QScrollArea { border: none; }")

        self.contenedor = QWidget()
        self.layout_items = QVBoxLayout(self.contenedor)
        self.layout_items.setSpacing(4)
        self.layout_items.addStretch()

        scroll.setWidget(self.contenedor)
        main.addWidget(scroll)

        # Botón actualizar
        btn_ref = QPushButton("🔄 Actualizar")
        btn_ref.setFixedHeight(30)
        btn_ref.setFont(QFont("Segoe UI", 9))
        btn_ref.setStyleSheet(f"background: transparent; color: {COLORES['texto_sec']}; border: 1px solid #4B5563; border-radius: 5px;")
        btn_ref.clicked.connect(self._cargar)
        main.addWidget(btn_ref)

    def _crear_stat_lbl(self, valor: str, etiqueta: str) -> QWidget:
        """Crea un widget stat pequeño para la barra de resumen."""
        w = QFrame()
        w.setStyleSheet("QFrame { background: #111827; border-radius: 6px; border: 1px solid #374151; padding: 4px; }")
        lay = QVBoxLayout(w)
        lay.setContentsMargins(8, 4, 8, 4)
        lay.setSpacing(1)
        lbl_v = QLabel(valor)
        lbl_v.setFont(QFont("Segoe UI", 14, QFont.Weight.Bold))
        lbl_v.setStyleSheet("color: #A5B4FC; border: none;")
        lbl_v.setObjectName("valor")
        lbl_e = QLabel(etiqueta)
        lbl_e.setFont(QFont("Segoe UI", 9))
        lbl_e.setStyleSheet(f"color: {COLORES['texto_sec']}; border: none;")
        lay.addWidget(lbl_v)
        lay.addWidget(lbl_e)
        return w

    def _cargar(self):
        """Llama al endpoint /tareas/para-jornada con fecha local de la máquina."""
        fecha_local = date.today().isoformat()  # fecha local Windows, no UTC del servidor
        w = ApiWorker("GET", f"/tareas/para-jornada?fecha={fecha_local}", token=self.token)
        w.resultado.connect(self._mostrar)
        w.error.connect(lambda msg: self._mostrar_error(msg))
        self.workers.append(w)
        w.start()

    def _mostrar(self, data):
        self.items = data if isinstance(data, list) else []
        self._actualizar_stats()
        self._renderizar_items()

    def _mostrar_error(self, msg: str):
        # Limpiar y mostrar error
        for i in reversed(range(self.layout_items.count())):
            it = self.layout_items.itemAt(i)
            if it and it.widget():
                it.widget().deleteLater()
        lbl = QLabel(f"❌ {msg}")
        lbl.setStyleSheet("color: #FCA5A5;")
        self.layout_items.insertWidget(0, lbl)

    def _actualizar_stats(self):
        completadas = sum(1 for x in self.items if x.get("estado") == "completada")
        mins_total  = sum(x.get("tiempo_trabajado_minutos") or 0 for x in self.items)
        hs  = mins_total // 60
        ms  = mins_total % 60

        # Actualizar labels dentro de los widgets stat
        def set_val(widget, texto):
            lbl = widget.findChild(QLabel, "valor")
            if lbl:
                lbl.setText(texto)

        set_val(self.lbl_total,       str(len(self.items)))
        set_val(self.lbl_completadas, str(completadas))
        set_val(self.lbl_tiempo,      f"{hs}h {ms:02d}m")

    def _renderizar_items(self):
        """
        Ítem 8: agrupa etapas de la misma tarea compleja en un bloque expandible.
        Las intervenciones de terceros aparecen como paso con estado 'en espera de [nombre]'.
        """
        # Limpiar widgets anteriores
        for i in reversed(range(self.layout_items.count())):
            it = self.layout_items.itemAt(i)
            if it and it.widget():
                it.widget().deleteLater()

        if not self.items:
            lbl = QLabel("🎉 No hay actividad registrada hoy")
            lbl.setAlignment(Qt.AlignmentFlag.AlignCenter)
            lbl.setStyleSheet(f"color: {COLORES['texto_sec']}; padding: 20px;")
            self.layout_items.insertWidget(0, lbl)
            return

        # Separar tareas simples y agrupar etapas por tarea_id
        grupos_complejas = {}    # tarea_id → lista de etapas
        simples          = []

        for item in self.items:
            if item.get("tipo") == "etapa_compleja":
                tid = item.get("tarea_id", "?")
                if tid not in grupos_complejas:
                    grupos_complejas[tid] = []
                grupos_complejas[tid].append(item)
            else:
                simples.append(item)

        idx = 0

        # Renderizar tareas simples
        for item in simples:
            card = self._crear_card_jornada(item)
            self.layout_items.insertWidget(idx, card)
            idx += 1

        # Renderizar grupos de tareas complejas
        for tarea_id, etapas in grupos_complejas.items():
            bloque = self._crear_bloque_complejo(tarea_id, etapas)
            self.layout_items.insertWidget(idx, bloque)
            idx += 1

        self.layout_items.addStretch()

    def _crear_card_jornada(self, item: dict) -> QFrame:
        """Tarjeta de jornada: borde superior=prioridad, muestra comentarios."""
        estado    = item.get("estado", "pendiente")
        nombre    = item.get("tarea_nombre", "Sin nombre")
        cliente   = item.get("cliente_nombre") or item.get("servicio_nombre") or "—"
        prioridad = item.get("prioridad", "media")
        inicio    = self._fmt_hora(item.get("inicio_real"))
        fin       = self._fmt_hora(item.get("fin_real"))
        mins      = item.get("tiempo_trabajado_minutos") or 0
        color_est = COLORES.get(estado, COLORES["pendiente"])
        color_pri = PRIO_COLOR.get(prioridad, "#EAB308")

        card = QFrame()
        card.setStyleSheet(f"""
            QFrame {{
                background: {COLORES["fondo_card"]};
                border-radius: 8px;
                border-top: 3px solid {color_pri};
                margin: 2px 0;
            }}
        """)
        lay = QVBoxLayout(card)
        lay.setContentsMargins(10, 8, 10, 8)
        lay.setSpacing(3)

        # Fila superior: hora inicio/fin + nombre
        row_top = QHBoxLayout()
        row_top.setSpacing(10)

        lbl_hora = QLabel(f"{inicio}\n{fin or '—'}")
        lbl_hora.setFont(QFont("Segoe UI", 9))
        lbl_hora.setStyleSheet(f"color: {COLORES['texto_sec']}; border: none; min-width: 46px;")
        lbl_hora.setAlignment(Qt.AlignmentFlag.AlignCenter)
        row_top.addWidget(lbl_hora)

        lbl_n = QLabel(nombre)
        lbl_n.setFont(QFont("Segoe UI", 11, QFont.Weight.Bold))
        lbl_n.setStyleSheet(f"color: {COLORES['texto']}; border: none;")
        lbl_n.setWordWrap(True)
        row_top.addWidget(lbl_n, 1)

        lay.addLayout(row_top)

        # Fila meta: cliente · tiempo · prioridad · estado
        row_meta = QHBoxLayout()
        hs = mins // 60; ms = mins % 60
        lbl_det = QLabel(f"📁 {cliente}   ⏱ {hs}h {ms:02d}m")
        lbl_det.setFont(QFont("Segoe UI", 9))
        lbl_det.setStyleSheet(f"color: {COLORES['texto_sec']}; border: none;")
        row_meta.addWidget(lbl_det)
        row_meta.addStretch()

        lbl_prio = QLabel(f"● {prioridad.upper()}")
        lbl_prio.setFont(QFont("Segoe UI", 8, QFont.Weight.Bold))
        lbl_prio.setStyleSheet(f"color: {color_pri}; border: none;")
        row_meta.addWidget(lbl_prio)

        lbl_est = QLabel(f"  {estado.replace('_', ' ').upper()}")
        lbl_est.setFont(QFont("Segoe UI", 8))
        lbl_est.setStyleSheet(f"color: {color_est}; border: none;")
        row_meta.addWidget(lbl_est)
        lay.addLayout(row_meta)

        # Comentario del supervisor
        com_sup = item.get("comentario_supervisor") or ""
        if com_sup:
            lbl_sup = QLabel(f"👤 Supervisor: {com_sup}")
            lbl_sup.setFont(QFont("Segoe UI", 9))
            lbl_sup.setStyleSheet("color: #93C5FD; border: none; font-style: italic;")
            lbl_sup.setWordWrap(True)
            lay.addWidget(lbl_sup)

        # Comentario del operador
        com_op = item.get("comentario_operador") or ""
        if com_op:
            lbl_op = QLabel(f"💬 {com_op}")
            lbl_op.setFont(QFont("Segoe UI", 9))
            lbl_op.setStyleSheet(f"color: {COLORES['texto_sec']}; border: none; font-style: italic;")
            lbl_op.setWordWrap(True)
            lay.addWidget(lbl_op)

        return card

    def _crear_bloque_complejo(self, tarea_id: str, etapas: list) -> QFrame:
        """
        Ítem 8: bloque expandible con todas las etapas de una tarea compleja.
        Las etapas de otros usuarios se muestran como 'en espera de [nombre]'.
        """
        tarea_nombre = etapas[0].get("tarea_nombre", "Tarea compleja") if etapas else "Tarea compleja"
        total_mins   = sum(e.get("tiempo_trabajado_minutos") or 0 for e in etapas)
        hs = total_mins // 60; ms = total_mins % 60

        bloque = QFrame()
        bloque.setStyleSheet(f"""
            QFrame {{
                background: #1E1B4B;
                border-radius: 8px;
                border: 1px solid #4C1D95;
                margin: 2px 0;
            }}
        """)
        lay_b = QVBoxLayout(bloque)
        lay_b.setContentsMargins(10, 8, 10, 8)
        lay_b.setSpacing(4)

        # Cabecera del bloque (clicable para expandir/colapsar)
        row_cab = QHBoxLayout()
        self._expandido = {}   # estado local por bloque

        lbl_cab = QLabel(f"🔀 {tarea_nombre}")
        lbl_cab.setFont(QFont("Segoe UI", 11, QFont.Weight.Bold))
        lbl_cab.setStyleSheet("color: #C4B5FD; border: none;")
        lbl_cab.setWordWrap(True)

        lbl_resumen = QLabel(f"{len(etapas)} etapas · ⏱ {hs}h {ms:02d}m")
        lbl_resumen.setFont(QFont("Segoe UI", 9))
        lbl_resumen.setStyleSheet(f"color: {COLORES['texto_sec']}; border: none;")

        btn_expand = QPushButton("▼")
        btn_expand.setFixedSize(24, 24)
        btn_expand.setStyleSheet(f"background: #4C1D95; color: white; border: none; border-radius: 4px; font-size: 11px;")

        row_cab.addWidget(lbl_cab)
        row_cab.addStretch()
        row_cab.addWidget(lbl_resumen)
        row_cab.addWidget(btn_expand)
        lay_b.addLayout(row_cab)

        # Contenedor de etapas (expandible)
        cont_etapas = QWidget()
        lay_etapas  = QVBoxLayout(cont_etapas)
        lay_etapas.setContentsMargins(0, 4, 0, 0)
        lay_etapas.setSpacing(3)

        # Necesitamos el uid del usuario actual — se obtiene del token decodificado
        # Como simplificación, comparamos asignado_a_id con el primer item
        uid_local = etapas[0].get("asignado_a_id", "") if etapas else ""

        for et in sorted(etapas, key=lambda x: x.get("etapa_orden", 0)):
            asignado  = et.get("asignado_a_id", "")
            es_propio = (asignado == uid_local)
            estado_et = et.get("estado", "")
            nombre_et = et.get("etapa_nombre", f"Etapa {et.get('etapa_orden','?')}")
            inicio_et = self._fmt_hora(et.get("inicio_real"))
            fin_et    = self._fmt_hora(et.get("fin_real"))
            mins_et   = et.get("tiempo_trabajado_minutos") or 0

            if not es_propio:
                # Etapa de otro usuario: mostrar como "en espera de [nombre]"
                validador = et.get("validador_nombre") or "otro usuario"
                lbl_ext = QLabel(f"   ⏳ {nombre_et} — en espera de {validador}")
                lbl_ext.setFont(QFont("Segoe UI", 9))
                lbl_ext.setStyleSheet("color: #818CF8; border: none; font-style: italic;")
                lay_etapas.addWidget(lbl_ext)
                continue

            color_e = COLORES.get(estado_et, COLORES["pendiente"])
            row_et  = QHBoxLayout()

            lbl_ord = QLabel(f"  {et.get('etapa_orden','?')}.")
            lbl_ord.setFont(QFont("Segoe UI", 9, QFont.Weight.Bold))
            lbl_ord.setStyleSheet(f"color: {color_e}; border: none; min-width: 22px;")
            row_et.addWidget(lbl_ord)

            lbl_et_hora = QLabel(f"{inicio_et}–{fin_et or '...'}")
            lbl_et_hora.setFont(QFont("Segoe UI", 9))
            lbl_et_hora.setStyleSheet(f"color: {COLORES['texto_sec']}; border: none; min-width: 90px;")
            row_et.addWidget(lbl_et_hora)

            lbl_et_nom = QLabel(nombre_et)
            lbl_et_nom.setFont(QFont("Segoe UI", 9))
            lbl_et_nom.setStyleSheet(f"color: {COLORES['texto']}; border: none;")
            lbl_et_nom.setWordWrap(True)
            row_et.addWidget(lbl_et_nom, 1)

            hs_e = mins_et // 60; ms_e = mins_et % 60
            lbl_et_t = QLabel(f"{hs_e}h{ms_e:02d}m")
            lbl_et_t.setFont(QFont("Segoe UI", 9))
            lbl_et_t.setStyleSheet(f"color: {color_e}; border: none;")
            row_et.addWidget(lbl_et_t)

            row_w = QWidget()
            row_w.setLayout(row_et)
            lay_etapas.addWidget(row_w)

        cont_etapas.setVisible(False)
        lay_b.addWidget(cont_etapas)

        # Conectar expand/colapso
        def toggle_expand(_, c=cont_etapas, b=btn_expand):
            vis = not c.isVisible()
            c.setVisible(vis)
            b.setText("▲" if vis else "▼")

        btn_expand.clicked.connect(toggle_expand)

        return bloque

    def _fmt_hora(self, iso: str | None) -> str:
        """Extrae HH:MM de un ISO datetime."""
        if not iso:
            return ""
        try:
            # Acepta tanto 'T' como ' ' como separador
            parte = iso.split("T")[-1] if "T" in iso else iso.split(" ")[-1]
            return parte[:5]
        except Exception:
            return ""

    def _exportar_csv(self):
        """Exporta la jornada a un CSV y pregunta dónde guardar."""
        if not self.items:
            QMessageBox.information(self, "Sin datos", "No hay items de jornada para exportar.")
            return

        ruta, _ = QFileDialog.getSaveFileName(
            self, "Guardar jornada como CSV",
            f"jornada_{date.today().isoformat()}.csv",
            "Archivos CSV (*.csv)"
        )
        if not ruta:
            return

        try:
            with open(ruta, "w", newline="", encoding="utf-8-sig") as f:
                writer = csv.DictWriter(f, fieldnames=[
                    "tipo", "tarea_nombre", "etapa_nombre", "estado",
                    "inicio_real", "fin_real", "tiempo_min",
                    "cliente_nombre", "servicio_nombre"
                ])
                writer.writeheader()
                for item in self.items:
                    writer.writerow({
                        "tipo":           item.get("tipo", ""),
                        "tarea_nombre":   item.get("tarea_nombre", ""),
                        "etapa_nombre":   item.get("etapa_nombre", ""),
                        "estado":         item.get("estado", ""),
                        "inicio_real":    item.get("inicio_real", ""),
                        "fin_real":       item.get("fin_real", ""),
                        "tiempo_min":     item.get("tiempo_trabajado_minutos", 0),
                        "cliente_nombre": item.get("cliente_nombre", ""),
                        "servicio_nombre":item.get("servicio_nombre", ""),
                    })
            QMessageBox.information(self, "Exportado", f"✅ Jornada guardada en:\n{ruta}")
        except Exception as e:
            QMessageBox.critical(self, "Error", f"❌ Error al guardar: {e}")


# ============================================================
# VENTANA PRINCIPAL DEL WIDGET
# ============================================================
class VentanaPrincipal(QMainWindow):
    def __init__(self):
        super().__init__()
        self.token    = None
        self.usuario  = None
        self.hora_fin_jornada = "18:00"
        self.tareas   = []
        self.workers  = []

        self._configurar_ventana()
        self._construir_ui()
        self._configurar_tray()
        self._cargar_sesion_guardada()

        # Refresh automático cada 2 minutos
        self.timer_refresh = QTimer()
        self.timer_refresh.timeout.connect(self.cargar_tareas)
        self.timer_refresh.start(120_000)

    def _configurar_ventana(self):
        self.setWindowTitle(APP_NAME)
        self.setFixedWidth(380)
        self.setMinimumHeight(500)
        self.setMaximumHeight(800)
        self.setWindowFlags(Qt.WindowType.Tool | Qt.WindowType.WindowStaysOnTopHint)
        self.setStyleSheet(f"background-color: {COLORES['fondo']}; color: {COLORES['texto']};")

        from PyQt6.QtGui import QGuiApplication
        pantalla = QGuiApplication.primaryScreen().availableGeometry()
        self.move(pantalla.width() - 400, pantalla.height() - 600)

    def _construir_ui(self):
        central = QWidget()
        self.setCentralWidget(central)
        self.layout_principal = QVBoxLayout(central)
        self.layout_principal.setContentsMargins(12, 12, 12, 12)
        self.layout_principal.setSpacing(8)

        # Cabecera
        cabecera = QHBoxLayout()
        self.lbl_titulo = QLabel("TaskFlow Pro")
        self.lbl_titulo.setFont(QFont("Segoe UI", 14, QFont.Weight.Bold))
        self.lbl_titulo.setStyleSheet(f"color: {COLORES['acento']};")

        self.lbl_fecha = QLabel(datetime.now().strftime("%a %d/%m"))
        self.lbl_fecha.setFont(QFont("Segoe UI", 10))
        self.lbl_fecha.setStyleSheet(f"color: {COLORES['texto_sec']};")

        cabecera.addWidget(self.lbl_titulo)
        cabecera.addStretch()
        cabecera.addWidget(self.lbl_fecha)
        self.layout_principal.addLayout(cabecera)

        # Usuario
        self.lbl_usuario = QLabel("No conectado")
        self.lbl_usuario.setFont(QFont("Segoe UI", 10))
        self.lbl_usuario.setStyleSheet(f"color: {COLORES['texto_sec']};")
        self.layout_principal.addWidget(self.lbl_usuario)

        sep = QFrame()
        sep.setFrameShape(QFrame.Shape.HLine)
        sep.setStyleSheet("color: #374151;")
        self.layout_principal.addWidget(sep)

        # Resumen
        self.lbl_resumen = QLabel("Cargando tareas...")
        self.lbl_resumen.setFont(QFont("Segoe UI", 10))
        self.lbl_resumen.setStyleSheet(f"color: {COLORES['texto_sec']};")
        self.layout_principal.addWidget(self.lbl_resumen)

        # Área scroll de tareas
        self.scroll = QScrollArea()
        self.scroll.setWidgetResizable(True)
        self.scroll.setStyleSheet("QScrollArea { border: none; }")

        self.contenedor_tareas = QWidget()
        self.layout_tareas = QVBoxLayout(self.contenedor_tareas)
        self.layout_tareas.setSpacing(6)
        self.layout_tareas.addStretch()

        self.scroll.setWidget(self.contenedor_tareas)
        self.layout_principal.addWidget(self.scroll)

        # ── Botones inferiores ───────────────────────────────
        row_btns_inf = QHBoxLayout()
        row_btns_inf.setSpacing(6)

        # Botón Mi Jornada
        self.btn_jornada = QPushButton("📅 Mi Jornada")
        self.btn_jornada.setFixedHeight(36)
        self.btn_jornada.setFont(QFont("Segoe UI", 10))
        self.btn_jornada.setStyleSheet(f"""
            QPushButton {{
                background-color: #1E3A5F;
                color: #93C5FD;
                border: 1px solid #2563EB;
                border-radius: 6px; padding: 4px 10px;
            }}
            QPushButton:hover {{ background-color: #1E40AF; }}
        """)
        self.btn_jornada.clicked.connect(self._abrir_jornada)
        row_btns_inf.addWidget(self.btn_jornada)

        # Botón Fin de Jornada
        self.btn_fin_jornada = QPushButton("🔚 Fin de Jornada")
        self.btn_fin_jornada.setFixedHeight(36)
        self.btn_fin_jornada.setFont(QFont("Segoe UI", 10, QFont.Weight.Bold))
        self.btn_fin_jornada.setStyleSheet(f"""
            QPushButton {{
                background-color: {COLORES['acento']};
                color: white; border: none;
                border-radius: 6px; padding: 4px 10px;
            }}
            QPushButton:hover {{ background-color: #4F46E5; }}
        """)
        self.btn_fin_jornada.clicked.connect(self.fin_jornada)
        row_btns_inf.addWidget(self.btn_fin_jornada)

        self.layout_principal.addLayout(row_btns_inf)

        # Botón refrescar
        self.btn_refresh = QPushButton("🔄 Actualizar")
        self.btn_refresh.setFixedHeight(30)
        self.btn_refresh.setFont(QFont("Segoe UI", 9))
        self.btn_refresh.clicked.connect(self.cargar_tareas)
        self.btn_refresh.setStyleSheet(f"""
            QPushButton {{
                background: transparent; color: {COLORES['texto_sec']};
                border: 1px solid #4B5563; border-radius: 6px;
            }}
        """)
        self.layout_principal.addWidget(self.btn_refresh)

        # Botón conectar: pega el token desde el portapapeles y guarda sesión
        self.btn_conectar = QPushButton("🔑 Ya me logueé — Pegar Token")
        self.btn_conectar.setFixedHeight(36)
        self.btn_conectar.setFont(QFont("Segoe UI", 10, QFont.Weight.Bold))
        self.btn_conectar.setStyleSheet("""
            QPushButton {
                background-color: #065F46; color: #6EE7B7;
                border: 1px solid #10B981; border-radius: 6px; padding: 4px 10px;
            }
            QPushButton:hover { background-color: #047857; }
        """)
        self.btn_conectar.clicked.connect(self._conectar_desde_clipboard)
        self.layout_principal.addWidget(self.btn_conectar)
        self.btn_conectar.hide()  # Se muestra solo cuando no hay sesión

    def _configurar_tray(self):
        self.tray = QSystemTrayIcon(self)
        pixmap = QPixmap(32, 32)
        pixmap.fill(QColor(COLORES["acento"]))
        self.tray.setIcon(QIcon(pixmap))
        self.tray.setToolTip("TaskFlow Pro")

        menu_tray = QMenu()
        a_mostrar = QAction("Mostrar", self)
        a_mostrar.triggered.connect(self.show)
        a_salir   = QAction("Salir",   self)
        a_salir.triggered.connect(QApplication.quit)
        menu_tray.addAction(a_mostrar)
        menu_tray.addSeparator()
        menu_tray.addAction(a_salir)

        self.tray.setContextMenu(menu_tray)
        self.tray.activated.connect(self._tray_click)
        self.tray.show()

    def _tray_click(self, reason):
        if reason == QSystemTrayIcon.ActivationReason.DoubleClick:
            self.show()
            self.raise_()

    def _cargar_sesion_guardada(self):
        settings = QSettings("TaskFlowPro", "Widget")
        token = settings.value("token", "")
        if token:
            self.token = token
            nombre     = settings.value("nombre", "Usuario")
            self.lbl_usuario.setText(f"👤 {nombre}")
            self.hora_fin_jornada = settings.value("hora_fin", "18:00")
            self.btn_conectar.hide()
            self.cargar_tareas()
        else:
            self.lbl_resumen.setText(
                "1. Abrí la web y logueate\n"
                "2. Hacé clic en '📋 Conectar Widget' en el menú lateral\n"
                "3. Volvé aquí y tocá el botón verde"
            )
            self.btn_conectar.show()

    def _conectar_desde_clipboard(self):
        """Lee el token JWT del portapapeles, lo valida y guarda la sesión."""
        from PyQt6.QtGui import QGuiApplication
        clipboard = QGuiApplication.clipboard().text().strip()

        if not clipboard:
            QMessageBox.warning(self, "Sin token",
                "El portapapeles está vacío.\n"
                "Hacé clic en '📋 Conectar Widget' en la web primero.")
            return

        # Validar el token consultando /auth/me
        self.lbl_resumen.setText("Verificando token...")
        try:
            import requests as req
            resp = req.get(
                f"{API_BASE_URL}/auth/me",
                headers={"Authorization": f"Bearer {clipboard}"},
                timeout=10
            )
            if resp.status_code == 200:
                datos = resp.json()
                nombre = f"{datos.get('nombre','')} {datos.get('apellido','')}".strip()
                # Guardar en QSettings para próximas sesiones
                settings = QSettings("TaskFlowPro", "Widget")
                settings.setValue("token",  clipboard)
                settings.setValue("nombre", nombre)
                self.token = clipboard
                self.lbl_usuario.setText(f"👤 {nombre}")
                self.btn_conectar.hide()
                self.lbl_resumen.setText("✅ Conectado. Cargando tareas...")
                self.cargar_tareas()
            else:
                QMessageBox.critical(self, "Token inválido",
                    f"El token no es válido o expiró ({resp.status_code}).\n"
                    "Volvé a loguearte en la web y copiá el token de nuevo.")
                self.lbl_resumen.setText("⚠️ Token inválido. Reintentá.")
        except Exception as e:
            QMessageBox.critical(self, "Error de conexión", str(e))

    def cargar_tareas(self):
        """Carga tareas del día usando /tareas/para-widget con fecha local de la máquina."""
        if not self.token:
            return
        self.lbl_resumen.setText("Actualizando...")
        fecha_local = date.today().isoformat()  # fecha local Windows, no UTC del servidor
        worker = ApiWorker("GET", f"/tareas/para-widget?fecha={fecha_local}", token=self.token)
        worker.resultado.connect(self._mostrar_tareas)
        worker.error.connect(self._mostrar_error)
        self.workers.append(worker)
        worker.start()

    def _mostrar_tareas(self, data):
        self.tareas = data if isinstance(data, list) else []

        # Limpiar cards anteriores
        for i in reversed(range(self.layout_tareas.count())):
            it = self.layout_tareas.itemAt(i)
            if it and it.widget():
                it.widget().deleteLater()

        if not self.tareas:
            self.lbl_resumen.setText("📋 No hay tareas pendientes hoy")
            lbl = QLabel("🎉 No hay tareas pendientes hoy")
            lbl.setAlignment(Qt.AlignmentFlag.AlignCenter)
            lbl.setStyleSheet(f"color: {COLORES['texto_sec']}; padding: 20px;")
            self.layout_tareas.addWidget(lbl)
        else:
            completadas = sum(1 for t in self.tareas if t.get("estado") == "completada")
            total = len(self.tareas)
            self.lbl_resumen.setText(f"📋 {completadas}/{total} completadas hoy")

            for item in self.tareas:
                card = TareaCard(item)
                card.signal_iniciar.connect(self.iniciar_tarea)
                card.signal_pausar.connect(self.pausar_tarea)
                card.signal_reanudar.connect(self.reanudar_tarea)
                card.signal_finalizar.connect(self.finalizar_tarea)
                card.signal_iniciar_etapa.connect(self.iniciar_etapa)
                card.signal_pausar_etapa.connect(self.pausar_etapa)
                card.signal_reanudar_etapa.connect(self.reanudar_etapa)
                card.signal_finalizar_etapa.connect(self.finalizar_etapa)
                card.signal_validar.connect(self.validar_etapa)
                self.layout_tareas.insertWidget(self.layout_tareas.count() - 1, card)

        self.layout_tareas.addStretch()

    def _mostrar_error(self, msg: str):
        # Si el error es 401 o 403, la sesión expiró — limpiar y pedir reconexión
        if "401" in msg or "403" in msg or "expirado" in msg.lower() or "invalido" in msg.lower():
            QSettings("TaskFlowPro", "Widget").remove("token")
            self.token = None
            self.lbl_usuario.setText("No conectado")
            self.lbl_resumen.setText(
                "⚠️ Sesión expirada. Volvé a loguearte en la web\n"
                "y hacé clic en '📋 Conectar Widget'."
            )
            self.btn_conectar.show()
            return
        self.lbl_resumen.setText(f"❌ {msg}")
        self.tray.showMessage("TaskFlow Pro", msg, QSystemTrayIcon.MessageIcon.Warning, 3000)

    # ── Acciones sobre tareas simples ───────────────────────

    def iniciar_tarea(self, tarea_id: str):
        w = ApiWorker("POST", f"/tareas/{tarea_id}/iniciar", token=self.token)
        w.resultado.connect(lambda _: self.cargar_tareas())
        w.error.connect(self._mostrar_error)
        self.workers.append(w)
        w.start()

    def pausar_tarea(self, tarea_id: str):
        dlg = DialogPausa(self)
        if dlg.exec() == QDialog.DialogCode.Accepted:
            motivo = dlg.obtener_motivo()
            if not motivo:
                QMessageBox.warning(self, "Aviso", "El motivo de pausa es obligatorio.")
                return
            w = ApiWorker("POST", f"/tareas/{tarea_id}/pausar",
                          datos={"motivo": motivo}, token=self.token)
            w.resultado.connect(lambda _: self.cargar_tareas())
            w.error.connect(self._mostrar_error)
            self.workers.append(w)
            w.start()

    def reanudar_tarea(self, tarea_id: str):
        w = ApiWorker("POST", f"/tareas/{tarea_id}/reanudar", token=self.token)
        w.resultado.connect(lambda _: self.cargar_tareas())
        w.error.connect(self._mostrar_error)
        self.workers.append(w)
        w.start()

    def finalizar_tarea(self, tarea_id: str):
        w = ApiWorker("POST", f"/tareas/{tarea_id}/finalizar",
                      datos={}, token=self.token)
        w.resultado.connect(lambda _: self.cargar_tareas())
        w.error.connect(self._mostrar_error)
        self.workers.append(w)
        w.start()

    # ── Acciones sobre etapas complejas ─────────────────────

    def iniciar_etapa(self, etapa_id: str):
        w = ApiWorker("POST", f"/tareas-complejas/etapa/{etapa_id}/iniciar",
                      datos={}, token=self.token)
        w.resultado.connect(lambda _: self.cargar_tareas())
        w.error.connect(self._mostrar_error)
        self.workers.append(w)
        w.start()

    def pausar_etapa(self, etapa_id: str):
        dlg = DialogPausa(self)
        if dlg.exec() == QDialog.DialogCode.Accepted:
            motivo = dlg.obtener_motivo()
            if not motivo:
                return
            w = ApiWorker("POST", f"/tareas-complejas/etapa/{etapa_id}/pausar",
                          datos={"motivo": motivo}, token=self.token)
            w.resultado.connect(lambda _: self.cargar_tareas())
            w.error.connect(self._mostrar_error)
            self.workers.append(w)
            w.start()

    def reanudar_etapa(self, etapa_id: str):
        w = ApiWorker("POST", f"/tareas-complejas/etapa/{etapa_id}/reanudar",
                      datos={}, token=self.token)
        w.resultado.connect(lambda _: self.cargar_tareas())
        w.error.connect(self._mostrar_error)
        self.workers.append(w)
        w.start()

    def finalizar_etapa(self, etapa_id: str):
        w = ApiWorker("POST", f"/tareas-complejas/etapa/{etapa_id}/finalizar",
                      datos={}, token=self.token)
        w.resultado.connect(lambda _: self.cargar_tareas())
        w.error.connect(self._mostrar_error)
        self.workers.append(w)
        w.start()

    def validar_etapa(self, tarea_id_signal: str, etapa_id: str):
        """
        Maneja la validación de supervisor.
        Si tarea_id_signal empieza con 'rechazar:', el diálogo se abre en modo rechazo.
        El signal_validar de TareaCard emite (tarea_id | 'rechazar:tarea_id', etapa_id).
        """
        if not etapa_id:
            self._mostrar_error("No se encontró la etapa a validar.")
            return

        # Buscar el nombre de la etapa desde los datos cargados
        nombre_etapa = ""
        for item in self.tareas:
            if item.get("etapa_id_validacion") == etapa_id:
                nombre_etapa = item.get("tarea_nombre", "Validación")
                break

        dlg = DialogValidar(nombre_etapa or "Etapa a validar", self)

        # Si viene de "rechazar:", preseleccionar "Devolver al operador"
        if tarea_id_signal.startswith("rechazar:"):
            dlg.rb_rechazar.setChecked(True)

        if dlg.exec() != QDialog.DialogCode.Accepted:
            return

        accion, comentario = dlg.obtener_resultado()

        # Mapear accion al formato del endpoint ValidarEtapaRequest
        if accion == "aprobar":
            payload = {"aprobada": True, "comentario": comentario or None}
        elif accion == "rechazar":
            payload = {"aprobada": False, "accion_rechazo": "corregir",   "comentario": comentario}
        else:  # desestimar
            payload = {"aprobada": False, "accion_rechazo": "desestimar", "comentario": comentario}

        w = ApiWorker("POST", f"/tareas-complejas/etapa/{etapa_id}/validar",
                      datos=payload, token=self.token)
        w.resultado.connect(lambda _: self.cargar_tareas())
        w.error.connect(self._mostrar_error)
        self.workers.append(w)
        w.start()

    # ── Fin de jornada y Mi Jornada ─────────────────────────

    def fin_jornada(self):
        dlg = DialogFinJornada(self.hora_fin_jornada, self)
        if dlg.exec() == QDialog.DialogCode.Accepted:
            datos = dlg.obtener_datos()
            w = ApiWorker("POST", "/tareas/heredar-dia", datos=datos, token=self.token)
            w.resultado.connect(lambda _: self.tray.showMessage(
                "TaskFlow Pro", "Jornada cerrada. ¡Hasta mañana!",
                QSystemTrayIcon.MessageIcon.Information, 4000
            ))
            w.error.connect(self._mostrar_error)
            self.workers.append(w)
            w.start()

    def _abrir_jornada(self):
        """Abre el diálogo Mi Jornada."""
        if not self.token:
            QMessageBox.warning(self, "Sin sesión", "Iniciá sesión primero.")
            return
        dlg = VistaJornada(self.token, self)
        dlg.exec()

    def closeEvent(self, event):
        event.ignore()
        self.hide()
        self.tray.showMessage(
            "TaskFlow Pro",
            "El widget sigue corriendo en la barra de tareas.",
            QSystemTrayIcon.MessageIcon.Information, 2000
        )


# ============================================================
# PUNTO DE ENTRADA
# ============================================================
def main():
    app = QApplication(sys.argv)
    app.setApplicationName(APP_NAME)
    app.setOrganizationName("TaskFlowPro")
    app.setQuitOnLastWindowClosed(False)

    ventana = VentanaPrincipal()
    ventana.show()

    sys.exit(app.exec())


if __name__ == "__main__":
    main()
