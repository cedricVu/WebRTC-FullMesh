const mediaStreamConstraints = {
    video: true
};
const socket = io.connect('http://localhost:3000');
const offerOptions = {
    offerToReceiveVideo: 1,
};

const localVideo = document.getElementById('localVideo');
const remoteVideo = document.getElementById('remoteVideo');
let peerConnection;

const callButton = document.getElementById('callButton');
const stopButton = document.getElementById('stopButton');

callButton.addEventListener('click', callAction);
stopButton.addEventListener('click', stopAction);

function gotRemoteMediaStream(event) {
    const mediaStream = event.stream;
    remoteVideo.srcObject = mediaStream;
}

function handleConnection(event) {
    const iceCandidate = event.candidate;
    socket.emit('signaling', {
        action: 'sent-ice',
        iceCandidate
    });
}

function createdOffer(description) {
    peerConnection.setLocalDescription(description)
        .then().catch();

    socket.emit('signaling', {
        action: 'sent-offer',
        offerDescription: description
    });
}

function createdAnswer(description) {
    peerConnection.setLocalDescription(description)
        .then().catch();

    socket.emit('signaling', {
        action: 'sent-answer',
        answerDescription: description
    });
}


function callAction() {
    navigator.mediaDevices.getUserMedia(mediaStreamConstraints)
        .then((mediaStream) => {
            localVideo.srcObject = mediaStream;
            peerConnection = new RTCPeerConnection(null);
            peerConnection.addEventListener('icecandidate', handleConnection);
            peerConnection.onaddstream = gotRemoteMediaStream;
            peerConnection.addStream(mediaStream);
            socket.emit('signaling', {
                action: 'start-call'
            });
        })
        .catch();
}

function stopAction() {
    let stream = localVideo.srcObject;
    let tracks = stream.getTracks();

    tracks.forEach(function(track) {
        track.stop();
    });

    localVideo.srcObject = null;
    if (peerConnection) {
        peerConnection.close();
        peerConnection = null;

    }
}

socket.on('signaling', function(data) {
    switch (data.action) {
        case 'start-call':
            navigator.mediaDevices.getUserMedia(mediaStreamConstraints)
                .then(function (mediaStream) {
                    localVideo.srcObject = mediaStream;
                    peerConnection = new RTCPeerConnection(null);
                    peerConnection.addEventListener('icecandidate', handleConnection);
                    peerConnection.onaddstream = gotRemoteMediaStream;
                    peerConnection.addStream(mediaStream);

                    peerConnection.createOffer(offerOptions).then(createdOffer).catch();
                })
                .catch();
            break;

        case 'sent-offer':
            const offerDescription = data.offerDescription;
            peerConnection.setRemoteDescription(offerDescription)
                .then().catch();

            peerConnection.createAnswer()
                .then(createdAnswer)
                .catch();
            break;

        case 'sent-answer':
            const answerDescription = data.answerDescription;
            peerConnection.setRemoteDescription(answerDescription)
                .then().catch();
            break;

        case 'sent-ice':
            if (data.iceCandidate) {
                const newIceCandidate = new RTCIceCandidate(data.iceCandidate);
                if (peerConnection) {
                    peerConnection.addIceCandidate(newIceCandidate)
                        .then().catch();
                }
            }
    }

});
