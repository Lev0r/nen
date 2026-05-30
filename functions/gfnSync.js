/**
 * GeForce NOW catalog sync via NVIDIA GraphQL (POST https://games.geforce.com/graphql).
 *
 * vpcId (GFN_VPC_ID env, default NP-WAW-01):
 *   NP-WAW-01 — Warsaw, Eastern Europe. Full paginated catalog (~2100+ titles) and the
 *   best fit for EU/Ukraine GFN users in this region. Verified 2026-05-30.
 *   NP-FRK-03 — Frankfurt; commonly cited in community docs but currently returns a
 *   truncated catalog without GFN client auth. Override GFN_VPC_ID if your region differs.
 *
 * Config doc: artifacts/{appId}/public/data/config/default field gfnCatalog
 */
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

const GFN_GRAPHQL_URL = 'https://games.geforce.com/graphql';
const DEFAULT_VPC_ID = 'NP-WAW-01';
const DEFAULT_LANGUAGE = 'en_US';
const PAGE_SIZE = 100;
const DEFAULT_APP_ID = 'default_app';

const APPS_QUERY = `
query AppsPage($first: Int!, $after: String, $vpcId: String!, $language: String!) {
  apps(first: $first, after: $after, vpcId: $vpcId, language: $language) {
    numberReturned
    pageInfo {
      hasNextPage
      endCursor
    }
    items {
      storeIds {
        store
        id
      }
      geForceUrl
      variants {
        appStore
        storeUrl
        storeIds {
          store
          id
        }
        gfn {
          status
        }
      }
    }
  }
}`;

function getVpcId() {
  return process.env.GFN_VPC_ID || DEFAULT_VPC_ID;
}

function getAllowedEmails() {
  return [process.env.ALLOWED_EMAIL_0, process.env.ALLOWED_EMAIL_1].filter(Boolean);
}

function assertAllowedUser(auth) {
  if (!auth?.token?.email) {
    throw new HttpsError('unauthenticated', 'Sign in required.');
  }
  const allowed = getAllowedEmails();
  if (allowed.length >= 2 && !allowed.includes(auth.token.email)) {
    throw new HttpsError('permission-denied', 'Your email is not authorized.');
  }
}

function isSteamStore(store) {
  return typeof store === 'string' && store.toLowerCase() === 'steam';
}

function extractSteamAppIdFromUrl(url) {
  const match = String(url || '').match(/\/app\/(\d+)/);
  return match ? match[1] : null;
}

function extractSteamAppIdsFromItem(item) {
  const steamAppIds = new Set();
  const variants = item?.variants || [];
  const hasAvailableVariant = variants.some((variant) => variant?.gfn?.status === 'AVAILABLE');

  if (!hasAvailableVariant) {
    return steamAppIds;
  }

  for (const storeId of item.storeIds || []) {
    if (isSteamStore(storeId?.store) && storeId?.id) {
      steamAppIds.add(String(storeId.id));
    }
  }

  const itemSteamId = extractSteamAppIdFromUrl(item.geForceUrl);
  if (itemSteamId) {
    steamAppIds.add(itemSteamId);
  }

  for (const variant of variants) {
    if (variant?.gfn?.status !== 'AVAILABLE') {
      continue;
    }

    for (const storeId of variant.storeIds || []) {
      if (isSteamStore(storeId?.store) && storeId?.id) {
        steamAppIds.add(String(storeId.id));
      }
    }

    if (variant.appStore === 'STEAM') {
      const variantSteamId = extractSteamAppIdFromUrl(variant.storeUrl);
      if (variantSteamId) {
        steamAppIds.add(variantSteamId);
      }
    }
  }

  return steamAppIds;
}

