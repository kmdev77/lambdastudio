import LambHead from "./assets/lamdahead.png";

function IntroExplainer() {
  return (
    <section
      className="
        rounded-2xl border border-zinc-200/70 dark:border-zinc-800/70
        bg-white/70 dark:bg-zinc-900/70 backdrop-blur
        p-5 md:p-6 shadow-sm
      "
      aria-labelledby="intro-title"
      data-hiw="true"
    >
      <h2 className="flex items-center gap-2 text-xl md:text-2xl font-semibold mb-1 bg-gradient-to-r from-emerald-400 to-cyan-500 bg-clip-text text-transparent">
        <img
          src={LambHead}
          alt="Lamb Head"
          className="w-[1.1em] h-auto object-contain rounded-md"
        />
        Welcome to LambdaStudio
      </h2>

      {/* Subtext / Tagline */}
      <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-4 font-bold">
        Cloud-powered image resizing and color palette extraction
      </p>

      <ul className="space-y-3 text-zinc-700 dark:text-zinc-300 text-sm leading-relaxed">
        <li>
          <span className="font-semibold">1. Upload your image:</span> Click or drag
          any photo into the upload box. Supports JPG, PNG, and WebP formats.
        </li>
        <li>
          <span className="font-semibold">2. Preview instantly:</span> See your image
          immediately after upload to check framing and colors.
        </li>
        <li>
          <span className="font-semibold">3. Resize with control:</span> Adjust width
          and height (up to 4096 px). Use{" "}
          <span className="text-emerald-500">🔒</span> to lock the aspect ratio or{" "}
          <span className="text-emerald-500">🔓</span> to unlock and freely customize
          dimensions.
        </li>
        <li>
          <span className="font-semibold">4. Extract your palette:</span> Press{" "}
          <span className="font-medium text-emerald-500">Get Palette 🎨</span> to
          extract the dominant colors for branding or design use.
        </li>
      </ul>
    </section>
  );
}

export default IntroExplainer;
