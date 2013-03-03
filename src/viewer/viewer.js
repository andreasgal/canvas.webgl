var canvas = document.getElementById("Canvas");
var canvasWebGL = document.getElementById("Canvas.WebGL");

var canvasFPS = document.getElementById("Canvas.FPS");
var canvasWebGLFPS = document.getElementById("Canvas.WebGL.FPS");


function animate(test) {
  var speed = 1000 / 10;
  window.setTimeout(function tick() {
    if (test()) {
      window.setTimeout(tick, speed);
    }
  }, speed);
}

function time(fn, count) {
  var start = performance.now();
  for (var i = 0; i < count; i++) {
    fn();
  }
  return performance.now() - start;
}

var canvasContext = canvas.getContext("2d");
if (window.devicePixelRatio == 2) {
  canvas.width *= window.devicePixelRatio;
  canvas.height *= window.devicePixelRatio;
  canvas.style.width = (canvas.width / window.devicePixelRatio) + "px";
  canvas.style.height = (canvas.height / window.devicePixelRatio) + "px";
  canvasContext.scale(2, 2);
}


function randomColor() {
  return '#' + (Math.random() * 0xFFFFFF << 0).toString(16);
}

function randomGrayColor() {
  var color = Math.random() * 0xFF;
  return '#' + (color << 16 | color << 8 | color).toString(16);
}

var LIGHT_GRAY = "#DDDDDD";
var DARK_GRAY = "#222222";

function random(max) {
  return (Math.random() * max) | 0;
}

function randomDelta(max) {
  return (max - (Math.random() * max * 2)) | 0;
}

function randomPoint(padding) {
  if (padding === undefined) {
    padding = 0;
  }
  return {x: padding + random(canvas.width - padding * 2), y: padding + random(canvas.height - padding * 2)};
}

function randomLine(padding) {
  return {a: randomPoint(padding), b: randomPoint(padding)};
}

canvasContext.lineWidth = 1;
canvasContext.lineJoin = 'bevel';

function checkSegmentIntersection(a, b, c, d) {
  var s1_x = b.x - a.x;
  var s1_y = b.y - a.y;
  var s2_x = d.x - c.x;
  var s2_y = d.y - c.y;

  var d = (-s2_x * s1_y + s1_x * s2_y);
  var s = (-s1_y * (a.x - c.x) + s1_x * (a.y - c.y)) / d;
  var t = ( s2_x * (a.y - c.y) - s2_y * (a.x - c.x)) / d;

  // if (s >= 0 && s <= 1 && t >= 0 && t <= 1) {
  if (s > 0 && s < 1 && t > 0 && t < 1) {
    // *i_x = p0_x + (t * s1_x);
    // *i_y = p0_y + (t * s1_y);
    return true;
  }
  return false;
}

function randomPolygon(count) {
  assert (count >= 3);
  var points = [];
  for (var i = 0; i < count; i++) {
    points.push(randomPoint(50));
  }
  points.sort(function (a, b) {
    return a.x - b.x;
  });
  var min = points[0];
  var max = points[points.length - 1];
  var below = [];
  var polygon = [min];
  for (var i = 1; i < points.length - 1; i++) {
    var p = points[i];
    if (isPointLeftOfLine(min, max, p)) {
      polygon.push(p);
    } else {
      below.push(p);
    }
  }
  var polygon = polygon.concat([max]).concat(below.reverse()).concat([min]);
  // perturbPolygon(polygon, 10, 50);
  assert (polygon.length === count + 1);
  return polygon;
}

function perturbPolygon(polygon, count, delta) {
  while (count-- > 0) {
    var found = false;
    while (!found) {
      var i = 1 + random(polygon.length - 2);
      var l = polygon[i - 1];
      var p = polygon[i];
      var r = polygon[i + 1];
      var n = {x: p.x + randomDelta(delta), y: p.y + randomDelta(delta)};

      found = true;
      for (var j = 0; j < polygon.length - 1; j++) {
        if (j > i - 1 && j < i + 1) {
          continue;
        }
        var a = polygon[j];
        var b = polygon[j + 1];
        if (checkSegmentIntersection(a, b, l, n) ||
            checkSegmentIntersection(a, b, r, n)) {
          found = false;
          break;
        }
      }
      if (found) {
        console.info("PERTURBED");
        polygon[i] = n;
      }
    }
  }
}

function isPointLeftOfLine(a, b, p) {
  return ((b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x)) > 0;
}

function isPointAbove(p, q) {
  return p.y > q.y || p.y === q.y && p.x < q.x;
}

function isPointBelow(p, q) {
  return p.y < q.y || p.y === q.y && p.x > q.x;
}

