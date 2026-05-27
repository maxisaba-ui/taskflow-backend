"""
TaskFlow Pro — Widget de Escritorio Windows
Framework: PyQt6
Función: Controlar tareas (play/pausa/fin) desde la barra de tareas
Instalación: pip install PyQt6 requests pyinstaller
Distribución: pyinstaller --onefile --windowed --icon=icon.ico widget.py
"""

import sys
import json
import requests
from datetime import datetime
from PyQt6.QtWidgets import (
    QApplication, QMainWindow, QWidget, QVBoxLayout, QHBoxLayout,
    QPushButton, QLabel, QListWidget, QListWidgetItem, QDialog,
    QTextEdit, QLineEdit, QSystemTrayIcon, QMenu, QMessageBox,
    QSplashScreen, QFrame, QScrollArea
)
from PyQt6.QtCore import Qt, QTimer, QThread, pyqtSignal, QSettings, QSize
from PyQt6.QtGui import QIcon, QColor, QPalette, QFont, QPixmap, QAction

# ============================================================
# CONFIGURACIÓN
# ============================================================
API_BASE_URL = "https://tu-backend.railway.app/api/v1"  # Cambiar por URL real
APP_NAME = "TaskFlow Pro Widget"
VERSION = "1.0.0"

COLORES = {
    "pendiente": "#6B7280",
    "en_curso": "#10B981",
    "pausada": "#F59E0B",
    "completada": "#3B82F6",
    "vencida": "#EF4444",
    "fondo": "#1F2937",
    "fondo_card": "#374151",
    "texto": "#F9FAFB",
    "texto_sec": "#9CA3AF",
    "acento": "#6366F1",
}


