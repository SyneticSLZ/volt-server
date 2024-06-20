const express = require('express');
const dotenv = require('dotenv');
const nodemailer = require('nodemailer');
const { google } = require('googleapis');
const bodyParser = require('body-parser');
const session = require('express-session');
const cors = require('cors');

const app = express();
dotenv.config();

const port = process.env.PORT || 3000;
const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const REDIRECT_URI = process.env.REDIRECT_URI;
const oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);

app.use(bodyParser.json());
app.use(cors({
    origin: 'http://127.0.0.1:5500', // Frontend server origin
    credentials: true // Allow credentials to be sent
}));

app.use(session({ secret: 'your-session-secret', resave: false, saveUninitialized: true,     cookie: {
    secure: false, // Set to true if using HTTPS
    httpOnly: true
} }));

app.post('/count', async (req, res) => {
    for (let i = 0; i < 1000; i++){
        console.log(i);
    }
    res.status(200).send('Count completed');
});

// SMTP email sending route
app.post('/send-email-smtp', async (req, res) => {
    const { to, subject, body } = req.body;

    let transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: 'voltmailerhelp@gmail.com',
            pass: 'okwv awih fwmi'
        }
    });

    let mailOptions = {
        from: 'Voltmailer <voltmailerhelp@gmail.com>',
        to,
        subject,
        text: body
    };

    try {
        await transporter.sendMail(mailOptions);
        res.status(200).send('Email sent successfully');
    } catch (error) {
        res.status(500).send('Error sending email: ' + error.message);
    }
});

// Gmail API email sending route
app.get('/auth/google', (req, res) => {
    const url = oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: ['https://www.googleapis.com/auth/gmail.send', 'https://www.googleapis.com/auth/userinfo.email'],
    });
    res.redirect(url);
});

app.get('/auth/google/callback', async (req, res) => {
    const { code } = req.query;
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);
    const oauth2 = google.oauth2({ auth: oauth2Client, version: 'v2' });
    const userInfo = await oauth2.userinfo.get();
    req.session.tokens = tokens;
    req.session.userEmail = userInfo.data.email;
    res.redirect('http://127.0.0.1:5500/index.html');
});

app.post('/send-email-gmail', async (req, res) => {
    const { to, subject, body } = req.body;
    if (!req.session.tokens) {
        return res.status(401).send('Unauthorized');
    }

    oauth2Client.setCredentials(req.session.tokens);
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

    const email = [
        `To: ${to}`,
        'Content-Type: text/html; charset=utf-8',
        'MIME-Version: 1.0',
        `Subject: ${subject}`,
        '',
        body,
    ].join('\n');

    const base64EncodedEmail = Buffer.from(email).toString('base64').replace(/\+/g, '-').replace(/\//g, '_');

    try {
        await gmail.users.messages.send({
            userId: 'me',
            requestBody: {
                raw: base64EncodedEmail,
            },
        });
        res.status(200).send('Email sent successfully');
    } catch (error) {
        res.status(500).send('Error sending email: ' + error.message);
    }
});

app.get('/get-user-email', (req, res) => {
    if (req.session.userEmail) {
        res.status(200).json({ email: req.session.userEmail });
    } else {
        res.status(401).send('Unauthorized');
    }
});

app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
