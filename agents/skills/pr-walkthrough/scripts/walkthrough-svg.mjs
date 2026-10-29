// Compile a PR Lens walkthrough into one self-playing SVG.
//
// The renderer draws each diagram a step points at and hands back an atlas of
// where every element landed. This script nests those diagrams in a stage,
// then writes the walkthrough as an SVG timeline: the stage's viewBox tweens
// to each step's focus, a veil dims everything outside it, and a caption bar
// under the stage carries the heading and body. No script, no interactivity —
// it runs anywhere an <img> does, which is the point.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { render, paletteFor, findView } from "@coldtea/pr-lens-renderer";
import { planWalkthrough } from "./lib.js";
import { parseGraphDoc } from "@coldtea/pr-lens-schema";

const [, , docPath = ".pr-lens/graph.json", outPath = ".pr-lens/walkthrough.svg"] = process.argv;
// Parsed, not just read: the schema fills in every default (badges, files, children …)
// the renderer relies on, and refuses a document the validator would refuse.
let doc;
try {
  doc = parseGraphDoc(JSON.parse(readFileSync(docPath, "utf8")));
} catch (error) {
  console.error(error instanceof SyntaxError ? `${docPath} is not JSON: ${error.message}` : error.message);
  process.exit(1);
}
const theme = "dark";
const palette = paletteFor(theme);
const walkthroughPlan = planWalkthrough(doc);
const { flowViewFor } = walkthroughPlan;

const HOLD = 4; // seconds each step is held
const TWEEN = 0.7; // seconds a camera move takes, within one diagram
const STAGE = { width: 1600, height: 900 };
const CAPTION_HEIGHT = 150;
const PAD = 56; // stage units around a focus
const MIN_ZOOM_SHARE = 0.42; // never zoom tighter than this share of the diagram's width

if (!doc.walkthrough?.steps?.length) {
  console.error("document has no walkthrough steps");
  process.exit(1);
}

// ---- 1. Resolve each step to a diagram and a focus box -------------------

const diagrams = new Map(); // key -> { key, svg, width, height, atlas }
const diagramFor = (stage, key) => {
  if (diagrams.has(key)) return diagrams.get(key);
  let rendered;
  if (stage.kind === "view") {
    const view = findView(doc.views, stage.view);
    if (!view) throw new Error(`step refers to missing view: ${stage.view}`);
    rendered = render(doc, { lens: view.lens, theme, view: stage.view });
  } else if (stage.kind === "flow") {
    const viewId = flowViewFor[stage.flow];
    if (viewId) {
      rendered = render(doc, { lens: "data-flow", theme, view: viewId });
    } else {
      const flow = doc.flows.find(({ id }) => id === stage.flow);
      if (!flow) throw new Error(`step refers to missing flow: ${stage.flow}`);
      const only = { id: "__flow", title: flow.title, lens: "data-flow", summary: "", defaultOpen: false, children: [], scope: { kind: "selection", lanes: [], nodes: [], edges: [], flows: [flow.id] } };
      rendered = render({ ...doc, views: [only] }, { lens: "data-flow", theme, view: "__flow" });
    }
  } else {
    rendered = render(doc, { lens: stage.lens, theme });
  }
  const entry = { key, ...rendered };
  diagrams.set(key, entry);
  return entry;
};

const union = (boxes) => {
  const x0 = Math.min(...boxes.map((b) => b.x));
  const y0 = Math.min(...boxes.map((b) => b.y));
  const x1 = Math.max(...boxes.map((b) => b.x + b.width));
  const y1 = Math.max(...boxes.map((b) => b.y + b.height));
  return { x: x0, y: y0, width: x1 - x0, height: y1 - y0 };
};

const focusBoxes = (diagram, focus, flowId) => {
  if (!focus || focus.kind === "all") return [];
  const { atlas } = diagram;
  const picked = [
    ...(focus.lanes ?? []).map((id) => atlas.lanes[id]),
    ...(focus.nodes ?? []).map((id) => atlas.nodes[id]),
    ...(focus.edges ?? []).map((id) => atlas.edges[id]),
    ...(focus.messages ?? []).map((id) => flowId
      ? atlas.messages[flowId]?.[id]
      : Object.values(atlas.messages).map((messages) => messages[id]).find(Boolean)),
  ].filter(Boolean);
  return picked;
};

