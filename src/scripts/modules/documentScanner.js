/**
 * Document Scanner Module
 * Provides camera capture with auto-crop functionality for document scanning
 */

class DocumentScanner {
    constructor() {
        this.stream = null;
        this.video = null;
        this.canvas = null;
        this.ctx = null;
        this.currentCustomerId = null;
        this.capturedImage = null;
        this.corners = null;
        this.isAdjusting = false;
    }

    /**
     * Open the document scanner modal
     */
    async openScanner(customerId) {
        this.currentCustomerId = customerId;

        // Create modal HTML
        const modal = document.createElement('div');
        modal.id = 'documentScannerModal';
        modal.className = 'modal';
        modal.style.display = 'block';
        modal.innerHTML = `
            <div class="modal-content scanner-modal-content">
                <div class="modal-header">
                    <h2>Scan Document</h2>
                    <span class="close-modal" onclick="documentScanner.closeScanner()">&times;</span>
                </div>
                <div class="scanner-body">
                    <div class="scanner-preview-container">
                        <video id="scannerVideo" autoplay playsinline></video>
                        <canvas id="scannerCanvas"></canvas>
                        <canvas id="scannerOverlay"></canvas>
                    </div>
                    <div class="scanner-controls">
                        <div id="scannerInstructions" class="scanner-instructions">
                            <p>Position document within frame</p>
                            <small>Ensure good lighting and document is flat</small>
                        </div>
                        <div class="scanner-buttons">
                            <button id="captureBtn" class="btn btn-primary" onclick="documentScanner.captureDocument()">
                                Capture Document
                            </button>
                            <button id="retakeBtn" class="btn btn-secondary" onclick="documentScanner.retake()" style="display: none;">
                                Retake
                            </button>
                            <button id="adjustBtn" class="btn btn-secondary" onclick="documentScanner.adjustCorners()" style="display: none;">
                                Adjust Corners
                            </button>
                            <button id="saveBtn" class="btn btn-success" onclick="documentScanner.saveDocument()" style="display: none;">
                                Save Document
                            </button>
                            <button class="btn btn-secondary" onclick="documentScanner.closeScanner()">
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Initialize camera
        await this.initCamera();
    }

    /**
     * Initialize camera stream
     */
    async initCamera() {
        try {
            this.video = document.getElementById('scannerVideo');
            this.canvas = document.getElementById('scannerCanvas');
            this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });

            // Request camera access with high resolution
            this.stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: 'environment', // Use back camera on mobile
                    width: { ideal: 1920 },
                    height: { ideal: 1080 }
                }
            });

            this.video.srcObject = this.stream;

            // Set canvas size when video loads
            this.video.addEventListener('loadedmetadata', () => {
                const aspectRatio = this.video.videoWidth / this.video.videoHeight;
                const maxWidth = 800;
                const maxHeight = 600;

                let width = maxWidth;
                let height = maxWidth / aspectRatio;

                if (height > maxHeight) {
                    height = maxHeight;
                    width = maxHeight * aspectRatio;
                }

                this.canvas.width = width;
                this.canvas.height = height;
                this.video.style.width = width + 'px';
                this.video.style.height = height + 'px';

                // Setup overlay canvas
                const overlay = document.getElementById('scannerOverlay');
                overlay.width = width;
                overlay.height = height;
                overlay.style.width = width + 'px';
                overlay.style.height = height + 'px';
            });

        } catch (error) {
            console.error('Camera access error:', error);
            alert('Unable to access camera. Please ensure camera permissions are granted.');
            this.closeScanner();
        }
    }

    /**
     * Capture document from video stream
     */
    captureDocument() {
        // Draw video frame to canvas
        this.canvas.width = this.video.videoWidth;
        this.canvas.height = this.video.videoHeight;
        this.ctx.drawImage(this.video, 0, 0, this.canvas.width, this.canvas.height);

        // Stop video stream
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
        }
        this.video.style.display = 'none';
        this.canvas.style.display = 'block';

        // Detect document edges
        this.detectDocumentEdges();

        // Update UI
        document.getElementById('captureBtn').style.display = 'none';
        document.getElementById('retakeBtn').style.display = 'inline-block';
        document.getElementById('adjustBtn').style.display = 'inline-block';
        document.getElementById('saveBtn').style.display = 'inline-block';
        document.getElementById('scannerInstructions').innerHTML = `
            <p>Document detected and cropped</p>
            <small>Click "Adjust Corners" to fine-tune or "Save" to upload</small>
        `;
    }

    /**
     * Detect document edges using edge detection
     */
    detectDocumentEdges() {
        const imageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);

        // Convert to grayscale and detect edges
        const edges = this.detectEdges(imageData);

        // Find document corners
        this.corners = this.findDocumentCorners(edges);

        // Auto-crop to detected corners
        if (this.corners) {
            this.cropToCorners();
            this.drawCorners();
        } else {
            // If no corners detected, use full image with small margin
            const margin = 20;
            this.corners = [
                { x: margin, y: margin },
                { x: this.canvas.width - margin, y: margin },
                { x: this.canvas.width - margin, y: this.canvas.height - margin },
                { x: margin, y: this.canvas.height - margin }
            ];
            this.drawCorners();
        }
    }

    /**
     * Simple edge detection using Sobel operator
     */
    detectEdges(imageData) {
        const width = imageData.width;
        const height = imageData.height;
        const data = imageData.data;
        const grayscale = new Uint8Array(width * height);
        const edges = new Uint8Array(width * height);

        // Convert to grayscale
        for (let i = 0; i < data.length; i += 4) {
            const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
            grayscale[i / 4] = gray;
        }

        // Apply Gaussian blur
        const blurred = this.gaussianBlur(grayscale, width, height);

        // Sobel operator
        const sobelX = [-1, 0, 1, -2, 0, 2, -1, 0, 1];
        const sobelY = [-1, -2, -1, 0, 0, 0, 1, 2, 1];

        for (let y = 1; y < height - 1; y++) {
            for (let x = 1; x < width - 1; x++) {
                let gx = 0, gy = 0;

                for (let ky = -1; ky <= 1; ky++) {
                    for (let kx = -1; kx <= 1; kx++) {
                        const idx = (y + ky) * width + (x + kx);
                        const kidx = (ky + 1) * 3 + (kx + 1);
                        gx += blurred[idx] * sobelX[kidx];
                        gy += blurred[idx] * sobelY[kidx];
                    }
                }

                const magnitude = Math.sqrt(gx * gx + gy * gy);
                edges[y * width + x] = magnitude > 50 ? 255 : 0;
            }
        }

        return { data: edges, width, height };
    }

    /**
     * Apply Gaussian blur
     */
    gaussianBlur(data, width, height) {
        const kernel = [1, 2, 1, 2, 4, 2, 1, 2, 1];
        const kernelSum = 16;
        const result = new Uint8Array(width * height);

        for (let y = 1; y < height - 1; y++) {
            for (let x = 1; x < width - 1; x++) {
                let sum = 0;
                for (let ky = -1; ky <= 1; ky++) {
                    for (let kx = -1; kx <= 1; kx++) {
                        const idx = (y + ky) * width + (x + kx);
                        const kidx = (ky + 1) * 3 + (kx + 1);
                        sum += data[idx] * kernel[kidx];
                    }
                }
                result[y * width + x] = sum / kernelSum;
            }
        }

        return result;
    }

    /**
     * Find document corners from edge map
     */
    findDocumentCorners(edges) {
        const width = edges.width;
        const height = edges.height;
        const data = edges.data;

        // Find contours (simplified - find largest rectangle-like region)
        const points = [];
        for (let y = 0; y < height; y += 10) {
            for (let x = 0; x < width; x += 10) {
                if (data[y * width + x] === 255) {
                    points.push({ x, y });
                }
            }
        }

        if (points.length < 4) {
            return null;
        }

        // Find approximate corners (top-left, top-right, bottom-right, bottom-left)
        const topLeft = points.reduce((min, p) => (p.x + p.y < min.x + min.y ? p : min));
        const topRight = points.reduce((max, p) => (p.x - p.y > max.x - max.y ? p : max));
        const bottomRight = points.reduce((max, p) => (p.x + p.y > max.x + max.y ? p : max));
        const bottomLeft = points.reduce((min, p) => (p.y - p.x > min.y - min.x ? p : min));

        // Add some margin
        const margin = Math.min(width, height) * 0.05;

        return [
            { x: Math.max(topLeft.x - margin, 0), y: Math.max(topLeft.y - margin, 0) },
            { x: Math.min(topRight.x + margin, width), y: Math.max(topRight.y - margin, 0) },
            { x: Math.min(bottomRight.x + margin, width), y: Math.min(bottomRight.y + margin, height) },
            { x: Math.max(bottomLeft.x - margin, 0), y: Math.min(bottomLeft.y + margin, height) }
        ];
    }

    /**
     * Crop image to detected corners using perspective transform
     */
    cropToCorners() {
        const [tl, tr, br, bl] = this.corners;

        // Calculate output dimensions
        const widthTop = Math.sqrt(Math.pow(tr.x - tl.x, 2) + Math.pow(tr.y - tl.y, 2));
        const widthBottom = Math.sqrt(Math.pow(br.x - bl.x, 2) + Math.pow(br.y - bl.y, 2));
        const width = Math.max(widthTop, widthBottom);

        const heightLeft = Math.sqrt(Math.pow(bl.x - tl.x, 2) + Math.pow(bl.y - tl.y, 2));
        const heightRight = Math.sqrt(Math.pow(br.x - tr.x, 2) + Math.pow(br.y - tr.y, 2));
        const height = Math.max(heightLeft, heightRight);

        // Create temporary canvas for transformation
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = width;
        tempCanvas.height = height;
        const tempCtx = tempCanvas.getContext('2d');

        // Store original image
        const originalImage = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);

        // Apply perspective transform (simplified - using setTransform)
        // For a more accurate transform, we'd need to implement full perspective transformation
        // This is a simplified version that works well for most documents

        // Calculate transformation matrix
        const scaleX = width / (tr.x - tl.x);
        const scaleY = height / (bl.y - tl.y);

        tempCtx.drawImage(
            this.canvas,
            tl.x, tl.y,
            tr.x - tl.x, bl.y - tl.y,
            0, 0,
            width, height
        );

        // Update main canvas
        this.canvas.width = width;
        this.canvas.height = height;
        this.ctx.drawImage(tempCanvas, 0, 0);

        // Store cropped image
        this.capturedImage = this.canvas.toDataURL('image/jpeg', 0.92);

        // Update canvas display size
        const maxDisplayWidth = 800;
        const maxDisplayHeight = 600;
        let displayWidth = width;
        let displayHeight = height;

        if (displayWidth > maxDisplayWidth) {
            displayHeight = (maxDisplayWidth / displayWidth) * displayHeight;
            displayWidth = maxDisplayWidth;
        }
        if (displayHeight > maxDisplayHeight) {
            displayWidth = (maxDisplayHeight / displayHeight) * displayWidth;
            displayHeight = maxDisplayHeight;
        }

        this.canvas.style.width = displayWidth + 'px';
        this.canvas.style.height = displayHeight + 'px';
    }

    /**
     * Draw corner markers on overlay
     */
    drawCorners() {
        const overlay = document.getElementById('scannerOverlay');
        if (!overlay) return;

        const overlayCtx = overlay.getContext('2d', { willReadFrequently: true });
        overlayCtx.clearRect(0, 0, overlay.width, overlay.height);

        if (!this.corners || this.isAdjusting) return;

        // Draw polygon connecting corners
        overlayCtx.strokeStyle = '#4CAF50';
        overlayCtx.lineWidth = 3;
        overlayCtx.beginPath();
        overlayCtx.moveTo(this.corners[0].x, this.corners[0].y);
        for (let i = 1; i < this.corners.length; i++) {
            overlayCtx.lineTo(this.corners[i].x, this.corners[i].y);
        }
        overlayCtx.closePath();
        overlayCtx.stroke();

        // Draw corner points
        overlayCtx.fillStyle = '#4CAF50';
        this.corners.forEach(corner => {
            overlayCtx.beginPath();
            overlayCtx.arc(corner.x, corner.y, 8, 0, 2 * Math.PI);
            overlayCtx.fill();
        });
    }

    /**
     * Allow user to adjust corners manually
     */
    adjustCorners() {
        this.isAdjusting = true;
        const overlay = document.getElementById('scannerOverlay');
        const overlayCtx = overlay.getContext('2d', { willReadFrequently: true });

        // Redraw with larger, draggable corners
        overlayCtx.clearRect(0, 0, overlay.width, overlay.height);

        // Draw semi-transparent overlay
        overlayCtx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        overlayCtx.fillRect(0, 0, overlay.width, overlay.height);

        // Draw corners as draggable handles
        overlayCtx.strokeStyle = '#4CAF50';
        overlayCtx.lineWidth = 2;
        overlayCtx.beginPath();
        overlayCtx.moveTo(this.corners[0].x, this.corners[0].y);
        for (let i = 1; i < this.corners.length; i++) {
            overlayCtx.lineTo(this.corners[i].x, this.corners[i].y);
        }
        overlayCtx.closePath();
        overlayCtx.stroke();

        overlayCtx.fillStyle = '#4CAF50';
        overlayCtx.strokeStyle = '#fff';
        overlayCtx.lineWidth = 2;
        this.corners.forEach((corner, index) => {
            overlayCtx.beginPath();
            overlayCtx.arc(corner.x, corner.y, 12, 0, 2 * Math.PI);
            overlayCtx.fill();
            overlayCtx.stroke();
        });

        // Add drag handlers
        let dragIndex = -1;

        const handleMouseDown = (e) => {
            const rect = overlay.getBoundingClientRect();
            const scaleX = overlay.width / rect.width;
            const scaleY = overlay.height / rect.height;
            const x = (e.clientX - rect.left) * scaleX;
            const y = (e.clientY - rect.top) * scaleY;

            // Check if clicked on a corner
            this.corners.forEach((corner, index) => {
                const dist = Math.sqrt(Math.pow(x - corner.x, 2) + Math.pow(y - corner.y, 2));
                if (dist < 20) {
                    dragIndex = index;
                }
            });
        };

        const handleMouseMove = (e) => {
            if (dragIndex === -1) return;

            const rect = overlay.getBoundingClientRect();
            const scaleX = overlay.width / rect.width;
            const scaleY = overlay.height / rect.height;
            const x = (e.clientX - rect.left) * scaleX;
            const y = (e.clientY - rect.top) * scaleY;

            this.corners[dragIndex] = { x, y };

            // Redraw
            overlayCtx.clearRect(0, 0, overlay.width, overlay.height);
            overlayCtx.fillStyle = 'rgba(0, 0, 0, 0.3)';
            overlayCtx.fillRect(0, 0, overlay.width, overlay.height);

            overlayCtx.strokeStyle = '#4CAF50';
            overlayCtx.lineWidth = 2;
            overlayCtx.beginPath();
            overlayCtx.moveTo(this.corners[0].x, this.corners[0].y);
            for (let i = 1; i < this.corners.length; i++) {
                overlayCtx.lineTo(this.corners[i].x, this.corners[i].y);
            }
            overlayCtx.closePath();
            overlayCtx.stroke();

            overlayCtx.fillStyle = '#4CAF50';
            overlayCtx.strokeStyle = '#fff';
            overlayCtx.lineWidth = 2;
            this.corners.forEach((corner) => {
                overlayCtx.beginPath();
                overlayCtx.arc(corner.x, corner.y, 12, 0, 2 * Math.PI);
                overlayCtx.fill();
                overlayCtx.stroke();
            });
        };

        const handleMouseUp = () => {
            if (dragIndex !== -1) {
                dragIndex = -1;
                // Recrop with new corners
                this.cropToCorners();
            }
        };

        overlay.addEventListener('mousedown', handleMouseDown);
        overlay.addEventListener('mousemove', handleMouseMove);
        overlay.addEventListener('mouseup', handleMouseUp);
        overlay.addEventListener('touchstart', (e) => {
            e.preventDefault();
            handleMouseDown(e.touches[0]);
        });
        overlay.addEventListener('touchmove', (e) => {
            e.preventDefault();
            handleMouseMove(e.touches[0]);
        });
        overlay.addEventListener('touchend', handleMouseUp);

        // Update instructions
        document.getElementById('scannerInstructions').innerHTML = `
            <p>Drag corners to adjust crop area</p>
            <small>Click "Save" when done adjusting</small>
        `;

        // Update button
        document.getElementById('adjustBtn').textContent = 'Done Adjusting';
        document.getElementById('adjustBtn').onclick = () => {
            this.isAdjusting = false;
            overlay.removeEventListener('mousedown', handleMouseDown);
            overlay.removeEventListener('mousemove', handleMouseMove);
            overlay.removeEventListener('mouseup', handleMouseUp);

            const overlayCtx = overlay.getContext('2d', { willReadFrequently: true });
            overlayCtx.clearRect(0, 0, overlay.width, overlay.height);

            document.getElementById('adjustBtn').textContent = 'Adjust Corners';
            document.getElementById('adjustBtn').onclick = () => documentScanner.adjustCorners();
            document.getElementById('scannerInstructions').innerHTML = `
                <p>Document cropped and ready</p>
                <small>Click "Save" to upload the document</small>
            `;
        };
    }

    /**
     * Retake photo
     */
    async retake() {
        this.capturedImage = null;
        this.corners = null;
        this.canvas.style.display = 'none';
        this.video.style.display = 'block';

        // Clear overlay
        const overlay = document.getElementById('scannerOverlay');
        const overlayCtx = overlay.getContext('2d', { willReadFrequently: true });
        overlayCtx.clearRect(0, 0, overlay.width, overlay.height);

        // Restart camera
        await this.initCamera();

        // Update UI
        document.getElementById('captureBtn').style.display = 'inline-block';
        document.getElementById('retakeBtn').style.display = 'none';
        document.getElementById('adjustBtn').style.display = 'none';
        document.getElementById('saveBtn').style.display = 'none';
        document.getElementById('scannerInstructions').innerHTML = `
            <p>Position document within frame</p>
            <small>Ensure good lighting and document is flat</small>
        `;
    }

    /**
     * Save scanned document
     */
    async saveDocument() {
        try {
            console.log('saveDocument called', {
                capturedImage: !!this.capturedImage,
                customerId: this.currentCustomerId
            });

            if (!this.capturedImage) {
                alert('No document captured');
                return;
            }

            if (!this.currentCustomerId) {
                alert('Customer ID not found');
                return;
            }

            // Save customerId to local variable BEFORE closing scanner
            // (closeScanner clears this.currentCustomerId)
            const customerId = this.currentCustomerId;

            // Convert base64 to blob
            console.log('Converting image to blob...');
            const blob = await fetch(this.capturedImage).then(r => r.blob());
            console.log('Blob created:', blob.size, 'bytes');

            // Create file with timestamp
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
            const fileName = `Scanned_Document_${timestamp}.jpg`;
            const file = new File([blob], fileName, { type: 'image/jpeg' });
            console.log('File created:', fileName);

            // Check if uploadFiles function exists
            if (typeof uploadFiles !== 'function') {
                console.error('uploadFiles function not found in global scope');
                alert('Unable to upload document. Upload function not available.');
                return;
            }

            console.log('Calling uploadFiles with:', {
                fileName: file.name,
                fileSize: file.size,
                customerId: customerId
            });

            // Close scanner
            this.closeScanner();

            // Upload using existing upload flow (use local variable, not this.currentCustomerId)
            await uploadFiles([file], customerId);
            console.log('Upload initiated successfully');

        } catch (error) {
            console.error('Error in saveDocument:', error);
            alert('Error saving document: ' + error.message);
            // Don't close scanner on error so user can retry
        }
    }

    /**
     * Close scanner and cleanup
     */
    closeScanner() {
        // Stop camera stream
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
        }

        // Remove modal
        const modal = document.getElementById('documentScannerModal');
        if (modal) {
            modal.remove();
        }

        // Reset state
        this.stream = null;
        this.video = null;
        this.canvas = null;
        this.ctx = null;
        this.currentCustomerId = null;
        this.capturedImage = null;
        this.corners = null;
        this.isAdjusting = false;
    }
}

// Create global instance
const documentScanner = new DocumentScanner();
