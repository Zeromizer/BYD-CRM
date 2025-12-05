/**
 * Sync Coordinator
 * Manages parallel syncing of all data types with progress tracking
 * OPTIMIZED Phase 2+3: Includes warmup with caching and performance timing
 */

import useCustomerStore from '../stores/useCustomerStore';
import useExcelStore from '../stores/useExcelStore';
import useDocumentStore from '../stores/useDocumentStore';
import useTodoStore from '../stores/useTodoStore';
import { getStorageService } from './storageServiceSelector';
import userStorage from './userStorage';
import { initializeGeminiService } from './geminiService';

class SyncCoordinator {
  constructor() {
    this.progressCallbacks = [];
    this.lastSyncTime = null;
    this.syncCooldownMs = 60000; // 1 minute cooldown between syncs
    this.lastSyncDuration = null; // OPTIMIZATION: Track sync performance
  }

  /**
   * Subscribe to progress updates
   */
  onProgress(callback) {
    this.progressCallbacks.push(callback);
    return () => {
      this.progressCallbacks = this.progressCallbacks.filter(cb => cb !== callback);
    };
  }

  /**
   * Notify all subscribers of progress update
   */
  notifyProgress(progress) {
    this.progressCallbacks.forEach(callback => {
      callback(progress);
    });
  }

  /**
   * Sync all data in parallel with progress tracking
   * @param {boolean} isSignedIn - Whether user is signed in
   * @param {boolean} force - Force sync even if within cooldown period
   */
  async syncAll(isSignedIn, force = false) {
    if (!isSignedIn) {
      return;
    }

    // Check cooldown period (skip if synced recently, unless forced)
    if (!force && this.lastSyncTime) {
      const timeSinceLastSync = Date.now() - this.lastSyncTime;
      if (timeSinceLastSync < this.syncCooldownMs) {
        return;
      }
    }

    const progress = {
      customers: { status: 'pending', detail: '' },
      excel: { status: 'pending', detail: '' },
      documents: { status: 'pending', detail: '' },
      todos: { status: 'pending', detail: '' },
      overall: 0,
    };

    // Notify initial state
    this.notifyProgress(progress);

    const updateProgress = (type, status, detail = '') => {
      progress[type] = { status, detail };

      // Calculate overall progress (4 types)
      const statuses = [progress.customers.status, progress.excel.status, progress.documents.status, progress.todos.status];
      const completed = statuses.filter(s => s === 'complete').length;
      const syncing = statuses.filter(s => s === 'syncing').length;
      progress.overall = (completed * 100 + syncing * 25) / 4;

      this.notifyProgress({ ...progress });
    };

    const syncStartTime = Date.now();

    try {
      // OPTIMIZATION Phase 2+3: Warmup - preload folder IDs (uses cache on subsequent syncs)
      const warmupStart = Date.now();
      await Promise.all([
        getStorageService().warmup(),
        initializeGeminiService(), // Load Gemini API key from OneDrive settings
      ]);
      console.log(`Sync warmup: ${Date.now() - warmupStart}ms`);

      // Start all syncs in parallel
      const syncPromises = [
        // Sync customers
        (async () => {
          try {
            updateProgress('customers', 'syncing', 'Loading from Drive...');
            await useCustomerStore.getState().syncFromDriveHybrid(isSignedIn);
            const count = useCustomerStore.getState().customers.length;
            updateProgress('customers', 'complete', `${count} customer${count !== 1 ? 's' : ''} synced`);
          } catch (error) {
            updateProgress('customers', 'error', 'Sync failed');
            throw error;
          }
        })(),

        // Sync Excel
        (async () => {
          try {
            updateProgress('excel', 'syncing', 'Loading templates...');
            await useExcelStore.getState().syncWithDrive();
            const count = Object.keys(useExcelStore.getState().excelTemplates).length;
            updateProgress('excel', 'complete', `${count} template${count !== 1 ? 's' : ''} synced`);
          } catch (error) {
            updateProgress('excel', 'error', 'Sync failed');
            throw error;
          }
        })(),

        // Sync Document Templates
        (async () => {
          try {
            updateProgress('documents', 'syncing', 'Loading document templates...');
            await useDocumentStore.getState().syncWithDrive();
            const count = Object.keys(useDocumentStore.getState().templates).length;
            updateProgress('documents', 'complete', `${count} document template${count !== 1 ? 's' : ''} synced`);
          } catch (error) {
            updateProgress('documents', 'error', 'Sync failed');
            throw error;
          }
        })(),

        // Sync Todos
        (async () => {
          try {
            updateProgress('todos', 'syncing', 'Loading tasks...');
            const email = userStorage.getUserEmail();
            await useTodoStore.getState().syncFromDrive(email);
            const count = useTodoStore.getState().todos.length;
            updateProgress('todos', 'complete', `${count} task${count !== 1 ? 's' : ''} synced`);
          } catch (error) {
            updateProgress('todos', 'error', 'Sync failed');
            // Don't throw - todos are non-critical
          }
        })(),
      ];

      // Wait for all syncs to complete
      await Promise.all(syncPromises);

      // Update last sync time and duration on successful completion
      this.lastSyncTime = Date.now();
      this.lastSyncDuration = Date.now() - syncStartTime;
      console.log(`Total sync completed in ${this.lastSyncDuration}ms`);
      return true;
    } catch {
      // Don't throw - some syncs may have succeeded
      this.lastSyncDuration = Date.now() - syncStartTime;
      return false;
    }
  }

  /**
   * Get the last sync duration in milliseconds
   */
  getLastSyncDuration() {
    return this.lastSyncDuration;
  }

  /**
   * Force a full refresh (invalidates all caches before sync)
   * Use when user manually triggers refresh or after long idle period
   */
  async forceFullRefresh(isSignedIn) {
    // Invalidate all caches
    const storageService = getStorageService();
    storageService.invalidateIndexCache?.();
    storageService.hasWarmedUp = false;

    // Force sync with full warmup
    return this.syncAll(isSignedIn, true);
  }

  /**
   * Get time since last sync in seconds
   */
  getTimeSinceLastSync() {
    if (!this.lastSyncTime) return null;
    return Math.floor((Date.now() - this.lastSyncTime) / 1000);
  }

  /**
   * Get formatted last sync time
   */
  getLastSyncTimeFormatted() {
    if (!this.lastSyncTime) return 'Never';

    const secondsAgo = this.getTimeSinceLastSync();
    if (secondsAgo < 60) return `${secondsAgo}s ago`;
    if (secondsAgo < 3600) return `${Math.floor(secondsAgo / 60)}m ago`;
    return `${Math.floor(secondsAgo / 3600)}h ago`;
  }
}

// Create singleton instance
const syncCoordinator = new SyncCoordinator();

export default syncCoordinator;
