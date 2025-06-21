const FormData = require('form-data');
const fetch = require('node-fetch');
const busboy = require('busboy');

// In-memory store (replace with DB or JSON file for persistence)
let storedUsers = [];

module.exports = async (req, res) => {
  if (req.method === 'POST') {
    const bb = busboy({ headers: req.headers });

    let fileBuffer = Buffer.alloc(0);
    let fileName = '';
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
      const { name, username, email, note } = fields;

      // 🔒 Check if user already exists
      const isDuplicate = storedUsers.find(
        (user) => user.username === username || user.email === email
      );

      if (isDuplicate) {
        return res.status(400).send("❌ Username or Email already exists!");
      }

      // ✅ Add user to stored list
      storedUsers.push({ name, username, email });

      const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
      const CHAT_ID = process.env.CHAT_ID;

      if (!TELEGRAM_TOKEN || !CHAT_ID) {
        return res.status(500).send("❌ Missing Telegram credentials");
      }

      const caption = `📤 *Upload by:* ${name}\n👤 *Username:* ${username}\n✉️ *Email:* ${email}\n📝 *Note:* ${note || 'None'}`.replace(/[_*[\]()~`>#+=|{}.!-]/g, '\\$&');

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
          res.status(200).send("✅ File uploaded to Telegram Cloud!");
        } else {
          res.status(500).send("❌ Telegram Error: " + JSON.stringify(result));
        }
      } catch (err) {
        res.status(500).send("❌ Upload Failed: " + err.message);
      }
    });

    req.pipe(bb);
  } else {
    res.status(405).send("Method Not Allowed");
  }
};
