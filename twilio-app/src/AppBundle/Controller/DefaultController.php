<?php

namespace AppBundle\Controller;

use Symfony\Bundle\FrameworkBundle\Controller\Controller;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Annotation\Route;

use Twilio\Exceptions\RestException;
use Twilio\Jwt\AccessToken;
use Twilio\Jwt\Grants\ChatGrant;
use Twilio\Jwt\Grants\VideoGrant;
use Twilio\Rest\Client;

class DefaultController extends Controller
{
    /**
     * @Route("/")
     */
    public function indexAction(Request $request)
    {
        return $this->render('default/index.html.twig', []);
    }
    /**
     * @Route("/enter")
     */
    public function enterAction(Request $request)
    {
        $username     = $request->request->get('username'); // 認証情報から取得
        $enterMethod  = $request->request->get('enterMethod');
        $roomname     = $request->request->get('roomname');
        $videoRoomSid = $request->request->get('videoRoomSid');
        $chatRoomSid  = $request->request->get('chatRoomSid');
        $twilioAccountSid = $this->container->getParameter('twilio.account.sid');
        $twilioAccountToken = $this->container->getParameter('twilio.account.token');
        $twilioApiKey = $this->container->getParameter('twilio.api_key');
        $twilioApiSecret = $this->container->getParameter('twilio.api_secret');
        $twilioChatSid = $this->container->getParameter('twilio.chat.sid');

        $twilio = new Client($twilioAccountSid, $twilioAccountToken);

        /*
         * 同時実行されないように制御が必要
         */

        // テーブルの状態で判断する？？？
        if ($enterMethod == '1') {
            // ビデオルーム作成
            $videoRoom = $twilio->video->v1->rooms->create([
                "uniqueName" => $roomname,
                "statusCallback" => "", 
            ]);
            $videoRoomSid = $videoRoom->sid;
            // チャットルーム作成
            $conversation = $twilio->conversations->v1->conversations->create([
                'uniqueName' => $roomname,
                'friendlyName' => $roomname
            ]);
            $chatRoomSid = $conversation->sid;
        } else {
            // ビデオルームを取得する
            $videoRoom = $twilio->video->v1->rooms($videoRoomSid)->fetch();
            $roomname = $videoRoom->uniqueName;
            // チャットルームを取得する
            // $conversation = $twilio->conversations->v1->conversation($chatRoomSid)->fetch();
        }
        // チャットルームに参加者を取得
        $participants = $twilio->conversations->v1->conversations($chatRoomSid)
                                                  ->participants
                                                  ->read();
        // 参加済みか判定
        $participantSid = null;
        foreach ($participants as $participant) {
            if ($participant->identity == $username) {
                $participantSid = $participant->sid;
                break;
            }
        }
        // チャットルームに参加
        if (is_null($participantSid)) {
            $participant = $twilio->conversations->v1->conversations($chatRoomSid)
                                                     ->participants
                                                     ->create(["identity" => $username]);            
            $participantSid = $participant->sid;
        }

        // 認証トークン作成
        $token = new AccessToken(
            $twilioAccountSid,
            $twilioApiKey,
            $twilioApiSecret,
            3600,
            $username
        );

        $videoGrant = new VideoGrant();
        $videoGrant->setRoom($roomname);
        $token->addGrant($videoGrant);

        $chatGrant = new ChatGrant();
        $chatGrant->setServiceSid($twilioChatSid);
        $token->addGrant($chatGrant);

        return $this->render('default/player.html.twig', [
            'token'          => $token->toJWT(),
            'username'       => $username,
            'roomname'       => $roomname,
            'videoRoomSid'   => $videoRoomSid,
            'chatRoomSid'    => $chatRoomSid,
            'participantSid' => $participantSid,
        ]);
    }
}
