import { client, account } from "./client.js";
let profile = null;
let onAuthenticated;
let busy = false;
let signup = false;
export const getProfile = () => profile;
export const isAdmin = () => profile?.role === "admin";
export const isStaff = () => ["admin", "leader"].includes(profile?.role);
export const canAccessConfig = isStaff;
export const roleLabel = (role) =>
  ({ admin: "Super Admin", leader: "Admin", pending: "Pendiente" })[role] ||
  role;
export function setOnAuthenticated(fn) {
  onAuthenticated = fn;
}
export function updateUserDisplay() {
  document.getElementById("user-display-name").textContent =
    profile?.nombre || profile?.email || "";
  document.getElementById("user-display-role").textContent =
    roleLabel(profile?.role) || "";
  document.getElementById("nav-config").classList.toggle("d-none", !isStaff());
}
function message(text) {
  const el = document.getElementById("login-error");
  el.textContent = text;
  el.classList.remove("d-none");
}
function showLogin() {
  document.getElementById("login-screen").classList.remove("d-none");
  document.getElementById("app-shell").classList.remove("ready");
}
export async function loadProfile() {
  const {
    data: { user },
    error: authError,
  } = await client.auth.getUser();
  if (authError) throw authError;
  if (!user) throw new Error("No autenticado");
  const { data, error } = await client
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Perfil todavía no disponible. Intenta de nuevo.");
  profile = data;
  updateUserDisplay();
  return data;
}
async function enter() {
  await loadProfile();
  if (!isStaff()) {
    showLogin();
    document.getElementById("pending-logout").classList.remove("d-none");
    message("Tu cuenta está pendiente. Un Super Admin debe aprobar tu acceso.");
    return false;
  }
  document.getElementById("login-screen").classList.add("d-none");
  document.getElementById("app-shell").classList.add("ready");
  document.getElementById("pending-logout").classList.add("d-none");
  await onAuthenticated?.();
  return true;
}
export async function initAuth() {
  document.getElementById("verify-email").onclick = async () => {
    const button = document.getElementById("verify-email");
    button.disabled = true;
    try {
      const email = document.getElementById("login-email").value.trim();
      const otp = document.getElementById("email-otp").value.trim();
      const { error } = await account.emailOtp.verifyEmail({ email, otp });
      if (error) throw error;
      const result = await client.auth.signInWithPassword({
        email,
        password: document.getElementById("login-password").value,
      });
      if (result.error) throw result.error;
      document.getElementById("verify-wrap").classList.add("d-none");
      await enter();
    } catch (err) {
      message(err.message);
    } finally {
      button.disabled = false;
    }
  };
  document.getElementById("resend-code").onclick = async () => {
    try {
      const { error } = await account.emailOtp.sendVerificationOtp({
        email: document.getElementById("login-email").value.trim(),
        type: "email-verification",
      });
      if (error) throw error;
      message("Código enviado. Revisa tu correo.");
    } catch (err) {
      message(err.message);
    }
  };
  document.getElementById("toggle-signup").onclick = () => {
    signup = !signup;
    document
      .getElementById("signup-name-wrap")
      .classList.toggle("d-none", !signup);
    document.getElementById("signup-name").required = signup;
    document.querySelector('#login-form button[type="submit"]').textContent =
      signup ? "Crear cuenta" : "Entrar";
    document.getElementById("toggle-signup").textContent = signup
      ? "Ya tengo cuenta"
      : "Crear mi cuenta";
    document.getElementById("login-password").minLength = signup ? 8 : 1;
  };
  document.getElementById("login-form").onsubmit = async (e) => {
    e.preventDefault();
    if (busy) return;
    busy = true;
    const button = document.querySelector('#login-form button[type="submit"]');
    button.disabled = true;
    document.getElementById("login-error").classList.add("d-none");
    try {
      const email = document.getElementById("login-email").value.trim();
      const password = document.getElementById("login-password").value;
      const result = signup
        ? await account.signUp.email({
            email,
            password,
            name: document.getElementById("signup-name").value.trim(),
          })
        : await client.auth.signInWithPassword({ email, password });
      if (result.error) {
        if (/verif/i.test(result.error.message))
          document.getElementById("verify-wrap").classList.remove("d-none");
        throw result.error;
      }
      if (signup) {
        document.getElementById("verify-wrap").classList.remove("d-none");
        message("Ingresa el código enviado a tu correo.");
        return;
      }
      const {
        data: { session },
        error,
      } = await client.auth.getSession();
      if (error) throw error;
      if (session) await enter();
      else message("Cuenta creada. Verifica tu correo y luego inicia sesión.");
    } catch (err) {
      message(err.message || "No se pudo iniciar sesión");
    } finally {
      busy = false;
      button.disabled = false;
    }
  };
  document.getElementById("btn-logout").onclick = async () => {
    try {
      const { error } = await client.auth.signOut();
      if (error) throw error;
      profile = null;
      showLogin();
      document.getElementById("pending-logout").classList.add("d-none");
      document.getElementById("verify-wrap").classList.add("d-none");
    } catch (err) {
      message(err.message);
    }
  };
  document.getElementById("pending-logout").onclick =
    document.getElementById("btn-logout").onclick;
  client.auth.onAuthStateChange((event) => {
    if (event === "SIGNED_OUT") {
      profile = null;
      showLogin();
    }
  });
  // A single explicit transition avoids duplicate loads and session-callback deadlocks.
  const {
    data: { session },
    error,
  } = await client.auth.getSession();
  if (error) throw error;
  if (session) return enter();
  showLogin();
  return false;
}
export async function requireAuth() {
  const {
    data: { user },
    error,
  } = await client.auth.getUser();
  if (error) throw error;
  if (!user) throw new Error("No autenticado");
  if (!profile) await loadProfile();
  if (!isStaff()) throw new Error("Acceso pendiente de aprobación");
  return user;
}
export async function getCurrentCiclo() {
  const { data, error } = await client
    .from("app_config")
    .select("value")
    .eq("key", "ciclo_actual")
    .maybeSingle();
  if (error) throw error;
  return parseInt(data?.value || "1", 10);
}

export async function setCurrentCiclo(n) {
  if (!isAdmin()) throw new Error("Solo Super Admin puede cambiar el ciclo");
  const { error } = await client
    .from("app_config")
    .upsert({ key: "ciclo_actual", value: String(n) });
  if (error) throw error;
}

export async function logAction(tipo, detalle, ciclo) {
  const {
    data: { user },
  } = await client.auth.getUser();
  const { error } = await client.from("action_log").insert({
    user_id: user?.id,
    tipo,
    detalle,
    ciclo: ciclo ?? null,
  });
  if (error) throw error;
}
