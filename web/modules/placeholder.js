export function createPlaceholderImage() {
  const placeholder = document.createElement("canvas");
  const w = 980;
  const h = 930;
  placeholder.width = w;
  placeholder.height = h;

  const context = placeholder.getContext("2d");
  const gradient = context.createLinearGradient(0, 0, w, h);
  gradient.addColorStop(0, "#fff3f8");
  gradient.addColorStop(1, "#dfe7ff");

  context.fillStyle = gradient;
  context.fillRect(0, 0, w, h);
  context.fillStyle = "#171927";
  context.font = "800 88px sans-serif";
  context.textAlign = "center";
  context.fillText("3D", w / 2, h * 0.44);
  context.font = "600 42px sans-serif";
  context.fillText("이미지를 선택하세요", w / 2, h * 0.54);

  return placeholder;
}
