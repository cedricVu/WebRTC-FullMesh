
const socket = io.connect('http://localhost:3000');

const offerOptions = {
    offerToReceiveVideo: 1,
};
const mediaStreamConstraints = {
    video: true
};
const peers = {};
const restartConfig = { iceServers: [{
    urls: "turn:asia.myturnserver.net",
    username: "allie@oopcode.com",
    credential: "topsecretpassword"
}]
};

const localVideo = document.getElementById('localVideo');
const remoteVideo = document.getElementById('remoteVideo');


function gotRemoteMediaStream(event) {
    const mediaStream = event.stream;
    remoteVideo.srcObject = mediaStream;
}

function handleConnection(event) {
    const iceCandidate = event.candidate;
    socket.emit('signaling', {
        action: 'ice',
        iceCandidate
    });
}

function startVideo(callback) {
    navigator.mediaDevices.getUserMedia(mediaStreamConstraints)
        .then(function (mediaStream) {
            localVideo.srcObject = mediaStream;
            return callback(mediaStream);
        })
        .catch(e => console.log(e));
}

function initPeer(userId, mediaStream) {
    if (peers[userId]) {
        return alert('Existed partner');
    }
    peers[userId] = new RTCPeerConnection(restartConfig);
    peers[userId].addEventListener('icecandidate', handleConnection);
    peers[userId].onaddstream = gotRemoteMediaStream;
    peers[userId].addStream(mediaStream);
}

function createOffer(userId, callback) {
    if (peers[userId]) {
        peers[userId].createOffer(offerOptions).then(offerDescription => {
            peers[userId].setLocalDescription(offerDescription).then(callback(offerDescription)).catch(e => console.log(e));
        }).catch(e => console.log(e));
    } else {
        return alert('Not found');
    }
}

function createAnswer(userId, offerDescription, callback) {
    peers[userId].setRemoteDescription(offerDescription)
        .then().catch();

    peers[userId].createAnswer()
        .then((answerDescription) => {
            peers[userId].setLocalDescription(answerDescription)
                .then(callback).catch(e => console.log(e));
        })
        .catch(e => console.log(e));

}

function addIceCandidate(userId, iceCandidate) {
    const newIceCandidate = new RTCIceCandidate(iceCandidate);
    if (peers[userId]) {
        peers[userId].addIceCandidate(newIceCandidate)
            .then().catch(e => console.log(e));
    }
}

function stopAction(userId) {
    let stream = localVideo.srcObject;
    let tracks = stream.getTracks();

    tracks.forEach(function(track) {
        track.stop();
    });

    localVideo.srcObject = null;
    if (peers[userId]) {
        peers[userId].close();
        peers[userId] = null;

    }
}

socket.on('connect', function() {
    const userId = socket.id;
    startVideo(function(mediaStream) {
        initPeer(userId, mediaStream);
        createOffer(userId, function(offerDescription) {
            socket.emit('signaling', {
                action: 'offer',
                offerDescription
            });
        })
    });
    socket.on('signaling', function(data) {
        switch (data.action) {
            case 'offer':
                createAnswer(userId, data.offerDescription, function (answerDescription) {
                    socket.emit('signaling', {
                        action: 'answer',
                        answerDescription
                    });
                });
                break;

            case 'answer':
                peers[userId].setRemoteDescription(data.answerDescription);
                break;

            case 'ice':
                addIceCandidate(userId, data.iceCandidate)

        }

    });
});
