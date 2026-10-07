const axios = require("axios");


module.exports = async function handler(req, res) {


  // CORS
  res.setHeader(
    "Access-Control-Allow-Origin",
    "*"
  );

  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type"
  );


  if(req.method === "OPTIONS"){
    res.status(200).end();
    return;
  }



  if(req.method !== "POST"){

    res.status(405).json({
      error:"Method Not Allowed"
    });

    return;
  }



  const {
    message,
    conversation_id,
    user_id
  } = req.body;



  if(!message){

    res.status(400).json({
      error:"消息不能为空"
    });

    return;
  }



  try{


    const response = await axios.post(

      "https://api.coze.cn/v3/chat",

      {

        bot_id:
        process.env.COZE_BOT_ID,


        user_id:
        user_id || "web_user",


        stream:false,


        additional_messages:[

          {

            role:"user",

            content:message,

            content_type:"text"

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

          "Content-Type":
          "application/json"

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

      success:false,

      error:
      "AI 服务失败"

    });


  }


};
