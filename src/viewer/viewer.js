var canvas = document.getElementById("Canvas");
var canvasWebGL = document.getElementById("Canvas.WebGL");

var canvasFPS = document.getElementById("Canvas.FPS");
var canvasWebGLFPS = document.getElementById("Canvas.WebGL.FPS");


function animate(test) {
  var speed = 1000 / 30;
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

function randomColor() {
  return '#' + (Math.random() * 0xFFFFFF << 0).toString(16);
}

animate(function () {
  var iterations = 10;
  var count = 100;

  canvasFPS.innerHTML = (1000 / (time(function () {
    for (var i = 0; i < count; i++) {
      var x = Math.random() * (canvas.width - 50);
      var y = Math.random() * (canvas.width - 50);
      canvasContext.fillStyle = randomColor();

      canvasContext.beginPath();
      canvasContext.arc(x, y, 50, 0, Math.PI * 2, true);
      canvasContext.closePath();
      canvasContext.fill();

      canvasContext.fillRect(x, y, 50, 50);
    }
  }, iterations) / iterations)).toFixed(2) + " FPS, Iterations: " + iterations + ", Count: " + count;

  canvasWebGLFPS.innerHTML = (1000 / time(function () {
    for (var i = 0; i < 10000; i++) {

    }
  }, count) * count).toFixed(2) + " FPS";
  return true;
});
