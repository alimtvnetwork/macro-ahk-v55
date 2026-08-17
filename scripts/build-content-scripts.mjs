import esbuild from "esbuild";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");

const contentScripts = [
  "src/content-scripts/xpath-recorder.ts",
  "src/content-scripts/network-reporter.ts",
  "src/content-scripts/message-relay.ts",
  "src/content-scripts/prompt-injector.ts"
];

for (const script of contentScripts) {
  const infile = path.resolve(rootDir, script);
  const basename = path.basename(script, ".ts");
  const outfile = path.resolve(rootDir, "chrome-extension/content-scripts", `${basename}.js`);
  
  esbuild.buildSync({
    entryPoints: [infile],
    bundle: true,
    outfile: outfile,
    format: "iife",
    minify: false,
    jsx: "automatic",
  });
  console.log(`[build-content-scripts] Built ${basename}.js`);
}

