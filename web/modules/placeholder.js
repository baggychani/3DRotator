export function createPlaceholderImage() {
  const placeholder = document.createElement("canvas");
  placeholder.width = 900;
  placeholder.height = 1100;

  const context = placeholder.getContext("2d");
  const gradient = context.createLinearGradient(0, 0, 900, 1100);
  gradient.addColorStop(0, "#fff3f8");
  gradient.addColorStop(1, "#dfe7ff");

  context.fillStyle = gradient;
  context.fillRect(0, 0, placeholder.width, placeholder.height);
  context.fillStyle = "#171927";
  context.font = "800 92px sans-serif";
  context.textAlign = "center";
  context.fillText("3D", 450, 480);
  context.font = "600 44px sans-serif";
  context.fillText("이미지를 선택하세요", 450, 575);

  return placeholder;
}
