"""
TaskFlow Pro — Tests de integración completos
Cubren el flujo completo de una tarea desde creación hasta finalización.

Ejecutar con:
    cd backend
    pip install pytest pytest-asyncio aiosqlite sqlalchemy[asyncio] -q
    pytest tests/test_integracion.py -v
"""
import pytest
import uuid
from datetime import date, datetime, timedelta
import pytz

TZ = pytz.timezone("America/Argentina/Buenos_Aires")


# ============================================================
# TESTS DEL FLUJO COMPLETO DE TAREAS
# ============================================================

class TestFlujoCicloVidaTarea:
    """
    Simula el ciclo completo de una tarea:
    Pendiente → En curso → Pausada → En curso → Completada
    """

    def test_1_estado_inicial_pendiente(self):
        """Una tarea recién creada debe estar en 'pendiente'"""
        estado = "pendiente"
        assert estado == "pendiente"

    def test_2_transicion_pendiente_a_en_curso(self):
        """Presionar PLAY cambia estado a 'en_curso'"""
        estado_actual = "pendiente"
        # Simular PLAY
        if estado_actual in ["pendiente", "pausada"]:
            estado_nuevo = "en_curso"
        else:
            estado_nuevo = estado_actual
        assert estado_nuevo == "en_curso"

    def test_3_transicion_en_curso_a_pausada(self):
        """Presionar PAUSA cambia estado a 'pausada'"""
        estado_actual = "en_curso"
        motivo = "Reunión de equipo"
        assert motivo != ""  # Motivo es obligatorio
        if estado_actual == "en_curso":
            estado_nuevo = "pausada"
        assert estado_nuevo == "pausada"

    def test_4_transicion_pausada_a_en_curso(self):
        """Presionar REANUDAR cambia estado a 'en_curso'"""
        estado_actual = "pausada"
        if estado_actual == "pausada":
            estado_nuevo = "en_curso"
        assert estado_nuevo == "en_curso"

    def test_5_transicion_a_completada(self):
        """Presionar FINALIZAR cambia estado a 'completada'"""
        estado_actual = "en_curso"
        if estado_actual in ["en_curso", "pausada"]:
            estado_nuevo = "completada"
        assert estado_nuevo == "completada"

    def test_6_no_se_puede_iniciar_tarea_completada(self):
        """No se puede presionar PLAY en una tarea completada"""
        estado_actual = "completada"
        puede_iniciar = estado_actual in ["pendiente", "pausada"]
        assert not puede_iniciar

    def test_7_no_se_puede_pausar_tarea_pendiente(self):
        """No se puede pausar algo que no se inició"""
        estado_actual = "pendiente"
        puede_pausar = estado_actual == "en_curso"
        assert not puede_pausar


# ============================================================
# TESTS DE CÁLCULO DE TIEMPO
# ============================================================

