// STEP 1 — utility multipart centralizzata
// Sostituisce i buildFormData duplicati in ogni modulo API

const MAX_SIZE_MB = 15;

/**
 * Comprime un'immagine via Canvas API (nessuna dipendenza npm).
 * Se il file è < 1.5 MB lo restituisce invariato.
 */
export async function compressImage(file, maxPx = 2000, quality = 0.82) {
  if (file.size < 1.5 * 1024 * 1024) return file;
  return new Promise(resolve => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;
      if (Math.max(width, height) > maxPx) {
        const r = maxPx / Math.max(width, height);
        width = Math.round(width * r);
        height = Math.round(height * r);
      }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      canvas.getContext("2d").drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        blob =>
          resolve(
            new File([blob], file.name.replace(/\.[^.]+$/, ".jpg"), {
              type: "image/jpeg",
            }),
          ),
        "image/jpeg",
        quality,
      );
    };
    img.src = url;
  });
}

/**
 * Costruisce il FormData con supporto multi-immagine.
 * @param {object}  data      – payload JSON
 * @param {File[]}  files     – nuove immagini (già compresse)
 * @param {string}  fieldName – nome campo multipart (default "images")
 */
export function buildMultipartForm(data, files = [], fieldName = "images") {
  const fd = new FormData();
  fd.append("data", new Blob([JSON.stringify(data)], { type: "application/json" }));

  for (const file of files) {
    if (!file.type.startsWith("image/")) throw new Error(`File non valido: ${file.name}`);
    if (file.size > MAX_SIZE_MB * 1024 * 1024)
      throw new Error(`${file.name} supera i ${MAX_SIZE_MB}MB`);
    fd.append(fieldName, file);
  }
  return fd;
}
