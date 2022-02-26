const fs = require("fs");
const { Client, MessageMedia } = require("whatsapp-web.js");
const SESSION_FILE_PATH = "./session.json";
let sessionData;
const express = require("express");
const axios = require("axios");
const qrcode = require("qrcode-terminal");
const FormData = require("form-data");
const multer = require("multer");
const https = require("https");

const upload = multer({
  storage: multer.diskStorage({
    destination: function (req, file, cb) {
      cb(null, "storage/");
    },
    filename: function (req, file, cb) {
      cb(null, file.originalname);
    },
  }),
});

if (fs.existsSync(SESSION_FILE_PATH)) {
  sessionData = require(SESSION_FILE_PATH);
}

const client = new Client({
  session: sessionData,
});

client.on("authenticated", (session) => {
  sessionData = session;
  fs.writeFile(SESSION_FILE_PATH, JSON.stringify(session), (err) => {
    if (err) {
      console.error(err);
    }
  });
});

client.on("qr", (qr) => {
  qrcode.generate(qr, { small: true });
});

client.on("ready", () => {
  console.log("Client is ready!");
});

client.on("message", async (msg) => {
  try {
    if (msg.from != "status@broadcast") {
      console.log(msg);
      const contact = await msg.getContact();
      let form = new FormData();
      form.append("username", msg.from);
      form.append("pushname", contact.name ? contact.name : msg.from.replace("@c.us", ""));
      form.append("body", msg.body);
      if (msg.hasMedia) {
        const media = await msg.downloadMedia();
        const buff = Buffer.from(media.data, "base64");
        fs.writeFileSync("storage/" + media.filename, buff);
        form.append("file", fs.createReadStream("storage/" + media.filename));
        form.append("fileType", media.mimetype);
      }

      form.getLength((err, length) => {
        if (err) return reject(err);
        axios.post(
          (process.env.API_URL || "https://api.i5sistemas.com.br/api") +
            `/messages`,
          form,
          {
            headers: {
              ...form.getHeaders(),
              "Content-Length": length,
            },
          }
        );
      });
    }
  } catch (error) {
    console.error(error);
  }
});

client.initialize();

const app = express();
app.use(express.json());

app.get("", (req, res) => {
  res.send("Working!");
});

app.post("/message", upload.single("file"), (req, res) => {
  let message = req.body.message;
  if (req.file) {
    message = MessageMedia.fromFilePath(`./storage/${req.file.filename}`);
  }
  res.send(client.sendMessage(req.body.number, message));
});

app.listen(process.env.PORT || 3000, () =>
  console.log(`Server is ready in on port ${process.env.PORT || 3000}`)
);
