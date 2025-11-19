/**
 * Sync Queue Module
 *
 * Manages background synchronization operations with optimistic UI updates.
 * Queues sync operations and processes them asynchronously to prevent UI blocking.
 */

// ============ Queue State ============
let syncQueue = [];
let isProcessing = false;
let currentOperation = null;
let queueListeners = [];
let retryDelays = [2000, 5000, 10000]; // Exponential backoff delays

// ============ Queue Item Structure ============
/**
 * @typedef {Object} QueueItem
 * @property {string} id - Unique identifier for the operation
 * @property {string} type - Type of operation (e.g., 'saveData', 'createFolder')
 * @property {Function} operation - The async function to execute
 * @property {Object} data - Data associated with the operation
 * @property {number} retries - Number of retry attempts remaining
 * @property {number} timestamp - When the operation was queued
 * @property {string} status - Current status: 'pending', 'processing', 'completed', 'failed'
 */

/**
 * Add an operation to the sync queue
 * @param {string} type - Type of operation
 * @param {Function} operation - Async function to execute
 * @param {Object} data - Associated data
 * @returns {string} Queue item ID
 */
function queueOperation(type, operation, data = {}) {
    const id = `${type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const queueItem = {
        id,
        type,
        operation,
        data,
        retries: 3,
        timestamp: Date.now(),
        status: 'pending'
    };

    syncQueue.push(queueItem);
    notifyListeners('queued', queueItem);

    // Start processing if not already running
    if (!isProcessing) {
        processQueue();
    }

    return id;
}

/**
 * Process the sync queue sequentially
 */
async function processQueue() {
    if (isProcessing || syncQueue.length === 0) {
        return;
    }

    isProcessing = true;
    notifyListeners('processing_started', { queueLength: syncQueue.length });

    while (syncQueue.length > 0) {
        const item = syncQueue[0];
        currentOperation = item;
        item.status = 'processing';

        notifyListeners('item_processing', item);

        try {
            // Execute the operation
            const result = await item.operation(item.data);

            // Success - remove from queue
            item.status = 'completed';
            syncQueue.shift();
            currentOperation = null;

            notifyListeners('item_completed', { item, result });

        } catch (error) {
            console.error(`Sync operation failed: ${item.type}`, error);

            item.retries--;

            if (item.retries > 0) {
                // Retry with exponential backoff
                const retryDelay = retryDelays[3 - item.retries] || 10000;
                item.status = 'retrying';

                notifyListeners('item_retrying', {
                    item,
                    error,
                    retryDelay,
                    retriesLeft: item.retries
                });

                // Move to end of queue and wait before retry
                syncQueue.shift();
                await new Promise(resolve => setTimeout(resolve, retryDelay));
                syncQueue.push(item);
                item.status = 'pending';

            } else {
                // Max retries exceeded
                item.status = 'failed';
                item.error = error;
                syncQueue.shift();
                currentOperation = null;

                notifyListeners('item_failed', { item, error });
            }
        }
    }

    isProcessing = false;
    currentOperation = null;
    notifyListeners('processing_completed', { timestamp: Date.now() });
}

/**
 * Add a listener for queue events
 * @param {Function} callback - Callback function (event, data) => void
 * @returns {Function} Unsubscribe function
 */
function addQueueListener(callback) {
    queueListeners.push(callback);

    // Return unsubscribe function
    return () => {
        const index = queueListeners.indexOf(callback);
        if (index > -1) {
            queueListeners.splice(index, 1);
        }
    };
}

/**
 * Notify all listeners of a queue event
 * @param {string} event - Event name
 * @param {Object} data - Event data
 */
function notifyListeners(event, data) {
    queueListeners.forEach(listener => {
        try {
            listener(event, data);
        } catch (error) {
            console.error('Error in queue listener:', error);
        }
    });
}

/**
 * Get current queue status
 * @returns {Object} Queue status information
 */
function getQueueStatus() {
    return {
        queueLength: syncQueue.length,
        isProcessing,
        currentOperation: currentOperation ? {
            id: currentOperation.id,
            type: currentOperation.type,
            status: currentOperation.status
        } : null,
        pendingItems: syncQueue.filter(item => item.status === 'pending').length,
        retryingItems: syncQueue.filter(item => item.status === 'retrying').length
    };
}

/**
 * Clear all completed items and reset queue
 */
function clearQueue() {
    syncQueue = syncQueue.filter(item =>
        item.status === 'processing' || item.status === 'pending'
    );
    notifyListeners('queue_cleared', { timestamp: Date.now() });
}

/**
 * Retry all failed items
 */
function retryFailedItems() {
    const failedItems = syncQueue.filter(item => item.status === 'failed');

    failedItems.forEach(item => {
        item.status = 'pending';
        item.retries = 3; // Reset retries
        delete item.error;
    });

    if (failedItems.length > 0) {
        notifyListeners('retry_initiated', { count: failedItems.length });

        if (!isProcessing) {
            processQueue();
        }
    }
}

/**
 * Optimistic save wrapper
 * Updates local state immediately and queues cloud sync in background
 * @param {Function} localUpdate - Function to update local state
 * @param {Function} cloudSync - Function to sync to cloud
 * @param {Object} data - Data for the operation
 * @returns {Promise} Resolves immediately after local update
 */
async function optimisticSave(localUpdate, cloudSync, data = {}) {
    // 1. Update local state immediately (optimistic update)
    try {
        await localUpdate(data);
    } catch (error) {
        console.error('Local update failed:', error);
        throw error; // Can't proceed if local update fails
    }

    // 2. Queue cloud sync in background
    const queueId = queueOperation('cloudSync', cloudSync, data);

    // 3. Return immediately (don't wait for cloud sync)
    return {
        success: true,
        queueId,
        message: 'Changes saved locally, syncing to cloud...'
    };
}

/**
 * Check if device is online
 * @returns {boolean}
 */
function isOnline() {
    return navigator.onLine;
}

/**
 * Pause queue processing (useful for offline scenarios)
 */
function pauseQueue() {
    isProcessing = false;
    notifyListeners('queue_paused', { timestamp: Date.now() });
}

/**
 * Resume queue processing
 */
function resumeQueue() {
    if (syncQueue.length > 0 && !isProcessing) {
        notifyListeners('queue_resumed', { timestamp: Date.now() });
        processQueue();
    }
}

// ============ Offline/Online Event Handlers ============
window.addEventListener('online', () => {
    console.log('Device is online - resuming sync queue');
    notifyListeners('network_online', { timestamp: Date.now() });
    resumeQueue();
});

window.addEventListener('offline', () => {
    console.log('Device is offline - pausing sync queue');
    notifyListeners('network_offline', { timestamp: Date.now() });
    pauseQueue();
});

// ============ Exports ============
window.queueOperation = queueOperation;
window.addQueueListener = addQueueListener;
window.getQueueStatus = getQueueStatus;
window.clearQueue = clearQueue;
window.retryFailedItems = retryFailedItems;
window.optimisticSave = optimisticSave;
window.isOnline = isOnline;
window.pauseQueue = pauseQueue;
window.resumeQueue = resumeQueue;
