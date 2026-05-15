import { projectPoint3d, rotatePoint3d } from "./geometry.js";

const BASE_CANVAS_WIDTH = 1080;
const FIT_MARGIN = 96;
const FIT_MARGIN_COMPACT = 132;
const TAIL_HANDLE_RADIUS = 20;
const TEXTURE_PADDING = 1;
const TAIL_OVERLAP = 10;
const paddedTextureSources = new WeakMap();
let quadRenderer;

function getRenderScale(canvas) {
  return canvas.width / BASE_CANVAS_WIDTH;
}

function scaleValue(canvas, value) {
  return value * getRenderScale(canvas);
}

function getImageSize(canvas, image, state) {
  const maxWidth = canvas.width * (state.scale / 100);
  const maxHeight = canvas.height * (state.scale / 100);
  const ratio = Math.min(maxWidth / image.width, maxHeight / image.height);

  return {
    width: image.width * ratio,
    height: image.height * ratio,
  };
}

function createLocalScene(canvas, image, state) {
  const imageSize = getImageSize(canvas, image, state);
  const halfWidth = imageSize.width / 2;
  const halfHeight = imageSize.height / 2;
  const imageCorners = [
    { x: -halfWidth, y: -halfHeight, z: 0 },
    { x: halfWidth, y: -halfHeight, z: 0 },
    { x: halfWidth, y: halfHeight, z: 0 },
    { x: -halfWidth, y: halfHeight, z: 0 },
  ];

  if (!state.tailEnabled) {
    return { imageCorners, tailPath: null };
  }

  const tailSide = ["top", "right", "bottom", "left"].includes(state.tailSide)
    ? state.tailSide
    : "bottom";
  const localEdges = {
    top: {
      start: { x: -halfWidth, y: -halfHeight, z: 0 },
      end: { x: halfWidth, y: -halfHeight, z: 0 },
      outwardNormal: { x: 0, y: -1, z: 0 },
    },
    right: {
      start: { x: halfWidth, y: -halfHeight, z: 0 },
      end: { x: halfWidth, y: halfHeight, z: 0 },
      outwardNormal: { x: 1, y: 0, z: 0 },
    },
    bottom: {
      start: { x: -halfWidth, y: halfHeight, z: 0 },
      end: { x: halfWidth, y: halfHeight, z: 0 },
      outwardNormal: { x: 0, y: 1, z: 0 },
    },
    left: {
      start: { x: -halfWidth, y: -halfHeight, z: 0 },
      end: { x: -halfWidth, y: halfHeight, z: 0 },
      outwardNormal: { x: -1, y: 0, z: 0 },
    },
  };
  const selectedEdge = localEdges[tailSide];
  const edgeVector = {
    x: selectedEdge.end.x - selectedEdge.start.x,
    y: selectedEdge.end.y - selectedEdge.start.y,
    z: 0,
  };
  const anchor = {
    x: selectedEdge.start.x + edgeVector.x * (state.tailPosition / 100),
    y: selectedEdge.start.y + edgeVector.y * (state.tailPosition / 100),
    z: 0,
  };
  const edgeTangent = normalizeVector(edgeVector);
  const halfTailWidth = scaleValue(canvas, state.tailWidth) / 2;
  const overlap = scaleValue(canvas, TAIL_OVERLAP);
  const baseCenter = {
    x: anchor.x - selectedEdge.outwardNormal.x * overlap,
    y: anchor.y - selectedEdge.outwardNormal.y * overlap,
    z: 0,
  };
  const tip = {
    x:
      anchor.x +
      edgeTangent.x * scaleValue(canvas, state.tailLean) +
      selectedEdge.outwardNormal.x * scaleValue(canvas, state.tailLength),
    y:
      anchor.y +
      edgeTangent.y * scaleValue(canvas, state.tailLean) +
      selectedEdge.outwardNormal.y * scaleValue(canvas, state.tailLength),
    z: 0,
  };
  const tailPath = [
    {
      x: baseCenter.x - edgeTangent.x * halfTailWidth,
      y: baseCenter.y - edgeTangent.y * halfTailWidth,
      z: 0,
    },
    tip,
    {
      x: baseCenter.x + edgeTangent.x * halfTailWidth,
      y: baseCenter.y + edgeTangent.y * halfTailWidth,
      z: 0,
    },
  ];

  return { imageCorners, tailPath };
}

