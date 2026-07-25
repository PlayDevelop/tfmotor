const fs = require("fs");
const path = require("path");
const QRCode = require("qrcode");
const sharp = require("sharp");
const jsQR = require("jsqr");
const { PNG } = require("pngjs");

const destinationUrl = "https://mariaochjohan.tfmotor.se/";
const outputDirectory = path.resolve(__dirname, "../qr");
const colors = {
  sage: "#9caf88",
  sageDark: "#43553d",
  sageSoft: "#dce5d5",
  paper: "#fafbf7",
  white: "#ffffff",
  ink: "#253022",
  muted: "#687562",
};

const qr = QRCode.create(destinationUrl, {
  errorCorrectionLevel: "H",
});

function number(value) {
  return Number(value.toFixed(3));
}

function isFinderCell(row, column, count) {
  const inTop = row < 7;
  const inBottom = row >= count - 7;
  const inLeft = column < 7;
  const inRight = column >= count - 7;
  return (inTop && inLeft) || (inTop && inRight) || (inBottom && inLeft);
}

function renderFinder(x, y, cell) {
  return `
    <rect x="${number(x)}" y="${number(y)}" width="${number(cell * 7)}" height="${number(cell * 7)}" rx="${number(cell * 1.15)}" fill="${colors.sageDark}" />
    <rect x="${number(x + cell)}" y="${number(y + cell)}" width="${number(cell * 5)}" height="${number(cell * 5)}" rx="${number(cell * 0.72)}" fill="${colors.white}" />
    <rect x="${number(x + cell * 2)}" y="${number(y + cell * 2)}" width="${number(cell * 3)}" height="${number(cell * 3)}" rx="${number(cell * 0.58)}" fill="${colors.sageDark}" />`;
}

function renderQr(x, y, size, withLogo = true) {
  const count = qr.modules.size;
  const quietZone = 4;
  const totalCount = count + quietZone * 2;
  const cell = size / totalCount;
  const contentX = x + quietZone * cell;
  const contentY = y + quietZone * cell;
  const moduleRadius = cell * 0.18;
  const pieces = [
    `<rect x="${number(x)}" y="${number(y)}" width="${number(size)}" height="${number(size)}" rx="${number(cell * 1.1)}" fill="${colors.white}" />`,
  ];

  for (let row = 0; row < count; row += 1) {
    for (let column = 0; column < count; column += 1) {
      if (!qr.modules.get(row, column) || isFinderCell(row, column, count)) {
        continue;
      }
      pieces.push(
        `<rect x="${number(contentX + column * cell)}" y="${number(contentY + row * cell)}" width="${number(cell)}" height="${number(cell)}" rx="${number(moduleRadius)}" fill="${colors.sageDark}" />`,
      );
    }
  }

  pieces.push(renderFinder(contentX, contentY, cell));
  pieces.push(renderFinder(contentX + (count - 7) * cell, contentY, cell));
  pieces.push(renderFinder(contentX, contentY + (count - 7) * cell, cell));

  if (withLogo) {
    const centerX = x + size / 2;
    const centerY = y + size / 2;
    const logoRadius = cell * 4.05;
    pieces.push(`
      <circle cx="${number(centerX)}" cy="${number(centerY)}" r="${number(logoRadius)}" fill="${colors.white}" stroke="${colors.sage}" stroke-width="${number(cell * 0.34)}" />
      <text x="${number(centerX)}" y="${number(centerY + cell * 0.72)}" text-anchor="middle" fill="${colors.sageDark}" font-family="Georgia, 'Times New Roman', serif" font-size="${number(cell * 2.2)}" font-weight="700">M&amp;J</text>`);
  }

  return pieces.join("");
}

function renderSprig(x, y, scale, rotation) {
  const leaves = [
    [12, 20, -34],
    [-12, 34, 36],
    [14, 50, -32],
    [-13, 66, 34],
    [12, 82, -30],
  ];
  return `
    <g transform="translate(${x} ${y}) rotate(${rotation}) scale(${scale})" opacity="0.78">
      <path d="M0 100 C2 72 1 42 0 0" fill="none" stroke="${colors.sage}" stroke-width="3.2" stroke-linecap="round" />
      ${leaves
        .map(
          ([leafX, leafY, leafRotation]) =>
            `<ellipse cx="${leafX}" cy="${leafY}" rx="8" ry="17" transform="rotate(${leafRotation} ${leafX} ${leafY})" fill="${colors.sageSoft}" stroke="${colors.sage}" stroke-width="1.4" />`,
        )
        .join("")}
      <circle cx="0" cy="0" r="4.5" fill="${colors.sage}" />
    </g>`;
}

