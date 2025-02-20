let faceTracker;

async function initialize() {
    const video = document.querySelector('.input-video');
    const canvas = document.querySelector('.output-canvas');
    
    faceTracker = new FaceTracker();
    await faceTracker.initialize(video, canvas);
}

initialize();

document.getElementById('calibrate').addEventListener('click', () => {
    faceTracker.calibrateDistance();
}); 