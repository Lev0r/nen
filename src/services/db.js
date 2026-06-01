import { useState, useEffect } from 'react';
import {
  collection,
  onSnapshot,
  doc,
  updateDoc,
  writeBatch,
  deleteField,
} from 'firebase/firestore';
import { db } from '../firebase';
import { calculateTotalHype } from '../utils/hypeScore';
import { buildStateMetaUpdates } from '../utils/libraryState';
import { buildClearInfoUpdates, gameHasInfoStatus } from '../utils/gameAccessors';

/** Singleton config doc under the config subcollection (path must have even segment count). */
export const CONFIG_DOC_ID = 'default';

export function useAppConfig(appId = 'default_app') {
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const configRef = doc(db, `artifacts/${appId}/public/data/config`, CONFIG_DOC_ID);

    const unsubscribe = onSnapshot(
      configRef,
      (snapshot) => {
        setConfig(snapshot.exists() ? snapshot.data() : null);
        setLoading(false);
      },
      (error) => {
        console.error('Config subscription error:', error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [appId]);

  return { config, loading };
}

export function updateGame(appId, gameId, updates) {
  const gameRef = doc(db, `artifacts/${appId}/public/data/games`, gameId);
  return updateDoc(gameRef, updates);
}

export async function clearInfoErrorsFromGames(appId, games) {
  const targets = games.filter(gameHasInfoStatus);
  if (targets.length === 0) return 0;

  const batchSize = 400;
  let cleared = 0;

  for (let offset = 0; offset < targets.length; offset += batchSize) {
    const chunk = targets.slice(offset, offset + batchSize);
    const batch = writeBatch(db);

    for (const game of chunk) {
      const rawUpdates = buildClearInfoUpdates(game);
      const updates = {};
      for (const [path, value] of Object.entries(rawUpdates)) {
        updates[path] = deleteField();
      }
      if (Object.keys(updates).length === 0) continue;
      const gameRef = doc(db, `artifacts/${appId}/public/data/games`, game.id);
      batch.update(gameRef, updates);
      cleared += 1;
    }

    await batch.commit();
  }

  return cleared;
}

export function setGameLifecycle(
  appId,
  gameId,
  state,
  note,
  currentVersion,
  finishedRating
) {
  const gameRef = doc(db, `artifacts/${appId}/public/data/games`, gameId);
  return updateDoc(
    gameRef,
    buildStateMetaUpdates(state, note, currentVersion, finishedRating)
  );
}

export function useGames(appId = 'default_app') {
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [subscriptionError, setSubscriptionError] = useState(null);
  const [loadErrors, setLoadErrors] = useState(0);

  useEffect(() => {
    const gamesRef = collection(db, `artifacts/${appId}/public/data/games`);

    const unsubscribe = onSnapshot(
      gamesRef,
      (snapshot) => {
        const gamesData = [];
        let skipped = 0;

        snapshot.forEach((snap) => {
          try {
            const data = { ...snap.data(), id: snap.id };
            const { total } = calculateTotalHype(data);
            data.totalHype = total;
            gamesData.push(data);
          } catch (err) {
            skipped += 1;
            console.error(`Failed to load game ${snap.id}:`, err);
          }
        });

        gamesData.sort((a, b) => b.totalHype - a.totalHype);
        setGames(gamesData);
        setLoadErrors(skipped);
        setSubscriptionError(null);
        setLoading(false);
      },
      (error) => {
        console.error('Firestore subscription error:', error);
        setSubscriptionError(error.message || 'Failed to load games from Firestore.');
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [appId]);

  return { games, loading, subscriptionError, loadErrors };
}
