export function toRadians(degrees) {
  return (degrees * Math.PI) / 180;
}

export function mix(start, end, amount) {
  return start + (end - start) * amount;
}

export function mixPoints(startPoint, endPoint, amount) {
  return {
    x: mix(startPoint.x, endPoint.x, amount),
    y: mix(startPoint.y, endPoint.y, amount),
  };
}

export function normalizePoint(point) {
  const length = Math.hypot(point.x, point.y) || 1;
  return { x: point.x / length, y: point.y / length };
}

export function rotatePoint3d(point, rotation) {
  const rotateXRadians = toRadians(rotation.x);
  const rotateYRadians = toRadians(rotation.y);
  const rotateZRadians = toRadians(rotation.z);

  let { x, y, z } = point;

  let nextY = y * Math.cos(rotateXRadians) - z * Math.sin(rotateXRadians);
  let nextZ = y * Math.sin(rotateXRadians) + z * Math.cos(rotateXRadians);
  y = nextY;
  z = nextZ;

  let nextX = x * Math.cos(rotateYRadians) + z * Math.sin(rotateYRadians);
  nextZ = -x * Math.sin(rotateYRadians) + z * Math.cos(rotateYRadians);
  x = nextX;
  z = nextZ;

  nextX = x * Math.cos(rotateZRadians) - y * Math.sin(rotateZRadians);
  nextY = x * Math.sin(rotateZRadians) + y * Math.cos(rotateZRadians);

  return { x: nextX, y: nextY, z };
}

export function projectPoint3d(point, viewport, perspective) {
  const perspectiveScale = perspective / Math.max(80, perspective - point.z);

  return {
    x: viewport.width / 2 + point.x * perspectiveScale,
    y: viewport.height / 2 + point.y * perspectiveScale,
  };
}
