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

        // Simple color scheme
        this.colors = {
            primary: '#00E676',
            text: '#FFFFFF',
            axis: {
                x: '#FF4444',  // Red for left/right
                y: '#44FF44',  // Green for up/down
                z: '#4444FF'   // Blue for forward/back
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
        // Clear canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        if (results.faceLandmarks) {
            // Draw face mesh
            drawConnectors(this.ctx, results.faceLandmarks, FACEMESH_TESSELATION, 
                {color: 'rgba(255,255,255,0.2)', lineWidth: 1});

            if (results.poseLandmarks) {
                this.calculateHeadPose(results.poseLandmarks, results.faceLandmarks);
                this.drawHeadAxes();
                this.displayHeadPose();
            }
        }
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
        const axisLength = 50;

        this.ctx.save();
        this.ctx.translate(position.x, position.y);

        // Draw axes
        ['x', 'y', 'z'].forEach((axis, i) => {
            this.ctx.strokeStyle = this.colors.axis[axis];
            this.ctx.beginPath();
            this.ctx.moveTo(0, 0);
            const angle = this.headPose[['yaw', 'pitch', 'roll'][i]] * Math.PI / 180;
            this.ctx.lineTo(
                Math.cos(angle) * axisLength,
                Math.sin(angle) * axisLength
            );
            this.ctx.stroke();
        });

        this.ctx.restore();
    }

    displayHeadPose() {
        this.ctx.font = '16px Arial';
        this.ctx.fillStyle = this.colors.text;
        this.ctx.fillText(`Yaw: ${this.headPose.yaw.toFixed(1)}°`, 20, 30);
        this.ctx.fillText(`Pitch: ${this.headPose.pitch.toFixed(1)}°`, 20, 50);
        this.ctx.fillText(`Roll: ${this.headPose.roll.toFixed(1)}°`, 20, 70);
    }
} 