const TwilioVideoPlayer = {
  // Twilio Video JS SDK
  videoRoom: null,
  localStream: null,
  screenTrack: null,
  /**
   * ルームに接続する
   * @param {string} roomElementId ビデオを表示するHTMLのid属性
   * @param {string} token アクセストークン
   * @param {string} roomname ルーム名
   */
  connect(roomElementId, token, roomname) {
    // プレビュー画面の表示
    navigator.mediaDevices.getUserMedia({video: true, audio: true})
      .then(stream => {
          document.getElementById(roomElementId).srcObject = stream;
          this.localStream = stream;
      });

    // 部屋に入室
    Twilio.Video.connect(token, { name: roomname })
      .then(room => {
          this.videoRoom = room;

          // すでに入室している参加者を表示
          room.participants.forEach(this.participantConnected);

          // 誰かが入室してきたときの処理
          room.on('participantConnected', this.participantConnected);

          // 誰かが退室したときの処理
          room.on('participantDisconnected', this.participantDisconnected);

          // 自分が退室したときの処理
          room.once('disconnected', room => {
            // Detach the local media elements
            room.localParticipant.tracks.forEach(track => {
              const attachedElements = track.detach();
              attachedElements.forEach(element => element.remove());
            });
          });          
      });
  },
  /**
   * 接続済みの状態を返す
   * @returns boolean true: 接続済み, false: 切断
   */
  isConnected() {
    return this.videoRoom;
  },
  /**
   * カメラのON/OFFを行う
   * @param {boolean} isOn true: onにする, false: offにする
   */
  cameraControl(isOn) {
    this.localStream.getVideoTracks().forEach((track) => {
      track.enabled = isOn;
    });
    this.videoRoom.localParticipant.videoTracks.forEach((videoTrack) => {
      isOn ? videoTrack.enable() : videoTrack.disable()
    });
  },
  /**
   * マイクのON/OFFを行う
   * @param {boolean} isOn true: onにする, false: offにする
   */
  micControl(isOn) {
    this.videoRoom.localParticipant.audioTracks.forEach((audioTrack) => 
    isOn ? audioTrack.enable() : audioTrack.disable());
  },
  /**
   * 画面を共有する
   */
  shareScreen() {
    if (!this.screenTrack) {
      navigator.mediaDevices.getDisplayMedia()
        .then(stream => {
          this.screenTrack = new Twilio.Video.LocalVideoTrack(stream.getTracks()[0]);
          this.videoRoom.localParticipant.publishTrack(this.screenTrack);
        });
    } else {
      this.videoRoom.localParticipant.unpublishTrack(this.screenTrack);
      this.screenTrack.stop();
      this.screenTrack = null;
    }
  },
  /**
   * ルームから退室する。
   */
  disconnect() {
    this.videoRoom.disconnect();
  },
  /**
   * 参加済みのメンバーを表示する
   *
   * @param {Participant } participant 参加者
   */
  participantConnected: (participant) => {
    const div = document.createElement('div');
    div.id = participant.sid;
    div.classList.add('video');
    div.dataset.dataParticipantSid = participant.sid;

    // 参加者のトラック（映像、音声など）を処理
    participant.tracks.forEach((publication) => {
        if (publication.isSubscribed) {
            this.trackSubscribed(div, publication.track);
            this.handleTrackChanged(publication.track);
        }
        // publication.on('subscribed', (track) => this.handleTrackChanged(track, participant));
        publication.on('subscribed', this.handleTrackChanged);
    });

    // 参加者の映像が届いたとき
    participant.on('trackSubscribed', (track) => this.trackSubscribed(div, track));

    // 参加者の映像が切れたとき
    participant.on('trackUnsubscribed', this.trackUnsubscribed);

    document.getElementById('video-container').appendChild(div);
  },
  /**
   * 他の参加者が入室したとき
   * @param {Participant } participant 参加者
   */
  participantConnected: (participant) => {
    // 参加者を表示する 
    const div = document.createElement('div');
    div.id = participant.sid;
    div.classList.add('video');

    // 参加者のトラック（映像、音声など）を処理
    participant.tracks.forEach((publication) => {
      if (publication.isSubscribed) {
        this.trackSubscribed(div, publication.track);
        this.handleTrackChanged(publication.track);
      }
      publication.on('subscribed', this.handleTrackChanged);
    });

    // 参加者の映像が届いたとき
    participant.on('trackSubscribed', (track) => TwilioVideoPlayer.trackSubscribed(div, track));

    // 参加者の映像が切れたとき
    participant.on('trackUnsubscribed', TwilioVideoPlayer.trackUnsubscribed);

    document.getElementById('video-container').appendChild(div);
  },
  /**
   * 他の参加者が退室したとき
   * @param {Participant } participant 参加者
   */
  participantDisconnected: (participant) => {
    // 他の参加者の画面を削除する
    document.getElementById(participant.sid).remove();
  },
  /**
   * トラックの購読を行う。
   * @param {Element} div 購読する要素
   * @param {Track} track トラック
   */
  trackSubscribed(div, track) {
    // トラックをアタッチする
    div.appendChild(track.attach());
  },
  /**
   * トラックの購読をやめる
   * @param {Track} track トラック
   */
  trackUnsubscribed(track) {
    // トラックのデタッチ
    track.detach().forEach((element) => element.remove());
  },
  /**
   * リモート側のマイク・カメラが切り替わったとき
   * @param {Track} track トラック
   */
  handleTrackChanged(track) {
    track.on('disabled', () => {
      console.log('remote media off')
    });
    track.on('enabled', () => {
      console.log('remote media on')
    });
  },

  // handleTrackChanged: (track, participant) => {
  //   const dom = document.getElementById(participant.sid);

  //   // TODO 未確認

  //   // ミュートアイコンを表示
  //   const muteIcon = (dom) => {
  //       const remote_mic = document.createElement('div');
  //       // remote_mic.id = 'remote-mic';
  //       // remote_mic.classList.add('remote-mic');
  //       // const mic = document.createElement('sp');
  //       // mic.classList.add('mic-image');
  //       // mic.style.backgroundImage = "url('./images/mic_off.png')";
  //       // remote_mic.append(mic);
  //       remote_mic.textContent = "mute";
  //       dom.append(remote_mic);
  //   };

  //   if (track.kind === 'audio' && !track.isEnabled) {
  //       // 参加中のメンバーがすでにマイクをOFFにしているのでミュートアイコンを表示
  //       muteIcon(dom);
  //   }
  //   // 参加中のメンバーがマイクをOFFにしたときの処理
  //   track.on('disabled', () => {
  //       if (track.kind === 'audio') {
  //           // ミュートアイコンを表示
  //           muteIcon(dom);
  //       }
  //   });
  //   // 参加中のメンバーがマイクをONにしたときの処理
  //   track.on('enabled', () => {
  //       if (track.kind === 'audio') {
  //           // ミュートアイコンを削除
  //           dom.childNodes.forEach((node) => {
  //               if (node.id === 'remote-mic') node.remove();
  //           });
  //       }
  //   });
  // },
};