function createSquareSvg() {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1200" viewBox="0 0 1200 1200" role="img" aria-labelledby="title description">
  <title id="title">QR-kod till Maria och Johans bröllopsbilder</title>
  <desc id="description">Skanna koden för att öppna ${destinationUrl}</desc>
  <rect width="1200" height="1200" fill="${colors.paper}" />
  ${renderQr(70, 70, 1060)}
</svg>`;
}

function createCardSvg() {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1600" viewBox="0 0 1200 1600" role="img" aria-labelledby="title description">
  <title id="title">Dela dina bilder med Maria och Johan</title>
  <desc id="description">Bröllopsskylt med QR-kod till ${destinationUrl}</desc>
  <rect width="1200" height="1600" fill="${colors.paper}" />
  <rect x="34" y="34" width="1132" height="1532" rx="32" fill="none" stroke="${colors.sageSoft}" stroke-width="4" />
  ${renderSprig(86, 60, 1.05, -24)}
  ${renderSprig(1114, 1540, 1.05, 156)}

  <text x="600" y="164" text-anchor="middle" fill="${colors.sageDark}" font-family="Georgia, 'Times New Roman', serif" font-size="76" font-weight="700">Maria &amp; Johan</text>
  <text x="600" y="220" text-anchor="middle" fill="${colors.muted}" font-family="Arial, Helvetica, sans-serif" font-size="25" letter-spacing="5">BRÖLLOPSBILDER</text>

  <rect x="126" y="272" width="948" height="948" rx="24" fill="${colors.white}" stroke="${colors.sageSoft}" stroke-width="3" />
  ${renderQr(166, 312, 868)}

  <text x="600" y="1325" text-anchor="middle" fill="${colors.ink}" font-family="Georgia, 'Times New Roman', serif" font-size="57" font-weight="700">Dela dina bilder</text>
  <text x="600" y="1385" text-anchor="middle" fill="${colors.muted}" font-family="Arial, Helvetica, sans-serif" font-size="28">Skanna med mobilkameran och ladda upp</text>
  <text x="600" y="1440" text-anchor="middle" fill="${colors.sageDark}" font-family="Arial, Helvetica, sans-serif" font-size="23" letter-spacing="1.2">mariaochjohan.tfmotor.se</text>
</svg>`;
}

async function decodePng(buffer) {
  const image = PNG.sync.read(buffer);
  const code = jsQR(new Uint8ClampedArray(image.data), image.width, image.height, {
    inversionAttempts: "attemptBoth",
  });
  return code ? code.data : "";
}

async function renderAndVerify(svg, outputName, width, height) {
  const svgPath = path.join(outputDirectory, `${outputName}.svg`);
  const pngPath = path.join(outputDirectory, `${outputName}.png`);
  fs.writeFileSync(svgPath, svg);

  const pngBuffer = await sharp(Buffer.from(svg))
    .resize(width, height, { fit: "fill" })
    .png({ compressionLevel: 9 })
    .toBuffer();
  fs.writeFileSync(pngPath, pngBuffer);

  const decoded = await decodePng(pngBuffer);
  if (decoded !== destinationUrl) {
    throw new Error(`${outputName} kunde inte avkodas. Fick: ${decoded || "inget resultat"}`);
  }

  const compactBuffer = await sharp(pngBuffer)
    .resize(Math.round(width / 4), Math.round(height / 4), { fit: "fill" })
    .png()
    .toBuffer();
  const compactDecoded = await decodePng(compactBuffer);
  if (compactDecoded !== destinationUrl) {
    throw new Error(`${outputName} klarade inte kontrollen i mindre storlek.`);
  }

  return {
    svgPath,
    pngPath,
    decoded,
    compactSize: `${Math.round(width / 4)}x${Math.round(height / 4)}`,
  };
}

async function main() {
  fs.mkdirSync(outputDirectory, { recursive: true });
  const results = [];
  results.push(await renderAndVerify(createSquareSvg(), "maria-johan-qr", 2400, 2400));
  results.push(await renderAndVerify(createCardSvg(), "maria-johan-qr-skylt", 2400, 3200));

  for (const result of results) {
    console.log(`${path.basename(result.pngPath)}: ${result.decoded} (${result.compactSize} verifierad)`);
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
