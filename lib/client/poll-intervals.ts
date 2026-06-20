const DEV = process.env.NODE_ENV === 'development';
const DEV_SCALE = DEV ? 4 : 1;

export const POLL_HOME_IDLE_MS = 20_000 * DEV_SCALE;
export const POLL_HOME_ACTIVE_MS = 6_000 * DEV_SCALE;
export const POLL_BADGE_MS = 45_000 * DEV_SCALE;
