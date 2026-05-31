"""
Servicio de envío de emails transaccionales.
Usa la configuración SMTP de la empresa activa.
Los templates usan {{variable}} para personalización.
"""
import smtplib
import ssl
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Optional
import logging

logger = logging.getLogger(__name__)

# Variables disponibles en los templates de email
VARIABLES_DISPONIBLES = {
    "{{cliente_nombre}}":   "Nombre completo del cliente",
    "{{cliente_email}}":    "Email del cliente",
    "{{tarea_nombre}}":     "Nombre de la tarea completada",
    "{{tarea_codigo}}":     "Código de la tarea",
    "{{operador_nombre}}":  "Nombre del operador que la completó",
    "{{empresa_nombre}}":   "Nombre del estudio contable",
    "{{fecha_completada}}": "Fecha de completado (dd/MM/yyyy)",
    "{{hora_completada}}":  "Hora de completado (HH:MM)",
    "{{tiempo_trabajado}}": "Tiempo total trabajado (Xh Ym)",
}


def renderizar_template(template: str, variables: dict) -> str:
    """Reemplaza {{variable}} por su valor en el template."""
    resultado = template
    for clave, valor in variables.items():
        resultado = resultado.replace(f"{{{{{clave}}}}}", str(valor or ""))
    return resultado


async def enviar_email_tarea_completada(
    db,
    empresa_id: str,
    tarea_id: str,
) -> bool:
    """
    Busca la configuración SMTP de la empresa, obtiene los datos de la tarea
    y envía el email al cliente si el catálogo lo tiene configurado.
    Retorna True si se envió, False si no aplica o falla.
    """
    from sqlalchemy import text

    # Obtener datos completos de la tarea + catálogo + cliente + operador + empresa
    result = await db.execute(text("""
        SELECT
            t.id,
            t.fin_real,
            t.tiempo_trabajado_minutos,
            COALESCE(ct.nombre, t.nombre_personalizado, 'Sin nombre') AS tarea_nombre,
            COALESCE(ct.codigo, '')                                    AS tarea_codigo,
            ct.enviar_email_al_completar,
            ct.email_asunto,
            ct.email_cuerpo,
            c.razon_social      AS cliente_nombre,
            c.email             AS cliente_email,
            u.nombre || ' ' || u.apellido AS operador_nombre,
            e.nombre            AS empresa_nombre,
            e.smtp_host,
            e.smtp_puerto,
            e.smtp_usuario,
            e.smtp_password_enc
        FROM tareas t
        LEFT JOIN catalogo_tareas ct ON t.catalogo_tarea_id = ct.id
        LEFT JOIN clientes  c ON t.cliente_id     = c.id
        LEFT JOIN usuarios  u ON t.asignado_a_id  = u.id
        LEFT JOIN empresas  e ON t.empresa_id     = e.id
        WHERE t.id = :tid
    """), {"tid": tarea_id})
    row = result.fetchone()

    if not row:
        return False

    # Solo enviar si el catálogo lo tiene habilitado y hay cliente con email
    if not row.enviar_email_al_completar:
        return False
    if not row.cliente_email:
        logger.warning(f"Tarea {tarea_id}: cliente sin email, no se envía notificación")
        return False
    if not row.smtp_host or not row.smtp_usuario or not row.smtp_password_enc:
        logger.warning(f"Tarea {tarea_id}: empresa sin SMTP configurado")
        return False

    # Preparar variables del template
    fin_real  = row.fin_real
    fecha_str = fin_real.strftime("%d/%m/%Y") if fin_real else "—"
    hora_str  = fin_real.strftime("%H:%M")    if fin_real else "—"
    mins      = row.tiempo_trabajado_minutos or 0
    tiempo_str = f"{mins // 60}h {mins % 60:02d}m" if mins >= 60 else f"{mins}m"

    variables = {
        "cliente_nombre":   row.cliente_nombre   or "Cliente",
        "cliente_email":    row.cliente_email,
        "tarea_nombre":     row.tarea_nombre,
        "tarea_codigo":     row.tarea_codigo,
        "operador_nombre":  row.operador_nombre  or "—",
        "empresa_nombre":   row.empresa_nombre   or "El estudio",
        "fecha_completada": fecha_str,
        "hora_completada":  hora_str,
        "tiempo_trabajado": tiempo_str,
    }

    asunto = renderizar_template(
        row.email_asunto or f"[{row.tarea_codigo}] {row.tarea_nombre} — completada",
        variables
    )
    cuerpo = renderizar_template(
        row.email_cuerpo or (
            f"Estimado/a {{{{cliente_nombre}}}},\n\n"
            f"Le informamos que la tarea **{row.tarea_nombre}** "
            f"fue completada el {{{{fecha_completada}}}} a las {{{{hora_completada}}}}.\n\n"
            f"Tiempo trabajado: {{{{tiempo_trabajado}}}}\n"
            f"Responsable: {{{{operador_nombre}}}}\n\n"
            f"Saludos,\n{{{{empresa_nombre}}}}"
        ),
        variables
    )

    # Enviar email en un hilo separado (no bloquear la respuesta HTTP)
    import threading
    t = threading.Thread(
        target=_enviar_smtp,
        args=(
            row.smtp_host, row.smtp_puerto or 587,
            row.smtp_usuario, row.smtp_password_enc,
            row.smtp_usuario,   # from
            row.cliente_email,  # to
            asunto, cuerpo,
            row.empresa_nombre
        ),
        daemon=True
    )
    t.start()
    return True


def _enviar_smtp(
    host: str, puerto: int, usuario: str, password: str,
    from_addr: str, to_addr: str,
    asunto: str, cuerpo: str, empresa_nombre: str
):
    """Envío SMTP real. Se ejecuta en un hilo separado."""
    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = asunto
        msg["From"]    = f"{empresa_nombre} <{from_addr}>"
        msg["To"]      = to_addr

        # Versión texto plano
        texto_plano = cuerpo.replace("**", "").replace("*", "")
        msg.attach(MIMEText(texto_plano, "plain", "utf-8"))

        # Versión HTML: convierte saltos de línea y **negrita**
        import re
        html_body = cuerpo.replace("\n", "<br>")
        html_body = re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", html_body)
        html_content = f"""
        <html><body style="font-family:Arial,sans-serif;color:#333;line-height:1.6">
        <p>{html_body}</p>
        </body></html>"""
        msg.attach(MIMEText(html_content, "html", "utf-8"))

        context = ssl.create_default_context()
        with smtplib.SMTP(host, puerto, timeout=15) as server:
            server.ehlo()
            server.starttls(context=context)
            server.login(usuario, password)
            server.sendmail(from_addr, to_addr, msg.as_string())
        logger.info(f"Email enviado a {to_addr}: {asunto}")

    except Exception as exc:
        logger.error(f"Error enviando email a {to_addr}: {exc}")
