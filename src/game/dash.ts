import type { CharacterId, Player } from '../types';

export const DASH_PROFILES = {
  knight: { baseCharges: 2, rechargeSeconds: 5 },
  mage: { baseCharges: 1, rechargeSeconds: 4 },
  ranger: { baseCharges: 3, rechargeSeconds: 6 },
} as const satisfies Record<CharacterId, { baseCharges: number; rechargeSeconds: number }>;
export const DASH_CAPACITY_LEVEL = 8;
export const DASH_REUSE_SECONDS = .85;

export type DashState = Pick<Player, 'dashCharges' | 'dashMaxCharges' | 'dashRechargeRemaining' | 'dashRechargeDuration' | 'dashReuseDelay' | 'dashCooldown'>;

/** Legacy consumers read the time until the next usable dash, not a refill timer. */
function withCooldown(state: DashState): DashState {
  return {
    dashCharges: state.dashCharges, dashMaxCharges: state.dashMaxCharges,
    dashRechargeRemaining: state.dashRechargeRemaining, dashRechargeDuration: state.dashRechargeDuration,
    dashReuseDelay: state.dashReuseDelay,
    dashCooldown: state.dashCharges > 0 ? state.dashReuseDelay : Math.max(state.dashRechargeRemaining, state.dashReuseDelay),
  };
}

export function initialDashState(character: CharacterId): DashState {
  const profile = DASH_PROFILES[character];
  return { dashCharges: profile.baseCharges, dashMaxCharges: profile.baseCharges,
    dashRechargeRemaining: 0, dashRechargeDuration: profile.rechargeSeconds,
    dashReuseDelay: 0, dashCooldown: 0 };
}

/** Capacity is earned once. New capacity is empty, and a running refill is retained. */
export function configureDash(state: DashState, character: CharacterId, level: number, speedUpgrade: number): DashState {
  const profile = DASH_PROFILES[character];
  const maximum = profile.baseCharges + (level >= DASH_CAPACITY_LEVEL ? 1 : 0);
  const duration = Math.max(3, profile.rechargeSeconds * (1 - .08 * Math.max(0, Math.min(3, speedUpgrade))));
  const charges = Math.min(state.dashCharges, maximum);
  let remaining = 0;
  if (charges < maximum) {
    remaining = state.dashRechargeRemaining > 0
      ? state.dashRechargeRemaining * duration / state.dashRechargeDuration : duration;
  }
  return withCooldown({ ...state, dashCharges: charges, dashMaxCharges: maximum,
    dashRechargeDuration: duration, dashRechargeRemaining: remaining });
}

/** Serial refill: excess elapsed time carries into the next empty charge. */
export function advanceDash(state: DashState, dt: number): DashState {
  if (!Number.isFinite(dt) || dt <= 0) return withCooldown(state);
  let charges = state.dashCharges;
  let remaining = state.dashRechargeRemaining;
  if (charges < state.dashMaxCharges) {
    remaining = (remaining > 0 ? remaining : state.dashRechargeDuration) - dt;
    // At most four iterations in the configured profiles, even with a large dt.
    for (let i = 0; i < state.dashMaxCharges && remaining <= 1e-9 && charges < state.dashMaxCharges; i++) {
      charges++;
      if (charges < state.dashMaxCharges) remaining += state.dashRechargeDuration;
      else remaining = 0;
    }
  } else remaining = 0;
  return withCooldown({ ...state, dashCharges: charges, dashRechargeRemaining: Math.max(0, remaining),
    dashReuseDelay: state.dashReuseDelay - dt <= 1e-9 ? 0 : state.dashReuseDelay - dt });
}

/** A second use never resets a refill already in progress. */
export function consumeDash(state: DashState): DashState | undefined {
  if (state.dashCharges <= 0 || state.dashReuseDelay > 1e-9) return undefined;
  const wasFull = state.dashCharges === state.dashMaxCharges;
  return withCooldown({ ...state, dashCharges: state.dashCharges - 1, dashReuseDelay: DASH_REUSE_SECONDS,
    dashRechargeRemaining: wasFull ? state.dashRechargeDuration : state.dashRechargeRemaining });
}
