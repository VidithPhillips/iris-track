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
            refineFaceLandmarks: true,
            minDetectionConfidence: 0.5,
            minTrackingConfidence: 0.5,
            selfieMode: true
        });

        // Tracking parameters
        this.previousLandmarks = null;
        this.smoothingFactor = 0.7;
        this.backgroundAlpha = 0.3;

        // Head pose parameters
        this.headPose = {
            pitch: 0,
            yaw: 0,
            roll: 0
        };

        // Color scheme
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
                x: '#FF4444',  // Red for left/right
                y: '#44FF44',  // Green for up/down
                z: '#4444FF'   // Blue for forward/back
            }
        };

        // Add iris tracking parameters
        this.irisParams = {
            radius: 5,
            color: '#FFD700',
            pupilColor: '#000000',
            pupilRadius: 2
        };

        // Add body tracking parameters
        this.bodyParams = {
            joints: {
                color: '#00E676',
                radius: 4
            },
            connections: {
                color: 'rgba(0, 230, 118, 0.5)',
                width: 2
            }
        };

        // Define body connections for better visualization
        this.bodyConnections = [
            // Torso
            [11, 12], // shoulders
            [11, 23], [12, 24], // shoulders to hips
            [23, 24], // hips
            // Arms
            [11, 13], [13, 15], // left arm
            [12, 14], [14, 16], // right arm
            // Legs
            [23, 25], [25, 27], // left leg
            [24, 26], [26, 28]  // right leg
        ];
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
        // Clear canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.fillStyle = `rgba(0, 0, 0, ${this.backgroundAlpha})`;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        if (results.faceLandmarks) {
            // Draw face mesh
            this.drawFaceOutline(results.faceLandmarks);
            drawConnectors(this.ctx, results.faceLandmarks, FACEMESH_TESSELATION, 
                {color: this.colors.face.mesh, lineWidth: 1});
            
            // Draw eyes
            this.drawEnhancedEyes(results.faceLandmarks);

            if (results.poseLandmarks) {
                this.calculateHeadPose(results.poseLandmarks, results.faceLandmarks);
                this.drawDetailedBody(results.poseLandmarks);  // Add detailed body tracking
                this.drawHeadAxes();
                this.displayHeadPose();
            }
        }
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
        // Draw eye contours
        drawConnectors(this.ctx, landmarks, FACEMESH_RIGHT_EYE, 
            {color: this.colors.face.eyes, lineWidth: 2});
        drawConnectors(this.ctx, landmarks, FACEMESH_LEFT_EYE,
            {color: this.colors.face.eyes, lineWidth: 2});

        // Draw iris and pupils
        // Right eye iris (landmarks 473-477)
        this.drawIris(landmarks.slice(473, 477));
        // Left eye iris (landmarks 468-472)
        this.drawIris(landmarks.slice(468, 472));
    }

    drawIris(irisLandmarks) {
        if (irisLandmarks.length < 4) return;

        // Calculate iris center
        const centerX = irisLandmarks.reduce((sum, pt) => sum + pt.x, 0) / irisLandmarks.length;
        const centerY = irisLandmarks.reduce((sum, pt) => sum + pt.y, 0) / irisLandmarks.length;

        // Calculate iris size
        const distance = Math.hypot(
            (irisLandmarks[0].x - irisLandmarks[2].x) * this.canvas.width,
            (irisLandmarks[0].y - irisLandmarks[2].y) * this.canvas.height
        );

        // Draw iris
        this.ctx.beginPath();
        this.ctx.arc(
            centerX * this.canvas.width,
            centerY * this.canvas.height,
            distance/2,
            0,
            2 * Math.PI
        );
        this.ctx.strokeStyle = this.irisParams.color;
        this.ctx.lineWidth = 2;
        this.ctx.stroke();

        // Draw pupil
        this.ctx.beginPath();
        this.ctx.arc(
            centerX * this.canvas.width,
            centerY * this.canvas.height,
            distance/4,
            0,
            2 * Math.PI
        );
        this.ctx.fillStyle = this.irisParams.pupilColor;
        this.ctx.fill();
    }

    calculateHeadPose(poseLandmarks, faceLandmarks) {
        // Basic head pose calculation
        const nose = faceLandmarks[1];
        const leftEye = faceLandmarks[33];
        const rightEye = faceLandmarks[263];
        
        this.headPose = {
            yaw: (rightEye.x - leftEye.x) * 100,  // Simple left/right
            pitch: nose.y * 100 - 50,             // Simple up/down
            roll: Math.atan2(rightEye.y - leftEye.y, rightEye.x - leftEye.x) * 180 / Math.PI
        };
    }

    drawHeadAxes() {
        const position = {x: this.canvas.width - 150, y: 120};
        const axisLength = 60;

        this.ctx.save();
        this.ctx.translate(position.x, position.y);

        // Draw background for the visualization
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        this.ctx.fillRect(-80, -80, 160, 160);
        
        // Draw axis labels
        this.ctx.font = '14px Arial';
        
        // Draw head direction visualization
        const { yaw, pitch, roll } = this.headPose;
        
        // Draw horizontal axis (Yaw - left/right)
        this.ctx.strokeStyle = this.colors.axis.x;
        this.ctx.fillStyle = this.colors.axis.x;
        this.ctx.beginPath();
        this.ctx.moveTo(-axisLength, 0);
        this.ctx.lineTo(axisLength, 0);
        this.ctx.stroke();
        this.ctx.fillText(`Left/Right: ${yaw.toFixed(1)}°`, -70, -50);
        
        // Draw indicator for current yaw
        this.ctx.beginPath();
        this.ctx.arc(yaw * axisLength/90, 0, 4, 0, 2 * Math.PI);
        this.ctx.fill();

        // Draw vertical axis (Pitch - up/down)
        this.ctx.strokeStyle = this.colors.axis.y;
        this.ctx.fillStyle = this.colors.axis.y;
        this.ctx.beginPath();
        this.ctx.moveTo(0, -axisLength);
        this.ctx.lineTo(0, axisLength);
        this.ctx.stroke();
        this.ctx.fillText(`Up/Down: ${pitch.toFixed(1)}°`, -70, -30);
        
        // Draw indicator for current pitch
        this.ctx.beginPath();
        this.ctx.arc(0, pitch * axisLength/90, 4, 0, 2 * Math.PI);
        this.ctx.fill();

        // Draw roll indicator (circular)
        this.ctx.strokeStyle = this.colors.axis.z;
        this.ctx.fillStyle = this.colors.axis.z;
        this.ctx.beginPath();
        this.ctx.arc(0, 0, axisLength/2, 0, 2 * Math.PI);
        this.ctx.stroke();

        this.ctx.restore();
    }

    displayHeadPose() {
        this.ctx.font = '16px Arial';
        this.ctx.fillStyle = this.colors.text;
        this.ctx.fillText(`Yaw: ${this.headPose.yaw.toFixed(1)}°`, 20, 30);
        this.ctx.fillText(`Pitch: ${this.headPose.pitch.toFixed(1)}°`, 20, 50);
        this.ctx.fillText(`Roll: ${this.headPose.roll.toFixed(1)}°`, 20, 70);
    }

    drawDetailedBody(poseLandmarks) {
        if (!poseLandmarks) return;

        // Draw all body landmarks
        poseLandmarks.forEach((landmark, index) => {
            // Draw joint point
            this.ctx.beginPath();
            this.ctx.arc(
                landmark.x * this.canvas.width,
                landmark.y * this.canvas.height,
                this.bodyParams.joints.radius,
                0,
                2 * Math.PI
            );
            this.ctx.fillStyle = this.bodyParams.joints.color;
            this.ctx.fill();

            // Add landmark number for debugging
            this.ctx.fillStyle = '#FFFFFF';
            this.ctx.font = '10px Arial';
            this.ctx.fillText(
                index.toString(),
                landmark.x * this.canvas.width + 5,
                landmark.y * this.canvas.height + 5
            );
        });

        // Draw connections between joints
        this.bodyConnections.forEach(([start, end]) => {
            const startPoint = poseLandmarks[start];
            const endPoint = poseLandmarks[end];

            this.ctx.beginPath();
            this.ctx.moveTo(
                startPoint.x * this.canvas.width,
                startPoint.y * this.canvas.height
            );
            this.ctx.lineTo(
                endPoint.x * this.canvas.width,
                endPoint.y * this.canvas.height
            );
            this.ctx.strokeStyle = this.bodyParams.connections.color;
            this.ctx.lineWidth = this.bodyParams.connections.width;
            this.ctx.stroke();
        });
    }
} 