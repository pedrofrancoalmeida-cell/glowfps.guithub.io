import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';

const menuContainer = document.getElementById('menu-container');
const btnStart = document.getElementById('btn-start');
const hud = document.getElementById('hud');
const hpVal = document.getElementById('hp-val');
const scoreVal = document.getElementById('score-val');
const respawnScreen = document.getElementById('respawn-screen');

// Configurações Globais
let myHp = 100;
let myScore = 0;
let isDead = false;
let gameStarted = false;
const bots = [];

// Cenário Tridimensional
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x050508);
scene.fog = new THREE.FogExp2(0x050508, 0.015);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const controls = new PointerLockControls(camera, document.body);
scene.add(controls.getObject());

// Mecânicas de Movimento do Jogador
const moveState = { forward: false, backward: false, left: false, right: false };
const velocity = new THREE.Vector3();
const direction = new THREE.Vector3();
let isSliding = false;
let slideDirection = new THREE.Vector3();
let slideTimer = 0;
let clock = new THREE.Clock();

// Iluminação
scene.add(new THREE.AmbientLight(0x222233));
const dirLight = new THREE.DirectionalLight(0x5500aa, 0.8);
dirLight.position.set(20, 40, 20);
scene.add(dirLight);

// Chão e Grelha Cyberpunk
const floor = new THREE.Mesh(new THREE.PlaneGeometry(100, 100), new THREE.MeshStandardMaterial({ color: 0x111115, roughness: 0.8 }));
floor.rotation.x = -Math.PI / 2;
scene.add(floor);

const gridHelper = new THREE.GridHelper(100, 50, 0x00f3ff, 0x222233);
gridHelper.position.y = 0.01;
scene.add(gridHelper);

// Obstáculos estáticos
const boxGeo = new THREE.BoxGeometry(6, 8, 6);
const boxMat = new THREE.MeshStandardMaterial({ color: 0x151525, metalness: 0.2, roughness: 0.3 });
const obstaclePositions = [[-20, 4, 10], [0, 4, -25], [25, 4, -15], [-15, 4, -20]];

obstaclePositions.forEach(pos => {
    const box = new THREE.Mesh(boxGeo, boxMat);
    box.position.set(...pos);
    scene.add(box);
    const line = new THREE.LineSegments(new THREE.EdgesGeometry(boxGeo), new THREE.LineBasicMaterial({ color: 0xff0055 }));
    line.position.set(...pos);
    scene.add(line);
});

// Inicialização de Bots Inteligência Artificial Local
function spawnBot() {
    const group = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 2, 16), new THREE.MeshStandardMaterial({ color: 0xff0055, metalness: 0.5 }));
    body.position.y = 1;
    group.add(body);
    
    const eye = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.2, 0.3), new THREE.MeshBasicMaterial({ color: 0x00f3ff }));
    eye.position.set(0, 1.5, -0.5);
    group.add(eye);
    
    group.position.set((Math.random() - 0.5) * 60, 0, (Math.random() - 0.5) * 60);
    scene.add(group);

    bots.push({
        mesh: group,
        hp: 100,
        changeDirTimer: 0,
        moveDir: new THREE.Vector3(),
        shootCooldown: Math.random() * 2
    });
}

// Cria 5 Bots na Arena
for(let i = 0; i < 5; i++) {
    spawnBot();
}

// Iniciar Partida pelo Menu
btnStart.addEventListener('click', () => {
    menuContainer.style.opacity = '0';
    setTimeout(() => menuContainer.style.display = 'none', 500);
    hud.style.display = 'block';
    gameStarted = true;
    controls.lock();
});

// Controles Teclado
document.addEventListener('keydown', (e) => {
    if (isDead || !controls.isLocked) return;
    if (e.code === 'KeyW') moveState.forward = true;
    if (e.code === 'KeyS') moveState.backward = true;
    if (e.code === 'KeyA') moveState.left = true;
    if (e.code === 'KeyD') moveState.right = true;
    
    if (e.code === 'ShiftLeft' && !isSliding) {
        isSliding = true;
        slideTimer = 0.4;
        controls.getObject().position.y = 1.0; // Abaixa visão para o slide
        
        let forwardDir = new THREE.Vector3();
        camera.getWorldDirection(forwardDir);
        forwardDir.y = 0;
        forwardDir.normalize();
        
        let sideDir = new THREE.Vector3(-forwardDir.z, 0, forwardDir.x);
        slideDirection.set(0,0,0);
        
        if (moveState.forward) slideDirection.add(forwardDir);
        if (moveState.backward) slideDirection.sub(forwardDir);
        if (moveState.left) slideDirection.sub(sideDir);
        if (moveState.right) slideDirection.add(sideDir);
        
        if (slideDirection.lengthSq() === 0) slideDirection.copy(forwardDir);
        slideDirection.normalize();
    }
});

document.addEventListener('keyup', (e) => {
    if (e.code === 'KeyW') moveState.forward = false;
    if (e.code === 'KeyS') moveState.backward = false;
    if (e.code === 'KeyA') moveState.left = false;
    if (e.code === 'KeyD') moveState.right = false;
});

