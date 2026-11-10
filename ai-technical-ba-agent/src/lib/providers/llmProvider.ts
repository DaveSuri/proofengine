import type {
  AgentStageId,
  LLMProviderType,
  QualitySpeedMode,
} from "../types";

export interface LLMCallOptions {
  provider: LLMProviderType;
  qualityMode: QualitySpeedMode;
  stageId: AgentStageId;
  systemPrompt: string;
  userPrompt: string;
  apiKey?: string;
  modelOverride?: string;
  ollamaUrl?: string;
}

export function selectModelForStage(
  provider: LLMProviderType,
  qualityMode: QualitySpeedMode,
  stageId: AgentStageId,
  modelOverride?: string
): string {
  if (modelOverride && modelOverride.trim().length > 0) {
    return modelOverride.trim();
  }

  const isSynthesisStage =
    stageId === "prd_generator" ||
    stageId === "technical_analyst" ||
    stageId === "api_data_analyst";

  const useStrongModel =
    qualityMode === "high_quality" ||
    (qualityMode === "balanced" && isSynthesisStage);

  switch (provider) {
    case "openai":
      return useStrongModel ? "gpt-4o" : "gpt-4o-mini";
    case "anthropic":
      return useStrongModel
        ? "claude-3-7-sonnet-latest"
        : "claude-3-5-haiku-latest";
    case "gemini":
      return useStrongModel ? "gemini-2.5-pro" : "gemini-2.5-flash";
    case "openrouter":
      return useStrongModel
        ? "anthropic/claude-3.5-sonnet"
        : "openai/gpt-4o-mini";
    case "ollama":
      return "llama3.1:8b";
    case "demo":
    default:
      return "Deterministic Multi-Agent Engine v2.4";
  }
}

export function resolveProviderApiKey(
  provider: LLMProviderType,
  explicitKey?: string
): string | undefined {
  if (explicitKey && explicitKey.trim().length > 0) {
    return explicitKey.trim();
  }
  switch (provider) {
    case "openai":
      return process.env.OPENAI_API_KEY;
    case "anthropic":
      return process.env.ANTHROPIC_API_KEY;
    case "gemini":
      return process.env.GEMINI_API_KEY;
    case "openrouter":
      return process.env.OPENROUTER_API_KEY;
    case "ollama":
      return "ollama-local";
    case "demo":
      return "demo-mode";
  }
}

export function extractAndValidateJson<T>(rawText: string, requiredKeys: string[]): T {
  let cleaned = rawText.trim();

  // Strip markdown code fences if present
  const fenceMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenceMatch && fenceMatch[1]) {
    cleaned = fenceMatch[1].trim();
  } else {
    const firstBrace = cleaned.indexOf("{");
    const lastBrace = cleaned.lastIndexOf("}");
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      cleaned = cleaned.slice(firstBrace, lastBrace + 1);
    }
  }

  const parsed = JSON.parse(cleaned) as Record<string, unknown>;
  if (!parsed || typeof parsed !== "object") {
    throw new Error("Parsed LLM output is not a JSON object.");
  }

  for (const key of requiredKeys) {
    if (!(key in parsed)) {
      throw new Error(`Missing required schema key "${key}" in agent JSON output.`);
    }
  }

  return parsed as T;
}

async function rawProviderCompletion(
  options: LLMCallOptions,
  model: string,
  apiKey: string
): Promise<string> {
  const { provider, systemPrompt, userPrompt, ollamaUrl } = options;

  if (provider === "openai" || provider === "openrouter") {
    const endpoint =
      provider === "openai"
        ? "https://api.openai.com/v1/chat/completions"
        : "https://openrouter.ai/api/v1/chat/completions";

    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!res.ok) {
      const errBody = await res.text();
      throw new Error(`${provider.toUpperCase()} API HTTP ${res.status}: ${errBody.slice(0, 300)}`);
    }
    const data = await res.json();
    return data.choices?.[0]?.message?.content || "";
  }

  if (provider === "anthropic") {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model,
        max_tokens: 4096,
        temperature: 0.2,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
      }),
    });

    if (!res.ok) {
      const errBody = await res.text();
      throw new Error(`Anthropic API HTTP ${res.status}: ${errBody.slice(0, 300)}`);
    }
    const data = await res.json();
    return data.content?.[0]?.text || "";
  }

  if (provider === "gemini") {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
      model
    )}:generateContent?key=${encodeURIComponent(apiKey)}`;

    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: "user", parts: [{ text: userPrompt }] }],
        generationConfig: {
          temperature: 0.2,
          responseMimeType: "application/json",
        },
      }),
    });

    if (!res.ok) {
      const errBody = await res.text();
      throw new Error(`Gemini API HTTP ${res.status}: ${errBody.slice(0, 300)}`);
    }
    const data = await res.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
  }

  if (provider === "ollama") {
    const baseUrl = (ollamaUrl || process.env.OLLAMA_BASE_URL || "http://localhost:11434").replace(
      /\/$/,
      ""
    );
    const res = await fetch(`${baseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        stream: false,
        format: "json",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!res.ok) {
      const errBody = await res.text();
      throw new Error(`Ollama API HTTP ${res.status}: ${errBody.slice(0, 300)}`);
    }
    const data = await res.json();
    return data.message?.content || "";
  }

  throw new Error(`Unsupported LLM provider: ${provider}`);
}

/**
 * Executes an agent LLM call with structured JSON schema validation and
 * automatic 1-step JSON repair retry if initial output fails schema validation.
 */
export async function executeStructuredAgentCall<T>(
  options: LLMCallOptions,
  requiredKeys: string[]
): Promise<{ output: T; modelUsed: string }> {
  const apiKey = resolveProviderApiKey(options.provider, options.apiKey);
  if (!apiKey) {
    throw new Error(
      `No API key found for provider "${options.provider}". Configure an API key in Settings / environment variables, or switch to Demo Mode.`
    );
  }

  const model = selectModelForStage(
    options.provider,
    options.qualityMode,
    options.stageId,
    options.modelOverride
  );

  const rawOutput = await rawProviderCompletion(options, model, apiKey);

  try {
    const validated = extractAndValidateJson<T>(rawOutput, requiredKeys);
    return { output: validated, modelUsed: model };
  } catch (initialParseError) {
    // Retry once with an explicit JSON repair prompt per Section #27
    const repairUserPrompt = `Your previous response failed JSON schema validation with error: ${
      initialParseError instanceof Error ? initialParseError.message : "Invalid JSON"
    }

Required top-level JSON keys: ${JSON.stringify(requiredKeys)}

Previous invalid output:
${rawOutput.slice(0, 3500)}

Return ONLY a valid, syntactically well-formed JSON object containing all required keys.`;

    const repairedRaw = await rawProviderCompletion(
      {
        ...options,
        userPrompt: repairUserPrompt,
      },
      model,
      apiKey
    );

    const validatedRepair = extractAndValidateJson<T>(repairedRaw, requiredKeys);
    return { output: validatedRepair, modelUsed: model };
  }
}
