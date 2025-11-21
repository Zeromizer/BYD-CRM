import { useState, useRef, useEffect } from 'react';
import './DocumentScanner.css';

function DocumentScanner({ customerId, customerName, customerFolderId, onScanComplete }) {
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraLoading, setCameraLoading] = useState(false);
  const [capturedImage, setCapturedImage] = useState(null);
  const [processedImage, setProcessedImage] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [autoCrop, setAutoCrop] = useState(true);
  const [autoEnhance, setAutoEnhance] = useState(true);
  const [error, setError] = useState(null);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);

  // Start camera
  const startCamera = async () => {
    try {
      setError(null);
      setCameraLoading(true);
      console.log('Requesting camera access...');

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment', // Use back camera on mobile
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        }
      });

      console.log('Camera access granted, stream obtained:', stream);

      if (!videoRef.current) {
        console.error('Video ref is null!');
        setCameraLoading(false);
        setError('Video element not ready. Please try again.');
        // Stop the stream since we can't use it
        stream.getTracks().forEach(track => track.stop());
        return;
      }

      const video = videoRef.current;
      console.log('Video element found:', video);

      video.srcObject = stream;
      streamRef.current = stream;

      console.log('Video element state after setting srcObject:', {
        readyState: video.readyState,
        videoWidth: video.videoWidth,
        videoHeight: video.videoHeight,
        srcObject: video.srcObject
      });

      // Wait for video metadata to load with timeout
      try {
        await new Promise((resolve, reject) => {
          const timeout = setTimeout(() => {
            console.log('Metadata load timeout (3s), attempting to play anyway');
            resolve();
          }, 3000);

          // If metadata already loaded, resolve immediately
          if (video.readyState >= 1) {
            console.log('Video metadata already loaded (readyState:', video.readyState, ')');
            clearTimeout(timeout);
            resolve();
            return;
          }

          console.log('Waiting for loadedmetadata event...');
          video.onloadedmetadata = () => {
            console.log('Video metadata loaded via event');
            clearTimeout(timeout);
            resolve();
          };

          video.onerror = (e) => {
            console.error('Video error event:', e);
            clearTimeout(timeout);
            reject(new Error('Video element error'));
          };
        });
      } catch (metadataError) {
        console.error('Metadata loading error:', metadataError);
        setCameraLoading(false);
        setError('Failed to initialize video. Please try again.');
        stream.getTracks().forEach(track => track.stop());
        return;
      }

      // Explicitly play the video (required in some browsers)
      try {
        console.log('Attempting to play video...');
        await video.play();
        console.log('Video playing successfully');
        setCameraActive(true);
        setCameraLoading(false);
      } catch (playError) {
        console.error('Error playing video:', playError);
        setCameraLoading(false);
        setError('Unable to start video playback. Please try again.');
        stream.getTracks().forEach(track => track.stop());
      }
    } catch (err) {
      console.error('Error accessing camera:', err);
      setCameraLoading(false);
      setError(`Unable to access camera: ${err.message}. Please check permissions.`);
    }
  };

  // Stop camera
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

  // Capture photo
  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const imageDataUrl = canvas.toDataURL('image/jpeg', 0.95);
    setCapturedImage(imageDataUrl);
    stopCamera();

    // Process the image
    processImage(imageDataUrl);
  };

  // Process image with auto-crop and enhancement
  const processImage = async (imageDataUrl) => {
    setIsProcessing(true);
    setError(null);

    try {
      const img = new Image();
      img.src = imageDataUrl;

      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
      });

      const canvas = document.createElement('canvas');
      let ctx = canvas.getContext('2d');

      // Start with original dimensions
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);

      // Auto-crop: Detect document edges
      if (autoCrop) {
        const croppedCanvas = detectAndCropDocument(canvas);
        canvas.width = croppedCanvas.width;
        canvas.height = croppedCanvas.height;
        ctx = canvas.getContext('2d');
        ctx.drawImage(croppedCanvas, 0, 0);
      }

      // Auto-enhance: Improve contrast, brightness, and sharpness
      if (autoEnhance) {
        enhanceDocument(canvas);
      }

      const processedDataUrl = canvas.toDataURL('image/jpeg', 0.95);
      setProcessedImage(processedDataUrl);
    } catch (err) {
      console.error('Error processing image:', err);
      setError('Failed to process image');
      setProcessedImage(imageDataUrl); // Fallback to original
    } finally {
      setIsProcessing(false);
    }
  };

  // Detect document edges and crop
  const detectAndCropDocument = (canvas) => {
    const ctx = canvas.getContext('2d');
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    // Convert to grayscale and find edges
    const gray = new Uint8Array(canvas.width * canvas.height);
    for (let i = 0; i < data.length; i += 4) {
      const avg = (data[i] + data[i + 1] + data[i + 2]) / 3;
      gray[i / 4] = avg;
    }

    // Find bounding box by detecting significant content
    let minX = canvas.width, minY = canvas.height;
    let maxX = 0, maxY = 0;
    const threshold = 240; // Threshold for detecting document edges
    const margin = 20; // Pixels to search from edges

    // Search from edges inward
    for (let y = 0; y < canvas.height; y++) {
      for (let x = 0; x < canvas.width; x++) {
        const idx = y * canvas.width + x;
        if (gray[idx] < threshold) {
          minX = Math.min(minX, x);
          minY = Math.min(minY, y);
          maxX = Math.max(maxX, x);
          maxY = Math.max(maxY, y);
        }
      }
    }

    // Add some padding and ensure we have valid bounds
    const padding = 10;
    minX = Math.max(0, minX - padding);
    minY = Math.max(0, minY - padding);
    maxX = Math.min(canvas.width - 1, maxX + padding);
    maxY = Math.min(canvas.height - 1, maxY + padding);

    const cropWidth = maxX - minX;
    const cropHeight = maxY - minY;

    // Only crop if we found a reasonable bounding box (at least 30% of original)
    if (cropWidth > canvas.width * 0.3 && cropHeight > canvas.height * 0.3) {
      const croppedCanvas = document.createElement('canvas');
      croppedCanvas.width = cropWidth;
      croppedCanvas.height = cropHeight;
      const croppedCtx = croppedCanvas.getContext('2d');
      croppedCtx.drawImage(canvas, minX, minY, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);
      return croppedCanvas;
    }

    return canvas;
  };

  // Enhance document image
  const enhanceDocument = (canvas) => {
    const ctx = canvas.getContext('2d');
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    // Increase contrast and brightness
    const contrast = 1.3;
    const brightness = 10;

    for (let i = 0; i < data.length; i += 4) {
      // Apply contrast
      data[i] = ((data[i] - 128) * contrast + 128) + brightness;
      data[i + 1] = ((data[i + 1] - 128) * contrast + 128) + brightness;
      data[i + 2] = ((data[i + 2] - 128) * contrast + 128) + brightness;

      // Clamp values
      data[i] = Math.max(0, Math.min(255, data[i]));
      data[i + 1] = Math.max(0, Math.min(255, data[i + 1]));
      data[i + 2] = Math.max(0, Math.min(255, data[i + 2]));
    }

    ctx.putImageData(imageData, 0, 0);

    // Apply sharpening filter
    const sharpness = [
      0, -1, 0,
      -1, 5, -1,
      0, -1, 0
    ];

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = canvas.width;
    tempCanvas.height = canvas.height;
    const tempCtx = tempCanvas.getContext('2d');
    tempCtx.drawImage(canvas, 0, 0);

    const original = tempCtx.getImageData(0, 0, canvas.width, canvas.height);
    const output = ctx.createImageData(canvas.width, canvas.height);

    // Apply convolution filter
    for (let y = 1; y < canvas.height - 1; y++) {
      for (let x = 1; x < canvas.width - 1; x++) {
        for (let c = 0; c < 3; c++) {
          let sum = 0;
          for (let ky = -1; ky <= 1; ky++) {
            for (let kx = -1; kx <= 1; kx++) {
              const idx = ((y + ky) * canvas.width + (x + kx)) * 4 + c;
              const kernelIdx = (ky + 1) * 3 + (kx + 1);
              sum += original.data[idx] * sharpness[kernelIdx];
            }
          }
          const outIdx = (y * canvas.width + x) * 4 + c;
          output.data[outIdx] = Math.max(0, Math.min(255, sum));
        }
        // Copy alpha channel
        const alphaIdx = (y * canvas.width + x) * 4 + 3;
        output.data[alphaIdx] = 255;
      }
    }

    ctx.putImageData(output, 0, 0);
  };

  // Upload to Google Drive
  const uploadToGoogleDrive = async () => {
    if (!processedImage) return;

    setIsUploading(true);
    setError(null);

    try {
      // Convert data URL to blob
      const response = await fetch(processedImage);
      const blob = await response.blob();

      // Create a unique filename
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `Scan_${timestamp}.jpg`;

      // Create metadata
      const metadata = {
        name: filename,
        mimeType: 'image/jpeg',
        parents: [customerFolderId]
      };

      // Create form data for multipart upload
      const form = new FormData();
      form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
      form.append('file', blob);

      // Upload to Google Drive
      const token = window.gapi.auth.getToken();
      const uploadResponse = await fetch(
        'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token.access_token}`,
          },
          body: form
        }
      );

      if (!uploadResponse.ok) {
        throw new Error(`Upload failed: ${uploadResponse.status}`);
      }

      const result = await uploadResponse.json();
      console.log('Document uploaded:', result);

      // Reset scanner
      resetScanner();

      // Notify parent component
      if (onScanComplete) {
        onScanComplete(result);
      }

      alert('Document scanned and saved successfully!');
    } catch (err) {
      console.error('Error uploading to Google Drive:', err);
      setError('Failed to upload document. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  // Reset scanner
  const resetScanner = () => {
    setCapturedImage(null);
    setProcessedImage(null);
    setError(null);
  };

  // Retake photo
  const retakePhoto = () => {
    resetScanner();
    startCamera();
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  return (
    <div className="document-scanner">
      <div className="scanner-header">
        <h3>Document Scanner</h3>
        <p className="scanner-hint">
          Scan documents and save them directly to {customerName}'s folder
        </p>
      </div>

      {error && (
        <div className="error-banner">
          <p>⚠️ {error}</p>
        </div>
      )}

      <div className="scanner-body">
        {!cameraActive && !capturedImage && !cameraLoading && (
          <div className="scanner-start">
            <button className="btn btn-large btn-primary" onClick={startCamera}>
              📷 Start Camera
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
            <div className="camera-controls">
              <button className="btn btn-secondary" onClick={stopCamera}>
                Cancel
              </button>
              <button className="btn btn-primary btn-capture" onClick={capturePhoto}>
                📸 Capture
              </button>
            </div>
          </div>
        )}

        {capturedImage && (
          <div className="preview-view">
            <div className="preview-options">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={autoCrop}
                  onChange={(e) => {
                    setAutoCrop(e.target.checked);
                    processImage(capturedImage);
                  }}
                />
                <span>Auto-Crop</span>
              </label>
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={autoEnhance}
                  onChange={(e) => {
                    setAutoEnhance(e.target.checked);
                    processImage(capturedImage);
                  }}
                />
                <span>Auto-Enhance</span>
              </label>
            </div>

            {isProcessing ? (
              <div className="processing-state">
                <div className="loading"></div>
                <p>Processing image...</p>
              </div>
            ) : (
              <div className="preview-images">
                <div className="preview-image">
                  <h4>Original</h4>
                  <img src={capturedImage} alt="Original capture" />
                </div>
                <div className="preview-image">
                  <h4>Processed</h4>
                  <img src={processedImage || capturedImage} alt="Processed capture" />
                </div>
              </div>
            )}

            <div className="preview-controls">
              <button className="btn btn-secondary" onClick={retakePhoto}>
                Retake
              </button>
              <button
                className="btn btn-primary"
                onClick={uploadToGoogleDrive}
                disabled={isUploading || isProcessing}
              >
                {isUploading ? 'Uploading...' : 'Save to Drive'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default DocumentScanner;
