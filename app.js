// Grab the video element from our HTML
const videoElement = document.getElementById('webcam-feed');

// Function to start the webcam
async function setupWebcam() {
    try {
        // Request access to the user's camera (video only, no audio)
        const stream = await navigator.mediaDevices.getUserMedia({
            video: {
                width: 1280,
                height: 720,
                facingMode: "user" // Prioritizes the front-facing/webcam camera
            },
            audio: false
        });

        // Plug the live stream into our video element
        videoElement.srcObject = stream;

        // Return a promise that resolves when the video is actually playing
        return new Promise((resolve) => {
            videoElement.onloadedmetadata = () => {
                resolve(videoElement);
            };
        });

    } catch (error) {
        console.error("Error accessing the webcam: ", error);
        alert("Please allow camera permissions to use this experience.");
    }
}

// Initialize the app
async function initApp() {
    console.log("Initializing webcam...");
    
    await setupWebcam();
    
    // If you see this in your browser console, Phase 1 is a success!
    console.log("Webcam is running and ready for Phase 2!");
}

// Start the whole process
initApp();