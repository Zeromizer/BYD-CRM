import { useState, useRef, useEffect } from 'react';
import { processIDImages, cleanupOCRWorker } from '../../services/idParserService';
import './IDScanner.css';

/**
 * IDScanner Component
 * Captures front and back of ID card and driving license, extracts details using OCR
 */
function IDScanner({ isOpen, onClose, onDataExtracted }) {
  // Steps: 'front', 'back', 'processing', 'review', 'ask-license', 'license-front', 'license-back', 'final-review'
  const [step, setStep] = useState('front');
  const [frontImage, setFrontImage] = useState(null);
  const [backImage, setBackImage] = useState(null);
  const [licenseFrontImage, setLicenseFrontImage] = useState(null);
  const [licenseBackImage, setLicenseBackImage] = useState(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraLoading, setCameraLoading] = useState(false);
  const [error, setError] = useState(null);
  const [processingStatus, setProcessingStatus] = useState({ stage: '', progress: 0 });
  const [extractedData, setExtractedData] = useState(null);
  const [editableData, setEditableData] = useState({
    name: '',
    nric: '',
    dob: '',
    address: '',
    addressContinue: ''
  });

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      resetScanner();
    }
  }, [isOpen]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopCamera();
      // Cleanup OCR worker to free memory (worker is reused while scanner is open)
      cleanupOCRWorker();
    };
  }, []);

  const resetScanner = () => {
    setStep('front');
    setFrontImage(null);
    setBackImage(null);
    setLicenseFrontImage(null);
    setLicenseBackImage(null);
    setError(null);
    setProcessingStatus({ stage: '', progress: 0 });
    setExtractedData(null);
    setEditableData({
      name: '',
      nric: '',
      dob: '',
      address: '',
      addressContinue: ''
    });
    stopCamera();
  };

  const startCamera = async () => {
    try {
      setError(null);
      setCameraLoading(true);

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment',
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        }
      });

      setCameraActive(true);
      await new Promise(resolve => setTimeout(resolve, 100));

      if (!videoRef.current) {
        setCameraLoading(false);
        setCameraActive(false);
        setError('Video element not ready. Please try again.');
        stream.getTracks().forEach(track => track.stop());
        return;
      }

      videoRef.current.srcObject = stream;
      streamRef.current = stream;

      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => resolve(), 3000);
        if (videoRef.current.readyState >= 1) {
          clearTimeout(timeout);
          resolve();
          return;
        }
        videoRef.current.onloadedmetadata = () => {
          clearTimeout(timeout);
          resolve();
        };
        videoRef.current.onerror = () => {
          clearTimeout(timeout);
          reject(new Error('Video element error'));
        };
      });

      await videoRef.current.play();
      setCameraLoading(false);
    } catch (err) {
      console.error('Error accessing camera:', err);
      setCameraLoading(false);
      setCameraActive(false);
      setError(`Unable to access camera: ${err.message}`);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
    setCameraLoading(false);
  };

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;

    // Get the actual video dimensions
    const videoWidth = video.videoWidth;
    const videoHeight = video.videoHeight;

    // The camera view container has aspect ratio 4:3 with object-fit: cover
    // We need to crop the video to match what's visible in the view
    const containerAspect = 4 / 3;
    const videoAspect = videoWidth / videoHeight;

    let cropX = 0;
    let cropY = 0;
    let cropWidth = videoWidth;
    let cropHeight = videoHeight;

    if (videoAspect > containerAspect) {
      // Video is wider than container - crop sides
      cropWidth = videoHeight * containerAspect;
      cropX = (videoWidth - cropWidth) / 2;
    } else if (videoAspect < containerAspect) {
      // Video is taller than container - crop top/bottom
      cropHeight = videoWidth / containerAspect;
      cropY = (videoHeight - cropHeight) / 2;
    }

    // Set canvas to the cropped dimensions
    canvas.width = cropWidth;
    canvas.height = cropHeight;

    const ctx = canvas.getContext('2d');
    // Draw the cropped portion of the video
    ctx.drawImage(
      video,
      cropX, cropY, cropWidth, cropHeight,  // Source rectangle
      0, 0, cropWidth, cropHeight            // Destination rectangle
    );

    const imageDataUrl = canvas.toDataURL('image/jpeg', 0.95);

    if (step === 'front') {
      setFrontImage(imageDataUrl);
      stopCamera();
    } else if (step === 'back') {
      setBackImage(imageDataUrl);
      stopCamera();
    } else if (step === 'license-front') {
      setLicenseFrontImage(imageDataUrl);
      stopCamera();
    } else if (step === 'license-back') {
      setLicenseBackImage(imageDataUrl);
      stopCamera();
    }
  };

  const handleRetake = () => {
    if (step === 'front') {
      setFrontImage(null);
    } else if (step === 'back') {
      setBackImage(null);
    } else if (step === 'license-front') {
      setLicenseFrontImage(null);
    } else if (step === 'license-back') {
      setLicenseBackImage(null);
    }
    startCamera();
  };

  const handleNextStep = () => {
    if (step === 'front' && frontImage) {
      setStep('back');
    } else if (step === 'back' && backImage) {
      processImages();
    } else if (step === 'license-front' && licenseFrontImage) {
      setStep('license-back');
    } else if (step === 'license-back' && licenseBackImage) {
      setStep('final-review');
    }
  };

  const handleSkipBack = () => {
    setBackImage(null);
    processImages();
  };

  const handleSkipLicenseBack = () => {
    setLicenseBackImage(null);
    setStep('final-review');
  };

  const handleScanLicense = () => {
    setStep('license-front');
  };

  const handleSkipLicense = () => {
    setStep('final-review');
  };

  const processImages = async () => {
    setStep('processing');
    setError(null);

    try {
      const result = await processIDImages(
        frontImage,
        backImage,
        (status) => setProcessingStatus(status)
      );

      setExtractedData(result);
      setEditableData({
        name: result.name || '',
        nric: result.nric || '',
        dob: result.dob || '',
        address: result.address || '',
        addressContinue: result.addressContinue || ''
      });
      setStep('review');
    } catch (err) {
      console.error('Processing error:', err);
      setError('Failed to process ID images. Please try again.');
      setStep('front');
    }
  };

  const handleEditChange = (e) => {
    const { name, value } = e.target;
    setEditableData(prev => ({ ...prev, [name]: value }));
  };

  const handleConfirmReview = () => {
    // After reviewing ID data, ask if user wants to scan license
    setStep('ask-license');
  };

  const handleConfirm = () => {
    onDataExtracted({
      ...editableData,
      frontImage,
      backImage,
      licenseFrontImage,
      licenseBackImage
    });
    onClose();
  };

  const handleClose = () => {
    stopCamera();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="id-scanner-overlay">
      <div className="id-scanner-modal">
        {/* Header */}
        <div className="id-scanner-header">
          <h2>
            {step === 'front' && 'Scan Front of ID'}
            {step === 'back' && 'Scan Back of ID'}
            {step === 'processing' && 'Processing ID...'}
            {step === 'review' && 'Review Extracted Data'}
            {step === 'ask-license' && 'Scan Driving License?'}
            {step === 'license-front' && 'Scan Front of License'}
            {step === 'license-back' && 'Scan Back of License'}
            {step === 'final-review' && 'Review All Documents'}
          </h2>
          <button className="id-scanner-close" onClick={handleClose}>
            &times;
          </button>
        </div>

        {/* Progress Indicator */}
        <div className="id-scanner-progress">
          <div className={`progress-step ${step === 'front' || frontImage ? 'active' : ''} ${frontImage ? 'complete' : ''}`}>
            <span className="step-number">1</span>
            <span className="step-label">ID Front</span>
          </div>
          <div className="progress-line"></div>
          <div className={`progress-step ${step === 'back' || backImage || step === 'processing' || step === 'review' || step === 'ask-license' || step === 'license-front' || step === 'license-back' || step === 'final-review' ? 'active' : ''} ${backImage || step === 'processing' || step === 'review' || step === 'ask-license' || step === 'license-front' || step === 'license-back' || step === 'final-review' ? 'complete' : ''}`}>
            <span className="step-number">2</span>
            <span className="step-label">ID Back</span>
          </div>
          <div className="progress-line"></div>
          <div className={`progress-step ${step === 'processing' || step === 'review' || step === 'ask-license' || step === 'license-front' || step === 'license-back' || step === 'final-review' ? 'active' : ''} ${step === 'review' || step === 'ask-license' || step === 'license-front' || step === 'license-back' || step === 'final-review' ? 'complete' : ''}`}>
            <span className="step-number">3</span>
            <span className="step-label">Review</span>
          </div>
          <div className="progress-line"></div>
          <div className={`progress-step ${step === 'license-front' || step === 'license-back' || licenseFrontImage ? 'active' : ''} ${licenseFrontImage ? 'complete' : ''}`}>
            <span className="step-number">4</span>
            <span className="step-label">License</span>
          </div>
          <div className="progress-line"></div>
          <div className={`progress-step ${step === 'final-review' ? 'active complete' : ''}`}>
            <span className="step-number">5</span>
            <span className="step-label">Done</span>
          </div>
        </div>

        {/* Content Area */}
        <div className="id-scanner-content">
          {error && (
            <div className="id-scanner-error">
              <p>{error}</p>
            </div>
          )}

          {/* Front/Back Capture Steps */}
          {(step === 'front' || step === 'back') && (
            <div className="capture-section">
              {!cameraActive && !(step === 'front' ? frontImage : backImage) && !cameraLoading && (
                <div className="capture-start">
                  <div className="id-icon">
                    {step === 'front' ? '🪪' : '🔄'}
                  </div>
                  <p className="capture-instruction">
                    {step === 'front'
                      ? 'Position the front of the ID card within the frame'
                      : 'Position the back of the ID card within the frame'}
                  </p>
                  <button className="btn btn-primary btn-large" onClick={startCamera}>
                    Start Camera
                  </button>
                </div>
              )}

              {cameraLoading && (
                <div className="loading-state">
                  <div className="loading"></div>
                  <p>Starting camera...</p>
                </div>
              )}

              {cameraActive && (
                <div className="camera-view">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="camera-video"
                  />
                  <canvas ref={canvasRef} style={{ display: 'none' }} />

                  {/* ID Guide Overlay */}
                  <div className="id-guide-overlay">
                    <div className="id-guide-frame">
                      <div className="corner top-left"></div>
                      <div className="corner top-right"></div>
                      <div className="corner bottom-left"></div>
                      <div className="corner bottom-right"></div>
                    </div>
                    <p className="guide-text">
                      {step === 'front' ? 'Front of ID' : 'Back of ID'}
                    </p>
                  </div>

                  <div className="camera-controls">
                    <button className="btn-capture" onClick={capturePhoto}>
                      <div className="capture-ring">
                        <div className="capture-button"></div>
                      </div>
                    </button>
                  </div>
                </div>
              )}

              {/* Preview captured image */}
              {(step === 'front' ? frontImage : backImage) && !cameraActive && (
                <div className="preview-section">
                  <div className="preview-image-container">
                    <img
                      src={step === 'front' ? frontImage : backImage}
                      alt={`${step} of ID`}
                      className="preview-image"
                    />
                  </div>
                  <div className="preview-actions">
                    <button className="btn btn-secondary" onClick={handleRetake}>
                      Retake
                    </button>
                    <button className="btn btn-primary" onClick={handleNextStep}>
                      {step === 'front' ? 'Next: Scan Back' : 'Process ID'}
                    </button>
                  </div>
                  {step === 'back' && (
                    <button className="btn btn-text" onClick={handleSkipBack}>
                      Skip back scan (address won't be extracted)
                    </button>
                  )}
                </div>
              )}

              {/* Skip back button when on back step before capturing */}
              {step === 'back' && !backImage && !cameraActive && !cameraLoading && (
                <div className="skip-section">
                  <button className="btn btn-text" onClick={handleSkipBack}>
                    Skip back scan
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Processing Step */}
          {step === 'processing' && (
            <div className="processing-section">
              <div className="processing-animation">
                <div className="processing-icon">
                  <div className="scan-line"></div>
                </div>
              </div>
              <p className="processing-status">{processingStatus.stage}</p>
              <div className="processing-bar">
                <div
                  className="processing-bar-fill"
                  style={{ width: `${processingStatus.progress}%` }}
                ></div>
              </div>
              <p className="processing-percent">{processingStatus.progress}%</p>
            </div>
          )}

          {/* Review Step */}
          {step === 'review' && (
            <div className="review-section">
              {extractedData && (
                <div className="confidence-badge">
                  <span className={`confidence ${extractedData.confidence >= 75 ? 'high' : extractedData.confidence >= 50 ? 'medium' : 'low'}`}>
                    {extractedData.confidence}% confidence
                  </span>
                </div>
              )}

              <p className="review-instruction">
                Review and edit the extracted information below:
              </p>

              <div className="review-form">
                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="name">Name</label>
                    <input
                      type="text"
                      id="name"
                      name="name"
                      value={editableData.name}
                      onChange={handleEditChange}
                      placeholder="Full name"
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="nric">NRIC/FIN</label>
                    <input
                      type="text"
                      id="nric"
                      name="nric"
                      value={editableData.nric}
                      onChange={handleEditChange}
                      placeholder="S1234567A"
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="dob">Date of Birth</label>
                    <input
                      type="date"
                      id="dob"
                      name="dob"
                      value={editableData.dob}
                      onChange={handleEditChange}
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group full-width">
                    <label htmlFor="address">Address</label>
                    <input
                      type="text"
                      id="address"
                      name="address"
                      value={editableData.address}
                      onChange={handleEditChange}
                      placeholder="Block, Street, Unit"
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group full-width">
                    <label htmlFor="addressContinue">Address (continued)</label>
                    <input
                      type="text"
                      id="addressContinue"
                      name="addressContinue"
                      value={editableData.addressContinue}
                      onChange={handleEditChange}
                      placeholder="SINGAPORE + Postal Code"
                    />
                  </div>
                </div>
              </div>

              {/* Scanned Images Preview */}
              <div className="scanned-images">
                <h4>Scanned ID Images</h4>
                <div className="image-thumbnails">
                  {frontImage && (
                    <div className="thumbnail">
                      <img src={frontImage} alt="Front of ID" />
                      <span>Front</span>
                    </div>
                  )}
                  {backImage && (
                    <div className="thumbnail">
                      <img src={backImage} alt="Back of ID" />
                      <span>Back</span>
                    </div>
                  )}
                </div>
                <p className="images-note">
                  These images will be saved to the customer's folder
                </p>
              </div>

              <div className="review-actions">
                <button className="btn btn-secondary" onClick={resetScanner}>
                  Scan Again
                </button>
                <button className="btn btn-primary" onClick={handleConfirmReview}>
                  Continue
                </button>
              </div>
            </div>
          )}

          {/* Ask License Step */}
          {step === 'ask-license' && (
            <div className="ask-license-section">
              <div className="ask-license-icon">🚗</div>
              <h3>Would you like to scan a driving license?</h3>
              <p className="ask-license-description">
                Scanning the driving license will save a copy to the customer's folder.
              </p>
              <div className="ask-license-actions">
                <button className="btn btn-secondary" onClick={handleSkipLicense}>
                  Skip
                </button>
                <button className="btn btn-primary" onClick={handleScanLicense}>
                  Scan License
                </button>
              </div>
            </div>
          )}

          {/* License Front/Back Capture Steps */}
          {(step === 'license-front' || step === 'license-back') && (
            <div className="capture-section">
              {!cameraActive && !(step === 'license-front' ? licenseFrontImage : licenseBackImage) && !cameraLoading && (
                <div className="capture-start">
                  <div className="id-icon">
                    {step === 'license-front' ? '🚗' : '🔄'}
                  </div>
                  <p className="capture-instruction">
                    {step === 'license-front'
                      ? 'Position the front of the driving license within the frame'
                      : 'Position the back of the driving license within the frame'}
                  </p>
                  <button className="btn btn-primary btn-large" onClick={startCamera}>
                    Start Camera
                  </button>
                </div>
              )}

              {cameraLoading && (
                <div className="loading-state">
                  <div className="loading"></div>
                  <p>Starting camera...</p>
                </div>
              )}

              {cameraActive && (
                <div className="camera-view">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="camera-video"
                  />
                  <canvas ref={canvasRef} style={{ display: 'none' }} />

                  {/* License Guide Overlay */}
                  <div className="id-guide-overlay">
                    <div className="id-guide-frame">
                      <div className="corner top-left"></div>
                      <div className="corner top-right"></div>
                      <div className="corner bottom-left"></div>
                      <div className="corner bottom-right"></div>
                    </div>
                    <p className="guide-text">
                      {step === 'license-front' ? 'Front of License' : 'Back of License'}
                    </p>
                  </div>

                  <div className="camera-controls">
                    <button className="btn-capture" onClick={capturePhoto}>
                      <div className="capture-ring">
                        <div className="capture-button"></div>
                      </div>
                    </button>
                  </div>
                </div>
              )}

              {/* Preview captured license image */}
              {(step === 'license-front' ? licenseFrontImage : licenseBackImage) && !cameraActive && (
                <div className="preview-section">
                  <div className="preview-image-container">
                    <img
                      src={step === 'license-front' ? licenseFrontImage : licenseBackImage}
                      alt={`${step === 'license-front' ? 'Front' : 'Back'} of License`}
                      className="preview-image"
                    />
                  </div>
                  <div className="preview-actions">
                    <button className="btn btn-secondary" onClick={handleRetake}>
                      Retake
                    </button>
                    <button className="btn btn-primary" onClick={handleNextStep}>
                      {step === 'license-front' ? 'Next: Scan Back' : 'Finish'}
                    </button>
                  </div>
                  {step === 'license-back' && (
                    <button className="btn btn-text" onClick={handleSkipLicenseBack}>
                      Skip back scan
                    </button>
                  )}
                </div>
              )}

              {/* Skip license back button when on license-back step before capturing */}
              {step === 'license-back' && !licenseBackImage && !cameraActive && !cameraLoading && (
                <div className="skip-section">
                  <button className="btn btn-text" onClick={handleSkipLicenseBack}>
                    Skip back scan
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Final Review Step */}
          {step === 'final-review' && (
            <div className="review-section">
              <p className="review-instruction">
                Review all scanned documents below:
              </p>

              {/* Extracted Data Summary */}
              <div className="review-form">
                <div className="form-row">
                  <div className="form-group">
                    <label>Name</label>
                    <input
                      type="text"
                      name="name"
                      value={editableData.name}
                      onChange={handleEditChange}
                      placeholder="Full name"
                    />
                  </div>
                  <div className="form-group">
                    <label>NRIC/FIN</label>
                    <input
                      type="text"
                      name="nric"
                      value={editableData.nric}
                      onChange={handleEditChange}
                      placeholder="S1234567A"
                    />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Date of Birth</label>
                    <input
                      type="date"
                      name="dob"
                      value={editableData.dob}
                      onChange={handleEditChange}
                    />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group full-width">
                    <label>Address</label>
                    <input
                      type="text"
                      name="address"
                      value={editableData.address}
                      onChange={handleEditChange}
                      placeholder="Block, Street, Unit"
                    />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group full-width">
                    <label>Address (continued)</label>
                    <input
                      type="text"
                      name="addressContinue"
                      value={editableData.addressContinue}
                      onChange={handleEditChange}
                      placeholder="SINGAPORE + Postal Code"
                    />
                  </div>
                </div>
              </div>

              {/* All Scanned Images Preview */}
              <div className="scanned-images">
                <h4>Scanned ID Card</h4>
                <div className="image-thumbnails">
                  {frontImage && (
                    <div className="thumbnail">
                      <img src={frontImage} alt="Front of ID" />
                      <span>Front</span>
                    </div>
                  )}
                  {backImage && (
                    <div className="thumbnail">
                      <img src={backImage} alt="Back of ID" />
                      <span>Back</span>
                    </div>
                  )}
                </div>
              </div>

              {(licenseFrontImage || licenseBackImage) && (
                <div className="scanned-images">
                  <h4>Scanned Driving License</h4>
                  <div className="image-thumbnails">
                    {licenseFrontImage && (
                      <div className="thumbnail">
                        <img src={licenseFrontImage} alt="Front of License" />
                        <span>Front</span>
                      </div>
                    )}
                    {licenseBackImage && (
                      <div className="thumbnail">
                        <img src={licenseBackImage} alt="Back of License" />
                        <span>Back</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <p className="images-note">
                These images will be saved to the customer's folder
              </p>

              <div className="review-actions">
                <button className="btn btn-secondary" onClick={resetScanner}>
                  Scan Again
                </button>
                <button className="btn btn-primary" onClick={handleConfirm}>
                  Use This Data
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default IDScanner;
