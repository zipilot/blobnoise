import * as core from "../../../packages/blobnoise/src/index";
import * as browser from "../../../packages/blobnoise/src/browser/index";
import * as exports from "../../../packages/blobnoise/src/export/index";

export const harness = { ...core, ...browser, ...exports, loadMedia: () => import("mediabunny") };
declare global {
  interface Window { blobnoise: typeof harness; }
}
window.blobnoise = harness;
