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
// AI聊天接口
// ================================

app.post('/api/chat', async (req, res) => {


  const {
    message,
    conversation_id,
    user_id
  } = req.body;



  // ================================
  // 参数检查
  // ================================

  if (!message || !message.trim()) {

    return res.status(400).json({

      error: '消息不能为空'

    });

  }



  console.log('');
  console.log('================================');
  console.log('收到新的 AI 请求');

  console.log(
    '用户消息:',
    message
  );

  console.log(
    'conversation_id:',
    conversation_id || '新会话'
  );

  console.log(
    'user_id:',
    user_id || 'web_user'
  );

  console.log('================================');




  try {


    // ================================
    // 调用 Coze V3 非流式接口
    // ================================


    const response = await axios.post(

      'https://api.coze.cn/v3/chat',

      {


        bot_id:
          process.env.COZE_BOT_ID,


        user_id:
          user_id || 'web_user',



        // ★ 非流式
        stream: false,



        additional_messages:[

          {

            role:'user',

            content:message,

            content_type:'text'

          }

        ],



        ...(conversation_id
          ?
          {
            conversation_id:
              conversation_id
          }
          :
          {}
        )


      },


      {

        headers:{


          Authorization:
          `Bearer ${process.env.COZE_API_TOKEN}`,



          'Content-Type':
          'application/json'


        }


      }


    );




    console.log(
      '扣子返回:',
      JSON.stringify(response.data)
    );





    // ================================
    // 解析返回
    // ================================


    const data =
      response.data;



    let answer = '';



    let newConversationId =
      conversation_id || '';




    // 获取conversation_id

 if (
  data.data?.conversation_id
) {

  newConversationId =
    data.data.conversation_id;

}




    // Coze v3非流式返回

  // ================================
// 获取 chat_id
// ================================

const chatId =
  data.data?.id;


console.log(
  "chatId:",
  chatId
);


console.log(
  "conversationId:",
  newConversationId
);


if(!chatId){

  throw new Error(
    'Coze没有返回chat_id'
  );

}



// ================================
// 等待AI生成完成
// ================================

// 等待AI完成，最多轮询20次

let messages = [];

let lastMessageResponse = null;

for(let i=0;i<20;i++){


  lastMessageResponse =
await axios.get(

    'https://api.coze.cn/v3/chat/message/list',

    {

      params:{

        conversation_id:
          newConversationId,

        chat_id:
          chatId

      },


      headers:{

        Authorization:
        `Bearer ${process.env.COZE_API_TOKEN}`

      }

    }

  );


  messages =
lastMessageResponse.data?.data?.messages || [];



  const finished =
messages.find(

  item =>
  item.role === 'assistant' &&
  item.content &&
  item.content.trim()

);


if(finished){

  break;

}



// 等待1秒继续查询

  await new Promise(
    resolve =>
    setTimeout(resolve,1000)
  );

}






console.log(
  '消息列表:',
  JSON.stringify(
    lastMessageResponse?.data
  )
);




// ================================
// 提取AI回答
// ================================

if(Array.isArray(messages)){


const assistantMessage =
messages.find(

  item =>
  item.role === 'assistant' &&
  item.content

);
 if(assistantMessage){

   answer =
   assistantMessage.content || '';

 }


}



    console.log(
      'AI回复:',
      answer
    );




    // ================================
    // 返回前端
    // ================================


    return res.json({

  type:'answer',

  content:
    answer || 'AI没有生成有效回复',

  conversation_id:
    newConversationId

});



  }



  catch(error){



    console.error('');

    console.error(
      '========== Coze调用失败 =========='
    );


    console.error(
      error.message
    );



    if(error.response){


      console.error(
        '状态:',
        error.response.status
      );


      console.error(
        '数据:',
        error.response.data
      );


    }



    console.error(
      '================================'
    );




    return res.status(500).json({


      type:'error',

      message:
      'AI服务请求失败，请检查服务器配置'


    });



  }



});





// ================================
// 导出给 Netlify/Vercel
// ================================


module.exports = app;




// ================================
// 本地运行
// ================================


if(require.main === module){


  const PORT =
    process.env.PORT || 3000;



  app.listen(

    PORT,

    "0.0.0.0",

    ()=>{


      console.log(
        `🚀 服务运行:
        http://localhost:${PORT}`
      );


    }


  );


}
