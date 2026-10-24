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
  document.getElementById("btn-edit-profile").onclick = () =>
    openProfileModal().catch(showError);
  document.getElementById("btn-manage-users").onclick = () =>
    openProfileModal("users").catch(showError);
  document.getElementById("profile-user-new").onclick = () => editAccount(null);
  document.getElementById("profile-save-mine").onclick = () =>
    saveMine().catch(showError);
  document.getElementById("profile-save-user").onclick = () =>
    saveUser().catch(showError);
  document
    .getElementById("profile-tab-users")
    .addEventListener("shown.bs.tab", () => renderUsers().catch(showError));
}
export async function openProfileModal(tab = "mine") {
  await loadProfile();
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
    document.getElementById(
      tab === "users" && isAdmin() ? "profile-tab-users" : "profile-tab-mine",
    ),
  ).show();
  const menu = document.getElementById("offcanvas-nav");
  if (menu.classList.contains("show")) {
    await new Promise((resolve) => {
      menu.addEventListener("hidden.bs.offcanvas", resolve, { once: true });
      bootstrap.Offcanvas.getInstance(menu).hide();
    });
  }
  bootstrap.Modal.getOrCreateInstance(
    document.getElementById("modal-profile"),
  ).show();
  if (tab === "users" && isAdmin()) await renderUsers();
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

