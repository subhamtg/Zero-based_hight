const busboy = require('busboy');
const FormData = require('form-data');
const fetch = require('node-fetch');

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).send("Method Not Allowed");
  }

  const bb = busboy({ headers: req.headers });
  let fileBuffer = Buffer.alloc(0);
  let fileName = "";
  const fields = {};

  bb.on('file', (name, file, info) => {
    fileName = info.filename;
    file.on('data', (data) => {
      fileBuffer = Buffer.concat([fileBuffer, data]);
    });
  });

  bb.on('field', (name, val) => {
    fields[name] = val.trim();
  });

  bb.on('close', async () => {
    const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
    const CHAT_ID = process.env.CHAT_ID;

    if (!TELEGRAM_TOKEN || !CHAT_ID) {
      return res.status(500).send("❌ Environment variables missing");
    }

    const { name, username, email, note } = fields;

    // Check if required fields are filled
    if (!name || !username || !email || !fileBuffer.length) {
      return res.status(400).send("❌ Missing required fields.");
    }

    // STEP 1: Fetch message history
    let existingUsernames = [];
    let existingEmails = [];

    try {
      const historyRes = await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/getUpdates`);
      const history = await historyRes.json();

      const messages = history.result
        .map(m => m.message?.text)
        .filter(Boolean);

      existingUsernames = messages
        .filter(m => m.includes("USERNAME:"))
        .map(m => m.split("|")[1]?.replace("USERNAME:", "").trim().toLowerCase());

      existingEmails = messages
        .filter(m => m.includes("EMAIL:"))
        .map(m => m.split("|")[2]?.replace("EMAIL:", "").trim().toLowerCase());
    } catch (err) {
      return res.status(500).send("❌ Failed to check duplicates: " + err.message);
    }

    // STEP 2: Check if username or email exists
    if (existingUsernames.includes(username.toLowerCase())) {
      return res.status(400).send(`❌ Username "${username}" already exists.`);
    }

    if (existingEmails.includes(email.toLowerCase())) {
      return res.status(400).send(`❌ Email "${email}" already exists.`);
    }

    // STEP 3: Proceed to send file
    const caption = `📤 File Upload\nNAME: ${name} | USERNAME: ${username} | EMAIL: ${email}\n📝 Note: ${note || 'None'}`;

    const form = new FormData();
    form.append('chat_id', CHAT_ID);
    form.append('caption', caption);
    form.append('document', fileBuffer, fileName);

    try {
      const tgRes = await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendDocument`, {
        method: 'POST',
        body: form
      });

      const result = await tgRes.json();

      if (result.ok) {
        return res.status(200).send("✅ File uploaded and saved to Telegram Cloud.");
      } else {
        return res.status(500).send("❌ Telegram Error: " + JSON.stringify(result));
      }
    } catch (err) {
      return res.status(500).send("❌ Upload Failed: " + err.message);
    }
  });

  req.pipe(bb);
}
