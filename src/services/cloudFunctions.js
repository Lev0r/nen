import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebase';

const addGameFromSteamFn = httpsCallable(functions, 'addGameFromSteam');

export async function addGameFromSteam(steamInput, appId = 'default_app') {
  const result = await addGameFromSteamFn({ steamInput, appId });
  return result.data;
}
