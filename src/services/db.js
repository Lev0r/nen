import { useState, useEffect } from 'react';
import { collection, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { calculateTotalHype } from '../utils/hypeScore';
import { buildStateMetaUpdates } from '../utils/libraryState';

export function updateGame(appId, gameId, updates) {
  const gameRef = doc(db, `artifacts/${appId}/public/data/games`, gameId);
  return updateDoc(gameRef, updates);
}

export function setGameLifecycle(appId, gameId, state, note, currentVersion) {
  const gameRef = doc(db, `artifacts/${appId}/public/data/games`, gameId);
  return updateDoc(gameRef, buildStateMetaUpdates(state, note, currentVersion));
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
