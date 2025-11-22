/**
 * Sync Coordinator
 * Manages parallel syncing of all data types with progress tracking
 */

import useCustomerStore from '../stores/useCustomerStore';
import useFormsStore from '../stores/useFormsStore';
import useExcelStore from '../stores/useExcelStore';

class SyncCoordinator {
  constructor() {
    this.progressCallbacks = [];
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
   */
  async syncAll(isSignedIn) {
    if (!isSignedIn) {
      console.log('Not signed in, skipping sync');
      return;
    }

    const progress = {
      customers: { status: 'pending', detail: '' },
      forms: { status: 'pending', detail: '' },
      excel: { status: 'pending', detail: '' },
      overall: 0,
    };

    // Notify initial state
    this.notifyProgress(progress);

    const updateProgress = (type, status, detail = '') => {
      progress[type] = { status, detail };

      // Calculate overall progress
      const statuses = [progress.customers.status, progress.forms.status, progress.excel.status];
      const completed = statuses.filter(s => s === 'complete').length;
      const syncing = statuses.filter(s => s === 'syncing').length;
      progress.overall = (completed * 100 + syncing * 33) / 3;

      this.notifyProgress({ ...progress });
    };

    try {
      // Start all syncs in parallel
      const syncPromises = [
        // Sync customers
        (async () => {
          try {
            updateProgress('customers', 'syncing', 'Loading from Drive...');
            await useCustomerStore.getState().syncFromDrive(isSignedIn);
            const count = useCustomerStore.getState().customers.length;
            updateProgress('customers', 'complete', `${count} customer${count !== 1 ? 's' : ''} synced`);
          } catch (error) {
            console.error('Customer sync failed:', error);
            updateProgress('customers', 'error', 'Sync failed');
            throw error;
          }
        })(),

        // Sync forms
        (async () => {
          try {
            updateProgress('forms', 'syncing', 'Loading templates...');
            await useFormsStore.getState().syncWithDrive();
            const count = Object.keys(useFormsStore.getState().formTemplates).length;
            updateProgress('forms', 'complete', `${count} template${count !== 1 ? 's' : ''} synced`);
          } catch (error) {
            console.error('Forms sync failed:', error);
            updateProgress('forms', 'error', 'Sync failed');
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
      ];

      // Wait for all syncs to complete
      await Promise.all(syncPromises);

      console.log('All data synced successfully');
      return true;
    } catch (error) {
      console.error('Sync coordinator error:', error);
      // Don't throw - some syncs may have succeeded
      return false;
    }
  }
}

// Create singleton instance
const syncCoordinator = new SyncCoordinator();

export default syncCoordinator;
