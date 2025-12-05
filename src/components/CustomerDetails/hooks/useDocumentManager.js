import { useState, useCallback, useRef } from 'react';
import { getStorageService } from '../../../services/storageServiceSelector';
import { isFolder } from '../../../utils/fileHelpers';

// Folder cache with TTL for faster navigation
const folderCache = new Map();
const FOLDER_CACHE_TTL = 2 * 60 * 1000; // 2 minutes

/**
 * Hook for managing customer documents
 * @param {Object} customer - Current customer
 * @param {boolean} isSignedIn - Auth state
 * @param {Object} toast - Toast notification handler
 */
export function useDocumentManager(customer, isSignedIn, toast) {
  // Documents state
  const [documents, setDocuments] = useState([]);
  const [loadingDocuments, setLoadingDocuments] = useState(false);
  const [currentFolderId, setCurrentFolderId] = useState(null);
  const [folderPath, setFolderPath] = useState([]);

  // Viewer state
  const [selectedDocument, setSelectedDocument] = useState(null);
  const [isViewerOpen, setIsViewerOpen] = useState(false);

  // Helper to process and sort folder items
  const processFolderItems = useCallback((items) => {
    let allFiles = items.map(item => ({
      id: item.id,
      name: item.name,
      mimeType: item.folder ? 'folder' : (item.file?.mimeType || 'application/octet-stream'),
      size: item.size,
      createdTime: item.createdDateTime,
      webViewLink: item.webUrl,
      thumbnailLink: item['@microsoft.graph.downloadUrl'],
    }));

    // Sort folders first, then files, both alphabetically
    allFiles.sort((a, b) => {
      const aIsFolder = isFolder(a.mimeType);
      const bIsFolder = isFolder(b.mimeType);

      if (aIsFolder && !bIsFolder) return -1;
      if (!aIsFolder && bIsFolder) return 1;
      return (a.name || '').localeCompare(b.name || '');
    });

    return allFiles;
  }, []);

  // Load documents from a folder (with caching)
  const loadDocuments = useCallback(async (folderId, forceRefresh = false) => {
    if (!folderId || !isSignedIn) {
      setDocuments([]);
      return;
    }

    // Check cache first (unless force refresh)
    if (!forceRefresh) {
      const cached = folderCache.get(folderId);
      if (cached && Date.now() - cached.time < FOLDER_CACHE_TTL) {
        setDocuments(cached.items);
        return;
      }
    }

    setLoadingDocuments(true);

    try {
      const items = await getStorageService().listFolder(folderId);
      const allFiles = processFolderItems(items);

      // Cache the results
      folderCache.set(folderId, { items: allFiles, time: Date.now() });

      setDocuments(allFiles);
    } catch (error) {
      console.error('Error loading documents:', error);
      setDocuments([]);
    } finally {
      setLoadingDocuments(false);
    }
  }, [isSignedIn, processFolderItems]);

  // Invalidate cache for a folder
  const invalidateFolderCache = useCallback((folderId) => {
    if (folderId) {
      folderCache.delete(folderId);
    }
  }, []);

  // Navigate to a folder
  const navigateToFolder = useCallback((folder) => {
    setCurrentFolderId(folder.id);
    setFolderPath(prev => [...prev, folder]);
  }, []);

  // Navigate via breadcrumb
  const navigateToBreadcrumb = useCallback((index) => {
    const folder = folderPath[index];
    setCurrentFolderId(folder.id);
    setFolderPath(prev => prev.slice(0, index + 1));
  }, [folderPath]);

  // Initialize folder when customer changes
  const initializeFolder = useCallback(() => {
    if (customer?.driveFolderId) {
      setCurrentFolderId(customer.driveFolderId);
      setFolderPath([{
        id: customer.driveFolderId,
        name: customer.name || 'Customer Folder',
        webViewLink: customer.driveFolderLink,
      }]);
    } else {
      setCurrentFolderId(null);
      setFolderPath([]);
      setDocuments([]);
    }
  }, [customer]);

  // Delete a document (with optimistic update)
  const deleteDocument = useCallback(async (doc) => {
    const confirmDelete = window.confirm(
      `Are you sure you want to delete "${doc.name}"?\n\nThis will permanently delete the file from cloud storage.`
    );

    if (!confirmDelete) return false;

    // Optimistic update - remove from UI immediately
    setDocuments(prev => prev.filter(d => d.id !== doc.id));
    invalidateFolderCache(currentFolderId);

    try {
      await getStorageService().deleteFile(doc.id);
      toast?.success('Document deleted successfully');
      return true;
    } catch (error) {
      console.error('Error deleting document:', error);
      // Revert on error - reload from server
      await loadDocuments(currentFolderId, true);
      toast?.error('Failed to delete document. Please try again.');
      return false;
    }
  }, [currentFolderId, loadDocuments, invalidateFolderCache, toast]);

  // Move a document to another folder (with optimistic update)
  const moveDocument = useCallback(async (file, targetFolderId) => {
    // Optimistic update - remove from current folder UI
    setDocuments(prev => prev.filter(d => d.id !== file.id));
    invalidateFolderCache(currentFolderId);
    invalidateFolderCache(targetFolderId);

    try {
      await getStorageService().moveFile(file.id, targetFolderId);
      return true;
    } catch (error) {
      // Revert on error - reload from server
      await loadDocuments(currentFolderId, true);
      toast?.error(`Failed to move file: ${error.message}`);
      return false;
    }
  }, [currentFolderId, loadDocuments, invalidateFolderCache, toast]);

  // Rename a document (with optimistic update)
  const renameDocument = useCallback(async (doc, newName) => {
    // Optimistic update - update name in UI immediately
    setDocuments(prev => prev.map(d =>
      d.id === doc.id ? { ...d, name: newName } : d
    ));
    invalidateFolderCache(currentFolderId);

    try {
      await getStorageService().renameFile(doc.id, newName);
      return true;
    } catch (error) {
      // Revert on error - reload from server
      await loadDocuments(currentFolderId, true);
      toast?.error(`Failed to rename: ${error.message}`);
      return false;
    }
  }, [currentFolderId, loadDocuments, invalidateFolderCache, toast]);

  // Open document viewer
  const openDocument = useCallback((doc) => {
    setSelectedDocument(doc);
    setIsViewerOpen(true);
  }, []);

  // Close document viewer
  const closeViewer = useCallback(() => {
    setIsViewerOpen(false);
    setSelectedDocument(null);
  }, []);

  // Handle item click (folder navigation or document view)
  const handleItemClick = useCallback((item) => {
    if (isFolder(item.mimeType)) {
      navigateToFolder(item);
    } else {
      openDocument(item);
    }
  }, [navigateToFolder, openDocument]);

  // Refresh current folder (force refresh bypasses cache)
  const refresh = useCallback(() => {
    if (currentFolderId) {
      loadDocuments(currentFolderId, true); // Force refresh
    }
  }, [currentFolderId, loadDocuments]);

  return {
    // State
    documents,
    loadingDocuments,
    currentFolderId,
    folderPath,
    selectedDocument,
    isViewerOpen,

    // Actions
    loadDocuments,
    navigateToFolder,
    navigateToBreadcrumb,
    initializeFolder,
    deleteDocument,
    moveDocument,
    renameDocument,
    openDocument,
    closeViewer,
    handleItemClick,
    refresh,
    setCurrentFolderId,
    invalidateFolderCache,
  };
}

