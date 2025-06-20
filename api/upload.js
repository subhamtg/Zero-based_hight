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
    fields[name] = val;
  });

  bb.on('close', async () => {
    const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
    const CHAT_ID = process.env.CHAT_ID;

    if (!TELEGRAM_TOKEN || !CHAT_ID) {
      return res.status(500).send("❌ Environment variables missing");
    }

    const { name, username, email, note } = fields;

    // Optional uniqueness check (can add logic here later)
    const caption = `📤 New Upload by ${name || 'Unknown'}\n👤 Username: ${username}\n📧 Email: ${email}\n📝 Note: ${note || 'None'}`;

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
        res.status(200).send("✅ File sent to Telegram!");
      } else {
        res.status(500).send("❌ Telegram error: " + JSON.stringify(result));
      }
    } catch (err) {
      res.status(500).send("❌ Upload Failed: " + err.message);
    }
  });

  req.pipe(bb);
}
