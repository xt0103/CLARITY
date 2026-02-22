export type ProfileOverride = {
  displayName?: string;
};

function keyFor(userId: string) {
  return `looogo_profile_override_v1:${userId}`;
}

export function getProfileOverride(userId: string): ProfileOverride {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(keyFor(userId));
    if (!raw) return {};
    const parsed = JSON.parse(raw) as ProfileOverride;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export function setProfileOverride(userId: string, override: ProfileOverride) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(keyFor(userId), JSON.stringify(override));
}

export function clearProfileOverride(userId: string) {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(keyFor(userId));
}