function polyline(points, width) {
  assert (points.length === 3);
}

function drawPath() {
  var points = [];
  for (var i = 0; i < 4; i++) {
    points.push(randomPoint());
  }
  points.push(points[0]);

  // points = randomPolygon(100);
  points = polyline([
    {x: 10, y: 10},
    {x: 100, y: 100},
    {x: 200, y: 10}
  ]);

  canvasContext.fillStyle = "rgba(100,100,100,0.5)";
  canvasContext.strokeStyle = "#000000";
  canvasContext.beginPath();
  canvasContext.moveTo(points[0].x, points[0].y);
  for (var i = 1; i < points.length; i ++) {
    canvasContext.lineTo(points[i].x, points[i].y);
  }
  canvasContext.stroke();
  canvasContext.fill();

  canvasContext.fillStyle = "#000000";
  canvasContext.beginPath();
  for (var i = 0; i < points.length; i ++) {
    canvasContext.arc(points[i].x, points[i].y, 2, 0, 2 * Math.PI, true);
  }
  canvasContext.fill();

  var loop = [];
  for (var i = 0; i < points.length; i++) {
    loop.push(points[i].x);
    loop.push(points[i].y);
  }


  var tess = tessellate([loop]);

  var vertices = tess.vertices;
  canvasContext.fillStyle = "rgba(255,0,0,1)";
  canvasContext.beginPath();
  for (var i = 0; i < vertices.length; i += 2) {
    canvasContext.arc(vertices[i], vertices[i + 1], 2, 0, 2 * Math.PI, true);
  }
  canvasContext.fill();



  var triangles = tess.triangles;
  canvasContext.beginPath();
  for (var i = 0; i < triangles.length; i += 3) {
    var v0 = triangles[i] * 2;
    var v1 = triangles[i + 1] * 2;
    var v2 = triangles[i + 2] * 2;
    canvasContext.moveTo(vertices[v0], vertices[v0 + 1]);
    canvasContext.lineTo(vertices[v1], vertices[v1 + 1]);
    canvasContext.lineTo(vertices[v2], vertices[v2 + 1]);
  }
  canvasContext.stroke();

  /*
  canvasContext.fillStyle = "#000000";
  canvasContext.beginPath();
  for (var i = 0; i < points.length; i ++) {
    canvasContext.arc(points[i].x, points[i].y, 2, 0, 2 * Math.PI, true);
  }
  canvasContext.fill();
  */
}

// drawPath();

/*
var canvasWebGLContext = canvasWebGL.getContext("2d.gl");

[canvasContext, canvasWebGLContext].forEach(function (context) {
  var t = time(function () {
    var p = randomPoint();
    var w = random(50), h = random(50);
    context.fillRect(p.x, p.y, w, h);
  }, 10000);
  console.info("Took: " + t);
});

*/

canvas.onmousemove = function (m) {
  var ctx = canvasContext;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.beginPath();
  ctx.lineWidth = 30;
  var points = [new Vector(100, 100)];
  points.push(new Vector(m.layerX, m.layerY));
  points.push(new Vector(100, 200));
  points.push(new Vector(200, 200));
  points.push(new Vector(300, 200));
  points.push(new Vector(300, 300));
  points.push(new Vector(400, 100));
  ctx.moveTo(points[0].x, points[0].y);
  for (var i = 1; i < points.length; i++) {
    ctx.lineTo(points[i].x, points[i].y);
  }
  canvasContext.strokeStyle = "#000000";
  ctx.stroke();

  stroke(move(points, new Vector(0, 300)), 30);


  var radius = m.layerY;
  ctx.lineWidth = 30;
  ctx.beginPath();
  ctx.arc(100, 100, radius, 0, Math.PI * 2, true);
  ctx.stroke();


  var outer = circle({x: 100, y: 300}, radius + 30 / 2, radius);
  var inner = circle({x: 100, y: 300}, radius - 30 / 2, radius);

  var loops = [vertexBuffer(outer), vertexBuffer(inner.reverse())];
  drawTesselation(loops);
  // drawLines(seg, true);
};

function circle(center, radius, count) {
  var slice = 2 * Math.PI / count;
  var points = [];
  for (var i = 0; i < count; i++) {
    points.push({
      x: center.x + radius * Math.cos(slice * i),
      y: center.y + radius * Math.sin(slice * i),
    });
  }
  return points;
}

function move(polyline, o) {
  return polyline.map(function (v) {
    return v.add(o);
  });
}

function strokeSegment(a, b, width) {
  var radius = width / 2;
  var normal = b.subtract(a).perpendicular().normalize();
  var up = normal.multiply(radius);
  var down = normal.multiply(-radius);
  return [
    a.add(up),
    b.add(up),
    b.add(down),
    a.add(down)
  ];
}