function projectLocalPoint(canvas, state, point) {
  const rotation = { x: state.rotateX, y: state.rotateY, z: state.rotateZ };
  const viewport = { width: canvas.width, height: canvas.height };
  const perspective = scaleValue(canvas, state.perspective);
  const rotatedPoint = rotatePoint3d(point, rotation);

  return {
    ...projectPoint3d(rotatedPoint, viewport, perspective),
    z: rotatedPoint.z,
    depth: Math.max(scaleValue(canvas, 80), perspective - rotatedPoint.z),
  };
}

function projectScene(canvas, state, localScene) {
  return {
    imageCorners: localScene.imageCorners.map((point) => projectLocalPoint(canvas, state, point)),
    tailPath: localScene.tailPath?.map((point) => projectLocalPoint(canvas, state, point)) ?? null,
  };
}

function drawPath(context, points) {
  context.beginPath();
  context.moveTo(points[0].x, points[0].y);
  for (const point of points.slice(1)) {
    context.lineTo(point.x, point.y);
  }
  context.closePath();
}

function offsetShadowPoints(canvas, points, state) {
  return points.map((point, index) => ({
    ...point,
    x:
      point.x +
      scaleValue(canvas, state.shadowX) +
      (index >= 2 ? scaleValue(canvas, state.shadowSkew) : 0),
    y: point.y + scaleValue(canvas, state.shadowY),
  }));
}

function getBounds(pointGroups, padding = 0) {
  const points = pointGroups.filter(Boolean).flat();
  const bounds = {
    minX: Math.min(...points.map((point) => point.x)) - padding,
    minY: Math.min(...points.map((point) => point.y)) - padding,
    maxX: Math.max(...points.map((point) => point.x)) + padding,
    maxY: Math.max(...points.map((point) => point.y)) + padding,
  };

  return {
    ...bounds,
    width: bounds.maxX - bounds.minX,
    height: bounds.maxY - bounds.minY,
  };
}

function scalePoints(points, centerPoint, scale) {
  return points?.map((point) => ({
    ...point,
    x: centerPoint.x + (point.x - centerPoint.x) * scale,
    y: centerPoint.y + (point.y - centerPoint.y) * scale,
  }));
}

function translatePoints(points, offset) {
  return points?.map((point) => ({
    ...point,
    x: point.x + offset.x,
    y: point.y + offset.y,
  }));
}

function getContentBounds(canvas, scene, state) {
  return getBounds(
    [
      scene.imageCorners,
      scene.tailPath,
      offsetShadowPoints(canvas, scene.imageCorners, state),
      scene.tailPath ? offsetShadowPoints(canvas, scene.tailPath, state) : null,
    ],
    scaleValue(canvas, state.shadowBlur),
  );
}

function getFitMarginForCanvas(canvas) {
  return canvas.width <= 1200 ? FIT_MARGIN_COMPACT : FIT_MARGIN;
}

function fitSceneToCanvas(canvas, scene, state) {
  const canvasCenter = { x: canvas.width / 2, y: canvas.height / 2 };
  const initialBounds = getContentBounds(canvas, scene, state);
  const fitMargin = scaleValue(canvas, getFitMarginForCanvas(canvas));
  const fitScale = Math.min(
    1,
    (canvas.width - fitMargin * 2) / initialBounds.width,
    (canvas.height - fitMargin * 2) / initialBounds.height,
  );
  let fittedScene = {
    imageCorners: scalePoints(scene.imageCorners, canvasCenter, fitScale),
    tailPath: scalePoints(scene.tailPath, canvasCenter, fitScale),
  };
  const fittedBounds = getContentBounds(canvas, fittedScene, state);
  const boundsCenter = {
    x: fittedBounds.minX + fittedBounds.width / 2,
    y: fittedBounds.minY + fittedBounds.height / 2,
  };
  const offset = {
    x: canvasCenter.x - boundsCenter.x,
    y: canvasCenter.y - boundsCenter.y,
  };

  fittedScene = {
    imageCorners: translatePoints(fittedScene.imageCorners, offset),
    tailPath: translatePoints(fittedScene.tailPath, offset),
  };

  return fittedScene;
}

function getFittedScene(canvas, image, state) {
  const localScene = createLocalScene(canvas, image, state);
  const projectedScene = projectScene(canvas, state, localScene);

  return fitSceneToCanvas(canvas, projectedScene, state);
}

function normalizeVector(vector) {
  const length = Math.hypot(vector.x, vector.y) || 1;

  return {
    x: vector.x / length,
    y: vector.y / length,
  };
}

function dotVectors(first, second) {
  return first.x * second.x + first.y * second.y;
}

