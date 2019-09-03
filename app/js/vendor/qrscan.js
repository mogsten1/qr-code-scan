import {
  snackbar
} from '../snackbar.js';

var QRReader = {};
var cameraList = [];

QRReader.active = false;
QRReader.webcam = null;
QRReader.canvas = null;
QRReader.ctx = null;
QRReader.decoder = null;

QRReader.setCanvas = () => {
  QRReader.canvas = document.createElement('canvas');
  QRReader.ctx = QRReader.canvas.getContext('2d');
};

function setPhotoSourceToScan(forSelectedPhotos) {
  QRReader.webcam = document.querySelector('video');
}

QRReader.init = () => {
  var baseurl = '';
  var streaming = false;

  var isFrontCam = 0;

  // Init Webcam + Canvas
  setPhotoSourceToScan();

  QRReader.setCanvas();
  QRReader.decoder = new Worker(baseurl + 'decoder.js');

  QRReader.webcam.addEventListener(
    'play',
    function(ev) {
      if (!streaming) {
        setCanvasProperties();
        streaming = true;
      }
    },
    false
  );

  function setCanvasProperties() {
    QRReader.canvas.width = window.innerWidth;
    QRReader.canvas.height = window.innerHeight;
  }

  function gotStream(stream) {
    window.stream = stream; // make stream available to console
    QRReader.webcam.srcObject = stream;
    QRReader.webcam.setAttribute('playsinline', true);
    QRReader.webcam.setAttribute('controls', true);
    setTimeout(() => {
      document.querySelector('video').removeAttribute('controls');
    });
    // Refresh button list in case labels have become available
    return navigator.mediaDevices.enumerateDevices();
  }

  function startCapture(constraints) {
    if (window.stream) {
      window.stream.getTracks().forEach(track => {
        track.stop();
      });
    }

    var videoSource = cameraList.length > 0 ? isFrontCam ? cameraList[0].deviceId : cameraList[1].deviceId : null;
    isFrontCam = !isFrontCam;

    constraints = {
      video: {
        deviceId: videoSource ? {
          exact: videoSource
        } : undefined
      }
    };

    navigator.mediaDevices
      .getUserMedia(constraints)
      .then(gotStream)
      .then(gotDevices)
      .catch(function(err) {});
  }

  //videoSelect.onchange = startCapture;

  function gotDevices(devices) {
    //end by Jin
    cameraList = devices.filter(function(device) {
      if (device.kind == 'videoinput') {
        return device;
      }
    });
  }

  // if (window.isMediaStreamAPISupported) {
  navigator.mediaDevices
    .enumerateDevices()
    .then(gotDevices)
    .catch(function(error) {
      //showErrorMsg();
      console.error('Error occurred : ', error);
    });

  const switchCam = document.querySelector('.app__select-photos');

  switchCam.addEventListener('click', startCapture);
  // }

  startCapture();

  function showErrorMsg() {
    window.noCameraPermission = true;
    document.querySelector('.custom-scanner').style.display = 'none';
    snackbar.show('Unable to access the camera', 10000);
  }
};

/**
 * \brief QRReader Scan Action
 * Call this to start scanning for QR codes.
 *
 * \param A function(scan_result)
 */
QRReader.scan = function(callback, forSelectedPhotos) {
  QRReader.active = true;
  QRReader.setCanvas();

  function onDecoderMessage(event) {
    if (event.data.length > 0) {
      var qrid = event.data[0][2];
      QRReader.active = false;
      callback(qrid);
    }
    setTimeout(newDecoderFrame, 0);
  }

  QRReader.decoder.onmessage = onDecoderMessage;

  setTimeout(() => {
    setPhotoSourceToScan(forSelectedPhotos);
  });

  // Start QR-decoder
  function newDecoderFrame() {
    if (!QRReader.active) return;
    try {
      QRReader.ctx.drawImage(QRReader.webcam, 0, 0, QRReader.canvas.width, QRReader.canvas.height);
      var imgData = QRReader.ctx.getImageData(0, 0, QRReader.canvas.width, QRReader.canvas.height);

      if (imgData.data) {
        QRReader.decoder.postMessage(imgData);
      }
    } catch (e) {
      // Try-Catch to circumvent Firefox Bug #879717
      if (e.name == 'NS_ERROR_NOT_AVAILABLE') setTimeout(newDecoderFrame, 0);
    }
  }
  newDecoderFrame();
};

export default QRReader;
