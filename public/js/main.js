const mediaStreamConstraints = {
    video: true
};
const offerOptions = {
    offerToReceiveVideo: 1,
};
const localVideo = document.getElementById('localVideo');
const publishBtn = document.getElementById('publish-btn');

let localStream;
let publishId;
let connections = [];

function getParameterByName(name, url) {
    if (!url) url = window.location.href;
    name = name.replace(/[\[\]]/g, '\\$&');
    var regex = new RegExp('[?&]' + name + '(=([^&#]*)|&|#|$)'),
        results = regex.exec(url);
    if (!results) return null;
    if (!results[2]) return '';
    return decodeURIComponent(results[2].replace(/\+/g, ' '));
}

function gotRemoteStream(event, userId) {
    let remoteVideo  = document.createElement('video');
    remoteVideo.setAttribute('data-socket', userId);
    remoteVideo.srcObject   = event.stream;
    remoteVideo.autoplay    = true;
    remoteVideo.muted       = true;
    remoteVideo.playsinline = true;
    document.querySelector('.videos').appendChild(remoteVideo);
}

function startPublish() {
    startLocalStream();
    const socket = io('http://localhost:3000');
    socket.on('connect', function() {
        publishId = socket.id;
        console.log('Started publish ', publishId);
        const subscribeLink = document.createTextNode('http://localhost:3000?subscribe='+publishId);
        document.querySelector('body').append(subscribeLink);
        socket.on('new-subscribe', function (data) {
            const fromId = data.fromId;
            if (!connections[fromId]) {
                connections[fromId] = new RTCPeerConnection(mediaStreamConstraints);
                connections[fromId].onicecandidate = () => {
                    if (event.candidate) {
                        socket.emit('signaling', { type: 'candidate', candidate: event.candidate, toId: fromId });
                    }
                };
                connections[fromId].addStream(localStream);
                connections[fromId].createOffer(offerOptions).then(description => {
                    connections[fromId].setLocalDescription(description).then(() => {
                        socket.emit('signaling', {
                            type: 'sdp',
                            toId: fromId,
                            description: description
                        });
                    });
                })
            }
        });
        socket.on('signaling', function (data) {
            const fromId = data.fromId;
            switch (data.type) {
                case 'candidate':
                    connections[fromId].addIceCandidate(new RTCIceCandidate(data.candidate));
                    break;

                case 'sdp':
                    connections[fromId].setRemoteDescription(data.description).then(function() {

                    });
                    break;
            }
        })
    });
}

function startLocalStream() {
    navigator.mediaDevices.getUserMedia(mediaStreamConstraints)
        .then(getUserMediaSuccess)
        .then().catch(handleError);
}

function getUserMediaSuccess(mediaStream) {
    localStream = mediaStream;
    localVideo.srcObject = mediaStream;
}

function handleError(e) {
    console.log(e);
    alert('Something went wrong');
}

const subscribeToId = getParameterByName('subscribe');
if (subscribeToId) {
    localVideo.parentNode.removeChild(localVideo);
    publishBtn.parentNode.removeChild(publishBtn);
    const socket = io('http://localhost:3000');
    socket.on('connect', function() {
        const remotePeer = new RTCPeerConnection({
            video: false,
            audio: false
        });
        remotePeer.onicecandidate = () => {
            if (event.candidate) {
                socket.emit('signaling', { type: 'candidate', candidate: event.candidate, toId: subscribeToId });
            }
        };
        remotePeer.onaddstream = () => {
            gotRemoteStream(event, subscribeToId)
        };
        socket.emit('new-subscribe', {
            toId: subscribeToId
        });
        socket.on('signaling', function (data) {
            switch (data.type) {
                case 'candidate':
                    remotePeer.addIceCandidate(new RTCIceCandidate(data.candidate));
                    break;

                case 'sdp':
                    if (data.description) {
                        remotePeer.setRemoteDescription(data.description).then(function() {
                            if (data.description.type === 'offer') {
                                remotePeer.createAnswer().then(description => {
                                    remotePeer.setLocalDescription(description).then(function() {
                                        socket.emit('signaling', { type: 'sdp', toId: subscribeToId, description: remotePeer.localDescription})
                                    });
                                });
                            }
                        });
                    }
                    break;
            }
        });
    })
}