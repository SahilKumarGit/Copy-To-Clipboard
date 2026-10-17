const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

// App squircle SVG (1024x1024)
const SVG_ICON = `
<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <defs>
    <!-- Background Gradient -->
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#3b82f6"/>
      <stop offset="50%" stop-color="#2563eb"/>
      <stop offset="100%" stop-color="#1d4ed8"/>
    </linearGradient>

    <!-- Board Gradient -->
    <linearGradient id="boardGrad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#334155"/>
      <stop offset="100%" stop-color="#1e293b"/>
    </linearGradient>

    <!-- Clip Chrome Gradient -->
    <linearGradient id="clipGrad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#f8fafc"/>
      <stop offset="35%" stop-color="#e2e8f0"/>
      <stop offset="70%" stop-color="#cbd5e1"/>
      <stop offset="100%" stop-color="#94a3b8"/>
    </linearGradient>

    <!-- Paper Shadow -->
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="18" stdDeviation="24" flood-color="#000000" flood-opacity="0.38"/>
    </filter>

    <!-- Clip Shadow -->
    <filter id="clipShadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="10" stdDeviation="12" flood-color="#000000" flood-opacity="0.25"/>
    </filter>
  </defs>

  <!-- Base App Squircle / Rounded Icon -->
  <rect x="32" y="32" width="960" height="960" rx="224" fill="url(#bgGrad)"/>
  
  <!-- Subtle Top Highlight Border -->
  <rect x="34" y="34" width="956" height="956" rx="222" fill="none" stroke="#ffffff" stroke-width="4" stroke-opacity="0.25"/>

  <!-- Clipboard Main Board -->
  <g filter="url(#shadow)">
    <rect x="232" y="170" width="560" height="710" rx="44" fill="url(#boardGrad)"/>
    <rect x="232" y="170" width="560" height="710" rx="44" fill="none" stroke="#ffffff" stroke-width="2" stroke-opacity="0.12"/>
  </g>

  <!-- Paper Sheet -->
  <g filter="url(#shadow)">
    <rect x="272" y="240" width="480" height="590" rx="24" fill="#ffffff"/>
  </g>

  <!-- Content Lines on Paper (Clipboard History Items) -->
  <!-- Item 1: Active Blue Snippet -->
  <rect x="322" y="360" width="38" height="38" rx="10" fill="#3b82f6"/>
  <rect x="380" y="366" width="310" height="14" rx="7" fill="#1e293b"/>
  <rect x="380" y="388" width="180" height="10" rx="5" fill="#64748b"/>

  <!-- Divider -->
  <line x1="322" y1="428" x2="702" y2="428" stroke="#f1f5f9" stroke-width="3"/>

  <!-- Item 2: Code / Text Snippet -->
  <rect x="322" y="452" width="38" height="38" rx="10" fill="#10b981"/>
  <rect x="380" y="458" width="280" height="14" rx="7" fill="#1e293b"/>
  <rect x="380" y="480" width="210" height="10" rx="5" fill="#64748b"/>

  <!-- Divider -->
  <line x1="322" y1="520" x2="702" y2="520" stroke="#f1f5f9" stroke-width="3"/>

  <!-- Item 3: Link Snippet -->
  <rect x="322" y="544" width="38" height="38" rx="10" fill="#f59e0b"/>
  <rect x="380" y="550" width="250" height="14" rx="7" fill="#1e293b"/>
  <rect x="380" y="572" width="160" height="10" rx="5" fill="#64748b"/>

  <!-- Divider -->
  <line x1="322" y1="612" x2="702" y2="612" stroke="#f1f5f9" stroke-width="3"/>

  <!-- Item 4: Image Snippet -->
  <rect x="322" y="636" width="38" height="38" rx="10" fill="#8b5cf6"/>
  <rect x="380" y="642" width="290" height="14" rx="7" fill="#1e293b"/>
  <rect x="380" y="664" width="190" height="10" rx="5" fill="#64748b"/>

  <!-- Metallic Clip Assembly at Top -->
  <g filter="url(#clipShadow)">
    <!-- Clip Loop -->
    <path d="M 432 180 C 432 120, 592 120, 592 180" fill="none" stroke="url(#clipGrad)" stroke-width="26" stroke-linecap="round"/>
    
    <!-- Clip Base Plate -->
    <rect x="372" y="160" width="280" height="96" rx="24" fill="url(#clipGrad)"/>
    
    <!-- Clip Inset Shadow & Groove -->
    <rect x="412" y="184" width="200" height="24" rx="12" fill="#475569" opacity="0.45"/>
    <circle cx="512" cy="196" r="6" fill="#1e293b"/>
  </g>
</svg>
`;

app.whenReady().then(async () => {
  const buildDir = path.join(__dirname, '../build');
  if (!fs.existsSync(buildDir)) {
    fs.mkdirSync(buildDir, { recursive: true });
  }

  // Save raw master SVG
  const svgPath = path.join(buildDir, 'icon.svg');
  fs.writeFileSync(svgPath, SVG_ICON.trim(), 'utf8');
  console.log('✓ Saved master SVG icon to:', svgPath);

  // Render to 1024x1024 PNG using hidden Electron window
  const win = new BrowserWindow({
    width: 1024,
    height: 1024,
    show: false,
    frame: false,
    transparent: true,
    webPreferences: {
      offscreen: true
    }
  });

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          * { margin: 0; padding: 0; }
          body { background: transparent; overflow: hidden; width: 1024px; height: 1024px; }
          svg { width: 1024px; height: 1024px; display: block; }
        </style>
      </head>
      <body>${SVG_ICON}</body>
    </html>
  `;

  await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
  await new Promise(r => setTimeout(r, 400));

  const image = await win.capturePage({ x: 0, y: 0, width: 1024, height: 1024 });
  const png1024Path = path.join(buildDir, 'icon.png');
  fs.writeFileSync(png1024Path, image.toPNG());
  console.log('✓ Rendered 1024x1024 PNG master icon to:', png1024Path);

  // Copy to UI assets as well
  const uiIconPath = path.join(__dirname, '../ui/icon.png');
  fs.copyFileSync(png1024Path, uiIconPath);

  // If on macOS, build icon.icns via iconutil
  if (process.platform === 'darwin') {
    const iconsetDir = path.join(buildDir, 'icon.iconset');
    if (fs.existsSync(iconsetDir)) fs.rmSync(iconsetDir, { recursive: true, force: true });
    fs.mkdirSync(iconsetDir, { recursive: true });

    const sizes = [
      { name: 'icon_16x16.png', size: 16 },
      { name: 'icon_16x16@2x.png', size: 32 },
      { name: 'icon_32x32.png', size: 32 },
      { name: 'icon_32x32@2x.png', size: 64 },
      { name: 'icon_128x128.png', size: 128 },
      { name: 'icon_128x128@2x.png', size: 256 },
      { name: 'icon_256x256.png', size: 256 },
      { name: 'icon_256x256@2x.png', size: 512 },
      { name: 'icon_512x512.png', size: 512 },
      { name: 'icon_512x512@2x.png', size: 1024 }
    ];

    for (const { name, size } of sizes) {
      const target = path.join(iconsetDir, name);
      execSync(`sips -z ${size} ${size} "${png1024Path}" --out "${target}" >/dev/null 2>&1`);
    }

    const icnsPath = path.join(buildDir, 'icon.icns');
    execSync(`iconutil -c icns "${iconsetDir}" -o "${icnsPath}"`);
    fs.rmSync(iconsetDir, { recursive: true, force: true });
    console.log('✓ Generated native macOS icon.icns at:', icnsPath);
  }

  app.quit();
});
