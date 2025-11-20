/**
 * Document Scanner Module
 * Provides camera capture with flash control for document scanning
 */

class DocumentScanner {
    constructor() {
        this.stream = null;
        this.video = null;
        this.canvas = null;
        this.ctx = null;
        this.currentCustomerId = null;
        this.capturedImage = null;
        this.flashEnabled = false;
        this.track = null;
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
                        <button id="flashToggle" class="flash-toggle" onclick="documentScanner.toggleFlash()" style="display: none;" title="Toggle auto-flash">
                            <span id="flashIcon">💡</span>
                        </button>
                    </div>
                    <div class="scanner-controls">
                        <div id="scannerInstructions" class="scanner-instructions">
                            <p>Position document within frame</p>
                            <small>Click 💡 to enable auto-flash (fires when capturing)</small>
                        </div>
                        <div class="scanner-buttons">
                            <button id="captureBtn" class="btn btn-primary" onclick="documentScanner.captureDocument()">
                                📸 Capture Photo
                            </button>
                            <button id="retakeBtn" class="btn btn-secondary" onclick="documentScanner.retake()" style="display: none;">
                                🔄 Retake
                            </button>
                            <button id="saveBtn" class="btn btn-success" onclick="documentScanner.saveDocument()" style="display: none;">
                                💾 Save Document
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

            // Get video track for flash control
            this.track = this.stream.getVideoTracks()[0];

            // Check if flash/torch is supported
            const capabilities = this.track.getCapabilities();
            if (capabilities.torch) {
                const flashToggle = document.getElementById('flashToggle');
                if (flashToggle) {
                    flashToggle.style.display = 'block';
                }
                console.log('Flash/torch is supported');
            } else {
                console.log('Flash/torch is not supported on this device');
            }

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
            });

        } catch (error) {
            console.error('Camera access error:', error);
            alert('Unable to access camera. Please ensure camera permissions are granted.');
            this.closeScanner();
        }
    }

    /**
     * Toggle auto-flash on or off
     */
    async toggleFlash() {
        try {
            if (!this.track) {
                console.error('No video track available');
                return;
            }

            const capabilities = this.track.getCapabilities();
            if (!capabilities.torch) {
                alert('Flash is not supported on this device');
                return;
            }

            this.flashEnabled = !this.flashEnabled;

            // Update flash icon (but don't turn on torch yet - it fires on capture)
            const flashIcon = document.getElementById('flashIcon');
            const flashToggle = document.getElementById('flashToggle');
            if (flashIcon && flashToggle) {
                flashIcon.textContent = this.flashEnabled ? '⚡' : '💡';
                flashToggle.style.background = this.flashEnabled ?
                    'rgba(255, 193, 7, 0.9)' : 'rgba(0, 0, 0, 0.5)';
                flashToggle.title = this.flashEnabled ?
                    'Auto-flash enabled - will flash when capturing' :
                    'Auto-flash disabled';
            }

            console.log('Auto-flash mode:', this.flashEnabled ? 'enabled' : 'disabled');
        } catch (error) {
            console.error('Error toggling flash:', error);
            alert('Unable to control flash: ' + error.message);
        }
    }

    /**
     * Capture photo from video stream
     */
    async captureDocument() {
        try {
            // Fire flash if enabled
            if (this.flashEnabled && this.track) {
                const capabilities = this.track.getCapabilities();
                if (capabilities.torch) {
                    console.log('Firing flash...');
                    // Turn on flash
                    await this.track.applyConstraints({
                        advanced: [{ torch: true }]
                    });
                    // Wait for flash to stabilize and illuminate the scene
                    await new Promise(resolve => setTimeout(resolve, 150));
                }
            }

            // Draw video frame to canvas
            this.canvas.width = this.video.videoWidth;
            this.canvas.height = this.video.videoHeight;
            this.ctx.drawImage(this.video, 0, 0, this.canvas.width, this.canvas.height);

            // Store captured image
            this.capturedImage = this.canvas.toDataURL('image/jpeg', 0.92);

            // Turn off flash immediately after capture
            if (this.flashEnabled && this.track) {
                const capabilities = this.track.getCapabilities();
                if (capabilities.torch) {
                    await this.track.applyConstraints({
                        advanced: [{ torch: false }]
                    });
                    console.log('Flash turned off');
                }
            }

            // Stop video stream
            if (this.stream) {
                this.stream.getTracks().forEach(track => track.stop());
            }
            this.video.style.display = 'none';
            this.canvas.style.display = 'block';

            // Hide flash toggle
            const flashToggle = document.getElementById('flashToggle');
            if (flashToggle) {
                flashToggle.style.display = 'none';
            }

            // Update canvas display size
            const maxDisplayWidth = 800;
            const maxDisplayHeight = 600;
            let displayWidth = this.canvas.width;
            let displayHeight = this.canvas.height;

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

            // Update UI
            document.getElementById('captureBtn').style.display = 'none';
            document.getElementById('retakeBtn').style.display = 'inline-block';
            document.getElementById('saveBtn').style.display = 'inline-block';
            document.getElementById('scannerInstructions').innerHTML = `
                <p>Photo captured</p>
                <small>Click "Save" to upload or "Retake" for a new photo</small>
            `;
        } catch (error) {
            console.error('Error capturing photo:', error);
            alert('Error capturing photo: ' + error.message);
        }
    }

    /**
     * Retake photo
     */
    async retake() {
        this.capturedImage = null;
        // Keep flashEnabled state - user's preference is preserved
        this.canvas.style.display = 'none';
        this.video.style.display = 'block';

        // Restart camera
        await this.initCamera();

        // Restore flash toggle UI state
        const flashToggle = document.getElementById('flashToggle');
        const flashIcon = document.getElementById('flashIcon');
        if (flashToggle && flashIcon && this.track) {
            const capabilities = this.track.getCapabilities();
            if (capabilities.torch) {
                flashToggle.style.display = 'block';
                flashIcon.textContent = this.flashEnabled ? '⚡' : '💡';
                flashToggle.style.background = this.flashEnabled ?
                    'rgba(255, 193, 7, 0.9)' : 'rgba(0, 0, 0, 0.5)';
            }
        }

        // Update UI
        document.getElementById('captureBtn').style.display = 'inline-block';
        document.getElementById('retakeBtn').style.display = 'none';
        document.getElementById('saveBtn').style.display = 'none';
        document.getElementById('scannerInstructions').innerHTML = `
            <p>Position document within frame</p>
            <small>Click 💡 to enable auto-flash (fires when capturing)</small>
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
        // Turn off flash if enabled
        if (this.flashEnabled && this.track) {
            try {
                this.track.applyConstraints({
                    advanced: [{ torch: false }]
                });
            } catch (error) {
                console.error('Error turning off flash:', error);
            }
        }

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
        this.track = null;
        this.currentCustomerId = null;
        this.capturedImage = null;
        this.flashEnabled = false;
    }
}

// Create global instance
const documentScanner = new DocumentScanner();
