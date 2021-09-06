const TwilioVideoPlayer = {
  // My Video Element Id
  myVideoSelector: null,
  // Twilio Video
  videoRoom: null,
  screenTrack: null,
  /**
   * ルームに接続する
   * @param {string} roomElementId ビデオを表示するHTMLのid属性
   * @param {string} token アクセストークン
   * @param {string} roomname ルーム名
   */
  connect(roomElementId, token, roomname) {
    this.myVideoSelector = roomElementId;
    // プレビュー画面の表示
    Twilio.Video.createLocalVideoTrack({video: true, audio: true})
      .then((track) => {
        const localMediaContainer = document.getElementById(roomElementId);
        this.addNotifyMediaIcons(localMediaContainer, roomElementId);
        localMediaContainer.appendChild(track.attach());
      });
    // 部屋に入室
    Twilio.Video.connect(token, {name: roomname, audio: true,　video: true})
      .then((room) => {
        this.videoRoom = room;

        // すでに入室している参加者を表示
        room.participants.forEach(this.participantConnected);

        // 誰かが入室してきたときの処理
        room.once('participantConnected', this.participantConnected);

        // 誰かが退室したときの処理
        room.once('participantDisconnected', this.participantDisconnected);

        // 自分が退室したときの処理
        room.once('disconnected', room => {
          // Detach the local media elements
          room.localParticipant.tracks.forEach((publication) => {
            const attachedElements = publication.track.detach();
            attachedElements.forEach((element) => element.remove());
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
   * 対象の要素にメディアの状態を表示するアイコンを追加する
   * @param {string} element 追加要素
   * @param {String} participantSid 参加者SID
   */
  addNotifyMediaIcons (element, participantSid) {
    // const notifyVideoIcon = document.createElement('i')
    // notifyVideoIcon.classList.add('fas', 'fa-video', 'nootify-video');
    // notifyVideoIcon.id = `notify-video-${participantSid}`;
    // element.appendChild(notifyVideoIcon);
    const notifyMicIcon = document.createElement('i')
    notifyMicIcon.classList.add('fas', 'fa-microphone', 'notify-mic');
    notifyMicIcon.id = `notify-mic-${participantSid}`;
    element.appendChild(notifyMicIcon);
  },
  /**
   * カメラのON/OFFを行う
   * @param {boolean} isOn true: onにする, false: offにする
   */
  cameraControl(isOn) {
    this.videoRoom.localParticipant.videoTracks.forEach((publication) => {
      if (isOn) {
        publication.track.enable();
        $(`#notify-video-${this.myVideoSelector}`).removeClass('fa-video-slash').addClass('fa-video');
      } else {
        publication.track.disable();
        $(`#notify-video-${this.myVideoSelector}`).removeClass('fa-video').addClass('fa-video-slash');
      }
    });
  },
  /**
   * マイクのON/OFFを行う
   * @param {boolean} isOn true: onにする, false: offにする
   */
  micControl(isOn) {
    this.videoRoom.localParticipant.audioTracks.forEach((publication) => {
      if (isOn) {
        publication.track.enable();
        $(`#notify-mic-${this.myVideoSelector}`).removeClass('fa-microphone-slash').addClass('fa-microphone');
      } else {
        publication.track.disable()
        $(`#notify-mic-${this.myVideoSelector}`).removeClass('fa-microphone').addClass('fa-microphone-slash');
      }
    });
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
          this.screenTrack.mediaStreamTrack.onended = () => {
            this.videoRoom.localParticipant.unpublishTrack(this.screenTrack);
            this.screenTrack.stop();
            this.screenTrack = null;
           };
        });
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
        this.handleTrackChanged(publication.track, participant);
      }
      publication.on('subscribed', (track) => TwilioVideoPlayer.handleTrackChanged(track, participant));
    });

    // 参加者の映像が届いたとき
    participant.on('trackSubscribed', (track) => this.trackSubscribed(div, track));

    // 参加者の映像が切れたとき
    participant.on('trackUnsubscribed', this.trackUnsubscribed);

    TwilioVideoPlayer.addNotifyMediaIcons(div, participant.sid);
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
        this.handleTrackChanged(publication.track, participant);
      }
      publication.on('subscribed', (track) => TwilioVideoPlayer.handleTrackChanged(track, participant));
    });

    // 参加者の映像が届いたとき
    participant.on('trackSubscribed', (track) => TwilioVideoPlayer.trackSubscribed(div, track));

    // 参加者の映像が切れたとき
    participant.on('trackUnsubscribed', TwilioVideoPlayer.trackUnsubscribed);
    TwilioVideoPlayer.addNotifyMediaIcons(div, participant.sid);
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
   * ビデオの状態はわかるため、マイクの状態を通知する。
   * @param {Track} track トラック
   * @param {participant} participant 参加者
   */
  handleTrackChanged(track, participant) {
    const micIconHandler = (isOn) => {
      if (isOn) {
        $(`#notify-mic-${participant.sid}`).removeClass('fa-microphone-slash').addClass('fa-microphone');
      } else {
        $(`#notify-mic-${participant.sid}`).removeClass('fa-microphone').addClass('fa-microphone-slash');
      }      
    }
    // 参加中のメンバーがすでにマイクをOFF
    if (track.kind === 'audio' && !track.isEnabled) {
      micIconHandler(false);
    }
    track.on('disabled', () => {
      if (track.kind === 'audio') {
        micIconHandler(false);
      }
    });
    track.on('enabled', () => {
      if (track.kind === 'audio') {
        micIconHandler(true);
      }
    });
  },
};