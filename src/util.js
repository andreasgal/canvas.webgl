var release = false;
var inBrowser = typeof console != "undefined";

if (!inBrowser) {
  console = {
    info: print,
    warn: function (x) {
      if (traceWarnings.value) {
        print(x);
      }
    }
  };
}

function backtrace() {
  try {
    throw new Error();
  } catch (e) {
    return e.stack ? e.stack.split('\n').slice(2).join('\n') : '';
  }
}

function error(message) {
  if (!inBrowser) {
    console.info(backtrace());
  }
  throw new Error(message);
}

function assert(condition) {
  if (condition === "") {     // avoid inadvertent false positive
    condition = true;
  }
  if (!condition) {
    var message = Array.prototype.slice.call(arguments);
    message.shift();
    error(message.join(""));
  }
}

function warning(message) {
  console.warn(message);
}

function notImplemented(message) {
  release || assert(false, "Not Implemented " + message);
}

function somewhatImplemented(message) {
  warning(message);
}

function unexpected(message) {
  release || assert(false, message);
}

function isPowerOfTwo(x) {
  return x && ((x & (x - 1)) === 0);
}

function extendBuiltin(proto, prop, f) {
  if (!proto[prop]) {
    Object.defineProperty(proto, prop,
      { value: f,
        writable: true,
        configurable: true,
        enumerable: false });
  }
}

var Sp = String.prototype;

extendBuiltin(Sp, "padRight", function (c, n) {
  var str = this;
  var length = str.length;
  if (!c || length >= n) {
    return str;
  }
  var max = (n - length) / c.length;
  for (var i = 0; i < max; i++) {
    str += c;
  }
  return str;
});

extendBuiltin(Sp, "trim", function () {
  return this.replace(/^\s+|\s+$/g,"");
});

extendBuiltin(Sp, "endsWith", function (str) {
  return this.indexOf(str, this.length - str.length) !== -1;
});

var IndentingWriter = (function () {
  var consoleOutFn = console.info.bind(console);
  function indentingWriter(suppressOutput, outFn) {
    this.tab = "  ";
    this.padding = "";
    this.suppressOutput = suppressOutput;
    this.out = outFn || consoleOutFn;
  }

  indentingWriter.prototype.writeLn = function writeLn(str) {
    if (!this.suppressOutput) {
      this.out(this.padding + str);
    }
  };

  indentingWriter.prototype.debugLn = function writeLn(str) {
    if (!this.suppressOutput) {
      this.out(this.padding + PURPLE + str + ENDC);
    }
  };

  indentingWriter.prototype.enter = function enter(str) {
    if (!this.suppressOutput) {
      this.out(this.padding + str);
    }
    this.indent();
  };

  indentingWriter.prototype.leaveAndEnter = function leaveAndEnter(str) {
    this.leave(str);
    this.indent();
  };

  indentingWriter.prototype.leave = function leave(str) {
    this.outdent();
    if (!this.suppressOutput) {
      this.out(this.padding + str);
    }
  };

  indentingWriter.prototype.indent = function indent() {
    this.padding += this.tab;
  };

  indentingWriter.prototype.outdent = function outdent() {
    if (this.padding.length > 0) {
      this.padding = this.padding.substring(0, this.padding.length - this.tab.length);
    }
  };

  indentingWriter.prototype.writeArray = function writeArray(arr, detailed, noNumbers) {
    detailed = detailed || false;
    for (var i = 0, j = arr.length; i < j; i++) {
      var prefix = "";
      if (detailed) {
        if (arr[i] === null) {
          prefix = "null";
        } else if (arr[i] === undefined) {
          prefix = "undefined";
        } else {
          prefix = arr[i].constructor.name;
        }
        prefix += " ";
      }
      var number = noNumbers ? "" : ("" + i).padRight(' ', 4);
      this.writeLn(number + prefix + arr[i]);
    }
  };

  return indentingWriter;
})();