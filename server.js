const express = require('express');
const cors = require('cors');
const axios = require('axios');
require('dotenv').config();

const app = express();

// ================================
// 基础配置
// ================================
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

app.get('/', (req, res) => {
  res.sendFile(
    require('path').join(
      __dirname,
      'public',
      'index.html'
      
// ================================
// AI 对话接口
// ================================
app.post('/api/chat', async (req, res) => {

  const {
    message,
    conversation_id,
    user_id
  } = req.body;

  // -------------------------------
  // 基础参数检查
  // -------------------------------
  if (!message || !message.trim()) {
    res.status(400).json({
      error: '消息不能为空'
    });
    return;
  }

  // -------------------------------
  // SSE 响应头
  // -------------------------------
  res.setHeader(
    'Content-Type',
    'text/event-stream; charset=utf-8'
  );

  res.setHeader(
    'Cache-Control',
    'no-cache, no-transform'
  );

  res.setHeader(
    'Connection',
    'keep-alive'
  );

  // 防止 Nginx 等服务器缓冲 SSE
  res.setHeader(
    'X-Accel-Buffering',
    'no'
  );

  // 立即发送响应头
  if (res.flushHeaders) {
    res.flushHeaders();
  }


  console.log('');
  console.log('========================================');
  console.log('收到新的 AI 请求');
  console.log('用户消息:', message);
  console.log('conversation_id:', conversation_id || '新会话');
  console.log('user_id:', user_id || 'web_user');
  console.log('========================================');


  try {

    // ================================
    // 调用扣子 API
    // ================================
    const response = await axios.post(
      'https://api.coze.cn/v3/chat',
      {
        bot_id: process.env.COZE_BOT_ID,

        // 同一个浏览器使用同一个 user_id
        user_id: user_id || 'web_user',

        stream: true,

        // 当前用户消息
        additional_messages: [
          {
            role: 'user',
            content: message,
            content_type: 'text'
          }
        ],

        // 如果已经有 conversation_id，就继续之前的会话
        ...(conversation_id
          ? { conversation_id: conversation_id }
          : {})
      },
      {
        headers: {
          'Authorization':
            `Bearer ${process.env.COZE_API_TOKEN}`,

          'Content-Type':
            'application/json'
        },

        // 非常重要：让 axios 以流的方式接收
        responseType: 'stream'
      }
    );


    // ================================
    // SSE 缓冲区
    // ================================
    let buffer = '';


    // ================================
    // 接收扣子 SSE 数据
    // ================================
    response.data.on('data', (chunk) => {

      // chunk 可能只是一个 SSE 事件的一部分
      // 所以不能直接 JSON.parse
      buffer += chunk.toString('utf8');


      // SSE 事件一般以两个换行结束
      const events = buffer.split(/\r?\n\r?\n/);

      // 最后一个可能是不完整事件
      buffer = events.pop() || '';


      // ==============================
      // 逐个处理完整 SSE 事件
      // ==============================
      for (const eventBlock of events) {

        if (!eventBlock.trim()) {
          continue;
        }


        let eventName = '';
        let dataText = '';


        // ------------------------------
        // 拆分 event / data
        // ------------------------------
        const lines =
          eventBlock.split(/\r?\n/);


        for (const line of lines) {

          // event: xxx
          if (line.startsWith('event:')) {

            eventName =
              line
                .slice(6)
                .trim();
          }


          // data: xxx
          else if (line.startsWith('data:')) {

            dataText +=
              line
                .slice(5)
                .trim();
          }
        }


        // 没有 data 就跳过
        if (!dataText) {
          continue;
        }


        // ==============================
        // 扣子结束标记
        // ==============================
        if (dataText === '[DONE]') {
          continue;
        }


        // ==============================
        // JSON 解析
        // ==============================
        let data;

        try {

          data = JSON.parse(dataText);

        } catch (error) {

          console.log(
            '⚠️ SSE JSON 解析失败:',
            dataText
          );

          continue;
        }


        // ==============================
        // 获取 conversation_id
        // ==============================
        if (data.conversation_id) {

          res.write(
            `data: ${JSON.stringify({
              type: 'conversation',
              conversation_id:
                data.conversation_id
            })}\n\n`
          );
        }


        // ==================================================
        // ★★★ 核心：只转发 delta ★★★
        //
        // conversation.message.delta
        // 才是真正的增量文本
        //
        // conversation.message.completed
        // 不再把 content 发给前端
        //
        // 这就是解决“回答重复”的关键
        // ==================================================
        if (
          eventName ===
          'conversation.message.delta'
        ) {

          // 只处理 answer
          if (
            data.type === 'answer' &&
            data.content
          ) {

            console.log(
              '📩 delta:',
              JSON.stringify(data.content)
            );


            // 只把增量内容发送给网页
            res.write(
              `data: ${JSON.stringify({
                type: 'answer',
                content: data.content
              })}\n\n`
            );
          }
        }


        // ==================================================
        // AI 单条消息完成
        // ==================================================
        else if (
          eventName ===
          'conversation.message.completed'
        ) {

          console.log(
            '✅ AI 消息生成完成'
          );


          // 注意：
          // 这里只告诉前端“完成”
          // 绝对不能再次发送 data.content
          res.write(
            `data: ${JSON.stringify({
              type: 'completed'
            })}\n\n`
          );
        }


        // ==================================================
        // 整个对话完成
        // ==================================================
        else if (
          eventName ===
          'conversation.chat.completed'
        ) {

          console.log(
            '✅ 整个对话完成'
          );


          res.write(
            `data: ${JSON.stringify({
              type: 'chat_completed'
            })}\n\n`
          );
        }


        // ==================================================
        // 扣子错误
        // ==================================================
        else if (
          eventName ===
          'conversation.chat.failed'
        ) {

          console.error(
            '❌ 扣子对话失败:',
            data
          );


          res.write(
            `data: ${JSON.stringify({
              type: 'error',
              message:
                data.message ||
                'AI 对话失败'
            })}\n\n`
          );
        }
      }
    });


    // ================================
    // 扣子 SSE 正常结束
    // ================================
    response.data.on('end', () => {

      // 如果还有残留 buffer
      // 尝试处理最后的数据
      if (buffer.trim()) {

        console.log(
          '⚠️ SSE 最后存在未完整处理的数据:',
          buffer
        );
      }


      console.log(
        '🔚 扣子 SSE 连接结束'
      );


      // 告诉前端整个流结束
      res.write(
        `data: ${JSON.stringify({
          type: 'done'
        })}\n\n`
      );


      res.end();
    });


    // ================================
    // 扣子流发生错误
    // ================================
    response.data.on('error', (error) => {

      console.error(
        '❌ 扣子 SSE 流错误:',
        error.message
      );


      if (!res.writableEnded) {

        res.write(
          `data: ${JSON.stringify({
            type: 'error',
            message:
              'AI 服务连接发生错误'
          })}\n\n`
        );

        res.end();
      }
    });

  }


  // ================================
  // 请求扣子 API 失败
  // ================================
  catch (error) {

    console.error('');
    console.error(
      '========== 扣子 API 调用失败 =========='
    );

    console.error(
      '错误信息:',
      error.message
    );


    if (error.response) {

      console.error(
        '状态码:',
        error.response.status
      );

      console.error(
        '响应数据:',
        error.response.data
      );
    }


    console.error(
      '========================================'
    );


    if (!res.writableEnded) {

      res.write(
        `data: ${JSON.stringify({
          type: 'error',
          message:
            'AI 服务请求失败，请检查服务器配置'
        })}\n\n`
      );

      res.end();
    }
  }
});


// ================================
// 启动服务器
// ================================
const PORT =
  process.env.PORT || 3000;


if (require.main === module) {

  app.listen(PORT, "0.0.0.0", () => {

    console.log('');
    console.log('========================================');
    console.log('🚀 AI 智能助手后端启动成功');
    console.log(
      `🌐 http://localhost:${PORT}`
    );
    console.log('========================================');

  });

}


module.exports = app;
