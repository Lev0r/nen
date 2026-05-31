const {
  devCacheKey,
  ensureMemoryCache,
  persistDeveloperResults,
  aggregateVettingFromCache,
  collectUncachedDevelopers,
} = require('./devBgCheck');

const MODELS = ['gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-2.5-flash'];
const DEFAULT_BATCH_SIZE = 5;

function getBatchSize() {
  const n = Number(process.env.GEMINI_VET_BATCH_SIZE);
  if (Number.isInteger(n) && n >= 1 && n <= 10) return n;
  return DEFAULT_BATCH_SIZE;
}

function buildSinglePrompt(developerName) {
  return `Check if the game development studio '${developerName}' has Russian founders, Russian offices, Russian origin, or is a Russian-founded entity now registered in another country (such as Cyprus, UAE, or Armenia) to bypass scrutiny. Reply with ONLY a valid JSON object: {"isRussianRelated": true, "explanation": "Brief reason"}. Use boolean true or false, not strings. No markdown.`;
}

function buildBatchPrompt(developerNames) {
  const list = developerNames.map((name, i) => `${i + 1}. "${name}"`).join('\n');
  return `For each game development studio listed below, check if it has Russian founders, Russian offices, Russian origin, or is a Russian-founded entity now registered in another country (such as Cyprus, UAE, or Armenia) to bypass scrutiny.

Studios:
${list}

Reply with ONLY a JSON array with exactly ${developerNames.length} objects in the same order as the list. Each object: {"name": "<studio name>", "isRussianRelated": true or false, "explanation": "Brief reason or empty string"}. Use boolean true or false, not strings. No markdown.`;
}

function parseBoolean(value) {
  if (value === true || value === 'true') return true;
  if (value === false || value === 'false') return false;
  return Boolean(value);
}

function parseSingleResult(parsed) {
  return {
    isRussianRelated: parseBoolean(parsed.isRussianRelated),
    explanation: String(parsed.explanation || '').trim(),
  };
}

function parseGeminiJson(text) {
  const trimmed = String(text || '').trim();
  const jsonMatch = trimmed.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('Gemini response did not contain JSON');
  }
  const parsed = JSON.parse(jsonMatch[0]);
  return parseSingleResult(parsed);
}

function parseGeminiBatchJson(text, expectedNames) {
  const trimmed = String(text || '').trim();
  const arrayMatch = trimmed.match(/\[[\s\S]*\]/);
  if (!arrayMatch) {
    throw new Error('Gemini batch response did not contain JSON array');
  }
  const parsed = JSON.parse(arrayMatch[0]);
  if (!Array.isArray(parsed)) {
    throw new Error('Gemini batch response is not an array');
  }
  if (parsed.length !== expectedNames.length) {
    throw new Error(
      `Gemini batch returned ${parsed.length} results, expected ${expectedNames.length}`
    );
  }
  return parsed.map((item, index) => ({
    name: String(item?.name || '').trim() || expectedNames[index],
    ...parseSingleResult(item),
  }));
}

