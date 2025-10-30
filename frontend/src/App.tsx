import React, { useEffect, useMemo, useRef, useState } from "react";
import Logo from "./assets/lambdastudiolg.png";
import LambHex from "./assets/lamb-hex.png";
// import LambHead from "./assets/lamdahead.png"
import IntroExplainer from "./IntroExplainer"
// at top of your component file
import thumbsLeft from "./assets/thumbs-left-2.png"; // adjust path if different




const MAX_PX = 4096;
type Fit = "contain" | "cover" | "fill" | "inside" | "outside";



export default function App() {
  const [processOk, setProcessOk] = useState(false);
  const [uploadKey, setUploadKey] = useState<string | null>(null);     // uploads/...
  const [processedKey, setProcessedKey] = useState<string | null>(null); // thumbs/... (optional)
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [resultDownloadUrl, setResultDownloadUrl] = useState<string | null>(null);



  const apiUrl = import.meta.env.VITE_API_URL as string;
  const bucketEnv = (import.meta.env.VITE_S3_BUCKET as string) || "";

  const [file, setFile] = useState<File | null>(null);
  const [key, setKey] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [palette, setPalette] = useState<string[] | null>(null);
  const [paletteUrl, setPaletteUrl] = useState<string | null>(null);
  const [bucketLabel, setBucketLabel] = useState(bucketEnv);
  const [note, setNote] = useState<string | null>(null);

  const [uploading, setUploading] = useState(false);
  const [processing, setProcessing] = useState(false);

  const [imgMeta, setImgMeta] = useState<{ w: number; h: number } | null>(null);
  const [dims, setDims] = useState<{ w: number; h: number; fit: Fit; lock: boolean } | null>(null);
  // const [removeBg, setRemoveBg] = useState(false);

  const ratio = useMemo(() => (imgMeta ? imgMeta.w / imgMeta.h : 1), [imgMeta]);

  const dropRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = dropRef.current;
    if (!el) return;
    const prevent = (e: DragEvent) => { e.preventDefault(); e.stopPropagation(); };
    const onDrop = (e: DragEvent) => {
      prevent(e);
      const f = e.dataTransfer?.files?.[0];
      if (f) handleFile(f);
    };
    ["dragenter", "dragover", "dragleave", "drop"].forEach(evt => el.addEventListener(evt, prevent as any));
    el.addEventListener("drop", onDrop as any);
    return () => {
      ["dragenter", "dragover", "dragleave", "drop"].forEach(evt => el.removeEventListener(evt, prevent as any));
      el.removeEventListener("drop", onDrop as any);
    };
  }, []);

  async function handleFile(f: File) {
    setFile(f);
    setPreviewUrl(null);
    setPalette(null);
    setNote("Preparing upload…");

    const dataUrl = await fileToDataUrl(f);
    const { width, height } = await getImgSize(dataUrl); // ✅ removed stray label

    // Instant preview on upload
    setPreviewUrl(dataUrl);

    setImgMeta({ w: width, h: height });
    setDims({ w: width, h: height, fit: "contain", lock: true });

    await signAndUpload(f);
  }

  async function signAndUpload(f: File) {
    try {
      setUploading(true);
      const res = await fetch(`${apiUrl}/sign-upload`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: f.name, contentType: f.type })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Sign upload failed");
      if (data.bucket) setBucketLabel(data.bucket);
      await fetch(data.url, { method: "PUT", headers: { "Content-Type": f.type }, body: f });
      setKey(data.key);
      setUploadKey(data.key);      // <-- remember original uploads/... key
      setProcessedKey(null);
      setNote("Upload complete.");
    } catch (e: any) {
      setNote(`Upload error: ${e.message}`);
    } finally {
      setUploading(false);
    }
  }

  async function assertImageLoads(src: string): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve();
      img.onerror = (e) => reject(new Error(`Failed to load: ${src}`));
      img.src = src;
    });
  }

  async function onProcess() {
    if (!key || !dims) return;
    try {
      setProcessOk(false);         // reset success icon at start
      setProcessing(true);
      setNote("Processing image…");

      const res = await fetch(`${apiUrl}/process`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key,
          w: dims.w,
          h: dims.h,
          fit: dims.fit,
          withoutEnlargement: false
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Process failed");

      // Capture keys from response
      const outKey: string | undefined =
        data.outputKey || data.output_key || data.key; // processed key

      // Keep whatever your UI expects in `key` (usually the latest/processed key is fine)
      if (typeof data.key === "string") setKey(data.key);

      // Remember the processed key separately (DO NOT touch uploadKey here)
      if (outKey) setProcessedKey(outKey);

      // Prefer direct URL fields
      let rawUrl: string | undefined = data.outputUrl || data.url || data.s3Url;

      // Build URL from key if needed
      if (!rawUrl && outKey) {
        const m = apiUrl.match(/execute-api\.([a-z0-9-]+)\.amazonaws\.com/i);
        const region = m?.[1] || "us-west-1";
        const bucket = data.bucket || bucketLabel || (import.meta.env.VITE_S3_BUCKET as string);
        if (bucket) rawUrl = `https://${bucket}.s3.${region}.amazonaws.com/${outKey}`;
      }

      if (!rawUrl) {
        setNote("Processed successfully, but no URL/key returned.");
        setProcessOk(true);
        return;
      }

      // 🔒 If it's a pre-signed URL, do NOT modify it (no cache-buster)
      const isPresigned = /[?&]X-Amz-Signature=|[?&]X-Amz-Algorithm=/i.test(rawUrl);
      const finalUrl = isPresigned
        ? rawUrl
        : (/^https?:/i.test(rawUrl)
          ? `${rawUrl}${rawUrl.includes("?") ? "&" : "?"}t=${Date.now()}`
          : rawUrl);

      // Verify it loads
      await new Promise<void>((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve();
        img.onerror = () => reject(new Error(`Failed to load: ${finalUrl}`));
        img.src = finalUrl;
      });

      setPreviewUrl(finalUrl);
      setResultUrl(finalUrl);
      setResultDownloadUrl(data.downloadUrl || null);
      setNote("Processed successfully.");
      setProcessOk(true);          // success icon ON
    } catch (e: any) {
      console.error(e);
      setNote(`Process error: ${e.message}`);
      setProcessOk(false);
    } finally {
      setProcessing(false);
    }
  }


  async function onPalette() {
    if (!uploadKey) {
      setNote("Palette error: no uploaded file key. Upload an image first.");
      return;
    }
    try {
      setProcessing(true);
      setNote("Extracting palette…");
      setPalette(null);

      const res = await fetch(`${apiUrl}/palette`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: uploadKey })   // <-- IMPORTANT
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Palette failed");

      setPalette(data.colors);
      setPaletteUrl(data.previewUrl);
      setNote("Palette ready!");
      // (optional) set a paletteOk flag if you're showing the icon here too
    } catch (e: any) {
      setNote(`Palette error: ${e.message}`);
    } finally {
      setProcessing(false);
    }
  }