async function postGraphQL(variables) {
  const response = await fetch(GFN_GRAPHQL_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/plain, */*',
      Origin: 'https://play.geforcenow.com',
      Referer: 'https://play.geforcenow.com/',
    },
    body: JSON.stringify({
      query: APPS_QUERY,
      variables,
    }),
  });

  let payload;
  try {
    payload = await response.json();
  } catch (err) {
    throw new Error(`GFN GraphQL returned invalid JSON (HTTP ${response.status}): ${err.message}`);
  }

  if (!response.ok) {
    const detail = payload?.errors?.map((error) => error.message).join('; ') || response.statusText;
    throw new Error(`GFN GraphQL HTTP ${response.status}: ${detail}`);
  }

  if (payload.errors?.length) {
    const detail = payload.errors.map((error) => error.message).join('; ');
    throw new Error(`GFN GraphQL errors: ${detail}`);
  }

  if (!payload.data?.apps) {
    throw new Error('GFN GraphQL response missing apps data.');
  }

  return payload.data.apps;
}

async function fetchGfnCatalogFromGraphQL(vpcId = getVpcId(), language = DEFAULT_LANGUAGE) {
  const steamAppIdSet = new Set();
  let after = null;
  let pages = 0;

  while (true) {
    const apps = await postGraphQL({
      first: PAGE_SIZE,
      after,
      vpcId,
      language,
    });

    pages += 1;

    for (const item of apps.items || []) {
      for (const steamAppId of extractSteamAppIdsFromItem(item)) {
        steamAppIdSet.add(steamAppId);
      }
    }

    if (!apps.pageInfo?.hasNextPage) {
      break;
    }

    after = apps.pageInfo.endCursor;
    if (!after) {
      throw new Error('GFN GraphQL pagination ended with empty endCursor.');
    }
  }

  const steamAppIds = [...steamAppIdSet].sort((a, b) => Number(a) - Number(b));

  return {
    steamAppIds,
    gameCount: steamAppIds.length,
    vpcId,
    pages,
  };
}

const CONFIG_DOC_ID = 'default';

function getConfigDocPath(appId = DEFAULT_APP_ID) {
  return `artifacts/${appId}/public/data/config/${CONFIG_DOC_ID}`;
}

async function writeGfnCatalog(appId, catalog) {
  const db = getFirestore();
  const configRef = db.doc(getConfigDocPath(appId));

  await configRef.set(
    {
      gfnCatalog: {
        steamAppIds: catalog.steamAppIds,
        syncedAt: FieldValue.serverTimestamp(),
        vpcId: catalog.vpcId,
        gameCount: catalog.gameCount,
      },
    },
    { merge: true }
  );
}

async function syncGfnCatalogToFirestore(appId = DEFAULT_APP_ID) {
  const vpcId = getVpcId();
  const catalog = await fetchGfnCatalogFromGraphQL(vpcId);
  await writeGfnCatalog(appId, catalog);
  return catalog;
}

async function syncGfnCatalogCallable(request) {
  assertAllowedUser(request.auth);

  const appId = request.data?.appId || DEFAULT_APP_ID;

  try {
    const catalog = await syncGfnCatalogToFirestore(appId);
    return {
      gameCount: catalog.gameCount,
      vpcId: catalog.vpcId,
      pages: catalog.pages,
    };
  } catch (err) {
    console.error('syncGfnCatalog failed:', err);
    throw new HttpsError('internal', err.message || 'Failed to sync GeForce NOW catalog.');
  }
}

const syncGfnCatalog = onCall(
  {
    region: 'europe-west1',
    timeoutSeconds: 540,
    memory: '512MiB',
    cors: true,
  },
  syncGfnCatalogCallable
);

const syncGfnCatalogScheduled = onSchedule(
  {
    schedule: 'every 168 hours',
    region: 'europe-west1',
    timeoutSeconds: 540,
    memory: '512MiB',
  },
  async () => {
    try {
      const catalog = await syncGfnCatalogToFirestore(DEFAULT_APP_ID);
      console.log(
        `syncGfnCatalogScheduled: synced ${catalog.gameCount} Steam titles via ${catalog.vpcId}`
      );
    } catch (err) {
      console.error('syncGfnCatalogScheduled failed:', err);
      throw err;
    }
  }
);

module.exports = {
  fetchGfnCatalogFromGraphQL,
  syncGfnCatalogToFirestore,
  getConfigDocPath,
  syncGfnCatalog,
  syncGfnCatalogScheduled,
};
