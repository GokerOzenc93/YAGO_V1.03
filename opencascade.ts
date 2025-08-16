import opencascade from "opencascade.js/dist/opencascade.full.js";
import opencascadeWasm from "opencascade.js/dist/opencascade.full.wasm?url";

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
export const oc = await opencascade({
  locateFile: () => opencascadeWasm,
});

export type OpenCascadeInstance = typeof oc;