/**
 * Hook for drag and drop document operations
 */
export function useDragDrop(moveDocument) {
  const [draggedFile, setDraggedFile] = useState(null);
  const [dropTargetFolder, setDropTargetFolder] = useState(null);
  const [dropTargetBreadcrumb, setDropTargetBreadcrumb] = useState(null);
  const [isDragMode, setIsDragMode] = useState(false);

  const handleDragStart = useCallback((e, file) => {
    // Prevent dragging customer.json files
    if (file.name === 'customer.json') {
      e.preventDefault();
      return;
    }

    setDraggedFile(file);
    setIsDragMode(true);
    e.dataTransfer.effectAllowed = 'move';
  }, []);

  const handleDragEnd = useCallback(() => {
    setDraggedFile(null);
    setDropTargetFolder(null);
    setDropTargetBreadcrumb(null);
    setIsDragMode(false);
  }, []);

  const handleDragOver = useCallback((e, folder) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (folder) {
      setDropTargetFolder(folder.id);
    }
  }, []);

  const handleDragLeave = useCallback(() => {
    setDropTargetFolder(null);
  }, []);

  const handleDrop = useCallback(async (e, targetFolder) => {
    e.preventDefault();
    e.stopPropagation();

    if (!draggedFile || !targetFolder) {
      return;
    }

    try {
      await moveDocument(draggedFile, targetFolder.id);
    } finally {
      setDraggedFile(null);
      setDropTargetFolder(null);
      setDropTargetBreadcrumb(null);
      setIsDragMode(false);
    }
  }, [draggedFile, moveDocument]);

  const handleBreadcrumbDragOver = useCallback((e, index) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDropTargetBreadcrumb(index);
  }, []);

  const handleBreadcrumbDragLeave = useCallback(() => {
    setDropTargetBreadcrumb(null);
  }, []);

  const handleBreadcrumbDrop = useCallback(async (e, targetFolder) => {
    e.preventDefault();
    e.stopPropagation();

    if (!draggedFile || !targetFolder) {
      setDropTargetBreadcrumb(null);
      return;
    }

    try {
      await moveDocument(draggedFile, targetFolder.id);
    } finally {
      setDraggedFile(null);
      setDropTargetFolder(null);
      setDropTargetBreadcrumb(null);
      setIsDragMode(false);
    }
  }, [draggedFile, moveDocument]);

  return {
    draggedFile,
    dropTargetFolder,
    dropTargetBreadcrumb,
    isDragMode,
    handleDragStart,
    handleDragEnd,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    handleBreadcrumbDragOver,
    handleBreadcrumbDragLeave,
    handleBreadcrumbDrop,
  };
}

/**
 * Hook for mobile touch menu operations
 * Supports long-press to show action menu with Move, Delete, Rename options
 */
export function useTouchMenu() {
  const [showActionMenu, setShowActionMenu] = useState(false);
  const [showFolderMenu, setShowFolderMenu] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const longPressTimerRef = useRef(null);

  const handleTouchStart = useCallback((e, item) => {
    // Prevent actions on protected files
    if (item.name === 'customer.json') {
      return;
    }

    longPressTimerRef.current = setTimeout(() => {
      // Trigger haptic feedback if available
      if (navigator.vibrate) {
        navigator.vibrate(50);
      }
      setSelectedFile(item);
      setShowActionMenu(true);
    }, 500);
  }, []);

  const handleTouchMove = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  const closeActionMenu = useCallback(() => {
    setShowActionMenu(false);
    setSelectedFile(null);
  }, []);

  const closeAllMenus = useCallback(() => {
    setShowActionMenu(false);
    setShowFolderMenu(false);
    setSelectedFile(null);
  }, []);

  // Action handlers
  const handleMoveAction = useCallback(() => {
    setShowActionMenu(false);
    setShowFolderMenu(true);
  }, []);

  return {
    showActionMenu,
    showFolderMenu,
    selectedFile,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    closeActionMenu,
    closeAllMenus,
    handleMoveAction,
    setShowFolderMenu,
    setSelectedFile,
  };
}

export default useDocumentManager;
