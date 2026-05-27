// src/hooks/useAuth.js — Hook de autenticación
import { useState, useEffect, createContext, useContext } from "react";
import { loginConGoogle, logout as apiLogout } from "../api/client";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem("taskflow_usuario");
    const token = localStorage.getItem("taskflow_token");
    if (stored && token) {
      try { setUsuario(JSON.parse(stored)); } catch {}
    }
    setCargando(false);
  }, []);

  async function login(googleToken) {
    const data = await loginConGoogle(googleToken);
    setUsuario(data.usuario);
    return data;
  }

  function logout() {
    apiLogout();
    setUsuario(null);
  }

  const esSupervisor = usuario?.perfiles?.some(p =>
    ["supervisor", "dueno", "administrador"].includes(p)
  );
  const esAdmin = usuario?.perfiles?.includes("administrador");

  return (
    <AuthContext.Provider value={{ usuario, login, logout, cargando, esSupervisor, esAdmin }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
