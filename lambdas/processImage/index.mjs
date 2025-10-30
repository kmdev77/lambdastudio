// index.mjs — Lambda Node 18 (ESM). Uses global fetch/FormData/Blob from undici.

/* ---------------- CORS ---------------- */
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "OPTIONS,POST",
};

/* ---------------- Env (normalized) ---------------- */
const BUCKET_NAME   = (process.env.BUCKET_NAME || "").trim().replace(/^['"]|['"]$/g, "");
const OUTPUT_PREFIX = ((process.env.OUTPUT_PREFIX || "thumbs/").trim()).replace(/^\/+|\/+$/g, "") + "/";
const HF_TOKEN      = (process.env.HF_TOKEN || "").trim().replace(/^['"]|['"]$/g, "");
const FAL_TASK_URL  = (process.env.FAL_TASK_URL || "https://router.huggingface.co/fal-ai/fal-ai/bria/background/remove?_subdomain=queue").trim();
const MAX_PX        = Number(process.env.MAX_PX || 4096);
const SIGNED_URL_TTL_SECONDS = Number(process.env.SIGNED_URL_TTL_SECONDS || 3600);

/* ---------------- Small helpers ---------------- */
const ok = (code, body) => ({
  statusCode: code,
  headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  body: JSON.stringify(body),
});
const clamp = (n) => Math.max(1, Math.min(MAX_PX, Math.round(Number(n) || 0)));

async function s3GetBuffer(s3, bucket, key, GetObjectCommand) {
  const obj = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  const chunks = [];
  for await (const c of obj.Body) chunks.push(c);
  return Buffer.concat(chunks);
}

/* ---------------- fal-ai background removal ---------------- */
async function removeBgFal(buffer, tokenParam) {
  const tok = (tokenParam ?? process.env.HF_TOKEN ?? "").trim().replace(/^['"]|['"]$/g, "");
  if (!tok) throw new Error("HF token missing (set HF_TOKEN).");

  const form = new FormData();
  form.append("image", new Blob([buffer], { type: "image/png" }), "input.png");

  const start = await fetch(FAL_TASK_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${tok}` },
    body: form,
  });

  let firstJson = null;
  try { firstJson = await start.json(); } catch {}

  if (!start.ok && start.status !== 202) {
    const snippet = firstJson ? JSON.stringify(firstJson).slice(0, 400) : "";
    if (start.status === 401) throw new Error(`HF 401: invalid/expired token. ${snippet}`);
    if (start.status === 403) throw new Error(`HF 403: token lacks "Make calls to Inference Providers". ${snippet}`);
    if (start.status === 404) throw new Error(`fal route not found at ${FAL_TASK_URL}. ${snippet}`);
    throw new Error(`fal start failed: ${start.status} ${snippet}`);
  }

  const immediate = await normalizeFalOutputToBuffer(firstJson || {}, tok);
  if (immediate) return immediate;

  const responseUrl =
    firstJson?.response_url ||
    firstJson?.result_url ||
    firstJson?.url ||
    firstJson?.results_url;

  if (!responseUrl) throw new Error("fal queue did not provide response_url.");

  const deadlineMs = 60000;
  const begin = Date.now();
  let delayMs = 500;
  let triedNoAuth = false;

  for (;;) {
    let r = await fetch(responseUrl, { headers: triedNoAuth ? undefined : { Authorization: `Bearer ${tok}` } });
    if (r.status === 401 && !triedNoAuth) {
      triedNoAuth = true;
      r = await fetch(responseUrl); // pre-signed URL
    }

    if (!r.ok) {
      let t = "";
      try { t = await r.text(); } catch {}
      throw new Error(`fal poll failed: ${r.status} ${t?.slice(0, 200) || ""}`);
    }

    const ctype = r.headers.get("content-type") || "";
    if (ctype.startsWith("image/")) {
      const ab = await r.arrayBuffer();
      return Buffer.from(ab);
    }

    let data = null;
    try { data = await r.json(); } catch {
      throw new Error("fal poll returned non-JSON without image content-type.");
    }

    const status = String(data?.status || data?.state || data?.phase || "").toLowerCase();

    if (status.includes("succeeded") || status.includes("completed") || status === "success" || !status) {
      const buf = await normalizeFalOutputToBuffer(data, tok);
      if (!buf) throw new Error("fal completed but no image url/base64 found.");
      return buf;
    }

    if (status.includes("queue") || status.includes("processing") || status.includes("running") || status.includes("in_progress") || status.includes("loading")) {
      if (Date.now() - begin > deadlineMs) throw new Error("fal processing timed out. Try again.");
      await new Promise(res => setTimeout(res, delayMs));
      delayMs = Math.min(Math.floor(delayMs * 1.7), 2500);
      continue;
    }

    throw new Error(`fal job failed with status "${status || "unknown"}".`);
  }
}

async function normalizeFalOutputToBuffer(data, token) {
  if (!data) return null;

  const urlLike =
    data?.image?.url ||
    data?.output?.url ||
    data?.result?.url ||
    data?.images?.[0]?.url ||
    data?.output?.[0]?.content?.url ||
    data?.outputs?.[0]?.url;
  if (urlLike) {
    const headers = token ? { Authorization: `Bearer ${token}` } : undefined;
    const r = await fetch(urlLike, { headers });
    if (!r.ok) throw new Error(`fetch output URL failed: ${r.status}`);
    const ab = await r.arrayBuffer();
    return Buffer.from(ab);
  }

  const b64 =
    data?.image?.b64_json ||
    data?.b64image ||
    data?.images?.[0]?.b64_json ||
    data?.output?.[0]?.content?.b64_json ||
    data?.outputs?.[0]?.b64_json;
  if (b64) return Buffer.from(b64, "base64");

  const possible = data?.image || data?.output || data?.result;
  if (typeof possible === "string") {
    const m = possible.match(/^data:.+;base64,(.+)$/);
    if (m?.[1]) return Buffer.from(m[1], "base64");
  }

  return null;
}

/* ---------------- Lambda handler ---------------- */
export const handler = async (event) => {
  try {
    const method = event?.requestContext?.http?.method || event?.httpMethod || "POST";
    if (method === "OPTIONS") return { statusCode: 204, headers: CORS_HEADERS };

    // Parse body
    let raw = event?.body || "{}";
    if (event?.isBase64Encoded) raw = Buffer.from(raw, "base64").toString("utf8");
    const body = JSON.parse(raw || "{}");

    // NOTE: withoutEnlargement now **defaults to false** (allow upscaling)
    const {
      key,
      w,
      h,
      fit = "contain",
      removeBg = false,
      withoutEnlargement = false
    } = body || {};

    // Validate/clamp
    const width  = clamp(w);
    const height = clamp(h);
    if (!BUCKET_NAME || !key || !width || !height) {
      return ok(400, { error: "Missing required fields: key, w, h" });
    }

    // AWS SDK (lazy import)
    const { S3Client, GetObjectCommand, PutObjectCommand } = await import("@aws-sdk/client-s3");
    const { getSignedUrl } = await import("@aws-sdk/s3-request-presigner");
    const sharp = (await import("sharp")).default;

    const s3 = new S3Client({ region: process.env.AWS_REGION });

    // Read original
    const original = await s3GetBuffer(s3, BUCKET_NAME, key, GetObjectCommand);

    // Optional background removal
    const baseBuf = removeBg ? await removeBgFal(original, HF_TOKEN) : original;

    // Probe metadata to decide output format
    const meta = await sharp(baseBuf).metadata();
    const hasAlpha = meta.hasAlpha === true || removeBg === true;

    // To avoid black bars when using "contain", we set transparent background and output PNG.
    const useTransparentCanvas = fit === "contain";
    const outIsPng = hasAlpha || useTransparentCanvas;

    // Resize
    const pipeline = sharp(baseBuf)
      .resize({
        width,
        height,
        fit,
        position: "attention",
        withoutEnlargement: !!withoutEnlargement,
        kernel: sharp.kernel.lanczos3,
        background: useTransparentCanvas
          ? { r: 0, g: 0, b: 0, alpha: 0 }     // transparent canvas
          : { r: 255, g: 255, b: 255, alpha: 1 }, // white if not using contain
      })
      .sharpen();

    const outBuf = outIsPng
      ? await pipeline.png().toBuffer()
      : await pipeline.jpeg({ quality: 90, chromaSubsampling: "4:4:4" }).toBuffer();

    // Output S3 path
    const baseName = (key.split("/").pop() || "image").replace(/\.(png|jpe?g|webp|gif|bmp|tiff)$/i, "");
    const outExt   = outIsPng ? "png" : "jpg";
    const outKey   = `${OUTPUT_PREFIX}${width}x${height}/${fit}/${baseName}.${outExt}`;

    await s3.send(new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: outKey,
      Body: outBuf,
      ContentType: outIsPng ? "image/png" : "image/jpeg",
      CacheControl: "private, max-age=31536000",
    }));

    const url = await getSignedUrl(
      s3,
      new GetObjectCommand({ Bucket: BUCKET_NAME, Key: outKey }),
      { expiresIn: SIGNED_URL_TTL_SECONDS }
    );

    return ok(200, {
      url,
      key: outKey,
      bucket: BUCKET_NAME,
      width,
      height,
      fit,
      withoutEnlargement: !!withoutEnlargement,
    });
  } catch (err) {
    console.error("Handler error:", err);
    return ok(500, { error: String(err?.message || err) });
  }
};
