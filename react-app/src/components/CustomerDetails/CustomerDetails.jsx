import useCustomerStore from '../../stores/useCustomerStore';
import './CustomerDetails.css';

function CustomerDetails() {
  const { getSelectedCustomer } = useCustomerStore();
  const customer = getSelectedCustomer();

  if (!customer) {
    return (
      <div className="customer-details">
        <div className="empty-state">
          <p>Select a customer to view details</p>
        </div>
      </div>
    );
  }

  return (
    <div className="customer-details">
      <div className="customer-details-header">
        <h2>{customer.name}</h2>
        <div className="customer-actions">
          <button className="btn btn-secondary" onClick={() => console.log('Edit')}>
            Edit
          </button>
          <button className="btn btn-danger" onClick={() => console.log('Delete')}>
            Delete
          </button>
        </div>
      </div>

      <div className="customer-details-content">
        <div className="info-section">
          <h3>Contact Information</h3>
          <div className="info-grid">
            <div className="info-item">
              <label>Phone</label>
              <div className="info-value">{customer.phone || 'N/A'}</div>
            </div>
            <div className="info-item">
              <label>Email</label>
              <div className="info-value">{customer.email || 'N/A'}</div>
            </div>
            <div className="info-item">
              <label>NRIC/FIN</label>
              <div className="info-value">{customer.nric || 'N/A'}</div>
            </div>
            <div className="info-item">
              <label>Date of Birth</label>
              <div className="info-value">{customer.dob || 'N/A'}</div>
            </div>
          </div>
        </div>

        <div className="info-section">
          <h3>Additional Information</h3>
          <div className="info-grid">
            <div className="info-item">
              <label>Occupation</label>
              <div className="info-value">{customer.occupation || 'N/A'}</div>
            </div>
            <div className="info-item">
              <label>Sales Consultant</label>
              <div className="info-value">{customer.salesConsultant || 'N/A'}</div>
            </div>
            <div className="info-item">
              <label>VSA No</label>
              <div className="info-value">{customer.vsaNo || 'N/A'}</div>
            </div>
          </div>
        </div>

        {customer.address && (
          <div className="info-section">
            <h3>Address</h3>
            <div className="info-value">
              {customer.address}
              {customer.addressContinue && (
                <>
                  <br />
                  {customer.addressContinue}
                </>
              )}
            </div>
          </div>
        )}

        {customer.notes && (
          <div className="info-section">
            <h3>Notes</h3>
            <div className="info-value">{customer.notes}</div>
          </div>
        )}
      </div>
    </div>
  );
}

export default CustomerDetails;
