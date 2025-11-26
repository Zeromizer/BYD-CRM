/**
 * Sync Coordinator
 * Manages parallel syncing of all data types with progress tracking
 */

import useCustomerStore from '../stores/useCustomerStore';
import useExcelStore from '../stores/useExcelStore';
import useDocumentStore from '../stores/useDocumentStore';

class SyncCoordinator {
  constructor() {
    this.progressCallbacks = [];
    this.lastSyncTime = null;
    this.syncCooldownMs = 60000; // 1 minute cooldown between syncs
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
      console.log('Not signed in, skipping sync');
      return;
    }

    // Check cooldown period (skip if synced recently, unless forced)
    if (!force && this.lastSyncTime) {
      const timeSinceLastSync = Date.now() - this.lastSyncTime;
      if (timeSinceLastSync < this.syncCooldownMs) {
        const remainingCooldown = Math.ceil((this.syncCooldownMs - timeSinceLastSync) / 1000);
        console.log(`⏳ Sync cooldown active - last sync was ${Math.ceil(timeSinceLastSync / 1000)}s ago. Wait ${remainingCooldown}s or use force sync.`);
        return;
      }
    }

    console.log(force ? '🔄 Force syncing all data...' : '🔄 Syncing all data...');

    const progress = {
      customers: { status: 'pending', detail: '' },
      excel: { status: 'pending', detail: '' },
      documents: { status: 'pending', detail: '' },
      overall: 0,
    };

    // Notify initial state
    this.notifyProgress(progress);

    const updateProgress = (type, status, detail = '') => {
      progress[type] = { status, detail };

      // Calculate overall progress (3 types)
      const statuses = [progress.customers.status, progress.excel.status, progress.documents.status];
      const completed = statuses.filter(s => s === 'complete').length;
      const syncing = statuses.filter(s => s === 'syncing').length;
      progress.overall = (completed * 100 + syncing * 25) / 3;

      this.notifyProgress({ ...progress });
    };

    try {
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
            console.error('Customer sync failed:', error);
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
            console.error('Excel sync failed:', error);
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
            console.error('Document templates sync failed:', error);
            updateProgress('documents', 'error', 'Sync failed');
            throw error;
          }
        })(),
      ];

      // Wait for all syncs to complete
      await Promise.all(syncPromises);

      // Update last sync time on successful completion
      this.lastSyncTime = Date.now();
      console.log('✅ All data synced successfully');
      return true;
    } catch (error) {
      console.error('Sync coordinator error:', error);
      // Don't throw - some syncs may have succeeded
      return false;
    }
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
