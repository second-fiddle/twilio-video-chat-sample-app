const TwilioChat = {
  client: null,
  conversation: null,
  async initialize(token, sid) {
    const client = await Twilio.Conversations.Client.create(token);
    /**
     * チャットルーム状態変更イベント
     */
    client.on("connectionStateChanged", async (state) => {
      console.log("connectionStateChanged", state);
      if (state === 'connected') {
        // const conversation = await client.getConversationBySid(sid);
        // await conversation.join().catch((err) => console.log(err));
      }
    });
    /**
     * チャットルーム接続イベrンと
     */
    client.on("conversationJoined", (conversation) => {
      console.log("joined");
      // conversation.getMessages()
      //     .then((messagePaginator) => {
      //       console.log(messagePaginator);
      //     })
      //     .catch((err) => console.log(err));
      // conversation.on('messageAdded', (message) => {
      //   console.log(message);
      // });
      // conversation.sendMessage('hello');
    });

    const conversation = await client.getConversationBySid(sid);
    await conversation.join().catch((err) => console.log(err));
    this.conversation = conversation;
    /**
     * メッセージ受信イベント
     */
    conversation.on('messageAdded', (message) => {
      $(document).trigger('twilio-message-received', message.state);
    });

    this.client = client;
  },
  /**
   * メッセージを送信する。
   * @param {string} message メッセージ
   */
  sendMessage(message) {
    this.conversation.sendMessage(message).catch((err) => console.log(err));
  },
  /**
   * ファイルを添付する。
   * @param {File} file ファイル
   */
  sendAttachFile(file) {
    const formData = new FormData();
    formData.append('userfile', file);
    this.conversation.sendMessage(formData).catch((err) => console.log(err));

  }
};