function drawShadow(context, canvas, scene, state, image) {
  if (!state.shadowEnabled || state.shadowAlpha <= 0) {
    return;
  }

  context.save();
  context.filter = `blur(${scaleValue(canvas, state.shadowBlur)}px) brightness(0) opacity(${
    state.shadowAlpha / 100
  })`;

  const shadowCorners = offsetShadowPoints(canvas, scene.imageCorners, state);
  if (!drawImageWithQuadRenderer(context, canvas, image, shadowCorners)) {
    drawImageWithAffineTransform(context, image, shadowCorners);
  }

  if (scene.tailPath) {
    context.fillStyle = "black";
    drawPath(context, offsetShadowPoints(canvas, scene.tailPath, state));
    context.fill();
  }

  context.restore();
}

function drawTail(context, scene, state) {
  if (!scene.tailPath) {
    return;
  }

  context.save();
  context.fillStyle = state.tailColor;
  drawPath(context, scene.tailPath);
  context.fill();
  context.restore();
}

function drawTailHandle(context, canvas, scene) {
  if (!scene.tailPath) {
    return;
  }

  const tip = scene.tailPath[1];
  const radius = scaleValue(canvas, TAIL_HANDLE_RADIUS);

  context.save();
  context.beginPath();
  context.arc(tip.x, tip.y, radius, 0, Math.PI * 2);
  context.fillStyle = "rgba(142, 167, 255, 0.95)";
  context.strokeStyle = "rgba(16, 19, 29, 0.9)";
  context.lineWidth = Math.max(2, scaleValue(canvas, 2));
  context.fill();
  context.stroke();
  context.restore();
}

function createShader(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    throw new Error(gl.getShaderInfoLog(shader) || "Shader compile failed.");
  }

  return shader;
}

function getPaddedTextureSource(image) {
  if (paddedTextureSources.has(image)) {
    return paddedTextureSources.get(image);
  }

  const paddedCanvas = document.createElement("canvas");
  paddedCanvas.width = image.width + TEXTURE_PADDING * 2;
  paddedCanvas.height = image.height + TEXTURE_PADDING * 2;
  const paddedContext = paddedCanvas.getContext("2d");

  paddedContext.clearRect(0, 0, paddedCanvas.width, paddedCanvas.height);
  paddedContext.imageSmoothingEnabled = true;
  paddedContext.imageSmoothingQuality = "high";
  paddedContext.drawImage(image, TEXTURE_PADDING, TEXTURE_PADDING);
  paddedTextureSources.set(image, paddedCanvas);

  return paddedCanvas;
}

function getPaddedTextureCoordinates(image, textureSource) {
  const left = TEXTURE_PADDING / textureSource.width;
  const right = (TEXTURE_PADDING + image.width) / textureSource.width;
  const top = TEXTURE_PADDING / textureSource.height;
  const bottom = (TEXTURE_PADDING + image.height) / textureSource.height;

  return [left, top, right, top, left, bottom, right, top, right, bottom, left, bottom];
}

function createQuadProgram(gl) {
  const vertexShader = createShader(
    gl,
    gl.VERTEX_SHADER,
    `
      attribute vec2 a_position;
      attribute float a_depth;
      attribute vec2 a_texCoord;
      uniform vec2 u_resolution;
      varying vec2 v_texCoord;

      void main() {
        vec2 zeroToOne = a_position / u_resolution;
        vec2 clipSpace = zeroToOne * 2.0 - 1.0;
        gl_Position = vec4(clipSpace.x * a_depth, -clipSpace.y * a_depth, 0.0, a_depth);
        v_texCoord = a_texCoord;
      }
    `,
  );
  const fragmentShader = createShader(
    gl,
    gl.FRAGMENT_SHADER,
    `
      precision highp float;
      varying vec2 v_texCoord;
      uniform sampler2D u_image;

      void main() {
        gl_FragColor = texture2D(u_image, v_texCoord);
      }
    `,
  );
  const program = gl.createProgram();

  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error(gl.getProgramInfoLog(program) || "Program link failed.");
  }

  return program;
}

