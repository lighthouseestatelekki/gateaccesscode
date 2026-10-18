// Shrinks a camera photo to a small JPEG (as text) so it can be saved with the record and
// shown at the gate quickly, even on slow data. A face photo ends up around 30–60 KB.

export async function photoToJpeg(file: File, maxSide = 640, maxChars = 380_000): Promise<string> {
  if (!/^image\//.test(file.type)) throw new Error("Please choose a photo.");
  const img = await loadImage(file);
  let side = maxSide;
  let quality = 0.78;
  for (let i = 0; i < 6; i++) {
    const scale = Math.min(1, side / Math.max(img.width, img.height));
    const w = Math.max(1, Math.round(img.width * scale));
    const h = Math.max(1, Math.round(img.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("This phone could not read the photo.");
    ctx.drawImage(img, 0, 0, w, h);
    const url = canvas.toDataURL("image/jpeg", quality);
    if (url.startsWith("data:image/jpeg") && url.length <= maxChars) return url;
    side = Math.round(side * 0.8);
    quality = Math.max(0.5, quality - 0.08);
  }
  throw new Error("The photo is too large. Please try again.");
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("This phone could not read the photo. Please try again."));
    };
    img.src = url;
  });
}
