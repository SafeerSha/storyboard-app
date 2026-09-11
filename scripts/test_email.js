require('dotenv').config();
const nodemailer = require('nodemailer');

async function testEmail() {
  console.log("Testing email with user:", process.env.SMTP_USER);
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port: parseInt(process.env.SMTP_PORT || "587", 10),
    secure: parseInt(process.env.SMTP_PORT) === 465,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  try {
    const info = await transporter.sendMail({
      from: '"Test Sender" <' + process.env.SMTP_USER + '>',
      to: "safeerps21@gmail.com",
      subject: "Test Email from Reqly",
      text: "This is a test email.",
      html: "<b>This is a test email.</b>",
    });

    console.log("Message sent: %s", info.messageId);
  } catch (error) {
    console.error("Error sending email:", error);
  }
}

testEmail();
