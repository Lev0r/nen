import { getNickname } from './userConfig';
import { resolveLibraryState } from './libraryState';

export const HYPE_TIERS = {
  worthless_crystal: { label: 'Worthless Crystal', multiplier: 0.5 },
  morkite_found: { label: 'Morkite Found', multiplier: 1.0 },
  we_rich: { label: "We're Rich!", multiplier: 1.5 },
};

const PERSONAL_BASE = 5;
const MAX_PAIR_EFFECTIVE = 15;

export function getTier(game, userKey) {
  const tier = game.hypeTier?.[userKey];
  if (tier && HYPE_TIERS[tier]) return tier;

  const legacy = game.hype?.[userKey];
  if (legacy != null) {
    if (legacy <= 3) return 'worthless_crystal';
    if (legacy >= 8) return 'we_rich';
    return 'morkite_found';
  }
  return 'morkite_found';
}

export function effectivePersonalHype(tier) {
  const config = HYPE_TIERS[tier] || HYPE_TIERS.morkite_found;
  return PERSONAL_BASE * config.multiplier;
}

export function getOwnershipFactor(owned) {
  if (owned?.user0 && owned?.user1) {
    return { factor: 1.0, label: 'Both own the game' };
  }
  if (owned?.user0 || owned?.user1) {
    return { factor: 0.5, label: 'One of you owns it' };
  }
  return { factor: 0.25, label: 'Neither owns it' };
}

export function getStatusFactor(developmentStatus) {
  if (developmentStatus === 'early_access') {
    return {
      factor: 0.75,
      label: 'Early Access',
      color: 'var(--accent-yellow)',
    };
  }
  if (developmentStatus === 'tba') {
    return {
      factor: 0.1,
      label: 'Coming soon / TBA',
      color: 'var(--accent-red)',
    };
  }
  return {
    factor: 1.0,
    label: 'Released',
    color: 'var(--accent-mint)',
  };
}

export function getSteamReviewColor(steamReviewPercent) {
  if (steamReviewPercent == null || steamReviewPercent === '') {
    return 'var(--text-muted)';
  }
  const pct = Number(steamReviewPercent);
  if (pct >= 80) return 'var(--accent-mint)';
  if (pct >= 60) return 'var(--accent-yellow)';
  return 'var(--accent-red)';
}

export function getSteamOverviewFactor(steamReviewPercent) {
  if (steamReviewPercent == null || steamReviewPercent === '') {
    return {
      factor: 1.0,
      label: 'No Steam review data',
      color: 'var(--text-muted)',
      percent: null,
    };
  }
  const pct = Math.min(100, Math.max(0, Number(steamReviewPercent)));
  const factor = 0.9 + (pct / 100) * 0.15;
  return {
    factor,
    label: `${pct}% Steam positive reviews`,
    color: getSteamReviewColor(pct),
    percent: pct,
  };
}

export function calculateTotalHype(game) {
  if (game.ruDeveloperAlert) {
    return {
      total: 0,
      breakdown: {
        override: true,
        message: 'Russian developer alert — Total Hype locked to 0',
      },
    };
  }

  const libraryState = resolveLibraryState(game);
  if (libraryState === 'finished') {
    return {
      total: 0,
      breakdown: {
        override: true,
        message: 'Finished — Total Hype locked to 0',
      },
    };
  }
  if (libraryState === 'banned') {
    return {
      total: 0,
      breakdown: {
        override: true,
        message: 'Banned — Total Hype locked to 0',
      },
    };
  }

  const tier0 = getTier(game, 'user0');
  const tier1 = getTier(game, 'user1');
  const eff0 = effectivePersonalHype(tier0);
  const eff1 = effectivePersonalHype(tier1);
  const tierBase = ((eff0 + eff1) / MAX_PAIR_EFFECTIVE) * 100;

  const ownership = {
    ...getOwnershipFactor(game.owned),
    color:
      game.owned?.user0 && game.owned?.user1
        ? 'var(--accent-mint)'
        : game.owned?.user0 || game.owned?.user1
          ? 'var(--accent-yellow)'
          : 'var(--accent-red)',
  };
  const status = getStatusFactor(game.developmentStatus);
  const steam = getSteamOverviewFactor(game.steamReviewPercent);

  const raw =
    tierBase * ownership.factor * status.factor * steam.factor;
  const total = Math.round(Math.min(100, Math.max(0, raw)));

  return {
    total,
    breakdown: {
      users: [
        {
          userIndex: 0,
          nickname: getNickname(0),
          tier: tier0,
          tierLabel: HYPE_TIERS[tier0].label,
          effective: eff0,
        },
        {
          userIndex: 1,
          nickname: getNickname(1),
          tier: tier1,
          tierLabel: HYPE_TIERS[tier1].label,
          effective: eff1,
        },
      ],
      tierBase: Math.round(tierBase * 10) / 10,
      ownership,
      status,
      steam,
      final: total,
    },
  };
}

export function getScoreColor(score) {
  if (score >= 80) return 'var(--accent-mint)';
  if (score >= 50) return 'var(--accent-yellow)';
  return 'var(--accent-red)';
}

export function getOwnershipStage(owned) {
  const count = [owned?.user0, owned?.user1].filter(Boolean).length;
  return count;
}

export function getStatusColor(developmentStatus) {
  if (developmentStatus === 'early_access') return 'var(--accent-yellow)';
  if (developmentStatus === 'tba') return 'var(--accent-red)';
  return 'var(--accent-mint)';
}

export function formatStatusLabel(developmentStatus) {
  if (developmentStatus === 'early_access') return 'Early Access';
  if (developmentStatus === 'tba') return 'TBA';
  return 'Released';
}
