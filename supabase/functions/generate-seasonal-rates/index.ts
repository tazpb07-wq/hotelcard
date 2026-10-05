// Supabase Edge Functions run on Deno. Minimal ambient declaration so the
// project's DOM-based TypeScript config stops flagging the Deno global.
declare const Deno: {
  serve: (handler: (req: Request) => Response | Promise<Response>) => void;
  env: { get(key: string): string | undefined };
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const payload = JSON.parse(
      atob(parts[1].replace(/-/g, "+").replace(/_/g, "/"))
    );
    return payload;
  } catch {
    return null;
  }
}

interface GeneratedRate {
  nome: string;
  data_inicio: string;
  data_fim: string;
  tipo: "percentual";
  aumento: number;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function isValidDateString(value: unknown): value is string {
  if (typeof value !== "string" || !DATE_RE.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !isNaN(d.getTime()) && value === d.toISOString().slice(0, 10);
}

// Keeps only well-formed suggestions; never invents data the AI didn't return
function sanitizeRates(input: unknown): GeneratedRate[] {
  if (!input || typeof input !== "object") return [];
  const list = (input as { tarifas?: unknown }).tarifas;
  if (!Array.isArray(list)) return [];

  const seen = new Set<string>();
  const clean: GeneratedRate[] = [];

  for (const item of list) {
    if (!item || typeof item !== "object") continue;
    const r = item as Record<string, unknown>;

    const nome = typeof r.nome === "string" ? r.nome.trim().slice(0, 100) : "";
    const data_inicio = r.data_inicio;
    const data_fim = r.data_fim;
    const aumento = Number(r.aumento);

    if (!nome) continue;
    if (!isValidDateString(data_inicio) || !isValidDateString(data_fim)) continue;
    if ((data_fim as string) < (data_inicio as string)) continue;
    if (!isFinite(aumento) || aumento <= 0 || aumento > 200) continue;

    const key = `${nome}|${data_inicio}|${data_fim}`;
    if (seen.has(key)) continue;
    seen.add(key);

    clean.push({
      nome,
      data_inicio: data_inicio as string,
      data_fim: data_fim as string,
      tipo: "percentual",
      aumento: Math.round(aumento * 10) / 10,
    });
  }

  return clean;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const headers = { ...corsHeaders, "Content-Type": "application/json" };

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const openaiKey = Deno.env.get("OPENAI_API_KEY");

    // 1. Auth: JWT must belong to an authenticated user
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Token não fornecido" }), {
        status: 401,
        headers,
      });
    }

    const jwt = authHeader.replace("Bearer ", "");
    const payload = decodeJwtPayload(jwt);
    if (!payload || !payload.sub || payload.role !== "authenticated") {
      return new Response(JSON.stringify({ error: "Token inválido" }), {
        status: 401,
        headers,
      });
    }

    const exp = payload.exp as number;
    if (exp && exp < Math.floor(Date.now() / 1000)) {
      return new Response(JSON.stringify({ error: "Token expirado" }), {
        status: 401,
        headers,
      });
    }

    // 2. Admin role check
    const roleRes = await fetch(
      `${supabaseUrl}/rest/v1/user_roles?user_id=eq.${payload.sub}&role=eq.admin&select=role`,
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

    // 3. Body
    const body = await req.json();
    const property = body?.property as
      | { title?: string; city?: string; neighborhood?: string; type?: string }
      | undefined;
    const year = Number(body?.year);

    if (!property?.title) {
      return new Response(JSON.stringify({ error: "Imóvel não informado" }), {
        status: 400,
        headers,
      });
    }
    if (!Number.isInteger(year) || year < 2000 || year > 2100) {
      return new Response(JSON.stringify({ error: "Ano inválido" }), {
        status: 400,
        headers,
      });
    }

    console.log("[generate-seasonal-rates] Imóvel:", property.title, "| Ano:", year);

    const geminiKey = Deno.env.get("GEMINI_API_KEY");

    if (!openaiKey && !geminiKey) {
      return new Response(
        JSON.stringify({
          error:
            "Nenhuma chave de IA configurada no Supabase (defina GEMINI_API_KEY ou OPENAI_API_KEY com `supabase secrets set`)",
        }),
        { status: 500, headers }
      );
    }

    const location = [property.neighborhood, property.city]
      .filter(Boolean)
      .join(", ") || "Brasil";

    const systemPrompt = [
      "Você é um especialista em precificação de temporada para locação de flats e apartamentos no Brasil.",
      "Responda APENAS com JSON válido no formato exato:",
      '{"tarifas":[{"nome":"string","data_inicio":"YYYY-MM-DD","data_fim":"YYYY-MM-DD","tipo":"percentual","aumento":numero}]}',
      "Regras:",
      `- Gere os principais períodos de alta procura para hospedagem no ano de ${year} para a localidade informada.`,
      "- Inclua feriados nacionais com datas corretas DAQUELE ANO (Carnaval, Semana Santa/Sexta-feira Santa, Corpus Christi, Tiradentes, Dia do Trabalho, Independência, N.Sra. Aparecida, Finados, Proclamação da República, Natal, Réveillon), férias escolares de janeiro e julho e festas regionais relevantes da localidade.",
      "- datas em ISO (YYYY-MM-DD), data_fim >= data_inicio, dentro ou tangenciando o ano pedido.",
      "- aumento = porcentagem sobre a diária padrão: ~20 (alta procura), ~30 (muito alta), ~40 (excepcional). Valores intermediários são permitidos. Não repita o mesmo percentual em tudo.",
      "- Entre 6 e 12 períodos, sem sobreposições desnecessárias.",
      "- Não escreva nada fora do JSON.",
    ].join("\n");

    const userPrompt = [
      `Imóvel: ${property.title}`,
      property.type ? `Tipo: ${property.type === "flat" ? "Flat" : "Apartamento"}` : null,
      `Localização: ${location}`,
      `Ano: ${year}`,
      "Gere os períodos de alta temporada.",
    ]
      .filter(Boolean)
      .join("\n");

    let content: string | null = null;

    if (geminiKey) {
      // Google Gemini (free tier available)
      const model = Deno.env.get("GEMINI_MODEL") || "gemini-3.5-flash-lite";
      const aiRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(geminiKey)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: systemPrompt }] },
            contents: [{ role: "user", parts: [{ text: userPrompt }] }],
            generationConfig: {
              temperature: 0.4,
              responseMimeType: "application/json",
            },
          }),
        }
      );

      if (!aiRes.ok) {
        const errText = await aiRes.text();
        console.error("[generate-seasonal-rates] Erro Gemini:", aiRes.status, errText);
        return new Response(
          JSON.stringify({ error: `Erro na IA (${aiRes.status})` }),
          { status: 502, headers }
        );
      }

      const aiJson = await aiRes.json();
      console.log("[generate-seasonal-rates] Gemini respondeu:", aiRes.status);
      content = aiJson?.candidates?.[0]?.content?.parts?.[0]?.text ?? null;
    } else {
      // OpenAI
      const aiRes = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${openaiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: Deno.env.get("OPENAI_MODEL") || "gpt-4o-mini",
          temperature: 0.4,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
        }),
      });

      if (!aiRes.ok) {
        const errText = await aiRes.text();
        console.error("[generate-seasonal-rates] Erro OpenAI:", aiRes.status, errText);
        return new Response(
          JSON.stringify({ error: `Erro na IA (${aiRes.status})` }),
          { status: 502, headers }
        );
      }

      const aiJson = await aiRes.json();
      console.log("[generate-seasonal-rates] OpenAI respondeu:", aiRes.status);
      content = aiJson?.choices?.[0]?.message?.content ?? null;
    }

    if (typeof content !== "string" || !content.trim()) {
      return new Response(
        JSON.stringify({ error: "Resposta da IA vazia" }),
        { status: 502, headers }
      );
    }

    let parsed: unknown;
    try {
      // Strip markdown fences if the model wrapped the JSON anyway
      const cleaned = content.replace(/```(?:json)?/gi, "").trim();
      parsed = JSON.parse(cleaned);
    } catch {
      return new Response(
        JSON.stringify({ error: "Resposta da IA em formato inválido" }),
        { status: 502, headers }
      );
    }

    const tarifas = sanitizeRates(parsed);
    if (tarifas.length === 0) {
      return new Response(
        JSON.stringify({ error: "A IA não retornou tarifas válidas" }),
        { status: 502, headers }
      );
    }

    return new Response(JSON.stringify({ tarifas }), { status: 200, headers });
  } catch (err) {
    console.error("[generate-seasonal-rates] Erro inesperado:", err);
    return new Response(
      JSON.stringify({ error: "Erro interno do servidor" }),
      { status: 500, headers }
    );
  }
});
