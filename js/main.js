let faceTracker;

async function initialize() {
    try {
        const video = document.querySelector('.input-video');
        const canvas = document.querySelector('.output-canvas');
        
        if (!video || !canvas) {
            throw new Error('Video or canvas element not found');
        }

        // Request camera permission first
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        video.srcObject = stream;

        faceTracker = new FaceTracker();
        await faceTracker.initialize(video, canvas);
    } catch (error) {
        console.error('Initialization failed:', error);
        alert('Failed to start camera. Please make sure you have granted camera permissions.');
    }
}

// Wait for DOM to load
document.addEventListener('DOMContentLoaded', initialize); 