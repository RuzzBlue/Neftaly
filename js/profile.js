import { client, account } from "./client.js";
import {
  getProfile,
  isAdmin,
  loadProfile,
  requireAuth,
  roleLabel,
} from "./auth.js";
import { escapeHtml, showError, toast } from "./utils.js";
let ready = false;
export function initProfileModal() {
  if (ready) return;
  ready = true;
  document.getElementById("btn-edit-profile").onclick = openProfileModal;
  document.getElementById("profile-save-mine").onclick = () =>
    saveMine().catch(showError);
  document.getElementById("profile-save-user").onclick = () =>
    saveUser().catch(showError);
  document
    .getElementById("profile-tab-users")
    .addEventListener("shown.bs.tab", () => renderUsers().catch(showError));
}
export function openProfileModal() {
  const p = getProfile();
  if (!p) return;
  document.getElementById("profile-nombre").value = p.nombre || "";
  document.getElementById("profile-email").value = p.email;
  for (const id of [
    "profile-current-password",
    "profile-password",
    "profile-password2",
  ])
    document.getElementById(id).value = "";
  document
    .getElementById("profile-tab-users-wrap")
    .classList.toggle("d-none", !isAdmin());
  bootstrap.Tab.getOrCreateInstance(
    document.getElementById("profile-tab-mine"),
  ).show();
  bootstrap.Offcanvas.getInstance(
    document.getElementById("offcanvas-nav"),
  )?.hide();
  bootstrap.Modal.getOrCreateInstance(
    document.getElementById("modal-profile"),
  ).show();
}
async function saveMine() {
  await requireAuth();
  const nombre = document.getElementById("profile-nombre").value.trim();
  const password = document.getElementById("profile-password").value;
  if (!nombre) throw new Error("El nombre es obligatorio");
  if (
    password &&
    (password.length < 8 ||
      password !== document.getElementById("profile-password2").value)
  )
    throw new Error("Usa al menos 8 caracteres y confirma la contraseña");
  const button = document.getElementById("profile-save-mine");
  button.disabled = true;
  try {
    if (password) {
      const { error } = await account.changePassword({
        currentPassword: document.getElementById("profile-current-password")
          .value,
        newPassword: password,
        revokeOtherSessions: true,
      });
      if (error) throw error;
    }
    const { error } = await client
      .from("profiles")
      .update({ nombre })
      .eq("id", getProfile().id);
    if (error) throw error;
    await loadProfile();
    bootstrap.Modal.getInstance(
      document.getElementById("modal-profile"),
    ).hide();
    toast("Cuenta actualizada");
  } finally {
    button.disabled = false;
  }
}
async function renderUsers() {
  if (!isAdmin()) return;
  const { data, error } = await client
    .from("profiles")
    .select("*")
    .order("nombre");
  if (error) throw error;
  const list = document.getElementById("profile-users-list");
  list.innerHTML = data
    .map(
      (u) =>
        '<div class="d-flex justify-content-between border-bottom py-2"><span>' +
        escapeHtml(u.nombre || u.email) +
        "<br><small>" +
        escapeHtml(u.email) +
        " · " +
        escapeHtml(roleLabel(u.role)) +
        '</small></span><button class="btn btn-sm btn-outline-secondary" data-user="' +
        escapeHtml(u.id) +
        '">Editar</button></div>',
    )
    .join("");
  list.querySelectorAll("[data-user]").forEach(
    (button) =>
      (button.onclick = () => {
        const u = data.find((u) => u.id === button.dataset.user);
        document.getElementById("profile-user-id").value = u.id;
        document.getElementById("profile-user-nombre").value = u.nombre || "";
        document.getElementById("profile-user-email").value = u.email;
        document.getElementById("profile-user-email").readOnly = true;
        document.getElementById("profile-user-role").value = u.role;
        document.getElementById("profile-save-user").disabled = false;
      }),
  );
}
async function saveUser() {
  if (!isAdmin()) return;
  const id = document.getElementById("profile-user-id").value;
  if (!id) return;
  const button = document.getElementById("profile-save-user");
  button.disabled = true;
  try {
    const { error } = await client
      .from("profiles")
      .update({
        nombre: document.getElementById("profile-user-nombre").value.trim(),
        role: document.getElementById("profile-user-role").value,
      })
      .eq("id", id);
    if (error) throw error;
    await loadProfile();
    await renderUsers();
    toast("Acceso actualizado");
  } finally {
    button.disabled = false;
  }
}