function getQuadRenderer(canvas) {
  if (!quadRenderer) {
    const renderCanvas = document.createElement("canvas");
    const contextOptions = {
      alpha: true,
      antialias: true,
      premultipliedAlpha: true,
      preserveDrawingBuffer: true,
    };
    const gl =
      renderCanvas.getContext("webgl2", contextOptions) ??
      renderCanvas.getContext("webgl", contextOptions);

    if (!gl) {
      return null;
    }

    const isWebGl2 =
      typeof WebGL2RenderingContext !== "undefined" && gl instanceof WebGL2RenderingContext;
    const program = createQuadProgram(gl);
    quadRenderer = {
      canvas: renderCanvas,
      isWebGl2,
      gl,
      program,
      anisotropyExtension:
        gl.getExtension("EXT_texture_filter_anisotropic") ??
        gl.getExtension("WEBKIT_EXT_texture_filter_anisotropic"),
      positionBuffer: gl.createBuffer(),
      depthBuffer: gl.createBuffer(),
      texCoordBuffer: gl.createBuffer(),
      positionLocation: gl.getAttribLocation(program, "a_position"),
      depthLocation: gl.getAttribLocation(program, "a_depth"),
      texCoordLocation: gl.getAttribLocation(program, "a_texCoord"),
      resolutionLocation: gl.getUniformLocation(program, "u_resolution"),
    };
  }

  if (quadRenderer.canvas.width !== canvas.width || quadRenderer.canvas.height !== canvas.height) {
    quadRenderer.canvas.width = canvas.width;
    quadRenderer.canvas.height = canvas.height;
  }

  return quadRenderer;
}

