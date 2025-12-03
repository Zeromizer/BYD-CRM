import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import pdfGenerator from '../../services/pdfGenerator';
import oneDriveService from '../../services/oneDriveService';
import './DocumentScanner.css';

/**
 * Professional Document Scanner Component
 *
 * Features:
 * - Live camera with real-time document edge detection
 * - Interactive corner adjustment
 * - Multiple filter presets (Original, Auto, B&W, Grayscale, Magic Color)
 * - Manual adjustments (brightness, contrast, rotation)
 * - Multi-page document support
 * - Page reordering, deletion, retake
 * - Export to PDF or images
 * - OneDrive upload
 */

// Scanner view modes
const VIEW_MODES = {
  START: 'start',
  CAMERA: 'camera',
  CROP: 'crop',
  ENHANCE: 'enhance',
  GALLERY: 'gallery',
  EXPORT: 'export'
};

// Filter presets
const FILTERS = {
  original: { name: 'Original', brightness: 0, contrast: 0, saturation: 100, grayscale: false, bw: false },
  auto: { name: 'Auto', brightness: 10, contrast: 20, saturation: 110, grayscale: false, bw: false },
  bw: { name: 'B&W', brightness: 5, contrast: 30, saturation: 0, grayscale: false, bw: true },
  grayscale: { name: 'Grayscale', brightness: 0, contrast: 10, saturation: 0, grayscale: true, bw: false },
  magic: { name: 'Magic', brightness: 15, contrast: 25, saturation: 120, grayscale: false, bw: false }
};

