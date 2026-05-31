const {
  devCacheKey,
  ensureMemoryCache,
  persistDeveloperResults,
  aggregateVettingFromCache,
  collectUncachedDevelopers,
} = require('./devBgCheck');
const {
  SOURCE_LABELS,
  SOURCE_IDS,
  buildDeveloperSourceContext,
  lookupDeterministicSources,
  allBundledSourcesNegative,
  fetchOpenCorporatesContext,
  ensureLiveDevSources,
} = require('./devSources');

const MODELS = ['gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-2.5-flash'];
const DEFAULT_BATCH_SIZE = 5;

const ALLOWED_SOURCES_TEXT = `You may ONLY use these sources (excerpts are provided below):
1. ${SOURCE_LABELS[SOURCE_IDS.NE_GRAI]}
2. ${SOURCE_LABELS[SOURCE_IDS.CURATOR_PLAYUA]}
3. ${SOURCE_LABELS[SOURCE_IDS.CURATOR_AVOID_RU]}
4. ${SOURCE_LABELS[SOURCE_IDS.DOU]}
5. ${SOURCE_LABELS[SOURCE_IDS.OPENCORPORATES]}

Rules:
- If a source excerpt shows the studio is listed as Russian-related, set isRussianRelated: true and cite that source in explanation.
- If NO provided excerpt supports Russian founders, offices, origin, or a Russian-founded entity registered abroad to bypass scrutiny, set isRussianRelated: false and explanation: "".
- Do NOT use general knowledge, news, Wikipedia, or any source not listed above.
- Do NOT guess. When evidence is absent or ambiguous, answer false.`;

function getBatchSize() {
  const n = Number(process.env.GEMINI_VET_BATCH_SIZE);
  if (Number.isInteger(n) && n >= 1 && n <= 10) return n;
  return DEFAULT_BATCH_SIZE;
}

function getOpenCorporatesApiKey() {
  return process.env.OPENCORPORATES_API_KEY || null;
}

function buildSinglePrompt(developerName, contextText) {
  return `${ALLOWED_SOURCES_TEXT}

Source excerpts for "${developerName}":
${contextText}

Reply with ONLY a valid JSON object: {"isRussianRelated": true, "explanation": "Brief reason citing source number, or empty string"}. Use boolean true or false, not strings. No markdown.`;
}

