let faceTracker;

async function initialize() {
    try {
        const video = document.querySelector('.input-video');
        const canvas = document.querySelector('.output-canvas');
        
        if (!video || !canvas) {
            throw new Error('Video or canvas element not found');
        }

        faceTracker = new FaceTracker();
        await faceTracker.initialize(video, canvas);
    } catch (error) {
        console.error('Initialization failed:', error);
        alert('Failed to start camera. Please make sure you have granted camera permissions.');
    }
}

initialize(); 