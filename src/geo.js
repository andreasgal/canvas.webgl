/**
 * References:
 *
 * Adaptive Forward Differencing for Rendering Curves and Surfaces:
 *   http://cutebugs.net/files/curve/lien87.pdf
 *
 * High Quality Rendering of Two-Dimensional Continuous Curves:
 *  http://www.google.com/url?sa=t&rct=j&q=&esrc=s&source=web&cd=1&ved=0CDIQFjAA&url=http%3A%2F%2Fciteseerx.ist.psu.edu%2Fviewdoc%2Fdownload%3Fdoi%3D10.1.1.59.5375%26rep%3Drep1%26type%3Dpdf&ei=Z4Q6UY7ZJufaywH1iIBw&usg=AFQjCNGdjHY0GqwsdAGePRCH822lr8fzYw&bvm=bv.43287494,d.aWc&cad=rja
 *
 */

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
  constructor.prototype.divide = function (z) {
    return new Vector(this.x / z, this.y / z);
  };
  constructor.prototype.moveTo = function (v, s) {
    return new Vector(this.x + (v.x - this.x) * s, this.y + (v.y - this.y) * s);
  };
  constructor.prototype.distanceTo = function (v) {
    var dx = v.x - this.x;
    var dy = v.y - this.y;
    return Math.sqrt(dx * dx + dy * dy);
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

var CURVE_COLLINEARITY_EPSILON = 1e-30;
var DISTANCE_TOLERANCE = 0.1;

/**
 * Use de Casteljau's algorithm to recursively subdivide the bezier curve if it's not "flat" enough.
 */

function adaptiveBezierPoints(p0, p1, p2, p3, lineWidth) {
  var upper, lower;
  var halfLineWidth = lineWidth / 2;
  if (lineWidth) {
    upper = [];
    lower = [];
    var p0Normal = p1.subtract(p0).perpendicular().normalize();
    upper.push(p0.add(p0Normal.multiply(halfLineWidth)));
    lower.push(p0.add(p0Normal.multiply(-halfLineWidth)));
  }

  var path = [p0];
  var MAX_RECURSION_DEPTH = 10;

  function recur(p0, p1, p2, p3, points, depth) {

    var p01 = p0.moveTo(p1, 0.5);
    var p12 = p1.moveTo(p2, 0.5);
    var p23 = p2.moveTo(p3, 0.5);

    var p012 = p01.moveTo(p12, 0.5);
    var p123 = p12.moveTo(p23, 0.5);

    var p0123 = p012.moveTo(p123, 0.5);

    var dx = p3.x - p0.x;
    var dy = p3.y - p0.y;

    /**
     * d1, d2 is the distance from the line p0-p3 to p1 and p2 respectively.
     */
    var d1 = Math.abs((p1.x - p3.x) * dy - (p1.y - p3.y) * dx);
    var d2 = Math.abs((p2.x - p3.x) * dy - (p2.y - p3.y) * dx);

    if ((d1 + d2) * (d1 + d2) < DISTANCE_TOLERANCE * (dx * dx + dy * dy) || depth >= MAX_RECURSION_DEPTH) {
      points.push(p0123);
      p0123.depth = depth;
      if (lineWidth) {
        var normal = p0123.subtract(p012).perpendicular().normalize();
        upper.push(p0123.add(normal.multiply(halfLineWidth)));
        lower.push(p0123.add(normal.multiply(-halfLineWidth)));
      }
    } else {
      recur(p0, p01, p012, p0123, points, depth + 1);
      recur(p0123, p123, p23, p3, points, depth + 1);
    }
  }
  recur(p0, p1, p2, p3, path, 0);
  path.push(p3);
  if (lineWidth) {
    var p3Normal = p3.subtract(p2).perpendicular().normalize();
    upper.push(p3.add(p3Normal.multiply(halfLineWidth)));
    lower.push(p3.add(p3Normal.multiply(-halfLineWidth)));
  }
  return {
    path: path,
    upper: upper,
    lower: lower
  };
}

/**
 * Can't compute the length algebraically (only via integration) so approximate it
 * as the sum of the line segments p0-p1, p1-p2, p2-p3.
 */
function approximateBezierLength(p0, p1, p2, p3) {
  return p1.subtract(p0).getLength() +
         p2.subtract(p1).getLength() +
         p3.subtract(p2).getLength();
}

/**
 * If P(t) computes the bezier point at t, we can derive a function D(t) that computes the difference between
 * P(t) - P(t + h). The function D(t) is quadratic and it can be evaluated more efficiently. We can integrate
 * with P(t) = P(t - 1) + D(t) starting at P(0) which is known.
 */
function bezierPointsWithForwardDifferencing(p0, p1, p2, p3, count) {
  // http://antigrain.com/research/bezier_interpolation/index.html#PAGE_BEZIER_INTERPOLATION
  var dx0 = p1.x - p0.x;
  var dy0 = p1.y - p0.y;
  var dx1 = p2.x - p1.x;
  var dy1 = p2.y - p1.y;
  var dx2 = p3.x - p2.x;
  var dy2 = p3.y - p2.y;

  var subdivStep  = 1.0 / (count + 1);
  var subdivStep2 = subdivStep * subdivStep;
  var subdivStep3 = subdivStep * subdivStep * subdivStep;

  var pre1 = 3.0 * subdivStep;
  var pre2 = 3.0 * subdivStep2;
  var pre4 = 6.0 * subdivStep2;
  var pre5 = 6.0 * subdivStep3;

  var tmp1x = p0.x - p1.x * 2.0 + p2.x;
  var tmp1y = p0.y - p1.y * 2.0 + p2.y;

  var tmp2x = (p1.x - p2.x)*3.0 - p0.x + p3.x;
  var tmp2y = (p1.y - p2.y)*3.0 - p0.y + p3.y;

  var fx = p0.x;
  var fy = p0.y;

  var dfx = (p1.x - p0.x) * pre1 + tmp1x * pre2 + tmp2x * subdivStep3;
  var dfy = (p1.y - p0.y) * pre1 + tmp1y * pre2 + tmp2y * subdivStep3;

  var ddfx = tmp1x * pre4 + tmp2x * pre5;
  var ddfy = tmp1y * pre4 + tmp2y * pre5;

  var dddfx = tmp2x * pre5;
  var dddfy = tmp2y * pre5;

  var step = count;

  var points = [p0];
  while (step--) {
    fx   += dfx;
    fy   += dfy;
    dfx  += ddfx;
    dfy  += ddfy;
    ddfx += dddfx;
    ddfy += dddfy;
    points.push(new Vector(fx, fy));
  }
  points.push(p3);
  return points;
}

function bezierPointAt(p0, p1, p2, p3, t) {
  var tt = t * t;
  var m = 1 - t, mm = m * m;
  var a = mm * m;
  var b = 3 * mm * t;
  var c = 3 * m * tt;
  var d = tt * t;
  var x = a * p0.x + b * p1.x + c * p2.x + d * p3.x;
  var y = a * p0.y + b * p1.y + c * p2.y + d * p3.y;
  return new Vector(x, y);
}