// Fit a focus into the stage's aspect ratio so a zoom never letterboxes mid-move.
const camera = (diagram, boxes) => {
  const whole = { x: 0, y: 0, width: diagram.width, height: diagram.height };
  const aspect = STAGE.width / STAGE.height;
  let box = boxes.length ? union(boxes) : whole;
  box = { x: box.x - PAD, y: box.y - PAD, width: box.width + 2 * PAD, height: box.height + 2 * PAD };
  const minWidth = diagram.width * MIN_ZOOM_SHARE;
  if (box.width < minWidth) {
    box = { ...box, x: box.x - (minWidth - box.width) / 2, width: minWidth };
  }
  if (box.width / box.height > aspect) {
    const h = box.width / aspect;
    box = { ...box, y: box.y - (h - box.height) / 2, height: h };
  } else {
    const w = box.height * aspect;
    box = { ...box, x: box.x - (w - box.width) / 2, width: w };
  }
  return box;
};

const steps = walkthroughPlan.steps.map(({ step, stage, key }, index) => {
  if (!stage) throw new Error(`step ${step.id} has no stage and no step before it`);
  const diagram = diagramFor(stage, key);
  const boxes = focusBoxes(diagram, step.focus, stage.kind === "flow" ? stage.flow : undefined);
  return { index, step, stage, diagram, boxes, camera: camera(diagram, boxes) };
});

// ---- 2. Timeline ----------------------------------------------------------

const total = steps.length * HOLD;
const at = (seconds) => Math.min(1, Math.max(0, seconds / total));
const num = (n) => (Math.round(n * 100) / 100).toString();
const boxValue = (b) => [b.x, b.y, b.width, b.height].map(num).join(" ");

// Camera: tween within a diagram, cut across diagrams.
const camValues = [];
const camTimes = [];
const camSplines = [];
steps.forEach((s, i) => {
  const start = i * HOLD;
  const prev = steps[i - 1];
  const sameDiagram = prev && prev.diagram.key === s.diagram.key;
  if (i === 0) {
    camValues.push(boxValue(s.camera));
    camTimes.push(0);
  } else if (sameDiagram) {
    camValues.push(boxValue(prev.camera), boxValue(s.camera));
    camTimes.push(at(start), at(start + TWEEN));
    camSplines.push("0 0 1 1", "0.4 0 0.2 1");
  } else {
    camValues.push(boxValue(prev.camera), boxValue(s.camera));
    camTimes.push(at(start), at(start));
    camSplines.push("0 0 1 1", "0 0 1 1");
  }
});
camValues.push(boxValue(steps[steps.length - 1].camera));
camTimes.push(1);
camSplines.push("0 0 1 1");

// A 0/1 switch over the period, on for the given step indexes.
const discreteSwitch = (attr, onSteps) => {
  const values = [];
  const times = [];
  steps.forEach((s, i) => {
    values.push(onSteps.has(i) ? "1" : "0");
    times.push(at(i * HOLD));
  });
  return (
    `<animate attributeName="${attr}" calcMode="discrete" dur="${total}s" repeatCount="indefinite" ` +
    `values="${values.join(";")}" keyTimes="${times.map(num).join(";")}"/>`
  );
};

// ---- 3. Paint ---------------------------------------------------------------

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");

// Nest a rendered diagram at the stage origin, keeping its own coordinate space.
const nestDiagram = (d, onSteps) => {
  const inner = d.svg.replace(
    /^<svg[^>]*>/,
    `<svg x="0" y="0" width="${d.width}" height="${d.height}" viewBox="0 0 ${d.width} ${d.height}">`,
  );
  return `<g opacity="0">${discreteSwitch("opacity", onSteps)}${inner}</g>`;
};

