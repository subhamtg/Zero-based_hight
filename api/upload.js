const FormData = require('form-data');
const fetch = require('node-fetch');
const busboy = require('busboy');

module.exports = async (req, res) => {
  if (req.method === 'POST') {
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
      fields[name] = val;
    });

    bb.on('close', async () => {
      const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
      const CHAT_ID = process.env.CHAT_ID;

      if (!TELEGRAM_TOKEN || !CHAT_ID) {
        return res.status(500).send("❌ Missing environment variables");
      }

      const caption = `📤 *New Upload from ${fields.name}*\n✉️ Email: ${fields.email}\n📝 Message: ${fields.note || 'None'}`;
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
  } else {
    res.status(405).send("Method Not Allowed");
  }
};
