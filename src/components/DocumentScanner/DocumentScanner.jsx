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

      // Set camera active FIRST to render the video element
      setCameraActive(true);

      // Wait a tick for React to render the video element
      await new Promise(resolve => setTimeout(resolve, 100));

      if (!videoRef.current) {
        console.error('Video ref is still null after render!');
        setCameraLoading(false);
        setCameraActive(false);
        setError('Video element not ready. Please try again.');
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
        setCameraActive(false);
        setError('Failed to initialize video. Please try again.');
        stream.getTracks().forEach(track => track.stop());
        return;
      }

      // Explicitly play the video (required in some browsers)
      try {
        console.log('Attempting to play video...');
        await video.play();
        console.log('Video playing successfully');
        setCameraLoading(false);
      } catch (playError) {
        console.error('Error playing video:', playError);
        setCameraLoading(false);
        setCameraActive(false);
        setError('Unable to start video playback. Please try again.');
        stream.getTracks().forEach(track => track.stop());
      }
    } catch (err) {
      console.error('Error accessing camera:', err);
      setCameraLoading(false);
      setCameraActive(false);
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
    const width = canvas.width;
    const height = canvas.height;

    // Convert to grayscale
    const gray = new Uint8ClampedArray(width * height);
    for (let i = 0; i < imageData.data.length; i += 4) {
      const avg = (imageData.data[i] + imageData.data[i + 1] + imageData.data[i + 2]) / 3;
      gray[i / 4] = avg;
    }

    // Apply Gaussian blur to reduce noise
    const blurred = gaussianBlur(gray, width, height);

    // Canny edge detection
    const edges = cannyEdgeDetection(blurred, width, height);

    // Find contours
    const contours = findContours(edges, width, height);

    // Find the largest quadrilateral contour (likely the document)
    const docContour = findDocumentContour(contours, width, height);

    if (docContour) {
      console.log('Document detected, applying perspective correction');
      // Apply perspective transform
      return applyPerspectiveTransform(canvas, docContour);
    }

    console.log('Document not detected, returning original');
    return canvas;
  };

  // Gaussian blur for noise reduction
  const gaussianBlur = (gray, width, height) => {
    const result = new Uint8ClampedArray(gray.length);
    const kernel = [1, 4, 6, 4, 1, 4, 16, 24, 16, 4, 6, 24, 36, 24, 6, 4, 16, 24, 16, 4, 1, 4, 6, 4, 1];
    const kernelSum = 256;

    for (let y = 2; y < height - 2; y++) {
      for (let x = 2; x < width - 2; x++) {
        let sum = 0;
        for (let ky = -2; ky <= 2; ky++) {
          for (let kx = -2; kx <= 2; kx++) {
            const idx = (y + ky) * width + (x + kx);
            sum += gray[idx] * kernel[(ky + 2) * 5 + (kx + 2)];
          }
        }
        result[y * width + x] = sum / kernelSum;
      }
    }
    return result;
  };

  // Canny edge detection
  const cannyEdgeDetection = (gray, width, height) => {
    const edges = new Uint8ClampedArray(width * height);

    // Sobel operator for gradient calculation
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const gx =
          -gray[(y - 1) * width + (x - 1)] + gray[(y - 1) * width + (x + 1)] +
          -2 * gray[y * width + (x - 1)] + 2 * gray[y * width + (x + 1)] +
          -gray[(y + 1) * width + (x - 1)] + gray[(y + 1) * width + (x + 1)];

        const gy =
          -gray[(y - 1) * width + (x - 1)] - 2 * gray[(y - 1) * width + x] - gray[(y - 1) * width + (x + 1)] +
          gray[(y + 1) * width + (x - 1)] + 2 * gray[(y + 1) * width + x] + gray[(y + 1) * width + (x + 1)];

        const magnitude = Math.sqrt(gx * gx + gy * gy);
        edges[y * width + x] = magnitude > 30 ? 255 : 0; // Lower threshold for better detection
      }
    }
    return edges;
  };

  // Find contours in edge image
  const findContours = (edges, width, height) => {
    const visited = new Uint8Array(width * height);
    const contours = [];

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = y * width + x;
        if (edges[idx] > 0 && !visited[idx]) {
          const contour = traceContour(edges, visited, x, y, width, height);
          if (contour.length > 50) { // Minimum contour size
            contours.push(contour);
          }
        }
      }
    }
    return contours;
  };

  // Trace a single contour
  const traceContour = (edges, visited, startX, startY, width, height) => {
    const contour = [];
    const stack = [[startX, startY]];

    while (stack.length > 0) {
      const [x, y] = stack.pop();
      const idx = y * width + x;

      if (x < 0 || x >= width || y < 0 || y >= height || visited[idx] || edges[idx] === 0) {
        continue;
      }

      visited[idx] = 1;
      contour.push({ x, y });

      // Check 8-connected neighbors
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx !== 0 || dy !== 0) {
            stack.push([x + dx, y + dy]);
          }
        }
      }
    }
    return contour;
  };

  // Find the document contour (largest quadrilateral)
  const findDocumentContour = (contours, width, height) => {
    let bestContour = null;
    let maxArea = width * height * 0.05; // Minimum 5% of image area (lowered for better detection)

    console.log(`Looking for document in ${contours.length} contours, min area: ${maxArea}`);

    for (const contour of contours) {
      const approx = approximatePolygon(contour);

      if (approx.length === 4) {
        const area = polygonArea(approx);
        console.log(`Found 4-sided contour with area: ${area}`);
        if (area > maxArea) {
          maxArea = area;
          bestContour = approx;
        }
      }
    }

    if (bestContour) {
      console.log(`Best document contour found with area: ${maxArea}`);
    }

    return bestContour;
  };

  // Approximate polygon using Douglas-Peucker algorithm
  const approximatePolygon = (contour, epsilon = 0.02) => {
    const perimeter = contour.length;
    const maxDistance = perimeter * epsilon;

    // Get convex hull first
    const hull = convexHull(contour);

    // Simplify to get corners
    return douglasPeucker(hull, maxDistance);
  };

  // Convex hull using Graham scan
  const convexHull = (points) => {
    if (points.length < 3) return points;

    // Find the point with lowest y (and leftmost if tie)
    let start = points[0];
    for (const p of points) {
      if (p.y < start.y || (p.y === start.y && p.x < start.x)) {
        start = p;
      }
    }

    // Sort points by polar angle with start point
    const sorted = points.slice().sort((a, b) => {
      const angle1 = Math.atan2(a.y - start.y, a.x - start.x);
      const angle2 = Math.atan2(b.y - start.y, b.x - start.x);
      return angle1 - angle2;
    });

    const hull = [sorted[0], sorted[1]];

    for (let i = 2; i < sorted.length; i++) {
      while (hull.length > 1) {
        const p1 = hull[hull.length - 2];
        const p2 = hull[hull.length - 1];
        const p3 = sorted[i];

        // Cross product to check if we make a left turn
        const cross = (p2.x - p1.x) * (p3.y - p1.y) - (p2.y - p1.y) * (p3.x - p1.x);

        if (cross > 0) break;
        hull.pop();
      }
      hull.push(sorted[i]);
    }

    return hull;
  };

  // Douglas-Peucker algorithm for polygon simplification
  const douglasPeucker = (points, epsilon) => {
    if (points.length < 3) return points;

    // Find the point with maximum distance from line between start and end
    let maxDist = 0;
    let index = 0;
    const start = points[0];
    const end = points[points.length - 1];

    for (let i = 1; i < points.length - 1; i++) {
      const dist = pointToLineDistance(points[i], start, end);
      if (dist > maxDist) {
        maxDist = dist;
        index = i;
      }
    }

    // If max distance is greater than epsilon, recursively simplify
    if (maxDist > epsilon) {
      const left = douglasPeucker(points.slice(0, index + 1), epsilon);
      const right = douglasPeucker(points.slice(index), epsilon);
      return left.slice(0, -1).concat(right);
    }

    return [start, end];
  };

  // Point to line distance
  const pointToLineDistance = (point, lineStart, lineEnd) => {
    const dx = lineEnd.x - lineStart.x;
    const dy = lineEnd.y - lineStart.y;
    const num = Math.abs(dy * point.x - dx * point.y + lineEnd.x * lineStart.y - lineEnd.y * lineStart.x);
    const den = Math.sqrt(dx * dx + dy * dy);
    return num / den;
  };

  // Calculate polygon area
  const polygonArea = (points) => {
    let area = 0;
    for (let i = 0; i < points.length; i++) {
      const j = (i + 1) % points.length;
      area += points[i].x * points[j].y;
      area -= points[j].x * points[i].y;
    }
    return Math.abs(area / 2);
  };

  // Apply perspective transform to correct document
  const applyPerspectiveTransform = (canvas, corners) => {
    // Order corners: top-left, top-right, bottom-right, bottom-left
    const ordered = orderCorners(corners);

    // Calculate output dimensions
    const widthTop = distance(ordered[0], ordered[1]);
    const widthBottom = distance(ordered[3], ordered[2]);
    const heightLeft = distance(ordered[0], ordered[3]);
    const heightRight = distance(ordered[1], ordered[2]);

    const maxWidth = Math.max(widthTop, widthBottom);
    const maxHeight = Math.max(heightLeft, heightRight);

    // Create output canvas
    const outputCanvas = document.createElement('canvas');
    outputCanvas.width = maxWidth;
    outputCanvas.height = maxHeight;
    const outputCtx = outputCanvas.getContext('2d');

    // Destination corners (rectangle)
    const dst = [
      { x: 0, y: 0 },
      { x: maxWidth, y: 0 },
      { x: maxWidth, y: maxHeight },
      { x: 0, y: maxHeight }
    ];

    // Apply perspective transform using inverse mapping
    // We need inverse transform: dst coords -> src coords
    // So we compute the transform from dst to ordered (not ordered to dst)
    const transform = getPerspectiveTransform(dst, ordered);

    const srcImageData = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height);
    const dstImageData = outputCtx.createImageData(maxWidth, maxHeight);

    for (let y = 0; y < maxHeight; y++) {
      for (let x = 0; x < maxWidth; x++) {
        const srcPoint = applyTransform({ x, y }, transform);

        if (srcPoint.x >= 0 && srcPoint.x < canvas.width - 1 &&
            srcPoint.y >= 0 && srcPoint.y < canvas.height - 1) {

          // Bilinear interpolation for better quality
          const x0 = Math.floor(srcPoint.x);
          const y0 = Math.floor(srcPoint.y);
          const x1 = x0 + 1;
          const y1 = y0 + 1;

          const fx = srcPoint.x - x0;
          const fy = srcPoint.y - y0;

          const idx00 = (y0 * canvas.width + x0) * 4;
          const idx10 = (y0 * canvas.width + x1) * 4;
          const idx01 = (y1 * canvas.width + x0) * 4;
          const idx11 = (y1 * canvas.width + x1) * 4;

          const dstIdx = (y * maxWidth + x) * 4;

          // Interpolate each channel
          for (let c = 0; c < 3; c++) {
            const v00 = srcImageData.data[idx00 + c];
            const v10 = srcImageData.data[idx10 + c];
            const v01 = srcImageData.data[idx01 + c];
            const v11 = srcImageData.data[idx11 + c];

            const v0 = v00 * (1 - fx) + v10 * fx;
            const v1 = v01 * (1 - fx) + v11 * fx;
            const v = v0 * (1 - fy) + v1 * fy;

            dstImageData.data[dstIdx + c] = Math.round(v);
          }
          dstImageData.data[dstIdx + 3] = 255;
        }
      }
    }

    outputCtx.putImageData(dstImageData, 0, 0);
    return outputCanvas;
  };

  // Order corners: TL, TR, BR, BL
  const orderCorners = (corners) => {
    // Sort by y-coordinate
    const sorted = corners.slice().sort((a, b) => a.y - b.y);

    // Top two points
    const top = sorted.slice(0, 2).sort((a, b) => a.x - b.x);
    // Bottom two points
    const bottom = sorted.slice(2).sort((a, b) => a.x - b.x);

    return [top[0], top[1], bottom[1], bottom[0]];
  };

  // Distance between two points
  const distance = (p1, p2) => {
    return Math.sqrt((p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2);
  };

  // Get perspective transformation matrix (homography)
  const getPerspectiveTransform = (src, dst) => {
    // Calculate the homography matrix for perspective transform
    // We need to solve: dst = H * src where H is 3x3 homography matrix

    // Build the system of equations Ax = b
    const A = [];
    const b = [];

    for (let i = 0; i < 4; i++) {
      A.push([
        src[i].x, src[i].y, 1, 0, 0, 0, -dst[i].x * src[i].x, -dst[i].x * src[i].y
      ]);
      A.push([
        0, 0, 0, src[i].x, src[i].y, 1, -dst[i].y * src[i].x, -dst[i].y * src[i].y
      ]);

      b.push(dst[i].x);
      b.push(dst[i].y);
    }

    // Solve Ax = b using Gaussian elimination
    const h = solveLinearSystem(A, b);

    // Return as 3x3 matrix
    return {
      h11: h[0], h12: h[1], h13: h[2],
      h21: h[3], h22: h[4], h23: h[5],
      h31: h[6], h32: h[7], h33: 1
    };
  };

  // Solve linear system using Gaussian elimination
  const solveLinearSystem = (A, b) => {
    const n = A.length;
    const augmented = A.map((row, i) => [...row, b[i]]);

    // Forward elimination
    for (let i = 0; i < n; i++) {
      // Find pivot
      let maxRow = i;
      for (let k = i + 1; k < n; k++) {
        if (Math.abs(augmented[k][i]) > Math.abs(augmented[maxRow][i])) {
          maxRow = k;
        }
      }

      // Swap rows
      [augmented[i], augmented[maxRow]] = [augmented[maxRow], augmented[i]];

      // Make all rows below this one 0 in current column
      for (let k = i + 1; k < n; k++) {
        const factor = augmented[k][i] / augmented[i][i];
        for (let j = i; j < n + 1; j++) {
          augmented[k][j] -= factor * augmented[i][j];
        }
      }
    }

    // Back substitution
    const x = new Array(n).fill(0);
    for (let i = n - 1; i >= 0; i--) {
      x[i] = augmented[i][n];
      for (let j = i + 1; j < n; j++) {
        x[i] -= augmented[i][j] * x[j];
      }
      x[i] /= augmented[i][i];
    }

    return x;
  };

  // Apply transform to point using homography
  const applyTransform = (point, transform) => {
    const { h11, h12, h13, h21, h22, h23, h31, h32, h33 } = transform;

    const x = point.x;
    const y = point.y;

    const denominator = h31 * x + h32 * y + h33;

    return {
      x: (h11 * x + h12 * y + h13) / denominator,
      y: (h21 * x + h22 * y + h23) / denominator
    };
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
      // Convert data URL to base64 (remove data:image/jpeg;base64, prefix)
      const base64Data = processedImage.split(',')[1];

      // Create a unique filename
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `Scan_${timestamp}.jpg`;

      console.log('Uploading document to Google Drive:', filename);

      // Upload using Google Drive API
      const boundary = '-------314159265358979323846';
      const delimiter = "\r\n--" + boundary + "\r\n";
      const close_delim = "\r\n--" + boundary + "--";

      const metadata = {
        name: filename,
        mimeType: 'image/jpeg',
        parents: [customerFolderId]
      };

      const multipartRequestBody =
        delimiter +
        'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
        JSON.stringify(metadata) +
        delimiter +
        'Content-Type: image/jpeg\r\n' +
        'Content-Transfer-Encoding: base64\r\n\r\n' +
        base64Data +
        close_delim;

      const request = window.gapi.client.request({
        path: '/upload/drive/v3/files',
        method: 'POST',
        params: { uploadType: 'multipart' },
        headers: {
          'Content-Type': 'multipart/related; boundary="' + boundary + '"'
        },
        body: multipartRequestBody
      });

      const response = await request;
      console.log('Document uploaded successfully:', response.result);

      // Reset scanner
      resetScanner();

      // Notify parent component
      if (onScanComplete) {
        onScanComplete(response.result);
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
