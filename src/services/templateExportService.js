import JSZip from 'jszip';
import { getStorageService, getAuthService } from './storageServiceSelector';

/**
 * Template Export/Import Service
 * Handles exporting and importing of Document and Excel templates
 * Supports exporting with master files (ZIP) for seamless sharing
 * Works with both Google Drive and OneDrive via storageServiceSelector
 */

class TemplateExportService {
  /**
   * Download file from cloud storage (Google Drive or OneDrive)
   */
  async downloadFileFromDrive(fileId) {
    try {
      const storageService = getStorageService();
      const blob = await storageService.downloadFileAsBlob(fileId);
      return blob;
    } catch (error) {
      console.error('Error downloading file from Drive:', error);
      throw error;
    }
  }

  /**
   * Upload file to cloud storage (Google Drive or OneDrive)
   */
  async uploadFileToDrive(file, folderId) {
    try {
      const storageService = getStorageService();
      const result = await storageService.uploadFile(folderId, file.name, file, file.type);
      return result.id;
    } catch (error) {
      console.error('Error uploading file to Drive:', error);
      throw error;
    }
  }

  /**
   * Get or create Excel templates folder in cloud storage
   */
  async getOrCreateExcelTemplatesFolder() {
    try {
      const storageService = getStorageService();
      const folder = await storageService.getOrCreateExcelTemplatesFolder();
      return folder.id;
    } catch (error) {
      console.error('Error getting/creating Excel templates folder:', error);
      return null;
    }
  }

  /**
   * Export all document templates to JSON
   */
  exportDocumentTemplates(templates) {
    const exportData = {
      version: '1.0',
      exportDate: new Date().toISOString(),
      type: 'document_templates',
      templates: Object.values(templates).map(template => ({
        id: template.id,
        name: template.name,
        category: template.category,
        fields: template.fields,
        canvasData: template.canvasData,
        width: template.width,
        height: template.height,
        fileId: template.fileId,
        fileName: template.fileName,
        dpi: template.dpi,
        createdAt: template.createdAt,
        updatedAt: template.updatedAt,
      }))
    };

    return exportData;
  }

  /**
   * Export all Excel templates to JSON
   */
  exportExcelTemplates(templates) {
    const exportData = {
      version: '1.0',
      exportDate: new Date().toISOString(),
      type: 'excel_templates',
      templates: Object.values(templates).map(template => ({
        id: template.id,
        name: template.name,
        fieldMappings: template.fieldMappings,
        hasMasterFile: !!(template.driveFileId && template.driveFileName),
        masterFileName: template.driveFileName || null,
        driveFileId: template.driveFileId || null,
        createdAt: template.createdAt,
        updatedAt: template.updatedAt,
      }))
    };

    return exportData;
  }

  /**
   * Export all templates (both document and Excel)
   */
  exportAllTemplates(documentTemplates, excelTemplates) {
    const exportData = {
      version: '1.0',
      exportDate: new Date().toISOString(),
      type: 'all_templates',
      documentTemplates: Object.values(documentTemplates).map(template => ({
        id: template.id,
        name: template.name,
        category: template.category,
        fields: template.fields,
        canvasData: template.canvasData,
        width: template.width,
        height: template.height,
        fileId: template.fileId,
        fileName: template.fileName,
        dpi: template.dpi,
        createdAt: template.createdAt,
        updatedAt: template.updatedAt,
      })),
      excelTemplates: Object.values(excelTemplates).map(template => ({
        id: template.id,
        name: template.name,
        fieldMappings: template.fieldMappings,
        hasMasterFile: !!(template.driveFileId && template.driveFileName),
        masterFileName: template.driveFileName || null,
        driveFileId: template.driveFileId || null,
        createdAt: template.createdAt,
        updatedAt: template.updatedAt,
      }))
    };

    return exportData;
  }

