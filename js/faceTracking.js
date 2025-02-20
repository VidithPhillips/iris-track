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
        this.KNOWN_FACE_WIDTH = 0.15;  // Keep this for basic distance calculation
        this.FOCAL_LENGTH = 615;

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

        // Clean color scheme
        this.colors = {
            primary: '#00E676',    // Green for main elements
            text: '#FFFFFF',       // White text
            axis: {
                x: '#FF4444',      // Red for left/right axis
                y: '#44FF44',      // Green for up/down axis
                z: '#4444FF'       // Blue for forward/back axis
            }
        };

        // Head movement visualization
        this.headVisualization = {
            axisLength: 50,        // Length of axis lines
            position: {
                x: this.canvas ? this.canvas.width - 150 : 490,  // Right side position
                y: 120             // Top position
            },
            labels: {
                x: 'Left/Right',
                y: 'Up/Down',
                z: 'Forward/Back'
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
                
                // Draw only essential elements
                this.drawBodyPose(results.poseLandmarks);
                this.drawHeadAxes();  // New axis visualization
                this.drawNeckLine(results.poseLandmarks, results.faceLandmarks);
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
        this.ctx.beginPath();
        this.ctx.strokeStyle = this.colors.face.outline;
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
        this.ctx.strokeStyle = this.colors.face.rightEye;
        drawConnectors(this.ctx, landmarks, FACEMESH_RIGHT_EYE, 
            {color: this.colors.face.rightEye, lineWidth: 2});
        
        // Draw left eye
        this.ctx.strokeStyle = this.colors.face.leftEye;
        drawConnectors(this.ctx, landmarks, FACEMESH_LEFT_EYE,
            {color: this.colors.face.leftEye, lineWidth: 2});
    }

    drawEnhancedIris(irisLandmarks, color) {
        this.ctx.shadowColor = this.colors.face.iris;
        this.ctx.shadowBlur = 15;
        
        this.ctx.beginPath();
        this.ctx.strokeStyle = this.colors.face.iris;
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
        const yOffset = 10;
        this.ctx.font = '16px Arial';
        
        // Background
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        this.ctx.fillRect(10, yOffset, 250, 35);
        
        // Distance text
        this.ctx.fillStyle = this.colors.text;
        this.ctx.fillText(`${this.labels.distance}: ${distance.toFixed(2)}m`, 20, yOffset + 25);
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
        
        // Background
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        this.ctx.fillRect(10, yOffset, 250, 120);
        
        // Labels with descriptions
        this.ctx.fillStyle = this.colors.text;
        this.ctx.fillText('Head Position:', 20, yOffset + 25);
        this.ctx.fillText(`${this.labels.headPose.yaw}: ${this.headPose.yaw.toFixed(1)}°`, 20, yOffset + 50);
        this.ctx.fillText(`${this.labels.headPose.pitch}: ${this.headPose.pitch.toFixed(1)}°`, 20, yOffset + 75);
        this.ctx.fillText(`${this.labels.headPose.roll}: ${this.headPose.roll.toFixed(1)}°`, 20, yOffset + 100);
    }

    drawBodyPose(poseLandmarks) {
        this.ctx.fillStyle = this.colors.primary;
        this.ctx.strokeStyle = this.colors.primary;
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
        this.ctx.strokeStyle = this.colors.face.iris;
        this.ctx.beginPath();
        this.ctx.moveTo(-axisLength, 0);
        this.ctx.lineTo(axisLength, 0);
        this.ctx.stroke();
        this.ctx.fillText('Sagittal', axisLength + 5, 4);

        // Coronal plane (Y-axis)
        this.ctx.strokeStyle = this.colors.face.iris;
        this.ctx.beginPath();
        this.ctx.moveTo(0, -axisLength);
        this.ctx.lineTo(0, axisLength);
        this.ctx.stroke();
        this.ctx.fillText('Coronal', 5, -axisLength - 5);

        // Transverse plane (circle for Z-axis)
        this.ctx.strokeStyle = this.colors.face.iris;
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
        this.ctx.strokeStyle = this.colors.face.iris;
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
        this.ctx.strokeStyle = this.colors.face.iris;
        this.ctx.lineWidth = 2;
        this.ctx.moveTo(0, 0);
        this.ctx.lineTo(arrowLength, 0);
        this.ctx.lineTo(arrowLength - 5, -5);
        this.ctx.moveTo(arrowLength, 0);
        this.ctx.lineTo(arrowLength - 5, 5);
        this.ctx.stroke();

        this.ctx.restore();
    }

    // Simplify the head direction indicator
    drawHeadDirection(faceLandmarks) {
        const { radius, position } = this.directionIndicator;
        const nose = faceLandmarks[1];
        
        // Calculate combined head movement
        const pitch = this.headPose.pitch * Math.PI / 180;
        const yaw = this.headPose.yaw * Math.PI / 180;
        
        // Draw a more prominent direction arrow
        this.ctx.save();
        this.ctx.translate(position.x, position.y);
        
        // Draw compass-like base
        this.ctx.beginPath();
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
        this.ctx.lineWidth = 2;
        
        // Draw cardinal directions
        ['N', 'E', 'S', 'W'].forEach((dir, i) => {
            const angle = i * Math.PI/2;
            this.ctx.moveTo(0, 0);
            this.ctx.lineTo(Math.cos(angle) * radius, Math.sin(angle) * radius);
            this.ctx.fillStyle = '#FFFFFF';
            this.ctx.fillText(dir, 
                Math.cos(angle) * (radius + 15),
                Math.sin(angle) * (radius + 15));
        });
        this.ctx.stroke();

        // Draw head direction
        const angle = Math.atan2(Math.sin(pitch), Math.sin(yaw));
        const magnitude = Math.sqrt(pitch * pitch + yaw * yaw) / Math.PI;
        
        this.ctx.beginPath();
        this.ctx.strokeStyle = this.colors.secondary;
        this.ctx.lineWidth = 3;
        this.ctx.shadowColor = this.colors.secondary;
        this.ctx.shadowBlur = 10;
        
        // Draw arrow
        const arrowLength = radius * Math.min(magnitude, 1);
        const endX = Math.cos(angle) * arrowLength;
        const endY = Math.sin(angle) * arrowLength;
        
        this.ctx.moveTo(0, 0);
        this.ctx.lineTo(endX, endY);
        this.ctx.stroke();
        
        // Draw arrow head
        const headLength = 10;
        const headAngle = Math.PI / 6;
        this.ctx.beginPath();
        this.ctx.moveTo(endX, endY);
        this.ctx.lineTo(
            endX - headLength * Math.cos(angle - headAngle),
            endY - headLength * Math.sin(angle - headAngle)
        );
        this.ctx.moveTo(endX, endY);
        this.ctx.lineTo(
            endX - headLength * Math.cos(angle + headAngle),
            endY - headLength * Math.sin(angle + headAngle)
        );
        this.ctx.stroke();
        
        this.ctx.restore();
    }

    drawMotionTrail(faceLandmarks) {
        const nose = faceLandmarks[1];
        const currentPos = {
            x: nose.x * this.canvas.width,
            y: nose.y * this.canvas.height,
            timestamp: Date.now()
        };

        // Add current position to trail
        this.motionTrail.positions.push(currentPos);
        
        // Remove old positions
        if (this.motionTrail.positions.length > this.motionTrail.maxLength) {
            this.motionTrail.positions.shift();
        }

        // Draw trail
        this.ctx.beginPath();
        this.ctx.strokeStyle = this.colors.primary;
        this.ctx.lineWidth = 2;

        this.motionTrail.positions.forEach((pos, i) => {
            const opacity = (i / this.motionTrail.maxLength) * this.motionTrail.opacity;
            this.ctx.strokeStyle = `rgba(0, 230, 118, ${opacity})`;
            
            if (i === 0) {
                this.ctx.moveTo(pos.x, pos.y);
            } else {
                this.ctx.lineTo(pos.x, pos.y);
            }
        });
        this.ctx.stroke();
    }

    drawStabilityIndicator(magnitude) {
        const targetRadius = this.stabilityIndicator.maxRadius - 
            (magnitude * (this.stabilityIndicator.maxRadius - this.stabilityIndicator.minRadius));
        
        this.stabilityIndicator.currentRadius += 
            (targetRadius - this.stabilityIndicator.currentRadius) * this.stabilityIndicator.smoothing;

        this.ctx.beginPath();
        this.ctx.strokeStyle = this.colors.accent;
        this.ctx.lineWidth = 2;
        this.ctx.arc(
            this.canvas.width - 50,
            50,
            this.stabilityIndicator.currentRadius,
            0,
            2 * Math.PI
        );
        this.ctx.stroke();

        // Add glow effect based on stability
        const glowSize = Math.max(0, 20 - magnitude * 15);
        this.ctx.shadowColor = this.colors.accent;
        this.ctx.shadowBlur = glowSize;
        this.ctx.stroke();
        this.ctx.shadowBlur = 0;
    }

    // Add new method for 3D head direction visualization
    draw3DHeadDirection() {
        const { size, position, colors } = this.headDirection;
        const { pitch, yaw, roll } = this.headPose;

        this.ctx.save();
        this.ctx.translate(position.x, position.y);

        // Convert angles to radians
        const pitchRad = pitch * Math.PI / 180;
        const yawRad = yaw * Math.PI / 180;
        const rollRad = roll * Math.PI / 180;

        // Draw 3D arrow
        this.drawHeadArrow(size, pitchRad, yawRad, rollRad, colors);

        // Add direction labels
        this.drawDirectionLabels(size);

        this.ctx.restore();
    }

    drawHeadArrow(size, pitch, yaw, roll, colors) {
        // Draw base circle
        this.ctx.beginPath();
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
        this.ctx.lineWidth = 2;
        this.ctx.arc(0, 0, size, 0, 2 * Math.PI);
        this.ctx.stroke();

        // Calculate 3D direction vector
        const x = Math.sin(yaw) * Math.cos(pitch) * size;
        const y = -Math.sin(pitch) * size;
        const z = Math.cos(yaw) * Math.cos(pitch) * size;

        // Project to 2D
        const scale = 1 + z / (size * 2);  // Perspective scaling
        const projX = x * scale;
        const projY = y * scale;

        // Draw main direction arrow
        this.ctx.beginPath();
        this.ctx.strokeStyle = colors.forward;
        this.ctx.lineWidth = 3;
        this.ctx.shadowColor = colors.forward;
        this.ctx.shadowBlur = 10;

        // Draw arrow with perspective
        this.ctx.moveTo(0, 0);
        this.ctx.lineTo(projX, projY);
        this.ctx.stroke();

        // Draw arrow head
        const headSize = 10 * scale;
        const angle = Math.atan2(projY, projX);
        this.ctx.beginPath();
        this.ctx.moveTo(projX, projY);
        this.ctx.lineTo(
            projX - headSize * Math.cos(angle - Math.PI/6),
            projY - headSize * Math.sin(angle - Math.PI/6)
        );
        this.ctx.moveTo(projX, projY);
        this.ctx.lineTo(
            projX - headSize * Math.cos(angle + Math.PI/6),
            projY - headSize * Math.sin(angle + Math.PI/6)
        );
        this.ctx.stroke();

        // Reset shadow
        this.ctx.shadowBlur = 0;
    }

    drawDirectionLabels(size) {
        this.ctx.font = '14px Arial';
        this.ctx.fillStyle = '#FFFFFF';
        
        // Add direction labels with icons
        this.ctx.fillText('↑ Up', -15, -size - 10);
        this.ctx.fillText('← Left', -size - 40, 5);
        this.ctx.fillText('Right →', size + 10, 5);
        this.ctx.fillText('↓ Down', -20, size + 20);
    }

    // New method to draw head rotation axes
    drawHeadAxes() {
        const { axisLength, position, labels } = this.headVisualization;
        const { pitch, yaw, roll } = this.headPose;

        this.ctx.save();
        this.ctx.translate(position.x, position.y);

        // Draw axis lines with labels
        // X-axis (left/right)
        this.drawAxis(
            axisLength, 
            yaw,           // Use yaw angle for x-axis
            this.colors.axis.x, 
            labels.x
        );

        // Y-axis (up/down)
        this.drawAxis(
            axisLength, 
            pitch,         // Use pitch angle for y-axis
            this.colors.axis.y, 
            labels.y,
            Math.PI/2     // Rotate 90 degrees for vertical
        );

        // Z-axis (forward/back) - shown as a circle that changes size
        this.drawZAxis(axisLength, roll, labels.z);

        this.ctx.restore();
    }

    drawAxis(length, angle, color, label, baseRotation = 0) {
        this.ctx.save();
        this.ctx.rotate(baseRotation);

        // Draw base line
        this.ctx.beginPath();
        this.ctx.strokeStyle = color;
        this.ctx.lineWidth = 2;
        this.ctx.moveTo(-length/2, 0);
        this.ctx.lineTo(length/2, 0);
        this.ctx.stroke();

        // Draw angle indicator
        this.ctx.beginPath();
        this.ctx.rotate(angle * Math.PI/180);
        this.ctx.moveTo(0, 0);
        this.ctx.lineTo(length/2, 0);
        this.ctx.strokeStyle = color;
        this.ctx.lineWidth = 3;
        this.ctx.stroke();

        // Add label
        this.ctx.fillStyle = color;
        this.ctx.font = '14px Arial';
        this.ctx.fillText(`${label}: ${angle.toFixed(1)}°`, length/2 + 10, 0);

        this.ctx.restore();
    }

    drawZAxis(length, angle, label) {
        // Draw circular indicator for Z-axis
        this.ctx.beginPath();
        this.ctx.strokeStyle = this.colors.axis.z;
        this.ctx.lineWidth = 2;
        this.ctx.arc(0, 0, length/4, 0, 2 * Math.PI);
        this.ctx.stroke();

        // Add rotation indicator
        this.ctx.save();
        this.ctx.rotate(angle * Math.PI/180);
        this.ctx.beginPath();
        this.ctx.moveTo(0, -length/4);
        this.ctx.lineTo(0, length/4);
        this.ctx.strokeStyle = this.colors.axis.z;
        this.ctx.lineWidth = 3;
        this.ctx.stroke();
        this.ctx.restore();

        // Add label
        this.ctx.fillStyle = this.colors.axis.z;
        this.ctx.fillText(`${label}: ${angle.toFixed(1)}°`, -length/2, length/2 + 20);
    }
} 