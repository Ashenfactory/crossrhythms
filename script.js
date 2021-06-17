context = new (window.AudioContext || window.webkitAudioContext)();

if (!context.createGain)
  context.createGain = context.createGainNode;
if (!context.createDelay)
  context.createDelay = context.createDelayNode;
if (!context.createScriptProcessor)
  context.createScriptProcessor = context.createJavaScriptNode;

function playSound(buffer, time) {
  var source = context.createBufferSource();
  source.buffer = buffer;
  source.connect(context.destination);
  source[source.start ? 'start' : 'noteOn'](time);
}

function loadSounds(obj, soundMap, callback) {
  var names = [];
  var paths = [];
  for (var name in soundMap) {
    var path = soundMap[name];
    names.push(name);
    paths.push(path);
  }
  bufferLoader = new BufferLoader(context, paths, function(bufferList) {
    for (var i = 0; i < bufferList.length; i++) {
      var buffer = bufferList[i];
      var name = names[i];
      obj[name] = buffer;
    }
    if (callback) {
      callback();
    }
  });
  bufferLoader.load();
}

function BufferLoader(context, urlList, callback) {
  this.context = context;
  this.urlList = urlList;
  this.onload = callback;
  this.bufferList = [];
  this.loadCount = 0;
}

BufferLoader.prototype.loadBuffer = function(url, index) {
  // Load buffer asynchronously
  var request = new XMLHttpRequest();
  request.open("GET", url, true);
  request.responseType = "arraybuffer";

  var loader = this;

  request.onload = function() {
    // Asynchronously decode the audio file data in request.response
    loader.context.decodeAudioData(
      request.response,
      function(buffer) {
        if (!buffer) {
          alert('error decoding file data: ' + url);
          return;
        }
        loader.bufferList[index] = buffer;
        if (++loader.loadCount == loader.urlList.length)
          loader.onload(loader.bufferList);
      },
      function(error) {
        console.error('decodeAudioData error', error);
      }
    );
  };

  request.onerror = function() {
    alert('BufferLoader: XHR error');
  };

  request.send();
};

BufferLoader.prototype.load = function() {
  for (var i = 0; i < this.urlList.length; ++i)
  this.loadBuffer(this.urlList[i], i);
};


var sample, timer, resumeHandler,
  rhythmIndex = null,
  rhythmTable = null,
  settings = {},
  playing = false;


function Timer(callback, timeInterval) {
  this.timeInterval = timeInterval;

  this.start = () => {
    this.expected = Date.now() + this.timeInterval;
    this.timeout = setTimeout(this.round, this.timeInterval);
  };

  this.stop = () => {
    clearTimeout(this.timeout);
  };

  this.round = () => {
    let drift = Date.now() - this.expected;
    callback();
    this.expected += this.timeInterval;
    this.timeout = setTimeout(this.round, this.timeInterval - drift);
  };
}

var RhythmSample = function() {
  loadSounds(this, {});
};

function displayResult(changeType) {
  let rhythm1 = parseInt(document.getElementById('rhythm1').value);
  let rhythm2 = parseInt(document.getElementById('rhythm2').value);

  settings = {
    rhythm1: (isNaN(rhythm1) || rhythm1 < 1) ? 1 : rhythm1,
    rhythm2: (isNaN(rhythm2) || rhythm2 < 1) ? 1 : rhythm2,
    mute1: document.getElementById('mute1').checked,
    mute2: document.getElementById('mute2').checked,
    mute3: document.getElementById('mute3').checked,
    sounds: [
      document.getElementById('sound1').value,
      document.getElementById('sound2').value,
      document.getElementById('sound3').value,
    ]
  };

  if (changeType === 'sound' || changeType === 'init') {
    loadSounds(RhythmSample, {
      sound1: 'sounds/' + settings.sounds[0] + '.ogg',
      sound2: 'sounds/' + settings.sounds[1] + '.ogg',
      sound3: 'sounds/' + settings.sounds[2] + '.ogg'
    });
  }

  if (changeType === 'tempo') {
    if (timer && playing) {
      timer.stop();
      timer = new Timer(moveCursor, calculateTempo());
      timer.start();
    }
  }

  if (changeType === 'rhythm') {
    sample.stop();

    if (playing) {
      window.clearTimeout(resumeHandler);

      resumeHandler = window.setTimeout(function() {
        sample.play();
      }, 500);
    }
  }

  if (changeType === 'rhythm' || changeType === 'init') {
    var result = '';
    var index = 0;

    for (var i = 1; i <= settings.rhythm2; i++) {

      result += '<tr>';

      for (var j = 1; j <= settings.rhythm1; j++) {
        result += '<td' + ((index % settings.rhythm2 === 0 || index === 0) ? ' class="counterpulse"' : '') + '>' + j + '</td>';
        index++;
      }

      result += '</tr>';
    }

    document.getElementById('result').innerHTML = result;
  }
}

function clearCursor() {
  if (rhythmIndex !== null) {
    rhythmIndex = null;
    document.querySelector('#result td.highlight').classList.remove('highlight');
  }
}

function moveCursor() {
  if (rhythmIndex !== null) {
    rhythmTable[rhythmIndex].classList.remove('highlight');

    if (rhythmIndex === rhythmTable.length - 1) {
      rhythmIndex = 0;
    } else {
      rhythmIndex++;
    }

    rhythmTable[rhythmIndex].classList.add('highlight');
  } else {
    rhythmIndex = 0;
    rhythmTable = document.querySelectorAll('#result td');
    rhythmTable[rhythmIndex].classList.add('highlight');
  }

  if (!settings.mute1 && (rhythmIndex) % settings.rhythm1 === 0) {
    playSound(RhythmSample.sound1, 0);
  }

  if (!settings.mute2 && (rhythmIndex) % settings.rhythm2 === 0) {
    playSound(RhythmSample.sound2, 0);
  }

  if (!settings.mute3) {
    playSound(RhythmSample.sound3, 0);
  }
}

RhythmSample.prototype.stop = function() {
  if (timer) {
    timer.stop();
  }

  clearCursor();
};

RhythmSample.prototype.play = function() {
  this.stop();

  moveCursor();

  timer = new Timer(moveCursor, calculateTempo());
  timer.start();
};

function calculateTempo() {
  let bpm = parseInt(document.getElementById('bpm').value);

  if (isNaN(bpm) || bpm < 1) {
    bpm = 1;
  }

  return Number(60 / bpm) * 1000;
}

window.onload = init();

function init() {
  sample = new RhythmSample();
  var inputs = document.querySelectorAll('input, select');

  for (var i = 0; i < inputs.length; i++) {
    inputs[i].addEventListener('input', function(event) {
      displayResult(event.target.dataset.type);
    });
  }

  document.getElementById('play').addEventListener('click', function() {
    playing = true;
    document.getElementById('play').disabled = true;
    document.getElementById('stop').disabled = false;
    sample.play();
  });

  document.getElementById('stop').addEventListener('click', function() {
    playing = false;
    document.getElementById('play').disabled = false;
    document.getElementById('stop').disabled = true;
    sample.stop();
  });

  displayResult('init');
}