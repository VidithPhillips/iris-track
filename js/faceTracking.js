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

// Add hand mesh connections
const HAND_CONNECTIONS = [
    [0, 1], [1, 2], [2, 3], [3, 4], // thumb
    [0, 5], [5, 6], [6, 7], [7, 8], // index
    [0, 9], [9, 10], [10, 11], [11, 12], // middle
    [0, 13], [13, 14], [14, 15], [15, 16], // ring
    [0, 17], [17, 18], [18, 19], [19, 20] // pinky
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

        // Core tracking parameters
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

        // Enhanced tracking parameters
        this.tracking = {
            face: {
                mesh: true,
                iris: true,
                expressions: true
            },
            body: {
                pose: true,
                hands: true
            }
        };

        // Enhanced visualization parameters
        this.visualization = {
            face: {
                meshOpacity: 0.5,
                contourWidth: 2,
                irisDetail: true
            },
            body: {
                jointRadius: 4,
                lineWidth: 2,
                showLabels: true
            },
            hands: {
                meshOpacity: 0.6,
                jointRadius: 3,
                lineWidth: 1.5
            }
        };

        // Extended body connections for more detail
        this.bodyConnections = [
            // Torso
            [11, 12], [12, 24], [24, 23], [23, 11], // chest
            [11, 13], [13, 15], [15, 17], [17, 19], // left arm
            [12, 14], [14, 16], [16, 18], [18, 20], // right arm
            [23, 25], [25, 27], [27, 29], [29, 31], // left leg
            [24, 26], [26, 28], [28, 30], [30, 32], // right leg
            // Face connections
            [0, 1], [1, 2], [2, 3], [3, 7], // face outline
            [0, 4], [4, 5], [5, 6], [6, 8]  // face detail
        ];
    }

    async processFrame(video) {
        // Convert video frame to base64
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0);
        const base64Frame = canvas.toDataURL('image/jpeg').split(',')[1];

        try {
            // Send to GPU server
            const response = await fetch(this.gpuEndpoint + '/process', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    image: base64Frame
                })
            });

            const results = await response.json();
            this.onResults(results);
        } catch (error) {
            console.error('GPU processing error:', error);
        }
    }

    handleServerResponse(event) {
        const results = JSON.parse(event.data);
        
        // Average results for smoothing
        const smoothedResults = this.smoothFrames(results);
        this.onResults(smoothedResults);
    }

    smoothFrames(frames) {
        // Average landmark positions across frames
        // ... smoothing logic ...
    }

    async initialize(videoElement, canvasElement) {
        this.video = videoElement;
        this.canvas = canvasElement;
        this.ctx = canvasElement.getContext('2d');

        // Replace Holistic with our GPU processing
        this.camera = new Camera(this.video, {
            onFrame: async () => {
                await this.processFrame(this.video);
            },
            width: 640,
            height: 480
        });

        await this.camera.start();
    }

    onResults(results) {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.fillStyle = `rgba(0, 0, 0, ${this.backgroundAlpha})`;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        if (results.faceLandmarks) {
            // Draw basic face features
            this.drawFaceOutline(results.faceLandmarks);
            this.drawEnhancedEyes(results.faceLandmarks);

            if (results.poseLandmarks) {
                this.calculateHeadPose(results.poseLandmarks, results.faceLandmarks);
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

        const center = {
            x: irisLandmarks.reduce((sum, pt) => sum + pt.x, 0) / irisLandmarks.length,
            y: irisLandmarks.reduce((sum, pt) => sum + pt.y, 0) / irisLandmarks.length
        };

        const radius = Math.hypot(
            (irisLandmarks[0].x - irisLandmarks[2].x) * this.canvas.width,
            (irisLandmarks[0].y - irisLandmarks[2].y) * this.canvas.height
        ) / 2;

        // Draw iris with gradient
        const gradient = this.ctx.createRadialGradient(
            center.x * this.canvas.width, center.y * this.canvas.height, 0,
            center.x * this.canvas.width, center.y * this.canvas.height, radius
        );
        gradient.addColorStop(0, 'rgba(255, 215, 0, 0.8)');
        gradient.addColorStop(1, 'rgba(255, 215, 0, 0.2)');

        this.ctx.beginPath();
        this.ctx.arc(
            center.x * this.canvas.width,
            center.y * this.canvas.height,
            radius,
            0,
            2 * Math.PI
        );
        this.ctx.fillStyle = gradient;
        this.ctx.fill();

        // Draw pupil with shadow
        this.ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
        this.ctx.shadowBlur = 4;
        this.ctx.beginPath();
        this.ctx.arc(
            center.x * this.canvas.width,
            center.y * this.canvas.height,
            radius * 0.4,
            0,
            2 * Math.PI
        );
        this.ctx.fillStyle = '#000000';
        this.ctx.fill();
        this.ctx.shadowBlur = 0;
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

    drawEnhancedFace(landmarks) {
        // Draw face mesh with depth shading
        this.ctx.strokeStyle = this.colors.face.mesh;
        landmarks.forEach((point, i) => {
            const depth = point.z;
            const opacity = Math.max(0.1, Math.min(0.9, 1 - Math.abs(depth)));
            this.ctx.fillStyle = `rgba(255, 255, 255, ${opacity})`;
            
            this.ctx.beginPath();
            this.ctx.arc(
                point.x * this.canvas.width,
                point.y * this.canvas.height,
                1,
                0,
                2 * Math.PI
            );
            this.ctx.fill();
        });
    }

    drawHands(leftHand, rightHand) {
        const drawHand = (landmarks, isLeft) => {
            if (!landmarks) return;

            // Draw connections
            this.ctx.strokeStyle = isLeft ? 
                'rgba(0, 230, 118, 0.5)' : 
                'rgba(255, 215, 0, 0.5)';
            this.ctx.lineWidth = this.visualization.hands.lineWidth;

            HAND_CONNECTIONS.forEach(([i, j]) => {
                this.ctx.beginPath();
                this.ctx.moveTo(
                    landmarks[i].x * this.canvas.width,
                    landmarks[i].y * this.canvas.height
                );
                this.ctx.lineTo(
                    landmarks[j].x * this.canvas.width,
                    landmarks[j].y * this.canvas.height
                );
                this.ctx.stroke();
            });

            // Draw joints
            landmarks.forEach((landmark, index) => {
                this.ctx.beginPath();
                this.ctx.arc(
                    landmark.x * this.canvas.width,
                    landmark.y * this.canvas.height,
                    this.visualization.hands.jointRadius,
                    0,
                    2 * Math.PI
                );
                this.ctx.fillStyle = isLeft ? '#00E676' : '#FFD700';
                this.ctx.fill();
            });
        };

        drawHand(leftHand, true);
        drawHand(rightHand, false);
    }
} 