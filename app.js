const videoElement = document.getElementById('webcam-feed');
const container = document.getElementById('canvas-container');
const loadingScreen = document.getElementById('loading-screen');
const camToggleBtn = document.getElementById('cam-toggle-btn');

// ==========================================
// 1. UI TOGGLE LOGIC
// ==========================================
let isCameraVisible = true;

camToggleBtn.addEventListener('click', () => {
    isCameraVisible = !isCameraVisible;
    if (isCameraVisible) {
        videoElement.classList.remove('hidden-feed');
        camToggleBtn.innerText = "Hide Camera";
    } else {
        videoElement.classList.add('hidden-feed');
        camToggleBtn.innerText = "Show Camera";
    }
});

let interactionPoints = [];
let targetScale = 1.0;
let currentScale = 1.0;

// ==========================================
// 2. THREE.JS & POST-PROCESSING (TRANSPARENT)
// ==========================================
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.z = 30;

const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x000000, 0); // Transparent background
renderer.toneMapping = THREE.ReinhardToneMapping; 
container.appendChild(renderer.domElement);

const renderTarget = new THREE.WebGLRenderTarget(window.innerWidth, window.innerHeight, {
    format: THREE.RGBAFormat,
});

const renderScene = new THREE.RenderPass(scene, camera);
renderScene.clearColor = new THREE.Color(0, 0, 0);
renderScene.clearAlpha = 0; 

const bloomPass = new THREE.UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    1.5, // Bloom Strength
    0.4, // Bloom Radius
    0.85 // Bloom Threshold
);

const composer = new THREE.EffectComposer(renderer, renderTarget);
composer.addPass(renderScene);
composer.addPass(bloomPass);

// ==========================================
// 3. PARTICLE SYSTEM (RED SETUP)
// ==========================================
const particleCount = 4000;
const geometry = new THREE.BufferGeometry();
const positions = new Float32Array(particleCount * 3);
const originalPositions = new Float32Array(particleCount * 3);
const velocities = new Float32Array(particleCount * 3);
const colors = new Float32Array(particleCount * 3);
const radius = 10;

for (let i = 0; i < particleCount; i++) {
    const theta = Math.random() * 2 * Math.PI;
    const phi = Math.acos(Math.random() * 2 - 1);
    
    const x = radius * Math.sin(phi) * Math.cos(theta);
    const y = radius * Math.sin(phi) * Math.sin(theta);
    const z = radius * Math.cos(phi);
    
    positions[i * 3] = x; positions[i * 3 + 1] = y; positions[i * 3 + 2] = z;
    originalPositions[i * 3] = x; originalPositions[i * 3 + 1] = y; originalPositions[i * 3 + 2] = z;
    velocities[i * 3] = 0; velocities[i * 3 + 1] = 0; velocities[i * 3 + 2] = 0;
    
    // RED BASE COLOR
    colors[i * 3] = 1.0; colors[i * 3 + 1] = 0.0; colors[i * 3 + 2] = 0.0;
}

geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

const material = new THREE.PointsMaterial({ 
    size: 0.2, 
    vertexColors: true, 
    blending: THREE.AdditiveBlending, 
    transparent: true,
    depthWrite: false
});

const particleSystem = new THREE.Points(geometry, material);
scene.add(particleSystem);

window.addEventListener('resize', () => {
    renderer.setSize(window.innerWidth, window.innerHeight);
    composer.setSize(window.innerWidth, window.innerHeight);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
});

// ==========================================
// 4. PHYSICS ENGINE
// ==========================================
const SPRING_FACTOR = 0.05;
const DAMPING = 0.85;
const REPEL_STRENGTH = 0.8;
const INTERACTION_RADIUS = 10;
const tempColor = new THREE.Color();
const coreHex = new THREE.Color(0xff0000); // RED CORE COLOR