async function downloadResized() {
  if (!resultUrl && !resultDownloadUrl) return;

  try {
    // Prefer server-signed "attachment" URL if present
    const href = resultDownloadUrl || resultUrl!;
    const isPresigned = /[?&]X-Amz-(Signature|Algorithm|Credential)=/i.test(href);

    // Cross-origin downloads don’t report completion; show a start message.
    setNote("Download started…");

    if (isPresigned || /^https?:/i.test(href)) {
      // Open in a new tab; if server set Content-Disposition: attachment,
      // the browser will trigger Save As…
      const a = document.createElement("a");
      a.href = href;
      a.target = "_blank";
      a.rel = "noopener";
      document.body.appendChild(a);
      a.click();
      a.remove();
      return;
    }

    // data: URL or same-origin fallback (nice filename)
    if (/^data:/i.test(href)) {
      const a = document.createElement("a");
      a.href = href;
      const ext = href.match(/^data:image\/(\w+)/i)?.[1] || "png";
      a.download = `resized_${dims?.w || ""}x${dims?.h || ""}.${ext}`;
      a.click();
      return;
    }
  } catch (e: any) {
    setNote(`Download error: ${e.message}`);
  }
}





  const clamp = (n: number) => Math.max(1, Math.min(MAX_PX, Math.round(n)));
  const onWidth = (n: number) => dims && setDims(dims.lock ? { ...dims, w: clamp(n), h: clamp(n / ratio) } : { ...dims, w: clamp(n) });
  const onHeight = (n: number) => dims && setDims(dims.lock ? { ...dims, h: clamp(n), w: clamp(n * ratio) } : { ...dims, h: clamp(n) });

  // function scrollToInstructions() {
  //   const nodes = Array.from(document.querySelectorAll('[data-hiw="true"]')) as HTMLElement[];
  //   const target = nodes.find(n => getComputedStyle(n).display !== "none") || nodes[0];
  //   if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
  // }


  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-50 to-zinc-100 dark:from-zinc-950 dark:to-black text-zinc-800 dark:text-zinc-100 flex flex-col">
      <header className="fixed top-0 left-0 right-0 z-50 backdrop-blur-lg bg-white/70 dark:bg-zinc-950/60 border-b border-zinc-200/60 dark:border-zinc-800/60">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          {/* Brand */}
          <div className="flex items-center gap-1 sm:gap-1">
            <img src={Logo} alt="LambdaStudio logo" className="h-8 w-8 sm:h-10 sm:w-10 object-contain" />
            <h1 className="text-2xl font-semibold tracking-tight flex items-baseline">
              <span className="bg-gradient-to-r from-emerald-500 to-sky-500 bg-clip-text text-transparent">Lambda</span>
              <span className="text-zinc-900 dark:text-zinc-100">Studio</span>
            </h1>
          </div>

          {/* Right actions */}
          <div className="flex items-center gap-4">
            {/* <button
        onClick={scrollToInstructions}
        className="text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:text-emerald-500 transition"
        aria-label="Scroll to instructions"
      >
        Instructions
      </button> */}
            <a
              href="https://github.com/kmdev77/lambdastudio"
              target="_blank"
              rel="noopener noreferrer"
              className="group"
              aria-label="Open GitHub repository"
              title="GitHub"
            >
              <svg
                viewBox="0 0 24 24"
                className="h-5 w-5 text-zinc-700 dark:text-zinc-300 group-hover:text-emerald-500 transition"
                fill="currentColor"
                aria-hidden="true"
              >
                <path d="M12 2C6.477 2 2 6.486 2 12.021c0 4.424 2.865 8.172 6.839 9.492.5.093.683-.217.683-.483 0-.238-.009-.869-.014-1.705-2.782.605-3.369-1.343-3.369-1.343-.455-1.158-1.111-1.468-1.111-1.468-.909-.622.069-.609.069-.609 1.004.071 1.532 1.032 1.532 1.032.893 1.53 2.345 1.088 2.914.833.091-.648.35-1.088.636-1.338-2.221-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.03-2.688-.103-.253-.447-1.27.098-2.646 0 0 .84-.27 2.75 1.027A9.564 9.564 0 0 1 12 6.844c.851.004 1.708.116 2.509.341 1.909-1.297 2.748-1.027 2.748-1.027.546 1.376.202 2.393.1 2.646.641.7 1.028 1.595 1.028 2.688 0 3.848-2.338 4.695-4.566 4.944.359.31.679.92.679 1.855 0 1.339-.012 2.419-.012 2.749 0 .268.18.58.689.481C19.14 20.19 22 16.444 22 12.021 22 6.486 17.522 2 12 2z" />
              </svg>
            </a>
          </div>
        </div>
      </header>



      {/* MAIN: grid; left column flex stack */}
      <main className="pt-20 max-w-6xl w-full mx-auto px-4 py-8 grid lg:grid-cols-12 gap-8 items-stretch">
        {/* LEFT COLUMN */}
        <div className="lg:col-span-5 flex flex-col gap-6 h-full">

          <IntroExplainer />
          {/* Upload */}
          <div
            ref={dropRef}
            className="rounded-2xl border border-zinc-200/70 dark:border-zinc-800/70 bg-white/70 dark:bg-zinc-900/70 backdrop-blur p-6 transition hover:border-emerald-500/40"
          >
            <p className="font-medium mb-2 text-sm">Upload Image</p>
            <label
              htmlFor="file"
              className="block cursor-pointer text-center border border-dashed rounded-xl p-6 hover:bg-zinc-100/40 dark:hover:bg-zinc-800/50 transition"
            >
              <input
                type="file"
                id="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFile(f);
                }}
              />
              <div className="text-sm text-zinc-500">
                Drag & drop or <span className="underline">browse</span>
              </div>
              {file && (
                <div className="mt-2 text-xs text-zinc-400">
                  {file.name} · {(file.size / 1024 / 1024).toFixed(2)} MB
                </div>
              )}
              {imgMeta && (
                <div className="mt-1 text-xs text-zinc-400">
                  Original: {imgMeta.w} × {imgMeta.h}px
                </div>
              )}
            </label>
            {uploading && <div className="mt-3 text-xs text-amber-600">Uploading…</div>}
          </div>

          {/* Resize Options */}
          <div className="rounded-2xl border border-zinc-200/70 dark:border-zinc-800/70 bg-white/70 dark:bg-zinc-900/70 backdrop-blur p-6">
            <p className="font-medium mb-4 text-sm">Resize Options</p>

            <div className="w-full">

              {/* Mobile / small tablet: stacked inputs + centered lock */}
              <div className="md:hidden space-y-3">
                {/* Width */}
                <div>
                  <label className="text-xs text-zinc-500">Width (px)</label>
                  <input
                    type="number"
                    value={dims?.w || ""}
                    onChange={(e) => onWidth(Number(e.target.value))}
                    className="mt-1 w-full h-11 px-3 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-transparent"
                  />
                </div>

                {/* Lock row — centered, equal top/bottom space */}
                <div className="flex justify-center py-2">
                  <button
                    type="button"
                    onClick={() => dims && setDims({ ...dims, lock: !dims.lock })}
                    className={`h-10 w-10 rounded-lg flex items-center justify-center border transition
          ${dims?.lock ? "border-emerald-500 text-emerald-500" : "border-zinc-400 text-zinc-400"}`}
                    title={dims?.lock ? "Unlock aspect ratio" : "Lock aspect ratio"}
                    aria-label={dims?.lock ? "Unlock aspect ratio" : "Lock aspect ratio"}
                  >
                    {dims?.lock ? "🔒" : "🔓"}
                  </button>
                </div>

                {/* Height */}
                <div>
                  <label className="text-xs text-zinc-500">Height (px)</label>
                  <input
                    type="number"
                    value={dims?.h || ""}
                    onChange={(e) => onHeight(Number(e.target.value))}
                    className="mt-1 w-full h-11 px-3 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-transparent"
                  />
                </div>
              </div>

              {/* Desktop (md+): keep original 3-column grid */}
              <div className="hidden md:grid grid-cols-[1fr_auto_1fr] gap-3 items-end">
                {/* Width */}
                <div className="w-full">
                  <label className="text-xs text-zinc-500">Width (px)</label>
                  <input
                    type="number"
                    value={dims?.w || ""}
                    onChange={(e) => onWidth(Number(e.target.value))}
                    className="mt-1 w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-transparent"
                  />
                </div>

                {/* Lock */}
                <button
                  type="button"
                  onClick={() => dims && setDims({ ...dims, lock: !dims.lock })}
                  className={`mx-auto h-11 w-11 rounded-lg flex items-center justify-center border transition
        ${dims?.lock ? "border-emerald-500 text-emerald-500" : "border-zinc-400 text-zinc-400"}`}
                  title={dims?.lock ? "Unlock aspect ratio" : "Lock aspect ratio"}
                  aria-label={dims?.lock ? "Unlock aspect ratio" : "Lock aspect ratio"}
                >
                  {dims?.lock ? "🔒" : "🔓"}
                </button>

                {/* Height */}
                <div className="w-full">
                  <label className="text-xs text-zinc-500">Height (px)</label>
                  <input
                    type="number"
                    value={dims?.h || ""}
                    onChange={(e) => onHeight(Number(e.target.value))}
                    className="mt-1 w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-transparent"
                  />
                </div>
              </div>

            </div>


            {/* Process */}
            {/* <button
              onClick={onProcess}
              disabled={!key || processing}
              className="mt-6 relative w-full h-12 rounded-xl bg-black text-white dark:bg-white dark:text-black disabled:opacity-50 overflow-hidden group"
            >
              <span className="relative z-10">
                {processing ? "Processing…" : "Resize Image"}
              </span>
              <span className="absolute inset-0 bg-gradient-to-r from-emerald-500 via-blue-500 to-purple-500 opacity-0 group-hover:opacity-100 transition-opacity blur-lg"></span>
            </button> */}

            <button
              onClick={onProcess}
              disabled={!key || processing}
              className="mt-6 relative w-full h-12 rounded-xl bg-black text-white dark:bg-white dark:text-black disabled:opacity-50 overflow-hidden group"
            >
              <span className="relative z-10">
                {processing ? "Processing…" : "Resize Image"}
              </span>
              <span className="absolute inset-0 bg-gradient-to-r from-emerald-500 via-blue-500 to-purple-500 opacity-0 group-hover:opacity-100 transition-opacity blur-lg"></span>
            </button>


            {/* Palette */}
            <div className="mt-4 relative">
              <div className="absolute inset-0 rounded-xl p-[2px]  bg-[conic-gradient(from_0deg,red,orange,yellow,green,cyan,blue,purple,red)]">
                <div className="h-full w-full bg-white dark:bg-zinc-900 rounded-[10px]"></div>
              </div>
              <button
                onClick={onPalette}
                disabled={!key || uploading}
                className="relative z-10 w-full h-12 font-medium text-lg rounded-xl bg-white/80 dark:bg-zinc-900/80 backdrop-blur hover:scale-[1.01] active:scale-[0.99] transition-transform"
              >
                Get Palette 🎨
              </button>
            </div>
            {/* Status row (under the buttons) */}
            <div className="mt-2 flex items-center text-sm text-zinc-600 dark:text-zinc-400">
              <span className="truncate">{note}</span>
              {!processing && processOk && (
                <img
                  src={thumbsLeft}
                  alt="success"
                  className="ml-1 h-5 w-auto shrink-0 select-none"
                  draggable={false}
                />
              )}
            </div>

          </div>

          {/* INTRO CARD — desktop snug filler */}
          {/* INTRO CARD — desktop snug filler */}


        </div>

        {/* RIGHT COLUMN */}
        <section className="lg:col-span-7 rounded-2xl border border-zinc-200/70 dark:border-zinc-800/70 bg-white/70 dark:bg-zinc-900/70 backdrop-blur p-6 flex flex-col">
          <p className="font-medium mb-4 text-sm">Preview</p>

          <div className="rounded-xl overflow-hidden border border-zinc-200 dark:border-zinc-800 aspect-square flex items-center justify-center">
            {previewUrl ? (
              <img
                src={previewUrl || undefined}
                alt="Preview"
                className="max-h-full max-w-full object-contain"
              />
            ) : (
              <p className="text-sm text-zinc-500 text-center px-2">Upload an image to see preview</p>
            )}
          </div>

          <button
            onClick={downloadResized}
            disabled={!resultUrl || processing || uploading}
            className="mt-3 w-full h-11 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white/80 dark:bg-zinc-900/80 text-sm font-medium disabled:opacity-50"
          >
            Download Resized Image
          </button>

          {palette && (
            <div className="mt-6 relative">
              <p className="font-medium mb-2 text-sm">Extracted Palette</p>

              {/* Desktop lamb */}
              <img
                src={LambHex}
                alt="Lamb says: I got your HEX 😎"
                className="hidden lg:block absolute top-[-32px] right-[0px] w-44 max-w-[140px] pointer-events-none select-none drop-shadow-[0_0_25px_rgba(0,0,0,0.35)]"
              />

              {/* MOBILE/TABLET layout */}
              <div className="grid grid-cols-[1fr_auto] items-center gap-2 lg:block">
                <div className="flex gap-2 overflow-x-auto pb-2 pr-2 lg:pr-0">
                  {palette.map((hex, i) => (
                    <div
                      key={i}
                      className="flex-shrink-0 w-12 h-12 rounded-lg border border-zinc-300 dark:border-zinc-700 flex items-center justify-center font-mono text-[10px]"
                      style={{ backgroundColor: hex }}
                    >
                      <span className={parseInt(hex.replace("#", ""), 16) > 0xffffff / 2 ? "text-black" : "text-white"}>
                        {hex}
                      </span>
                    </div>
                  ))}
                </div>

                <img
                  src={LambHex}
                  alt="Lamb says: I got your HEX 😎"
                  className="block lg:hidden w-24 xs:w-40 sm:w-44 md:w-58 object-contain pointer-events-none select-none"
                />
              </div>

              {paletteUrl && (
                <img
                  src={paletteUrl}
                  alt="Palette Preview"
                  className="mt-3 rounded-xl border border-zinc-200 dark:border-zinc-800"
                />
              )}
            </div>
          )}
        </section>
      </main>

      {/* MOBILE-ONLY How It Works (placed RIGHT BEFORE FOOTER) */}



      {/* FOOTER aligned to content edges */}
      {/* <footer className="border-t border-zinc-200/60 dark:border-zinc-800/60 py-6">
        <div className="relative max-w-6xl mx-auto px-4">
          <span className="pointer-events-none absolute -top-[1px] left-0 right-0 h-[2px] bg-gradient-to-r from-pink-500 via-emerald-400 to-cyan-500 animate-[rainbow_4s_linear_infinite]" />
          <div className="flex flex-col md:flex-row items-center justify-between text-sm text-zinc-500 dark:text-zinc-400">
            <div className="flex items-center mb-4 md:mb-0">
              <img src={Logo} alt="Lambda Studio" className="w-7 h-7 mr-2 select-none" />
              <span className="font-semibold tracking-wide">Lambda Studio</span>
            </div>
            <div className="flex space-x-6 text-zinc-600 dark:text-zinc-400">
              <a href="https://lambda-studio-docs.example.com" className="hover:text-emerald-500 transition" target="_blank" rel="noopener noreferrer">Docs</a>
              <a href="https://github.com/yourusername/lambda-studio" className="hover:text-emerald-500 transition" target="_blank" rel="noopener noreferrer">GitHub</a>
              <a href="#about" className="hover:text-emerald-500 transition">About</a>
            </div>
          </div>
        </div>
      </footer> */}

      <style>{`
@keyframes rainbow { 0% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } 100% { background-position: 0% 50%; } }
.bg-gradient-to-r { background-size: 200% 200%; }
@keyframes borderSpin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

function fileToDataUrl(f: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = reject;
    r.readAsDataURL(f);
  });
}
function getImgSize(src: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.width, height: img.height });
    img.onerror = reject;
    img.src = src;
  });
}
