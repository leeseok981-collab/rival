import * as THREE from 'three';

export interface ProceduralTextureSet {
  floorColor: THREE.CanvasTexture;
  floorBump: THREE.CanvasTexture;
  containerColor: THREE.CanvasTexture;
  containerBump: THREE.CanvasTexture;
  crateColor: THREE.CanvasTexture;
  crateBump: THREE.CanvasTexture;
  contactShadow: THREE.CanvasTexture;
}

let cachedTextures: ProceduralTextureSet | null = null;

export function getProceduralTextures(maxAnisotropy = 4): ProceduralTextureSet {
  if (cachedTextures) return cachedTextures;

  // 1. Tactical Roblox Stud & Court Grid Floor Texture
  const floorCanvas = document.createElement('canvas');
  floorCanvas.width = 512;
  floorCanvas.height = 512;
  const fCtx = floorCanvas.getContext('2d')!;
  fCtx.fillStyle = '#334155';
  fCtx.fillRect(0, 0, 512, 512);

  // Subtle tile checker
  fCtx.fillStyle = '#38475e';
  fCtx.fillRect(0, 0, 256, 256);
  fCtx.fillRect(256, 256, 256, 256);

  // Tile border seams
  fCtx.strokeStyle = '#1e293b';
  fCtx.lineWidth = 4;
  fCtx.strokeRect(2, 2, 252, 252);
  fCtx.strokeRect(258, 2, 252, 252);
  fCtx.strokeRect(2, 258, 252, 252);
  fCtx.strokeRect(258, 258, 252, 252);

  // Iconic Roblox subtle stud grid + micro grit
  const floorBumpCanvas = document.createElement('canvas');
  floorBumpCanvas.width = 512;
  floorBumpCanvas.height = 512;
  const fbCtx = floorBumpCanvas.getContext('2d')!;
  fbCtx.fillStyle = '#808080';
  fbCtx.fillRect(0, 0, 512, 512);

  for (let y = 32; y < 512; y += 64) {
    for (let x = 32; x < 512; x += 64) {
      // Albedo stud ring
      fCtx.beginPath();
      fCtx.arc(x, y, 14, 0, Math.PI * 2);
      fCtx.fillStyle = 'rgba(255,255,255,0.04)';
      fCtx.fill();
      fCtx.strokeStyle = 'rgba(15,23,42,0.22)';
      fCtx.lineWidth = 2;
      fCtx.stroke();

      // Bump map stud elevation
      fbCtx.beginPath();
      fbCtx.arc(x, y, 14, 0, Math.PI * 2);
      fbCtx.fillStyle = '#b8b8b8';
      fbCtx.fill();
    }
  }

  const floorColor = new THREE.CanvasTexture(floorCanvas);
  floorColor.colorSpace = THREE.SRGBColorSpace;
  floorColor.wrapS = THREE.RepeatWrapping;
  floorColor.wrapT = THREE.RepeatWrapping;
  floorColor.repeat.set(18, 18);
  floorColor.anisotropy = maxAnisotropy;

  const floorBump = new THREE.CanvasTexture(floorBumpCanvas);
  floorBump.colorSpace = THREE.NoColorSpace;
  floorBump.wrapS = THREE.RepeatWrapping;
  floorBump.wrapT = THREE.RepeatWrapping;
  floorBump.repeat.set(18, 18);
  floorBump.anisotropy = maxAnisotropy;

  // 2. Corrugated Shipping Container Texture
  const contCanvas = document.createElement('canvas');
  contCanvas.width = 256;
  contCanvas.height = 256;
  const cCtx = contCanvas.getContext('2d')!;
  cCtx.fillStyle = '#e2e8f0';
  cCtx.fillRect(0, 0, 256, 256);

  const contBumpCanvas = document.createElement('canvas');
  contBumpCanvas.width = 256;
  contBumpCanvas.height = 256;
  const cbCtx = contBumpCanvas.getContext('2d')!;
  cbCtx.fillStyle = '#808080';
  cbCtx.fillRect(0, 0, 256, 256);

  for (let x = 0; x < 256; x += 16) {
    cCtx.fillStyle = x % 32 === 0 ? '#cbd5e1' : '#f8fafc';
    cCtx.fillRect(x, 0, 8, 256);
    cbCtx.fillStyle = x % 32 === 0 ? '#505050' : '#c0c0c0';
    cbCtx.fillRect(x, 0, 8, 256);
  }
  // Frame trim top and bottom
  cCtx.fillStyle = '#94a3b8';
  cCtx.fillRect(0, 0, 256, 18);
  cCtx.fillRect(0, 238, 256, 18);

  const containerColor = new THREE.CanvasTexture(contCanvas);
  containerColor.colorSpace = THREE.SRGBColorSpace;
  containerColor.wrapS = THREE.RepeatWrapping;
  containerColor.wrapT = THREE.RepeatWrapping;
  containerColor.anisotropy = maxAnisotropy;

  const containerBump = new THREE.CanvasTexture(contBumpCanvas);
  containerBump.colorSpace = THREE.NoColorSpace;
  containerBump.wrapS = THREE.RepeatWrapping;
  containerBump.wrapT = THREE.RepeatWrapping;
  containerBump.anisotropy = maxAnisotropy;

  // 3. Tactical Supply Crate Texture
  const crateCanvas = document.createElement('canvas');
  crateCanvas.width = 256;
  crateCanvas.height = 256;
  const crCtx = crateCanvas.getContext('2d')!;
  crCtx.fillStyle = '#d97706';
  crCtx.fillRect(0, 0, 256, 256);
  crCtx.fillStyle = '#f59e0b';
  crCtx.fillRect(18, 18, 220, 220);
  crCtx.strokeStyle = '#78350f';
  crCtx.lineWidth = 10;
  crCtx.strokeRect(12, 12, 232, 232);
  // Diagonal brace
  crCtx.beginPath();
  crCtx.moveTo(16, 16);
  crCtx.lineTo(240, 240);
  crCtx.moveTo(240, 16);
  crCtx.lineTo(16, 240);
  crCtx.stroke();

  const crateBumpCanvas = document.createElement('canvas');
  crateBumpCanvas.width = 256;
  crateBumpCanvas.height = 256;
  const crbCtx = crateBumpCanvas.getContext('2d')!;
  crbCtx.fillStyle = '#707070';
  crbCtx.fillRect(0, 0, 256, 256);
  crbCtx.strokeStyle = '#ffffff';
  crbCtx.lineWidth = 12;
  crbCtx.strokeRect(12, 12, 232, 232);

  const crateColor = new THREE.CanvasTexture(crateCanvas);
  crateColor.colorSpace = THREE.SRGBColorSpace;
  crateColor.anisotropy = maxAnisotropy;

  const crateBump = new THREE.CanvasTexture(crateBumpCanvas);
  crateBump.colorSpace = THREE.NoColorSpace;
  crateBump.anisotropy = maxAnisotropy;

  // 4. Radial Contact Shadow Disc Texture
  const shadowCanvas = document.createElement('canvas');
  shadowCanvas.width = 128;
  shadowCanvas.height = 128;
  const sCtx = shadowCanvas.getContext('2d')!;
  const grad = sCtx.createRadialGradient(64, 64, 8, 64, 64, 60);
  grad.addColorStop(0, 'rgba(0, 0, 0, 0.72)');
  grad.addColorStop(0.55, 'rgba(0, 0, 0, 0.32)');
  grad.addColorStop(1, 'rgba(0, 0, 0, 0.0)');
  sCtx.fillStyle = grad;
  sCtx.fillRect(0, 0, 128, 128);

  const contactShadow = new THREE.CanvasTexture(shadowCanvas);
  contactShadow.colorSpace = THREE.SRGBColorSpace;

  cachedTextures = {
    floorColor,
    floorBump,
    containerColor,
    containerBump,
    crateColor,
    crateBump,
    contactShadow,
  };
  return cachedTextures;
}
