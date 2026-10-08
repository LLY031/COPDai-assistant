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



// ================================
// AI 对话接口（非流式）
// ================================
app.post('/api/chat', async (req, res) => {

  const {
    message,
    conversation_id,
    user_id
  } = req.body;


  // -------------------------------
  // 参数检查
  // -------------------------------
  if (!message || !message.trim()) {

    return res.status(400).json({
      error: '消息不能为空'
    });

  }



  console.log('');
  console.log('========================================');
  console.log('收到新的 AI 请求');
  console.log('用户消息:', message);
  console.log(
    'conversation_id:',
    conversation_id || '新会话'
  );
  console.log(
    'user_id:',
    user_id || 'web_user'
  );
  console.log('========================================');



  try {


    // ================================
    // 调用扣子 API
    // ================================
    const response = await axios.post(

      'https://api.coze.cn/v3/chat',

      {

        bot_id:
          process.env.COZE_BOT_ID,


        user_id:
          user_id || 'web_user',


        // 非流式
        stream: false,


        additional_messages: [

          {
            role: 'user',

            content: message,

            content_type: 'text'
          }

        ],


        // 继续历史会话
        ...(conversation_id
          ? {
              conversation_id:
                conversation_id
            }
          : {})

      },


      {

        headers: {

          'Authorization':
            `Bearer ${process.env.COZE_API_TOKEN}`,


          'Content-Type':
            'application/json'

        },

        timeout: 60000

      }

    );




    console.log(
      '扣子返回:',
      JSON.stringify(response.data)
    );




     let answer = '';

    let newConversationId =
      conversation_id || '';



    const data =
      response.data;



    // 获取 conversation_id

    if (data.conversation_id) {

      newConversationId =
        data.conversation_id;

    }



    // Coze v3 返回 messages

    if (
      data.messages &&
      Array.isArray(data.messages)
    ) {


      const assistantMessage =
        data.messages.find(
          item =>
            item.role === 'assistant'
        );


      if (assistantMessage) {

        answer =
          assistantMessage.content || '';

      }

    }




    // 兼容部分返回格式

    if (!answer && data.content) {

      answer =
        data.content;

    }




    console.log(
      'AI回复:',
      answer
    );




    // ================================
    // 返回前端
    // ================================

    return res.json({

      type: 'answer',

      content: answer,

      conversation_id:
        newConversationId,

      done: true

    });



  }




  // ================================
  // 错误处理
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



    return res.status(500).json({

      type: 'error',

      message:
        'AI 服务请求失败，请检查服务器配置'

    });


  }


});





// ================================
// 导出 Express
// ================================
module.exports = app;





// ================================
// 本地运行
// ================================

if (require.main === module) {


  const PORT =
    process.env.PORT || 3000;



  app.listen(
    PORT,
    "0.0.0.0",
    () => {


      console.log(
        `🚀 本地服务器运行：http://localhost:${PORT}`
      );


    }

  );

}
