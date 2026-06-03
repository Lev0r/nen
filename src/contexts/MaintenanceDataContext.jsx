import React, { createContext, useContext, useMemo } from 'react';
import {
  useGfnCatalog,
  useMaintenanceAudit,
  useMaintenanceErrors,
  useSteamWishlistCandidates,
} from '../services/db';
import { formatRelativeTimeShort } from '../utils/formatDuration';

const MaintenanceDataContext = createContext(null);

export function useMaintenanceData() {
  const ctx = useContext(MaintenanceDataContext);
  if (!ctx) {
    throw new Error('useMaintenanceData must be used within MaintenanceDataProvider');
  }
  return ctx;
}

export function MaintenanceDataProvider({ children, appId = 'default_app' }) {
  const { catalog: gfnCatalog } = useGfnCatalog(appId);
  const { audit: maintenanceAudit } = useMaintenanceAudit(appId);
  const { errorsDoc: maintenanceErrorsDoc } = useMaintenanceErrors(appId);
  const { candidatesDoc: steamWishlistCandidatesDoc } = useSteamWishlistCandidates(appId);

  const gfnSteamAppIds = useMemo(() => {
    const ids = gfnCatalog?.steamAppIds;
    return new Set(Array.isArray(ids) ? ids.map(String) : []);
  }, [gfnCatalog?.steamAppIds]);

  const gfnSyncedAtLabel = useMemo(() => {
    const syncedAt = maintenanceAudit?.gfn?.syncedAt ?? gfnCatalog?.syncedAt;
    return formatRelativeTimeShort(syncedAt);
  }, [maintenanceAudit?.gfn?.syncedAt, gfnCatalog?.syncedAt]);

  const value = useMemo(
    () => ({
      gfnCatalog,
      gfnSteamAppIds,
      maintenanceAudit,
      maintenanceErrorsDoc,
      steamWishlistCandidatesDoc,
      gfnSyncedAtLabel,
    }),
    [
      gfnCatalog,
      gfnSteamAppIds,
      maintenanceAudit,
      maintenanceErrorsDoc,
      steamWishlistCandidatesDoc,
      gfnSyncedAtLabel,
    ]
  );

  return (
    <MaintenanceDataContext.Provider value={value}>
      {children}
    </MaintenanceDataContext.Provider>
  );
}
