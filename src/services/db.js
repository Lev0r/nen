import { useState, useEffect } from 'react';
import { collection, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { calculateTotalHype } from '../utils/hypeScore';
import { buildStateMetaUpdates } from '../utils/libraryState';

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

  useEffect(() => {
    const gamesRef = collection(db, `artifacts/${appId}/public/data/games`);

    const unsubscribe = onSnapshot(
      gamesRef,
      (snapshot) => {
        const gamesData = [];
        snapshot.forEach((snap) => {
          const data = snap.data();
          const { total } = calculateTotalHype(data);
          data.totalHype = total;
          gamesData.push(data);
        });
        gamesData.sort((a, b) => b.totalHype - a.totalHype);
        setGames(gamesData);
        setLoading(false);
      },
      (error) => {
        console.error('Firestore subscription error:', error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [appId]);

  return { games, loading };
}
