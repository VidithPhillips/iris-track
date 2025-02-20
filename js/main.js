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

async function requestCameraPermission() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        document.getElementById('permissionOverlay').classList.add('hidden');
        return stream;
    } catch (error) {
        console.error('Camera permission error:', error);
        showStatus('Camera access denied. Please allow camera access and refresh the page.');
        return null;
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
            const stream = await requestCameraPermission();
            if (stream) {
                // Initialize face tracker after permission granted
                faceTracker = new FaceTracker();
                await faceTracker.initialize(video, canvas);
                
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

// Wait for DOM to load
document.addEventListener('DOMContentLoaded', initialize); 
