let faceTracker;

function checkBrowserSupport() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        showStatus('Your browser does not support webcam access');
        return false;
    }
    return true;
}

function showStatus(message) {
    const statusEl = document.getElementById('statusMessage');
    statusEl.textContent = message;
    statusEl.classList.remove('hidden');
    setTimeout(() => statusEl.classList.add('hidden'), 3000);
}

async function requestCameraPermission(video) {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
            video: {
                width: 640,
                height: 480
            } 
        });
        video.srcObject = stream;
        await video.play();
        document.getElementById('permissionOverlay').classList.add('hidden');
        return true;
    } catch (error) {
        console.error('Camera permission error:', error);
        showStatus('Camera access denied. Please allow camera access and refresh the page.');
        return false;
    }
}

async function initialize() {
    try {
        if (!checkBrowserSupport()) return;

        const video = document.querySelector('.input-video');
        const canvas = document.querySelector('.output-canvas');
        
        if (!video || !canvas) {
            throw new Error('Video or canvas element not found');
        }

        // Set up permission button
        const permissionBtn = document.getElementById('requestPermission');
        permissionBtn.addEventListener('click', async () => {
            const permissionGranted = await requestCameraPermission(video);
            if (permissionGranted) {
                faceTracker = new FaceTracker();
                await faceTracker.initialize(video, canvas);

                // Show calibration overlay after camera starts
                document.getElementById('calibrationOverlay').classList.remove('hidden');
                
                // Set up calibration button
                const calibrateBtn = document.getElementById('calibrateBtn');
                calibrateBtn.addEventListener('click', () => {
                    const faceWidth = parseFloat(document.getElementById('faceWidth').value);
                    if (faceWidth >= 10 && faceWidth <= 20) {
                        faceTracker.calibrate(faceWidth);
                        showStatus('Calibration successful!');
                    } else {
                        showStatus('Please enter a valid face width (10-20cm)');
                    }
                });
            }
        });

    } catch (error) {
        console.error('Initialization failed:', error);
        showStatus('Failed to start camera. Please check permissions.');
    }
}

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    if (faceTracker) {
        faceTracker.cleanup();
    }
});

document.addEventListener('DOMContentLoaded', initialize); 
