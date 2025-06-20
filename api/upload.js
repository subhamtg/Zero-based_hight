const FormData = require('form-data');
const fetch = require('node-fetch');
const busboy = require('busboy');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).send("Method Not Allowed");
  }

  const bb = busboy({ headers: req.headers });

  let fileBuffer = Buffer.alloc(0);
  let fileName = "";
  let fields = {};

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
      return res.status(500).send("❌ Missing environment variables");
    }

    const { name, username, email, note } = fields;

    if (!name || !username || !email || !fileBuffer.length) {
      return res.status(400).send("❌ Please fill in all required fields.");
    }

    // 🔍 Step 1: Check for existing username/email in Telegram updates
    try {
      const updatesRes = await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/getUpdates`);
      const updates = await updatesRes.json();

      const messages = updates.result
        .map(u => u.message?.caption || '')
        .filter(Boolean);

      const existingUsernames = messages
        .filter(m => m.includes("Username:"))
        .map(m => m.match(/Username:\s*(\S+)/i)?.[1]?.toLowerCase())
        .filter(Boolean);

      const existingEmails = messages
        .filter(m => m.includes("Email:"))
        .map(m => m.match(/Email:\s*(\S+)/i)?.[1]?.toLowerCase())
        .filter(Boolean);

      if (existingUsernames.includes(username.toLowerCase())) {
        return res.status(400).send(`❌ Username "${username}" already exists.`);
      }

      if (existingEmails.includes(email.toLowerCase())) {
        return res.status(400).send(`❌ Email "${email}" already exists.`);
      }

    } catch (err) {
      return res.status(500).send("❌ Error checking existing users: " + err.message);
    }

    // ✅ Step 2: Upload to Telegram
    const caption = `📤 *New Upload from ${name}*\nUsername: ${username}\nEmail: ${email}\n📝 Message: ${note || 'None'}`;
    const form = new FormData();
    form.append('chat_id', CHAT_ID);
    form.append('document', fileBuffer, fileName);
    form.append('caption', caption);
    form.append('parse_mode', 'Markdown');

    try {
      const tgRes = await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendDocument`, {
        method: 'POST',
        body: form
      });

      const result = await tgRes.json();
      if (result.ok) {
        res.status(200).send("✅ File + info sent to Telegram!");
      } else {
        res.status(500).send("❌ Telegram Error: " + JSON.stringify(result));
      }
    } catch (err) {
      res.status(500).send("❌ Upload Failed: " + err.message);
    }
  });

  req.pipe(bb);
};
