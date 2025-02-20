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
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.fillStyle = `rgba(0, 0, 0, ${this.backgroundAlpha})`;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        if (results.faceLandmarks) {
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
        const position = {x: this.canvas.width - 150, y: 120};
        const axisLength = 60;

        this.ctx.save();
        this.ctx.translate(position.x, position.y);

        // Draw background
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        this.ctx.fillRect(-80, -80, 160, 160);

        // Draw axes with labels
        this.ctx.font = '14px Arial';
        const { yaw, pitch, roll } = this.headPose;

        // Yaw (Left/Right)
        this.ctx.strokeStyle = this.colors.axis.x;
        this.ctx.fillStyle = this.colors.axis.x;
        this.ctx.beginPath();
        this.ctx.moveTo(-axisLength, 0);
        this.ctx.lineTo(axisLength, 0);
        this.ctx.stroke();
        this.ctx.fillText(`Left/Right: ${yaw.toFixed(1)}°`, -70, -50);

        // Pitch (Up/Down)
        this.ctx.strokeStyle = this.colors.axis.y;
        this.ctx.fillStyle = this.colors.axis.y;
        this.ctx.beginPath();
        this.ctx.moveTo(0, -axisLength);
        this.ctx.lineTo(0, axisLength);
        this.ctx.stroke();
        this.ctx.fillText(`Up/Down: ${pitch.toFixed(1)}°`, -70, -30);

        // Roll (Tilt)
        this.ctx.strokeStyle = this.colors.axis.z;
        this.ctx.fillStyle = this.colors.axis.z;
        this.ctx.beginPath();
        this.ctx.arc(0, 0, axisLength/2, 0, 2 * Math.PI);
        this.ctx.stroke();
        this.ctx.fillText(`Tilt: ${roll.toFixed(1)}°`, -70, -10);

        this.ctx.restore();
    }
} 