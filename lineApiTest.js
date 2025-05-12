'use strict';
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '/config/.env') });

const line = require('@line/bot-sdk');
const express = require('express');
const axios = require('axios');
const qs = require('qs'); // 重要：需要用 x-www-form-urlencoded

const config = {
  channelAccessToken: process.env.CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.CHANNEL_SECRET,
};

const flexMessage = {
    "type": "bubble",
    "body": {
      "type": "box",
      "layout": "vertical",
      "contents": [
        {
          "type": "image",
          "url": "https://developers-resource.landpress.line.me/fx/clip/clip3.jpg",
          "size": "full",
          "aspectMode": "cover",
          "aspectRatio": "1:1",
          "gravity": "center"
        },
        {
          "type": "box",
          "layout": "vertical",
          "contents": [],
          "position": "absolute",
          "width": "100%",
          "height": "40%",
          "offsetBottom": "0px",
          "offsetStart": "0px",
          "offsetEnd": "0px",
          "backgroundColor": "#00000099"
        },
        {
          "type": "box",
          "layout": "horizontal",
          "contents": [
            {
              "type": "box",
              "layout": "vertical",
              "contents": [
                {
                  "type": "box",
                  "layout": "horizontal",
                  "contents": [
                    {
                      "type": "text",
                      "text": "請上傳圖片",
                      "size": "xl",
                      "color": "#ffffff",
                      "weight": "bold"
                    }
                  ]
                }
              ],
              "spacing": "xs"
            }
          ],
          "position": "absolute",
          "offsetBottom": "0px",
          "offsetStart": "0px",
          "offsetEnd": "0px",
          "paddingAll": "20px"
        }
      ],
      "paddingAll": "0px"
    }
};

const chatgptKey = process.env.OPENAI_API_KEY;

const client = new line.Client(config);
const app = express();
const userContexts = {}; // 用來儲存每個使用者的對話記憶

// webhook endpoint
app.post('/callback', line.middleware(config), (req, res) => {
  Promise.all(req.body.events.map(handleEvent))
    .then((result) => res.json(result))
    .catch((err) => {
      console.error('LINE Callback 錯誤：', err);
      res.status(500).end();
    });
});

// 簡單測試
app.get('/', (req, res) => {
  res.json('ok');
});

// 處理事件
async function handleEvent(event) {
  if (
    event.replyToken === '00000000000000000000000000000000' ||
    event.replyToken === 'ffffffffffffffffffffffffffffffff'
  ) {
    return Promise.resolve(null);
  }

  if (event.type === 'message' && event.message.type === 'text') {
    const userId = event.source.userId;
    const userMessage = event.message.text;

    // 初始化對話記憶（每個使用者一組 messages）
    if (!userContexts[userId]) {
      userContexts[userId] = [
        {
          role: "system",
          content: "你是一個幽默風趣、活潑可愛、講話像青春少女的 AI 助理，喜歡加表情符號和貼心語氣，請用繁體中文回答。"
        }
      ];
    }

    // 加入使用者輸入
    userContexts[userId].push({
      role: "user",
      content: userMessage
    });

    // 呼叫 OpenAI API
    const gptResponse = await axios.post('https://api.openai.com/v1/chat/completions', {
      model: "gpt-3.5-turbo",
      temperature: 0.7,
      messages: userContexts[userId]
    }, {
      headers: {
        'Authorization': `Bearer ${chatgptKey}`,
        'Content-Type': 'application/json'
      }
    });

    const replyText = gptResponse.data.choices[0].message.content;

    // 加入 AI 回覆到記憶中
    userContexts[userId].push({
      role: "assistant",
      content: replyText
    });

    // ✅ 保留最近 10 則對話（不含 system），即 user + assistant 共 10 則
    const systemMessage = userContexts[userId][0];
    const recentMessages = userContexts[userId].slice(-20); // 10 user + 10 assistant = 20 條
    userContexts[userId] = [systemMessage, ...recentMessages];

    // 回傳訊息到 LINE
    await client.replyMessage(event.replyToken, {
      type: 'text',
      text: replyText
    });

    return true;
  }

  return Promise.resolve(null);
}


const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`🚀 listening on ${port}`);
});
