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

        // Modern color scheme
        this.colors = {
            primary: '#00E676',    // Bright green for main elements
            secondary: '#FFFFFF',   // White for supporting elements
            accent: '#FFD700',     // Gold for highlights
            text: '#FFFFFF',       // White text
            background: 'rgba(0, 0, 0, 0.7)', // Semi-transparent black
            face: {
                mesh: 'rgba(255, 255, 255, 0.1)',  // Subtle white for face mesh
                outline: 'rgba(255, 255, 255, 0.4)', // More visible white for outline
                leftEye: '#00E676',  // Green for left eye
                rightEye: '#00E676', // Green for right eye
                iris: '#FFD700'      // Gold for iris
            }
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

        // Direction indicator settings
        this.directionIndicator = {
            radius: 80,
            arrowSize: 25,
            position: {
                x: 320,
                y: 100
            },
            colors: {
                base: 'rgba(255, 255, 255, 0.2)',
                arrow: '#00E676'  // Using primary color
            }
        };

        // Add motion trail parameters
        this.motionTrail = {
            positions: [],
            maxLength: 20,  // Number of positions to remember
            opacity: 0.6,   // Starting opacity
            fadeRate: 0.03  // How quickly trail fades
        };

        // Add stability indicator parameters
        this.stabilityIndicator = {
            radius: 40,
            maxRadius: 60,
            minRadius: 30,
            currentRadius: 40,
            smoothing: 0.1
        };

        // Add display transition parameters
        this.displayTransition = {
            values: {
                pitch: 0,
                yaw: 0,
                roll: 0
            },
            smoothing: 0.15
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
                this.drawMotionTrail(results.faceLandmarks);
                this.drawBodyPose(results.poseLandmarks);
                this.drawHeadDirection(results.faceLandmarks);
                this.drawNeckLine(results.poseLandmarks, results.faceLandmarks);
                
                // Calculate overall movement magnitude for stability indicator
                const magnitude = Math.sqrt(
                    this.headPose.pitch * this.headPose.pitch +
                    this.headPose.yaw * this.headPose.yaw +
                    this.headPose.roll * this.headPose.roll
                ) / 180;
                this.drawStabilityIndicator(magnitude);
                
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
        // Update transition values
        this.displayTransition.values.pitch += (this.headPose.pitch - this.displayTransition.values.pitch) * this.displayTransition.smoothing;
        this.displayTransition.values.yaw += (this.headPose.yaw - this.displayTransition.values.yaw) * this.displayTransition.smoothing;
        this.displayTransition.values.roll += (this.headPose.roll - this.displayTransition.values.roll) * this.displayTransition.smoothing;

        const yOffset = 50;
        this.ctx.font = '16px Arial';
        
        // Background with gradient
        const gradient = this.ctx.createLinearGradient(10, yOffset, 260, yOffset + 120);
        gradient.addColorStop(0, 'rgba(0, 0, 0, 0.8)');
        gradient.addColorStop(1, 'rgba(0, 0, 0, 0.6)');
        this.ctx.fillStyle = gradient;
        this.ctx.fillRect(10, yOffset, 250, 120);
        
        // Add subtle border
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        this.ctx.strokeRect(10, yOffset, 250, 120);

        // Text with smooth transitions
        this.ctx.fillStyle = this.colors.text;
        this.ctx.fillText('Head Rotation:', 20, yOffset + 20);
        this.ctx.fillText(`Pitch (Nod): ${this.displayTransition.values.pitch.toFixed(1)}°`, 20, yOffset + 50);
        this.ctx.fillText(`Yaw (Turn): ${this.displayTransition.values.yaw.toFixed(1)}°`, 20, yOffset + 80);
        this.ctx.fillText(`Roll (Tilt): ${this.displayTransition.values.roll.toFixed(1)}°`, 20, yOffset + 110);
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

    // Replace the complex draw3DPlanes with this simpler visualization
    drawHeadDirection(faceLandmarks) {
        const { radius, arrowSize, position, colors } = this.directionIndicator;
        
        this.ctx.save();
        this.ctx.translate(position.x, position.y);

        // Draw circular base
        this.ctx.beginPath();
        this.ctx.strokeStyle = colors.base;
        this.ctx.lineWidth = 2;
        this.ctx.arc(0, 0, radius, 0, 2 * Math.PI);
        this.ctx.stroke();

        // Calculate combined direction from angles
        const pitch = this.headPose.pitch * Math.PI / 180;
        const yaw = this.headPose.yaw * Math.PI / 180;
        const roll = this.headPose.roll * Math.PI / 180;

        // Calculate direction vector
        const directionX = Math.sin(yaw) * Math.cos(pitch);
        const directionY = Math.sin(pitch);
        const magnitude = Math.sqrt(directionX * directionX + directionY * directionY);

        // Only draw arrow if there's significant movement
        if (magnitude > 0.1) {
            const angle = Math.atan2(directionY, directionX);
            
            // Draw direction arrow
            this.ctx.shadowColor = this.colors.primary;
            this.ctx.shadowBlur = 10;
            this.ctx.strokeStyle = this.colors.primary;
            this.ctx.lineWidth = 3;
            
            // Draw arrow shaft
            this.ctx.beginPath();
            this.ctx.moveTo(0, 0);
            const endX = Math.cos(angle) * radius;
            const endY = Math.sin(angle) * radius;
            this.ctx.lineTo(endX, endY);
            
            // Draw arrow head
            const arrowAngle = Math.PI / 6; // 30 degrees
            this.ctx.lineTo(
                endX - arrowSize * Math.cos(angle - arrowAngle),
                endY - arrowSize * Math.sin(angle - arrowAngle)
            );
            this.ctx.moveTo(endX, endY);
            this.ctx.lineTo(
                endX - arrowSize * Math.cos(angle + arrowAngle),
                endY - arrowSize * Math.sin(angle + arrowAngle)
            );
            this.ctx.stroke();

            // Reset shadow
            this.ctx.shadowBlur = 0;
            
            // Add magnitude indicator
            const magnitudeText = `${(magnitude * 100).toFixed(0)}%`;
            this.ctx.font = '14px Arial';
            this.ctx.fillStyle = this.colors.primary;
            this.ctx.fillText(magnitudeText, endX + 10, endY);
        }

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
} 