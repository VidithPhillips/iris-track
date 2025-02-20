// Add these constants at the top of the file
const FACEMESH_TESSELATION = [
    [127, 34], [34, 139], [139, 127] /* ... */
];

const FACEMESH_RIGHT_EYE = [
    [33, 7], [7, 163], [163, 144], [144, 145], [145, 153],
    [153, 154], [154, 155], [155, 133], [33, 246], [246, 161],
    [161, 160], [160, 159], [159, 158], [158, 157], [157, 173],
    [173, 133]
];

const FACEMESH_LEFT_EYE = [
    [362, 382], [382, 381], [381, 380], [380, 374], [374, 373],
    [373, 390], [390, 249], [249, 263], [263, 466], [466, 388],
    [388, 387], [387, 386], [386, 385], [385, 384], [384, 398],
    [398, 362]
];

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
        this.angleSmoothingFactor = 0.92; // Increased for more stability

        // Reference axes colors
        this.axesColors = {
            x: '#FF0000', // Sagittal plane (red)
            y: '#00FF00', // Coronal plane (green)
            z: '#0000FF'  // Transverse plane (blue)
        };

        // Add 3D visualization parameters
        this.visualization3D = {
            scale: 50,  // Smaller scale for cleaner visualization
            lineWidth: 2,
            colors: {
                sagittal: 'rgba(255, 0, 0, 0.4)',    // Semi-transparent red
                coronal: 'rgba(0, 255, 0, 0.4)',     // Semi-transparent green
                transverse: 'rgba(0, 0, 255, 0.4)'   // Semi-transparent blue
            },
            labels: {
                sagittal: 'Sagittal Plane (Left/Right)',
                coronal: 'Coronal Plane (Front/Back)',
                transverse: 'Transverse Plane (Up/Down)'
            }
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
                
                // Draw visualization elements in correct order
                this.drawBodyPose(results.poseLandmarks);
                this.draw3DPlanes(results.faceLandmarks);
                this.drawNeckLine(results.poseLandmarks, results.faceLandmarks);
                this.drawReferenceAxes();
                this.displayHeadPose();
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
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        this.ctx.fillRect(10, yOffset, 250, 120);
        
        this.ctx.fillStyle = '#FFFFFF';
        this.ctx.fillText('Head Rotation Angles:', 20, yOffset + 20);
        
        // Display angles with anatomical descriptions
        this.ctx.fillStyle = this.axesColors.x;
        this.ctx.fillText(`Pitch: ${this.headPose.pitch.toFixed(1)}° (Nod)`, 20, yOffset + 50);
        
        this.ctx.fillStyle = this.axesColors.y;
        this.ctx.fillText(`Yaw: ${this.headPose.yaw.toFixed(1)}° (Turn)`, 20, yOffset + 80);
        
        this.ctx.fillStyle = this.axesColors.z;
        this.ctx.fillText(`Roll: ${this.headPose.roll.toFixed(1)}° (Tilt)`, 20, yOffset + 110);
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
        // Handle angle wrapping
        const diff = current - previous;
        const wrapped = diff - Math.round(diff / 360) * 360;
        return previous + wrapped * (1 - this.angleSmoothingFactor);
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

    // Add new method for 3D plane visualization
    draw3DPlanes(faceLandmarks) {
        const nose = faceLandmarks[1];
        const noseX = nose.x * this.canvas.width;
        const noseY = nose.y * this.canvas.height;
        
        // Draw anatomical planes with labels
        this.ctx.save();
        this.ctx.translate(noseX, noseY);
        
        // Draw anatomical reference planes
        const planeSize = this.visualization3D.scale;
        
        // Sagittal plane (divides body into left and right)
        this.ctx.fillStyle = this.visualization3D.colors.sagittal;
        this.ctx.strokeStyle = '#FF0000';
        this.drawAnatomicalPlane('vertical', planeSize, this.headPose.yaw);
        this.ctx.fillText(this.visualization3D.labels.sagittal, planeSize + 10, 0);

        // Coronal plane (divides body into front and back)
        this.ctx.fillStyle = this.visualization3D.colors.coronal;
        this.ctx.strokeStyle = '#00FF00';
        this.drawAnatomicalPlane('horizontal', planeSize, this.headPose.roll);
        this.ctx.fillText(this.visualization3D.labels.coronal, 0, -planeSize - 10);

        // Transverse plane (divides body into top and bottom)
        this.ctx.fillStyle = this.visualization3D.colors.transverse;
        this.ctx.strokeStyle = '#0000FF';
        this.drawAnatomicalPlane('horizontal', planeSize, this.headPose.pitch);
        this.ctx.fillText(this.visualization3D.labels.transverse, 0, planeSize + 20);

        this.ctx.restore();
    }

    // New method for drawing anatomical planes
    drawAnatomicalPlane(orientation, size, angle) {
        this.ctx.save();
        this.ctx.rotate(angle * Math.PI / 180);
        
        // Draw the plane with fill and border
        this.ctx.beginPath();
        if (orientation === 'vertical') {
            this.ctx.rect(-size/4, -size, size/2, size * 2);
        } else {
            this.ctx.rect(-size, -size/4, size * 2, size/2);
        }
        this.ctx.fill();
        this.ctx.stroke();

        // Add direction indicators
        this.drawDirectionIndicators(orientation, size);
        
        this.ctx.restore();
    }

    // New method for drawing direction indicators
    drawDirectionIndicators(orientation, size) {
        const arrowSize = size / 4;
        this.ctx.lineWidth = 2;
        
        if (orientation === 'vertical') {
            // Draw left/right arrows
            this.drawArrow(0, -size/2, arrowSize, 0);
            this.drawArrow(0, size/2, arrowSize, Math.PI);
        } else {
            // Draw front/back or up/down arrows
            this.drawArrow(-size/2, 0, arrowSize, -Math.PI/2);
            this.drawArrow(size/2, 0, arrowSize, Math.PI/2);
        }
    }

    // Helper method for drawing arrows
    drawArrow(x, y, size, angle) {
        this.ctx.save();
        this.ctx.translate(x, y);
        this.ctx.rotate(angle);
        
        this.ctx.beginPath();
        this.ctx.moveTo(0, 0);
        this.ctx.lineTo(0, size);
        this.ctx.moveTo(-size/3, size/3);
        this.ctx.lineTo(0, size);
        this.ctx.lineTo(size/3, size/3);
        this.ctx.stroke();
        
        this.ctx.restore();
    }
} 