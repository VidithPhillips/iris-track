class FaceTracker {
    constructor() {
        this.holistic = new Holistic({
            locateFile: (file) => {
                return `https://cdn.jsdelivr.net/npm/@mediapipe/holistic/${file}`;
            }
        });

        this.holistic.setOptions({
            modelComplexity: 1,
            smoothLandmarks: true,
            enableSegmentation: false,
            smoothSegmentation: true,
            refineFaceLandmarks: true,
            minDetectionConfidence: 0.5,
            minTrackingConfidence: 0.5,
            selfieMode: true  // Add this if camera is mirrored
        });

        // Add known measurements for distance calculation
        this.KNOWN_FACE_WIDTH = 0.15; // Average face width in meters
        this.FOCAL_LENGTH = 615; // Focal length in pixels (can be calibrated)

        // Add tracking stability parameters
        this.previousLandmarks = null;
        this.smoothingFactor = 0.7; // Adjust for more/less smoothing
        this.backgroundAlpha = 0.3; // Background darkness

        // Add head pose parameters
        this.headPose = {
            pitch: 0, // X-axis rotation (nodding)
            yaw: 0,   // Y-axis rotation (turning)
            roll: 0   // Z-axis rotation (tilting)
        };

        // Add these properties in the constructor after the headPose object
        // Add angle smoothing
        this.previousHeadPose = {
            pitch: 0,
            yaw: 0,
            roll: 0
        };
        this.angleSmoothingFactor = 0.85; // Higher = smoother but more latency

        // Reference axes colors
        this.axesColors = {
            x: '#FF0000', // Sagittal plane (red)
            y: '#00FF00', // Coronal plane (green)
            z: '#0000FF'  // Transverse plane (blue)
        };
    }

    async initialize(videoElement, canvasElement) {
        this.video = videoElement;
        this.canvas = canvasElement;
        this.ctx = canvasElement.getContext('2d');

        this.holistic.onResults(this.onResults.bind(this));

        this.camera = new Camera(this.video, {
            onFrame: async () => {
                await this.holistic.send({image: this.video});
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
        
        // Check for face mesh results from holistic
        if (results.faceLandmarks) {
            // Apply smoothing to landmarks
            const smoothedLandmarks = this.smoothLandmarks(results.faceLandmarks);
            
            // Create face outline for better visual context
            this.drawFaceOutline(smoothedLandmarks);

            // Draw face mesh with reduced opacity
            drawConnectors(this.ctx, smoothedLandmarks, FACEMESH_TESSELATION, 
                {color: '#C0C0C030', lineWidth: 0.5});
            
            // Draw eyes with enhanced visibility
            this.drawEnhancedEyes(smoothedLandmarks);

            // Draw iris
            const leftIris = smoothedLandmarks.slice(468, 472);
            const rightIris = smoothedLandmarks.slice(473, 477);
            
            this.drawEnhancedIris(leftIris, '#30FF30');
            this.drawEnhancedIris(rightIris, '#FF3030');

            // Calculate and display distance
            const distance = this.calculateDistance(smoothedLandmarks);
            this.displayDistance(distance);

            // If we have both pose and face landmarks, calculate head pose
            if (results.poseLandmarks) {
                this.calculateHeadPose(results.poseLandmarks, results.faceLandmarks);
                this.displayHeadPose();
                this.drawBodyPose(results.poseLandmarks);
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

    calculateHeadPose(poseLandmarks, faceLandmarks) {
        // Get body midline (using shoulders)
        const leftShoulder = poseLandmarks[11];
        const rightShoulder = poseLandmarks[12];
        const bodyMidline = {
            x: (leftShoulder.x + rightShoulder.x) / 2,
            y: (leftShoulder.y + rightShoulder.y) / 2,
            z: (leftShoulder.z + rightShoulder.z) / 2
        };

        // Get head midline points
        const nose = faceLandmarks[1];
        const midEyes = {
            x: (faceLandmarks[33].x + faceLandmarks[133].x) / 2,
            y: (faceLandmarks[33].y + faceLandmarks[133].y) / 2,
            z: (faceLandmarks[33].z + faceLandmarks[133].z) / 2
        };

        // Calculate angles
        this.headPose.yaw = this.calculateYawAngle(bodyMidline, nose);
        this.headPose.pitch = this.calculatePitchAngle(bodyMidline, nose, midEyes);
        this.headPose.roll = this.calculateRollAngle(faceLandmarks[33], faceLandmarks[133]);
    }

    calculateYawAngle(bodyMidline, nose) {
        // Calculate horizontal rotation (left/right turning)
        const dx = nose.x - bodyMidline.x;
        const dz = nose.z - bodyMidline.z;
        return Math.atan2(dx, dz) * (180 / Math.PI);
    }

    calculatePitchAngle(bodyMidline, nose, midEyes) {
        // Calculate vertical rotation (nodding)
        const dy = nose.y - midEyes.y;
        const dz = nose.z - midEyes.z;
        return Math.atan2(dy, dz) * (180 / Math.PI);
    }

    calculateRollAngle(leftEye, rightEye) {
        // Calculate roll (head tilt)
        const dx = rightEye.x - leftEye.x;
        const dy = rightEye.y - leftEye.y;
        return Math.atan2(dy, dx) * (180 / Math.PI);
    }

    displayHeadPose() {
        const yOffset = 50;
        this.ctx.font = '16px Arial';
        
        // Create background for better visibility
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        this.ctx.fillRect(10, yOffset, 200, 90);
        
        this.ctx.fillStyle = '#FFFFFF';
        this.ctx.fillText(`Head Pose Angles:`, 20, yOffset + 20);
        this.ctx.fillText(`Yaw: ${this.headPose.yaw.toFixed(1)}°`, 20, yOffset + 40);
        this.ctx.fillText(`Pitch: ${this.headPose.pitch.toFixed(1)}°`, 20, yOffset + 60);
        this.ctx.fillText(`Roll: ${this.headPose.roll.toFixed(1)}°`, 20, yOffset + 80);
    }

    drawBodyPose(poseLandmarks) {
        // Make body landmarks more visible
        this.ctx.fillStyle = '#00FF00';
        this.ctx.strokeStyle = '#00FF00';
        this.ctx.lineWidth = 3;

        // Draw connections between key body points
        const connections = [
            [11, 12], // shoulders
            [11, 13], // left upper arm
            [13, 15], // left lower arm
            [12, 14], // right upper arm
            [14, 16], // right lower arm
            [11, 23], // left torso
            [12, 24], // right torso
            [23, 24]  // hips
        ];

        for (const [start, end] of connections) {
            const startPoint = poseLandmarks[start];
            const endPoint = poseLandmarks[end];
            
            this.ctx.beginPath();
            this.ctx.moveTo(startPoint.x * this.canvas.width, startPoint.y * this.canvas.height);
            this.ctx.lineTo(endPoint.x * this.canvas.width, endPoint.y * this.canvas.height);
            this.ctx.stroke();
        }

        // Draw landmarks
        for (const landmark of poseLandmarks) {
            const x = landmark.x * this.canvas.width;
            const y = landmark.y * this.canvas.height;
            
            this.ctx.beginPath();
            this.ctx.arc(x, y, 4, 0, 2 * Math.PI);
            this.ctx.fill();
        }
    }

    smoothAngle(current, previous) {
        return previous * this.angleSmoothingFactor + current * (1 - this.angleSmoothingFactor);
    }

    drawReferenceAxes() {
        const centerX = 580;
        const centerY = 60;
        const axisLength = 30;

        // Draw anatomical reference diagram
        this.ctx.save();
        this.ctx.translate(centerX, centerY);

        // Draw axes labels
        this.ctx.font = '12px Arial';
        this.ctx.fillStyle = '#FFFFFF';
        
        // Sagittal plane (X-axis)
        this.ctx.strokeStyle = this.axesColors.x;
        this.ctx.beginPath();
        this.ctx.moveTo(-axisLength, 0);
        this.ctx.lineTo(axisLength, 0);
        this.ctx.stroke();
        this.ctx.fillText('Sagittal', axisLength + 5, 4);

        // Coronal plane (Y-axis)
        this.ctx.strokeStyle = this.axesColors.y;
        this.ctx.beginPath();
        this.ctx.moveTo(0, -axisLength);
        this.ctx.lineTo(0, axisLength);
        this.ctx.stroke();
        this.ctx.fillText('Coronal', 5, -axisLength - 5);

        // Transverse plane (circle for Z-axis)
        this.ctx.strokeStyle = this.axesColors.z;
        this.ctx.beginPath();
        this.ctx.arc(0, 0, axisLength/2, 0, 2 * Math.PI);
        this.ctx.stroke();
        this.ctx.fillText('Transverse', -axisLength - 60, 4);

        this.ctx.restore();
    }

    drawNeckLine(poseLandmarks, faceLandmarks) {
        const nose = faceLandmarks[1];
        const midShoulders = {
            x: (poseLandmarks[11].x + poseLandmarks[12].x) / 2,
            y: (poseLandmarks[11].y + poseLandmarks[12].y) / 2
        };

        // Draw neck line
        this.ctx.beginPath();
        this.ctx.strokeStyle = '#FFFF00';
        this.ctx.lineWidth = 3;
        this.ctx.moveTo(
            midShoulders.x * this.canvas.width,
            midShoulders.y * this.canvas.height
        );
        this.ctx.lineTo(
            nose.x * this.canvas.width,
            nose.y * this.canvas.height
        );
        this.ctx.stroke();

        // Add direction indicator
        this.drawHeadDirectionIndicator(nose, this.headPose.yaw);
    }

    drawHeadDirectionIndicator(nose, yawAngle) {
        const arrowLength = 20;
        
        this.ctx.save();
        this.ctx.translate(
            nose.x * this.canvas.width,
            nose.y * this.canvas.height
        );
        this.ctx.rotate(yawAngle * Math.PI / 180);

        // Draw direction arrow
        this.ctx.beginPath();
        this.ctx.strokeStyle = '#FFFF00';
        this.ctx.lineWidth = 2;
        this.ctx.moveTo(0, 0);
        this.ctx.lineTo(arrowLength, 0);
        this.ctx.lineTo(arrowLength - 5, -5);
        this.ctx.moveTo(arrowLength, 0);
        this.ctx.lineTo(arrowLength - 5, 5);
        this.ctx.stroke();

        this.ctx.restore();
    }
} 