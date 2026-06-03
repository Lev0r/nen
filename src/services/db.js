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

export function useGfnCatalog(appId = 'default_app') {
  const [catalog, setCatalog] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const ref = configDocRef(appId, GFN_CATALOG_DOC_ID);
    const unsubscribe = onSnapshot(
      ref,
      (snapshot) => {
        setCatalog(snapshot.exists() ? snapshot.data() : null);
        setLoading(false);
      },
      (error) => {
        console.error('GFN catalog subscription error:', error);
        setLoading(false);
      }
    );
    return () => unsubscribe();
  }, [appId]);

  return { catalog, loading };
}

export function useMaintenanceAudit(appId = 'default_app') {
  const [audit, setAudit] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const ref = configDocRef(appId, MAINTENANCE_AUDIT_DOC_ID);
    const unsubscribe = onSnapshot(
      ref,
      (snapshot) => {
        setAudit(snapshot.exists() ? snapshot.data() : null);
        setLoading(false);
      },
      (error) => {
        console.error('Maintenance audit subscription error:', error);
        setLoading(false);
      }
    );
    return () => unsubscribe();
  }, [appId]);

  return { audit, loading };
}

export function useMaintenanceErrors(appId = 'default_app') {
  const [errorsDoc, setErrorsDoc] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const ref = configDocRef(appId, MAINTENANCE_ERRORS_DOC_ID);
    const unsubscribe = onSnapshot(
      ref,
      (snapshot) => {
        setErrorsDoc(snapshot.exists() ? snapshot.data() : null);
        setLoading(false);
      },
      (error) => {
        console.error('Maintenance errors subscription error:', error);
        setLoading(false);
      }
    );
    return () => unsubscribe();
  }, [appId]);

  return { errorsDoc, loading };
}

export function useSteamEvents(appId = 'default_app') {
  const [eventsDoc, setEventsDoc] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const ref = configDocRef(appId, STEAM_EVENTS_DOC_ID);
    const unsubscribe = onSnapshot(
      ref,
      (snapshot) => {
        setEventsDoc(snapshot.exists() ? snapshot.data() : null);
        setLoading(false);
      },
      (error) => {
        console.error('Steam events subscription error:', error);
        setLoading(false);
      }
    );
    return () => unsubscribe();
  }, [appId]);

  return { eventsDoc, loading };
}

export function useSteamWishlistCandidates(appId = 'default_app') {
  const [candidatesDoc, setCandidatesDoc] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const ref = configDocRef(appId, STEAM_WISHLIST_CANDIDATES_DOC_ID);
    const unsubscribe = onSnapshot(
      ref,
      (snapshot) => {
        setCandidatesDoc(snapshot.exists() ? snapshot.data() : null);
        setLoading(false);
      },
      (error) => {
        console.error('Steam wishlist candidates subscription error:', error);
        setLoading(false);
      }
    );
    return () => unsubscribe();
  }, [appId]);

  return { candidatesDoc, loading };
}

/** @deprecated Prefer useMaintenanceAudit().audit.devSources */
export function useDevSourcesMeta(appId = 'default_app') {
  const [meta, setMeta] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const metaRef = configDocRef(appId, DEV_SOURCES_META_DOC_ID);
    const unsubscribe = onSnapshot(
      metaRef,
      (snapshot) => {
        setMeta(snapshot.exists() ? snapshot.data() : null);
        setLoading(false);
      },
      (error) => {
        console.error('Dev sources meta subscription error:', error);
        setLoading(false);
      }
    );
    return () => unsubscribe();
  }, [appId]);

  return { meta, loading };
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
