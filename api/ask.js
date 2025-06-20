const fetch = require('node-fetch');

module.exports = async (req, res) => {
  if (req.method === 'POST') {
    try {
      const { text } = await req.json(); // Message from user

      if (!process.env.OPENAI_KEY || !process.env.TELEGRAM_TOKEN || !process.env.CHAT_ID) {
        return res.status(500).send("Missing environment variables");
      }

      // Step 1: Send message to OpenAI
      const aiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${process.env.OPENAI_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "gpt-3.5-turbo",
          messages: [{ role: "user", content: text }]
        })
      });

      const data = await aiResponse.json();
      const reply = data.choices?.[0]?.message?.content || "❌ AI response failed";

      // Step 2: Send AI reply to Telegram
      await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_TOKEN}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: process.env.CHAT_ID,
          text: `🤖 AI says:\n${reply}`
        })
      });

      return res.status(200).send("✅ Replied with AI!");
    } catch (err) {
      return res.status(500).send("Error: " + err.message);
    }
  } else {
    res.status(405).send("Method Not Allowed");
  }
};