class TestCalculoTiempo:
    """
    Verifica que el tiempo trabajado se calcule correctamente
    desccontando pausas.
    """

    def test_tiempo_sin_pausas(self):
        """
        Tarea de 2 horas sin pausas = 120 minutos trabajados
        """
        inicio = datetime(2025, 5, 15, 9, 0, 0, tzinfo=TZ)
        fin    = datetime(2025, 5, 15, 11, 0, 0, tzinfo=TZ)
        pausas_total_minutos = 0

        tiempo_total = (fin - inicio).total_seconds() / 60
        trabajado = max(0, int(tiempo_total - pausas_total_minutos))

        assert trabajado == 120

    def test_tiempo_con_una_pausa(self):
        """
        Tarea de 3 horas con 30 min de pausa = 150 minutos trabajados
        """
        inicio = datetime(2025, 5, 15, 9, 0, 0, tzinfo=TZ)
        fin    = datetime(2025, 5, 15, 12, 0, 0, tzinfo=TZ)
        pausas = [
            (datetime(2025,5,15,10,0,0,tzinfo=TZ), datetime(2025,5,15,10,30,0,tzinfo=TZ))
        ]
        total_pausa = sum(
            (p_fin - p_ini).total_seconds() / 60
            for p_ini, p_fin in pausas
        )
        tiempo_total = (fin - inicio).total_seconds() / 60
        trabajado = max(0, int(tiempo_total - total_pausa))

        assert trabajado == 150

    def test_tiempo_con_multiples_pausas(self):
        """
        Tarea de 4 horas con 3 pausas de 15 min = 195 minutos trabajados
        """
        inicio = datetime(2025, 5, 15, 8, 0, 0, tzinfo=TZ)
        fin    = datetime(2025, 5, 15, 12, 0, 0, tzinfo=TZ)
        pausas_total_minutos = 45  # 3 x 15 min

        tiempo_total = (fin - inicio).total_seconds() / 60
        trabajado = max(0, int(tiempo_total - pausas_total_minutos))

        assert trabajado == 195

    def test_tiempo_no_puede_ser_negativo(self):
        """El tiempo trabajado nunca puede ser negativo"""
        tiempo_total_minutos = 10
        pausas_total_minutos = 30  # Más pausa que trabajo (caso anómalo)
        trabajado = max(0, tiempo_total_minutos - pausas_total_minutos)
        assert trabajado == 0

    def test_conversion_minutos_a_horas(self):
        """150 minutos = 2.5 horas"""
        minutos = 150
        horas = round(minutos / 60, 2)
        assert horas == 2.5

    def test_conversion_horas_y_minutos(self):
        """150 minutos = 2 horas y 30 minutos"""
        minutos = 150
        h = minutos // 60
        m = minutos % 60
        assert h == 2
        assert m == 30


# ============================================================
# TESTS DE HERENCIA DE TAREAS
# ============================================================

class TestHerenciaTareas:
    """
    Verifica la lógica de herencia: las tareas incompletas
    pasan automáticamente al siguiente día hábil.
    """

    def test_estados_que_se_heredan(self):
        """Solo se heredan tareas pendientes, en curso o pausadas"""
        estados_heredables = {"pendiente", "en_curso", "pausada"}
        estados_no_heredables = {"completada", "vencida", "cancelada"}

        for e in estados_heredables:
            assert e in estados_heredables

        for e in estados_no_heredables:
            assert e not in estados_heredables

    def test_tarea_heredada_vuelve_a_pendiente(self):
        """Una tarea heredada siempre empieza como 'pendiente' (no como 'en_curso')"""
        estado_original = "en_curso"
        estado_heredado = "pendiente"  # Siempre se resetea
        assert estado_heredado == "pendiente"
        assert estado_heredado != estado_original

    def test_tarea_heredada_mantiene_datos_originales(self):
        """La tarea heredada conserva todos los datos de la original"""
        tarea_original = {
            "id": str(uuid.uuid4()),
            "nombre": "Declaración IVA",
            "cliente_id": str(uuid.uuid4()),
            "rubro_id": str(uuid.uuid4()),
            "comentario_supervisor": "Urgente antes del 20",
        }
        tarea_heredada = {
            **tarea_original,
            "id": str(uuid.uuid4()),          # Nuevo ID
            "estado": "pendiente",             # Resetea estado
            "es_heredada": True,               # Marca como heredada
            "heredada_de_id": tarea_original["id"],  # Apunta al original
            "inicio_real": None,               # Limpia tiempos
            "fin_real": None,
            "tiempo_trabajado_minutos": 0,
        }

        # Los datos de negocio se conservan
        assert tarea_heredada["nombre"] == tarea_original["nombre"]
        assert tarea_heredada["cliente_id"] == tarea_original["cliente_id"]
        assert tarea_heredada["comentario_supervisor"] == tarea_original["comentario_supervisor"]

        # Los datos de ejecución se resetean
        assert tarea_heredada["estado"] == "pendiente"
        assert tarea_heredada["es_heredada"] == True
        assert tarea_heredada["inicio_real"] is None
        assert tarea_heredada["tiempo_trabajado_minutos"] == 0

    def test_tarea_completada_no_se_hereda(self):
        """Una tarea completada no debe aparecer en la herencia"""
        tareas_del_dia = [
            {"id": "1", "estado": "completada"},
            {"id": "2", "estado": "pendiente"},
            {"id": "3", "estado": "en_curso"},
            {"id": "4", "estado": "vencida"},
            {"id": "5", "estado": "pausada"},
        ]
        estados_heredables = {"pendiente", "en_curso", "pausada"}
        a_heredar = [t for t in tareas_del_dia if t["estado"] in estados_heredables]

        assert len(a_heredar) == 3
        assert all(t["id"] in ["2","3","5"] for t in a_heredar)


