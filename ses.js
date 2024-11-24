const express = require('express');
const AWS = require('aws-sdk');
const bodyParser = require('body-parser');

const app = express();
const PORT = 3000;

// Configure AWS SES
const AWS_REGION = 'us-east-1'; // Replace with your AWS region
AWS.config.update({ region: AWS_REGION });

const ses = new AWS.SES();

app.use(bodyParser.json());

// Endpoint 1: Create a Sender (Verify Email Address)
app.post('/verify-sender', async (req, res) => {
    const { email } = req.body;

    if (!email) {
        return res.status(400).json({ error: 'Email is required' });
    }

    const params = {
        EmailAddress: email,
    };

    try {
        await ses.verifyEmailIdentity(params).promise();
        res.status(200).json({ message: `Verification email sent to ${email}` });
    } catch (err) {
        console.error('Error verifying email:', err);
        res.status(500).json({ error: 'Failed to send verification email', details: err.message });
    }
});

// Endpoint 2: Send Email
app.post('/send-email', async (req, res) => {
    const { from, to, subject, body } = req.body;

    if (!from || !to || !subject || !body) {
        return res.status(400).json({ error: 'From, to, subject, and body are required' });
    }

    const params = {
        Source: from, // Must be a verified email in SES
        Destination: {
            ToAddresses: [to],
        },
        Message: {
            Subject: {
                Data: subject,
            },
            Body: {
                Text: {
                    Data: body,
                },
            },
        },
    };

    try {
        const result = await ses.sendEmail(params).promise();
        res.status(200).json({ message: 'Email sent successfully', data: result });
    } catch (err) {
        console.error('Error sending email:', err);
        res.status(500).json({ error: 'Failed to send email', details: err.message });
    }
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