function animate3D() {
    requestAnimationFrame(animate3D);
    
    // Apply Scale Interpolation
    currentScale += (targetScale - currentScale) * 0.1;
    particleSystem.scale.set(currentScale, currentScale, currentScale);

    particleSystem.rotation.y += 0.002;
    particleSystem.rotation.x += 0.001;

    const currentPositions = geometry.attributes.position.array;
    const currentColors = geometry.attributes.color.array;

    for (let i = 0; i < particleCount; i++) {
        const idx3 = i * 3;
        
        let forceX = (originalPositions[idx3] - currentPositions[idx3]) * SPRING_FACTOR;
        let forceY = (originalPositions[idx3 + 1] - currentPositions[idx3 + 1]) * SPRING_FACTOR;
        let forceZ = (originalPositions[idx3 + 2] - currentPositions[idx3 + 2]) * SPRING_FACTOR;

        const particleWorldPos = new THREE.Vector3(
            currentPositions[idx3], currentPositions[idx3 + 1], currentPositions[idx3 + 2]
        ).applyMatrix4(particleSystem.matrixWorld);

        for (let pt of interactionPoints) {
            const dx = particleWorldPos.x - pt.x;
            const dy = particleWorldPos.y - pt.y;
            const dz = particleWorldPos.z - pt.z;
            const distance = Math.sqrt(dx*dx + dy*dy + dz*dz);

            if (distance < INTERACTION_RADIUS && distance > 0) {
                const pushFactor = (INTERACTION_RADIUS - distance) / INTERACTION_RADIUS;
                forceX += (dx / distance) * pushFactor * REPEL_STRENGTH;
                forceY += (dy / distance) * pushFactor * REPEL_STRENGTH;
                forceZ += (dz / distance) * pushFactor * REPEL_STRENGTH;
            }
        }

        velocities[idx3] = (velocities[idx3] + forceX) * DAMPING;
        velocities[idx3 + 1] = (velocities[idx3 + 1] + forceY) * DAMPING;
        velocities[idx3 + 2] = (velocities[idx3 + 2] + forceZ) * DAMPING;

        currentPositions[idx3] += velocities[idx3];
        currentPositions[idx3 + 1] += velocities[idx3 + 1];
        currentPositions[idx3 + 2] += velocities[idx3 + 2];

        // Shift color to bright white/orange when particles move fast
        const speed = Math.abs(velocities[idx3]) + Math.abs(velocities[idx3+1]) + Math.abs(velocities[idx3+2]);
        tempColor.copy(coreHex);
        
        if(speed > 0.5) {
             tempColor.lerp(new THREE.Color(0xffffff), Math.min(speed * 0.2, 1.0));
        }

        currentColors[idx3] = tempColor.r;
        currentColors[idx3 + 1] = tempColor.g;
        currentColors[idx3 + 2] = tempColor.b;
    }

    geometry.attributes.position.needsUpdate = true;
    geometry.attributes.color.needsUpdate = true;
    composer.render(); 
}

// ==========================================
// 5. MACHINE LEARNING & SCALING LOGIC
// ==========================================
function mapTo3DSpace(normalizedX, normalizedY) {
    const mappedX = (normalizedX - 0.5) * 40 * -1; 
    const mappedY = -(normalizedY - 0.5) * 30;     
    return { x: mappedX, y: mappedY, z: 10 };      
}

const hands = new Hands({locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`});
hands.setOptions({
    maxNumHands: 2,
    modelComplexity: 1,
    minDetectionConfidence: 0.7,
    minTrackingConfidence: 0.7
});

hands.onResults((results) => {
    interactionPoints = []; 
    
    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        if (results.multiHandLandmarks.length === 2) {
            const p1 = results.multiHandLandmarks[0][8];
            const p2 = results.multiHandLandmarks[1][8];
            const distance = Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
            targetScale = distance * 4.0; 
        } else if (results.multiHandLandmarks.length === 1) {
            const p1 = results.multiHandLandmarks[0][4]; 
            const p2 = results.multiHandLandmarks[0][8]; 
            const distance = Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
            targetScale = distance * 6.0; 
        }

        targetScale = Math.max(0.3, Math.min(targetScale, 3.5));

        for (const landmarks of results.multiHandLandmarks) {
            interactionPoints.push(mapTo3DSpace(landmarks[8].x, landmarks[8].y)); 
            interactionPoints.push(mapTo3DSpace(landmarks[0].x, landmarks[0].y)); 
        }
    } else {
        targetScale = 1.0; 
    }
});

// ==========================================
// 6. INITIALIZATION (FORCED AUTO-PLAY FIX)
// ==========================================
async function setupWebcam() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: { width: 1280, height: 720, facingMode: "user" }, 
            audio: false 
        });
        videoElement.srcObject = stream;
        return new Promise(resolve => {
            videoElement.onloadedmetadata = async () => {
                try {
                    await videoElement.play(); // Force play to bypass browser blocks
                    resolve();
                } catch (e) {
                    console.error("Autoplay prevented:", e);
                    alert("Click anywhere to start the camera.");
                }
            };
        });
    } catch (error) {
        console.error("Camera error:", error);
    }
}

async function detectionLoop() {
    await hands.send({image: videoElement});
    requestAnimationFrame(detectionLoop);
}

async function initApp() {
    await setupWebcam();
    await hands.send({image: videoElement}); 
    loadingScreen.classList.add('hidden'); // Fade out loader
    detectionLoop();
    animate3D(); 
}

initApp();