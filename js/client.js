import { createClient, SupabaseAuthAdapter } from "@neondatabase/neon-js";
import { createAuthClient } from "@neondatabase/neon-js/auth";

export const client = createClient(__NEON_URL__, {
  auth: { adapter: SupabaseAuthAdapter() },
});
export const account = createAuthClient(__NEON_AUTH_URL__);
