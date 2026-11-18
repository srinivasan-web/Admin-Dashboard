import type { Product } from "../../api/catalog";

type Image = Product["images"][number];

export function productViews(images: Image[]) {
  const photos = images.filter((image) => image.type !== "360_frame");
  const frames = images
    .filter((image) => image.type === "360_frame")
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.id.localeCompare(b.id))
    .slice(0, 72);

  // A few gallery photographs do not represent a full turn of the real product.
  return { photos, frames, has360: frames.length >= 8 };
}
