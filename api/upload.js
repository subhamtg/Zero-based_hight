const FormData = require('form-data');
const fetch = require('node-fetch');
const busboy = require('busboy');
const supabase = require('../../lib/supabase'); // adjust if needed

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
    const { name, username, email, note } = fields;

    if (!name || !username || !email) {
      return res.status(400).send("❌ All fields are required!");
    }

    // 🔍 Check in Supabase
    const { data: existingUser, error } = await supabase
      .from('users')
      .select()
      .or(`username.eq.${username},email.eq.${email}`)
      .maybeSingle();

    if (error) {
      return res.status(500).send("❌ Supabase error: " + error.message);
    }

    if (existingUser) {
      return res.status(400).send("❌ Username or Email already exists!");
    }

    // 🆕 Insert new user into Supabase
    await supabase
      .from('users')
      .insert([{ name, username, email }]);

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
