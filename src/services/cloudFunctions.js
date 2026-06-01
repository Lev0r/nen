import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebase';

/** Match Cloud Functions `timeoutSeconds` for long-running sync callables. */
const SYNC_CALL_TIMEOUT_MS = 540_000;

/** Match Cloud Functions `timeoutSeconds` for Steam preview/persist callables. */
const STEAM_GAME_CALL_TIMEOUT_MS = 120_000;

const previewSteamGameFn = httpsCallable(functions, 'previewSteamGame', {
  timeout: STEAM_GAME_CALL_TIMEOUT_MS,
});
const addGameFromSteamFn = httpsCallable(functions, 'addGameFromSteam', {
  timeout: STEAM_GAME_CALL_TIMEOUT_MS,
});
const syncGfnCatalogFn = httpsCallable(functions, 'syncGfnCatalog', {
  timeout: SYNC_CALL_TIMEOUT_MS,
});
const syncSteamLibraryFn = httpsCallable(functions, 'syncSteamLibrary', {
  timeout: SYNC_CALL_TIMEOUT_MS,
});
const vetGameDevelopersFn = httpsCallable(functions, 'vetGameDevelopers');
const syncDevSourcesFn = httpsCallable(functions, 'syncDevSources', {
  timeout: SYNC_CALL_TIMEOUT_MS,
});
const revetAllGamesFn = httpsCallable(functions, 'revetAllGames', {
  timeout: SYNC_CALL_TIMEOUT_MS,
});

export async function previewSteamGame(steamInput, appId = 'default_app') {
  const result = await previewSteamGameFn({ steamInput, appId });
  return result.data;
}

export async function addGameFromSteam(
  steamInput,
  appId = 'default_app',
  { preloadedGame, skipScrape } = {}
) {
  const result = await addGameFromSteamFn({
    steamInput,
    appId,
    preloadedGame,
    skipScrape,
  });
  return result.data;
}

export async function syncGfnCatalog(appId = 'default_app') {
  const result = await syncGfnCatalogFn({ appId });
  return result.data;
}

export async function syncSteamLibrary(appId = 'default_app') {
  const result = await syncSteamLibraryFn({ appId });
  return result.data;
}

export async function runDevCheck(gameId, appId = 'default_app') {
  const result = await vetGameDevelopersFn({ gameId, appId });
  return result.data;
}

export async function syncDevSources(appId = 'default_app', options = {}) {
  const result = await syncDevSourcesFn({ appId, ...options });
  return result.data;
}

export async function revetAllGames(appId = 'default_app') {
  const result = await revetAllGamesFn({ appId });
  return result.data;
}
