import { readFile, writeFile } from "node:fs/promises";
import { createCanvas, loadImage } from "@napi-rs/canvas";

const svg = await readFile(new URL("../public/pwa-icon.svg", import.meta.url));
const image = await loadImage(svg);

for (const size of [192, 512]) {
  const canvas = createCanvas(size, size);
  canvas.getContext("2d").drawImage(image, 0, 0, size, size);
  await writeFile(
    new URL(`../public/pwa-icon-${size}.png`, import.meta.url),
    canvas.toBuffer("image/png"),
  );
}
