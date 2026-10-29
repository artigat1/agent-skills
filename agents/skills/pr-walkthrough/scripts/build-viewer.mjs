// Assemble one self-contained viewer page: template + inlined renderer + the document.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseGraphDoc } from "@coldtea/pr-lens-schema";
const here = dirname(fileURLToPath(import.meta.url));
const [, , docPath = ".pr-lens/graph.json", outPath = ".pr-lens/viewer.html"] = process.argv;
// Parsed, not just read: the embedded document carries every schema default,
// so the viewer never meets a node without badges or files.
let doc;
try {
  doc = parseGraphDoc(JSON.parse(readFileSync(docPath, "utf8")));
} catch (error) {
  console.error(error instanceof SyntaxError ? `${docPath} is not JSON: ${error.message}` : error.message);
  process.exit(1);
}
const renderer = readFileSync(resolve(here, "dist/pr-lens.iife.js"), "utf8"); // built by setup.sh
const template = readFileSync(resolve(here, "viewer.template.html"), "utf8");
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");
const docJson = JSON.stringify(doc).replace(/</g, "\\u003c"); // keep data from terminating the JSON script element
for (const marker of ["__TITLE__", "__RENDERER__", "__DOC__"]) if (template.split(marker).length !== 2) throw new Error(`template must contain ${marker} exactly once`);
const html = template.replace("__TITLE__", esc(doc.title)).replace("__RENDERER__", () => renderer).replace("__DOC__", () => docJson);
mkdirSync(dirname(resolve(outPath)), { recursive: true });
writeFileSync(outPath, html);
console.log(`wrote ${outPath}: ${html.length} bytes (renderer ${renderer.length}, document ${docJson.length})`);
