class FaceTracker {
    constructor() {
        this.faceMesh = new FaceMesh({
            locateFile: (file) => {
                return `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`;
            }
        });

        this.faceMesh.setOptions({
            maxNumFaces: 1,
            refineLandmarks: true,
            minDetectionConfidence: 0.5,
            minTrackingConfidence: 0.5
        });

        // Add known measurements for distance calculation
        this.KNOWN_FACE_WIDTH = 0.15; // Average face width in meters
        this.FOCAL_LENGTH = 615; // Focal length in pixels (can be calibrated)

        // Add tracking stability parameters
        this.previousLandmarks = null;
        this.smoothingFactor = 0.7; // Adjust for more/less smoothing
        this.backgroundAlpha = 0.3; // Background darkness
    }

    async initialize(videoElement, canvasElement) {
        this.video = videoElement;
        this.canvas = canvasElement;
        this.ctx = canvasElement.getContext('2d');

        this.faceMesh.onResults(this.onResults.bind(this));

        this.camera = new Camera(this.video, {
            onFrame: async () => {
                await this.faceMesh.send({image: this.video});
            },
            width: 640,
            height: 480
        });

        await this.camera.start();
    }

    onResults(results) {
        // Add semi-transparent background
        this.ctx.fillStyle = `rgba(0, 0, 0, ${this.backgroundAlpha})`;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        if (results.multiFaceLandmarks) {
            for (const landmarks of results.multiFaceLandmarks) {
                // Apply smoothing to landmarks
                const smoothedLandmarks = this.smoothLandmarks(landmarks);
                
                // Create face outline for better visual context
                this.drawFaceOutline(smoothedLandmarks);

                // Draw face mesh with reduced opacity
                drawConnectors(this.ctx, smoothedLandmarks, FACEMESH_TESSELATION, 
                    {color: '#C0C0C030', lineWidth: 0.5});
                
                // Draw eyes with enhanced visibility
                this.drawEnhancedEyes(smoothedLandmarks);

                // Draw iris with glow effect
                const leftIris = smoothedLandmarks.slice(468, 472);
                const rightIris = smoothedLandmarks.slice(473, 477);
                
                this.drawEnhancedIris(leftIris, '#30FF30');
                this.drawEnhancedIris(rightIris, '#FF3030');

                // Calculate and display distance
                const distance = this.calculateDistance(smoothedLandmarks);
                this.displayDistance(distance);
            }
        }
    }

    smoothLandmarks(landmarks) {
        if (!this.previousLandmarks) {
            this.previousLandmarks = landmarks;
            return landmarks;
        }

        const smoothed = landmarks.map((landmark, i) => ({
            x: this.smoothingFactor * this.previousLandmarks[i].x + (1 - this.smoothingFactor) * landmark.x,
            y: this.smoothingFactor * this.previousLandmarks[i].y + (1 - this.smoothingFactor) * landmark.y,
            z: this.smoothingFactor * this.previousLandmarks[i].z + (1 - this.smoothingFactor) * landmark.z
        }));

        this.previousLandmarks = smoothed;
        return smoothed;
    }

    drawFaceOutline(landmarks) {
        // Draw face contour
        this.ctx.beginPath();
        this.ctx.strokeStyle = '#FFFFFF40';
        this.ctx.lineWidth = 2;
        
        // Face outline points
        const outlinePoints = [10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109];
        
        const firstPoint = landmarks[outlinePoints[0]];
        this.ctx.moveTo(firstPoint.x * this.canvas.width, firstPoint.y * this.canvas.height);
        
        outlinePoints.forEach(index => {
            const point = landmarks[index];
            this.ctx.lineTo(point.x * this.canvas.width, point.y * this.canvas.height);
        });

        this.ctx.closePath();
        this.ctx.stroke();
    }

    drawEnhancedEyes(landmarks) {
        // Draw right eye
        this.ctx.beginPath();
        this.ctx.strokeStyle = '#FF3030';
        this.ctx.lineWidth = 2;
        drawConnectors(this.ctx, landmarks, FACEMESH_RIGHT_EYE, 
            {color: '#FF3030', lineWidth: 2});
        
        // Draw left eye
        this.ctx.beginPath();
        this.ctx.strokeStyle = '#30FF30';
        this.ctx.lineWidth = 2;
        drawConnectors(this.ctx, landmarks, FACEMESH_LEFT_EYE,
            {color: '#30FF30', lineWidth: 2});
    }

    drawEnhancedIris(irisLandmarks, color) {
        // Add glow effect
        this.ctx.shadowColor = color;
        this.ctx.shadowBlur = 15;
        
        this.ctx.beginPath();
        this.ctx.strokeStyle = color;
        this.ctx.lineWidth = 2;

        const firstPoint = irisLandmarks[0];
        this.ctx.moveTo(firstPoint.x * this.canvas.width, firstPoint.y * this.canvas.height);

        for (const point of irisLandmarks) {
            this.ctx.lineTo(point.x * this.canvas.width, point.y * this.canvas.height);
        }

        this.ctx.closePath();
        this.ctx.stroke();
        
        // Reset shadow
        this.ctx.shadowBlur = 0;
    }

    calculateDistance(landmarks) {
        // Get face width in pixels using temple points
        const leftTemple = landmarks[234];
        const rightTemple = landmarks[454];
        
        const faceWidthPixels = Math.hypot(
            (rightTemple.x - leftTemple.x) * this.canvas.width,
            (rightTemple.y - leftTemple.y) * this.canvas.height
        );

        // Use similar triangles formula: Distance = (Known width × Focal length) / Pixel width
        const distance = (this.KNOWN_FACE_WIDTH * this.FOCAL_LENGTH) / faceWidthPixels;
        return distance;
    }

    displayDistance(distance) {
        this.ctx.font = '24px Arial';
        this.ctx.fillStyle = '#FFFFFF';
        this.ctx.fillRect(10, 10, 250, 35);
        this.ctx.fillStyle = '#000000';
        this.ctx.fillText(`Distance: ${distance.toFixed(2)} meters`, 20, 35);
    }
} 