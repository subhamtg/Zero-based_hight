const multer = require("multer");
const axios = require("axios");
const FormData = require("form-data");
const fs = require("fs");

const upload = multer({ dest: "/tmp" });

function runMiddleware(req, res, fn) {
  return new Promise((resolve, reject) => {
    fn(req, res, (result) => (result instanceof Error ? reject(result) : resolve(result)));
  });
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).send("Method not allowed");

  await runMiddleware(req, res, upload.single("photo"));

  const { name, age, id } = req.body;
  const photo = req.file;

  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  const caption = `👤 Name: ${name}\n🎂 Age: ${age}\n🆔 ID: ${id}`;
  const form = new FormData();
  form.append("chat_id", chatId);
  form.append("caption", caption);
  form.append("photo", fs.createReadStream(photo.path));

  try {
    await axios.post(`https://api.telegram.org/bot${botToken}/sendPhoto`, form, {
      headers: form.getHeaders(),
    });
    res.status(200).send("✅ Uploaded to Telegram");
  } catch {
    res.status(500).send("❌ Failed to send");
  }
}
