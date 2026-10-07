const axios = require('axios');

module.exports = async function handler(req, res) {

  if (req.method !== 'POST') {
    return res.status(405).json({
      error: 'Method Not Allowed'
    });
  }


  const {
    message,
    conversation_id,
    user_id
  } = req.body;


  if (!message || !message.trim()) {

    return res.status(400).json({
      error: '消息不能为空'
    });

  }


  try {


    const response = await axios.post(

      'https://api.coze.cn/v3/chat',

      {

        bot_id:
          process.env.COZE_BOT_ID,


        user_id:
          user_id || 'web_user',


        stream:false,


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



    res.json({

      success:true,

      data:
      response.data

    });



  }

  catch(error){


    console.error(
      error.response?.data ||
      error.message
    );


    res.status(500).json({

      error:
      'AI请求失败'

    });


  }

};
