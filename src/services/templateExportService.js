/**
 * Template Export/Import Service
 * Handles exporting and importing of Document and Excel templates
 */

class TemplateExportService {
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
        createdAt: template.createdAt,
        updatedAt: template.updatedAt,
      })),
      excelTemplates: Object.values(excelTemplates).map(template => ({
        id: template.id,
        name: template.name,
        fieldMappings: template.fieldMappings,
        hasMasterFile: !!(template.driveFileId && template.driveFileName),
        masterFileName: template.driveFileName || null,
        createdAt: template.createdAt,
        updatedAt: template.updatedAt,
      }))
    };

    return exportData;
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
   * Parse imported JSON file
   */
  async parseImportFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = (e) => {
        try {
          const data = JSON.parse(e.target.result);
          resolve(data);
        } catch (error) {
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
      return this._mergeTemplates(data.templates, existingTemplates);
    } else if (data.type === 'all_templates') {
      return this._mergeTemplates(data.documentTemplates, existingTemplates);
    }
    throw new Error('No document templates found in import file');
  }

  /**
   * Import Excel templates
   */
  importExcelTemplates(data, existingTemplates) {
    if (data.type === 'excel_templates') {
      return this._mergeTemplates(data.templates, existingTemplates);
    } else if (data.type === 'all_templates') {
      return this._mergeTemplates(data.excelTemplates, existingTemplates);
    }
    throw new Error('No Excel templates found in import file');
  }

  /**
   * Merge imported templates with existing ones
   * Handles conflicts by renaming duplicates
   */
  _mergeTemplates(importedTemplates, existingTemplates) {
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

      // Generate new ID to avoid conflicts
      const newId = this._generateId();
      const newTemplate = {
        ...template,
        id: newId,
        name: finalName,
        importedAt: new Date().toISOString(),
        // Remove Drive-specific fields that won't work in new account
        driveFileId: undefined,
        driveFileName: template.masterFileName || template.driveFileName,
      };

      merged[newId] = newTemplate;
      imported.push({
        originalName: template.name,
        newName: finalName,
        renamed: finalName !== template.name,
      });
    }

    return { merged, imported };
  }

  /**
   * Generate unique ID
   */
  _generateId() {
    return `template_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Export templates and download
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
}

export default new TemplateExportService();