function vertexBuffer(vertices) {
  var buffer = new Float32Array(vertices.length * 2);
  for (var i = 0; i < vertices.length; i++) {
    buffer[i * 2] = vertices[i].x;
    buffer[i * 2 + 1] = vertices[i].y;
  }
  return buffer;
}

function scale(a, x) {
  return a.map(function (y) {
    return y * x;
  });
}

function stroke(p, width) {
  var loops = [];
  for (var i = 0; i < p.length - 1; i++) {
    var stroke = strokeSegment(p[i], p[i + 1], width);
    stroke.push(stroke[0]);
    loops.push(vertexBuffer(stroke));
  }

  // console.log(tessellate([[0,0,3,0,3,3,0,3],[1,1,2,1,2,2,1,2]]));

  drawTesselation(loops);
  // drawTesselation([[0,0,300,0,300,300,0,300],[100,100,200,100,200,200,100,200]]);

  /*
  drawTesselation([
    [0,0,300,0,300,300,0,300],
    [100,100,400,0,400,400,0,400]
  ]);
  */


  // drawTesselation([scale([0,0,3,0,3,3,0,3], 100), scale([1,1,1,2,2,2,2,1], 100)]);

  /*
  drawTesselation([[0,0,1,5,2,0,-1,3,3,3].map(function (x) {
    return 100 + x * 100;
  })]);
  */
}

function drawTesselation(loops) {
  var tess = tessellate(loops);
  var vertices = tess.vertices;
  var triangles = tess.triangles;
  canvasContext.lineWidth = 1;
  canvasContext.strokeStyle = "rgba(200, 200, 200, 0.5)";

  for (var i = 0; i < triangles.length; i += 3) {
    var v0 = triangles[i] * 2;
    var v1 = triangles[i + 1] * 2;
    var v2 = triangles[i + 2] * 2;
    canvasContext.beginPath();
    canvasContext.moveTo(vertices[v0], vertices[v0 + 1]);
    canvasContext.lineTo(vertices[v1], vertices[v1 + 1]);
    canvasContext.lineTo(vertices[v2], vertices[v2 + 1]);
    canvasContext.lineTo(vertices[v0], vertices[v0 + 1]);
    canvasContext.fillStyle = DARK_GRAY;
    canvasContext.fill();
    canvasContext.stroke();
  }

}

function stroke2(p, width) {
  // var segment = strokeSegment(p[0], p[1], width);
  // drawLines(strokeSegment(p[0], p[1], width), true);

  var accumulator;
  for (var i = 0; i < p.length - 1; i++) {
    var stroke = strokeSegment(p[i], p[i + 1], width);
    var polygon = [{isHole: false, vertices: stroke}];
    if (accumulator) {
      accumulator = gpc.clip(accumulator, 3, polygon);
    } else {
      accumulator = polygon;
    }
  }

  for (var i = 0; i < accumulator.length; i++) {
    drawLines(accumulator[i].vertices, true);
  }



  // vertices.push(vertices[0]);

  // canvasContext.strokeStyle = "#000000";
  canvasContext.strokeStyle = "rgba(255, 0, 0, 0.5)";

  for (var c = 0; c < accumulator.length; c++) {
    var vertices = accumulator[c].vertices;
    var loop = [];
    for (var i = 0; i < vertices.length; i++) {
      loop.push(vertices[i].x);
      loop.push(vertices[i].y);
    }

    var tess = tessellate([loop]);
    // console.info(tess);
    var vertices = tess.vertices;
    var triangles = tess.triangles;
    canvasContext.beginPath();
    for (var i = 0; i < triangles.length; i += 3) {
      var v0 = triangles[i] * 2;
      var v1 = triangles[i + 1] * 2;
      var v2 = triangles[i + 2] * 2;
      canvasContext.moveTo(vertices[v0], vertices[v0 + 1]);
      canvasContext.lineTo(vertices[v1], vertices[v1 + 1]);
      canvasContext.lineTo(vertices[v2], vertices[v2 + 1]);
    }
    canvasContext.stroke();
  }

  /*
  var polygon = [];
  for (var i = 0; i < p.length - 1; i++) {
    var stroke = strokeSegment(p[i], p[i + 1], width);

    drawLines(strokeSegment(p[i], p[i + 1], width), true);
  }
  */


  /*
  var polygon = [];

  // for (var i = 0; i < p.length - 2; i++) {
  for (var i = 0; i < 1; i++) {
    var a = p[i];
    var b = p[i + 1];
    var c = p[i + 2];

    var ab = strokeSegment(a, b, width);
    var bc = strokeSegment(b, c, width);

    polygon.push(ab[0]);

    // console.info(Vector.signedArea(a, b, c));

    // drawLines(move(ab, 0, 200), true);
    // drawLines(move(bc, 0, 200), true);
    // drawLines(strokeSegment(p[i], p[i + 1], width), true);
  }

  drawLines(polygon, true, new Vector(0, 200));
  */
}

