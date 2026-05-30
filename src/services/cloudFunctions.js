import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebase';

const addGameFromSteamFn = httpsCallable(functions, 'addGameFromSteam');
const syncGfnCatalogFn = httpsCallable(functions, 'syncGfnCatalog');

export async function addGameFromSteam(steamInput, appId = 'default_app') {
  const result = await addGameFromSteamFn({ steamInput, appId });
  return result.data;
}

export async function syncGfnCatalog(appId = 'default_app') {
  const result = await syncGfnCatalogFn({ appId });
  return result.data;
}
