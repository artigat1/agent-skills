export { render, flattenViews, findView, paletteFor, THEMES } from "@coldtea/pr-lens-renderer";
import { flattenViews } from "@coldtea/pr-lens-renderer";

export function planWalkthrough(doc) {
  const views = flattenViews(doc.views);
  const flowViewFor = Object.create(null);
  views.forEach((view) => {
    if (view.lens === "data-flow" && view.scope.kind === "selection") {
      view.scope.flows.forEach((flow) => { if (!flowViewFor[flow]) flowViewFor[flow] = view.id; });
    }
  });

  const defaultView = views.find(({ defaultOpen }) => defaultOpen) ?? doc.views[0];
  let defaultStage = null;
  if (defaultView) defaultStage = { kind: "view", view: defaultView.id };
  else if (doc.lenses.includes("architecture") && doc.nodes.length) defaultStage = { kind: "lens", lens: "architecture" };
  else if (doc.flows.length) defaultStage = { kind: "flow", flow: doc.flows[0].id };
  const firstKey = defaultStage && stageKey(defaultStage, flowViewFor);
  let previousStage = null;
  const steps = (doc.walkthrough?.steps ?? []).map((step) => {
    const stage = step.stage ?? previousStage ?? defaultStage;
    previousStage = stage;
    return { step, stage, key: stage ? stageKey(stage, flowViewFor) : null };
  });
  return { views, flowViewFor, firstKey, steps };
}

function stageKey(stage, flowViewFor) {
  if (stage.kind === "view") return `view:${stage.view}`;
  if (stage.kind === "flow") return flowViewFor[stage.flow] ? `view:${flowViewFor[stage.flow]}` : `flow:${stage.flow}`;
  return `lens:${stage.lens}`;
}
