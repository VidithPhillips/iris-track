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
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        if (results.multiFaceLandmarks) {
            for (const landmarks of results.multiFaceLandmarks) {
                // Draw face mesh
                drawConnectors(this.ctx, landmarks, FACEMESH_TESSELATION, 
                    {color: '#C0C0C070', lineWidth: 1});
                
                // Draw eyes
                drawConnectors(this.ctx, landmarks, FACEMESH_RIGHT_EYE, 
                    {color: '#FF3030'});
                drawConnectors(this.ctx, landmarks, FACEMESH_LEFT_EYE,
                    {color: '#30FF30'});

                // Draw iris
                const leftIris = landmarks.slice(468, 472);
                const rightIris = landmarks.slice(473, 477);
                
                this.drawIris(leftIris, '#30FF30');
                this.drawIris(rightIris, '#FF3030');

                // Calculate and display distance
                const distance = this.calculateDistance(landmarks);
                this.displayDistance(distance);
            }
        }
    }

    drawIris(irisLandmarks, color) {
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