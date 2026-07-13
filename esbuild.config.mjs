import { build, context } from "esbuild";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isWatch = process.argv.includes("--watch");

const EXTENSIONS = [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"];

function resolveWithExtension(p) {
  if (fs.existsSync(p) && fs.statSync(p).isFile()) return p;
  for (const ext of EXTENSIONS) {
    if (fs.existsSync(p + ext)) return p + ext;
  }
  for (const ext of EXTENSIONS) {
    if (fs.existsSync(path.join(p, "index" + ext))) return path.join(p, "index" + ext);
  }
  return p;
}

// @/ 路径别名插件
const aliasPlugin = {
  name: "alias",
  setup(build) {
    build.onResolve({ filter: /^@\// }, (args) => {
      const base = path.resolve(__dirname, "src", args.path.slice(2));
      return { path: resolveWithExtension(base) };
    });
  },
};

// 确保 web-build 目录存在
fs.mkdirSync(path.resolve(__dirname, "web-build"), { recursive: true });

const options = {
  entryPoints: ["src/main.ts"],
  bundle: true,
  outfile: "web-build/app.js",
  platform: "browser",
  format: "iife",
  target: "es2020",
  sourcemap: isWatch ? "inline" : "linked",
  minify: !isWatch,
  treeShaking: true,
  legalComments: "none",
  plugins: [aliasPlugin],
  logLevel: "info",
  resolveExtensions: EXTENSIONS,
  define: {
    "process.env.NODE_ENV": isWatch ? '"development"' : '"production"',
  },
};

if (isWatch) {
  const ctx = await context(options);
  await ctx.watch();
  console.log("[esbuild] watching... → web-build/app.js");
} else {
  await build(options);
  console.log("[esbuild] build complete → web-build/app.js");
}