function drawImageWithQuadRenderer(context, canvas, image, imageCorners) {
  const renderer = getQuadRenderer(canvas);

  if (!renderer) {
    return false;
  }

  const { gl, program } = renderer;
  const topLeft = imageCorners[0];
  const topRight = imageCorners[1];
  const bottomRight = imageCorners[2];
  const bottomLeft = imageCorners[3];
  const positions = [
    topLeft.x,
    topLeft.y,
    topRight.x,
    topRight.y,
    bottomLeft.x,
    bottomLeft.y,
    topRight.x,
    topRight.y,
    bottomRight.x,
    bottomRight.y,
    bottomLeft.x,
    bottomLeft.y,
  ];
  const depths = [
    topLeft.depth,
    topRight.depth,
    bottomLeft.depth,
    topRight.depth,
    bottomRight.depth,
    bottomLeft.depth,
  ];
  const textureSource = getPaddedTextureSource(image);
  const textureCoordinates = getPaddedTextureCoordinates(image, textureSource);
  const texture = gl.createTexture();

  gl.viewport(0, 0, canvas.width, canvas.height);
  gl.clearColor(0, 0, 0, 0);
  gl.clear(gl.COLOR_BUFFER_BIT);
  gl.useProgram(program);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

  gl.bindBuffer(gl.ARRAY_BUFFER, renderer.positionBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(renderer.positionLocation);
  gl.vertexAttribPointer(renderer.positionLocation, 2, gl.FLOAT, false, 0, 0);

  gl.bindBuffer(gl.ARRAY_BUFFER, renderer.depthBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(depths), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(renderer.depthLocation);
  gl.vertexAttribPointer(renderer.depthLocation, 1, gl.FLOAT, false, 0, 0);

  gl.bindBuffer(gl.ARRAY_BUFFER, renderer.texCoordBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(textureCoordinates), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(renderer.texCoordLocation);
  gl.vertexAttribPointer(renderer.texCoordLocation, 2, gl.FLOAT, false, 0, 0);

  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, textureSource);

  if (renderer.isWebGl2) {
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.generateMipmap(gl.TEXTURE_2D);

    if (renderer.anisotropyExtension) {
      const maxAnisotropy = gl.getParameter(
        renderer.anisotropyExtension.MAX_TEXTURE_MAX_ANISOTROPY_EXT,
      );
      gl.texParameterf(
        gl.TEXTURE_2D,
        renderer.anisotropyExtension.TEXTURE_MAX_ANISOTROPY_EXT,
        maxAnisotropy,
      );
    }
  } else {
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  }

  gl.uniform2f(renderer.resolutionLocation, canvas.width, canvas.height);
  gl.drawArrays(gl.TRIANGLES, 0, 6);
  gl.deleteTexture(texture);

  context.drawImage(renderer.canvas, 0, 0);
  return true;
}

function drawImageWithAffineTransform(context, image, imageCorners) {
  const topLeft = imageCorners[0];
  const topRight = imageCorners[1];
  const bottomLeft = imageCorners[3];
  const transformA = (topRight.x - topLeft.x) / image.width;
  const transformB = (topRight.y - topLeft.y) / image.width;
  const transformC = (bottomLeft.x - topLeft.x) / image.height;
  const transformD = (bottomLeft.y - topLeft.y) / image.height;

  context.save();
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.setTransform(transformA, transformB, transformC, transformD, topLeft.x, topLeft.y);
  context.drawImage(image, 0, 0);
  context.restore();
}

export function getTailHandlePoint(canvas, image, state) {
  if (!state.tailEnabled) {
    return null;
  }

  const scene = getFittedScene(canvas, image, state);

  return scene.tailPath?.[1] ?? null;
}

export function getTailAttachmentInfo(canvas, image, state) {
  if (!state.tailEnabled) {
    return null;
  }

  const scene = getFittedScene(canvas, image, state);
  const sideToCornerIndexes = {
    top: [0, 1],
    right: [1, 2],
    bottom: [3, 2],
    left: [0, 3],
  };
  const [startIndex, endIndex] = sideToCornerIndexes[state.tailSide] ?? sideToCornerIndexes.bottom;
  const edgeStart = scene.imageCorners[startIndex];
  const edgeEnd = scene.imageCorners[endIndex];
  const edge = normalizeVector({
    x: edgeEnd.x - edgeStart.x,
    y: edgeEnd.y - edgeStart.y,
  });
  const edgeVector = {
    x: edgeEnd.x - edgeStart.x,
    y: edgeEnd.y - edgeStart.y,
  };
  const imageCenter = {
    x: scene.imageCorners.reduce((sum, corner) => sum + corner.x, 0) / scene.imageCorners.length,
    y: scene.imageCorners.reduce((sum, corner) => sum + corner.y, 0) / scene.imageCorners.length,
  };
  const anchor = {
    x: edgeStart.x + edgeVector.x * (state.tailPosition / 100),
    y: edgeStart.y + edgeVector.y * (state.tailPosition / 100),
  };
  const inwardCandidates = [
    normalizeVector({ x: -edge.y, y: edge.x }),
    normalizeVector({ x: edge.y, y: -edge.x }),
  ];
  const toCenterVector = { x: imageCenter.x - anchor.x, y: imageCenter.y - anchor.y };
  const inwardNormal =
    dotVectors(inwardCandidates[0], toCenterVector) > dotVectors(inwardCandidates[1], toCenterVector)
      ? inwardCandidates[0]
      : inwardCandidates[1];

  return { anchor, inwardNormal };
}

export function getTailDragValues(canvas, image, state, canvasPoint) {
  const scene = getFittedScene(canvas, image, state);

  if (!scene.tailPath) {
    return null;
  }

  const sideToCornerIndexes = {
    top: [0, 1],
    right: [1, 2],
    bottom: [3, 2],
    left: [0, 3],
  };
  const [startIndex, endIndex] = sideToCornerIndexes[state.tailSide] ?? sideToCornerIndexes.bottom;
  const edgeStart = scene.imageCorners[startIndex];
  const edgeEnd = scene.imageCorners[endIndex];
  const edge = normalizeVector({
    x: edgeEnd.x - edgeStart.x,
    y: edgeEnd.y - edgeStart.y,
  });
  const edgeVector = {
    x: edgeEnd.x - edgeStart.x,
    y: edgeEnd.y - edgeStart.y,
  };
  const imageCenter = {
    x: scene.imageCorners.reduce((sum, corner) => sum + corner.x, 0) / scene.imageCorners.length,
    y: scene.imageCorners.reduce((sum, corner) => sum + corner.y, 0) / scene.imageCorners.length,
  };
  const anchor = {
    x: edgeStart.x + edgeVector.x * (state.tailPosition / 100),
    y: edgeStart.y + edgeVector.y * (state.tailPosition / 100),
  };
  const normalCandidates = [
    normalizeVector({ x: -edge.y, y: edge.x }),
    normalizeVector({ x: edge.y, y: -edge.x }),
  ];
  const toCenterVector = { x: imageCenter.x - anchor.x, y: imageCenter.y - anchor.y };
  const outwardNormal =
    dotVectors(normalCandidates[0], toCenterVector) < dotVectors(normalCandidates[1], toCenterVector)
      ? normalCandidates[0]
      : normalCandidates[1];
  const tipVector = {
    x: canvasPoint.x - anchor.x,
    y: canvasPoint.y - anchor.y,
  };

  return {
    tailLean: dotVectors(tipVector, edge) / getRenderScale(canvas),
    tailLength: dotVectors(tipVector, outwardNormal) / getRenderScale(canvas),
  };
}

export function renderScene(canvas, image, state, options = {}) {
  const context = canvas.getContext("2d");
  const fittedScene = getFittedScene(canvas, image, state);

  context.clearRect(0, 0, canvas.width, canvas.height);
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  drawShadow(context, canvas, fittedScene, state, image);
  drawTail(context, fittedScene, state);
  if (!drawImageWithQuadRenderer(context, canvas, image, fittedScene.imageCorners)) {
    drawImageWithAffineTransform(context, image, fittedScene.imageCorners);
  }
  if (options.showTailHandle !== false) {
    drawTailHandle(context, canvas, fittedScene);
  }
}
