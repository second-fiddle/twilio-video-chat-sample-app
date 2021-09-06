const TwilioVideoPlayer = {
  // Twilio Video JS SDK
  videoRoom: null,
  screenTrack: null,
  /**
   * ルームに接続する
   * @param {string} roomElementId ビデオを表示するHTMLのid属性
   * @param {string} token アクセストークン
   * @param {string} roomname ルーム名
   */
  connect(roomElementId, token, roomname) {
    // プレビュー画面の表示
    Twilio.Video.createLocalVideoTrack({video: true, audio: true})
      .then((track) => {
        const localMediaContainer = document.getElementById(roomElementId);
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
   * カメラのON/OFFを行う
   * @param {boolean} isOn true: onにする, false: offにする
   */
  cameraControl(isOn) {
    this.videoRoom.localParticipant.videoTracks.forEach((publication) => {
      isOn ? publication.track.enable() : publication.track.disable()
    });
  },
  /**
   * マイクのON/OFFを行う
   * @param {boolean} isOn true: onにする, false: offにする
   */
  micControl(isOn) {
    this.videoRoom.localParticipant.audioTracks.forEach((publication) => 
      isOn ? publication.track.enable() : publication.track.disable());
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
        this.handleTrackChanged(publication.track);
      }
      publication.on('subscribed', TwilioVideoPlayer.handleTrackChanged);
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
      publication.on('subscribed', TwilioVideoPlayer.handleTrackChanged);
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
};