function DocumentScanner({ customerId, customerName, customerFolderId, onScanComplete, onClose }) {
  // View state
  const [viewMode, setViewMode] = useState(VIEW_MODES.START);
  const [cameraLoading, setCameraLoading] = useState(false);
  const [error, setError] = useState(null);

  // Camera state
  const [flashMode, setFlashMode] = useState('off'); // off, on
  const [facingMode, setFacingMode] = useState('environment');
  const [detectedCorners, setDetectedCorners] = useState(null);
  const [isStable, setIsStable] = useState(false);
  const [autoCapture, setAutoCapture] = useState(true);
  const [focusPoint, setFocusPoint] = useState(null); // For tap-to-focus indicator

  // Document state
  const [pages, setPages] = useState([]);
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [capturedImage, setCapturedImage] = useState(null);

  // Crop state
  const [corners, setCorners] = useState(null);
  const [draggingCorner, setDraggingCorner] = useState(null);
  const [imageDimensions, setImageDimensions] = useState({ width: 1920, height: 1080 });
  const [overlayStyle, setOverlayStyle] = useState({});

  // Enhancement state
  const [currentFilter, setCurrentFilter] = useState('auto');
  const [brightness, setBrightness] = useState(0);
  const [contrast, setContrast] = useState(0);
  const [rotation, setRotation] = useState(0);

  // Export state
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);

  // Refs
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const overlayCanvasRef = useRef(null);
  const streamRef = useRef(null);
  const imageCaptureRef = useRef(null); // For ImageCapture API
  const detectionIntervalRef = useRef(null);
  const stableCountRef = useRef(0);
  const lastCornersRef = useRef(null);
  const cropContainerRef = useRef(null);
  const cropImageRef = useRef(null);
  const enhanceCanvasRef = useRef(null);

  // ========================================
  // CAMERA FUNCTIONS
  // ========================================

  const startCamera = async () => {
    try {
      setError(null);
      setCameraLoading(true);

      // Simple camera constraints - let device handle focus naturally
      // This matches IDScanner which has better focus quality
      const constraints = {
        video: {
          facingMode: facingMode,
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        }
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      // Apply torch/flash if enabled (after stream is obtained)
      if (flashMode === 'on' && facingMode === 'environment') {
        const track = stream.getVideoTracks()[0];
        try {
          await track.applyConstraints({
            advanced: [{ torch: true }]
          });
        } catch (e) {
          console.log('Torch not supported:', e);
        }
      }

      setViewMode(VIEW_MODES.CAMERA);

      await new Promise(resolve => setTimeout(resolve, 100));

      if (videoRef.current) {
        videoRef.current.srcObject = stream;

        await new Promise((resolve, reject) => {
          const timeout = setTimeout(resolve, 3000);
          if (videoRef.current.readyState >= 1) {
            clearTimeout(timeout);
            resolve();
            return;
          }
          videoRef.current.onloadedmetadata = () => {
            clearTimeout(timeout);
            resolve();
          };
          videoRef.current.onerror = reject;
        });

        await videoRef.current.play();
        startEdgeDetection();
      }

      setCameraLoading(false);
    } catch (err) {
      console.error('Camera error:', err);
      setCameraLoading(false);
      setError(`Unable to access camera: ${err.message}`);
    }
  };

  const stopCamera = useCallback(() => {
    if (detectionIntervalRef.current) {
      cancelAnimationFrame(detectionIntervalRef.current);
      detectionIntervalRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    imageCaptureRef.current = null;
    setDetectedCorners(null);
    setIsStable(false);
    stableCountRef.current = 0;
  }, []);

  const toggleFlash = async () => {
    if (!streamRef.current) return;

    const track = streamRef.current.getVideoTracks()[0];
    if (track && track.getCapabilities && track.getCapabilities().torch) {
      const newFlashMode = flashMode === 'off' ? 'on' : 'off';
      try {
        await track.applyConstraints({ advanced: [{ torch: newFlashMode === 'on' }] });
        setFlashMode(newFlashMode);
      } catch (e) {
        console.warn('Flash not supported:', e);
      }
    }
  };

  const switchCamera = async () => {
    stopCamera();
    const newFacing = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(newFacing);
    // Camera will restart with new facing mode
    setTimeout(() => startCamera(), 200);
  };

  // Tap to focus on a point - uses multiple strategies for best compatibility
  const handleTapToFocus = async (e) => {
    if (!videoRef.current || !streamRef.current) return;

    // Prevent double-firing on touch devices
    if (e.type === 'click' && e.pointerType === 'touch') return;

    const video = videoRef.current;
    const rect = video.getBoundingClientRect();

    // Get tap position
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;

    const x = clientX - rect.left;
    const y = clientY - rect.top;

    // Calculate normalized coordinates (0-1)
    const pointX = Math.max(0, Math.min(1, x / rect.width));
    const pointY = Math.max(0, Math.min(1, y / rect.height));

    // Show focus indicator
    setFocusPoint({ x: clientX, y: clientY });

    const track = streamRef.current.getVideoTracks()[0];
    if (!track) return;

    const capabilities = track.getCapabilities ? track.getCapabilities() : {};
    let focusTriggered = false;

    // Strategy 1: Use ImageCapture API to trigger single-shot autofocus
    if (imageCaptureRef.current) {
      try {
        const photoCapabilities = await imageCaptureRef.current.getPhotoCapabilities();

        // Check if we can set focus point
        if (photoCapabilities.focusMode && photoCapabilities.focusMode.includes('single-shot')) {
          // Trigger single-shot autofocus by grabbing a frame
          await imageCaptureRef.current.grabFrame();
          focusTriggered = true;
        }
      } catch (e) {
        // ImageCapture focus not supported
      }
    }

    // Strategy 2: Use pointsOfInterest constraint (Chrome Android)
    if (!focusTriggered && capabilities.pointsOfInterest) {
      try {
        await track.applyConstraints({
          advanced: [{
            pointsOfInterest: [{ x: pointX, y: pointY }]
          }]
        });
        focusTriggered = true;
      } catch (e) {
        // pointsOfInterest not supported
      }
    }

    // Strategy 3: Toggle focus mode to trigger refocus
    if (!focusTriggered && capabilities.focusMode) {
      const modes = capabilities.focusMode;

      try {
        // If single-shot is available, use it then switch back to continuous
        if (modes.includes('single-shot')) {
          await track.applyConstraints({
            advanced: [{ focusMode: 'single-shot' }]
          });

          // After focus completes, switch back to continuous
          setTimeout(async () => {
            try {
              if (modes.includes('continuous')) {
                await track.applyConstraints({
                  advanced: [{ focusMode: 'continuous' }]
                });
              }
            } catch (e) {
              // Ignore
            }
          }, 1500);
          focusTriggered = true;
        }
        // Otherwise toggle continuous to trigger refocus
        else if (modes.includes('continuous')) {
          // Toggle off and on to trigger refocus
          if (modes.includes('manual')) {
            await track.applyConstraints({
              advanced: [{ focusMode: 'manual' }]
            });
            await new Promise(r => setTimeout(r, 100));
          }
          await track.applyConstraints({
            advanced: [{ focusMode: 'continuous' }]
          });
          focusTriggered = true;
        }
      } catch (e) {
        console.log('Focus mode toggle failed:', e);
      }
    }

    // Strategy 4: Adjust focus distance if available (some Android devices)
    if (!focusTriggered && capabilities.focusDistance) {
      try {
        const { min, max } = capabilities.focusDistance;
        // Focus at middle distance (good for documents)
        const midFocus = (min + max) / 2;
        await track.applyConstraints({
          advanced: [{ focusDistance: midFocus }]
        });
        focusTriggered = true;
      } catch (e) {
        // Focus distance not supported
      }
    }

    // Clear focus indicator after animation
    setTimeout(() => setFocusPoint(null), 1000);

    // Log for debugging
    if (!focusTriggered) {
      console.log('No focus method available. Camera capabilities:', capabilities);
    }
  };

  // ========================================
  // EDGE DETECTION
  // ========================================

  const startEdgeDetection = () => {
    const detect = () => {
      if (!videoRef.current || !overlayCanvasRef.current || !canvasRef.current) {
        detectionIntervalRef.current = requestAnimationFrame(detect);
        return;
      }

      const video = videoRef.current;
      const overlay = overlayCanvasRef.current;
      const ctx = overlay.getContext('2d');

      // Match overlay size to video display size
      const rect = video.getBoundingClientRect();
      overlay.width = rect.width;
      overlay.height = rect.height;

      // Clear overlay
      ctx.clearRect(0, 0, overlay.width, overlay.height);

      // Process video frame for edge detection
      const tempCanvas = canvasRef.current;
      const tempCtx = tempCanvas.getContext('2d');

      // Use lower resolution for detection
      const scale = 0.25;
      tempCanvas.width = video.videoWidth * scale;
      tempCanvas.height = video.videoHeight * scale;

      tempCtx.drawImage(video, 0, 0, tempCanvas.width, tempCanvas.height);

      // Detect document edges
      const documentCorners = detectDocumentEdges(tempCanvas, scale);

      if (documentCorners) {
        // Scale corners to overlay size
        const scaleX = overlay.width / video.videoWidth;
        const scaleY = overlay.height / video.videoHeight;

        const scaledCorners = documentCorners.map(c => ({
          x: c.x * scaleX,
          y: c.y * scaleY
        }));

        // Draw detection overlay
        drawDetectionOverlay(ctx, scaledCorners, overlay.width, overlay.height);
        setDetectedCorners(documentCorners);

        // Check stability for auto-capture
        checkStability(documentCorners);
      } else {
        setDetectedCorners(null);
        setIsStable(false);
        stableCountRef.current = 0;
      }

      detectionIntervalRef.current = requestAnimationFrame(detect);
    };

    detect();
  };

  const detectDocumentEdges = (canvas, scale) => {
    const ctx = canvas.getContext('2d');
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const width = canvas.width;
    const height = canvas.height;

    // Convert to grayscale
    const gray = new Uint8ClampedArray(width * height);
    for (let i = 0; i < imageData.data.length; i += 4) {
      gray[i / 4] = (imageData.data[i] * 0.299 + imageData.data[i + 1] * 0.587 + imageData.data[i + 2] * 0.114);
    }

    // Apply Gaussian blur
    const blurred = gaussianBlur(gray, width, height);

    // Canny edge detection
    const edges = cannyEdgeDetection(blurred, width, height);

    // Find contours
    const contours = findContours(edges, width, height);

    // Find document quadrilateral
    const docContour = findDocumentContour(contours, width, height);

    if (docContour) {
      // Scale back to original video dimensions
      return docContour.map(c => ({
        x: c.x / scale,
        y: c.y / scale
      }));
    }

    return null;
  };

  const gaussianBlur = (gray, width, height) => {
    const result = new Uint8ClampedArray(gray.length);
    const kernel = [1, 4, 6, 4, 1, 4, 16, 24, 16, 4, 6, 24, 36, 24, 6, 4, 16, 24, 16, 4, 1, 4, 6, 4, 1];
    const kernelSum = 256;

    for (let y = 2; y < height - 2; y++) {
      for (let x = 2; x < width - 2; x++) {
        let sum = 0;
        for (let ky = -2; ky <= 2; ky++) {
          for (let kx = -2; kx <= 2; kx++) {
            sum += gray[(y + ky) * width + (x + kx)] * kernel[(ky + 2) * 5 + (kx + 2)];
          }
        }
        result[y * width + x] = sum / kernelSum;
      }
    }
    return result;
  };

  const cannyEdgeDetection = (gray, width, height) => {
    const edges = new Uint8ClampedArray(width * height);

    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const gx = -gray[(y - 1) * width + (x - 1)] + gray[(y - 1) * width + (x + 1)] +
                   -2 * gray[y * width + (x - 1)] + 2 * gray[y * width + (x + 1)] +
                   -gray[(y + 1) * width + (x - 1)] + gray[(y + 1) * width + (x + 1)];

        const gy = -gray[(y - 1) * width + (x - 1)] - 2 * gray[(y - 1) * width + x] - gray[(y - 1) * width + (x + 1)] +
                   gray[(y + 1) * width + (x - 1)] + 2 * gray[(y + 1) * width + x] + gray[(y + 1) * width + (x + 1)];

        const magnitude = Math.sqrt(gx * gx + gy * gy);
        edges[y * width + x] = magnitude > 25 ? 255 : 0;
      }
    }
    return edges;
  };

  const findContours = (edges, width, height) => {
    const visited = new Uint8Array(width * height);
    const contours = [];

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = y * width + x;
        if (edges[idx] > 0 && !visited[idx]) {
          const contour = [];
          const stack = [[x, y]];

          while (stack.length > 0) {
            const [cx, cy] = stack.pop();
            const cidx = cy * width + cx;

            if (cx < 0 || cx >= width || cy < 0 || cy >= height || visited[cidx] || edges[cidx] === 0) {
              continue;
            }

            visited[cidx] = 1;
            contour.push({ x: cx, y: cy });

            for (let dy = -1; dy <= 1; dy++) {
              for (let dx = -1; dx <= 1; dx++) {
                if (dx !== 0 || dy !== 0) {
                  stack.push([cx + dx, cy + dy]);
                }
              }
            }
          }

          if (contour.length > 30) {
            contours.push(contour);
          }
        }
      }
    }
    return contours;
  };

  const findDocumentContour = (contours, width, height) => {
    let bestContour = null;
    let maxArea = width * height * 0.08;

    for (const contour of contours) {
      const hull = convexHull(contour);
      const approx = simplifyPolygon(hull, hull.length * 0.02);

      if (approx.length === 4) {
        const area = polygonArea(approx);
        if (area > maxArea && area < width * height * 0.95) {
          if (isValidQuadrilateral(approx, width, height)) {
            maxArea = area;
            bestContour = orderCorners(approx);
          }
        }
      }
    }

    return bestContour;
  };

  const convexHull = (points) => {
    if (points.length < 3) return points;

    let start = points[0];
    for (const p of points) {
      if (p.y < start.y || (p.y === start.y && p.x < start.x)) {
        start = p;
      }
    }

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
        const cross = (p2.x - p1.x) * (p3.y - p1.y) - (p2.y - p1.y) * (p3.x - p1.x);
        if (cross > 0) break;
        hull.pop();
      }
      hull.push(sorted[i]);
    }

    return hull;
  };

  const simplifyPolygon = (points, epsilon) => {
    if (points.length < 3) return points;

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

    if (maxDist > epsilon) {
      const left = simplifyPolygon(points.slice(0, index + 1), epsilon);
      const right = simplifyPolygon(points.slice(index), epsilon);
      return left.slice(0, -1).concat(right);
    }

    return [start, end];
  };

  const pointToLineDistance = (point, lineStart, lineEnd) => {
    const dx = lineEnd.x - lineStart.x;
    const dy = lineEnd.y - lineStart.y;
    const num = Math.abs(dy * point.x - dx * point.y + lineEnd.x * lineStart.y - lineEnd.y * lineStart.x);
    const den = Math.sqrt(dx * dx + dy * dy);
    return den === 0 ? 0 : num / den;
  };

  const polygonArea = (points) => {
    let area = 0;
    for (let i = 0; i < points.length; i++) {
      const j = (i + 1) % points.length;
      area += points[i].x * points[j].y;
      area -= points[j].x * points[i].y;
    }
    return Math.abs(area / 2);
  };

  const isValidQuadrilateral = (corners, width, height) => {
    // Check minimum size
    const area = polygonArea(corners);
    if (area < width * height * 0.08) return false;

    // Check angles (should be roughly 90 degrees at each corner)
    for (let i = 0; i < 4; i++) {
      const p1 = corners[(i + 3) % 4];
      const p2 = corners[i];
      const p3 = corners[(i + 1) % 4];

      const v1 = { x: p1.x - p2.x, y: p1.y - p2.y };
      const v2 = { x: p3.x - p2.x, y: p3.y - p2.y };

      const dot = v1.x * v2.x + v1.y * v2.y;
      const mag1 = Math.sqrt(v1.x * v1.x + v1.y * v1.y);
      const mag2 = Math.sqrt(v2.x * v2.x + v2.y * v2.y);

      const cosAngle = dot / (mag1 * mag2);
      const angle = Math.acos(Math.max(-1, Math.min(1, cosAngle))) * 180 / Math.PI;

      if (angle < 45 || angle > 135) return false;
    }

    return true;
  };

  const orderCorners = (corners) => {
    const sorted = corners.slice().sort((a, b) => a.y - b.y);
    const top = sorted.slice(0, 2).sort((a, b) => a.x - b.x);
    const bottom = sorted.slice(2).sort((a, b) => a.x - b.x);
    return [top[0], top[1], bottom[1], bottom[0]];
  };

  const drawDetectionOverlay = (ctx, corners, width, height) => {
    // Draw semi-transparent overlay outside document
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.fillRect(0, 0, width, height);

    // Cut out document area
    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath();
    ctx.moveTo(corners[0].x, corners[0].y);
    for (let i = 1; i < corners.length; i++) {
      ctx.lineTo(corners[i].x, corners[i].y);
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // Draw document outline
    const lineColor = isStable ? '#22c55e' : '#3b82f6';
    ctx.strokeStyle = lineColor;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(corners[0].x, corners[0].y);
    for (let i = 1; i < corners.length; i++) {
      ctx.lineTo(corners[i].x, corners[i].y);
    }
    ctx.closePath();
    ctx.stroke();

    // Draw corner handles
    corners.forEach(corner => {
      ctx.fillStyle = lineColor;
      ctx.beginPath();
      ctx.arc(corner.x, corner.y, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'white';
      ctx.beginPath();
      ctx.arc(corner.x, corner.y, 8, 0, Math.PI * 2);
      ctx.fill();
    });
  };

  const checkStability = (newCorners) => {
    if (!lastCornersRef.current) {
      lastCornersRef.current = newCorners;
      return;
    }

    const threshold = 5;
    let stable = true;

    for (let i = 0; i < 4; i++) {
      const dx = Math.abs(newCorners[i].x - lastCornersRef.current[i].x);
      const dy = Math.abs(newCorners[i].y - lastCornersRef.current[i].y);
      if (dx > threshold || dy > threshold) {
        stable = false;
        break;
      }
    }

    lastCornersRef.current = newCorners;

    if (stable) {
      stableCountRef.current++;
      if (stableCountRef.current >= 15) {
        setIsStable(true);
        if (autoCapture && stableCountRef.current === 15) {
          // Trigger auto-capture after a short delay
          setTimeout(() => captureDocument(), 500);
        }
      }
    } else {
      stableCountRef.current = 0;
      setIsStable(false);
    }
  };

  // ========================================
  // CAPTURE FUNCTIONS
  // ========================================

  const captureDocument = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;

    // Capture at full resolution
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const imageDataUrl = canvas.toDataURL('image/jpeg', 0.95);
    setCapturedImage(imageDataUrl);
    setImageDimensions({ width: video.videoWidth, height: video.videoHeight });

    // Set corners for cropping
    if (detectedCorners) {
      setCorners(detectedCorners);
    } else {
      // Default to full frame with small margin
      const margin = 50;
      setCorners([
        { x: margin, y: margin },
        { x: video.videoWidth - margin, y: margin },
        { x: video.videoWidth - margin, y: video.videoHeight - margin },
        { x: margin, y: video.videoHeight - margin }
      ]);
    }

    stopCamera();
    setViewMode(VIEW_MODES.CROP);
  };

  const manualCapture = () => {
    setAutoCapture(false);
    captureDocument();
  };

  // ========================================
  // CROP FUNCTIONS
  // ========================================

  const handleCornerDrag = (index, e) => {
    e.preventDefault();
    e.stopPropagation();
    setDraggingCorner(index);
  };

  const handleCropMove = useCallback((e) => {
    if (draggingCorner === null || !cropImageRef.current) return;

    e.preventDefault();
    e.stopPropagation();

    const img = cropImageRef.current;
    const imgRect = img.getBoundingClientRect();

    // Get touch or mouse position
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;

    // Direct mapping from screen to image coordinates
    const relX = clientX - imgRect.left;
    const relY = clientY - imgRect.top;

    // Convert to image coordinates (simple ratio mapping)
    const x = (relX / imgRect.width) * img.naturalWidth;
    const y = (relY / imgRect.height) * img.naturalHeight;

    // Clamp to image bounds with margin
    const margin = 30;
    const clampedX = Math.max(margin, Math.min(x, img.naturalWidth - margin));
    const clampedY = Math.max(margin, Math.min(y, img.naturalHeight - margin));

    setCorners(prev => {
      if (!prev) return prev;
      const newCorners = [...prev];
      newCorners[draggingCorner] = { x: clampedX, y: clampedY };
      return newCorners;
    });
  }, [draggingCorner]);

  const handleCropEnd = useCallback(() => {
    setDraggingCorner(null);
  }, []);

  // Calculate overlay position to match displayed image
  const updateOverlayPosition = useCallback(() => {
    if (!cropImageRef.current || !cropContainerRef.current) return;

    const img = cropImageRef.current;
    const container = cropContainerRef.current;
    const containerRect = container.getBoundingClientRect();
    const imgRect = img.getBoundingClientRect();

    // Calculate offset of image within container
    const left = imgRect.left - containerRect.left;
    const top = imgRect.top - containerRect.top;

    setOverlayStyle({
      left: `${left}px`,
      top: `${top}px`,
      width: `${imgRect.width}px`,
      height: `${imgRect.height}px`
    });
  }, []);

  // Update overlay when image loads or window resizes
  useEffect(() => {
    if (viewMode === VIEW_MODES.CROP && capturedImage) {
      // Delay to ensure image is rendered
      const timer = setTimeout(updateOverlayPosition, 100);
      window.addEventListener('resize', updateOverlayPosition);
      return () => {
        clearTimeout(timer);
        window.removeEventListener('resize', updateOverlayPosition);
      };
    }
  }, [viewMode, capturedImage, updateOverlayPosition]);

  const applyCrop = () => {
    if (!capturedImage || !corners) return;

    const img = new Image();
    img.onload = () => {
      const croppedCanvas = applyPerspectiveTransform(img, corners);
      const croppedImage = croppedCanvas.toDataURL('image/jpeg', 0.95);

      setCapturedImage(croppedImage);
      setViewMode(VIEW_MODES.ENHANCE);

      // Reset enhancement values
      setCurrentFilter('auto');
      setBrightness(FILTERS.auto.brightness);
      setContrast(FILTERS.auto.contrast);
      setRotation(0);
    };
    img.src = capturedImage;
  };

  const applyPerspectiveTransform = (img, srcCorners) => {
    const imgWidth = img.naturalWidth || img.width;
    const imgHeight = img.naturalHeight || img.height;

    // Ensure corners are valid
    if (!srcCorners || srcCorners.length !== 4) {
      console.error('Invalid corners for perspective transform');
      // Return original image as canvas
      const canvas = document.createElement('canvas');
      canvas.width = imgWidth;
      canvas.height = imgHeight;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);
      return canvas;
    }

    const ordered = orderCorners(srcCorners);

    const widthTop = distance(ordered[0], ordered[1]);
    const widthBottom = distance(ordered[3], ordered[2]);
    const heightLeft = distance(ordered[0], ordered[3]);
    const heightRight = distance(ordered[1], ordered[2]);

    const maxWidth = Math.round(Math.max(widthTop, widthBottom));
    const maxHeight = Math.round(Math.max(heightLeft, heightRight));

    // Validate dimensions
    if (maxWidth <= 0 || maxHeight <= 0 || !isFinite(maxWidth) || !isFinite(maxHeight)) {
      console.error('Invalid dimensions for perspective transform');
      const canvas = document.createElement('canvas');
      canvas.width = imgWidth;
      canvas.height = imgHeight;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);
      return canvas;
    }

    const canvas = document.createElement('canvas');
    canvas.width = maxWidth;
    canvas.height = maxHeight;
    const ctx = canvas.getContext('2d');

    // Create temporary canvas with source image
    const srcCanvas = document.createElement('canvas');
    srcCanvas.width = imgWidth;
    srcCanvas.height = imgHeight;
    const srcCtx = srcCanvas.getContext('2d');
    srcCtx.drawImage(img, 0, 0);

    const srcImageData = srcCtx.getImageData(0, 0, imgWidth, imgHeight);
    const dstImageData = ctx.createImageData(maxWidth, maxHeight);

    const dst = [
      { x: 0, y: 0 },
      { x: maxWidth, y: 0 },
      { x: maxWidth, y: maxHeight },
      { x: 0, y: maxHeight }
    ];

    try {
      const transform = getPerspectiveTransform(dst, ordered);

      // Check if transform is valid
      if (Object.values(transform).some(v => !isFinite(v))) {
        throw new Error('Invalid transform matrix');
      }

      for (let y = 0; y < maxHeight; y++) {
        for (let x = 0; x < maxWidth; x++) {
          const srcPoint = applyTransformPoint({ x, y }, transform);

          if (srcPoint.x >= 0 && srcPoint.x < imgWidth - 1 &&
              srcPoint.y >= 0 && srcPoint.y < imgHeight - 1 &&
              isFinite(srcPoint.x) && isFinite(srcPoint.y)) {

            const x0 = Math.floor(srcPoint.x);
            const y0 = Math.floor(srcPoint.y);
            const x1 = Math.min(x0 + 1, imgWidth - 1);
            const y1 = Math.min(y0 + 1, imgHeight - 1);

            const fx = srcPoint.x - x0;
            const fy = srcPoint.y - y0;

            const idx00 = (y0 * imgWidth + x0) * 4;
            const idx10 = (y0 * imgWidth + x1) * 4;
            const idx01 = (y1 * imgWidth + x0) * 4;
            const idx11 = (y1 * imgWidth + x1) * 4;

            const dstIdx = (y * maxWidth + x) * 4;

            for (let c = 0; c < 3; c++) {
              const v00 = srcImageData.data[idx00 + c] || 0;
              const v10 = srcImageData.data[idx10 + c] || 0;
              const v01 = srcImageData.data[idx01 + c] || 0;
              const v11 = srcImageData.data[idx11 + c] || 0;

              const v0 = v00 * (1 - fx) + v10 * fx;
              const v1 = v01 * (1 - fx) + v11 * fx;

              dstImageData.data[dstIdx + c] = Math.round(v0 * (1 - fy) + v1 * fy);
            }
            dstImageData.data[dstIdx + 3] = 255;
          }
        }
      }

      ctx.putImageData(dstImageData, 0, 0);
    } catch (e) {
      console.error('Perspective transform failed:', e);
      // Fallback: simple crop using bounding box
      const minX = Math.min(...ordered.map(c => c.x));
      const minY = Math.min(...ordered.map(c => c.y));
      const cropWidth = Math.max(...ordered.map(c => c.x)) - minX;
      const cropHeight = Math.max(...ordered.map(c => c.y)) - minY;

      canvas.width = cropWidth;
      canvas.height = cropHeight;
      ctx.drawImage(img, minX, minY, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);
    }

    return canvas;
  };

  const distance = (p1, p2) => {
    return Math.sqrt((p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2);
  };

  const getPerspectiveTransform = (src, dst) => {
    const A = [];
    const b = [];

    for (let i = 0; i < 4; i++) {
      A.push([src[i].x, src[i].y, 1, 0, 0, 0, -dst[i].x * src[i].x, -dst[i].x * src[i].y]);
      A.push([0, 0, 0, src[i].x, src[i].y, 1, -dst[i].y * src[i].x, -dst[i].y * src[i].y]);
      b.push(dst[i].x);
      b.push(dst[i].y);
    }

    const h = solveLinearSystem(A, b);

    return {
      h11: h[0], h12: h[1], h13: h[2],
      h21: h[3], h22: h[4], h23: h[5],
      h31: h[6], h32: h[7], h33: 1
    };
  };

  const solveLinearSystem = (A, b) => {
    const n = A.length;
    const augmented = A.map((row, i) => [...row, b[i]]);
    const EPSILON = 1e-10;

    for (let i = 0; i < n; i++) {
      let maxRow = i;
      for (let k = i + 1; k < n; k++) {
        if (Math.abs(augmented[k][i]) > Math.abs(augmented[maxRow][i])) {
          maxRow = k;
        }
      }
      [augmented[i], augmented[maxRow]] = [augmented[maxRow], augmented[i]];

      // Check for singular matrix
      if (Math.abs(augmented[i][i]) < EPSILON) {
        throw new Error('Singular matrix - cannot solve');
      }

      for (let k = i + 1; k < n; k++) {
        const factor = augmented[k][i] / augmented[i][i];
        for (let j = i; j < n + 1; j++) {
          augmented[k][j] -= factor * augmented[i][j];
        }
      }
    }

    const x = new Array(n).fill(0);
    for (let i = n - 1; i >= 0; i--) {
      x[i] = augmented[i][n];
      for (let j = i + 1; j < n; j++) {
        x[i] -= augmented[i][j] * x[j];
      }
      if (Math.abs(augmented[i][i]) < EPSILON) {
        x[i] = 0;
      } else {
        x[i] /= augmented[i][i];
      }
    }

    return x;
  };

  const applyTransformPoint = (point, transform) => {
    const { h11, h12, h13, h21, h22, h23, h31, h32, h33 } = transform;
    const denominator = h31 * point.x + h32 * point.y + h33;
    return {
      x: (h11 * point.x + h12 * point.y + h13) / denominator,
      y: (h21 * point.x + h22 * point.y + h23) / denominator
    };
  };

  // ========================================
  // ENHANCEMENT FUNCTIONS
  // ========================================

  const applyFilter = (filterName) => {
    setCurrentFilter(filterName);
    const filter = FILTERS[filterName];
    setBrightness(filter.brightness);
    setContrast(filter.contrast);
  };

  const getEnhancedImage = useCallback(() => {
    if (!capturedImage || !enhanceCanvasRef.current) return null;

    const canvas = enhanceCanvasRef.current;
    const ctx = canvas.getContext('2d');
    const img = new Image();

    return new Promise((resolve) => {
      img.onload = () => {
        // Apply rotation
        const radians = (rotation * Math.PI) / 180;
        const sin = Math.abs(Math.sin(radians));
        const cos = Math.abs(Math.cos(radians));

        const newWidth = img.width * cos + img.height * sin;
        const newHeight = img.width * sin + img.height * cos;

        canvas.width = newWidth;
        canvas.height = newHeight;

        ctx.translate(newWidth / 2, newHeight / 2);
        ctx.rotate(radians);
        ctx.drawImage(img, -img.width / 2, -img.height / 2);
        ctx.setTransform(1, 0, 0, 1, 0, 0);

        // Apply brightness and contrast
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;

        const filter = FILTERS[currentFilter];
        const contrastFactor = (259 * (contrast + filter.contrast + 255)) / (255 * (259 - (contrast + filter.contrast)));
        const brightnessFactor = brightness + filter.brightness;

        for (let i = 0; i < data.length; i += 4) {
          let r = data[i];
          let g = data[i + 1];
          let b = data[i + 2];

          // Apply contrast
          r = contrastFactor * (r - 128) + 128 + brightnessFactor;
          g = contrastFactor * (g - 128) + 128 + brightnessFactor;
          b = contrastFactor * (b - 128) + 128 + brightnessFactor;

          // Apply filter effects
          if (filter.grayscale) {
            const gray = 0.299 * r + 0.587 * g + 0.114 * b;
            r = g = b = gray;
          }

          if (filter.bw) {
            const gray = 0.299 * r + 0.587 * g + 0.114 * b;
            r = g = b = gray > 128 ? 255 : 0;
          }

          if (filter.saturation !== 100 && !filter.grayscale && !filter.bw) {
            const gray = 0.299 * r + 0.587 * g + 0.114 * b;
            const satMult = filter.saturation / 100;
            r = gray + (r - gray) * satMult;
            g = gray + (g - gray) * satMult;
            b = gray + (b - gray) * satMult;
          }

          data[i] = Math.max(0, Math.min(255, r));
          data[i + 1] = Math.max(0, Math.min(255, g));
          data[i + 2] = Math.max(0, Math.min(255, b));
        }

        ctx.putImageData(imageData, 0, 0);
        resolve(canvas.toDataURL('image/jpeg', 0.95));
      };
      img.src = capturedImage;
    });
  }, [capturedImage, rotation, brightness, contrast, currentFilter]);

  const rotateImage = (degrees) => {
    setRotation((prev) => (prev + degrees + 360) % 360);
  };

  const confirmEnhancement = async () => {
    const enhancedImage = await getEnhancedImage();
    if (enhancedImage) {
      // Add to pages
      const newPage = {
        id: Date.now(),
        image: enhancedImage,
        filter: currentFilter,
        brightness,
        contrast,
        rotation
      };

      setPages(prev => [...prev, newPage]);
      setCapturedImage(null);
      setRotation(0);
      setBrightness(0);
      setContrast(0);
      setCurrentFilter('auto');
      setViewMode(VIEW_MODES.GALLERY);
    }
  };

  // ========================================
  // GALLERY FUNCTIONS
  // ========================================

  const addMorePages = () => {
    setAutoCapture(true);
    startCamera();
  };

  const deletePage = (pageId) => {
    setPages(prev => prev.filter(p => p.id !== pageId));
  };

  const retakePage = (pageIndex) => {
    setCurrentPageIndex(pageIndex);
    setAutoCapture(true);
    startCamera();
  };

  const movePage = (fromIndex, toIndex) => {
    setPages(prev => {
      const newPages = [...prev];
      const [moved] = newPages.splice(fromIndex, 1);
      newPages.splice(toIndex, 0, moved);
      return newPages;
    });
  };

  // ========================================
  // EXPORT FUNCTIONS
  // ========================================

  const exportAsPDF = async () => {
    if (pages.length === 0) return;

    setIsExporting(true);
    setExportProgress(0);

    try {
      const canvases = [];

      for (let i = 0; i < pages.length; i++) {
        setExportProgress((i / pages.length) * 50);

        const img = new Image();
        await new Promise((resolve) => {
          img.onload = resolve;
          img.src = pages[i].image;
        });

        const canvas = document.createElement('canvas');
        // A4 at 150 DPI for good quality
        canvas.width = 1240;
        canvas.height = 1754;

        const ctx = canvas.getContext('2d');
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Scale image to fit A4 while maintaining aspect ratio
        const scale = Math.min(canvas.width / img.width, canvas.height / img.height);
        const x = (canvas.width - img.width * scale) / 2;
        const y = (canvas.height - img.height * scale) / 2;

        ctx.drawImage(img, x, y, img.width * scale, img.height * scale);
        canvases.push(canvas);
      }

      setExportProgress(60);

      const pdf = await pdfGenerator.generateMultiPagePDF(canvases, {
        title: `Scan_${new Date().toISOString().slice(0, 10)}`,
        orientation: 'portrait'
      });

      setExportProgress(80);

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      pdfGenerator.downloadPDF(pdf, `Scan_${timestamp}.pdf`);

      setExportProgress(100);

      setTimeout(() => {
        setIsExporting(false);
        setViewMode(VIEW_MODES.GALLERY);
      }, 500);

    } catch (err) {
      console.error('PDF export error:', err);
      setError('Failed to create PDF. Please try again.');
      setIsExporting(false);
    }
  };

  const exportAsImages = () => {
    pages.forEach((page, index) => {
      const link = document.createElement('a');
      link.download = `Scan_${index + 1}.jpg`;
      link.href = page.image;
      link.click();
    });
  };

  const uploadToOneDrive = async () => {
    if (pages.length === 0 || !customerFolderId) return;

    setIsExporting(true);
    setExportProgress(0);

    try {
      const uploadedFiles = [];
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

      for (let i = 0; i < pages.length; i++) {
        setExportProgress((i / pages.length) * 90);

        const page = pages[i];

        // Convert base64 to Blob
        const base64Data = page.image.split(',')[1];
        const byteCharacters = atob(base64Data);
        const byteNumbers = new Array(byteCharacters.length);
        for (let j = 0; j < byteCharacters.length; j++) {
          byteNumbers[j] = byteCharacters.charCodeAt(j);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: 'image/jpeg' });

        const filename = pages.length > 1
          ? `Scan_${timestamp}_${i + 1}.jpg`
          : `Scan_${timestamp}.jpg`;

        // Upload to OneDrive using the service
        const fileId = await oneDriveService.uploadFileToFolder(filename, blob, customerFolderId);
        uploadedFiles.push({ id: fileId, name: filename });
      }

      setExportProgress(100);

      setTimeout(() => {
        setIsExporting(false);
        if (onScanComplete) {
          onScanComplete(uploadedFiles);
        }
        resetScanner();
      }, 500);

    } catch (err) {
      console.error('Upload error:', err);
      setError('Failed to upload to OneDrive. Please try again.');
      setIsExporting(false);
    }
  };

  const resetScanner = () => {
    stopCamera();
    setPages([]);
    setCapturedImage(null);
    setCorners(null);
    setRotation(0);
    setBrightness(0);
    setContrast(0);
    setCurrentFilter('auto');
    setViewMode(VIEW_MODES.START);
    setError(null);
  };

  // ========================================
  // LIFECYCLE
  // ========================================

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  // ========================================
  // RENDER
  // ========================================

  // Use portal to render at document body level, ensuring it covers everything
  return createPortal(
    <div className="doc-scanner">
      <canvas ref={canvasRef} style={{ display: 'none' }} />
      <canvas ref={enhanceCanvasRef} style={{ display: 'none' }} />

      {error && (
        <div className="scanner-error">
          <span>⚠️ {error}</span>
          <button onClick={() => setError(null)}>✕</button>
        </div>
      )}

      {/* START VIEW */}
      {viewMode === VIEW_MODES.START && (
        <div className="scanner-start-view">
          <div className="start-content">
            <div className="scanner-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <path d="M3 9h18M9 21V9" />
              </svg>
            </div>
            <h2>Document Scanner</h2>
            <p>Scan documents with automatic edge detection, perspective correction, and image enhancement.</p>

            {pages.length > 0 && (
              <div className="existing-pages-notice">
                <span>{pages.length} page{pages.length !== 1 ? 's' : ''} ready</span>
              </div>
            )}

            <div className="start-buttons">
              <button className="btn-primary-large" onClick={startCamera}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                  <circle cx="12" cy="13" r="4" />
                </svg>
                {pages.length > 0 ? 'Add More Pages' : 'Start Scanning'}
              </button>

              {pages.length > 0 && (
                <button className="btn-secondary-large" onClick={() => setViewMode(VIEW_MODES.GALLERY)}>
                  View Pages ({pages.length})
                </button>
              )}
            </div>
          </div>

          {onClose && (
            <button className="btn-close-scanner" onClick={onClose}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      )}

      {/* CAMERA VIEW */}
      {(viewMode === VIEW_MODES.CAMERA || cameraLoading) && (
        <div className="scanner-camera-view">
          {cameraLoading && (
            <div className="camera-loading">
              <div className="loading-spinner" />
              <p>Starting camera...</p>
            </div>
          )}

          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="camera-feed"
            onClick={handleTapToFocus}
            onTouchStart={handleTapToFocus}
          />
          <canvas ref={overlayCanvasRef} className="detection-overlay" />

          {/* Focus indicator */}
          {focusPoint && (
            <div
              className="focus-indicator"
              style={{
                left: focusPoint.x,
                top: focusPoint.y
              }}
            />
          )}

          {/* Camera top bar */}
          <div className="camera-topbar">
            <button className="topbar-btn" onClick={resetScanner}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>

            <div className="topbar-center">
              {isStable && (
                <span className="auto-capture-badge">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                    <polyline points="22 4 12 14.01 9 11.01" />
                  </svg>
                  Hold steady
                </span>
              )}
            </div>

            <div className="topbar-right">
              <button className="topbar-btn" onClick={toggleFlash}>
                {flashMode === 'on' ? (
                  <svg viewBox="0 0 24 24" fill="currentColor">
                    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          {/* Camera bottom bar */}
          <div className="camera-bottombar">
            {pages.length > 0 && (
              <div className="page-counter">
                {pages.length} page{pages.length !== 1 ? 's' : ''}
              </div>
            )}

            <div className="camera-controls">
              <button className="btn-gallery" onClick={() => pages.length > 0 && setViewMode(VIEW_MODES.GALLERY)}>
                {pages.length > 0 ? (
                  <img src={pages[pages.length - 1].image} alt="Last" />
                ) : (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                    <circle cx="8.5" cy="8.5" r="1.5" />
                    <polyline points="21 15 16 10 5 21" />
                  </svg>
                )}
              </button>

              <button className="btn-capture" onClick={manualCapture}>
                <div className="capture-outer">
                  <div className="capture-inner" />
                </div>
              </button>

              <button className="btn-flip" onClick={switchCamera}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M11 19H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h5" />
                  <path d="M13 5h7a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-5" />
                  <polyline points="8 15 4 12 8 9" />
                  <polyline points="16 9 20 12 16 15" />
                </svg>
              </button>
            </div>

            <div className="auto-capture-toggle">
              <label>
                <input
                  type="checkbox"
                  checked={autoCapture}
                  onChange={(e) => setAutoCapture(e.target.checked)}
                />
                <span>Auto-capture</span>
              </label>
            </div>
          </div>
        </div>
      )}

      {/* CROP VIEW */}
      {viewMode === VIEW_MODES.CROP && capturedImage && (
        <div className="scanner-crop-view">
          <div className="crop-header">
            <button className="header-btn" onClick={resetScanner}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
              Cancel
            </button>
            <h3>Adjust Corners</h3>
            <button className="header-btn primary" onClick={applyCrop}>
              Next
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
          </div>
          <div
            className="crop-container"
            ref={cropContainerRef}
            onMouseMove={handleCropMove}
            onMouseUp={handleCropEnd}
            onMouseLeave={handleCropEnd}
            onTouchMove={handleCropMove}
            onTouchEnd={handleCropEnd}
          >
            <img
              ref={cropImageRef}
              src={capturedImage}
              alt="Captured"
              className="crop-image"
              onLoad={updateOverlayPosition}
            />

            {corners && overlayStyle.width && (
              <svg
                className="crop-overlay"
                style={overlayStyle}
                viewBox={`0 0 ${imageDimensions.width} ${imageDimensions.height}`}
                preserveAspectRatio="none"
              >
                <defs>
                  <mask id="cropMask">
                    <rect width="100%" height="100%" fill="white" />
                    <polygon
                      points={corners.map(c => `${c.x},${c.y}`).join(' ')}
                      fill="black"
                    />
                  </mask>
                </defs>
                <rect width="100%" height="100%" fill="rgba(0,0,0,0.5)" mask="url(#cropMask)" />
                <polygon
                  points={corners.map(c => `${c.x},${c.y}`).join(' ')}
                  fill="none"
                  stroke="#3b82f6"
                  strokeWidth="8"
                />
                {corners.map((corner, i) => (
                  <g key={i}>
                    <circle
                      cx={corner.x}
                      cy={corner.y}
                      r="50"
                      fill="#3b82f6"
                      stroke="white"
                      strokeWidth="8"
                      className="corner-handle"
                      onMouseDown={(e) => handleCornerDrag(i, e)}
                      onTouchStart={(e) => handleCornerDrag(i, e)}
                    />
                  </g>
                ))}
              </svg>
            )}
          </div>

          {/* Fixed bottom action bar */}
          <div className="crop-actions">
            <button className="crop-btn retake" onClick={() => { setCapturedImage(null); setAutoCapture(true); startCamera(); }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                <circle cx="12" cy="13" r="4" />
              </svg>
              Retake
            </button>
            <button className="crop-btn next" onClick={applyCrop}>
              Continue
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* ENHANCE VIEW */}
      {viewMode === VIEW_MODES.ENHANCE && capturedImage && (
        <div className="scanner-enhance-view">
          <div className="enhance-header">
            <button className="header-btn" onClick={() => setViewMode(VIEW_MODES.CROP)}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M19 12H5M12 19l-7-7 7-7" />
              </svg>
              Back
            </button>
            <h3>Enhance</h3>
            <button className="header-btn primary" onClick={confirmEnhancement}>
              Done
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </button>
          </div>

          <div className="enhance-content">
            <div className="enhance-preview">
              <img
                src={capturedImage}
                alt="Preview"
                style={{
                  filter: `
                    brightness(${100 + brightness + FILTERS[currentFilter].brightness}%)
                    contrast(${100 + contrast + FILTERS[currentFilter].contrast}%)
                    saturate(${FILTERS[currentFilter].saturation}%)
                    grayscale(${FILTERS[currentFilter].grayscale ? 100 : 0}%)
                  `,
                  transform: `rotate(${rotation}deg)`
                }}
              />
            </div>

            {/* Filter presets */}
            <div className="filter-presets">
              {Object.entries(FILTERS).map(([key, filter]) => (
                <button
                  key={key}
                  className={`filter-btn ${currentFilter === key ? 'active' : ''}`}
                  onClick={() => applyFilter(key)}
                >
                  <div
                    className="filter-preview"
                    style={{
                      backgroundImage: `url(${capturedImage})`,
                      filter: `
                        brightness(${100 + filter.brightness}%)
                        contrast(${100 + filter.contrast}%)
                        saturate(${filter.saturation}%)
                        grayscale(${filter.grayscale ? 100 : 0}%)
                      `
                    }}
                  />
                  <span>{filter.name}</span>
                </button>
              ))}
            </div>

            {/* Manual adjustments */}
            <div className="adjust-controls">
              <div className="adjust-row">
                <label>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="5" />
                    <line x1="12" y1="1" x2="12" y2="3" />
                    <line x1="12" y1="21" x2="12" y2="23" />
                    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                    <line x1="1" y1="12" x2="3" y2="12" />
                    <line x1="21" y1="12" x2="23" y2="12" />
                    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                    <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
                  </svg>
                  Brightness
                </label>
                <input
                  type="range"
                  min="-50"
                  max="50"
                  value={brightness}
                  onChange={(e) => setBrightness(parseInt(e.target.value))}
                />
                <span>{brightness > 0 ? '+' : ''}{brightness}</span>
              </div>

              <div className="adjust-row">
                <label>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <path d="M12 2v20M2 12h20" />
                  </svg>
                  Contrast
                </label>
                <input
                  type="range"
                  min="-50"
                  max="50"
                  value={contrast}
                  onChange={(e) => setContrast(parseInt(e.target.value))}
                />
                <span>{contrast > 0 ? '+' : ''}{contrast}</span>
              </div>
            </div>

            {/* Rotation controls */}
            <div className="rotation-controls">
              <button onClick={() => rotateImage(-90)}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M2.5 2v6h6M2.66 15.57a10 10 0 1 0 .57-8.38" />
                </svg>
              </button>
              <span>Rotate</span>
              <button onClick={() => rotateImage(90)}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* GALLERY VIEW */}
      {viewMode === VIEW_MODES.GALLERY && (
        <div className="scanner-gallery-view">
          <div className="gallery-header">
            <button className="header-btn" onClick={() => setViewMode(VIEW_MODES.START)}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
            <h3>{pages.length} Page{pages.length !== 1 ? 's' : ''}</h3>
            <button
              className="header-btn primary"
              onClick={() => setViewMode(VIEW_MODES.EXPORT)}
              disabled={pages.length === 0}
            >
              Export
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
            </button>
          </div>

          <div className="gallery-grid">
            {pages.map((page, index) => (
              <div key={page.id} className="gallery-item">
                <div className="gallery-image">
                  <img src={page.image} alt={`Page ${index + 1}`} />
                  <span className="page-number">{index + 1}</span>
                </div>
                <div className="gallery-actions">
                  {index > 0 && (
                    <button onClick={() => movePage(index, index - 1)} title="Move up">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="18 15 12 9 6 15" />
                      </svg>
                    </button>
                  )}
                  {index < pages.length - 1 && (
                    <button onClick={() => movePage(index, index + 1)} title="Move down">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="6 9 12 15 18 9" />
                      </svg>
                    </button>
                  )}
                  <button onClick={() => retakePage(index)} title="Retake">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                      <circle cx="12" cy="13" r="4" />
                    </svg>
                  </button>
                  <button onClick={() => deletePage(page.id)} title="Delete" className="delete-btn">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}

            {/* Add more button */}
            <div className="gallery-add" onClick={addMorePages}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              <span>Add Page</span>
            </div>
          </div>
        </div>
      )}

      {/* EXPORT VIEW */}
      {viewMode === VIEW_MODES.EXPORT && (
        <div className="scanner-export-view">
          <div className="export-header">
            <button className="header-btn" onClick={() => setViewMode(VIEW_MODES.GALLERY)}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M19 12H5M12 19l-7-7 7-7" />
              </svg>
              Back
            </button>
            <h3>Export</h3>
            <div style={{ width: 60 }} />
          </div>

          {isExporting ? (
            <div className="export-progress">
              <div className="progress-circle">
                <svg viewBox="0 0 36 36">
                  <path
                    className="progress-bg"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                  <path
                    className="progress-fill"
                    strokeDasharray={`${exportProgress}, 100`}
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                </svg>
                <span>{Math.round(exportProgress)}%</span>
              </div>
              <p>Exporting...</p>
            </div>
          ) : (
            <div className="export-options">
              <div className="export-preview">
                <div className="preview-stack">
                  {pages.slice(0, 3).map((page, i) => (
                    <img
                      key={page.id}
                      src={page.image}
                      alt={`Page ${i + 1}`}
                      style={{
                        transform: `translateY(${i * -8}px) rotate(${(i - 1) * 3}deg)`,
                        zIndex: 3 - i
                      }}
                    />
                  ))}
                </div>
                <p>{pages.length} page{pages.length !== 1 ? 's' : ''}</p>
              </div>

              <div className="export-buttons">
                <button className="export-btn pdf" onClick={exportAsPDF}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                    <line x1="16" y1="13" x2="8" y2="13" />
                    <line x1="16" y1="17" x2="8" y2="17" />
                    <polyline points="10 9 9 9 8 9" />
                  </svg>
                  Save as PDF
                </button>

                <button className="export-btn images" onClick={exportAsImages}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                    <circle cx="8.5" cy="8.5" r="1.5" />
                    <polyline points="21 15 16 10 5 21" />
                  </svg>
                  Save as Images
                </button>

                {customerFolderId && (
                  <button className="export-btn drive" onClick={uploadToOneDrive}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M22.54 6.42a2.78 2.78 0 0 0-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 0 0-1.94 2A29 29 0 0 0 1 11.75a29 29 0 0 0 .46 5.33A2.78 2.78 0 0 0 3.4 19c1.72.46 8.6.46 8.6.46s6.88 0 8.6-.46a2.78 2.78 0 0 0 1.94-2 29 29 0 0 0 .46-5.25 29 29 0 0 0-.46-5.33z" />
                      <polygon points="9.75 15.02 15.5 11.75 9.75 8.48 9.75 15.02" />
                    </svg>
                    Upload to Drive
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>,
    document.body
  );
}

export default DocumentScanner;
