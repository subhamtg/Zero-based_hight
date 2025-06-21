const fs = require('fs');
const path = require('path');
const FormData = require('form-data');
const fetch = require('node-fetch');
const busboy = require('busboy');

// Path to users.json
const usersFile = path.resolve(__dirname, '../../users.json');

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

    // Read existing users
    let users = [];
    if (fs.existsSync(usersFile)) {
      const raw = fs.readFileSync(usersFile, 'utf8');
      users = JSON.parse(raw || '[]');
    }

    // Check if username or email already exists
    const exists = users.find(
      (u) => u.username.toLowerCase() === username.toLowerCase() || u.email.toLowerCase() === email.toLowerCase()
    );

    if (exists) {
      return res.status(400).send("❌ Username or email already exists!");
    }

    // Add new user to file
    users.push({ name, username, email, time: new Date().toISOString() });
    fs.writeFileSync(usersFile, JSON.stringify(users, null, 2));

    // Proceed to Telegram upload
    const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
    const CHAT_ID = process.env.CHAT_ID;

    if (!TELEGRAM_TOKEN || !CHAT_ID) {
      return res.status(500).send("❌ Missing Telegram credentials");
    }

    const safeNote = (note || 'None').replace(/[_*[\]()~`>#+=|{}.!-]/g, '\\$&');

    const caption = `📤 *Upload by:* ${name}\n👤 *Username:* ${username}\n✉️ *Email:* ${email}\n📝 *Note:* ${safeNote}`;

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
};
