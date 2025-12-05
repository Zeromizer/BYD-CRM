import { useState, useEffect } from 'react';
import Modal from '../../Modal/Modal';
import useDocumentStore from '../../../stores/useDocumentStore';
import useAuthStore from '../../../stores/useAuthStore';
import documentRenderer from '../../../services/documentRenderer';
import pdfGenerator from '../../../services/pdfGenerator';
import { getCustomerDataMapping } from '../../../services/fieldMapper';
import { getStorageService } from '../../../services/storageServiceSelector';
import ImageSelector from '../ImageSelector/ImageSelector';
import { useToast } from '../../Toast/Toast';
import './PrintManager.css';

/**
 * PrintManager - Print documents with customer data
 *
 * Features:
 * - Single or multi-page document printing
 * - Double-sided printing with back page images (4 quarters)
 * - PDF generation with perfect quality
 * - Preview before printing
 * - Save to OneDrive
 * - Download as PDF
 */
function PrintManager({ isOpen, onClose, customer }) {
  const { templates, loadFromLocalStorage } = useDocumentStore();
  const { isSignedIn } = useAuthStore();
  const toast = useToast();

  const [selectedTemplateIds, setSelectedTemplateIds] = useState([]);
  const [doubleSidedTemplates, setDoubleSidedTemplates] = useState({}); // templateId -> { enabled, images: [] }
  const [step, setStep] = useState('select'); // 'select' | 'images' | 'preview' | 'processing'
  const [renders, setRenders] = useState([]);
  const [pdf, setPdf] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (isOpen) {
      loadFromLocalStorage();
      setSelectedTemplateIds([]);
      setDoubleSidedTemplates({});
      setStep('select');
      setRenders([]);
      setPdf(null);
      setError(null);
    } else {
      // Clear image cache when modal closes to free memory
      documentRenderer.clearImageCache();
    }
  }, [isOpen, loadFromLocalStorage]);

  // Get all templates, sorted alphabetically/numerically
  const templateArray = Object.values(templates).sort((a, b) => {
    return (a.name || '').localeCompare(b.name || '', undefined, {
      numeric: true,
      sensitivity: 'base'
    });
  });

  // Helper to parse template name for multi-page grouping
  // Matches patterns like "Document Name (1 of 2)", "Form (2 of 3)", etc.
  const parseTemplateName = (name) => {
    const match = name.match(/^(.+?)\s*\((\d+)\s+of\s+(\d+)\)$/i);
    if (match) {
      return {
        baseName: match[1].trim(),
        pageNum: parseInt(match[2]),
        totalPages: parseInt(match[3]),
        isMultiPage: true
      };
    }
    return {
      baseName: name,
      pageNum: 1,
      totalPages: 1,
      isMultiPage: false
    };
  };

  // Group templates by base name
  const groupedTemplates = templateArray.reduce((groups, template) => {
    const parsed = parseTemplateName(template.name);
    const key = parsed.baseName;

    if (!groups[key]) {
      groups[key] = {
        baseName: parsed.baseName,
        templates: [],
        totalPages: parsed.totalPages,
        isMultiPage: parsed.isMultiPage
      };
    }

    groups[key].templates.push({
      ...template,
      pageNum: parsed.pageNum
    });

    // Sort templates within group by page number
    groups[key].templates.sort((a, b) => a.pageNum - b.pageNum);

    return groups;
  }, {});

  // Convert to array and sort by base name
  const templateGroups = Object.values(groupedTemplates).sort((a, b) => {
    return a.baseName.localeCompare(b.baseName, undefined, {
      numeric: true,
      sensitivity: 'base'
    });
  });

  // Check if a group is fully selected
  const isGroupSelected = (group) => {
    return group.templates.every(t => selectedTemplateIds.includes(t.id));
  };

  // Check if a group is partially selected
  const isGroupPartiallySelected = (group) => {
    const selectedCount = group.templates.filter(t => selectedTemplateIds.includes(t.id)).length;
    return selectedCount > 0 && selectedCount < group.templates.length;
  };

  // Toggle entire group selection
  const handleGroupToggle = (group) => {
    const allIds = group.templates.map(t => t.id);
    const allSelected = isGroupSelected(group);

    if (allSelected) {
      // Deselect all in group
      setSelectedTemplateIds(prev => prev.filter(id => !allIds.includes(id)));
      // Remove from double-sided config
      const newDoubleSided = { ...doubleSidedTemplates };
      allIds.forEach(id => delete newDoubleSided[id]);
      setDoubleSidedTemplates(newDoubleSided);
    } else {
      // Select all in group (add missing ones)
      setSelectedTemplateIds(prev => {
        const newSelection = [...prev];
        allIds.forEach(id => {
          if (!newSelection.includes(id)) {
            newSelection.push(id);
          }
        });
        return newSelection;
      });
      // OPTIMIZED: Prefetch all template images in group in background
      const fileIds = group.templates.map(t => t.fileId).filter(Boolean);
      if (fileIds.length > 0) {
        documentRenderer.prefetchImages(fileIds).catch(() => {
          // Silently ignore prefetch errors
        });
      }
    }
  };

  // Toggle double-sided for entire group
  const handleGroupDoubleSided = (group) => {
    const allIds = group.templates.map(t => t.id);
    // Check if any in group has double-sided enabled
    const anyDoubleSided = allIds.some(id => doubleSidedTemplates[id]?.enabled);

    const newDoubleSided = { ...doubleSidedTemplates };
    allIds.forEach(id => {
      newDoubleSided[id] = {
        enabled: !anyDoubleSided,
        images: newDoubleSided[id]?.images || []
      };
    });
    setDoubleSidedTemplates(newDoubleSided);
  };

  // Check if any template in group has double-sided enabled
  const isGroupDoubleSided = (group) => {
    return group.templates.some(t => doubleSidedTemplates[t.id]?.enabled);
  };

  const handleTemplateToggle = (templateId) => {
    if (selectedTemplateIds.includes(templateId)) {
      setSelectedTemplateIds(selectedTemplateIds.filter((id) => id !== templateId));
      // Remove from double-sided config when deselected
      const newDoubleSided = { ...doubleSidedTemplates };
      delete newDoubleSided[templateId];
      setDoubleSidedTemplates(newDoubleSided);
    } else {
      setSelectedTemplateIds([...selectedTemplateIds, templateId]);
      // OPTIMIZED: Prefetch template image in background while user continues selecting
      const template = templates[templateId];
      if (template?.fileId) {
        documentRenderer.prefetchImages([template.fileId]).catch(() => {
          // Silently ignore prefetch errors - will be handled during actual render
        });
      }
    }
  };

  const handleToggleDoubleSided = (templateId) => {
    setDoubleSidedTemplates(prev => ({
      ...prev,
      [templateId]: {
        enabled: !prev[templateId]?.enabled,
        images: prev[templateId]?.images || []
      }
    }));
  };

  const handleImagesSelected = (templateId, images) => {
    setDoubleSidedTemplates(prev => ({
      ...prev,
      [templateId]: {
        ...prev[templateId],
        images: images.map(img => img.id) // Store only file IDs
      }
    }));
  };

  const hasDoubleSidedTemplates = () => {
    return selectedTemplateIds.some(id => doubleSidedTemplates[id]?.enabled);
  };

  const needsImageSelection = () => {
    return selectedTemplateIds.some(id => {
      const ds = doubleSidedTemplates[id];
      return ds?.enabled && (!ds.images || ds.images.length === 0);
    });
  };

  const handleProceedToImages = () => {
    if (!customer.driveFolderId) {
      toast.warning('Customer does not have a OneDrive folder. Cannot select images.');
      return;
    }

    if (!hasDoubleSidedTemplates()) {
      // Skip image selection if no double-sided templates
      handleGeneratePreview();
      return;
    }

    setStep('images');
  };

  const handleGeneratePreview = async () => {
    if (selectedTemplateIds.length === 0) {
      toast.warning('Please select at least one document template');
      return;
    }

    if (!isSignedIn) {
      toast.warning('Please sign in to OneDrive to access templates');
      return;
    }

    setStep('processing');
    setError(null);

    try {
      // Get customer data mapping
      const customerData = getCustomerDataMapping(customer);

      // OPTIMIZED: Build template configs for parallel rendering
      const templateConfigs = selectedTemplateIds.map(templateId => ({
        template: templates[templateId],
        doubleSidedConfig: doubleSidedTemplates[templateId]
      }));

      // OPTIMIZED: Render all pages in parallel (images prefetched, templates rendered concurrently)
      const allRenders = await documentRenderer.renderDocumentsWithBackPages(
        templateConfigs,
        customerData
      );

      setRenders(allRenders);

      // Generate PDF
      const generatedPdf = await pdfGenerator.generatePDFFromRenders(allRenders, {
        title: `${customer.name} - Documents`,
        filename: `${customer.name}_documents.pdf`,
      });

      setPdf(generatedPdf);
      setStep('preview');
    } catch (err) {
      console.error('Error generating preview:', err);
      setError(err.message);
      setStep('select');
    }
  };

  const handlePrint = () => {
    if (!pdf) return;

    pdfGenerator.openPDFInPrintWindow(pdf, `${customer.name} - Documents`);
  };

  const handleSaveAndPrint = async () => {
    if (!pdf) return;

    // First save to drive
    await handleSaveToDrive();

    // Then print (handleSaveToDrive sets step back to 'preview' on success)
    pdfGenerator.openPDFInPrintWindow(pdf, `${customer.name} - Documents`);
  };

  const handleDownload = () => {
    if (!pdf) return;

    // Generate filename based on selected template(s)
    let filenamePart;
    if (selectedTemplateIds.length === 1) {
      // Single template - use template name
      const template = templates[selectedTemplateIds[0]];
      filenamePart = template.name.replace(/\s+/g, '_');
    } else {
      // Multiple templates - use descriptive name
      filenamePart = 'Multiple_Documents';
    }

    const filename = `${customer.name.replace(/\s+/g, '_')}_${filenamePart}_${new Date().toISOString().split('T')[0]}.pdf`;
    pdfGenerator.downloadPDF(pdf, filename);
  };

  const handleSaveToDrive = async () => {
    if (!pdf) return;

    try {
      setStep('processing');
      console.log('📁 Getting/creating customer folder for PDF save...');

      // Check if customer already has a folder ID stored
      let customerFolderId = customer.driveFolderId;

      // If customer has a folder ID, verify it still exists using OneDrive service
      if (customerFolderId) {
        console.log('🔍 Verifying existing folder ID:', customerFolderId);
        const folderExists = await getStorageService().validateFolderId(customerFolderId);
        if (folderExists) {
          console.log('✅ Customer folder exists:', customerFolderId);
        } else {
          console.warn('⚠️ Stored folder ID no longer exists, will search/create');
          customerFolderId = null;
        }
      }

      // If no valid folder ID, search for existing folder or create new one
      if (!customerFolderId) {
        console.log('🔍 Searching for existing customer folder...');
        try {
          const existingFolder = await getStorageService().findCustomerFolderByName(customer.name);
          if (existingFolder) {
            console.log('✅ Found existing customer folder:', existingFolder.folderId);
            customerFolderId = existingFolder.folderId;

            // Update customer record with found folder ID
            // Note: This is done in the customer store, not here
          } else {
            // Create new folder structure
            console.log('🆕 Creating new customer folder structure...');
            const folderInfo = await getStorageService().createCustomerFolderStructure(customer.name, customer.id);
            console.log('✅ Customer folder created:', folderInfo.folderId);
            customerFolderId = folderInfo.folderId;
          }
        } catch (searchError) {
          console.error('❌ Error with folder operations:', searchError);
          throw searchError;
        }
      }

      // Generate filename based on selected template(s)
      let filenamePart;
      if (selectedTemplateIds.length === 1) {
        // Single template - use template name
        const template = templates[selectedTemplateIds[0]];
        filenamePart = template.name.replace(/\s+/g, '_');
      } else {
        // Multiple templates - use descriptive name
        filenamePart = 'Multiple_Documents';
      }

      const filename = `${customer.name.replace(/\s+/g, '_')}_${filenamePart}_${new Date().toISOString().split('T')[0]}.pdf`;
      console.log('📄 Generated filename:', filename);

      // Get PDF blob
      const blob = pdfGenerator.getPDFBlob(pdf);
      console.log('📊 PDF blob size:', blob.size);

      // Upload to customer's main folder
      console.log('📤 Uploading PDF to Drive...');
      await getStorageService().uploadFile(filename, blob, customerFolderId);
      console.log('✅ PDF uploaded successfully');

      toast.success(`PDF saved to OneDrive: ${customer.name}`);
      onClose();
    } catch (err) {
      console.error('❌ Error saving to Drive:', err);
      toast.error('Failed to save to Drive: ' + err.message);
      setStep('preview');
    }
  };

  const handleBackToSelection = () => {
    setStep('select');
    setRenders([]);
    setPdf(null);
  };

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Print Documents"
      size={step === 'preview' ? 'large' : 'medium'}
    >
      <div className="print-manager">
        {/* Customer Info */}
        <div className="print-customer-info">
          <h3>Customer: {customer.name}</h3>
          {customer.phone && <p>Phone: {customer.phone}</p>}
          {customer.nric && <p>NRIC: {customer.nric}</p>}
        </div>

        {!isSignedIn && (
          <div className="warning-banner">
            ⚠️ Please sign in to OneDrive to access document templates
          </div>
        )}

        {error && (
          <div className="error-banner">
            ❌ Error: {error}
          </div>
        )}

        {/* Step 1: Select Templates */}
        {step === 'select' && (
          <div className="print-select-step">
            <h4>Select Document Templates to Print</h4>

            {templateGroups.length === 0 ? (
              <div className="empty-state">
                <p>No document templates available</p>
                <p className="empty-state-hint">
                  Create and configure document templates in Document Manager first
                </p>
              </div>
            ) : (
              <div className="template-selection-grid">
                {templateGroups.map((group) => {
                  const isSelected = isGroupSelected(group);
                  const isPartial = isGroupPartiallySelected(group);
                  const isDoubleSided = isGroupDoubleSided(group);
                  const totalFields = group.templates.reduce((sum, t) =>
                    sum + Object.keys(t.fields || {}).length, 0
                  );
                  const category = group.templates[0]?.category || 'uncategorized';

                  return (
                    <div
                      key={group.baseName}
                      className={`template-card ${isSelected ? 'selected' : ''} ${isPartial ? 'partial' : ''}`}
                    >
                      <div
                        className="template-card-header"
                        onClick={() => handleGroupToggle(group)}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          ref={el => {
                            if (el) el.indeterminate = isPartial;
                          }}
                          onChange={() => {}}
                          onClick={(e) => e.stopPropagation()}
                        />
                        <h4>{group.baseName}</h4>
                      </div>
                      <div className="template-card-body">
                        <div className="template-meta">
                          <span className="meta-badge">{category}</span>
                          {group.templates.length > 1 && (
                            <span className="meta-badge meta-badge-pages">
                              {group.templates.length} pages
                            </span>
                          )}
                          {totalFields > 0 ? (
                            <span className="meta-badge">
                              {totalFields} fields
                            </span>
                          ) : (
                            <span className="meta-badge meta-badge-warning">
                              No fields configured
                            </span>
                          )}
                        </div>

                        {isSelected && (
                          <div className="template-options">
                            <label className="double-sided-option">
                              <input
                                type="checkbox"
                                checked={isDoubleSided}
                                onChange={() => handleGroupDoubleSided(group)}
                              />
                              <span>Double-sided (add 4 ID images on back)</span>
                            </label>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {selectedTemplateIds.length > 0 && (
              <div className="selection-summary">
                <p>
                  <strong>{templateGroups.filter(g => isGroupSelected(g)).length}</strong> document
                  {templateGroups.filter(g => isGroupSelected(g)).length > 1 ? 's' : ''} selected
                  <span className="multi-page-note">
                    {' '}({selectedTemplateIds.length} page{selectedTemplateIds.length > 1 ? 's' : ''} total)
                  </span>
                </p>
              </div>
            )}
          </div>
        )}

        {/* Step 2: Image Selection (for double-sided templates) */}
        {step === 'images' && (
          <div className="print-images-step">
            <h4>Select Customer ID Images for Back Pages</h4>
            <p className="step-hint">
              Choose up to 4 images from the customer's folder for each double-sided form
            </p>

            {selectedTemplateIds
              .filter(id => doubleSidedTemplates[id]?.enabled)
              .map(templateId => {
                const template = templates[templateId];
                const currentImages = doubleSidedTemplates[templateId]?.images || [];

                return (
                  <div key={templateId} className="image-selection-section">
                    <h5>{template.name} - Back Page</h5>
                    <ImageSelector
                      customerFolderId={customer.driveFolderId}
                      selectedImages={currentImages.map(id => ({ id }))}
                      onSelectionChange={(images) => handleImagesSelected(templateId, images)}
                      maxImages={4}
                    />
                  </div>
                );
              })}
          </div>
        )}

        {/* Step 3: Processing */}
        {step === 'processing' && (
          <div className="print-processing-step">
            <div className="loading-spinner"></div>
            <p>Generating your documents...</p>
            <p className="processing-hint">This may take a few moments</p>
          </div>
        )}

        {/* Step 4: Preview */}
        {step === 'preview' && renders.length > 0 && (
          <div className="print-preview-step">
            <div className="preview-header">
              <h4>Document Preview ({renders.length} page{renders.length > 1 ? 's' : ''})</h4>
              <button
                className="btn btn-small btn-secondary"
                onClick={handleBackToSelection}
              >
                ← Change Selection
              </button>
            </div>

            <div className="preview-pages">
              {renders.map((render, index) => (
                <div key={index} className="preview-page">
                  <div className="preview-page-label">
                    Page {index + 1} - {render.templateName}
                    {render.pageType && (
                      <span className={`page-type-badge ${render.pageType}`}>
                        {render.pageType === 'front' ? '(Front)' : '(Back - ID Images)'}
                      </span>
                    )}
                  </div>
                  <img
                    src={render.dataUrl}
                    alt={`Page ${index + 1}`}
                    className="preview-image"
                  />
                </div>
              ))}
            </div>

            {pdf && (
              <div className="pdf-info">
                <p>
                  📄 PDF generated: {renders.length} page{renders.length > 1 ? 's' : ''},{' '}
                  {pdfGenerator.formatFileSize(pdfGenerator.getPDFSize(pdf))}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Footer Actions */}
        <div className="print-manager-footer">
          {step === 'select' && (
            <>
              <button
                className="btn btn-secondary"
                onClick={onClose}
                disabled={false}
              >
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={handleProceedToImages}
                disabled={selectedTemplateIds.length === 0 || !isSignedIn}
              >
                {hasDoubleSidedTemplates() ? 'Next: Select Images →' : 'Generate Preview'}
              </button>
            </>
          )}

          {step === 'images' && (
            <>
              <button
                className="btn btn-secondary"
                onClick={() => setStep('select')}
              >
                ← Back
              </button>
              <button
                className="btn btn-primary"
                onClick={handleGeneratePreview}
                disabled={needsImageSelection()}
              >
                Generate Preview
              </button>
            </>
          )}

          {step === 'preview' && (
            <>
              <button className="btn btn-secondary" onClick={onClose}>
                Close
              </button>
              <button className="btn btn-success" onClick={handleSaveToDrive}>
                💾 Save
              </button>
              <button className="btn btn-info" onClick={handleDownload}>
                ⬇️ Download
              </button>
              <button className="btn btn-primary" onClick={handlePrint}>
                🖨️ Print
              </button>
              <button className="btn btn-save-print" onClick={handleSaveAndPrint}>
                💾🖨️ Save & Print
              </button>
            </>
          )}
        </div>
      </div>
    </Modal>
  );
}

export default PrintManager;
