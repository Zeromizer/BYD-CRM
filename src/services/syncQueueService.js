/**
 * Sync Queue Service
 * Manages reliable syncing of data to Google Drive with retry logic and offline support
 *
 * Features:
 * - Queue operations for reliable delivery
 * - Automatic retry with exponential backoff
 * - Persist pending operations to localStorage (survives restart)
 * - Track sync status per data type
 * - Process queue when online
 */

const STORAGE_KEY = 'syncQueue';
const MAX_RETRIES = 3;
const BASE_DELAY_MS = 2000; // 2 seconds

// Sync status constants
export const SYNC_STATUS = {
  SYNCED: 'synced',
  PENDING: 'pending',
  SYNCING: 'syncing',
  FAILED: 'failed',
  OFFLINE: 'offline',
};

class SyncQueueService {
  constructor() {
    this.queue = [];
    this.isProcessing = false;
    this.statusListeners = new Map(); // dataType -> Set of callbacks
    this.status = {
      forms: { status: SYNC_STATUS.SYNCED, lastError: null, lastSyncTime: null, pendingCount: 0 },
      excel: { status: SYNC_STATUS.SYNCED, lastError: null, lastSyncTime: null, pendingCount: 0 },
      customers: { status: SYNC_STATUS.SYNCED, lastError: null, lastSyncTime: null, pendingCount: 0 },
    };

    // Load persisted queue on startup
    this.loadQueue();

    // Listen for online/offline events
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => this.onOnline());
      window.addEventListener('offline', () => this.onOffline());
    }
  }

  /**
   * Load persisted queue from localStorage
   */
  loadQueue() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        this.queue = parsed.queue || [];

        // Update status based on loaded queue
        this.queue.forEach(item => {
          if (this.status[item.dataType]) {
            this.status[item.dataType].pendingCount++;
            this.status[item.dataType].status = SYNC_STATUS.PENDING;
          }
        });

        console.log(`[SyncQueue] Loaded ${this.queue.length} pending operations from storage`);
      }
    } catch (error) {
      console.error('[SyncQueue] Failed to load queue:', error);
      this.queue = [];
    }
  }

  /**
   * Save queue to localStorage for persistence
   */
  saveQueue() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        queue: this.queue,
        savedAt: new Date().toISOString(),
      }));
    } catch (error) {
      console.error('[SyncQueue] Failed to save queue:', error);
    }
  }

  /**
   * Subscribe to status changes for a data type
   * @param {string} dataType - 'forms', 'excel', or 'customers'
   * @param {function} callback - Called with status object when status changes
   * @returns {function} Unsubscribe function
   */
  onStatusChange(dataType, callback) {
    if (!this.statusListeners.has(dataType)) {
      this.statusListeners.set(dataType, new Set());
    }
    this.statusListeners.get(dataType).add(callback);

    // Immediately call with current status
    callback(this.status[dataType]);

    return () => {
      this.statusListeners.get(dataType)?.delete(callback);
    };
  }

  /**
   * Notify listeners of status change
   */
  notifyStatusChange(dataType) {
    const listeners = this.statusListeners.get(dataType);
    if (listeners) {
      listeners.forEach(callback => callback(this.status[dataType]));
    }

    // Also notify 'all' listeners
    const allListeners = this.statusListeners.get('all');
    if (allListeners) {
      allListeners.forEach(callback => callback(this.getOverallStatus()));
    }
  }

  /**
   * Get overall sync status across all data types
   */
  getOverallStatus() {
    const statuses = Object.values(this.status);

    if (statuses.some(s => s.status === SYNC_STATUS.FAILED)) {
      return { status: SYNC_STATUS.FAILED, message: 'Some items failed to sync' };
    }
    if (statuses.some(s => s.status === SYNC_STATUS.SYNCING)) {
      return { status: SYNC_STATUS.SYNCING, message: 'Syncing...' };
    }
    if (statuses.some(s => s.status === SYNC_STATUS.PENDING)) {
      return { status: SYNC_STATUS.PENDING, message: 'Changes pending sync' };
    }
    if (statuses.some(s => s.status === SYNC_STATUS.OFFLINE)) {
      return { status: SYNC_STATUS.OFFLINE, message: 'Offline - will sync when connected' };
    }
    return { status: SYNC_STATUS.SYNCED, message: 'All changes synced' };
  }

  /**
   * Get status for a specific data type
   */
  getStatus(dataType) {
    return this.status[dataType] || { status: SYNC_STATUS.SYNCED, lastError: null, lastSyncTime: null };
  }

  /**
   * Queue a sync operation
   * @param {string} dataType - 'forms', 'excel', or 'customers'
   * @param {function} operation - Async function to execute
   * @param {object} metadata - Additional info for logging/debugging
   */
  async enqueue(dataType, operation, metadata = {}) {
    const item = {
      id: `${dataType}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      dataType,
      operation,
      metadata,
      retries: 0,
      createdAt: new Date().toISOString(),
    };

    // Check if online
    if (!navigator.onLine) {
      console.log(`[SyncQueue] Offline - queuing ${dataType} operation for later`);
      this.queue.push(item);
      this.saveQueue();
      this.updateStatus(dataType, SYNC_STATUS.OFFLINE, null);
      return { queued: true, offline: true };
    }

    // Try to execute immediately
    this.updateStatus(dataType, SYNC_STATUS.SYNCING, null);

    try {
      await this.executeWithRetry(item);
      this.updateStatus(dataType, SYNC_STATUS.SYNCED, null);
      return { success: true };
    } catch (error) {
      // Add to queue for later retry
      this.queue.push(item);
      this.saveQueue();
      this.updateStatus(dataType, SYNC_STATUS.FAILED, error.message);
      return { success: false, error: error.message, queued: true };
    }
  }

  /**
   * Execute operation with retry logic
   */
  async executeWithRetry(item) {
    let lastError;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        if (attempt > 0) {
          // Exponential backoff
          const delay = BASE_DELAY_MS * Math.pow(2, attempt - 1);
          console.log(`[SyncQueue] Retry ${attempt}/${MAX_RETRIES} for ${item.dataType} after ${delay}ms`);
          await this.sleep(delay);
        }

        await item.operation();
        console.log(`[SyncQueue] Successfully synced ${item.dataType}`);
        return true;
      } catch (error) {
        lastError = error;
        console.error(`[SyncQueue] Attempt ${attempt + 1} failed for ${item.dataType}:`, error.message);

        // Don't retry on auth errors
        if (error.message?.includes('401') || error.message?.includes('403') ||
            error.message?.includes('auth') || error.message?.includes('token')) {
          console.log(`[SyncQueue] Auth error - not retrying`);
          break;
        }
      }
    }

    throw lastError || new Error('Max retries exceeded');
  }

  /**
   * Update status for a data type
   */
  updateStatus(dataType, status, error) {
    if (!this.status[dataType]) {
      this.status[dataType] = { status: SYNC_STATUS.SYNCED, lastError: null, lastSyncTime: null, pendingCount: 0 };
    }

    this.status[dataType].status = status;
    this.status[dataType].lastError = error;

    if (status === SYNC_STATUS.SYNCED) {
      this.status[dataType].lastSyncTime = new Date().toISOString();
      this.status[dataType].pendingCount = this.queue.filter(i => i.dataType === dataType).length;
    }

    this.notifyStatusChange(dataType);
  }

  /**
   * Process all queued operations
   */
  async processQueue() {
    if (this.isProcessing || this.queue.length === 0) {
      return;
    }

    if (!navigator.onLine) {
      console.log('[SyncQueue] Offline - cannot process queue');
      return;
    }

    this.isProcessing = true;
    console.log(`[SyncQueue] Processing ${this.queue.length} queued operations`);

    const failedItems = [];

    while (this.queue.length > 0) {
      const item = this.queue.shift();
      this.updateStatus(item.dataType, SYNC_STATUS.SYNCING, null);

      try {
        await this.executeWithRetry(item);
        this.updateStatus(item.dataType, SYNC_STATUS.SYNCED, null);
      } catch (error) {
        console.error(`[SyncQueue] Failed to process ${item.dataType}:`, error);
        item.retries++;
        item.lastError = error.message;

        if (item.retries < MAX_RETRIES) {
          failedItems.push(item);
        } else {
          this.updateStatus(item.dataType, SYNC_STATUS.FAILED, error.message);
        }
      }

      this.saveQueue();
    }

    // Re-add failed items to queue
    this.queue = failedItems;
    this.saveQueue();

    this.isProcessing = false;
    console.log(`[SyncQueue] Queue processing complete. ${failedItems.length} items remaining`);
  }

  /**
   * Force retry all failed operations
   */
  async retryFailed() {
    // Reset retry counts for failed items
    this.queue.forEach(item => {
      item.retries = 0;
    });

    // Update all statuses to pending
    Object.keys(this.status).forEach(dataType => {
      if (this.status[dataType].status === SYNC_STATUS.FAILED) {
        this.updateStatus(dataType, SYNC_STATUS.PENDING, null);
      }
    });

    await this.processQueue();
  }

  /**
   * Clear the queue (use with caution)
   */
  clearQueue() {
    this.queue = [];
    this.saveQueue();

    Object.keys(this.status).forEach(dataType => {
      this.updateStatus(dataType, SYNC_STATUS.SYNCED, null);
    });

    console.log('[SyncQueue] Queue cleared');
  }

  /**
   * Handle coming online
   */
  onOnline() {
    console.log('[SyncQueue] Back online - processing queue');

    // Update offline statuses to pending
    Object.keys(this.status).forEach(dataType => {
      if (this.status[dataType].status === SYNC_STATUS.OFFLINE) {
        this.updateStatus(dataType, SYNC_STATUS.PENDING, null);
      }
    });

    this.processQueue();
  }

  /**
   * Handle going offline
   */
  onOffline() {
    console.log('[SyncQueue] Gone offline');

    Object.keys(this.status).forEach(dataType => {
      if (this.status[dataType].status === SYNC_STATUS.SYNCING ||
          this.status[dataType].status === SYNC_STATUS.PENDING) {
        this.updateStatus(dataType, SYNC_STATUS.OFFLINE, null);
      }
    });
  }

  /**
   * Utility: sleep for ms
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Mark a data type as synced (called after successful direct sync)
   */
  markSynced(dataType) {
    this.updateStatus(dataType, SYNC_STATUS.SYNCED, null);
  }

  /**
   * Mark a data type as failed (called after failed direct sync)
   */
  markFailed(dataType, error) {
    this.updateStatus(dataType, SYNC_STATUS.FAILED, error);
  }
}

// Create singleton instance
const syncQueueService = new SyncQueueService();

export default syncQueueService;