function drawLines(p, close, offset) {
  var ctx = canvasContext;
  ctx.beginPath();
  ctx.lineWidth = 1;
  if (offset) {
    p = move(p, offset);
  }
  ctx.moveTo(p[0].x, p[0].y);
  for (var i = 1; i < p.length; i++) {
    ctx.lineTo(p[i].x, p[i].y);
  }
  if (close) {
    ctx.lineTo(p[0].x, p[0].y);
  }
  ctx.stroke();
}

var Vector = (function () {
  function constructor(x, y) {
    this.x = x;
    this.y = y;
  }
  constructor.prototype.perpendicular = function (clockwise) {
    if (clockwise) {
      return new Vector(-this.y, this.x);
    } else {
      return new Vector(this.y, -this.x);
    }
  };
  constructor.prototype.getLength = function () {
    return Math.sqrt(this.x * this.x + this.y * this.y);
  };
  constructor.prototype.add = function (v) {
    return new Vector(this.x + v.x, this.y + v.y);
  };
  constructor.prototype.subtract = function (v) {
    return new Vector(this.x - v.x, this.y - v.y);
  };
  constructor.prototype.multiply = function (z) {
    return new Vector(this.x * z, this.y * z);
  };
  constructor.prototype.normalize = function () {
    var length = this.getLength();
    return new Vector(this.x / length, this.y / length);
  };
  /**
   * < 0 if ab, bc form a left turn, 0 if colinear, or > 0 otherwise.
   */
  constructor.signedArea = function (a, b, c) {
    return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  };
  return constructor;
})();

function drawSegments() {
  var count = 5;
  var lines = [];
  for (var i = 0; i < count; i++) {
    lines.push(randomLine());
  }
  var ctx = canvasContext;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  lines.forEach(function (l) {
    ctx.beginPath();
    ctx.moveTo(l.a.x, l.a.y);
    ctx.lineTo(l.b.x, l.b.y);
    ctx.stroke();
  });

  findIntersections(lines);
}

function flipLinePoints(l) {
  if (comparePoints(l.a, l.b) > 0) {
    var t = l.a;
    l.a = l.b;
    l.b = t;
  }
}

function comparePoints(a, b) {
  var ax = a.x;
  var bx = b.x;
  if (ax === bx) {
    return a.y - b.y;
  }
  return ax - bx;
}

function findIntersections(lines) {
  var LEFT         = 0;
  var INTERSECTION = 1;
  var RIGHT        = 2;

  var eventQueue = new buckets.PriorityQueue(function (a, b) {
    return comparePoints(a.point, b.point);
  });

  lines.forEach(function (l) {
    flipLinePoints(l);
    eventQueue.enqueue({type: LEFT, line: l, point: l.a});
    eventQueue.enqueue({type: RIGHT, line: l, point: l.b});
  });

  while (!eventQueue.isEmpty()) {
    var event = eventQueue.dequeue();
    switch (event.type) {
      case LEFT:
        break;
      case INTERSECTION:
        break;
      case RIGHT:
        break;
    }
  }
}var Multiple = (function () {
  function constructor(contexts) {
    this.contexts = contexts;
  }

  function defineFunctionProxy(obj, name) {
    Object.defineProperty(obj, name, {
      value: function () {
        var args = arguments;
        this.contexts.forEach(function (c) {
          c[name].apply(c, args);
        })
      }
    });
  }

  function definePropertyProxy(obj, name) {
    Object.defineProperty(obj, name, {
      get: function () {
        return this.contexts[0][name];
      },
      set: function (v) {
        this.contexts.forEach(function (c) {
          c[name] = v;
        });
      }
    });
  }
  definePropertyProxy(constructor.prototype, 'strokeStyle');
  definePropertyProxy(constructor.prototype, 'fillStyle');
  definePropertyProxy(constructor.prototype, 'lineWidth');

  defineFunctionProxy(constructor.prototype, 'clearRect');
  defineFunctionProxy(constructor.prototype, 'fillRect');


  defineFunctionProxy(constructor.prototype, 'beginPath');
  defineFunctionProxy(constructor.prototype, 'moveTo');
  defineFunctionProxy(constructor.prototype, 'lineTo');
  defineFunctionProxy(constructor.prototype, 'stroke');
  return constructor;
})();