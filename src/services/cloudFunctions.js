import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebase';

const addGameFromSteamFn = httpsCallable(functions, 'addGameFromSteam');
const syncGfnCatalogFn = httpsCallable(functions, 'syncGfnCatalog');
const syncSteamLibraryFn = httpsCallable(functions, 'syncSteamLibrary');

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
