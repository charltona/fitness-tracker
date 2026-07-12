/**
 * Notification utilities — disabled.
 * These are no-op stubs so the rest of the app compiles without the notifee dependency.
 */

export async function requestNotificationPermission() {
  return true;
}

export async function startWorkoutNotification(_startTimeMs: number) {
  // no-op
}

export async function pauseWorkoutNotification(_elapsedSeconds: number) {
  // no-op
}

export async function stopWorkoutNotification() {
  // no-op
}
