import { serverTimestamp } from 'firebase/firestore';

export const LIBRARY_STATES = [
  'active',
  'replayable',
  'waiting_for_updates',
  'finished',
  'banned',
];

const STATE_LABELS = {
  active: 'Active',
  replayable: 'Replayable',
  waiting_for_updates: 'Waiting for updates',
  finished: 'Finished',
  banned: 'Banned',
};

const STATE_COLORS = {
  active: 'var(--accent-mint)',
  replayable: 'var(--accent-teal)',
  waiting_for_updates: 'var(--accent-yellow)',
  finished: 'var(--text-muted)',
  banned: 'var(--accent-red)',
};

export const STATE_DESCRIPTIONS = {
  active: 'In rotation — your default play queue.',
  replayable: 'Worth playing again without needing new content.',
  waiting_for_updates: 'Done for now — notify when the game gets updates.',
  finished: 'Completed — unlikely to replay.',
  banned: 'Ignored — add a note if you want to remember why.',
};

export function resolveLibraryState(game) {
  if (game?.libraryState && LIBRARY_STATES.includes(game.libraryState)) {
    return game.libraryState;
  }
  if (game?.abandoned) return 'banned';
  if (game?.finished) return 'finished';
  return 'active';
}

export function getLibraryStateLabel(state) {
  return STATE_LABELS[state] || STATE_LABELS.active;
}

export function getLibraryStateColor(state) {
  return STATE_COLORS[state] || STATE_COLORS.active;
}

/** @returns {null | 1 | 2 | 3 | 4 | 5} */
export function normalizeFinishedRating(value) {
  const n = Number(value);
  if (Number.isInteger(n) && n >= 1 && n <= 5) return n;
  return null;
}

export function buildStateMetaUpdates(state, note, currentVersion, finishedRating) {
  const updates = {
    libraryState: state,
    hasUpdateSinceState: false,
    stateMeta: {
      versionAtEntry: currentVersion ?? null,
      note: String(note ?? '').trim(),
      enteredAt: serverTimestamp(),
    },
  };

  if (state === 'finished') {
    updates.finishedRating = normalizeFinishedRating(finishedRating);
  } else {
    updates.finishedRating = null;
  }

  return updates;
}
