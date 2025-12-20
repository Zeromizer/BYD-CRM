import { getStorageService } from './storageServiceSelector';

/**
 * Escape HTML special characters to prevent XSS
 */
const escapeHtml = (str) => {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
};

class FormService {
  /**
   * Get customer data mapping for form population
   */
  getFormDataMapping(customer) {
    const today = new Date().toLocaleDateString();

    // Helper function to parse currency strings to numbers
    const parseCurrency = (value) => {
      if (!value) return 0;
      const numericValue = parseFloat(value.toString().replace(/[^0-9.-]/g, ''));
      return isNaN(numericValue) ? 0 : numericValue;
    };

    // Calculate net insurance fee
    const insuranceFee = parseCurrency(customer.vsa_insuranceFee);
    const subsidy = parseCurrency(customer.vsa_insuranceSubsidy);
    const netInsuranceFee = insuranceFee - subsidy;

    return {
      name: customer.name || '',
      phone: customer.phone || '',
      email: customer.email || '',
      nric: customer.nric || '',
      occupation: customer.occupation || '',
      dob: customer.dob || '',
      address: customer.address || '',
      addressContinue: customer.addressContinue || '',
      fullAddress: ((customer.address || '') + (customer.addressContinue ? ', ' + customer.addressContinue : '')).trim(),
      salesConsultant: customer.salesConsultant || '',
      vsaNo: customer.vsaNo || '',
      date: today,

      // VSA Details - BYD New Car Details
      makeModel: customer.vsa_makeModel || '',
      yom: customer.vsa_yom || '',
      bodyColour: customer.vsa_bodyColour || '',
      upholstery: customer.vsa_upholstery || '',
      przType: customer.vsa_przType || '',

      // VSA Details - BYD New Car Package
      package: customer.vsa_package || '',
      sellingPriceList: customer.vsa_sellingPriceList || '',
      purchasePriceWithCOE: customer.vsa_purchasePriceWithCOE || '',
      coeRebateLevel: customer.vsa_coeRebateLevel || '',
      deposit: customer.vsa_deposit || '',
      lessOthers: customer.vsa_lessOthers || '',
      addOthers: customer.vsa_addOthers || '',
      deliveryDate: customer.vsa_deliveryDate || '',

      // VSA Details - Trade In Car Details
      tradeInCarNo: customer.vsa_tradeInCarNo || '',
      tradeInCarModel: customer.vsa_tradeInCarModel || '',
      tradeInAmount: customer.vsa_tradeInAmount || '',

      // VSA Details - Delivery Details
      dateOfRegistration: customer.vsa_dateOfRegistration || '',
      registrationNo: customer.vsa_registrationNo || '',
      chassisNo: customer.vsa_chassisNo || '',
      engineNo: customer.vsa_engineNo || '',
      motorNo: customer.vsa_motorNo || '',

      // VSA Details - Insurance
      insuranceCompany: customer.vsa_insuranceCompany || '',
      insuranceFee: customer.vsa_insuranceFee || '',
      insuranceFeeNet: netInsuranceFee.toFixed(2),

      // VSA Details - Remarks
      remarks1: customer.vsa_remarks1 || '',
      remarks2: customer.vsa_remarks2 || '',
      loanAmount: customer.vsa_loanAmount || '',
      interest: customer.vsa_interest || '',
      tenure: customer.vsa_tenure || '',
      adminFee: customer.vsa_adminFee || '',
      insuranceSubsidy: customer.vsa_insuranceSubsidy || '',
      monthlyRepayment: customer.vsa_monthlyRepayment || '',

      // Proposal Details
      proposalModel: customer.proposal_model || '',
      proposalBank: customer.proposal_bank || '',
      proposalSellingPrice: customer.proposal_sellingPrice || '',
      proposalInterestRate: customer.proposal_interestRate || '',
      proposalDownpayment: customer.proposal_downpayment || '',
      proposalLoanTenure: customer.proposal_loanTenure || '',
      proposalLoanAmount: customer.proposal_loanAmount || '',
      proposalAdminFee: customer.proposal_adminFee || '',
      proposalReferralFee: customer.proposal_referralFee || '',
      proposalTradeInModel: customer.proposal_tradeInModel || '',
      proposalLowLoanSurcharge: customer.proposal_lowLoanSurcharge || '',
      proposalTradeInCarPlate: customer.proposal_tradeInCarPlate || '',
      proposalNoLoanSurcharge: customer.proposal_noLoanSurcharge || '',
      proposalQuotedTradeInPrice: customer.proposal_quotedTradeInPrice || '',
      proposalBenefit1: customer.proposal_benefit1 || '',
      proposalBenefit2: customer.proposal_benefit2 || '',
      proposalBenefit3: customer.proposal_benefit3 || '',
      proposalBenefit4: customer.proposal_benefit4 || '',
      proposalBenefit5: customer.proposal_benefit5 || '',
      proposalBenefit6: customer.proposal_benefit6 || '',
      proposalBenefit7: customer.proposal_benefit7 || '',
      proposalBenefit8: customer.proposal_benefit8 || '',
      proposalBenefit9: customer.proposal_benefit9 || '',
      proposalBenefitsGiven: customer.proposal_benefitsGiven || '',
      proposalRemarks: customer.proposal_remarks || '',
    };
  }

