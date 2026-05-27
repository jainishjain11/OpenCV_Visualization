// Grab the video element from our HTML
const videoElement = document.getElementById('webcam-feed');

// ==========================================
// PHASE 2: MediaPipe Hands Setup
// ==========================================

// 1. Initialize the Hands model and point it to the CDN files
const hands = new Hands({locateFile: (file) => {
    return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
}});

// 2. Configure the tracking parameters
hands.setOptions({
    maxNumHands: 2,               // Track up to 2 hands
    modelComplexity: 1,           // Balance between speed and accuracy
    minDetectionConfidence: 0.7,  // How strict the initial detection is
    minTrackingConfidence: 0.7    // How strict the continuous tracking is
});

// 3. The Callback: What happens when a hand is found?
hands.onResults((results) => {
    // Check if the model actually sees any hands in the current frame
    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        
        // For testing: Grab the very first hand detected
        const firstHand = results.multiHandLandmarks[0];
        
        // Landmark [0] is the wrist. Landmark [8] is the index fingertip.
        // Log the X and Y coordinates of the index fingertip to the console
        const indexTipX = firstHand[8].x.toFixed(3);
        const indexTipY = firstHand[8].y.toFixed(3);
        
        console.log(`Index Fingertip -> X: ${indexTipX}, Y: ${indexTipY}`);
    }
});

// ==========================================
// PHASE 1: Webcam Setup (from before)
// ==========================================
async function setupWebcam() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: { width: 1280, height: 720, facingMode: "user" },
            audio: false
        });
        videoElement.srcObject = stream;

        return new Promise((resolve) => {
            videoElement.onloadedmetadata = () => {
                videoElement.play(); // Ensure the video is playing
                resolve(videoElement);
            };
        });
    } catch (error) {
        console.error("Error accessing the webcam: ", error);
    }
}

// ==========================================
// THE PIPELINE: Feeding video to the ML Model
// ==========================================
async function detectionLoop() {
    // Send the current frame of the video to MediaPipe for processing
    await hands.send({image: videoElement});
    
    // Request the next animation frame to keep the loop running continuously
    requestAnimationFrame(detectionLoop);
}

// Initialize everything
async function initApp() {
    console.log("1. Initializing webcam...");
    await setupWebcam();
    console.log("2. Webcam running. Loading Machine Learning model...");
    
    // Start the continuous detection loop
    detectionLoop();
}

// Start the app
initApp();