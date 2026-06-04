import { useState, useEffect } from 'react';
import {
  collection,
  onSnapshot,
  doc,
  updateDoc,
} from 'firebase/firestore';
import { db } from '../firebase';
import { calculateTotalHype } from '../utils/hypeScore';
import { buildStateMetaUpdates } from '../utils/libraryState';

export const DEV_SOURCES_META_DOC_ID = 'dev-sources-meta';
export const GFN_CATALOG_DOC_ID = 'gfn-catalog';
export const MAINTENANCE_AUDIT_DOC_ID = 'maintenance-audit';
export const MAINTENANCE_ERRORS_DOC_ID = 'maintenance-errors';
export const STEAM_WISHLIST_CANDIDATES_DOC_ID = 'steam-wishlist-candidates';
export const STEAM_EVENTS_DOC_ID = 'steam-events';

function configDocRef(appId, docId) {
  return doc(db, `artifacts/${appId}/public/data/config`, docId);
}

function useConfigDoc(appId, docId, logLabel) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const ref = configDocRef(appId, docId);
    const unsubscribe = onSnapshot(
      ref,
      (snapshot) => {
        setData(snapshot.exists() ? snapshot.data() : null);
        setLoading(false);
      },
      (error) => {
        console.error(`${logLabel} subscription error:`, error);
        setLoading(false);
      }
    );
    return () => unsubscribe();
  }, [appId, docId, logLabel]);

  return { data, loading };
}

export function useGfnCatalog(appId = 'default_app') {
  const { data, loading } = useConfigDoc(appId, GFN_CATALOG_DOC_ID, 'GFN catalog');
  return { catalog: data, loading };
}

export function useMaintenanceAudit(appId = 'default_app') {
  const { data, loading } = useConfigDoc(appId, MAINTENANCE_AUDIT_DOC_ID, 'Maintenance audit');
  return { audit: data, loading };
}

export function useMaintenanceErrors(appId = 'default_app') {
  const { data, loading } = useConfigDoc(appId, MAINTENANCE_ERRORS_DOC_ID, 'Maintenance errors');
  return { errorsDoc: data, loading };
}

export function useSteamEvents(appId = 'default_app') {
  const { data, loading } = useConfigDoc(appId, STEAM_EVENTS_DOC_ID, 'Steam events');
  return { eventsDoc: data, loading };
}

export function useSteamWishlistCandidates(appId = 'default_app') {
  const { data, loading } = useConfigDoc(
    appId,
    STEAM_WISHLIST_CANDIDATES_DOC_ID,
    'Steam wishlist candidates'
  );
  return { candidatesDoc: data, loading };
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
  finishedRating,
  developmentStatus
) {
  const gameRef = doc(db, `artifacts/${appId}/public/data/games`, gameId);
  return updateDoc(
    gameRef,
    buildStateMetaUpdates(
      state,
      note,
      currentVersion,
      finishedRating,
      developmentStatus
    )
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
