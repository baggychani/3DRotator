import { projectPoint3d, rotatePoint3d } from "./geometry.js";

const BASE_CANVAS_WIDTH = 1080;
const FIT_MARGIN = 96;
const TAIL_OVERLAP = 10;
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

  const anchorX = -halfWidth + imageSize.width * (state.tailPosition / 100);
  const halfTailWidth = scaleValue(canvas, state.tailWidth) / 2;
  const baseY = halfHeight - scaleValue(canvas, TAIL_OVERLAP);
  const tip = {
    x: anchorX + scaleValue(canvas, state.tailLean),
    y: halfHeight + scaleValue(canvas, state.tailLength),
    z: 0,
  };
  const tailPath = [
    { x: anchorX - halfTailWidth, y: baseY, z: 0 },
    tip,
    { x: anchorX + halfTailWidth, y: baseY, z: 0 },
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

function fitSceneToCanvas(canvas, scene, state) {
  if (!state.fitToCanvas) {
    return scene;
  }

  const canvasCenter = { x: canvas.width / 2, y: canvas.height / 2 };
  const initialBounds = getContentBounds(canvas, scene, state);
  const fitMargin = scaleValue(canvas, FIT_MARGIN);
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

function drawShadow(context, canvas, scene, state) {
  if (!state.shadowEnabled || state.shadowAlpha <= 0) {
    return;
  }

  context.save();
  context.filter = `blur(${scaleValue(canvas, state.shadowBlur)}px)`;
  context.fillStyle = `rgba(0, 0, 0, ${state.shadowAlpha / 100})`;
  drawPath(context, offsetShadowPoints(canvas, scene.imageCorners, state));
  context.fill();

  if (scene.tailPath) {
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

function createShader(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    throw new Error(gl.getShaderInfoLog(shader) || "Shader compile failed.");
  }

  return shader;
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
    const gl = renderCanvas.getContext("webgl", {
      alpha: true,
      antialias: true,
      premultipliedAlpha: true,
      preserveDrawingBuffer: true,
    });

    if (!gl) {
      return null;
    }

    const program = createQuadProgram(gl);
    quadRenderer = {
      canvas: renderCanvas,
      gl,
      program,
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
  const textureCoordinates = [0, 0, 1, 0, 0, 1, 1, 0, 1, 1, 0, 1];
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
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
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

export function renderScene(canvas, image, state) {
  const context = canvas.getContext("2d");
  const localScene = createLocalScene(canvas, image, state);
  const projectedScene = projectScene(canvas, state, localScene);
  const fittedScene = fitSceneToCanvas(canvas, projectedScene, state);

  context.clearRect(0, 0, canvas.width, canvas.height);
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  drawShadow(context, canvas, fittedScene, state);
  drawTail(context, fittedScene, state);
  if (!drawImageWithQuadRenderer(context, canvas, image, fittedScene.imageCorners)) {
    drawImageWithAffineTransform(context, image, fittedScene.imageCorners);
  }
}
