//our username 
var name;
var connectedUser;

//connecting to our signaling server 
var conn = new WebSocket('ws://localhost:8000');

conn.onopen = function () {
   console.log("Connected to the signaling server");
};

//when we got a message from a signaling server 
conn.onmessage = function (msg) {
   console.log("Got message", msg.data);
   var data = JSON.parse(msg.data);

   switch (data.type) {
      case "login":
         handleLogin(data.success);
         break;
      //when somebody wants to call us 
      case "offer":
         handleOffer(data.offer, data.name);
         break;
      case "answer":
         handleAnswer(data.answer);
         break;
      //when a remote peer sends an ice candidate to us 
      case "candidate":
         handleCandidate(data.candidate);
         break;
      case "leave":
         handleLeave();
         break;
      default:
         break;
   }
};

conn.onerror = function (err) {
   console.log("Got error", err);
};

//alias for sending JSON encoded messages 
function send(message) {
   //attach the other peer username to our messages 
   if (connectedUser) {
      message.name = connectedUser;
   }

   conn.send(JSON.stringify(message));
};

//****** 
//UI selectors block 
//****** 

var loginPage = document.querySelector('#loginPage');
var usernameInput = document.querySelector('#usernameInput');
var loginBtn = document.querySelector('#loginBtn');

var callPage = document.querySelector('#callPage');
var callToUsernameInput = document.querySelector('#callToUsernameInput');
var callBtn = document.querySelector('#callBtn');

var hangUpBtn = document.querySelector('#hangUpBtn');
var localAudio = document.querySelector('#localAudio');
var remoteAudio = document.querySelector('#remoteAudio');

var yourConn;
var stream;

callPage.style.display = "none";

// Login when the user clicks the button 
loginBtn.addEventListener("click", function (event) {
   name = usernameInput.value;

   if (name.length > 0) {
      send({
         type: "login",
         name: name
      });
   }

});

function getUserMedia(constraints) {
   // if Promise-based API is available, use it
   if (navigator.mediaDevices) {
      return navigator.mediaDevices.getUserMedia(constraints);
   }

   // otherwise try falling back to old, possibly prefixed API...
   var legacyApi = navigator.getUserMedia || navigator.webkitGetUserMedia ||
      navigator.mozGetUserMedia || navigator.msGetUserMedia;

   if (legacyApi) {
      // ...and promisify it
      return new Promise(function (resolve, reject) {
         legacyApi.bind(navigator)(constraints, resolve, reject);
      });
   }
}

function getStream() {
   if (!navigator.mediaDevices && !navigator.getUserMedia && !navigator.webkitGetUserMedia &&
      !navigator.mozGetUserMedia && !navigator.msGetUserMedia) {
      alert('User Media API not supported.');
      return;
   }

   var constraints = { video: false, audio: true };

   getUserMedia(constraints).then(function (stream) {
      if ('srcObject' in localAudio) {
         localAudio.srcObject = stream;
      } else if (navigator.mozGetUserMedia) {
         localAudio.mozSrcObject = stream;
      } else {
         localAudio.src = (window.URL || window.webkitURL).createObjectURL(stream);
      }

      //using Google public stun server 
      var configuration = {
         "iceServers": [{ "url": "stun:stun2.1.google.com:19302" }]
      };

      yourConn = new webkitRTCPeerConnection(configuration);

      // setup stream listening 
      yourConn.addStream(stream);
      //when a remote user adds stream to the peer connection, we display it 
      yourConn.onaddstream = function (e) {
         if ('srcObject' in localAudio) {
            remoteAudio.srcObject = e.stream;
         } else if (navigator.mozGetUserMedia) {
            remoteAudio.mozSrcObject = e.stream;
         } else {
            remoteAudio.src = (window.URL || window.webkitURL).createObjectURL(e.stream);
         }
      };

      // Setup ice handling 
      yourConn.onicecandidate = function (event) {
         if (event.candidate) {
            send({
               type: "candidate",
               candidate: event.candidate
            });
         }
      };
   })
      .catch(function (err) {
         alert('Error: ' + err);
      });
}

function handleLogin(success) {
   if (success === false) {
      alert("Ooops...try a different username");
   } else {
      loginPage.style.display = "none";
      callPage.style.display = "block";

      //********************** 
      //Starting a peer connection 
      //********************** 

      //getting local audio stream 
      getStream()

   }
};

//initiating a call 
callBtn.addEventListener("click", function () {
   var callToUsername = callToUsernameInput.value;
   if (callToUsername.length > 0) {
      connectedUser = callToUsername;
      // create an offer 
      yourConn.createOffer(function (offer) {
         console.log("offer")
         send({
            type: "offer",
            offer: offer
         });

         yourConn.setLocalDescription(offer);
      }, function (error) {
         alert("Error when creating an offer");
      });
   }
});

//when somebody sends us an offer 
function handleOffer(offer, name) {
   connectedUser = name;
   yourConn.setRemoteDescription(new RTCSessionDescription(offer));

   //create an answer to an offer 
   yourConn.createAnswer(function (answer) {
      yourConn.setLocalDescription(answer);

      send({
         type: "answer",
         answer: answer
      });

   }, function (error) {
      alert("Error when creating an answer");
   });

};

//when we got an answer from a remote user 
function handleAnswer(answer) {
   yourConn.setRemoteDescription(new RTCSessionDescription(answer));
};

//when we got an ice candidate from a remote user 
function handleCandidate(candidate) {
   yourConn.addIceCandidate(new RTCIceCandidate(candidate));
};

//hang up
hangUpBtn.addEventListener("click", function () {
   send({
      type: "leave"
   });

   handleLeave();
});

function handleLeave() {
   connectedUser = null;
   remoteAudio.src = null;

   yourConn.close();
   yourConn.onicecandidate = null;
   yourConn.onaddstream = null;
};