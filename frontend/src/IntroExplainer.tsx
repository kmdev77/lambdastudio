import LambHead from "./assets/lamdahead.png";
import UploadIcon from "./assets/upload-ls.png";
import PreviewIcon from "./assets/preview-ls.png";
import ResizeIcon from "./assets/resize-ls.png";
import PaletteIcon from "./assets/palette-ls.png";

export default function IntroExplainer() {
  return (
    <section
      className="
        rounded-2xl border border-zinc-200/70 dark:border-zinc-800/70
        bg-white/70 dark:bg-zinc-900/70 backdrop-blur
        p-6 md:p-8 shadow-sm
      "
      aria-labelledby="intro-title"
    >
      {/* Heading */}
      <h2
        id="intro-title"
        className="flex items-center gap-2 text-xl md:text-2xl font-semibold mb-1 
                   bg-gradient-to-r from-emerald-400 to-cyan-500 bg-clip-text text-transparent"
      >
        <img
          src={LambHead}
          alt="Lambda Icon"
          className="w-[1.1em] h-auto object-contain rounded-md"
        />
        Welcome to LambdaStudio
      </h2>

      <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-8 font-bold">
        Cloud-powered image resizing and color palette extraction
      </p>

      {/* Step Rows */}
      <div className="space-y-6">
        {/* Step 1 */}
        <div className="flex items-center gap-5 md:gap-8">
          <img
            src={UploadIcon}
            alt="Upload"
            className="w-16 h-16 md:w-20 md:h-20 object-contain rounded-xl"
          />
          <div>
            <h3 className="font-semibold text-zinc-800 dark:text-zinc-200">
              1. Upload your image
            </h3>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
              Click or drag any photo into the upload box. Supports JPG, PNG, and WebP formats.
            </p>
          </div>
        </div>

        {/* Step 2 */}
        <div className="flex items-center gap-5 md:gap-8">
          <img
            src={PreviewIcon}
            alt="Preview"
            className="w-16 h-16 md:w-20 md:h-20 object-contain rounded-xl"
          />
          <div>
            <h3 className="font-semibold text-zinc-800 dark:text-zinc-200">
              2. Preview instantly
            </h3>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
              See your image immediately after upload to check framing and colors.
            </p>
          </div>
        </div>

        {/* Step 3 */}
        <div className="flex items-center gap-5 md:gap-8">
          <img
            src={ResizeIcon}
            alt="Resize"
            className="w-16 h-16 md:w-20 md:h-20 object-contain rounded-xl"
          />
          <div>
            <h3 className="font-semibold text-zinc-800 dark:text-zinc-200">
              3. Resize with control
            </h3>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
              Adjust width and height (up to 4096 px). Use <span className="text-emerald-500">🔒</span> to lock aspect ratio or{" "}
              <span className="text-emerald-500">🔓</span> to unlock for freeform dimensions.
            </p>
          </div>
        </div>

        {/* Step 4 */}
        <div className="flex items-center gap-5 md:gap-8">
          <img
            src={PaletteIcon}
            alt="Palette"
            className="w-16 h-16 md:w-20 md:h-20 object-contain rounded-xl"
          />
          <div>
            <h3 className="font-semibold text-zinc-800 dark:text-zinc-200">
              4. Extract your palette
            </h3>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
              Press <span className="text-emerald-500 font-medium">Get Palette 🎨</span> to extract
              dominant colors for branding or design inspiration.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