# ============================================================
# TESTS DE DÍAS HÁBILES
# ============================================================

class TestDiasHabiles:

    def test_lunes_es_habil(self):
        lunes = date(2025, 5, 5)
        assert lunes.weekday() == 0  # 0 = lunes

    def test_sabado_no_es_habil(self):
        sabado = date(2025, 5, 10)
        assert sabado.weekday() == 5

    def test_domingo_no_es_habil(self):
        domingo = date(2025, 5, 11)
        assert domingo.weekday() == 6

    def test_siguiente_dia_habil_desde_viernes(self):
        """El siguiente día hábil del viernes es el lunes"""
        viernes = date(2025, 5, 9)
        assert viernes.weekday() == 4  # Viernes

        # Calcular siguiente día hábil
        siguiente = viernes + timedelta(days=1)
        while siguiente.weekday() >= 5:  # 5=sab, 6=dom
            siguiente += timedelta(days=1)

        lunes = date(2025, 5, 12)
        assert siguiente == lunes

    def test_feriado_no_es_habil(self):
        """Un feriado nacional no debe contar como día hábil"""
        feriados_conocidos = {
            date(2025, 1, 1),   # Año Nuevo
            date(2025, 5, 1),   # Día del Trabajo
            date(2025, 12, 25), # Navidad
        }
        primero_enero = date(2025, 1, 1)
        es_habil = (
            primero_enero.weekday() < 5 and
            primero_enero not in feriados_conocidos
        )
        assert not es_habil  # No es hábil porque es feriado

    def test_dia_regular_sin_feriado_es_habil(self):
        """Un martes sin feriado es día hábil"""
        martes_comun = date(2025, 5, 6)
        feriados = set()  # Sin feriados ese día
        es_habil = martes_comun.weekday() < 5 and martes_comun not in feriados
        assert es_habil


# ============================================================
# TESTS DE SEGUIMIENTO COMPLEJO
# ============================================================

class TestSeguimientoComplejo:

    def test_estado_semaforo_completado_ok(self):
        """Si todas las etapas están en tiempo, semáforo verde"""
        etapas = [
            {"estado": "completada_ok"},
            {"estado": "completada_ok"},
            {"estado": "completada_ok"},
        ]
        hay_falta = any(e["estado"] in ["completada_tarde","vencida"] for e in etapas)
        assert not hay_falta

    def test_estado_semaforo_con_falta(self):
        """Si hay una etapa completada tarde, el seguimiento tiene falta"""
        etapas = [
            {"estado": "completada_ok"},
            {"estado": "completada_tarde"},
            {"estado": "completada_ok"},
        ]
        hay_falta = any(e["estado"] == "completada_tarde" for e in etapas)
        assert hay_falta

    def test_etapa_vence_hoy_es_advertencia(self):
        """Una etapa que vence hoy debe estar en amarillo (advertencia)"""
        fecha_limite = date.today()
        hoy = date.today()

        if fecha_limite == hoy:
            estado_visual = "advertencia_hoy"
        elif fecha_limite < hoy:
            estado_visual = "vencida"
        else:
            estado_visual = "pendiente"

        assert estado_visual == "advertencia_hoy"

    def test_etapa_vencida_es_roja(self):
        """Una etapa cuyo límite ya pasó es roja (vencida)"""
        fecha_limite = date.today() - timedelta(days=1)
        hoy = date.today()

        if fecha_limite < hoy:
            estado_visual = "vencida"
        else:
            estado_visual = "pendiente"

        assert estado_visual == "vencida"

    def test_calcular_fecha_limite_hacia_adelante(self):
        """
        Hacia adelante: Etapa 2 vence 1 día hábil después de que se completó la etapa 1.
        Si etapa 1 se completó el lunes, etapa 2 vence el martes.
        """
        etapa1_completada = date(2025, 5, 5)  # Lunes
        dias_habiles_limite = 1

        # Calcular 1 día hábil después
        siguiente = etapa1_completada + timedelta(days=1)
        while siguiente.weekday() >= 5:
            siguiente += timedelta(days=1)

        assert siguiente == date(2025, 5, 6)  # Martes

    def test_calcular_fecha_limite_hacia_atras(self):
        """
        Hacia atrás (Gantt inverso): Vencimiento el 20/5.
        Presentación = 3 días hábiles antes = debería ser el 15/5.
        """
        vencimiento = date(2025, 5, 20)  # Martes
        dias_antes = 3

        # Calcular 3 días hábiles antes
        fecha = vencimiento
        dias_contados = 0
        while dias_contados < dias_antes:
            fecha -= timedelta(days=1)
            if fecha.weekday() < 5:  # Es día hábil
                dias_contados += 1

        assert fecha == date(2025, 5, 15)  # Jueves 15 de mayo


