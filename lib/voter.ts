export function getVoterKey(): string {
  if (typeof window === "undefined") return "";

  const existing = window.localStorage.getItem("voter_key");
  if (existing) return existing;

  const newKey =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `voter_${Date.now()}_${Math.random().toString(36).slice(2)}`;

  window.localStorage.setItem("voter_key", newKey);
  return newKey;
}