const veilFor = (s) => {
  if (s.boxes.length === 0) return "";
  // One region: the union of everything the step points at, ringed once.
  const id = `veil-${s.index}`, u = union(s.boxes), m = 18;
  const region = `x="${num(u.x - m)}" y="${num(u.y - m)}" width="${num(u.width + 2 * m)}" height="${num(u.height + 2 * m)}" rx="14"`;
  const d = s.diagram;
  return (
    `<g opacity="0">${discreteSwitch("opacity", new Set([s.index]))}` +
    `<mask id="${id}" maskUnits="userSpaceOnUse" x="0" y="0" width="${d.width}" height="${d.height}">` +
    `<rect x="0" y="0" width="${d.width}" height="${d.height}" fill="#fff"/><rect ${region} fill="#000"/></mask>` +
    `<rect x="0" y="0" width="${d.width}" height="${d.height}" fill="${palette.background}" fill-opacity=".78" mask="url(#${id})"/>` +
    `<rect ${region} fill="none" stroke="${palette.muted}" stroke-width="1.5" stroke-opacity=".75"/></g>`
  );
};

const captionFor = (s) => {
  const y = STAGE.height;
  const counter = `${s.index + 1} / ${steps.length}`;
  return (
    `<g opacity="0">${discreteSwitch("opacity", new Set([s.index]))}` +
    `<text x="48" y="${y + 58}" font-size="30" font-weight="700" fill="${palette.foreground}">${esc(s.step.heading)}</text>` +
    `<text x="48" y="${y + 102}" font-size="21" fill="${palette.muted}">${esc(s.step.body)}</text>` +
    `<text x="${STAGE.width - 48}" y="${y + 58}" font-size="20" text-anchor="end" fill="${palette.muted}">${counter}</text>` +
    `</g>`
  );
};

// Which steps each diagram is on screen for.
const onScreen = new Map();
steps.forEach((s, i) => onScreen.set(s.diagram.key, (onScreen.get(s.diagram.key) ?? new Set()).add(i)));

// Progress bar across the caption: one linear sweep per loop.
const progress =
  `<rect x="0" y="${STAGE.height}" width="0" height="4" fill="${palette.added}">` +
  `<animate attributeName="width" dur="${total}s" repeatCount="indefinite" values="0;${STAGE.width}" keyTimes="0;1"/></rect>`;

const totalHeight = STAGE.height + CAPTION_HEIGHT;
const svg =
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${STAGE.width} ${totalHeight}" width="${STAGE.width}" height="${totalHeight}" role="img" aria-label="${esc(doc.title)}">` +
  `<title>${esc(doc.title)}</title>` +
  `<rect width="100%" height="100%" fill="${palette.background}"/>` +
  `<svg x="0" y="0" width="${STAGE.width}" height="${STAGE.height}" viewBox="${camValues[0]}" preserveAspectRatio="xMidYMid meet">` +
  `<animate attributeName="viewBox" dur="${total}s" repeatCount="indefinite" calcMode="spline" ` +
  `values="${camValues.join(";")}" keyTimes="${camTimes.map(num).join(";")}" keySplines="${camSplines.join(";")}"/>` +
  [...diagrams.values()].map((d) => nestDiagram(d, onScreen.get(d.key))).join("") +
  steps.map(veilFor).join("") +
  `</svg>` +
  `<line x1="0" y1="${STAGE.height}" x2="${STAGE.width}" y2="${STAGE.height}" stroke="${palette.cardBorder}"/>` +
  progress +
  `<g font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Noto Sans', Helvetica, Arial, sans-serif">` +
  steps.map(captionFor).join("") +
  `</g>` +
  `</svg>`;

mkdirSync(dirname(resolve(outPath)), { recursive: true });
writeFileSync(outPath, svg);
console.log(
  `wrote ${outPath}: ${steps.length} steps over ${total}s, ${diagrams.size} diagrams, ${Buffer.byteLength(svg)} bytes`,
);
steps.forEach((s) =>
  console.log(`  ${s.index + 1}. ${s.step.heading}  [${s.diagram.key}] focus=${s.boxes.length} camera=${boxValue(s.camera)}`),
);
