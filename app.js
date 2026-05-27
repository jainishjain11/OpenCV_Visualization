const videoElement = document.getElementById('webcam-feed');
const container = document.getElementById('canvas-container');

// Global array to bridge Machine Learning and Physics
let interactionPoints = [];

// ==========================================
// 1. THREE.JS & POST-PROCESSING SETUP
// ==========================================
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.z = 30;

const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ReinhardToneMapping; // Better exposure for glow
container.appendChild(renderer.domElement);

// Setup Bloom (Glow Effect)
const renderScene = new THREE.RenderPass(scene, camera);
const bloomPass = new THREE.UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    1.5, // Strength
    0.4, // Radius
    0.85 // Threshold
);
const composer = new THREE.EffectComposer(renderer);
composer.addPass(renderScene);
composer.addPass(bloomPass);

// ==========================================
// 2. PARTICLE SYSTEM SETUP
// ==========================================
const particleCount = 3000;
const geometry = new THREE.BufferGeometry();

const positions = new Float32Array(particleCount * 3);
const originalPositions = new Float32Array(particleCount * 3);
const velocities = new Float32Array(particleCount * 3);
const colors = new Float32Array(particleCount * 3);

const radius = 10;
const baseColor = new THREE.Color(0x00ffff); // Cyan

for (let i = 0; i < particleCount; i++) {
    const theta = Math.random() * 2 * Math.PI;
    const phi = Math.acos(Math.random() * 2 - 1);
    
    const x = radius * Math.sin(phi) * Math.cos(theta);
    const y = radius * Math.sin(phi) * Math.sin(theta);
    const z = radius * Math.cos(phi);
    
    positions[i * 3] = x; positions[i * 3 + 1] = y; positions[i * 3 + 2] = z;
    originalPositions[i * 3] = x; originalPositions[i * 3 + 1] = y; originalPositions[i * 3 + 2] = z;
    velocities[i * 3] = 0; velocities[i * 3 + 1] = 0; velocities[i * 3 + 2] = 0;
    
    colors[i * 3] = baseColor.r; colors[i * 3 + 1] = baseColor.g; colors[i * 3 + 2] = baseColor.b;
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

// Handle resizing
window.addEventListener('resize', () => {
    renderer.setSize(window.innerWidth, window.innerHeight);
    composer.setSize(window.innerWidth, window.innerHeight);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
});

// ==========================================
// 3. PHYSICS & RENDER LOOP
// ==========================================
const SPRING_FACTOR = 0.05;
const DAMPING = 0.85;
const REPEL_STRENGTH = 0.8; // Slightly stronger push
const INTERACTION_RADIUS = 10;

const tempColor = new THREE.Color();

function animate3D() {
    requestAnimationFrame(animate3D);
    
    particleSystem.rotation.y += 0.002;
    particleSystem.rotation.x += 0.001;

    const positionsAttribute = geometry.attributes.position;
    const colorsAttribute = geometry.attributes.color;
    
    const currentPositions = positionsAttribute.array;
    const currentColors = colorsAttribute.array;

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

        // Dynamic Color calculation
        const speed = Math.abs(velocities[idx3]) + Math.abs(velocities[idx3+1]) + Math.abs(velocities[idx3+2]);
        const hue = 0.5 + (speed * 0.15); // Shift from cyan towards purple/red based on speed
        tempColor.setHSL(hue, 1.0, 0.6);

        currentColors[idx3] = tempColor.r;
        currentColors[idx3 + 1] = tempColor.g;
        currentColors[idx3 + 2] = tempColor.b;
    }

    positionsAttribute.needsUpdate = true;
    colorsAttribute.needsUpdate = true;
    
    composer.render(); // Render using Bloom pass
}

// ==========================================
// 4. MACHINE LEARNING (MediaPipe)
// ==========================================
function mapTo3DSpace(normalizedX, normalizedY) {
    const mappedX = (normalizedX - 0.5) * 40 * -1; 
    const mappedY = -(normalizedY - 0.5) * 30;     
    return { x: mappedX, y: mappedY, z: 10 };      
}

const hands = new Hands({locateFile: (file) => {
    return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
}});

hands.setOptions({
    maxNumHands: 2,
    modelComplexity: 1,
    minDetectionConfidence: 0.7,
    minTrackingConfidence: 0.7
});

hands.onResults((results) => {
    interactionPoints = []; 
    if (results.multiHandLandmarks) {
        for (const landmarks of results.multiHandLandmarks) {
            const indexTip = landmarks[8];
            const palm = landmarks[0];
            interactionPoints.push(mapTo3DSpace(indexTip.x, indexTip.y));
            interactionPoints.push(mapTo3DSpace(palm.x, palm.y));
        }
    }
});

// ==========================================
// 5. WEBCAM & INITIALIZATION
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
                videoElement.play();
                resolve(videoElement);
            };
        });
    } catch (error) {
        console.error("Error accessing webcam:", error);
    }
}

async function detectionLoop() {
    await hands.send({image: videoElement});
    requestAnimationFrame(detectionLoop);
}

async function initApp() {
    await setupWebcam();
    detectionLoop();
    animate3D(); 
}

initApp();