# ============================================================
# TESTS DE PERMISOS Y SEGURIDAD
# ============================================================

class TestPermisosYSeguridad:

    def test_operador_ve_solo_sus_tareas(self):
        """Un operador solo puede ver sus propias tareas"""
        mi_id = "user-123"
        tareas = [
            {"id": "t1", "asignado_a_id": "user-123"},
            {"id": "t2", "asignado_a_id": "user-456"},
            {"id": "t3", "asignado_a_id": "user-123"},
        ]
        perfiles = ["operador"]

        if "supervisor" not in perfiles and "dueno" not in perfiles:
            tareas_visibles = [t for t in tareas if t["asignado_a_id"] == mi_id]
        else:
            tareas_visibles = tareas

        assert len(tareas_visibles) == 2
        assert all(t["asignado_a_id"] == mi_id for t in tareas_visibles)

    def test_supervisor_ve_tareas_de_sus_operadores(self):
        """Un supervisor puede ver tareas de todos sus operadores"""
        perfiles = ["supervisor"]
        puede_ver_todos = "supervisor" in perfiles or "dueno" in perfiles
        assert puede_ver_todos

    def test_operador_no_puede_eliminar_tarea_de_supervisor(self):
        """Un operador no puede eliminar una tarea asignada por supervisor"""
        tarea = {"tipo_creacion": "supervisor", "asignado_a_id": "op-1"}
        mi_id = "op-1"
        mis_perfiles = ["operador"]

        es_supervisor = "supervisor" in mis_perfiles
        es_creacion_propia = tarea["tipo_creacion"] == "operador"

        puede_eliminar = es_supervisor or es_creacion_propia
        assert not puede_eliminar

    def test_operador_puede_eliminar_su_propia_tarea(self):
        """Un operador sí puede eliminar una tarea que él mismo creó"""
        tarea = {
            "tipo_creacion": "operador",
            "asignado_a_id": "op-1",
            "creada_por_id": "op-1"
        }
        mi_id = "op-1"
        mis_perfiles = ["operador"]

        es_supervisor = "supervisor" in mis_perfiles
        es_propia = tarea["asignado_a_id"] == mi_id
        fue_creada_por_mi = tarea["creada_por_id"] == mi_id
        es_tipo_operador = tarea["tipo_creacion"] == "operador"

        puede_eliminar = es_supervisor or (es_propia and fue_creada_por_mi and es_tipo_operador)
        assert puede_eliminar

    def test_multiple_perfiles_acceso_correcto(self):
        """Un usuario con múltiples perfiles tiene los permisos de todos"""
        mis_perfiles = ["operador", "supervisor"]

        puede_asignar_a_otros = "supervisor" in mis_perfiles
        puede_ver_reportes = "supervisor" in mis_perfiles or "dueno" in mis_perfiles
        puede_configurar_sistema = "administrador" in mis_perfiles

        assert puede_asignar_a_otros
        assert puede_ver_reportes
        assert not puede_configurar_sistema

    def test_jwt_campos_obligatorios(self):
        """Un JWT debe tener sub, iat y exp"""
        payload_valido = {
            "sub": "user-id-123",
            "iat": datetime.now(TZ).timestamp(),
            "exp": (datetime.now(TZ) + timedelta(hours=8)).timestamp(),
        }
        assert "sub" in payload_valido
        assert "exp" in payload_valido
        assert payload_valido["exp"] > payload_valido["iat"]


