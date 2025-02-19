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
} 