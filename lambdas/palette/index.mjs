import { S3Client, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { GetObjectCommand as S3Get } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import Jimp from "jimp";

const s3 = new S3Client({ region: process.env.AWS_REGION });

const BUCKET = process.env.BUCKET;
const OUTPUT_PREFIX = process.env.OUTPUT_PREFIX || "palettes/";
const K = Number(process.env.PALETTE_SIZE || 5);
const SIGNED_URL_TTL_SECONDS = Number(process.env.SIGNED_URL_TTL_SECONDS || 900);
const SAMPLE_SIZE = 180;

function ok(body) {
  return {
    statusCode: 200,
    headers: {
      "content-type": "application/json",
      "access-control-allow-origin": "*",
      "access-control-allow-headers": "*",
      "access-control-allow-methods": "OPTIONS,POST",
    },
    body: JSON.stringify(body),
  };
}
function bad(status, msg) {
  return {
    statusCode: status,
    headers: {
      "content-type": "application/json",
      "access-control-allow-origin": "*",
      "access-control-allow-headers": "*",
      "access-control-allow-methods": "OPTIONS,POST",
    },
    body: JSON.stringify({ error: msg }),
  };
}
async function streamToBuffer(stream) {
  const chunks = [];
  for await (const c of stream) chunks.push(c);
  return Buffer.concat(chunks);
}

// ---------- K-Means ----------
function kmeansPalette(pixels, k = 5, maxIter = 12) {
  const step = 4;
  const N = Math.floor(pixels.length / step);
  if (N === 0) return [];
  const centroids = [];
  const seen = new Set();
  while (centroids.length < k && seen.size < N) {
    const idx = Math.floor(Math.random() * N);
    if (seen.has(idx)) continue;
    seen.add(idx);
    const off = idx * step;
    const a = pixels[off + 3];
    if (a < 10) continue;
    centroids.push([pixels[off], pixels[off + 1], pixels[off + 2]]);
  }
  if (centroids.length === 0) centroids.push([255, 255, 255]); // fallback white
  while (centroids.length < k) centroids.push([...centroids[centroids.length - 1]]);

  const labels = new Uint16Array(N);

  for (let iter = 0; iter < maxIter; iter++) {
    for (let i = 0; i < N; i++) {
      const off = i * step;
      const a = pixels[off + 3];
      if (a < 10) {
        labels[i] = 65535;
        continue;
      }
      const r = pixels[off], g = pixels[off + 1], b = pixels[off + 2];
      let best = 0, bestD = Infinity;
      for (let c = 0; c < centroids.length; c++) {
        const [cr, cg, cb] = centroids[c];
        const dr = r - cr, dg = g - cg, db = b - cb;
        const d = dr * dr + dg * dg + db * db;
        if (d < bestD) { bestD = d; best = c; }
      }
      labels[i] = best;
    }

    const sums = Array.from({ length: k }, () => [0, 0, 0, 0]);
    for (let i = 0; i < N; i++) {
      const c = labels[i];
      if (c === 65535) continue;
      const off = i * step;
      sums[c][0] += pixels[off];
      sums[c][1] += pixels[off + 1];
      sums[c][2] += pixels[off + 2];
      sums[c][3]++;
    }

    let moved = false;
    for (let c = 0; c < k; c++) {
      if (sums[c][3] > 0) {
        const nr = Math.round(sums[c][0] / sums[c][3]);
        const ng = Math.round(sums[c][1] / sums[c][3]);
        const nb = Math.round(sums[c][2] / sums[c][3]);
        if (nr !== centroids[c][0] || ng !== centroids[c][1] || nb !== centroids[c][2]) {
          centroids[c] = [nr, ng, nb];
          moved = true;
        }
      }
    }
    if (!moved) break;
  }

  const counts = centroids.map(() => 0);
  for (let i = 0; i < N; i++) {
    const c = labels[i];
    if (c !== 65535) counts[c]++;
  }
  const order = centroids.map((_, i) => i).sort((a, b) => counts[b] - counts[a]);

  const palette = order.map((i) => {
    const [r, g, b] = centroids[i];
    return (
      "#" +
      [r, g, b]
        .map((v) => v.toString(16).padStart(2, "0"))
        .join("")
        .toUpperCase()
    );
  });

  // Safety: never return empty
  return palette.length ? palette : ["#FFFFFF"];
}

// ---------- Build PNG without setPixelColor (raw RGBA buffer) ----------
async function buildPalettePng(hexes, width = 1000, height = 200) {
  const colors = (hexes.length ? hexes : ["#FFFFFF"]).map((h) => {
    const hex = (h || "#FFFFFF").replace("#", "");
    const r = parseInt(hex.slice(0, 2) || "FF", 16);
    const g = parseInt(hex.slice(2, 4) || "FF", 16);
    const b = parseInt(hex.slice(4, 6) || "FF", 16);
    return [r, g, b, 255];
  });

  const n = colors.length;
  const bandW = Math.max(1, Math.floor(width / n));
  const data = Buffer.alloc(width * height * 4);

  for (let i = 0; i < n; i++) {
    const [r, g, b, a] = colors[i];
    const xStart = i * bandW;
    const xEnd = (i === n - 1) ? width : Math.min(width, xStart + bandW);

    for (let y = 0; y < height; y++) {
      for (let x = xStart; x < xEnd; x++) {
        const idx = (y * width + x) * 4;
        data[idx + 0] = r;
        data[idx + 1] = g;
        data[idx + 2] = b;
        data[idx + 3] = a;
      }
    }
  }

  const img = await new Jimp({ data, width, height });
  return img.getBufferAsync(Jimp.MIME_PNG);
}

// ---------- Handler ----------
export const handler = async (event) => {
  if (event?.httpMethod === "OPTIONS") return ok({ ok: true });

  let key;
  try { key = JSON.parse(event?.body || "{}").key; }
  catch { return bad(400, "Invalid JSON"); }

  if (!key || !key.startsWith("uploads/")) return bad(400, "Provide { key: 'uploads/<file>' }");
  if (!BUCKET) return bad(500, "Server misconfig: BUCKET env not set");

  try {
    // 1) download
    const obj = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }));
    const buf = await streamToBuffer(obj.Body);
    if (!buf || buf.length === 0) throw new Error(`Empty file: s3://${BUCKET}/${key}`);

    // 2) decode & resize (safe)
    let image;
    try {
      image = await Jimp.read(buf);
    } catch (e) {
      throw new Error(`Failed to decode image ${key}: ${e.message}`);
    }
    if (!image || !image.bitmap || !image.bitmap.data)
      throw new Error(`Decoded image is null/invalid: ${key}`);

    image.contain(SAMPLE_SIZE, SAMPLE_SIZE); // keep aspect ratio within sample box

    // 3) palette
    const { data } = image.bitmap;
    const colors = kmeansPalette(data, K);

    // 4) write outputs
    const baseName = key.split("/").pop().replace(/\.[^.]+$/, "");
    const jsonKey = `${OUTPUT_PREFIX}${baseName}.json`;
    const pngKey  = `${OUTPUT_PREFIX}${baseName}-palette.png`;

    await s3.send(new PutObjectCommand({
      Bucket: BUCKET, Key: jsonKey, ContentType: "application/json",
      Body: JSON.stringify({ key, colors }, null, 2),
    }));

    const png = await buildPalettePng(colors);
    await s3.send(new PutObjectCommand({
      Bucket: BUCKET, Key: pngKey, ContentType: "image/png", Body: png,
    }));

    const previewUrl = await getSignedUrl(
      s3,
      new S3Get({ Bucket: BUCKET, Key: pngKey }),
      { expiresIn: SIGNED_URL_TTL_SECONDS }
    );

    return ok({ colors, previewUrl, jsonKey, pngKey });
  } catch (e) {
    console.error(e);
    return bad(500, `Palette extraction failed: ${e?.message || "unknown"}`);
  }
};
