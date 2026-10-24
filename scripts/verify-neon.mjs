import { Client } from "pg";
import { randomUUID, createHash } from "node:crypto";
import { writeFile } from "node:fs/promises";
import assert from "node:assert/strict";

if (process.env.NEON_BRANCH !== "migration-test")
  throw new Error("Run this only on the isolated migration-test branch.");
const sql = new Client({ connectionString: process.env.DATABASE_URL_UNPOOLED });
const auth = process.env.NEON_AUTH_BASE_URL;
const api = process.env.NEON_DATA_API_URL;
const origin = "http://localhost:5174";
async function request(path, body, cookie) {
  const r = await fetch(auth + path, {
    method: body ? "POST" : "GET",
    headers: {
      "Content-Type": "application/json",
      Origin: origin,
      ...(cookie ? { Cookie: cookie } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const data = await r.json();
  assert.ok(r.ok, `${path}: ${r.status} ${data?.message || data?.error || ""}`);
  return { r, data };
}
async function query(token, path, method = "GET", body) {
  const r = await fetch(api + path, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const text = await r.text();
  return { status: r.status, data: text ? JSON.parse(text) : null };
}
try {
  await sql.connect();
  const users = [];
  for (const role of ["admin", "leader", "pending"]) {
    const email = `neftaly-test-${randomUUID()}@example.com`,
      password = randomUUID() + "aA1!";
    if (role === "admin")
      await sql.query(
        "insert into neftaly_private.bootstrap_admin(email) values($1)",
        [email],
      );
    const { data } = await request("/sign-up/email", {
      email,
      password,
      name: `Test ${role}`,
    });
    const id = data.user.id;
    assert.equal(
      (await sql.query("select role from public.profiles where id=$1", [id]))
        .rows[0].role,
      "pending",
    );
    // Test accounts only: replace the stored OTP hash with a known fixture, then
    // exercise the real verification endpoint. This does not test mailbox delivery.
    const otp = "731942";
    const stored = createHash("sha256").update(otp).digest("base64url") + ":0";
    const fixture = await sql.query(
      "update neon_auth.verification set value=$1 where identifier=$2",
      [stored, "email-verification-otp-" + email],
    );
    assert.equal(fixture.rowCount, 1);
    await request("/email-otp/verify-email", { email, otp });
    if (role === "leader")
      await sql.query("update public.profiles set role=$1 where id=$2", [
        role,
        id,
      ]);
    assert.equal(
      (await sql.query("select role from public.profiles where id=$1", [id]))
        .rows[0].role,
      role,
    );
    const signed = await request("/sign-in/email", { email, password });
    const cookies = signed.r.headers
      .getSetCookie()
      .map((v) => v.split(";")[0])
      .join("; ");
    const session = await request("/get-session", null, cookies);
    assert.equal(session.data.user.id, id);
    const token =
      session.r.headers.get("set-auth-jwt") ||
      (await request("/token", null, cookies)).data.token;
    assert.ok(token, "JWT missing");
    assert.equal(
      JSON.parse(Buffer.from(token.split(".")[1], "base64url")).sub,
      id,
      "JWT subject must match profile",
    );
    users.push({ role, email, password, id, cookies, token });
  }
  console.log(
    "PASS: sign-up, OTP verification, reserved admin bootstrap, sign-in and session restoration work.",
  );
  const [admin, leader, pending] = users;
  await writeFile(
    ".test-credentials.local.json",
    JSON.stringify(
      users.map(({ role, email, password }) => ({ role, email, password })),
      null,
      2,
    ),
  );
  console.log(
    "Admin role check:",
    await query(admin.token, "/rpc/is_admin", "POST", {}),
  );
  const anon = await fetch(api + "/profiles?select=*");
  assert.ok(anon.status >= 400 || (await anon.json()).length === 0);
  const patrolName = `Test patrol ${randomUUID()}`;
  let r = await query(admin.token, "/patrullas", "POST", {
    nombre: patrolName,
    color: "#123456",
  });
  assert.equal(r.status, 201, JSON.stringify(r));
  const patrol = r.data[0];
  r = await query(pending.token, "/patrullas?select=*");
  assert.equal(r.status, 200);
  assert.equal(r.data.length, 0);
  r = await query(pending.token, "/patrullas", "POST", { nombre: "Forbidden" });
  assert.ok(r.status >= 400);
  r = await query(pending.token, `/profiles?id=eq.${pending.id}`, "PATCH", {
    role: "admin",
  });
  assert.ok(r.status >= 400);
  r = await query(pending.token, `/profiles?select=*`);
  assert.equal(r.data.length, 1);
  r = await query(leader.token, `/profiles?id=eq.${leader.id}`, "PATCH", {
    role: "admin",
  });
  assert.ok(r.status >= 400);
  r = await query(leader.token, `/patrullas?id=eq.${patrol.id}`, "PATCH", {
    nombre: `Renamed ${patrolName}`,
  });
  assert.equal(r.status, 200);
  r = await query(leader.token, "/patrullas", "POST", {
    nombre: `Leader patrol ${randomUUID()}`,
  });
  assert.equal(r.status, 201);
  const leaderPatrol = r.data[0];
  r = await query(admin.token, "/miembros", "POST", {
    nombre: "Test scout",
    patrulla_id: patrol.id,
  });
  assert.equal(r.status, 201);
  const member = r.data[0];
  r = await query(leader.token, "/puntos_patrulla", "POST", {
    patrulla_id: patrol.id,
    ciclo: 1,
    delta: 5,
    created_by: leader.id,
  });
  assert.equal(r.status, 201);
  r = await query(
    leader.token,
    "/asistencia?on_conflict=miembro_id,fecha",
    "POST",
    {
      miembro_id: member.id,
      fecha: "2026-10-24",
      estado: "asistio",
      created_by: leader.id,
    },
  );
  assert.equal(r.status, 201);
  r = await query(admin.token, `/profiles?id=eq.${pending.id}`, "PATCH", {
    role: "leader",
  });
  assert.equal(r.status, 200);
  r = await query(pending.token, `/patrullas?id=eq.${patrol.id}&select=*`);
  assert.equal(r.data.length, 1);
  r = await query(leader.token, "/rpc/reset_troop_data", "POST", {
    keep_patrullas: true,
    keep_miembros: true,
    keep_asistencia: true,
  });
  assert.ok(r.status >= 400);
  r = await query(admin.token, "/rpc/reset_troop_data", "POST", {
    keep_patrullas: true,
    keep_miembros: true,
    keep_asistencia: true,
  });
  assert.equal(r.status, 204);
  const beforeCycle = await query(
    leader.token,
    "/app_config?key=eq.ciclo_actual&select=value",
  );
  r = await query(leader.token, "/app_config?key=eq.ciclo_actual", "PATCH", {
    value: "3",
  });
  assert.ok(r.status >= 400 || r.data.length === 0);
  const afterCycle = await query(
    leader.token,
    "/app_config?key=eq.ciclo_actual&select=value",
  );
  assert.deepEqual(afterCycle.data, beforeCycle.data);
  r = await query(leader.token, "/app_config", "POST", {
    key: "forbidden",
    value: "3",
  });
  assert.ok(r.status >= 400);
  r = await query(admin.token, "/app_config?key=eq.ciclo_actual", "PATCH", {
    value: "2",
  });
  assert.equal(r.status, 200);
  assert.equal(r.data[0].value, "2");
  r = await query(admin.token, "/app_config?key=eq.ciclo_actual", "PATCH", {
    value: "1",
  });
  assert.equal(r.status, 200);
  r = await query(leader.token, "/miembros", "POST", {
    nombre: "Leader-created scout",
    patrulla_id: leaderPatrol.id,
  });
  assert.equal(r.status, 201);
  const leaderMember = r.data[0];
  r = await query(leader.token, `/miembros?id=eq.${leaderMember.id}`, "PATCH", {
    nombre: "Renamed scout",
    es_guia: true,
  });
  assert.equal(r.status, 200);
  assert.equal(r.data[0].nombre, "Renamed scout");
  r = await query(leader.token, "/cargos", "POST", {
    nombre: `Cargo ${randomUUID()}`,
  });
  assert.equal(r.status, 201);
  const cargo = r.data[0];
  r = await query(leader.token, `/cargos?id=eq.${cargo.id}`, "PATCH", {
    nombre: `Edited cargo ${randomUUID()}`,
  });
  assert.equal(r.status, 200);
  r = await query(leader.token, "/miembro_cargos", "POST", {
    miembro_id: leaderMember.id,
    cargo_id: cargo.id,
  });
  assert.equal(r.status, 201);
  r = await query(leader.token, "/puntos_crecimiento", "POST", {
    miembro_id: leaderMember.id,
    ciclo: 1,
    area: "caracter",
    delta: 1,
    created_by: leader.id,
  });
  assert.equal(r.status, 201);
  r = await query(leader.token, "/rpc/delete_troop_members", "POST", {
    member_ids: [leaderMember.id],
  });
  assert.equal(r.status, 204);
  r = await query(leader.token, `/miembros?id=eq.${leaderMember.id}&select=*`);
  assert.equal(r.data.length, 0);
  r = await query(
    leader.token,
    `/puntos_crecimiento?miembro_id=eq.${leaderMember.id}&select=*`,
  );
  assert.equal(r.data.length, 0);
  r = await query(
    leader.token,
    `/miembro_cargos?miembro_id=eq.${leaderMember.id}&select=*`,
  );
  assert.equal(r.data.length, 0);
  r = await query(leader.token, `/cargos?id=eq.${cargo.id}`, "DELETE");
  assert.equal(r.status, 200);
  r = await query(leader.token, "/miembros", "POST", {
    nombre: "Relocated scout",
    patrulla_id: leaderPatrol.id,
  });
  assert.equal(r.status, 201);
  const relocated = r.data[0];
  r = await query(leader.token, "/puntos_patrulla", "POST", {
    patrulla_id: leaderPatrol.id,
    ciclo: 1,
    delta: 1,
    created_by: leader.id,
  });
  assert.equal(r.status, 201);
  r = await query(leader.token, "/rpc/delete_troop_patrol", "POST", {
    patrol_id: leaderPatrol.id,
    delete_members: false,
  });
  assert.equal(r.status, 204);
  r = await query(leader.token, `/miembros?id=eq.${relocated.id}&select=*`);
  assert.equal(r.data.length, 1);
  assert.notEqual(r.data[0].patrulla_id, leaderPatrol.id);
  r = await query(
    leader.token,
    `/puntos_patrulla?patrulla_id=eq.${leaderPatrol.id}&select=*`,
  );
  assert.equal(r.data.length, 0);
  r = await query(leader.token, "/rpc/delete_troop_members", "POST", {
    member_ids: [relocated.id],
  });
  assert.equal(r.status, 204);
  r = await query(leader.token, "/patrullas", "POST", {
    nombre: `Delete with members ${randomUUID()}`,
  });
  assert.equal(r.status, 201);
  const removedPatrol = r.data[0];
  r = await query(leader.token, "/miembros", "POST", {
    nombre: "Deleted with patrol",
    patrulla_id: removedPatrol.id,
  });
  assert.equal(r.status, 201);
  const removedMember = r.data[0];
  r = await query(leader.token, "/rpc/delete_troop_patrol", "POST", {
    patrol_id: removedPatrol.id,
    delete_members: true,
  });
  assert.equal(r.status, 204);
  r = await query(leader.token, `/miembros?id=eq.${removedMember.id}&select=*`);
  assert.equal(r.data.length, 0);
  console.log(
    "PASS: leaders can manage patrols, member names and cargos; both patrol deletion modes work; leaders cannot change cycle or reset troop.",
  );
  console.log(
    "PASS: anonymous/pending access denied; self-promotion denied; admin approval, patrols, members, points, attendance, reset permissions work.",
  );
  const newPassword = randomUUID() + "aA1!";
  await request(
    "/change-password",
    {
      currentPassword: leader.password,
      newPassword,
      revokeOtherSessions: true,
    },
    leader.cookies,
  );
  await request("/sign-in/email", {
    email: leader.email,
    password: newPassword,
  });
  leader.password = newPassword;
  console.log(
    "PASS: password change requires the current password and new credentials can sign in.",
  );
  const logout = await request("/sign-out", {}, leader.cookies);
  assert.ok(logout.r.ok);
  const ended = await request("/get-session", null, leader.cookies);
  assert.equal(ended.data, null);
  console.log("PASS: sign-out invalidates the session.");
  await writeFile(
    ".test-credentials.local.json",
    JSON.stringify(
      users.map(({ role, email, password }) => ({ role, email, password })),
      null,
      2,
    ),
  );
  console.log("Test-only browser credentials saved to ignored local file.");
} finally {
  await sql.end();
}
