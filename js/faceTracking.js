// Update the FACEMESH_TESSELATION array with complete points
const FACEMESH_TESSELATION = [
    [127, 34], [34, 139], [139, 127], [11, 0], [0, 37], [37, 11],
    [232, 231], [231, 120], [120, 232], [72, 37], [37, 39], [39, 72],
    [128, 121], [121, 47], [47, 128], [232, 121], [121, 128], [128, 232],
    [104, 69], [69, 67], [67, 104], [175, 171], [171, 148], [148, 175],
    [118, 50], [50, 101], [101, 118], [73, 39], [39, 40], [40, 73],
    [9, 151], [151, 108], [108, 9], [48, 115], [115, 131], [131, 48],
    [194, 204], [204, 211], [211, 194], [74, 40], [40, 185], [185, 74],
    [80, 42], [42, 183], [183, 80], [40, 92], [92, 186], [186, 40],
    [230, 229], [229, 118], [118, 230], [202, 212], [212, 214], [214, 202],
    [83, 18], [18, 17], [17, 83], [76, 61], [61, 146], [146, 76],
    [160, 159], [159, 158], [158, 160], [172, 171], [171, 148], [148, 172],
    [112, 26], [26, 22], [22, 112], [183, 42], [42, 41], [41, 183],
    [97, 96], [96, 95], [95, 97], [78, 62], [62, 96], [96, 78],
    [19, 18], [18, 70], [70, 19], [61, 60], [60, 166], [166, 61],
    [178, 179], [179, 180], [180, 178], [189, 190], [190, 191], [191, 189]
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
            enableSegmentation: true,
            smoothSegmentation: true,
            refineFaceLandmarks: true,
            minDetectionConfidence: 0.5,
            minTrackingConfidence: 0.5
        });

        // Core parameters
        this.smoothingFactor = 0.7;
        this.backgroundAlpha = 0.3;

        // Head pose tracking
        this.headPose = {
            pitch: 0,
            yaw: 0,
            roll: 0
        };

        // Colors
        this.colors = {
            primary: '#00E676',
            text: '#FFFFFF',
            face: {
                mesh: 'rgba(255, 255, 255, 0.1)',
                outline: 'rgba(255, 255, 255, 0.3)',
                eyes: '#00E676',
                iris: '#FFD700'
            },
            axis: {
                x: '#FF4444',
                y: '#44FF44',
                z: '#4444FF'
            }
        };

        // Update distance calibration
        this.distanceCalibration = {
            FACE_WIDTH_CM: 15,
            focalLength: null,
            isCalibrated: false,
            knownDistance: 60  // Calibration distance in cm
        };

        // Add error tracking
        this.errorCount = 0;
        this.maxErrors = 5;

        // Add iris tracking parameters
        this.irisTracking = {
            left: { x: 0, y: 0, angle: 0 },
            right: { x: 0, y: 0, angle: 0 },
            baselineSet: false,
            baseline: { left: { x: 0, y: 0 }, right: { x: 0, y: 0 } }
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

    showError(message) {
        const statusEl = document.getElementById('statusMessage');
        statusEl.textContent = message;
        statusEl.classList.remove('hidden');
    }

    cleanup() {
        this.isCleanedUp = true;
        if (this.holistic) {
            this.holistic.close();
        }
    }

    onResults(results) {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.fillStyle = `rgba(0, 0, 0, ${this.backgroundAlpha})`;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        if (!results.faceLandmarks) {
            this.ctx.font = '24px Arial';
            this.ctx.fillStyle = '#fff';
            this.ctx.fillText('No face detected', this.canvas.width/2 - 70, this.canvas.height/2);
            return;
        }

        // Draw face mesh
        drawConnectors(this.ctx, results.faceLandmarks, FACEMESH_TESSELATION, 
            {color: this.colors.face.mesh, lineWidth: 1});
        
        // Draw face outline
        this.drawFaceOutline(results.faceLandmarks);
        
        // Draw eyes
        this.drawEnhancedEyes(results.faceLandmarks);

        if (results.poseLandmarks) {
            this.calculateHeadPose(results.poseLandmarks, results.faceLandmarks);
            this.drawHeadAxes();
            this.displayHeadPose();
        }

        // Calculate and display distance
        const distance = this.calculateDistance(results.faceLandmarks);
        this.displayDistance(distance);

        if (results.faceLandmarks) {
            this.landmarks = results.faceLandmarks;  // Store landmarks for reference

            // Calculate iris positions
            const leftIris = results.faceLandmarks.slice(468, 472);
            const rightIris = results.faceLandmarks.slice(473, 477);

            const leftPosition = this.calculateIrisPosition(leftIris, true);
            const rightPosition = this.calculateIrisPosition(rightIris, false);

            if (leftPosition && rightPosition) {
                this.irisTracking.left = leftPosition;
                this.irisTracking.right = rightPosition;

                // Set baseline if not set
                if (!this.irisTracking.baselineSet) {
                    this.irisTracking.baseline = {
                        left: { ...leftPosition },
                        right: { ...rightPosition }
                    };
                    this.irisTracking.baselineSet = true;
                }

                // Display iris tracking data
                this.displayIrisTracking();
            }
        }
    }

    drawFaceOutline(landmarks) {
        this.ctx.beginPath();
        this.ctx.strokeStyle = this.colors.face.outline;
        this.ctx.lineWidth = 2;
        
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
        // Draw eyes
        drawConnectors(this.ctx, landmarks, FACEMESH_RIGHT_EYE, 
            {color: this.colors.face.eyes, lineWidth: 2});
        drawConnectors(this.ctx, landmarks, FACEMESH_LEFT_EYE,
            {color: this.colors.face.eyes, lineWidth: 2});

        // Draw iris
        const leftIris = landmarks.slice(468, 472);
        const rightIris = landmarks.slice(473, 477);
        
        this.drawIris(leftIris);
        this.drawIris(rightIris);
    }

    drawIris(irisLandmarks) {
        if (irisLandmarks.length < 4) return;

        const center = {
            x: irisLandmarks.reduce((sum, pt) => sum + pt.x, 0) / irisLandmarks.length,
            y: irisLandmarks.reduce((sum, pt) => sum + pt.y, 0) / irisLandmarks.length
        };

        const radius = Math.hypot(
            (irisLandmarks[0].x - irisLandmarks[2].x) * this.canvas.width,
            (irisLandmarks[0].y - irisLandmarks[2].y) * this.canvas.height
        ) / 2;

        this.ctx.beginPath();
        this.ctx.arc(
            center.x * this.canvas.width,
            center.y * this.canvas.height,
            radius,
            0,
            2 * Math.PI
        );
        this.ctx.fillStyle = this.colors.face.iris;
        this.ctx.fill();
    }

    calculateHeadPose(poseLandmarks, faceLandmarks) {
        const nose = faceLandmarks[1];
        const leftEye = faceLandmarks[33];
        const rightEye = faceLandmarks[263];
        
        this.headPose = {
            yaw: (rightEye.x - leftEye.x) * 100,  // Left/Right
            pitch: nose.y * 100 - 50,             // Up/Down
            roll: Math.atan2(rightEye.y - leftEye.y, rightEye.x - leftEye.x) * 180 / Math.PI  // Tilt
        };
    }

    drawHeadAxes() {
        const position = {x: this.canvas.width - 130, y: 140};
        const axisLength = 60;

        this.ctx.save();
        this.ctx.translate(position.x, position.y);

        // Draw background with larger size
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        this.ctx.fillRect(-90, -90, 180, 180);  // Increased size of background

        // Draw axes with labels - increased spacing
        this.ctx.font = '14px Arial';
        const { yaw, pitch, roll } = this.headPose;

        // Yaw (Left/Right) - adjusted positions
        this.ctx.strokeStyle = this.colors.axis.x;
        this.ctx.fillStyle = this.colors.axis.x;
        this.ctx.beginPath();
        this.ctx.moveTo(-axisLength, 0);
        this.ctx.lineTo(axisLength, 0);
        this.ctx.stroke();
        this.ctx.fillText(`Left/Right: ${yaw.toFixed(1)}°`, -80, -60);

        // Pitch (Up/Down) - adjusted positions
        this.ctx.strokeStyle = this.colors.axis.y;
        this.ctx.fillStyle = this.colors.axis.y;
        this.ctx.beginPath();
        this.ctx.moveTo(0, -axisLength);
        this.ctx.lineTo(0, axisLength);
        this.ctx.stroke();
        this.ctx.fillText(`Up/Down: ${pitch.toFixed(1)}°`, -80, -35);

        // Roll (Tilt) - adjusted positions
        this.ctx.strokeStyle = this.colors.axis.z;
        this.ctx.fillStyle = this.colors.axis.z;
        this.ctx.beginPath();
        this.ctx.arc(0, 0, axisLength/2, 0, 2 * Math.PI);
        this.ctx.stroke();
        this.ctx.fillText(`Tilt: ${roll.toFixed(1)}°`, -80, -10);

        this.ctx.restore();
    }

    displayHeadPose() {
        // Position text in top-left corner with more spacing
        const startX = 20;
        const startY = 40;  // Moved up slightly
        const lineSpacing = 30;  // Increased spacing between lines
        
        this.ctx.font = '16px Arial';
        this.ctx.fillStyle = this.colors.text;
        
        // Display angles with better spacing
        this.ctx.fillText(`Yaw: ${this.headPose.yaw.toFixed(1)}°`, startX, startY);
        this.ctx.fillText(`Pitch: ${this.headPose.pitch.toFixed(1)}°`, startX, startY + lineSpacing);
        this.ctx.fillText(`Roll: ${this.headPose.roll.toFixed(1)}°`, startX, startY + lineSpacing * 2);
    }

    calculateDistance(landmarks) {
        const leftFace = landmarks[234];
        const rightFace = landmarks[454];
        
        const faceWidthPixels = Math.hypot(
            (rightFace.x - leftFace.x) * this.canvas.width,
            (rightFace.y - leftFace.y) * this.canvas.height
        );

        // More accurate distance calculation with calibration
        const distance = (this.distanceCalibration.FACE_WIDTH_CM * this.canvas.width) / faceWidthPixels;
        
        // Apply smoothing
        return this.smoothValue(distance, this.lastDistance || distance, 0.3);
    }

    displayDistance(distance) {
        // Position distance text below head pose info
        this.ctx.font = '16px Arial';
        this.ctx.fillStyle = this.colors.text;
        this.ctx.fillText(`Distance: ${distance.toFixed(1)} cm`, 20, 130);  // Moved down for better spacing
    }

    // Add calibration method
    calibrate(actualFaceWidth) {
        this.distanceCalibration.FACE_WIDTH_CM = actualFaceWidth;
        this.distanceCalibration.isCalibrated = true;
        
        // Hide calibration overlay
        document.getElementById('calibrationOverlay').classList.add('hidden');
    }

    // Add smoothing helper
    smoothValue(current, previous, factor) {
        if (!previous) return current;
        if (Math.abs(current - previous) > 50) {
            return previous; // Too big a jump, probably error
        }
        return factor * previous + (1 - factor) * current;
    }

    // Add after drawIris method
    calculateIrisPosition(irisLandmarks, isLeft) {
        if (irisLandmarks.length < 4) return null;

        // Calculate iris center
        const center = {
            x: irisLandmarks.reduce((sum, pt) => sum + pt.x, 0) / irisLandmarks.length,
            y: irisLandmarks.reduce((sum, pt) => sum + pt.y, 0) / irisLandmarks.length
        };

        // Get eye corners for reference
        const eyeCorners = isLeft ? 
            [this.landmarks[263], this.landmarks[362]] :  // Left eye corners
            [this.landmarks[33], this.landmarks[133]];    // Right eye corners

        // Calculate eye center
        const eyeCenter = {
            x: (eyeCorners[0].x + eyeCorners[1].x) / 2,
            y: (eyeCorners[0].y + eyeCorners[1].y) / 2
        };

        // Calculate relative position (compensating for head movement)
        const relativeX = center.x - eyeCenter.x;
        const relativeY = center.y - eyeCenter.y;

        // Calculate angle in degrees
        const angle = Math.atan2(relativeY, relativeX) * (180 / Math.PI);

        // Compensate for head roll
        const compensatedAngle = angle - this.headPose.roll;

        return {
            x: relativeX * this.canvas.width,  // Convert to pixels
            y: relativeY * this.canvas.height,
            angle: compensatedAngle
        };
    }

    // Add new method to display iris tracking
    displayIrisTracking() {
        // Position below distance measurement with more space
        const startX = 20;
        const startY = 180;  // Adjusted position
        const lineSpacing = 30;  // Increased spacing
        const boxPadding = 15;

        // Calculate angles and deltas
        const leftDeltaAngle = (this.irisTracking.left.angle - this.irisTracking.baseline.left.angle).toFixed(1);
        const rightDeltaAngle = (this.irisTracking.right.angle - this.irisTracking.baseline.right.angle).toFixed(1);
        const averageMovement = ((parseFloat(leftDeltaAngle) + parseFloat(rightDeltaAngle)) / 2).toFixed(1);

        // Draw a more visible background box
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';  // Darker background
        this.ctx.fillRect(
            startX - boxPadding, 
            startY - boxPadding, 
            400,  // Wider box
            lineSpacing * 4  // Taller box
        );

        // Set up text style
        this.ctx.font = 'bold 16px Arial';  // Made text bigger and bold
        this.ctx.fillStyle = '#00E676';  // Using the green color for better visibility
        
        // Title
        this.ctx.fillText('Eye Movement Calculations:', startX, startY);
        
        // Switch to white for measurements
        this.ctx.fillStyle = '#FFFFFF';
        this.ctx.font = '14px Arial';

        // Display calculations with formula
        this.ctx.fillText(
            `Left Eye Δ° = ${leftDeltaAngle}° (${this.irisTracking.left.angle.toFixed(1)}° - ${this.irisTracking.baseline.left.angle.toFixed(1)}°)`, 
            startX, 
            startY + lineSpacing
        );

        this.ctx.fillText(
            `Right Eye Δ° = ${rightDeltaAngle}° (${this.irisTracking.right.angle.toFixed(1)}° - ${this.irisTracking.baseline.right.angle.toFixed(1)}°)`, 
            startX, 
            startY + lineSpacing * 2
        );

        // Highlight average movement
        this.ctx.fillStyle = '#00E676';  // Green for emphasis
        this.ctx.fillText(
            `Average Eye Movement: ${averageMovement}°`, 
            startX, 
            startY + lineSpacing * 3
        );
    }
} 