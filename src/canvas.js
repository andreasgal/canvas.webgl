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
    result[3] = m[4] ? parseFloat(m[4]) / 255 : 1;
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

  var shaderRoot = "../shaders/";

  var CanvasWebGLContext = (function () {
    function constructor(canvas) {
      this.canvas = canvas;
      this.width = canvas.width;
      this.height = canvas.height;
      assert (this.width && this.height && isPowerOfTwo(this.width) && isPowerOfTwo(this.height));
      var gl = this.gl = this.canvas.getContext("experimental-webgl");
      assert (gl);

      this.vertexShader = this.createShaderFromFile(shaderRoot + "canvas.vert");
      this.fragmentShader = this.createShaderFromFile(shaderRoot + "identity.frag");
      this.program = this.createProgram([this.vertexShader, this.fragmentShader]);
      this.queryProgramAttributesAndUniforms(this.program);

      gl.useProgram(this.program);
      gl.uniform2f(this.program.uniforms.u_resolution.location, this.width, this.height);
      gl.uniformMatrix3fv(this.program.uniforms.u_transformMatrix.location, false, makeTranslation(0, 0));
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

    var first = true;
    constructor.prototype.fillRect = function fillRect(x, y, w, h) {
      var gl = this.gl;

      if (first) {
        var buffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.bufferData(gl.ARRAY_BUFFER, rectangleVertices(w, h), gl.STATIC_DRAW);

        gl.useProgram(this.program);
        gl.uniformMatrix3fv(this.program.uniforms.u_transformMatrix.location, false, makeTranslation(x, y));
        var location = this.program.attributes.a_position.location;

        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.enableVertexAttribArray(location);
        gl.vertexAttribPointer(location, 2, gl.FLOAT, false, 0, 0);
        first = false;
      }
      gl.uniformMatrix3fv(this.program.uniforms.u_transformMatrix.location, false, makeTranslation(x, y));
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    };

    constructor.prototype.clearRect = function clearRect(x, y, w, h) {
      var gl = this.gl;
      notImplemented("clearRect");
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
    };

    return constructor;
  })();

  return CanvasWebGLContext;

})(document);