document.addEventListener('mousedown', (e) => {
    if (gameStarted && !controls.isLocked) {
        controls.lock();
    } else if (e.button === 0 && !isDead && controls.isLocked) {
        performPlayerShot();
    }
});

// Tiro do Jogador Local
function performPlayerShot() {
    const raycaster = new THREE.Raycaster();
    const center = new THREE.Vector2(0, 0);
    raycaster.setFromCamera(center, camera);

    const botMeshes = bots.map(b => b.mesh.children[0]); // Pega cilindros internos para colisão
    const intersects = raycaster.intersectObjects(botMeshes);
    
    const laserGeo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, -0.2, -0.5).unproject(camera),
        intersects.length > 0 ? intersects[0].point : raycaster.ray.at(50, new THREE.Vector3())
    ]);
    const laserMat = new THREE.LineBasicMaterial({ color: 0x00f3ff });
    const laserLine = new THREE.Line(laserGeo, laserMat);
    scene.add(laserLine);
    setTimeout(() => { scene.remove(laserLine); laserGeo.dispose(); laserMat.dispose(); }, 80);

    if (intersects.length > 0) {
        const hitMesh = intersects[0].object;
        const hitBot = bots.find(b => b.mesh.children[0] === hitMesh);
        if (hitBot) {
            hitBot.hp -= 25;
            if(hitBot.hp <= 0) {
                myScore++;
                scoreVal.innerText = myScore;
                // Respawn do Bot atingido
                hitBot.hp = 100;
                hitBot.mesh.position.set((Math.random() - 0.5) * 60, 0, (Math.random() - 0.5) * 60);
            }
        }
    }
}

// Tiro Realizado pelos Bots Inimigos
function performBotShot(bot) {
    const playerPos = controls.getObject().position.clone();
    
    // Laser Visual do Inimigo Atirando
    const laserGeo = new THREE.BufferGeometry().setFromPoints([
        bot.mesh.position.clone().add(new THREE.Vector3(0, 1.5, 0)),
        playerPos
    ]);
    const laserMat = new THREE.LineBasicMaterial({ color: 0xff0055 });
    const laserLine = new THREE.Line(laserGeo, laserMat);
    scene.add(laserLine);
    setTimeout(() => { scene.remove(laserLine); laserGeo.dispose(); laserMat.dispose(); }, 80);

    // Sistema de Acerto Simples baseado em distância e se jogador não está em slide rápido
    const distance = bot.mesh.position.distanceTo(playerPos);
    if (distance < 25 && !isSliding && !isDead) {
        myHp -= 15;
        hpVal.innerText = myHp;
        
        renderer.setClearColor(0x550000, 1);
        setTimeout(() => renderer.setClearColor(0x050508, 1), 60);

        if (myHp <= 0) {
            isDead = true;
            respawnScreen.style.display = 'flex';
            controls.unlock();
            setTimeout(() => {
                myHp = 100;
                hpVal.innerText = myHp;
                respawnScreen.style.display = 'none';
                controls.getObject().position.set((Math.random() - 0.5) * 40, 2, (Math.random() - 0.5) * 40);
                isDead = false;
                controls.lock();
            }, 3000);
        }
    }
}

// Loop Loop Principal de Mecânicas e Render
function animate() {
    requestAnimationFrame(animate);
    const delta = clock.getDelta();

    if (controls.isLocked && !isDead) {
        const playerObj = controls.getObject();

        // Movimentação em Slide
        if (isSliding) {
            velocity.copy(slideDirection).multiplyScalar(28 * delta);
            playerObj.position.add(velocity);
            slideTimer -= delta;
            if (slideTimer <= 0) {
                isSliding = false;
                playerObj.position.y = 2.0;
            }
        } else {
            // Movimentação Normal FPS
            direction.z = Number(moveState.forward) - Number(moveState.backward);
            direction.x = Number(moveState.right) - Number(moveState.left);
            direction.normalize();

            let camDirection = new THREE.Vector3();
            camera.getWorldDirection(camDirection);
            camDirection.y = 0;
            camDirection.normalize();

            let sideDirection = new THREE.Vector3(-camDirection.z, 0, camDirection.x);
            velocity.set(0, 0, 0);

            if (moveState.forward) velocity.add(camDirection);
            if (moveState.backward) velocity.sub(camDirection);
            if (moveState.left) velocity.sub(sideDirection);
            if (moveState.right) velocity.add(sideDirection);

            velocity.normalize().multiplyScalar(12 * delta);
            playerObj.position.add(velocity);
        }

        playerObj.position.x = Math.max(-48, Math.min(48, playerObj.position.x));
        playerObj.position.z = Math.max(-48, Math.min(48, playerObj.position.z));
    }

    // Processamento da IA dos Bots
    if (gameStarted) {
        const playerPos = controls.getObject().position;

        bots.forEach(bot => {
            bot.changeDirTimer -= delta;
            bot.shootCooldown -= delta;
