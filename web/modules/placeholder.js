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

  const mx = w / 2;
  const my = h * 0.38;
  const frameR = Math.min(w, h) * 0.22;
  context.save();
  context.strokeStyle = "rgba(120, 135, 190, 0.35)";
  context.lineWidth = 3;
  context.setLineDash([10, 8]);
  context.beginPath();
  context.roundRect(mx - frameR * 1.15, my - frameR, frameR * 2.3, frameR * 2.1, 20);
  context.stroke();
  context.setLineDash([]);
  context.strokeStyle = "rgba(90, 105, 160, 0.22)";
  context.lineWidth = 2;
  context.beginPath();
  context.roundRect(mx - frameR * 1.0, my - frameR * 0.82, frameR * 2.0, frameR * 1.75, 16);
  context.stroke();

  context.fillStyle = "rgba(110, 125, 185, 0.18)";
  context.beginPath();
  context.moveTo(mx - frameR * 0.85, my + frameR * 0.55);
  context.lineTo(mx - frameR * 0.15, my - frameR * 0.05);
  context.lineTo(mx + frameR * 0.35, my + frameR * 0.25);
  context.lineTo(mx + frameR * 0.85, my - frameR * 0.35);
  context.lineTo(mx + frameR * 0.95, my + frameR * 0.62);
  context.closePath();
  context.fill();

  context.fillStyle = "rgba(150, 165, 215, 0.45)";
  context.beginPath();
  context.arc(mx - frameR * 0.55, my - frameR * 0.35, frameR * 0.12, 0, Math.PI * 2);
  context.fill();
  context.restore();

  context.fillStyle = "rgba(45, 50, 72, 0.5)";
  context.font = "600 26px ui-sans-serif, system-ui, sans-serif";
  context.textAlign = "center";
  context.fillText("탭하여 사진 추가", w / 2, h * 0.72);

  return placeholder;
}
