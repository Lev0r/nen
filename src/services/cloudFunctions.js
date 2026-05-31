import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebase';

/** Match Cloud Functions `timeoutSeconds` for long-running sync callables. */
const SYNC_CALL_TIMEOUT_MS = 540_000;

const addGameFromSteamFn = httpsCallable(functions, 'addGameFromSteam');
const syncGfnCatalogFn = httpsCallable(functions, 'syncGfnCatalog', {
  timeout: SYNC_CALL_TIMEOUT_MS,
});
const syncSteamLibraryFn = httpsCallable(functions, 'syncSteamLibrary', {
  timeout: SYNC_CALL_TIMEOUT_MS,
});
const vetGameDevelopersFn = httpsCallable(functions, 'vetGameDevelopers');

export async function addGameFromSteam(steamInput, appId = 'default_app') {
  const result = await addGameFromSteamFn({ steamInput, appId });
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
