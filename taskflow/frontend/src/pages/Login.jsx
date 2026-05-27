import { useContext, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { AuthContext } from "../context/AuthContext.jsx";

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;

export default function Login() {
  const { login, usuario } = useContext(AuthContext);
  const navigate = useNavigate();

  useEffect(() => {
    if (usuario) navigate("/");
  }, [usuario]);

  useEffect(() => {
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = () => {
      if (window.google) {
        window.google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: handleCredencialGoogle,
        });
        window.google.accounts.id.renderButton(
          document.getElementById("google-btn"),
          { theme: "outline", size: "large", locale: "es", width: 280 }
        );
      }
    };
    document.body.appendChild(script);
    return () => document.body.removeChild(script);
  }, []);

  const handleCredencialGoogle = async (respuesta) => {
    try {
      await login(respuesta.credential);
      navigate("/");
    } catch (err) {
      alert("Error al iniciar sesión: " + err.message);
    }
  };

  return (
    <div style={{minHeight:"100vh", background:"linear-gradient(135deg, #1e3a8a, #2563eb)", display:"flex", alignItems:"center", justifyContent:"center", padding:"16px"}}>
      <div style={{background:"white", borderRadius:"16px", padding:"32px", width:"100%", maxWidth:"360px", textAlign:"center", boxShadow:"0 20px 60px rgba(0,0,0,0.3)"}}>
        <div style={{width:"64px", height:"64px", background:"#2563eb", borderRadius:"16px", margin:"0 auto 12px", display:"flex", alignItems:"center", justifyContent:"center"}}>
          <span style={{color:"white", fontSize:"28px", fontWeight:"bold"}}>T</span>
        </div>
        <h1 style={{fontSize:"24px", fontWeight:"bold", color:"#1e293b", margin:"0 0 4px"}}>TaskFlow Pro</h1>
        <p style={{color:"#64748b", fontSize:"14px", margin:"0 0 24px"}}>Estudio Bellini</p>
        <hr style={{border:"none", borderTop:"1px solid #e2e8f0", margin:"0 0 24px"}} />
        <p style={{color:"#475569", fontSize:"14px", marginBottom:"16px"}}>
          Iniciá sesión con tu cuenta de Google
        </p>
        <div style={{display:"flex", justifyContent:"center", marginBottom:"16px"}}>
          <div id="google-btn"></div>
        </div>
        <p style={{color:"#94a3b8", fontSize:"12px"}}>
          Solo usuarios autorizados pueden acceder.
        </p>
      </div>
    </div>
  );
}