  /**
   * Export templates with master files as ZIP
   * Downloads master files from cloud storage and packages them
   */
  async exportWithMasterFiles(documentTemplates, excelTemplates, type = 'all', onProgress = null) {
    const zip = new JSZip();
    const timestamp = new Date().toISOString().split('T')[0];
    let masterFilesIncluded = 0;
    let totalFiles = 0;
    let processedFiles = 0;

    // Calculate total files for progress
    if (type === 'all' || type === 'excel') {
      totalFiles += Object.values(excelTemplates).filter(t => t.driveFileId).length;
    }
    if (type === 'all' || type === 'documents') {
      totalFiles += Object.values(documentTemplates).filter(t => t.fileId).length;
    }

    // Create manifest with all template configurations
    let exportData;
    let filename;

    switch (type) {
      case 'documents':
        exportData = this.exportDocumentTemplates(documentTemplates);
        filename = `document-templates-${timestamp}`;
        break;
      case 'excel':
        exportData = this.exportExcelTemplates(excelTemplates);
        filename = `excel-templates-${timestamp}`;
        break;
      case 'all':
      default:
        exportData = this.exportAllTemplates(documentTemplates, excelTemplates);
        filename = `all-templates-${timestamp}`;
        break;
    }

    // Add manifest JSON
    zip.file('manifest.json', JSON.stringify(exportData, null, 2));

    // Create folders for master files
    const excelFilesFolder = zip.folder('excel_master_files');
    const documentFilesFolder = zip.folder('document_background_files');

    // Download and add Excel master files
    if (type === 'all' || type === 'excel') {
      for (const template of Object.values(excelTemplates)) {
        if (template.driveFileId && template.driveFileName) {
          try {
            if (onProgress) {
              onProgress({
                type: 'downloading',
                templateName: template.name,
                fileType: 'excel',
                current: processedFiles + 1,
                total: totalFiles
              });
            }

            const blob = await this.downloadFileFromDrive(template.driveFileId);
            // Use double underscore as separator to avoid conflicts with template IDs that contain single underscores
            const safeFileName = `${template.id}__${template.driveFileName}`;
            excelFilesFolder.file(safeFileName, blob);
            masterFilesIncluded++;
          } catch (error) {
            console.error(`Failed to download master file for ${template.name}:`, error);
          }
          processedFiles++;
        }
      }
    }

    // Download and add Document background files
    if (type === 'all' || type === 'documents') {
      for (const template of Object.values(documentTemplates)) {
        if (template.fileId && template.fileName) {
          try {
            if (onProgress) {
              onProgress({
                type: 'downloading',
                templateName: template.name,
                fileType: 'document',
                current: processedFiles + 1,
                total: totalFiles
              });
            }

            const blob = await this.downloadFileFromDrive(template.fileId);
            // Use double underscore as separator to avoid conflicts with template IDs that contain single underscores
            const safeFileName = `${template.id}__${template.fileName}`;
            documentFilesFolder.file(safeFileName, blob);
            masterFilesIncluded++;
          } catch (error) {
            console.error(`Failed to download background file for ${template.name}:`, error);
          }
          processedFiles++;
        }
      }
    }

    if (onProgress) {
      onProgress({ type: 'creating_zip' });
    }

    // Generate and download ZIP
    const zipBlob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(zipBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${filename}.zip`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    return {
      success: true,
      filename: `${filename}.zip`,
      documentCount: type === 'excel' ? 0 : Object.keys(documentTemplates).length,
      excelCount: type === 'documents' ? 0 : Object.keys(excelTemplates).length,
      masterFilesIncluded,
      isZip: true
    };
  }

  /**
   * Download export data as JSON file
   */
  downloadAsJSON(data, filename) {
    const jsonString = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /**
   * Parse imported file (JSON or ZIP)
   */
  async parseImportFile(file) {
    if (file.name.endsWith('.zip')) {
      return this.parseZipFile(file);
    }

    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = (e) => {
        try {
          const data = JSON.parse(e.target.result);
          resolve(data);
        } catch {
          reject(new Error('Invalid JSON file'));
        }
      };

      reader.onerror = () => {
        reject(new Error('Failed to read file'));
      };

      reader.readAsText(file);
    });
  }

  /**
   * Parse ZIP file containing templates and master files
   */
  async parseZipFile(file) {
    const zip = new JSZip();
    const zipContent = await zip.loadAsync(file);

    // Look for manifest.json (new format) or individual config files (legacy format)
    let manifest = null;
    const masterFiles = {
      excel: {},      // templateId -> blob
      document: {}    // templateId -> blob
    };

    // Try to read manifest.json first
    if (zipContent.files['manifest.json']) {
      const manifestContent = await zipContent.files['manifest.json'].async('text');
      manifest = JSON.parse(manifestContent);
    }

    // Extract Excel master files
    const excelFolder = zipContent.folder('excel_master_files');
    if (excelFolder) {
      const excelFiles = Object.keys(zipContent.files).filter(
        f => f.startsWith('excel_master_files/') && !zipContent.files[f].dir
      );

      for (const filepath of excelFiles) {
        const filename = filepath.replace('excel_master_files/', '');
        // Extract template ID from filename (format: templateId__originalFileName)
        // Use double underscore as separator since template IDs contain single underscores
        const separatorIndex = filename.indexOf('__');
        if (separatorIndex > 0) {
          const templateId = filename.substring(0, separatorIndex);
          const blob = await zipContent.files[filepath].async('blob');
          masterFiles.excel[templateId] = {
            blob,
            filename: filename.substring(separatorIndex + 2)
          };
        }
      }
    }

    // Extract Document background files
    const docFolder = zipContent.folder('document_background_files');
    if (docFolder) {
      const docFiles = Object.keys(zipContent.files).filter(
        f => f.startsWith('document_background_files/') && !zipContent.files[f].dir
      );

      for (const filepath of docFiles) {
        const filename = filepath.replace('document_background_files/', '');
        // Extract template ID from filename (format: templateId__originalFileName)
        // Use double underscore as separator since template IDs contain single underscores
        const separatorIndex = filename.indexOf('__');
        if (separatorIndex > 0) {
          const templateId = filename.substring(0, separatorIndex);
          const blob = await zipContent.files[filepath].async('blob');
          masterFiles.document[templateId] = {
            blob,
            filename: filename.substring(separatorIndex + 2)
          };
        }
      }
    }

    // If no manifest, try legacy format (individual config files)
    if (!manifest) {
      const jsonFiles = Object.keys(zipContent.files).filter(
        f => f.endsWith('.json') && !f.includes('/') && !zipContent.files[f].dir
      );

      if (jsonFiles.length > 0) {
        // Try to parse the first JSON as manifest
        const firstJson = await zipContent.files[jsonFiles[0]].async('text');
        manifest = JSON.parse(firstJson);
      }
    }

    if (!manifest) {
      throw new Error('No valid template manifest found in ZIP file');
    }

    // Attach master file blobs to manifest
    manifest._masterFiles = masterFiles;
    manifest._isZipImport = true;

    return manifest;
  }

  /**
   * Validate import data
   */
  validateImportData(data) {
    if (!data.version || !data.type) {
      throw new Error('Invalid template file: Missing version or type');
    }

    if (!['document_templates', 'excel_templates', 'all_templates'].includes(data.type)) {
      throw new Error('Invalid template file: Unknown type');
    }

    return true;
  }

  /**
   * Import document templates
   */
  importDocumentTemplates(data, existingTemplates) {
    if (data.type === 'document_templates') {
      return this._mergeTemplates(data.templates, existingTemplates, 'document', data._masterFiles);
    } else if (data.type === 'all_templates') {
      return this._mergeTemplates(data.documentTemplates, existingTemplates, 'document', data._masterFiles);
    }
    throw new Error('No document templates found in import file');
  }

  /**
   * Import Excel templates
   */
  importExcelTemplates(data, existingTemplates) {
    if (data.type === 'excel_templates') {
      return this._mergeTemplates(data.templates, existingTemplates, 'excel', data._masterFiles);
    } else if (data.type === 'all_templates') {
      return this._mergeTemplates(data.excelTemplates, existingTemplates, 'excel', data._masterFiles);
    }
    throw new Error('No Excel templates found in import file');
  }

  /**
   * Merge imported templates with existing ones
   * Handles conflicts by renaming duplicates
   */
  _mergeTemplates(importedTemplates, existingTemplates, templateType = 'excel', masterFiles = null) {
    const existingNames = Object.values(existingTemplates).map(t => t.name);
    const merged = { ...existingTemplates };
    const imported = [];

    for (const template of importedTemplates) {
      // Check if template name already exists
      let finalName = template.name;
      let counter = 1;

      while (existingNames.includes(finalName)) {
        finalName = `${template.name} (${counter})`;
        counter++;
      }

      // Add to existing names to prevent duplicate renaming
      existingNames.push(finalName);

      // Generate new ID to avoid conflicts
      const newId = this._generateId();
      const newTemplate = {
        ...template,
        id: newId,
        name: finalName,
        importedAt: new Date().toISOString(),
        _originalId: template.id, // Keep original ID for master file matching
      };

      // For Excel templates
      if (templateType === 'excel') {
        newTemplate.driveFileId = undefined;
        newTemplate.driveFileName = template.masterFileName || template.driveFileName;

        // Check if we have a master file blob for this template
        if (masterFiles && masterFiles.excel && masterFiles.excel[template.id]) {
          newTemplate._masterFileBlob = masterFiles.excel[template.id].blob;
          newTemplate._masterFileName = masterFiles.excel[template.id].filename;
        }
      }

      // For Document templates
      if (templateType === 'document') {
        newTemplate.fileId = undefined;

        // Check if we have a background file blob for this template
        if (masterFiles && masterFiles.document && masterFiles.document[template.id]) {
          newTemplate._backgroundFileBlob = masterFiles.document[template.id].blob;
          newTemplate._backgroundFileName = masterFiles.document[template.id].filename;
        }
      }

      merged[newId] = newTemplate;
      imported.push({
        originalName: template.name,
        newName: finalName,
        renamed: finalName !== template.name,
        hasMasterFile: templateType === 'excel' ? !!newTemplate._masterFileBlob : !!newTemplate._backgroundFileBlob,
        templateId: newId,
      });
    }

    return { merged, imported };
  }

  /**
   * Import templates with master files from ZIP
   * Uploads master files to cloud storage and links them
   */
  async importWithMasterFiles(data, existingDocTemplates, existingExcelTemplates, onProgress = null) {
    const results = {
      documentTemplates: null,
      excelTemplates: null,
      masterFilesUploaded: 0,
      errors: []
    };

    // Get or create Excel templates folder
    let excelFolderId = null;
    try {
      excelFolderId = await this.getOrCreateExcelTemplatesFolder();
    } catch (error) {
      console.error('Failed to get Excel templates folder:', error);
    }

    // Import document templates if present
    if (data.type === 'document_templates' || data.type === 'all_templates') {
      const docResult = this.importDocumentTemplates(data, existingDocTemplates);

      // Upload background files for document templates
      for (const item of docResult.imported) {
        const template = docResult.merged[item.templateId];
        if (template._backgroundFileBlob) {
          try {
            if (onProgress) {
              onProgress({
                type: 'uploading',
                templateName: template.name,
                fileType: 'document'
              });
            }

            // Upload to Document Templates folder
            const file = new File(
              [template._backgroundFileBlob],
              template._backgroundFileName || template.fileName,
              { type: 'application/pdf' }
            );

            // Use storage service to upload document background
            const fileId = await this.uploadDocumentBackgroundFile(file);

            if (fileId) {
              template.fileId = fileId;
              template.fileName = file.name;
              results.masterFilesUploaded++;
            }
          } catch (error) {
            console.error(`Failed to upload background for ${template.name}:`, error);
            results.errors.push(`${template.name}: ${error.message}`);
          }

          // Clean up blob from template
          delete template._backgroundFileBlob;
          delete template._backgroundFileName;
        }
        delete template._originalId;
      }

      results.documentTemplates = docResult;
    }

    // Import Excel templates if present
    if (data.type === 'excel_templates' || data.type === 'all_templates') {
      const excelResult = this.importExcelTemplates(data, existingExcelTemplates);

      // Upload master files for Excel templates
      if (excelFolderId) {
        for (const item of excelResult.imported) {
          const template = excelResult.merged[item.templateId];
          if (template._masterFileBlob) {
            try {
              if (onProgress) {
                onProgress({
                  type: 'uploading',
                  templateName: template.name,
                  fileType: 'excel'
                });
              }

              const file = new File(
                [template._masterFileBlob],
                template._masterFileName || template.driveFileName,
                { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }
              );

              const fileId = await this.uploadFileToDrive(file, excelFolderId);

              if (fileId) {
                template.driveFileId = fileId;
                template.driveFileName = file.name;
                results.masterFilesUploaded++;
              }
            } catch (error) {
              console.error(`Failed to upload master file for ${template.name}:`, error);
              results.errors.push(`${template.name}: ${error.message}`);
            }

            // Clean up blob from template
            delete template._masterFileBlob;
            delete template._masterFileName;
          }
          delete template._originalId;
        }
      }

      results.excelTemplates = excelResult;
    }

    return results;
  }

  /**
   * Upload document background file to cloud storage
   */
  async uploadDocumentBackgroundFile(file) {
    try {
      const storageService = getStorageService();

      // Get document templates folder
      const folder = await storageService.getOrCreateDocumentTemplatesFolder();

      // Upload the file
      const result = await storageService.uploadFile(folder.id, file.name, file, file.type);
      return result.id;
    } catch (error) {
      console.error('Error uploading document background file:', error);
      throw error;
    }
  }

  /**
   * Generate unique ID
   */
  _generateId() {
    return `template_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Export templates and download (JSON only - legacy method)
   */
  exportAndDownload(documentTemplates, excelTemplates, type = 'all') {
    let data;
    let filename;
    const timestamp = new Date().toISOString().split('T')[0];

    switch (type) {
      case 'documents':
        data = this.exportDocumentTemplates(documentTemplates);
        filename = `document-templates-${timestamp}.json`;
        break;
      case 'excel':
        data = this.exportExcelTemplates(excelTemplates);
        filename = `excel-templates-${timestamp}.json`;
        break;
      case 'all':
      default:
        data = this.exportAllTemplates(documentTemplates, excelTemplates);
        filename = `all-templates-${timestamp}.json`;
        break;
    }

    this.downloadAsJSON(data, filename);
    return {
      success: true,
      filename,
      documentCount: type === 'excel' ? 0 : Object.keys(documentTemplates).length,
      excelCount: type === 'documents' ? 0 : Object.keys(excelTemplates).length,
    };
  }

  /**
   * Check if signed in to cloud storage
   */
  isSignedIn() {
    return getAuthService().isSignedIn();
  }
}

export default new TemplateExportService();
