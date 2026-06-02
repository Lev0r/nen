/**
 * Firestore config document paths (schema v3).
 *
 * Collection: artifacts/{appId}/public/data/config/
 */
const DEFAULT_APP_ID = 'default_app';

const DEV_BG_CHECK_DOC_ID = 'dev-bg-check';
const GFN_CATALOG_DOC_ID = 'gfn-catalog';
const STEAM_LIBRARY_SYNC_DOC_ID = 'steam-library-sync';
const STEAM_OWNERSHIP_SYNC_DOC_ID = 'steam-ownership-sync';
const STEAM_WISHLIST_CANDIDATES_DOC_ID = 'steam-wishlist-candidates';
const THIRD_PARTY_HEALTH_DOC_ID = 'third-party-health';
const MAINTENANCE_ERRORS_DOC_ID = 'maintenance-errors';
const MAINTENANCE_AUDIT_DOC_ID = 'maintenance-audit';

function configCollectionPath(appId = DEFAULT_APP_ID) {
  return `artifacts/${appId}/public/data/config`;
}

function configDocPath(appId, docId) {
  return `${configCollectionPath(appId)}/${docId}`;
}

module.exports = {
  DEFAULT_APP_ID,
  DEV_BG_CHECK_DOC_ID,
  GFN_CATALOG_DOC_ID,
  STEAM_LIBRARY_SYNC_DOC_ID,
  STEAM_OWNERSHIP_SYNC_DOC_ID,
  STEAM_WISHLIST_CANDIDATES_DOC_ID,
  THIRD_PARTY_HEALTH_DOC_ID,
  MAINTENANCE_ERRORS_DOC_ID,
  MAINTENANCE_AUDIT_DOC_ID,
  configCollectionPath,
  configDocPath,
};
