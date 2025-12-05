import { memo, useCallback, useState } from 'react';
import { isFolder, isImage, getFileIcon } from '../../../utils/fileHelpers';
import { formatFileSize, formatDate } from '../../../utils/formatters';
import Modal from '../../Modal/Modal';

/**
 * DocumentsTab - Customer documents browser with drag-drop support
 */
function DocumentsTab({
  documents,
  loadingDocuments,
  currentFolderId,
  folderPath,
  isSignedIn,
  hasDriveFolder,
  // Document actions
  onLoadDocuments,
  onNavigateToBreadcrumb,
  onItemClick,
  onDeleteDocument,
  onMoveDocument,
  onRenameDocument,
  onOpenInDrive,
  // Drag and drop props
  draggedFile,
  dropTargetFolder,
  dropTargetBreadcrumb,
  isDragMode,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDragLeave,
  onDrop,
  onBreadcrumbDragOver,
  onBreadcrumbDragLeave,
  onBreadcrumbDrop,
  // Touch menu props
  onTouchStart,
  onTouchMove,
  onTouchEnd,
  // Mobile action menu props
  showActionMenu,
  showFolderMenu,
  selectedFile,
  onCloseActionMenu,
  onCloseAllMenus,
  onMoveAction,
}) {
  // Desktop context menu state
  const [openMenuId, setOpenMenuId] = useState(null);
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [renamingItem, setRenamingItem] = useState(null);
  const [renameValue, setRenameValue] = useState('');
  const [showMoveModal, setShowMoveModal] = useState(false);
  const [movingItem, setMovingItem] = useState(null);

  // Handle context menu toggle
  const handleMenuToggle = useCallback((e, item) => {
    e.stopPropagation();
    setOpenMenuId(openMenuId === item.id ? null : item.id);
  }, [openMenuId]);

  // Handle rename
  const handleRename = useCallback((item) => {
    setRenamingItem(item);
    setRenameValue(item.name);
    setShowRenameModal(true);
    setOpenMenuId(null);
  }, []);

  const handleRenameSubmit = useCallback(async () => {
    if (renamingItem && renameValue.trim()) {
      await onRenameDocument(renamingItem, renameValue.trim());
      setShowRenameModal(false);
      setRenamingItem(null);
      setRenameValue('');
    }
  }, [renamingItem, renameValue, onRenameDocument]);

  // Handle delete from menu
  const handleDelete = useCallback((item) => {
    setOpenMenuId(null);
    onDeleteDocument(item);
  }, [onDeleteDocument]);

  // Handle move from desktop menu
  const handleMove = useCallback((item) => {
    setMovingItem(item);
    setShowMoveModal(true);
    setOpenMenuId(null);
  }, []);

  // Handle folder selection for desktop move
  const handleDesktopFolderSelect = useCallback(async (targetFolder) => {
    if (movingItem && targetFolder) {
      await onMoveDocument(movingItem, targetFolder.id);
      setShowMoveModal(false);
      setMovingItem(null);
    }
  }, [movingItem, onMoveDocument]);

  // Get available folders for move (desktop)
  const getAvailableFoldersForMove = useCallback(() => {
    return documents.filter(
      (item) => isFolder(item.mimeType) && item.id !== movingItem?.id
    );
  }, [documents, movingItem]);

  // Mobile action menu handlers
  const handleMobileRename = useCallback(() => {
    if (selectedFile) {
      setRenamingItem(selectedFile);
      setRenameValue(selectedFile.name);
      setShowRenameModal(true);
      onCloseActionMenu?.();
    }
  }, [selectedFile, onCloseActionMenu]);

  const handleMobileDelete = useCallback(() => {
    if (selectedFile) {
      onCloseActionMenu?.();
      onDeleteDocument(selectedFile);
    }
  }, [selectedFile, onCloseActionMenu, onDeleteDocument]);

  const handleMobileMove = useCallback(() => {
    onMoveAction?.();
  }, [onMoveAction]);

  // Handle folder selection for move operation
  const handleFolderSelect = useCallback(async (targetFolder) => {
    if (selectedFile && targetFolder) {
      await onMoveDocument(selectedFile, targetFolder.id);
      onCloseAllMenus?.();
    }
  }, [selectedFile, onMoveDocument, onCloseAllMenus]);

  // Get available folders for move menu (exclude the file being moved)
  const availableFolders = documents.filter(
    (item) => isFolder(item.mimeType) && item.id !== selectedFile?.id
  );

  // Get parent folder for "move to parent" option
  const parentFolder = folderPath.length > 1 ? folderPath[folderPath.length - 2] : null;

  // Close menu when clicking outside
  const handleCloseMenu = useCallback(() => {
    setOpenMenuId(null);
  }, []);

  // Not signed in state
  if (!isSignedIn) {
    return (
      <div className="tab-content documents-tab">
        <div className="empty-state">
          <p>Please sign in to OneDrive to view customer documents</p>
        </div>
      </div>
    );
  }

  // No drive folder state
  if (!hasDriveFolder) {
    return (
      <div className="tab-content documents-tab">
        <div className="empty-state">
          <p>No OneDrive folder for this customer yet</p>
          <p className="empty-state-hint">A folder will be created when you save the customer.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="tab-content documents-tab" onClick={handleCloseMenu}>
      {/* Breadcrumb Navigation */}
      {folderPath.length > 0 && (
        <div className="breadcrumb-nav">
          <div className="breadcrumb-items">
            {folderPath.map((folder, index) => (
              <span
                key={folder.id}
                className={`breadcrumb-item ${index === folderPath.length - 1 ? 'active' : ''} ${dropTargetBreadcrumb === index ? 'drop-target' : ''}`}
                onClick={() => index < folderPath.length - 1 && onNavigateToBreadcrumb(index)}
                onDragOver={(e) => onBreadcrumbDragOver(e, index)}
                onDragLeave={onBreadcrumbDragLeave}
                onDrop={(e) => onBreadcrumbDrop(e, folder)}
              >
                {index > 0 && <span className="breadcrumb-separator">/</span>}
                {folder.name}
              </span>
            ))}
          </div>
          <div className="breadcrumb-actions">
            <button
              className="breadcrumb-refresh"
              onClick={() => onLoadDocuments(currentFolderId)}
              title="Refresh folder contents"
              disabled={loadingDocuments}
            >
              {loadingDocuments ? '⟳' : '🔄'}
            </button>
            <button
              className="breadcrumb-drive-link"
              onClick={onOpenInDrive}
              title="Open in OneDrive"
            >
              📁
            </button>
          </div>
        </div>
      )}

      {/* Loading State */}
      {loadingDocuments ? (
        <div className="loading-state">
          <div className="loading"></div>
          <p>Loading documents...</p>
        </div>
      ) : documents.length === 0 ? (
        <div className="empty-state">
          <p>No documents found</p>
          <p className="empty-state-hint">Documents you generate will appear here</p>
        </div>
      ) : (
        <div className="documents-list">
          {documents.map((item) => (
            <DocumentItem
              key={item.id}
              item={item}
              isMenuOpen={openMenuId === item.id}
              isDropTarget={dropTargetFolder === item.id}
              isDragging={draggedFile?.id === item.id}
              onItemClick={onItemClick}
              onMenuToggle={handleMenuToggle}
              onMove={handleMove}
              onRename={handleRename}
              onDelete={handleDelete}
              onDragStart={onDragStart}
              onDragEnd={onDragEnd}
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              onDrop={onDrop}
              onTouchStart={onTouchStart}
              onTouchMove={onTouchMove}
              onTouchEnd={onTouchEnd}
            />
          ))}

          {/* Trash Drop Zone (visible during drag) */}
          {isDragMode && (
            <div
              className="trash-drop-zone"
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
              }}
              onDrop={(e) => {
                e.preventDefault();
                if (draggedFile) {
                  onDeleteDocument(draggedFile);
                  onDragEnd();
                }
              }}
            >
              🗑️ Drop here to delete
            </div>
          )}
        </div>
      )}

      {/* Rename Modal */}
      <Modal
        isOpen={showRenameModal}
        onClose={() => {
          setShowRenameModal(false);
          setRenamingItem(null);
          setRenameValue('');
        }}
        title="Rename"
        size="small"
      >
        <div className="rename-modal">
          <input
            type="text"
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleRenameSubmit();
              if (e.key === 'Escape') setShowRenameModal(false);
            }}
          />
          <div className="modal-actions">
            <button
              className="btn btn-secondary"
              onClick={() => setShowRenameModal(false)}
            >
              Cancel
            </button>
            <button className="btn btn-primary" onClick={handleRenameSubmit}>
              Rename
            </button>
          </div>
        </div>
      </Modal>

      {/* Desktop Move Modal */}
      <Modal
        isOpen={showMoveModal}
        onClose={() => {
          setShowMoveModal(false);
          setMovingItem(null);
        }}
        title="Move File"
        size="small"
      >
        <div className="move-modal">
          {movingItem && (
            <>
              <p className="move-modal-filename">Move "{movingItem.name}" to:</p>
              <div className="move-modal-folders">
                {/* Parent folder option */}
                {folderPath.length > 1 && (
                  <button
                    className="move-modal-folder-btn"
                    onClick={() => handleDesktopFolderSelect(folderPath[folderPath.length - 2])}
                  >
                    <span className="folder-icon">⬆️</span>
                    <span>Parent folder</span>
                  </button>
                )}

                {/* Available folders */}
                {getAvailableFoldersForMove().map((folder) => (
                  <button
                    key={folder.id}
                    className="move-modal-folder-btn"
                    onClick={() => handleDesktopFolderSelect(folder)}
                  >
                    <span className="folder-icon">📁</span>
                    <span>{folder.name}</span>
                  </button>
                ))}

                {/* Empty state */}
                {folderPath.length <= 1 && getAvailableFoldersForMove().length === 0 && (
                  <p className="move-modal-empty">No folders available to move to</p>
                )}
              </div>
              <div className="modal-actions">
                <button
                  className="btn btn-secondary"
                  onClick={() => {
                    setShowMoveModal(false);
                    setMovingItem(null);
                  }}
                >
                  Cancel
                </button>
              </div>
            </>
          )}
        </div>
      </Modal>

      {/* Mobile Action Menu */}
      {showActionMenu && selectedFile && (
        <>
          <div className="mobile-action-backdrop" onClick={onCloseActionMenu} />
          <div className="mobile-action-menu">
            <div className="mobile-action-header">
              <span className="mobile-action-filename">{selectedFile.name}</span>
            </div>
            <div className="mobile-action-options">
              <button className="mobile-action-item" onClick={handleMobileMove}>
                <span className="mobile-action-icon">📁</span>
                <span>Move to folder</span>
              </button>
              <button className="mobile-action-item" onClick={handleMobileRename}>
                <span className="mobile-action-icon">✏️</span>
                <span>Rename</span>
              </button>
              <button className="mobile-action-item mobile-action-danger" onClick={handleMobileDelete}>
                <span className="mobile-action-icon">🗑️</span>
                <span>Delete</span>
              </button>
            </div>
            <button className="mobile-action-cancel" onClick={onCloseActionMenu}>
              Cancel
            </button>
          </div>
        </>
      )}

      {/* Mobile Folder Selection Menu */}
      {showFolderMenu && selectedFile && (
        <>
          <div className="folder-menu-backdrop" onClick={onCloseAllMenus} />
          <div className="folder-menu">
            <h3>Move "{selectedFile.name}" to...</h3>
            <div className="folder-menu-grid">
              {/* Parent folder option */}
              {parentFolder && (
                <button
                  className="folder-menu-item folder-menu-parent"
                  onClick={() => handleFolderSelect(parentFolder)}
                >
                  <span className="folder-menu-icon">⬆️</span>
                  <span className="folder-menu-name">Parent folder</span>
                </button>
              )}

              {/* Available folders in current directory */}
              {availableFolders.map((folder) => (
                <button
                  key={folder.id}
                  className="folder-menu-item"
                  onClick={() => handleFolderSelect(folder)}
                >
                  <span className="folder-menu-icon">📁</span>
                  <span className="folder-menu-name">{folder.name}</span>
                </button>
              ))}

              {/* Empty state if no folders available */}
              {!parentFolder && availableFolders.length === 0 && (
                <p className="folder-menu-empty">No folders available to move to</p>
              )}
            </div>
            <button className="mobile-action-cancel" onClick={onCloseAllMenus}>
              Cancel
            </button>
          </div>
        </>
      )}
    </div>
  );
}

