const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const payload = parts[1];
    const decoded = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(decoded);
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const headers = { ...corsHeaders, "Content-Type": "application/json" };

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // 1. Extract and decode JWT to get user ID
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Token não fornecido" }),
        { status: 401, headers }
      );
    }

    const jwt = authHeader.replace("Bearer ", "");
    const payload = decodeJwtPayload(jwt);

    if (!payload || !payload.sub || payload.role !== "authenticated") {
      return new Response(
        JSON.stringify({ error: "Token inválido" }),
        { status: 401, headers }
      );
    }

    // Check token expiration
    const exp = payload.exp as number;
    if (exp && exp < Math.floor(Date.now() / 1000)) {
      return new Response(
        JSON.stringify({ error: "Token expirado" }),
        { status: 401, headers }
      );
    }

    const callerId = payload.sub as string;
    console.log("Caller from JWT:", callerId, payload.email);

    // 2. Verify caller exists using admin API (service role, no session needed)
    const verifyRes = await fetch(`${supabaseUrl}/auth/v1/admin/users/${callerId}`, {
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
      },
    });

    if (!verifyRes.ok) {
      const errText = await verifyRes.text();
      console.error("User verify failed:", verifyRes.status, errText);
      return new Response(
        JSON.stringify({ error: "Usuário não encontrado" }),
        { status: 401, headers }
      );
    }
    await verifyRes.json(); // consume body

    // 3. Check admin role
    const roleRes = await fetch(
      `${supabaseUrl}/rest/v1/user_roles?user_id=eq.${callerId}&role=eq.admin&select=role`,
      {
        headers: {
          apikey: serviceRoleKey,
          Authorization: `Bearer ${serviceRoleKey}`,
        },
      }
    );

    const roles = await roleRes.json();
    if (!Array.isArray(roles) || roles.length === 0) {
      return new Response(
        JSON.stringify({ error: "Sem permissão de administrador" }),
        { status: 403, headers }
      );
    }

    // 4. Parse body
    const { user_id, new_password } = await req.json();

    if (!user_id) {
      return new Response(
        JSON.stringify({ error: "ID do usuário não fornecido" }),
        { status: 400, headers }
      );
    }

    if (!new_password || new_password.length < 6) {
      return new Response(
        JSON.stringify({ error: "Senha deve ter no mínimo 6 caracteres" }),
        { status: 400, headers }
      );
    }

    // 5. Update password
    const updateRes = await fetch(
      `${supabaseUrl}/auth/v1/admin/users/${user_id}`,
      {
        method: "PUT",
        headers: {
          apikey: serviceRoleKey,
          Authorization: `Bearer ${serviceRoleKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ password: new_password }),
      }
    );

    if (!updateRes.ok) {
      const errBody = await updateRes.text();
      console.error("Password update failed:", updateRes.status, errBody);
      return new Response(
        JSON.stringify({ error: "Erro ao atualizar senha" }),
        { status: 400, headers }
      );
    }

    await updateRes.json(); // consume body
    console.log("Password updated for user:", user_id);

    return new Response(
      JSON.stringify({ success: true, message: "Senha alterada com sucesso" }),
      { status: 200, headers }
    );
  } catch (err) {
    console.error("Unexpected error:", err);
    return new Response(
      JSON.stringify({ error: "Erro interno do servidor" }),
      { status: 500, headers }
    );
  }
});
