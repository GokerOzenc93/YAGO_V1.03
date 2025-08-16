import opencascade from "opencascade.js/dist/opencascade.full.js";
import opencascadeWasm from "opencascade.js/dist/opencascade.full.wasm?url";

// OpenCascade.js'in sadece bir kez başlatılmasını sağlamak için bir promise değişkeni
let ocPromise: Promise<any> | null = null;

/**
 * OpenCascade.js'i başlatan ve promise döndüren fonksiyon.
 * Bu fonksiyon birden çok kez çağrılsa bile, başlatma işlemi sadece bir kez çalışır.
 */
export const initOpenCascade = () => {
  if (!ocPromise) {
    // @ts-ignore
    ocPromise = opencascade({
      locateFile: () => opencascadeWasm,
    });
  }
  return ocPromise;
};

// OpenCascade instance tipi
export type OpenCascadeInstance = Awaited<ReturnType<typeof initOpenCascade>>;