/**
 * DocumentItem - Individual file/folder row
 */
const DocumentItem = memo(function DocumentItem({
  item,
  isMenuOpen,
  isDropTarget,
  isDragging,
  onItemClick,
  onMenuToggle,
  onMove,
  onRename,
  onDelete,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDragLeave,
  onDrop,
  onTouchStart,
  onTouchMove,
  onTouchEnd,
}) {
  const itemIsFolder = isFolder(item.mimeType);
  const itemIsImage = isImage(item.mimeType);
  const isProtected = item.name === 'customer.json';

  const handleClick = useCallback(() => {
    onItemClick(item);
  }, [item, onItemClick]);

  return (
    <div
      className={`document-item ${itemIsFolder ? 'folder' : 'file'} ${isDropTarget ? 'drop-target' : ''} ${isDragging ? 'dragging' : ''}`}
      draggable={!isProtected}
      onClick={handleClick}
      onDragStart={(e) => onDragStart(e, item)}
      onDragEnd={onDragEnd}
      onDragOver={(e) => itemIsFolder && onDragOver(e, item)}
      onDragLeave={onDragLeave}
      onDrop={(e) => itemIsFolder && onDrop(e, item)}
      onTouchStart={(e) => onTouchStart(e, item)}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      {/* Icon/Thumbnail */}
      <div className={`document-icon${itemIsImage && item.thumbnailLink ? ' has-thumbnail' : ''}`}>
        {itemIsImage && item.thumbnailLink ? (
          <img
            src={item.thumbnailLink}
            alt={item.name}
            className="thumbnail-image"
            loading="lazy"
            decoding="async"
          />
        ) : (
          <span className="icon">{getFileIcon(item.mimeType)}</span>
        )}
      </div>

      {/* Info */}
      <div className="document-info">
        <h4>{item.name}</h4>
        <p>
          {!itemIsFolder && formatFileSize(item.size)}
          {item.createdTime && ` • ${formatDate(item.createdTime)}`}
        </p>
      </div>

      {/* Actions Menu */}
      {!isProtected && (
        <div className="document-actions">
          <button
            className="menu-toggle"
            onClick={(e) => onMenuToggle(e, item)}
          >
            ⋮
          </button>

          {isMenuOpen && (
            <div className="context-menu" onClick={(e) => e.stopPropagation()}>
              <button onClick={() => onMove(item)}>Move</button>
              <button onClick={() => onRename(item)}>Rename</button>
              <button className="danger" onClick={() => onDelete(item)}>
                Delete
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
});

export default memo(DocumentsTab);
