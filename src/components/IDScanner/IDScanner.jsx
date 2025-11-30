import { useState, useRef, useEffect } from 'react';
import { processIDImages } from '../../services/idParserService';
import './IDScanner.css';

/**
 * IDScanner Component
 * Captures front and back of ID card and extracts details using OCR
 */
function IDScanner({ isOpen, onClose, onDataExtracted }) {
  const [step, setStep] = useState('front'); // 'front', 'back', 'processing', 'review'
  const [frontImage, setFrontImage] = useState(null);
  const [backImage, setBackImage] = useState(null);
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
    };
  }, []);

  const resetScanner = () => {
    setStep('front');
    setFrontImage(null);
    setBackImage(null);
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
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const imageDataUrl = canvas.toDataURL('image/jpeg', 0.95);

    if (step === 'front') {
      setFrontImage(imageDataUrl);
      stopCamera();
    } else if (step === 'back') {
      setBackImage(imageDataUrl);
      stopCamera();
    }
  };

  const handleRetake = () => {
    if (step === 'front') {
      setFrontImage(null);
    } else if (step === 'back') {
      setBackImage(null);
    }
    startCamera();
  };

  const handleNextStep = () => {
    if (step === 'front' && frontImage) {
      setStep('back');
    } else if (step === 'back' && backImage) {
      processImages();
    }
  };

  const handleSkipBack = () => {
    setBackImage(null);
    processImages();
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

  const handleConfirm = () => {
    onDataExtracted({
      ...editableData,
      frontImage,
      backImage
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
          </h2>
          <button className="id-scanner-close" onClick={handleClose}>
            &times;
          </button>
        </div>

        {/* Progress Indicator */}
        <div className="id-scanner-progress">
          <div className={`progress-step ${step === 'front' || frontImage ? 'active' : ''} ${frontImage ? 'complete' : ''}`}>
            <span className="step-number">1</span>
            <span className="step-label">Front</span>
          </div>
          <div className="progress-line"></div>
          <div className={`progress-step ${step === 'back' || backImage ? 'active' : ''} ${backImage ? 'complete' : ''}`}>
            <span className="step-number">2</span>
            <span className="step-label">Back</span>
          </div>
          <div className="progress-line"></div>
          <div className={`progress-step ${step === 'processing' || step === 'review' ? 'active' : ''} ${step === 'review' ? 'complete' : ''}`}>
            <span className="step-number">3</span>
            <span className="step-label">Review</span>
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
