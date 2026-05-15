export function isPlaceholderImage(image) {
  return image instanceof HTMLCanvasElement && image.dataset.isPlaceholder === "true";
}

export function createPlaceholderImage() {
  const placeholder = document.createElement("canvas");
  const w = 980;
  const h = 930;
  placeholder.width = w;
  placeholder.height = h;
  placeholder.dataset.isPlaceholder = "true";

  const context = placeholder.getContext("2d");
  const gradient = context.createLinearGradient(0, 0, w, h * 1.05);
  gradient.addColorStop(0, "#fff8fc");
  gradient.addColorStop(0.55, "#eef2ff");
  gradient.addColorStop(1, "#e0e8ff");

  context.fillStyle = gradient;
  context.fillRect(0, 0, w, h);

  const cardInset = 72;
  context.save();
  context.strokeStyle = "rgba(118, 134, 195, 0.28)";
  context.lineWidth = 3;
  context.setLineDash([12, 12]);
  context.beginPath();
  context.roundRect(cardInset, cardInset, w - cardInset * 2, h - cardInset * 2, 42);
  context.stroke();
  context.restore();

  return placeholder;
}