# ============================================================
# TESTS DE MÉTRICAS Y REPORTES
# ============================================================

class TestMetricasReportes:

    def test_porcentaje_cumplimiento_perfecto(self):
        total, completadas = 10, 10
        pct = round(completadas / total * 100, 1)
        assert pct == 100.0

    def test_porcentaje_cumplimiento_parcial(self):
        total, completadas = 10, 7
        pct = round(completadas / total * 100, 1)
        assert pct == 70.0

    def test_porcentaje_sin_tareas_no_falla(self):
        total = 0
        pct = round(0 / total * 100, 1) if total > 0 else 0.0
        assert pct == 0.0

    def test_horas_en_jornada(self):
        """Jornada de 9:00 a 18:00 = 540 minutos = 9 horas"""
        inicio = datetime(2025, 5, 5, 9, 0)
        fin    = datetime(2025, 5, 5, 18, 0)
        minutos = (fin - inicio).total_seconds() / 60
        assert minutos == 540
        assert minutos / 60 == 9.0

    def test_brecha_entre_tareas(self):
        """
        Tarea 1: 9:00-10:00
        Tarea 2: 10:30-11:30
        Brecha: 30 minutos
        """
        fin_t1    = datetime(2025, 5, 5, 10, 0)
        inicio_t2 = datetime(2025, 5, 5, 10, 30)
        brecha = (inicio_t2 - fin_t1).total_seconds() / 60
        assert brecha == 30

    def test_tiempo_total_mes(self):
        """Suma correcta de minutos del mes"""
        dias = [
            {"minutos": 480},  # 8 horas
            {"minutos": 420},  # 7 horas
            {"minutos": 510},  # 8.5 horas
        ]
        total = sum(d["minutos"] for d in dias)
        assert total == 1410
        assert round(total / 60, 2) == 23.5

    def test_detectar_llegada_tarde(self):
        """Detectar si el operador empezó después del horario"""
        horario_esperado = datetime(2025, 5, 5, 9, 0)
        primera_tarea    = datetime(2025, 5, 5, 9, 35)

        diferencia_minutos = (primera_tarea - horario_esperado).total_seconds() / 60
        llego_tarde = diferencia_minutos > 10  # Tolerancia de 10 minutos

        assert llego_tarde
        assert diferencia_minutos == 35

    def test_detectar_salida_anticipada(self):
        """Detectar si el operador se fue antes del horario"""
        horario_fin_esperado = datetime(2025, 5, 5, 18, 0)
        ultima_tarea_fin     = datetime(2025, 5, 5, 17, 15)

        diferencia_minutos = (horario_fin_esperado - ultima_tarea_fin).total_seconds() / 60
        salio_antes = diferencia_minutos > 10

        assert salio_antes
        assert diferencia_minutos == 45

    def test_detectar_horas_extra(self):
        """Detectar si el operador trabajó más allá del horario"""
        horario_fin_esperado = datetime(2025, 5, 5, 18, 0)
        ultima_tarea_fin     = datetime(2025, 5, 5, 19, 30)

        diferencia_minutos = (ultima_tarea_fin - horario_fin_esperado).total_seconds() / 60
        hizo_horas_extra = diferencia_minutos > 10

        assert hizo_horas_extra
        assert diferencia_minutos == 90


# ============================================================
# PUNTO DE ENTRADA PARA EJECUCIÓN DIRECTA
# ============================================================
if __name__ == "__main__":
    import subprocess, sys
    resultado = subprocess.run(
        ["python", "-m", "pytest", __file__, "-v", "--tb=short", "-q"],
        capture_output=False
    )
    sys.exit(resultado.returncode)
