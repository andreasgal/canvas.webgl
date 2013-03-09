;var CanvasWebGLContext = CanvasWebGLContext || (function (document, undefined) {
  var nativeGetContext = HTMLCanvasElement.prototype.getContext;

  HTMLCanvasElement.prototype.getContext = function getContext(contextId, args) {
    if (contextId !== "2d.gl") {
      return nativeGetContext.call(this, contextId, args);
    }
    return new CanvasWebGLContext(this);
  };

  var colorCache;
  function parseColor(color) {
    if (!colorCache) {
      colorCache = Object.create(null);
    }
    if (colorCache[color]) {
      return colorCache[color];
    }
    // TODO: Obviously slow, but it will do for now.
    var span = document.createElement('span');
    document.body.appendChild(span);
    span.style.backgroundColor = color;
    var rgb = getComputedStyle(span).backgroundColor;
    document.body.removeChild(span);
    var m = /^rgb\((\d+), (\d+), (\d+)\)$/.exec(rgb);
    if (!m) m = /^rgba\((\d+), (\d+), (\d+), ([\d.]+)\)$/.exec(rgb);
    var result = new Float32Array(4);
    result[0] = parseFloat(m[1]) / 255;
    result[1] = parseFloat(m[2]) / 255;
    result[2] = parseFloat(m[3]) / 255;
    result[3] = m[4] ? parseFloat(m[4]) : 1;
    return colorCache[color] = result;
  }

  function rectangleVertices(w, h) {
    return new Float32Array([0, 0, w, 0, 0, h, 0, h, w, 0, w, h]);
  }

  function rectangleTextureCoordinates() {
    return new Float32Array([0, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1, 1]);
  }

  function transpose(r, c, m) {
    assert (r * c === m.length);
    var result = new Float32Array(m.length);
    for (var i = 0; i < r; i++) {
      for (var j = 0; j < c; j++) {
        result[j * r + i] = m[i * c + j];
      }
    }
    return result;
  }

  function makeTranslation(tx, ty) {
    return transpose(3, 3, [
      1, 0, tx,
      0, 1, ty,
      0, 0, 1
    ]);
  }

  function getLineStrokePolygon(a, b, width) {
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

  var shaderRoot = "../shaders/";

  var CanvasWebGLContext = (function () {
    function constructor(canvas) {
      this.canvas = canvas;
      this.width = canvas.width;
      this.height = canvas.height;
      assert (this.width && this.height && isPowerOfTwo(this.width) && isPowerOfTwo(this.height));
      var gl = this.gl = this.canvas.getContext("experimental-webgl", {
        preserveDrawingBuffer: true,
        antialias: true
      });
      assert (gl);

      this.vertexShader = this.createShaderFromFile(shaderRoot + "canvas.vert");
      this.fragmentShader = this.createShaderFromFile(shaderRoot + "identity.frag");
      this.curveFragmentShader = this.createShaderFromFile(shaderRoot + "curve.frag");

      this.program = this.createProgram([this.vertexShader, this.fragmentShader]);
      this.queryProgramAttributesAndUniforms(this.program);

      this.curveProgram = this.createProgram([this.vertexShader, this.curveFragmentShader]);
      this.queryProgramAttributesAndUniforms(this.curveProgram);

      gl.useProgram(this.program);
      gl.uniform2f(this.program.uniforms.uResolution.location, this.width, this.height);

      gl.useProgram(this.curveProgram);
      gl.uniform2f(this.curveProgram.uniforms.uResolution.location, this.width, this.height);

      this.lineWidth = 1;
      this.fillStyle = "#000000";
      this.strokeStyle = "#000000";


      var color = parseColor(this.fillStyle);
      gl.useProgram(this.program);
      gl.uniform4f(this.program.uniforms.uColor.location, color[0], color[1], color[2], color[3]);
      gl.uniformMatrix3fv(this.program.uniforms.uTransformMatrix.location, false, makeTranslation(0, 0));

      gl.useProgram(this.curveProgram);
      gl.uniform4f(this.curveProgram.uniforms.uColor.location, color[0], color[1], color[2], color[3]);
      gl.uniformMatrix3fv(this.curveProgram.uniforms.uTransformMatrix.location, false, makeTranslation(0, 0));
    }

    constructor.prototype.createShader = function createShader(shaderType, shaderSource) {
      var gl = this.gl;
      var shader = gl.createShader(shaderType);
      gl.shaderSource(shader, shaderSource);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        var lastError = gl.getShaderInfoLog(shader);
        unexpected("Cannot compile shader: " + lastError);
        gl.deleteShader(shader);
        return null;
      }
      return shader;
    };

    constructor.prototype.queryProgramAttributesAndUniforms = function queryProgramAttributesAndUniforms(program) {
      program.uniforms = {};
      program.attributes = {};

      var gl = this.gl;
      for (var i = 0, j = gl.getProgramParameter(program, gl.ACTIVE_ATTRIBUTES); i < j; i++) {
        var attribute = gl.getActiveAttrib(program, i);
        program.attributes[attribute.name] = attribute;
        attribute.location = gl.getAttribLocation(program, attribute.name);
      }
      for (var i = 0, j = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS); i < j; i++) {
        var uniform = gl.getActiveUniform(program, i);
        program.uniforms[uniform.name] = uniform;
        uniform.location = gl.getUniformLocation(program, uniform.name);
      }
    };

    constructor.prototype.createShaderFromFile = function createShaderFromFile(file) {
      var gl = this.gl;
      var request = new XMLHttpRequest();
      request.open("GET", file, false);
      request.send();
      assert (request.status === 200, "File : " + file + " not found.");
      var shaderType;
      if (file.endsWith(".vert")) {
        shaderType = gl.VERTEX_SHADER;
      } else if (file.endsWith(".frag")) {
        shaderType = gl.FRAGMENT_SHADER;
      } else {
        throw "Shader Type: not supported.";
      }
      return this.createShader(shaderType, request.responseText);
    };

    constructor.prototype.createProgram = function createProgram(shaders) {
      var gl = this.gl;
      var program = gl.createProgram();
      shaders.forEach(function (shader) {
        gl.attachShader(program, shader);
      });
      gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        var lastError = gl.getProgramInfoLog(program);
        unexpected("Cannot link program: " + lastError);
        gl.deleteProgram(program);
      }
      return program;
    };

    /*
    Object.defineProperty(constructor.prototype, "fillStyle", {
      get: function getFillStyle() {
        return this._fillStyle;
      },
      set: function setFillStyle(value) {
        this._fillStyle = value;
      }
    });
    */

    constructor.prototype.fillRect = function fillRect(x, y, w, h) {
      var gl = this.gl;

      var positionBuffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, rectangleVertices(w, h), gl.STATIC_DRAW);

      gl.useProgram(this.program);

      var color = parseColor(this.fillStyle);
      gl.uniform4f(this.program.uniforms.uColor.location, color[0], color[1], color[2], color[3]);

      gl.uniformMatrix3fv(this.program.uniforms.uTransformMatrix.location, false, makeTranslation(x, y));

      gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
      var location = this.program.attributes.aPosition.location;

      gl.enableVertexAttribArray(location);
      gl.vertexAttribPointer(location, 2, gl.FLOAT, false, 0, 0);

      gl.uniformMatrix3fv(this.program.uniforms.uTransformMatrix.location, false, makeTranslation(x, y));
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    };

    constructor.prototype.clearRect = function clearRect(x, y, w, h) {
      var gl = this.gl;
      gl.enable(gl.SCISSOR_TEST);
      gl.scissor(x, this.height - y - h, w, h);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.disable(gl.SCISSOR_TEST);
    };

    constructor.prototype.flush = function flush() {

    };

    constructor.prototype.beginPath = function beginPath() {
      this.path = [];
    };

    constructor.prototype.moveTo = function moveTo(x, y) {
      this.path.push({name: "moveTo", position: new Vector(x, y)});
    };

    constructor.prototype.lineTo = function lineTo(x, y) {
      this.path.push({name: "lineTo", position: new Vector(x, y)});
    };

    constructor.prototype.arc = function arc(x, y, radius, startAngle, endAngle, anticlockwise) {
      this.path.push({name: "arc", position: new Vector(x, y), radius: radius, startAngle: startAngle, endAngle: endAngle, anticlockwise: anticlockwise});
    };

    constructor.prototype.quadraticCurveTo = function quadraticCurveTo(cx, cy, x, y) {
      this.path.push({name: "quadraticCurveTo", control: new Vector(cx, cy), position: new Vector(x, y)});
    };

    function writeVertex(array, offset, vector) {
      array[offset] = vector.x;
      array[offset + 1] = vector.y;
    }

    function writeTriangle(array, offset, vectors) {
      writeVertex(array, offset, vectors[0]);
      writeVertex(array, offset + 2, vectors[1]);
      writeVertex(array, offset + 4, vectors[2]);
    }

    function tesLineStroke(buffer, offset, a, b, width) {
      var polygon = getLineStrokePolygon(a, b, width);
      writeTriangle(buffer, offset + 0, [polygon[0], polygon[1], polygon[2]]);
      writeTriangle(buffer, offset + 6, [polygon[2], polygon[3], polygon[0]]);
      return offset + 12;
    }

    function getCirclePolygon(center, radius, startAngle, endAngle, anticlockwise, slices) {
      slices |= 0;
      var angle = endAngle - startAngle;
      if (anticlockwise) {
        angle = PI2 - angle;
      }
      var slice = angle / slices;
      var points = [];
      for (var i = 0; i < slices + 1; i++) {
        points.push(new Vector(center.x + radius * Math.cos(startAngle + slice * i), center.y + radius * Math.sin(startAngle + slice * i)));
      }
      return points;
    }

    var PI2 = Math.PI * 2;

    function normalizeAngle(angle) {
      if (angle > PI2 || angle < -PI2) {
        angle %= PI2;
      }
      if (angle < 0) {
        return PI2 + angle;
      }
      return angle;
    }

    function clampAngle(angle) {
      if (angle > PI2) {
        return PI2;
      } else if (angle < 0) {
        return 0;
      }
      return angle;
    }

    function tesArcStroke(buffer, offset, radius, startAngle, endAngle, anticlockwise, width) {
      startAngle = clampAngle(startAngle);
      endAngle = clampAngle(endAngle);

      var angle = endAngle - startAngle;
      if (anticlockwise) {
        angle = PI2 - angle;
      }
      var arcLength = angle * radius;
      var slices = arcLength / 5 | 0;
      var outer = getCirclePolygon(new Vector(0, 0), radius + width / 2, startAngle, endAngle, anticlockwise, slices);
      var inner = getCirclePolygon(new Vector(0, 0), radius - width / 2, startAngle, endAngle, anticlockwise, slices);
      for (var i = 0; i < slices; i++) {
        writeTriangle(buffer, offset, [inner[i], outer[i], outer[i + 1]]);
        writeTriangle(buffer, offset + 6, [inner[i], outer[i + 1], inner[i + 1]]);
        offset += 12;
      }
      return offset;
    }

    function translateVertices(buffer, offset, count, vector) {
      for (var i = offset, j = offset + count * 2; i < j; i += 2) {
        buffer[i] += vector.x;
        buffer[i + 1] += vector.y;
      }
    }

    constructor.prototype.stroke = function stroke() {
      var gl = this.gl;
      var buffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);

      var array = new Float32Array(1024 * 100);
      var offset = 0;
      var lastPosition;
      var width = this.lineWidth;
      this.path.forEach(function (command) {
        switch (command.name) {
          case "moveTo":
            lastPosition = command.position;
            break;
          case "lineTo":
            offset = tesLineStroke(array, offset, lastPosition, command.position, width);
            lastPosition = command.position;
            break;
          case "arc":
            var newOffset = tesArcStroke(array, offset, command.radius, command.startAngle, command.endAngle, command.anticlockwise, width);
            translateVertices(array, offset, (newOffset - offset) / 2, command.position);
            offset = newOffset;
            break;
          case "quadraticCurveTo":
            writeTriangle(array, offset, [lastPosition, command.control, command.position]);
            offset += 6;
            break;
        }
      });

      gl.useProgram(this.curveProgram);

      var color = parseColor(this.strokeStyle);
      gl.uniform4f(this.curveProgram.uniforms.uColor.location, color[0], color[1], color[2], color[3]);

      gl.bufferData(gl.ARRAY_BUFFER, array.subarray(0, offset * 2), gl.STATIC_DRAW);
      var location = this.curveProgram.attributes.aPosition.location;
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.enableVertexAttribArray(location);
      gl.vertexAttribPointer(location, 2, gl.FLOAT, false, 0, 0);

      var uvBuffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, uvBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 0.5, 0, 1, 1]), gl.STATIC_DRAW);
      gl.enableVertexAttribArray(this.curveProgram.attributes.aTextureCoordinate.location);
      gl.vertexAttribPointer(this.curveProgram.attributes.aTextureCoordinate.location, 2, gl.FLOAT, false, 0, 0);

      gl.uniformMatrix3fv(this.curveProgram.uniforms.uTransformMatrix.location, false, makeTranslation(0, 0));

      // gl.enable(gl.BLEND);
      // gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
      gl.drawArrays(gl.TRIANGLES, 0, offset / 2);
      // gl.disable(gl.BLEND);
      // this.path.length = 0;
    };

    return constructor;
  })();

  return CanvasWebGLContext;

})(document);