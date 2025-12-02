import { useState, useCallback, useRef } from 'react';
import { getStorageService } from '../../../services/storageServiceSelector';
import { isFolder } from '../../../utils/fileHelpers';

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

  // Load documents from a folder
  const loadDocuments = useCallback(async (folderId) => {
    if (!folderId || !isSignedIn) {
      setDocuments([]);
      return;
    }

    setLoadingDocuments(true);

    try {
      const items = await getStorageService().listFolder(folderId);
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

      setDocuments(allFiles);
    } catch (error) {
      console.error('Error loading documents:', error);
      setDocuments([]);
    } finally {
      setLoadingDocuments(false);
    }
  }, [isSignedIn]);

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

  // Delete a document
  const deleteDocument = useCallback(async (doc) => {
    const confirmDelete = window.confirm(
      `Are you sure you want to delete "${doc.name}"?\n\nThis will permanently delete the file from cloud storage.`
    );

    if (!confirmDelete) return false;

    try {
      await getStorageService().deleteFile(doc.id);
      await loadDocuments(currentFolderId);
      toast?.success('Document deleted successfully');
      return true;
    } catch (error) {
      console.error('Error deleting document:', error);
      toast?.error('Failed to delete document. Please try again.');
      return false;
    }
  }, [currentFolderId, loadDocuments, toast]);

  // Move a document to another folder
  const moveDocument = useCallback(async (file, targetFolderId) => {
    try {
      await getStorageService().moveFile(file.id, targetFolderId);
      await loadDocuments(currentFolderId);
      return true;
    } catch (error) {
      toast?.error(`Failed to move file: ${error.message}`);
      return false;
    }
  }, [currentFolderId, loadDocuments, toast]);

  // Rename a document
  const renameDocument = useCallback(async (doc, newName) => {
    try {
      await getStorageService().renameFile(doc.id, newName);
      await loadDocuments(currentFolderId);
      return true;
    } catch (error) {
      toast?.error(`Failed to rename: ${error.message}`);
      return false;
    }
  }, [currentFolderId, loadDocuments, toast]);

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

  // Refresh current folder
  const refresh = useCallback(() => {
    if (currentFolderId) {
      loadDocuments(currentFolderId);
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