  /**
   * Fetch form image from OneDrive
   */
  async fetchFormImage(fileId) {
    try {
      const blob = await getStorageService().downloadFileAsBlob(fileId);

      // Convert blob to base64
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = function (e) {
          resolve(e.target.result);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } catch (error) {
      console.error('Error fetching form image from OneDrive:', error);
      throw error;
    }
  }

  /**
   * Render form with customer data overlaid
   */
  async renderFormWithData(template, customer) {
    try {
      // Check if form has field mappings
      if (!template.fieldMappings || Object.keys(template.fieldMappings).length === 0) {
        // No field mappings, return original image
        return await this.fetchFormImage(template.fileId);
      }

      // Fetch form image
      const base64Data = await this.fetchFormImage(template.fileId);

      // Create image element
      const img = await this.loadImage(base64Data);

      // Create canvas
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');

      // Draw form image
      ctx.drawImage(img, 0, 0);

      // Get customer data
      const dataMapping = this.getFormDataMapping(customer);

      // Draw each field
      for (const [fieldId, field] of Object.entries(template.fieldMappings)) {
        // Use custom value if provided, otherwise look up from customer data
        let text;
        if (field.customValue) {
          text = field.customValue;
        } else {
          text = dataMapping[field.type] || '';
        }

        if (!text) continue;

        // Set font and color
        ctx.fillStyle = field.color || '#000000';
        ctx.font = `${field.fontSize}px Arial`;

        // Draw text at mapped position
        ctx.fillText(text, field.x, field.y);
      }

      // Convert to base64
      return canvas.toDataURL('image/jpeg', 0.95);
    } catch (error) {
      console.error('Error rendering form with data:', error);
      throw error;
    }
  }

  /**
   * Load image from base64
   */
  loadImage(base64Data) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Failed to load form image'));
      img.src = base64Data;
    });
  }

  /**
   * Open rendered form in print window
   */
  openFormInPrintWindow(renderedFormBase64, formName, customerName) {
    const printWin = window.open('', '_blank');
    const safeCustomerName = escapeHtml(customerName);
    const safeFormName = escapeHtml(formName);
    printWin.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>${safeCustomerName} - ${safeFormName}</title>
        <style>
          @page {
            size: A4;
            margin: 0;
          }
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          body {
            font-family: Arial, sans-serif;
            background: #2c3e50;
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            padding: 20px;
          }
          .page {
            background: white;
            box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
            max-width: 100%;
            max-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
          }
          .page img {
            max-width: 100%;
            max-height: 100vh;
            object-fit: contain;
          }
          .print-btn {
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 14px 28px;
            background: #27ae60;
            color: white;
            border: none;
            border-radius: 6px;
            cursor: pointer;
            font-size: 15px;
            font-weight: 700;
            box-shadow: 0 6px 16px rgba(0,0,0,0.3);
            z-index: 1000;
            transition: all 0.3s;
          }
          .print-btn:hover {
            background: #229954;
            transform: translateY(-2px);
            box-shadow: 0 8px 20px rgba(0,0,0,0.4);
          }
          @media print {
            body {
              background: white;
              padding: 0;
            }
            .no-print {
              display: none !important;
            }
            .page {
              box-shadow: none;
              width: 100%;
              height: 100vh;
              max-width: none;
              max-height: none;
            }
            .page img {
              width: 100%;
              height: 100%;
              max-width: none;
              max-height: none;
            }
          }
        </style>
      </head>
      <body>
        <button class="print-btn no-print" onclick="window.print()">Print Form</button>
        <div class="page">
          <img src="${renderedFormBase64}" alt="${safeFormName}">
        </div>
      </body>
      </html>
    `);
    printWin.document.close();
  }

  /**
   * Download rendered form as image
   */
  downloadForm(renderedFormBase64, fileName) {
    const link = document.createElement('a');
    link.href = renderedFormBase64;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  /**
   * Get form type display name
   */
  getFormTypeName(formType) {
    const names = {
      test_drive: 'Test Drive Agreement',
      vsa: 'Vehicle Sales Agreement',
      pdpa: 'PDPA Consent Form',
      coe_bidding_1: 'COE Bidding 1',
      coe_bidding_2: 'COE Bidding 2',
      pdpa_consent_1: 'PDPA Consent 1',
      pdpa_consent_2: 'PDPA Consent 2',
      delivery_checklist_1: 'Delivery Checklist Form (1 of 2)',
      delivery_checklist_2: 'Delivery Checklist Form (2 of 2)',
      other: 'Other Form',
    };
    return names[formType] || formType;
  }

  /**
   * Get available forms for customer (all image forms)
   */
  getAvailableForms(formTemplates) {
    const available = [];

    for (const [formType, template] of Object.entries(formTemplates)) {
      // Include all image forms, even without field mappings (for back pages, static forms, etc.)
      if (template.fileType === 'image') {
        available.push({
          formType,
          name: this.getFormTypeName(formType),
          template,
        });
      }
    }

    return available;
  }
}

export default new FormService();
