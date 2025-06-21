const fs = require('fs');
const path = require('path');
const FormData = require('form-data');
const fetch = require('node-fetch');
const busboy = require('busboy');

const usersPath = path.resolve(__dirname, '../../users.json');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).send("Method Not Allowed");

  const bb = busboy({ headers: req.headers });
  let fileBuffer = Buffer.alloc(0);
  let fileName = "";
  let fields = {};

  bb.on('file', (name, file, info) => {
    fileName = info.filename;
    file.on('data', data => {
      fileBuffer = Buffer.concat([fileBuffer, data]);
    });
  });

  bb.on('field', (name, val) => {
    fields[name] = val.trim();
  });

  bb.on('close', async () => {
    const { name, username, email, note } = fields;

    // Step 1: Read existing users from JSON
    let users = [];
    if (fs.existsSync(usersPath)) {
      const raw = fs.readFileSync(usersPath, 'utf-8');
      users = JSON.parse(raw || '[]');
    }

    // Step 2: Check if user already exists (by username or email)
    const alreadyExists = users.some(
      (u) => u.username.toLowerCase() === username.toLowerCase() || u.email.toLowerCase() === email.toLowerCase()
    );
    if (alreadyExists) {
      return res.status(400).send("❌ Username or Email already exists!");
    }

    // Step 3: Save new user to JSON
    users.push({ name, username, email, time: new Date().toISOString() });
    fs.writeFileSync(usersPath, JSON.stringify(users, null, 2));

    // Step 4: Send file to Telegram
    const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
    const CHAT_ID = process.env.CHAT_ID;
    if (!TELEGRAM_TOKEN || !CHAT_ID) return res.status(500).send("❌ Missing ENV variables");

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
        res.status(200).send("✅ File uploaded and user saved!");
      } else {
        res.status(500).send("❌ Telegram Error: " + JSON.stringify(result));
      }
    } catch (err) {
      res.status(500).send("❌ Upload Failed: " + err.message);
    }
  });

  req.pipe(bb);
};