function buildBatchPrompt(contextBlocks) {
  const blocks = contextBlocks
    .map((block, i) => `--- Studio ${i + 1} ---\n${block.contextText}`)
    .join('\n\n');

  return `${ALLOWED_SOURCES_TEXT}

Source excerpts for each studio:
${blocks}

Reply with ONLY a JSON array with exactly ${contextBlocks.length} objects in the same order. Each object: {"name": "<studio name>", "isRussianRelated": true or false, "explanation": "Brief reason citing source number, or empty string"}. Use boolean true or false, not strings. No markdown.`;
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

async function buildContextBlocks(developerNames, openCorporatesApiKey, devAppIdMap = {}) {
  const blocks = [];
  for (const name of developerNames) {
    const ocContext = openCorporatesApiKey
      ? await fetchOpenCorporatesContext(name, openCorporatesApiKey)
      : { configured: false, excerpt: 'OpenCorporates API key not configured.' };
    blocks.push(
      buildDeveloperSourceContext(name, ocContext, {
        appIds: devAppIdMap[name] || [],
      })
    );
  }
  return blocks;
}

async function vetDeveloperWithModel(developerName, apiKey, model, useJsonMode, contextText) {
  const text = await callGemini(
    buildSinglePrompt(developerName, contextText),
    apiKey,
    model,
    useJsonMode
  );
  return parseGeminiJson(text);
}

async function vetDeveloperBatchWithModel(contextBlocks, apiKey, model, useJsonMode) {
  const names = contextBlocks.map((b) => b.developerName);
  const text = await callGemini(buildBatchPrompt(contextBlocks), apiKey, model, useJsonMode);
  return parseGeminiBatchJson(text, names);
}

async function vetDeveloper(developerName, apiKey, contextText) {
  let lastError;
  for (const model of MODELS) {
    for (const useJsonMode of [true, false]) {
      try {
        return await vetDeveloperWithModel(developerName, apiKey, model, useJsonMode, contextText);
      } catch (err) {
        lastError = err;
        console.warn(`Gemini ${model} (json=${useJsonMode}) failed:`, err.message);
      }
    }
  }
  throw lastError || new Error('All Gemini models failed');
}

async function vetDeveloperBatch(contextBlocks, apiKey) {
  let lastError;
  for (const model of MODELS) {
    for (const useJsonMode of [true, false]) {
      try {
        return await vetDeveloperBatchWithModel(contextBlocks, apiKey, model, useJsonMode);
      } catch (err) {
        lastError = err;
        console.warn(
          `Gemini batch ${model} (json=${useJsonMode}, n=${contextBlocks.length}) failed:`,
          err.message
        );
      }
    }
  }

  if (contextBlocks.length === 1) {
    const single = await vetDeveloper(
      contextBlocks[0].developerName,
      apiKey,
      contextBlocks[0].contextText
    );
    return [{ name: contextBlocks[0].developerName, ...single }];
  }

  const mid = Math.ceil(contextBlocks.length / 2);
  const left = await vetDeveloperBatch(contextBlocks.slice(0, mid), apiKey);
  const right = await vetDeveloperBatch(contextBlocks.slice(mid), apiKey);
  return [...left, ...right];
}

function chunkArray(items, size) {
  const chunks = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

function negativeBundledResult(name) {
  return {
    key: devCacheKey(name),
    name,
    isRussianRelated: false,
    explanation: '',
    source: 'bundled_sources',
  };
}

async function resolveUncachedDevelopers(uncachedNames, options) {
  const openCorporatesApiKey = options.openCorporatesApiKey ?? getOpenCorporatesApiKey();
  const devAppIdMap = options.devAppIdMap || {};
  const resolved = [];
  const needsGemini = [];

  for (const name of uncachedNames) {
    const appIds = devAppIdMap[name] || [];
    const hit = await lookupDeterministicSources(name, { openCorporatesApiKey, appIds });
    if (hit) {
      resolved.push({
        key: devCacheKey(name),
        name,
        isRussianRelated: hit.isRussianRelated,
        explanation: hit.explanation,
        source: hit.source,
      });
      continue;
    }

    if (!openCorporatesApiKey && allBundledSourcesNegative(name, { appIds })) {
      resolved.push(negativeBundledResult(name));
      continue;
    }

    needsGemini.push(name);
  }

  return { resolved, needsGemini, openCorporatesApiKey, devAppIdMap };
}

async function vetUncachedDevelopers(uncachedNames, apiKey, options) {
  const { db, appId, memoryCache, batchSize = getBatchSize(), dryRun = false } = options;
  const stats = {
    geminiBatches: 0,
    geminiDevelopers: 0,
    cached: 0,
    sourceHits: 0,
    bundledClears: 0,
  };

  if (!uncachedNames.length) {
    return stats;
  }

  const { resolved, needsGemini, openCorporatesApiKey, devAppIdMap } =
    await resolveUncachedDevelopers(uncachedNames, options);

  if (resolved.length) {
    if (dryRun) {
      stats.sourceHits += resolved.filter((r) => r.source && r.source !== 'bundled_sources').length;
      stats.bundledClears += resolved.filter((r) => r.source === 'bundled_sources').length;
      console.log(
        `  DRY-RUN source lookup: ${stats.sourceHits} flagged, ${stats.bundledClears} cleared without Gemini`
      );
    } else if (db && appId) {
      await persistDeveloperResults(db, appId, resolved, memoryCache);
      stats.cached += resolved.length;
      stats.sourceHits += resolved.filter((r) => r.source && r.source !== 'bundled_sources').length;
      stats.bundledClears += resolved.filter((r) => r.source === 'bundled_sources').length;
    } else {
      for (const entry of resolved) {
        memoryCache.set(entry.key, {
          name: entry.name,
          isRussianRelated: entry.isRussianRelated,
          explanation: entry.explanation,
          checkedAt: new Date(),
        });
      }
      stats.cached += resolved.length;
      stats.sourceHits += resolved.filter((r) => r.source && r.source !== 'bundled_sources').length;
      stats.bundledClears += resolved.filter((r) => r.source === 'bundled_sources').length;
    }
  }

  if (!needsGemini.length) {
    return stats;
  }

  if (!apiKey) {
    const fallbacks = needsGemini.map(negativeBundledResult);
    if (dryRun) {
      stats.bundledClears += fallbacks.length;
      console.log(
        `  DRY-RUN would clear ${fallbacks.length} developer(s) (no Gemini/OpenCorporates ambiguity path without API key)`
      );
    } else if (db && appId) {
      await persistDeveloperResults(db, appId, fallbacks, memoryCache);
      stats.cached += fallbacks.length;
      stats.bundledClears += fallbacks.length;
    } else {
      for (const entry of fallbacks) {
        memoryCache.set(entry.key, {
          name: entry.name,
          isRussianRelated: false,
          explanation: '',
          checkedAt: new Date(),
        });
      }
      stats.cached += fallbacks.length;
      stats.bundledClears += fallbacks.length;
    }
    return stats;
  }

  const batches = chunkArray(needsGemini, batchSize);

  for (const batch of batches) {
    if (dryRun) {
      stats.geminiBatches += 1;
      stats.geminiDevelopers += batch.length;
      console.log(
        `  DRY-RUN would vet ${batch.length} developer(s) via Gemini (OpenCorporates=${openCorporatesApiKey ? 'yes' : 'no'})`
      );
      continue;
    }

    try {
      const contextBlocks = await buildContextBlocks(batch, openCorporatesApiKey, devAppIdMap);
      const results = await vetDeveloperBatch(contextBlocks, apiKey);
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
          const ocContext = openCorporatesApiKey
            ? await fetchOpenCorporatesContext(name, openCorporatesApiKey)
            : { configured: false, excerpt: 'OpenCorporates API key not configured.' };
          const context = buildDeveloperSourceContext(name, ocContext, {
            appIds: devAppIdMap[name] || [],
          });
          const result = await vetDeveloper(name, apiKey, context.contextText);
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
 * Vet game developers with Firestore-backed cache, bundled sources, and batched Gemini.
 *
 * @param {string[]} developers
 * @param {string} apiKey
 * @param {{ db?, appId?, memoryCache?, batchSize?, dryRun?, openCorporatesApiKey?, devAppIdMap? }} [options]
 */
async function vetAllDevelopers(developers, apiKey, options = {}) {
  if (!developers?.length) {
    return {
      ruDeveloperAlert: false,
      ruDeveloperExplanation: '',
      stats: {
        cacheHits: 0,
        geminiBatches: 0,
        geminiDevelopers: 0,
        cached: 0,
        sourceHits: 0,
        bundledClears: 0,
      },
    };
  }

  const unique = [...new Set(developers.filter(Boolean).map((d) => String(d).trim()))];
  const memoryCache = options.memoryCache || new Map();
  const { db, appId, dryRun = false } = options;

  if (db && appId) {
    await ensureMemoryCache(memoryCache, db, appId);
    await ensureLiveDevSources(db, appId);
  }

  const uncached = collectUncachedDevelopers(unique, memoryCache);
  const cacheHits = unique.length - uncached.length;

  let vetStats = {
    cacheHits,
    geminiBatches: 0,
    geminiDevelopers: 0,
    cached: 0,
    sourceHits: 0,
    bundledClears: 0,
  };

  if (uncached.length) {
    const batchStats = await vetUncachedDevelopers(uncached, apiKey, {
      db,
      appId,
      memoryCache,
      batchSize: options.batchSize ?? getBatchSize(),
      dryRun,
      openCorporatesApiKey: options.openCorporatesApiKey,
      devAppIdMap: options.devAppIdMap,
    });
    vetStats = { cacheHits, ...batchStats };
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
