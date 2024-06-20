const express = require('express');
const bodyParser = require('body-parser');
const nodemailer = require('nodemailer');
const cors = require('cors');

const app = express();
const port = process.env.PORT || 3000;

app.use(bodyParser.json());
app.use(cors());

app.post('/send-email', async (req, res) => {
    const { email } = req.body;
    if (!email) {
        return res.status(400).send('Email is required');
    }

    // Configure the email transport using the default SMTP transport and a GMail account
    let transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: 'Voltmailerhelp@gmail.com',
            pass: 'Plutoandmars'
        }
    });

    // Set up email data
    let mailOptions = {
        from: '"Your Name" <Voltmailerhelp@gmail.com>',
        to: email,
        subject: 'Hello from Node.js',
        text: 'Hello! This is a test email sent from a Node.js server.'
    };

    try {
        // Send mail with defined transport object
        await transporter.sendMail(mailOptions);
        res.status(200).send('Email sent successfully');
    } catch (error) {
        res.status(500).send('Error sending email: ' + error.message);
    }
});

app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