# ============================================================
# HILO PARA LLAMADAS A LA API (no bloquea la UI)
# ============================================================
class ApiWorker(QThread):
    resultado = pyqtSignal(dict)
    error = pyqtSignal(str)

    def __init__(self, metodo, endpoint, datos=None, token=None):
        super().__init__()
        self.metodo = metodo
        self.endpoint = endpoint
        self.datos = datos
        self.token = token

    def run(self):
        try:
            headers = {"Content-Type": "application/json"}
            if self.token:
                headers["Authorization"] = f"Bearer {self.token}"

            url = f"{API_BASE_URL}{self.endpoint}"

            if self.metodo == "GET":
                resp = requests.get(url, headers=headers, timeout=10)
            elif self.metodo == "POST":
                resp = requests.post(url, headers=headers,
                                     json=self.datos, timeout=10)
            elif self.metodo == "PUT":
                resp = requests.put(url, headers=headers,
                                    json=self.datos, timeout=10)

            if resp.status_code < 300:
                self.resultado.emit(resp.json() if resp.text else {})
            else:
                self.error.emit(f"Error {resp.status_code}: {resp.text}")

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
        btn_cancelar = QPushButton("Cancelar")
        btn_cancelar.clicked.connect(self.reject)
        btn_confirmar = QPushButton("Pausar tarea")
        btn_confirmar.clicked.connect(self.accept)
        btn_confirmar.setStyleSheet(f"""
            QPushButton {{
                background-color: {COLORES['pausada']};
                color: white;
                border: none;
                border-radius: 6px;
                padding: 8px 20px;
                font-weight: bold;
            }}
        """)
        botones.addWidget(btn_cancelar)
        botones.addWidget(btn_confirmar)
        layout.addLayout(botones)

    def obtener_motivo(self):
        return self.texto.toPlainText().strip()


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

        ahora = datetime.now().strftime("%H:%M")
        diff_msg = ""
        try:
            h_esp = datetime.strptime(hora_esperada, "%H:%M")
            h_ahora = datetime.now().replace(second=0, microsecond=0)
            h_esp_full = h_ahora.replace(hour=h_esp.hour, minute=h_esp.minute)
            diff = (h_ahora - h_esp_full).total_seconds() / 60
            if diff < -15:
                diff_msg = f"⚠️ Estás cerrando {int(abs(diff))} min antes de tu horario ({hora_esperada})"
                self.tipo = "anticipado"
            elif diff > 15:
                diff_msg = f"⏰ Estás cerrando {int(diff)} min después de tu horario ({hora_esperada})"
                self.tipo = "horas_extra"
            else:
                diff_msg = "✅ Cerrás en horario normal"
                self.tipo = "normal"
        except Exception:
            diff_msg = f"Hora actual: {ahora}"
            self.tipo = "normal"

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
                border-radius: 6px;
                padding: 8px;
                font-size: 13px;
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
                color: white;
                border: none;
                border-radius: 6px;
                padding: 8px 20px;
                font-weight: bold;
                font-size: 13px;
            }}
        """)
        botones.addWidget(btn_cancelar)
        botones.addWidget(btn_cerrar)
        layout.addLayout(botones)

    def obtener_datos(self):
        return {
            "tipo": self.tipo,
            "comentario": self.comentario.toPlainText().strip()
        }


# ============================================================
# CARD de tarea (widget visual de cada tarea)
# ============================================================
class TareaCard(QFrame):
    signal_iniciar = pyqtSignal(str)
    signal_pausar = pyqtSignal(str)
    signal_reanudar = pyqtSignal(str)
    signal_finalizar = pyqtSignal(str)

    def __init__(self, tarea: dict, parent=None):
        super().__init__(parent)
        self.tarea_id = tarea.get("id", "")
        self.tarea = tarea
        self._construir_ui()

    def _construir_ui(self):
        estado = self.tarea.get("estado", "pendiente")
        color_estado = COLORES.get(estado, COLORES["pendiente"])

        self.setStyleSheet(f"""
            QFrame {{
                background-color: {COLORES['fondo_card']};
                border-radius: 10px;
                border-left: 4px solid {color_estado};
                margin: 4px 2px;
            }}
        """)

        layout = QVBoxLayout(self)
        layout.setContentsMargins(12, 10, 12, 10)
        layout.setSpacing(6)

        # Nombre de la tarea
        nombre = self.tarea.get("nombre", "Tarea sin nombre")
        lbl_nombre = QLabel(nombre)
        lbl_nombre.setFont(QFont("Segoe UI", 12, QFont.Weight.Bold))
        lbl_nombre.setStyleSheet(f"color: {COLORES['texto']}; border: none;")
        lbl_nombre.setWordWrap(True)
        layout.addWidget(lbl_nombre)

        # Info secundaria
        cliente = self.tarea.get("cliente", "Sin cliente")
        heredada = " 🔁 Heredada" if self.tarea.get("es_heredada") else ""
        lbl_info = QLabel(f"📁 {cliente}{heredada}")
        lbl_info.setFont(QFont("Segoe UI", 10))
        lbl_info.setStyleSheet(f"color: {COLORES['texto_sec']}; border: none;")
        layout.addWidget(lbl_info)

        # Tiempo trabajado si está en curso o completada
        if self.tarea.get("tiempo_trabajado_minutos", 0) > 0:
            mins = self.tarea["tiempo_trabajado_minutos"]
            hs = mins // 60
            ms = mins % 60
            lbl_tiempo = QLabel(f"⏱ {hs}h {ms:02d}m trabajados")
            lbl_tiempo.setFont(QFont("Segoe UI", 10))
            lbl_tiempo.setStyleSheet(f"color: {color_estado}; border: none;")
            layout.addWidget(lbl_tiempo)

        # Comentario del supervisor (si existe)
        if self.tarea.get("comentario_supervisor"):
            lbl_sup = QLabel(f"💬 {self.tarea['comentario_supervisor']}")
            lbl_sup.setFont(QFont("Segoe UI", 9))
            lbl_sup.setStyleSheet(f"color: {COLORES['texto_sec']}; border: none; font-style: italic;")
            lbl_sup.setWordWrap(True)
            layout.addWidget(lbl_sup)

        # Botones de acción
        layout_botones = QHBoxLayout()
        layout_botones.setSpacing(6)

        if estado == "pendiente":
            btn = self._crear_boton("▶ Iniciar", COLORES["en_curso"])
            btn.clicked.connect(lambda: self.signal_iniciar.emit(self.tarea_id))
            layout_botones.addWidget(btn)

        elif estado == "en_curso":
            btn_pausa = self._crear_boton("⏸ Pausar", COLORES["pausada"])
            btn_pausa.clicked.connect(lambda: self.signal_pausar.emit(self.tarea_id))
            layout_botones.addWidget(btn_pausa)

            btn_fin = self._crear_boton("⏹ Finalizar", COLORES["completada"])
            btn_fin.clicked.connect(lambda: self.signal_finalizar.emit(self.tarea_id))
            layout_botones.addWidget(btn_fin)

        elif estado == "pausada":
            btn_reanudar = self._crear_boton("▶ Reanudar", COLORES["en_curso"])
            btn_reanudar.clicked.connect(lambda: self.signal_reanudar.emit(self.tarea_id))
            layout_botones.addWidget(btn_reanudar)

            btn_fin = self._crear_boton("⏹ Finalizar", COLORES["completada"])
            btn_fin.clicked.connect(lambda: self.signal_finalizar.emit(self.tarea_id))
            layout_botones.addWidget(btn_fin)

        elif estado == "completada":
            lbl_ok = QLabel("✅ Completada")
            lbl_ok.setStyleSheet(f"color: {COLORES['completada']}; border: none; font-weight: bold;")
            layout_botones.addWidget(lbl_ok)

        layout.addLayout(layout_botones)

    def _crear_boton(self, texto: str, color: str) -> QPushButton:
        btn = QPushButton(texto)
        btn.setFixedHeight(32)
        btn.setFont(QFont("Segoe UI", 10, QFont.Weight.Bold))
        btn.setStyleSheet(f"""
            QPushButton {{
                background-color: {color};
                color: white;
                border: none;
                border-radius: 6px;
                padding: 4px 14px;
            }}
            QPushButton:hover {{
                opacity: 0.85;
            }}
        """)
        return btn


# ============================================================
# VENTANA PRINCIPAL DEL WIDGET
# ============================================================
class VentanaPrincipal(QMainWindow):
    def __init__(self):
        super().__init__()
        self.token = None
        self.usuario = None
        self.hora_fin_jornada = "18:00"
        self.tareas = []
        self.workers = []  # Guardar refs a workers activos

        self._configurar_ventana()
        self._construir_ui()
        self._configurar_tray()
        self._cargar_sesion_guardada()

        # Timer para refrescar tareas cada 2 minutos
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

        # Posicionar en esquina inferior derecha
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

        self.lbl_fecha = QLabel(datetime.now().strftime("%A %d/%m"))
        self.lbl_fecha.setFont(QFont("Segoe UI", 10))
        self.lbl_fecha.setStyleSheet(f"color: {COLORES['texto_sec']};")

        cabecera.addWidget(self.lbl_titulo)
        cabecera.addStretch()
        cabecera.addWidget(self.lbl_fecha)
        self.layout_principal.addLayout(cabecera)

        # Usuario logueado
        self.lbl_usuario = QLabel("No conectado")
        self.lbl_usuario.setFont(QFont("Segoe UI", 10))
        self.lbl_usuario.setStyleSheet(f"color: {COLORES['texto_sec']};")
        self.layout_principal.addWidget(self.lbl_usuario)

        # Separador
        sep = QFrame()
        sep.setFrameShape(QFrame.Shape.HLine)
        sep.setStyleSheet("color: #374151;")
        self.layout_principal.addWidget(sep)

        # Resumen del día
        self.lbl_resumen = QLabel("Cargando tareas...")
        self.lbl_resumen.setFont(QFont("Segoe UI", 10))
        self.lbl_resumen.setStyleSheet(f"color: {COLORES['texto_sec']};")
        self.layout_principal.addWidget(self.lbl_resumen)

        # Área scrollable de tareas
        self.scroll = QScrollArea()
        self.scroll.setWidgetResizable(True)
        self.scroll.setStyleSheet("QScrollArea { border: none; }")

        self.contenedor_tareas = QWidget()
        self.layout_tareas = QVBoxLayout(self.contenedor_tareas)
        self.layout_tareas.setSpacing(6)
        self.layout_tareas.addStretch()

        self.scroll.setWidget(self.contenedor_tareas)
        self.layout_principal.addWidget(self.scroll)

        # Botón Fin de Jornada
        self.btn_fin_jornada = QPushButton("🔚  Fin de Jornada")
        self.btn_fin_jornada.setFixedHeight(42)
        self.btn_fin_jornada.setFont(QFont("Segoe UI", 12, QFont.Weight.Bold))
        self.btn_fin_jornada.setStyleSheet(f"""
            QPushButton {{
                background-color: {COLORES['acento']};
                color: white;
                border: none;
                border-radius: 8px;
                padding: 8px;
            }}
            QPushButton:hover {{ background-color: #4F46E5; }}
        """)
        self.btn_fin_jornada.clicked.connect(self.fin_jornada)
        self.layout_principal.addWidget(self.btn_fin_jornada)

        # Botón refrescar
        self.btn_refresh = QPushButton("🔄 Actualizar")
        self.btn_refresh.setFixedHeight(32)
        self.btn_refresh.setFont(QFont("Segoe UI", 10))
        self.btn_refresh.clicked.connect(self.cargar_tareas)
        self.btn_refresh.setStyleSheet(f"""
            QPushButton {{
                background-color: transparent;
                color: {COLORES['texto_sec']};
                border: 1px solid #4B5563;
                border-radius: 6px;
            }}
        """)
        self.layout_principal.addWidget(self.btn_refresh)

    def _configurar_tray(self):
        """Ícono en la bandeja del sistema (esquina inferior derecha)"""
        self.tray = QSystemTrayIcon(self)
        # Icono simple (en producción usar un .ico)
        pixmap = QPixmap(32, 32)
        pixmap.fill(QColor(COLORES["acento"]))
        self.tray.setIcon(QIcon(pixmap))
        self.tray.setToolTip("TaskFlow Pro")

        menu_tray = QMenu()
        accion_mostrar = QAction("Mostrar", self)
        accion_mostrar.triggered.connect(self.show)
        accion_salir = QAction("Salir", self)
        accion_salir.triggered.connect(QApplication.quit)

        menu_tray.addAction(accion_mostrar)
        menu_tray.addSeparator()
        menu_tray.addAction(accion_salir)

        self.tray.setContextMenu(menu_tray)
        self.tray.activated.connect(self._tray_click)
        self.tray.show()

    def _tray_click(self, reason):
        if reason == QSystemTrayIcon.ActivationReason.DoubleClick:
            self.show()
            self.raise_()

    def _cargar_sesion_guardada(self):
        """Recupera el token guardado en sesiones anteriores"""
        settings = QSettings("TaskFlowPro", "Widget")
        token = settings.value("token", "")
        if token:
            self.token = token
            nombre = settings.value("nombre", "Usuario")
            self.lbl_usuario.setText(f"👤 {nombre}")
            self.hora_fin_jornada = settings.value("hora_fin", "18:00")
            self.cargar_tareas()
        else:
            self.lbl_resumen.setText("⚠️ No hay sesión. Iniciá sesión desde la web.")

    def cargar_tareas(self):
        """Llama a la API para traer las tareas del día"""
        if not self.token:
            return

        self.lbl_resumen.setText("Actualizando...")
        worker = ApiWorker("GET", "/tareas/", token=self.token)
        worker.resultado.connect(self._mostrar_tareas)
        worker.error.connect(self._mostrar_error)
        self.workers.append(worker)
        worker.start()

    def _mostrar_tareas(self, data):
        """Renderiza las cards de tareas en el widget"""
        self.tareas = data if isinstance(data, list) else []

        # Limpiar cards anteriores
        for i in reversed(range(self.layout_tareas.count())):
            item = self.layout_tareas.itemAt(i)
            if item.widget():
                item.widget().deleteLater()

        if not self.tareas:
            lbl = QLabel("🎉 No hay tareas pendientes hoy")
            lbl.setAlignment(Qt.AlignmentFlag.AlignCenter)
            lbl.setStyleSheet(f"color: {COLORES['texto_sec']}; padding: 20px;")
            self.layout_tareas.addWidget(lbl)
        else:
            completadas = sum(1 for t in self.tareas if t.get("estado") == "completada")
            total = len(self.tareas)
            self.lbl_resumen.setText(
                f"📋 {completadas}/{total} completadas hoy"
            )

            for tarea in self.tareas:
                card = TareaCard(tarea)
                card.signal_iniciar.connect(self.iniciar_tarea)
                card.signal_pausar.connect(self.pausar_tarea)
                card.signal_reanudar.connect(self.reanudar_tarea)
                card.signal_finalizar.connect(self.finalizar_tarea)
                self.layout_tareas.insertWidget(self.layout_tareas.count() - 1, card)

        self.layout_tareas.addStretch()

    def _mostrar_error(self, mensaje: str):
        self.lbl_resumen.setText(f"❌ {mensaje}")
        self.tray.showMessage("TaskFlow Pro", mensaje,
                              QSystemTrayIcon.MessageIcon.Warning, 3000)

    def iniciar_tarea(self, tarea_id: str):
        worker = ApiWorker("POST", f"/tareas/{tarea_id}/iniciar", token=self.token)
        worker.resultado.connect(lambda _: self.cargar_tareas())
        worker.error.connect(self._mostrar_error)
        self.workers.append(worker)
        worker.start()

    def pausar_tarea(self, tarea_id: str):
        dlg = DialogPausa(self)
        if dlg.exec() == QDialog.DialogCode.Accepted:
            motivo = dlg.obtener_motivo()
            if not motivo:
                QMessageBox.warning(self, "Aviso", "El motivo de pausa es obligatorio.")
                return
            worker = ApiWorker(
                "POST", f"/tareas/{tarea_id}/pausar",
                datos={"motivo": motivo}, token=self.token
            )
            worker.resultado.connect(lambda _: self.cargar_tareas())
            worker.error.connect(self._mostrar_error)
            self.workers.append(worker)
            worker.start()

    def reanudar_tarea(self, tarea_id: str):
        worker = ApiWorker("POST", f"/tareas/{tarea_id}/reanudar", token=self.token)
        worker.resultado.connect(lambda _: self.cargar_tareas())
        worker.error.connect(self._mostrar_error)
        self.workers.append(worker)
        worker.start()

    def finalizar_tarea(self, tarea_id: str):
        worker = ApiWorker("POST", f"/tareas/{tarea_id}/finalizar",
                           datos={}, token=self.token)
        worker.resultado.connect(lambda _: self.cargar_tareas())
        worker.error.connect(self._mostrar_error)
        self.workers.append(worker)
        worker.start()

    def fin_jornada(self):
        dlg = DialogFinJornada(self.hora_fin_jornada, self)
        if dlg.exec() == QDialog.DialogCode.Accepted:
            datos = dlg.obtener_datos()
            # Registrar cierre de jornada en la API
            worker = ApiWorker(
                "POST", "/tareas/heredar",
                datos=datos, token=self.token
            )
            worker.resultado.connect(lambda _: self.tray.showMessage(
                "TaskFlow Pro", "Jornada cerrada. ¡Hasta mañana!",
                QSystemTrayIcon.MessageIcon.Information, 4000
            ))
            worker.error.connect(self._mostrar_error)
            self.workers.append(worker)
            worker.start()

    def closeEvent(self, event):
        """Al cerrar la ventana, minimizar al tray en vez de salir"""
        event.ignore()
        self.hide()
        self.tray.showMessage(
            "TaskFlow Pro",
            "El widget sigue corriendo en la barra de tareas.",
            QSystemTrayIcon.MessageIcon.Information,
            2000
        )


# ============================================================
# PUNTO DE ENTRADA
# ============================================================
def main():
    app = QApplication(sys.argv)
    app.setApplicationName(APP_NAME)
    app.setOrganizationName("TaskFlowPro")

    # Evitar que el app cierre al cerrar la ventana principal
    app.setQuitOnLastWindowClosed(False)

    ventana = VentanaPrincipal()
    ventana.show()

    sys.exit(app.exec())


if __name__ == "__main__":
    main()
