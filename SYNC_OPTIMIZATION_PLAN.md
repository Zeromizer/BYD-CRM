# Sync Optimization Plan

## Current Issues

1. **Token Refresh Triggers Full Resync**: Every token refresh (~50 min) causes full data resync
2. **No Sync Debouncing**: Multiple components can trigger syncs simultaneously
3. **No Last Sync Tracking**: App doesn't know when last sync happened
4. **No Manual Sync Prevention**: User can't disable auto-sync if needed

## Recommended Fixes

### Fix 1: Only Sync on Sign-In State Change (NOT Token Refresh)
**File**: `src/stores/useAuthStore.js`
**Change**: Track previous sign-in state and only sync when transitioning from signed-out → signed-in

```javascript
// Before:
if (isSignedIn && get().onSignInCallback) {
  await get().onSignInCallback();
}

// After:
if (isSignedIn && !previousSignInState && get().onSignInCallback) {
  await get().onSignInCallback(); // Only on fresh sign-in
}
```

### Fix 2: Add Last Sync Time Tracking
**File**: `src/services/syncCoordinator.js`
- Track last successful sync time
- Skip sync if last sync was < 5 minutes ago (configurable)
- Add force parameter to bypass cooldown

### Fix 3: Debounce Local Storage Loads
**File**: Component-level improvements
- Remove function dependencies from useEffect deps
- Use stable selectors from Zustand

### Fix 4: Add Sync Settings
- Allow user to disable auto-sync
- Manual sync button only
- Show last sync time in UI

## Priority

HIGH: Fix 1 (prevents most unnecessary syncs)
MEDIUM: Fix 2 (prevents rapid resyncs)
LOW: Fix 3 & 4 (nice to have)
