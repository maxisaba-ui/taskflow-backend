/**
 * useResponsive — detecta el ancho de ventana y expone breakpoints.
 * Breakpoints: mobile < 768px | tablet 768-1024px | desktop > 1024px
 * No cambia ninguna lógica de negocio, solo info de pantalla.
 */
import { useState, useEffect } from "react";

export function useResponsive() {
  const [width, setWidth] = useState(
    typeof window !== "undefined" ? window.innerWidth : 1200
  );

  useEffect(() => {
    function handleResize() { setWidth(window.innerWidth); }
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return {
    width,
    isMobile:  width < 768,
    isTablet:  width >= 768 && width < 1024,
    isDesktop: width >= 1024,
  };
}