let accountRows = [];
let invitationRows = [];
function editAccount(user, invitation = false) {
  const creating = !user;
  const invite = creating || invitation;
  document.getElementById("profile-user-id").value = creating
    ? ""
    : invitation
      ? "invite:" + user.email
      : user.id;
  document.getElementById("profile-user-form-title").textContent = creating
    ? "Agregar líder"
    : invitation
      ? "Editar preautorización"
      : "Editar usuario";
  document.getElementById("profile-user-nombre").value = user?.nombre || "";
  document.getElementById("profile-user-email").value = user?.email || "";
  document.getElementById("profile-user-email").readOnly = !creating;
  document.getElementById("profile-user-role").value = user?.role || "leader";
  document.querySelector(
    '#profile-user-role option[value="pending"]',
  ).disabled = invite;
  document.getElementById("profile-user-blocked").checked = !!user?.blocked;
  document.getElementById("profile-user-blocked").disabled =
    invite || user?.id === getProfile().id;
  document.getElementById("profile-user-help").textContent = invite
    ? "Esta persona se registra con su propia contraseña y verifica su correo. El acceso queda preautorizado."
    : "Bloquear impide acceder a los datos de la tropa, incluso con una sesión ya iniciada. El correo identifica la cuenta y no se modifica aquí.";
  const button = document.getElementById("profile-save-user");
  button.disabled = false;
  button.textContent = invite ? "Guardar preautorización" : "Guardar usuario";
  document
    .getElementById("profile-user-form-title")
    .scrollIntoView({ block: "nearest" });
}
async function updateAccess(id, changes) {
  const { error } = await client
    .from("profiles")
    .update(changes)
    .eq("id", id)
    .select("id")
    .single();
  if (error) throw error;
  await loadProfile();
  await renderUsers();
}
async function renderUsers() {
  if (!isAdmin()) return;
  const [users, invitations] = await Promise.all([
    client.from("profiles").select("*").order("nombre"),
    client
      .from("account_invitations")
      .select("*")
      .is("claimed_by", null)
      .order("nombre"),
  ]);
  if (users.error) throw users.error;
  if (invitations.error) throw invitations.error;
  accountRows = users.data.sort(
    (a, b) =>
      Number(b.role === "pending" && !b.blocked) -
      Number(a.role === "pending" && !a.blocked),
  );
  invitationRows = invitations.data;
  document.getElementById("profile-users-list").innerHTML =
    accountRows
      .map((user) => {
        const self = user.id === getProfile().id;
        const status = user.blocked
          ? "Bloqueado"
          : user.role === "pending"
            ? "Pendiente de aprobación"
            : roleLabel(user.role);
        return (
          '<div class="account-row d-flex justify-content-between border-bottom py-2"><div class="account-identity"><strong>' +
          escapeHtml(user.nombre || user.email) +
          "</strong><br><small>" +
          escapeHtml(user.email) +
          " · " +
          escapeHtml(status) +
          '</small></div><div class="account-actions">' +
          (user.role === "pending" && !user.blocked
            ? '<button class="btn btn-sm btn-success" data-account="' +
              user.id +
              '" data-action="approve">Aprobar</button>'
            : "") +
          '<button class="btn btn-sm btn-outline-secondary" data-account="' +
          user.id +
          '" data-action="edit">Editar</button>' +
          (!self
            ? '<button class="btn btn-sm btn-outline-' +
              (user.blocked ? "success" : "danger") +
              '" data-account="' +
              user.id +
              '" data-action="block">' +
              (user.blocked ? "Desbloquear" : "Bloquear") +
              "</button>"
            : "") +
          "</div></div>"
        );
      })
      .join("") || "<p>No hay cuentas.</p>";
  document.querySelectorAll("[data-account]").forEach(
    (button) =>
      (button.onclick = async () => {
        const user = accountRows.find(
          (row) => row.id === button.dataset.account,
        );
        if (button.dataset.action === "edit") {
          editAccount(user);
          return;
        }
        button.disabled = true;
        try {
          await updateAccess(
            user.id,
            button.dataset.action === "approve"
              ? { role: "leader", blocked: false }
              : { blocked: !user.blocked },
          );
          toast("Acceso actualizado");
        } catch (error) {
          showError(error);
        } finally {
          button.disabled = false;
        }
      }),
  );
  document.getElementById("profile-invitations-list").innerHTML =
    invitationRows
      .map(
        (inv, index) =>
          '<div class="account-row border-bottom py-2"><strong>' +
          escapeHtml(inv.nombre) +
          "</strong><br><small>" +
          escapeHtml(inv.email) +
          " · " +
          escapeHtml(roleLabel(inv.role)) +
          '</small><div class="d-flex gap-2 mt-1"><button class="btn btn-sm btn-outline-secondary" data-invite="' +
          index +
          '" data-action="edit">Editar</button><button class="btn btn-sm btn-outline-danger" data-invite="' +
          index +
          '" data-action="revoke">Revocar</button></div></div>',
      )
      .join("") ||
    '<p class="text-muted small">No hay preautorizaciones pendientes.</p>';
  document.querySelectorAll("[data-invite]").forEach(
    (button) =>
      (button.onclick = async () => {
        const invite = invitationRows[Number(button.dataset.invite)];
        if (button.dataset.action === "edit") {
          editAccount(invite, true);
          return;
        }
        button.disabled = true;
        try {
          const { error } = await client
            .from("account_invitations")
            .delete()
            .eq("email", invite.email)
            .is("claimed_by", null);
          if (error) throw error;
          await renderUsers();
          toast("Preautorización revocada");
        } catch (error) {
          showError(error);
        } finally {
          button.disabled = false;
        }
      }),
  );
}
async function saveUser() {
  if (!isAdmin()) return;
  const id = document.getElementById("profile-user-id").value;
  const nombre = document.getElementById("profile-user-nombre").value.trim();
  const email = document
    .getElementById("profile-user-email")
    .value.trim()
    .toLowerCase();
  const role = document.getElementById("profile-user-role").value;
  if (!nombre) throw new Error("El nombre es obligatorio");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    throw new Error("Ingresa un correo válido");
  const button = document.getElementById("profile-save-user");
  button.disabled = true;
  try {
    if (!id || id.startsWith("invite:")) {
      if (!["admin", "leader"].includes(role))
        throw new Error("Selecciona un rol con acceso");
      if (accountRows.some((user) => user.email.toLowerCase() === email))
        throw new Error(
          "Esta cuenta ya existe. Selecciónala en la lista para editarla o aprobarla.",
        );
      const { error } = await client
        .from("account_invitations")
        .upsert({ email, nombre, role })
        .select("email")
        .single();
      if (error) throw error;
      toast("Líder preautorizado. Puede registrarse con este correo.");
    } else {
      await updateAccess(id, {
        nombre,
        role,
        blocked: document.getElementById("profile-user-blocked").checked,
      });
      toast("Cuenta actualizada");
    }
    await renderUsers();
    editAccount(null);
  } finally {
    button.disabled = false;
  }
}
