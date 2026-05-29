const MODELS = ['gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-2.5-flash'];

function buildPrompt(developerName) {
  return `Check if the game development studio '${developerName}' has Russian founders, Russian offices, Russian origin, or is a Russian-founded entity now registered in another country (such as Cyprus, UAE, or Armenia) to bypass scrutiny. Reply with ONLY a valid JSON object: {"isRussianRelated": true, "explanation": "Brief reason"}. Use boolean true or false, not strings. No markdown.`;
}

function parseBoolean(value) {
  if (value === true || value === 'true') return true;
  if (value === false || value === 'false') return false;
  return Boolean(value);
}

function parseGeminiJson(text) {
  const trimmed = String(text || '').trim();
  const jsonMatch = trimmed.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('Gemini response did not contain JSON');
  }
  const parsed = JSON.parse(jsonMatch[0]);
  return {
    isRussianRelated: parseBoolean(parsed.isRussianRelated),
    explanation: String(parsed.explanation || '').trim(),
  };
}

async function vetDeveloperWithModel(developerName, apiKey, model, useJsonMode) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const generationConfig = { temperature: 0.1 };
  if (useJsonMode) {
    generationConfig.responseMimeType = 'application/json';
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: buildPrompt(developerName) }] }],
      generationConfig,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gemini ${model} (${res.status}): ${errText.slice(0, 150)}`);
  }

  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  return parseGeminiJson(text);
}

async function vetDeveloper(developerName, apiKey) {
  let lastError;
  for (const model of MODELS) {
    for (const useJsonMode of [true, false]) {
      try {
        return await vetDeveloperWithModel(developerName, apiKey, model, useJsonMode);
      } catch (err) {
        lastError = err;
        console.warn(`Gemini ${model} (json=${useJsonMode}) failed:`, err.message);
      }
    }
  }
  throw lastError || new Error('All Gemini models failed');
}

async function vetAllDevelopers(developers, apiKey) {
  if (!developers?.length) {
    return { ruDeveloperAlert: false, ruDeveloperExplanation: '' };
  }

  const unique = [...new Set(developers.filter(Boolean))];
  const flags = [];

  for (const name of unique) {
    try {
      const result = await vetDeveloper(name, apiKey);
      if (result.isRussianRelated) {
        flags.push(`${name}: ${result.explanation}`);
      }
    } catch (err) {
      console.error(`Vetting failed for ${name}:`, err.message);
    }
  }

  if (flags.length === 0) {
    return { ruDeveloperAlert: false, ruDeveloperExplanation: '' };
  }

  return {
    ruDeveloperAlert: true,
    ruDeveloperExplanation: flags.join(' | '),
  };
}

module.exports = { vetAllDevelopers };
