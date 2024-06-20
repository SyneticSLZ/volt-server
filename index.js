const express = require('express');
const nodemailer = require('nodemailer');
const { google } = require('googleapis');
const bodyParser = require('body-parser');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const session = require('express-session');
const cors = require('cors');

const app = express();
const port = process.env.PORT || 3000;
const secretKey = 'your-secret-key';
const CLIENT_ID = 'your-google-client-id';
const CLIENT_SECRET = 'your-google-client-secret';
const REDIRECT_URI = 'your-redirect-uri';
const oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);

app.use(bodyParser.json());
app.use(cors());
app.use(session({ secret: 'your-session-secret', resave: false, saveUninitialized: true }));

// Dummy database
const users = [];

// Helper function to authenticate token
const verifyToken = (req, res, next) => {
    const token = req.headers['x-access-token'];
    if (!token) {
        return res.status(403).send('No token provided');
    }

    jwt.verify(token, secretKey, (err, decoded) => {
        if (err) {
            return res.status(500).send('Failed to authenticate token');
        }
        req.userId = decoded.id;
        next();
    });
};

// Sign-up route
app.post('/signup', async (req, res) => {
    const { email, password, name } = req.body;

    const hashedPassword = await bcrypt.hash(password, 10);
    users.push({ email, password: hashedPassword, name });

    res.status(201).send('User registered successfully');
});

// Login route
app.post('/login', async (req, res) => {
    const { email, password } = req.body;
    const user = users.find(u => u.email === email);

    if (!user || !(await bcrypt.compare(password, user.password))) {
        return res.status(401).send('Invalid email or password');
    }

    const token = jwt.sign({ id: user.email }, secretKey, { expiresIn: '1h' });
    res.json({ token });
});

// Route to get user details
app.get('/user-details', verifyToken, (req, res) => {
    const user = users.find(u => u.email === req.userId);
    if (!user) {
        return res.status(404).send('User not found');
    }

    res.status(200).json({ email: user.email, name: user.name });
});

// SMTP email sending route
app.post('/send-email-smtp', async (req, res) => {
    const { to, subject, body } = req.body;

    let transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: 'voltmailerhelp@gmail.com',
            pass: 'PlutoandMars1!'
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
        scope: ['https://www.googleapis.com/auth/gmail.send'],
    });
    res.redirect(url);
});

app.get('/auth/google/callback', async (req, res) => {
    const { code } = req.query;
    const { tokens } = await oauth2Client.getToken(code);
    req.session.tokens = tokens;
    res.redirect('/db.html');
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

app.listen(port, () => {
    console.log(`Server is running on port ${port}`);

});
