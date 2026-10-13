/** Guest-friendly progress flags kept in this browser only (there are no accounts). */

const ONBOARDING_KEY = "clanchaos:onboarding";
const TUTORIAL_KEY = "clanchaos:tutorial";

export type Progress = "completed" | "skipped";

function read(key: string): Progress | null {
  try {
    const v = localStorage.getItem(key);
    return v === "completed" || v === "skipped" ? v : null;
  } catch {
    return null;
  }
}

function write(key: string, v: Progress): void {
  try {
    localStorage.setItem(key, v);
  } catch {
    // Storage can be unavailable (private mode); the intro simply shows again next time.
  }
}

export const onboardingProgress = () => read(ONBOARDING_KEY);
export const setOnboardingProgress = (v: Progress) => write(ONBOARDING_KEY, v);
export const tutorialProgress = () => read(TUTORIAL_KEY);
export const setTutorialProgress = (v: Progress) => write(TUTORIAL_KEY, v);
