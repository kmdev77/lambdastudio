import React, { useEffect, useMemo, useRef, useState } from "react";

const MAX_PX = 4096;
type Fit = "contain" | "cover" | "fill" | "inside" | "outside";

export default function App() {
  const apiUrl = import.meta.env.VITE_API_URL as string;
  const bucketEnv = import.meta.env.VITE_S3_BUCKET as string || "";

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
  const [removeBg, setRemoveBg] = useState(false);

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
    ["dragenter","dragover","dragleave","drop"].forEach(evt => el.addEventListener(evt, prevent as any));
    el.addEventListener("drop", onDrop as any);
    return () => {
      ["dragenter","dragover","dragleave","drop"].forEach(evt => el.removeEventListener(evt, prevent as any));
      el.removeEventListener("drop", onDrop as any);
    };
  }, []);

  async function handleFile(f: File) {
    setFile(f);
    setPreviewUrl(null);
    setPalette(null);
    setNote("Preparing upload…");
    const dataUrl = await fileToDataUrl(f);
    const { width, height } = await getImgSize(dataUrl);
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
      setNote("Upload complete.");
    } catch (e: any) {
      setNote(`Upload error: ${e.message}`);
    } finally {
      setUploading(false);
    }
  }

  async function onProcess() {
    if (!key || !dims) return;
    try {
      setProcessing(true);
      setNote("Processing image…");
      const res = await fetch(`${apiUrl}/process`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, w: dims.w, h: dims.h, fit: dims.fit, removeBg, withoutEnlargement: true })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error);
      setPreviewUrl(data.url);
      setNote("Processed successfully.");
    } catch (e: any) {
      setNote(`Process error: ${e.message}`);
    } finally {
      setProcessing(false);
    }
  }

  async function onPalette() {
    if (!key) return;
    try {
      setProcessing(true);
      setNote("Extracting palette…");
      setPalette(null);
      const res = await fetch(`${apiUrl}/palette`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error);
      setPalette(data.colors);
      setPaletteUrl(data.previewUrl);
      setNote("Palette ready!");
    } catch (e: any) {
      setNote(`Palette error: ${e.message}`);
    } finally {
      setProcessing(false);
    }
  }

  const clamp = (n: number) => Math.max(1, Math.min(MAX_PX, Math.round(n)));
  const onWidth = (n: number) => dims && setDims(dims.lock ? { ...dims, w: clamp(n), h: clamp(n / ratio) } : { ...dims, w: clamp(n) });
  const onHeight = (n: number) => dims && setDims(dims.lock ? { ...dims, h: clamp(n), w: clamp(n * ratio) } : { ...dims, h: clamp(n) });

  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-50 to-zinc-100 dark:from-zinc-950 dark:to-black text-zinc-800 dark:text-zinc-100 flex flex-col">
      <header className="sticky top-0 backdrop-blur-lg bg-white/70 dark:bg-zinc-950/60 border-b border-zinc-200/60 dark:border-zinc-800/60">
        <div className="max-w-6xl mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-semibold tracking-tight">
            Image Resizer <span className="text-zinc-400">·</span> <span className="text-emerald-500">AI</span>
          </h1>
          <span className="text-xs text-zinc-500">Bucket: {bucketLabel || "(auto-managed)"}</span>
        </div>
      </header>

      <main className="max-w-6xl w-full mx-auto px-4 py-8 flex flex-col lg:flex-row gap-8">
        {/* Upload and controls */}
        <section className="flex-1 space-y-6">
          {/* Upload */}
          <div ref={dropRef} className="rounded-2xl border border-zinc-200/70 dark:border-zinc-800/70 bg-white/70 dark:bg-zinc-900/70 backdrop-blur p-6 transition hover:border-emerald-500/40">
            <p className="font-medium mb-2 text-sm">Upload Image</p>
            <label htmlFor="file" className="block cursor-pointer text-center border border-dashed rounded-xl p-6 hover:bg-zinc-100/40 dark:hover:bg-zinc-800/50 transition">
              <input type="file" id="file" accept="image/*" className="hidden" onChange={e=>{const f=e.target.files?.[0]; if(f) handleFile(f);}}/>
              <div className="text-sm text-zinc-500">Drag & drop or <span className="underline">browse</span></div>
              {file && <div className="mt-2 text-xs text-zinc-400">{file.name} · {(file.size/1024/1024).toFixed(2)} MB</div>}
              {imgMeta && <div className="mt-1 text-xs text-zinc-400">Original: {imgMeta.w} × {imgMeta.h}px</div>}
            </label>
            {uploading && <div className="mt-3 text-xs text-amber-600">Uploading…</div>}
          </div>

          {/* Dimensions */}
          <div className="rounded-2xl border border-zinc-200/70 dark:border-zinc-800/70 bg-white/70 dark:bg-zinc-900/70 backdrop-blur p-6">
            <p className="font-medium mb-4 text-sm">Resize Options</p>
            <div className="flex flex-col sm:flex-row gap-3 items-end">
              <div className="flex-1">
                <label className="text-xs text-zinc-500">Width (px)</label>
                <input type="number" value={dims?.w||""} onChange={e=>onWidth(Number(e.target.value))} className="mt-1 w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-transparent"/>
              </div>
              <button
                type="button"
                onClick={()=>dims&&setDims({...dims,lock:!dims.lock})}
                className={`h-10 w-10 rounded-lg flex items-center justify-center border ${dims?.lock?"border-emerald-500 text-emerald-500":"border-zinc-400 text-zinc-400"} transition`}
              >
                {dims?.lock ? "🔒" : "🔓"}
              </button>
              <div className="flex-1">
                <label className="text-xs text-zinc-500">Height (px)</label>
                <input type="number" value={dims?.h||""} onChange={e=>onHeight(Number(e.target.value))} className="mt-1 w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-transparent"/>
              </div>
            </div>
{/* 
            <div className="mt-5 flex items-center justify-between">
              <span className="text-xs text-zinc-500">Remove BG</span>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" checked={removeBg} onChange={e=>setRemoveBg(e.target.checked)} className="sr-only peer"/>
                <span className="w-11 h-6 bg-zinc-300 peer-checked:bg-emerald-500 rounded-full relative after:content-[''] after:w-5 after:h-5 after:bg-white after:rounded-full after:absolute after:top-[2px] after:left-[2px] after:transition-transform peer-checked:after:translate-x-5"></span>
              </label>
            </div> */}

            {/* Process button */}
            <button
              onClick={onProcess}
              disabled={!key || processing}
              className="mt-6 relative w-full h-12 rounded-xl bg-black text-white dark:bg-white dark:text-black disabled:opacity-50 overflow-hidden group"
            >
              <span className="relative z-10">{processing ? "Processing…" : "Resize Image"}</span>
              <span className="absolute inset-0 bg-gradient-to-r from-emerald-500 via-blue-500 to-purple-500 opacity-0 group-hover:opacity-100 transition-opacity blur-lg"></span>
            </button>

            {/* Palette button (rainbow animated border) */}
            <div className="mt-4 relative">
              <div className="absolute inset-0 rounded-xl p-[2px] animate-[borderSpin_3s_linear_infinite] bg-[conic-gradient(from_0deg,red,orange,yellow,green,cyan,blue,purple,red)]">
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

            {note && <p className="mt-3 text-xs text-zinc-500">{note}</p>}
          </div>
        </section>

        {/* Preview */}
        <section className="flex-1 rounded-2xl border border-zinc-200/70 dark:border-zinc-800/70 bg-white/70 dark:bg-zinc-900/70 backdrop-blur p-6">
          <p className="font-medium mb-4 text-sm">Preview</p>
          <div className="rounded-xl overflow-hidden border border-zinc-200 dark:border-zinc-800 aspect-square flex items-center justify-center bg-[url('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAK0lEQVQoU2NkYGD4z0AEYBxVSFUwCqjZKFYBjNolYo1A1CBRwFqDKAAAjDgw4ihA0hYAAAAASUVORK5CYII=')]">
            {previewUrl ? (
              <img src={previewUrl} alt="Preview" className="max-h-full max-w-full object-contain" />
            ) : (
              <p className="text-sm text-zinc-500 text-center px-2">Upload an image to see preview</p>
            )}
          </div>

          {/* Palette display */}
          {palette && (
            <div className="mt-6">
              <p className="font-medium mb-2 text-sm">Extracted Palette</p>
              <div className="flex gap-2 overflow-x-auto pb-2">
                {palette.map((hex,i)=>(
                  <div key={i} className="flex-shrink-0 w-12 h-12 rounded-lg border border-zinc-300 dark:border-zinc-700 flex items-center justify-center font-mono text-[10px]" style={{backgroundColor:hex}}>
                    <span className={parseInt(hex.replace("#",""),16)>0xffffff/2?"text-black":"text-white"}>{hex}</span>
                  </div>
                ))}
              </div>
              {paletteUrl && <img src={paletteUrl} alt="Palette Preview" className="mt-3 rounded-xl border border-zinc-200 dark:border-zinc-800" />}
            </div>
          )}
        </section>
      </main>

      <style>{`
        // @keyframes borderSpin {
        //   0% { transform: rotate(0deg); }
        //   100% { transform: rotate(360deg); }
        // }
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
