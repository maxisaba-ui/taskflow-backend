// frontend/src/context/AuthContext.jsx
// v1.1.0 — multi-empresa: guarda empresa activa y expone cambiarEmpresa()
import { createContext, useState, useEffect, useCallback } from "react";
import { loginConGoogle, logout as apiLogout, api } from "../api/client";

export const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [usuario,  setUsuario]  = useState(null);
  const [cargando, setCargando] = useState(true);

  // Al cargar la app, verificar si hay sesión activa
  useEffect(() => {
    const token = localStorage.getItem("taskflow_token");
    if (token) {
      api.get("/auth/me")
        .then((data) => setUsuario(data))
        .catch(() => {
          localStorage.removeItem("taskflow_token");
          setUsuario(null);
        })
        .finally(() => setCargando(false));
    } else {
      setCargando(false);
    }
  }, []);

  const login = useCallback(async (credencialGoogle) => {
    const data = await loginConGoogle(credencialGoogle);
    // data.usuario ya incluye empresa_id, empresa_nombre, logo_url, color_primario
    setUsuario(data.usuario);
    return data;
  }, []);

  const logout = useCallback(() => {
    apiLogout();
    setUsuario(null);
  }, []);

  /**
   * Cambia la empresa activa del usuario.
   * Llama a POST /auth/seleccionar-empresa, recibe un nuevo JWT
   * y lo guarda en localStorage. Actualiza el usuario en el contexto.
   */
  const cambiarEmpresa = useCallback(async (empresaId) => {
    try {
      const data = await api.post("/auth/seleccionar-empresa",
        { empresa_id: empresaId });
      // Reemplazar el token en localStorage
      localStorage.setItem("taskflow_token", data.access_token);
      // Actualizar el usuario con los datos de la nueva empresa
      setUsuario(prev => ({
        ...prev,
        empresa_id:     data.empresa_id,
        empresa_nombre: data.empresa_nombre,
        logo_url:       data.logo_url,
        color_primario: data.color_primario,
      }));
      return data;
    } catch(e) {
      console.error("Error al cambiar empresa:", e);
      throw e;
    }
  }, []);

  return (
    <AuthContext.Provider value={{
      usuario, login, logout, cargando, cambiarEmpresa
    }}>
      {children}
    </AuthContext.Provider>
  );
}