async function callGemini(prompt, apiKey, model, useJsonMode) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const generationConfig = { temperature: 0.1 };
  if (useJsonMode) {
    generationConfig.responseMimeType = 'application/json';
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gemini ${model} (${res.status}): ${errText.slice(0, 150)}`);
  }

  const data = await res.json();
  return data?.candidates?.[0]?.content?.parts?.[0]?.text;
}

async function vetDeveloperWithModel(developerName, apiKey, model, useJsonMode) {
  const text = await callGemini(buildSinglePrompt(developerName), apiKey, model, useJsonMode);
  return parseGeminiJson(text);
}

async function vetDeveloperBatchWithModel(developerNames, apiKey, model, useJsonMode) {
  const text = await callGemini(buildBatchPrompt(developerNames), apiKey, model, useJsonMode);
  return parseGeminiBatchJson(text, developerNames);
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

async function vetDeveloperBatch(developerNames, apiKey) {
  let lastError;
  for (const model of MODELS) {
    for (const useJsonMode of [true, false]) {
      try {
        return await vetDeveloperBatchWithModel(developerNames, apiKey, model, useJsonMode);
      } catch (err) {
        lastError = err;
        console.warn(
          `Gemini batch ${model} (json=${useJsonMode}, n=${developerNames.length}) failed:`,
          err.message
        );
      }
    }
  }

  if (developerNames.length === 1) {
    const single = await vetDeveloper(developerNames[0], apiKey);
    return [{ name: developerNames[0], ...single }];
  }

  const mid = Math.ceil(developerNames.length / 2);
  const left = await vetDeveloperBatch(developerNames.slice(0, mid), apiKey);
  const right = await vetDeveloperBatch(developerNames.slice(mid), apiKey);
  return [...left, ...right];
}

function chunkArray(items, size) {
  const chunks = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

async function vetUncachedDevelopers(uncachedNames, apiKey, options) {
  const { db, appId, memoryCache, batchSize = getBatchSize(), dryRun = false } = options;
  const stats = { geminiBatches: 0, geminiDevelopers: 0, cached: 0 };

  if (!uncachedNames.length) {
    return stats;
  }

  const batches = chunkArray(uncachedNames, batchSize);

  for (const batch of batches) {
    if (dryRun) {
      stats.geminiBatches += 1;
      stats.geminiDevelopers += batch.length;
      console.log(`  DRY-RUN would vet ${batch.length} developer(s) via Gemini batch`);
      continue;
    }

    try {
      const results = await vetDeveloperBatch(batch, apiKey);
      stats.geminiBatches += 1;
      stats.geminiDevelopers += batch.length;

      const toPersist = results.map((result) => ({
        key: devCacheKey(result.name),
        name: result.name,
        isRussianRelated: result.isRussianRelated,
        explanation: result.explanation,
      }));

      if (db && appId) {
        await persistDeveloperResults(db, appId, toPersist, memoryCache);
      } else {
        for (const entry of toPersist) {
          memoryCache.set(entry.key, {
            name: entry.name,
            isRussianRelated: entry.isRussianRelated,
            explanation: entry.explanation,
            checkedAt: new Date(),
          });
        }
      }

      stats.cached += toPersist.length;
    } catch (err) {
      console.error(`  Batch vetting failed (${batch.length} devs):`, err.message);
      for (const name of batch) {
        try {
          const result = await vetDeveloper(name, apiKey);
          const entry = {
            key: devCacheKey(name),
            name,
            isRussianRelated: result.isRussianRelated,
            explanation: result.explanation,
          };
          if (db && appId) {
            await persistDeveloperResults(db, appId, [entry], memoryCache);
          } else {
            memoryCache.set(entry.key, {
              ...entry,
              checkedAt: new Date(),
            });
          }
          stats.geminiDevelopers += 1;
          stats.cached += 1;
        } catch (singleErr) {
          console.error(`  Vetting failed for ${name}:`, singleErr.message);
        }
      }
    }
  }

  return stats;
}

/**
 * Vet game developers with Firestore-backed cache and batched Gemini calls.
 *
 * @param {string[]} developers
 * @param {string} apiKey
 * @param {{ db?, appId?, memoryCache?, batchSize?, dryRun? }} [options]
 */
async function vetAllDevelopers(developers, apiKey, options = {}) {
  if (!developers?.length) {
    return {
      ruDeveloperAlert: false,
      ruDeveloperExplanation: '',
      stats: { cacheHits: 0, geminiBatches: 0, geminiDevelopers: 0, cached: 0 },
    };
  }

  const unique = [...new Set(developers.filter(Boolean).map((d) => String(d).trim()))];
  const memoryCache = options.memoryCache || new Map();
  const { db, appId, dryRun = false } = options;

  if (db && appId) {
    await ensureMemoryCache(memoryCache, db, appId);
  }

  const uncached = collectUncachedDevelopers(unique, memoryCache);
  const cacheHits = unique.length - uncached.length;

  let vetStats = { cacheHits, geminiBatches: 0, geminiDevelopers: 0, cached: 0 };

  if (uncached.length && apiKey) {
    const batchStats = await vetUncachedDevelopers(uncached, apiKey, {
      db,
      appId,
      memoryCache,
      batchSize: options.batchSize ?? getBatchSize(),
      dryRun,
    });
    vetStats = { cacheHits, ...batchStats };
  } else if (uncached.length && !apiKey) {
    console.warn('GEMINI_API_KEY not set — skipping developer vetting for uncached developers');
  }

  const vetting = aggregateVettingFromCache(unique, memoryCache);
  return { ...vetting, stats: vetStats, memoryCache };
}

module.exports = {
  vetAllDevelopers,
  vetDeveloper,
  vetDeveloperBatch,
  getBatchSize,
};
