import * as bootstrap from "bootstrap";
window.bootstrap = bootstrap;
import { initAuth, setOnAuthenticated } from "./auth.js";
import { initApp } from "./app.js";
setOnAuthenticated(initApp);
initAuth().catch((err) => {
  const el = document.getElementById("login-error");
  el.textContent = err.message || "Error al iniciar la app";
  el.classList.remove("d-none");
});
