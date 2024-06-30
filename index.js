const { Configuration, OpenAI } = require('openai');
const express = require('express');
const dotenv = require('dotenv');
const nodemailer = require('nodemailer');
const { google } = require('googleapis');
const bodyParser = require('body-parser');
const session = require('express-session');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const Customer = require('./models/customer');
const app = express();
dotenv.config();
const axios = require('axios');
const cheerio = require('cheerio');
const nlp = require('compromise');

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

const ASSISTANT_ID = "asst_shvdCBA7snGDSENhmE5iugIm"

let IsLogged_IN = False;

// This is your test secret API key.
const stripe = require('stripe')('sk_test_51MNx4UKJeZAyw8f48GWSXpvAEKCzEU5ISvITCblYwxBpKMhUF9yZcnaosy2ukX9I8iDhMkvctmBMZWBqygrDC08r00r0xpZvXa');


const YOUR_DOMAIN = 'https://syneticslz.github.io/test-client';

const port = process.env.PORT || 3000;
const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const REDIRECT_URI = process.env.REDIRECT_URI;
const oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);

app.use(bodyParser.json());
app.use(express.static('public'));
app.use(cors({
    origin: 'https://syneticslz.github.io', // Frontend server origin
    credentials: true // Allow credentials to be sent
}));

app.use(session({
    secret: process.env.SESSION_SECRET || 'your-session-secret', // Use an environment variable for the session secret
    resave: false,
    saveUninitialized: true,
    cookie: {
        secure: true, // Set to true if using HTTPS
        httpOnly: true,
        sameSite: 'lax'
    }
}));

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('Connected to MongoDB'))
    .catch(err => console.log(err));


// Helper functions
async function summarsizeWebsite(url) {
    if (!url) {
        throw new Error('URL is required');
    }
    

    try {
        // Fetch the website content
        const { data } = await axios.get(url);
        
        // Parse the HTML content
        const $ = cheerio.load(data);
        const textContent = $('body').text();

        // Use NLP to extract and summarize information
        const doc = nlp(textContent);
        const sentences = doc.sentences().out('array');
        const businessInfo = sentences.slice(0, 5).join(' '); // Adjust the slicing as necessary

        return businessInfo;
    } catch (error) {
        console.error(error);
        throw new Error('Failed to fetch and summarize the website');
    }
}

async function summarizeWebsite(url) {
    if (!url) {
        throw new Error('URL is required');
    }
    
    try {
        // Fetch the website content
        const { data } = await axios.get(url);
        
        // Parse the HTML content
        const $ = cheerio.load(data);

        // Attempt to extract meta description
        let description = $('meta[name="description"]').attr('content');
        
        if (!description) {
            // Fallback to using headings and first paragraphs if no meta description is present
            const headings = $('h1, h2').map((i, el) => $(el).text()).get();
            const paragraphs = $('p').map((i, el) => $(el).text()).get();
            description = headings.concat(paragraphs).slice(0, 3).join(' ').trim();
        }

        return description;
    } catch (error) {
        console.error(error);
        throw new Error('Failed to fetch and summarize the website');
    }
}



async function CreateThread(){
    const thread = await openai.beta.threads.create();
    console.log("thread created", thread.id);
    return thread.id
}

let subject_line = "";
let body_content = "";

async function AddMessageToThread(ThreadID, website_content, user_pitch, To, Me) {
    try {
        // Create the message
        const message = await openai.beta.threads.messages.create(
            ThreadID,
            {
                role: "user",
                content: `I'm selling ${user_pitch}, This is the data I have on the company and what they do from their website ${website_content}. And this is the user's pitch: ${user_pitch}. This is the name you should use to address them in the email ${To} from my name, ${Me}. I want you to create the email where the first line is the subject line and then the greeting and content follows. I wnat thie output to be professional, so no blank fieldse. [company name ] ect. My company name is Voltmailer.`
            }
        );
        console.log("Message added");

        // Create and poll the run
        let run = await openai.beta.threads.runs.createAndPoll(
            ThreadID,
            {
                assistant_id: ASSISTANT_ID,
                instructions: ""
            }
        );
        console.log("Run created");

        // Polling loop for the run status
        let timeElapsed = 0;
        const timeout = 140; // Timeout duration in seconds
        const interval = 5; // Interval duration in seconds

        const checkRunStatus = async () => {
            while (timeElapsed < timeout) {
                // run = await openai.beta.threads.runs.retrieve(ThreadID, run.id);

                try {
                    run = await openai.beta.threads.runs.retrieve(ThreadID, run.id);
                } catch (error) {
                    console.error('Error retrieving run status:', error);
                    // Optionally, you can break the loop or continue based on the error type
                    break;
                }


                if (run.status === 'completed') {

                    const messages = await openai.beta.threads.messages.list(
                        run.thread_id
                    );
                    console.log("Messages listed", messages);


                    // for (const message of messages.data) {
                        // const content = message.content[0].text.value;
                        const content = messages.data[0].content[0].text.value

                        // Split the content to get the subject and body
                        const lines = content.split('\n');
                        const subject_c = lines[0];
                        const body_c = lines.slice(1).join('\n');
                        //  const s = subject
                        //  const b = body
                        body_content = body_c
                        subject_line = subject_c
                        console.log("Subject:", subject_c);
                        console.log("Body:", body_c);
                        // await sendEmail(subject, body, To, token);
                        // SENT_EMAILS += 1;

                        return { subject_c , body_c };
                    // }


                } else {
                    console.log("status: ", run.status);
                    console.log(`Time elapsed: ${timeElapsed} seconds`);
                    timeElapsed += interval;
                    await new Promise(resolve => setTimeout(resolve, interval * 1000)); // Wait for the interval duration
                }
            }
            console.log('Timeout reached');

            return null;
        };

        await checkRunStatus();
    } catch (error) {
        console.error('Error:', error);
        return null;
    }
}



async function findCustomer(email) {
    return await Customer.findOne({ email });
}

async function addCustomerToDb(data) {
    const customer = new Customer({
        stripeID: data.stripeID,
        email: data.email,
        plan: data.plan,
        total_emails: data.total_emails,
        priceID: data.priceID,
        password: data.password,
        name: data.name,
        plan_emails: data.plan_emails
    });
    await customer.save();
}

async function loginToDatabase(email, password) {
    const customer = await findCustomer(email);
    if (customer) {
        if (customer.password) {
            return password === customer.password ? true : 'Wrong Password';
        } else {
            return 'Please sign in with Google';
        }
    } else {
        return 'Account Not found';
    }
}



function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function generateJWT(userEmail, tokens) {
    const payload = {
        email: userEmail,
        tokens: tokens
    };
    
    // Use a secret key from your environment variables
    const secret = process.env.JWT_SECRET || 'your-jwt-secret';
    
    return jwt.sign(payload, secret, { expiresIn: '1h' });
}

function verifyJWT(token) {
    const secret = process.env.JWT_SECRET || 'your-jwt-secret';
    try {
        return jwt.verify(token, secret);
    } catch (err) {
        console.error('JWT verification failed:', err);
        return null;
    }
}

function generateEmailJWT(email) {
    const payload = { email };
    const secret = process.env.JWT_SECRET || 'your-jwt-secret';
    return jwt.sign(payload, secret, { expiresIn: '1h' });
}

function verifyEmailJWT(token) {
    const secret = process.env.JWT_SECRET || 'your-jwt-secret';
    try {
        return jwt.verify(token, secret);
    } catch (err) {
        console.error('JWT verification failed:', err);
        return null;
    }
}

const sendEmainl = async (subject, message, to, token) => {
    try {
        const response = await axios.post(
            '/send-email-gmail',
            {
                to: to,
                subject: subject,
                body: message
            },
            {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            }
        );
        console.log(`Message to ${to} successfully sent: ${response.data}`);
    } catch (error) {
        console.error(`Error sending email to ${to}:`, error);
    }
};




const sendEmail = async (subject, message, to, token, myemail) => {
    // const token = req.headers['authorization'].split(' ')[1];
    console.log("data is :" , to, message, subject )
    const userData = verifyJWT(token);

    if (!userData) {
        return 
    }

    console.log('User Data:', userData);
    const { email, tokens } = userData;

    console.log('Tokens:', tokens);

    oauth2Client.setCredentials(tokens);
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

    const emailContent = [
        `To: <${to}>`,
        'Content-Type: text/html; charset=utf-8',
        'MIME-Version: 1.0',
        `Subject: ${subject}`,
        '',
        message,
    ].join('\n');

    const base64EncodedEmail = Buffer.from(emailContent).toString('base64').replace(/\+/g, '-').replace(/\//g, '_');

    try {
        await gmail.users.messages.send({
            userId: 'me',
            requestBody: {
                raw: base64EncodedEmail,
            },
        });
        console.log('Email sent successfully');

        const customer = await customersCollection.findOne({ email: email });
        // if (customer && customer.total_emails >= emailsToUse) {
            const newTotalEmails = customer.total_emails + 1;
            await customersCollection.updateOne(
                { email: email },
                { $set: { total_emails: newTotalEmails } }
            );
            console.log(`Emails used! ${newTotalEmails} emails used.`);
        // } else {
        //     res.status(400).json({ message: "Not enough emails left or customer not found" });
        // }

    } catch (error) {
        console.error('Error sending email:', error);
        // res.status(500).send('Error sending email: ' + error.message);
    }
};


// Routes

// async function sendEmails(credentialsDict, submittedData, userPitch, Uname, token) {
    app.post('/send-emails', async (req, res) => {
    const { submittedData, userPitch, Uname, token, myemail } = req.body;

    res.status(200).send('Emails are being sent in the background. You can close the tab.');

    let SENT_EMAILS = 0;
    const threadID = await CreateThread();
    setImmediate(async () => {
    for (const data of submittedData) {
        try {
            console.log(`Starting send to ${data.email}`);

            const summary = await summarizeWebsite(data.website);
            // console.log(summary);

            const To = data.name;

            console.log(`Email: ${data.email}, Website Content: ${summary}, Uname: ${Uname}, To: ${To}`);

            // Generate the email content using AddMessageToThread
            const emailContent = await AddMessageToThread(threadID, summary, userPitch, To, Uname, token);
            console.log("returned : ", emailContent)
            // const { s, b } = emailContent;
            // if (emailContent) {
                // console.log("Subject:", s);
                // console.log("Body:", b);
                
            // Send the email
            await sendEmail(subject_line, body_content, data.email, token, myemail);
            SENT_EMAILS += 1;

            // } else {
                // console.log("Failed to retrieve email content.");
            // }           

            // console.log(`Email: ${data.email}, Subject: ${subjectLine}, Message: ${mainMessage}`);

        } catch (error) {
            console.log(`Error processing email for ${data.email}: ${error}`);
            // Handle the exception (log it, update status, etc.)
        }
    }

    // res.json({ status: 'completed', sent_emails: SENT_EMAILS });
    console.log("completed")
});
});


// Route to send bulk emails manually
app.post('/send-bulk-manual', async (req, res) => {
    const { token, subject, content, email, myemail } = req.body;

    try {
        // await sendBulkEmails(generatedData, token);
        await sendEmail(subject, content, email, token, myemail);
        res.json({ message: 'Bulk emails sent successfully' });
    } catch (error) {
        console.log(`Error sending bulk emails manually: ${error}`);
        res.status(500).json({ error: 'Failed to send bulk emails' });
    }
});


// Route to generate email content
app.post('/generate-email-content', async (req, res) => {
    console.log("personalizing email")
    const { website, userPitch, Uname, To} = req.body;
    const threadID = await CreateThread();
console.log("threadid :  ", threadID)
    try {

        const summary = await summarizeWebsite(website);
        console.log("summarized : ", summary)
        const emailContent = await AddMessageToThread(threadID, summary, userPitch, To, Uname);
        console.log("returned : ", emailContent)

        res.json({ subject_line, body_content, To });

    } catch (error) {
        res.status(500).json({ error: 'Failed to generate email content' });
    }
});




app.post('/add-customer-to-db', async (req, res) => {
    const data = req.body;
    console.log(data)
    try {
        const customer = new Customer({
            stripeID: data.stripeID,
            email: data.email,
            plan: data.plan,
            total_emails: data.total_emails,
            priceID: data.priceID,
            password: data.password,
            name: data.name,
            plan_emails: data.plan_emails,
            affiliate: data.affiliate
        });

        await customer.save()
        console.log('Customer added successfully');
        const token = generateEmailJWT(data.email);
        const dashboardUrl = `${YOUR_DOMAIN}/Dashboard.html?token=${token}`;
        
        res.json({ redirectUrl: dashboardUrl });

    } catch (error) {
        res.status(500).send('Error adding customer to the database');
    }
});

app.post('/login-customer', async (req, res) => {
    const { email, password } = req.body;
    const result = await loginToDatabase(email, password);

    if (result === true) {
        const customer = await findCustomer(email);
        if (customer) {
            const token = generateEmailJWT(email);
            res.json({ success: true, token });
        } else {
            res.status(404).json({ error: 'User account not found. Please sign up.' });
        }
    } else {
        res.status(400).json({ error: result });
    }
});


app.post('/signup-customer', async (req, res) => {
    const { email, password } = req.body;
    const customer = await findCustomer(email);

    if (customer) {
        if (customer.password) {
            res.json({ success: false, error: "User already has an account." });
        } else {
            res.json({ success: false, error: "This email is linked to a Google account." });
        }
    } else {
        // Redirect to the pricing page with email and password
        res.json({ 
            success: true, 
            redirectUrl: `https://syneticslz.github.io/test-client/pricing.html?email=${encodeURIComponent(email)}&password=${encodeURIComponent(password)}` 
        });
    }
});

app.get('/user-data', async (req, res) => {
    const token = req.headers['authorization'].split(' ')[1];
    const decoded = verifyEmailJWT(token);

    if (!decoded) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    const customer = await findCustomer(decoded.email);
    if (customer) {
        res.json(customer);
    } else {
        res.status(404).json({ error: 'User account not found' });
    }
});

app.get('/google-user-data', async (req, res) => {
    const token = req.headers['authorization'].split(' ')[1];
    const decoded = verifyJWT(token);

    if (!decoded) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    const customer = await findCustomer(decoded.email);
    if (customer) {
        res.json(customer);
    } else {
        res.status(404).json({ error: 'User account not found' });
    }
});


app.post('/count', async (req, res) => {
    for (let i = 0; i < 1000; i++){
        console.log(i);
        await sleep(1000);
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
            pass: 'okwvawihfwmi'
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

// reset passworrrd 

app.post('/request-password-reset', async (req, res) => {
    const { email } = req.body;
    const user = await findCustomer(email);
  
    if (!user) {
      return res.status(400).send('User with this email does not exist.');
    }
  
    const token = jwt.sign({ email: email }, process.env.JWT_SECRET, { expiresIn: '15m' });
    // Optionally store the token in DB or cache
  
    // Send the email



    const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: 'voltmailerhelp@gmail.com',
          pass: 'chys ltjh yxlo isbu', // App password if 2FA is enabled
        },
      });
    
      // Define email options
      const mailOptions = {
        from: 'voltmailerhelp@gmail.com',
        to: email,
        subject: 'Password Reset',
        text: `Click the link to reset your password: https://syneticslz.github.io/test-client/reset-password?token=${resetToken}`,
        html: `<p>Click the link to reset your password: <a href="https://syneticslz.github.io/test-client/reset-password?token=${resetToken}">Reset Password</a></p>`,
      };

  
    await transporter.sendMail(mailOptions);
    console.log('Message sent: %s', info.messageId);
    res.send('Password reset email sent.');

    

  });
  

  app.post('/reset-password', async (req, res) => {
    const { token, newPassword } = req.body;
  
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await findCustomer(decoded.email);
  
      if (!user) {
        return res.status(400).send('Invalid token or user does not exist.');
      }
  
      // Validate new password (e.g., length, complexity)
      if (newPassword.length < 8) {
        return res.status(400).send('Password must be at least 8 characters long.');
      }
  
      user.password = await bcrypt.hash(newPassword, 10); // Hash the new password
      await user.save();
  
      res.send('Password has been reset.');
    } catch (error) {
      res.status(400).send('Invalid token.');
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

// Gmail API email sending route
// app.get('/get/auth/google', (req, res) => {
//     IsLogged_IN = True;
//     const url = oauth2Client.generateAuthUrl({
//         access_type: 'offline',
//         scope: ['https://www.googleapis.com/auth/gmail.send', 'https://www.googleapis.com/auth/userinfo.email'],
//     });
//     res.redirect(url);
// });



app.get('/auth/google/callback', async (req, res) => {
    const { code } = req.query;
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);
    const oauth2 = google.oauth2({ auth: oauth2Client, version: 'v2' });
    const userInfo = await oauth2.userinfo.get();
    const email = userInfo.data.email;
    const jwtToken = generateJWT(userInfo.data.email, tokens);
    console.log('User email set in session(JWT):', userInfo.data.email);
    const customer = await findCustomer(email);

    if (IsLogged_IN){
        res.redirect(`https://syneticslz.github.io/test-client/Dashboard.html?connectedgoogletoken=${jwtToken}`);
    }
else {
    if (customer) {

        res.redirect(`https://syneticslz.github.io/test-client/Dashboard.html?googletoken=${jwtToken}`);
    } else {
        // User does not exist, redirect to the pricing page for signup
        res.redirect(`https://syneticslz.github.io/test-client/pricing.html?email=${encodeURIComponent(userInfo.data.email)}&password=null&token=${jwtToken}`);
    }
}


    // req.session.tokens = tokens;
    // req.session.userEmail = userInfo.data.email;
    // res.redirect('https://syneticslz.github.io/test-client/');
});

app.post('/send-email-gmail', async (req, res) => {
    const token = req.headers['authorization'].split(' ')[1];
    const userData = verifyJWT(token);

    if (!userData) {
        return res.status(401).send('Unauthorized');
    }

    console.log('User Data:', userData);
    const { to, subject, body } = req.body;
    const { email, tokens } = userData;

    console.log('Tokens:', tokens);

    oauth2Client.setCredentials(tokens);
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

    const emailContent = [
        `To: ${to}`,
        'Content-Type: text/html; charset=utf-8',
        'MIME-Version: 1.0',
        `Subject: ${subject}`,
        '',
        body,
    ].join('\n');

    const base64EncodedEmail = Buffer.from(emailContent).toString('base64').replace(/\+/g, '-').replace(/\//g, '_');

    try {
        await gmail.users.messages.send({
            userId: 'me',
            requestBody: {
                raw: base64EncodedEmail,
            },
        });
        res.status(200).send('Email sent successfully');
    } catch (error) {
        console.error('Error sending email:', error);
        res.status(500).send('Error sending email: ' + error.message);
    }
});



app.get('/get-user-email', (req, res) => {
    console.log('Session userEmail:', req.session.userEmail);
    if (req.session.userEmail) {
        res.status(200).json({ email: req.session.userEmail });
    } else {
        res.status(401).send('Unauthorized');
    }
});



// STRIPE

app.post('/create-checkout-session', async (req, res) => {
    const customer_email = req.body.email
    const name = req.body.name 
    const password = req.body.password

  const session = await stripe.checkout.sessions.create({
    ui_mode: 'embedded',
    line_items: [
      {
        // Provide the exact Price ID (for example, pr_1234) of the product you want to sell
        price: 'price_1PSlQ1KJeZAyw8f41gAgAb7o',
        quantity: 1,
      },
    ],
    customer_email: customer_email,
    mode: 'subscription',
    return_url: `${YOUR_DOMAIN}/payment.html?session_id={CHECKOUT_SESSION_ID}&email=${customer_email}&password=${encodeURIComponent(password)}&name=${name}`,
  });

  res.send({clientSecret: session.client_secret});
});


app.post('/create-checkout-session-free', async (req, res) => {
    const customer_email = req.body.email
    const password = req.body.password
    const name = req.body.name

    const session = await stripe.checkout.sessions.create({
        mode: 'subscription',
        ui_mode: 'embedded',
        customer_email: customer_email,
        return_url: `${YOUR_DOMAIN}/payment.html?session_id={CHECKOUT_SESSION_ID}&email=${customer_email}&password=${encodeURIComponent(password)}&name=${name}`,
        line_items: [
          {
            price: 'price_1PKf2PKJeZAyw8f418JphiK0',
            quantity: 1,
          },
        ],
        subscription_data: {
          trial_settings: {
            end_behavior: {
              missing_payment_method: 'cancel',
            },
          },
          trial_period_days: 30,
        },
        payment_method_collection: 'if_required',
      });

  res.send({clientSecret: session.client_secret});
});




app.post('/create-checkout-session-token', async (req, res) => {

    const customer_email = req.body.email;
  const session = await stripe.checkout.sessions.create({
    ui_mode: 'embedded',
    line_items: [
      {
        // Provide the exact Price ID (for example, pr_1234) of the product you want to sell
        price: 'price_1PSlQ1KJeZAyw8f41gAgAb7o',
        quantity: 1,
      },
    ],
    customer_email: customer_email,
    mode: 'subscription',
    return_url: `${YOUR_DOMAIN}/return.html?session_id={CHECKOUT_SESSION_ID}&email={customer_email}`,
  });

  res.send({clientSecret: session.client_secret});
});


app.post('/create-checkout-session-free-token', async (req, res) => {
    // const token = req.body.token;
    const customer_email = req.body.email;
    // if (!token) {
    //     return res.status(400).send({ error: 'Token is required' });
    // }

    const session = await stripe.checkout.sessions.create({
        mode: 'subscription',
        ui_mode: 'embedded',
        customer_email: customer_email,
        return_url:  `${YOUR_DOMAIN}/return.html?session_id={CHECKOUT_SESSION_ID}&email={customer_email}`,
        line_items: [
          {
            price: 'price_1PKf2PKJeZAyw8f418JphiK0',
            quantity: 1,
          },
        ],
        subscription_data: {
          trial_settings: {
            end_behavior: {
              missing_payment_method: 'cancel',
            },
          },
          trial_period_days: 30,
        },
        payment_method_collection: 'if_required',
      });

  res.send({clientSecret: session.client_secret});
});




// app.get('/session-status', async (req, res) => {
//   const session = await stripe.checkout.sessions.retrieve(req.query.session_id);

//   res.send({
//     status: session.status,
//     customer_email: session.customer_details.email
//   });
// });

app.get('/session-status', async (req, res) => {
    try {
      const session = await stripe.checkout.sessions.retrieve(req.query.session_id);
      
      // Retrieve line items for the session
      const lineItems = await stripe.checkout.sessions.listLineItems(req.query.session_id);
  
      // Check if line items are available and get the ID of the first price
      let firstPriceId = null;
      if (lineItems.data.length > 0) {
        firstPriceId = lineItems.data[0].price.id;
      }
  
      res.send({
        status: session.status,
        customer_email: session.customer_details.email,
        amount_subtotal: session.amount_subtotal,
        amount_total: session.amount_total,
        payment_status: session.payment_status,
        currency: session.currency,
        customer: session.customer,
        first_price_id: firstPriceId,  // Add the first price ID here
        line_items: lineItems.data.map(item => ({
          price_id: item.price.id,
          product_name: item.description
        })),
        mode: session.mode,
        created: session.created,
        expires_at: session.expires_at,
        success_url: session.success_url,
        cancel_url: session.cancel_url,
        payment_method_types: session.payment_method_types,
        metadata: session.metadata
      });
    } catch (error) {
      res.status(500).send({ error: error.message });
    }
  });




app.get('/get-session-details', async (req, res) => {
    const sessionId = req.query.session_id;

    try {
        const session = await stripe.checkout.sessions.retrieve(sessionId, {
            expand: ['line_items', 'customer']
        });

        res.json(session);
    } catch (error) {
        res.status(500).send('Error retrieving session details');
    }
});



app.post('/create-billing-portal-session', async (req, res) => {
    const { customerId, email } = req.body; // Assuming customerId is sent in the body
    const token = generateEmailJWT(email);
    try {
        const session = await stripe.billingPortal.sessions.create({
            customer: customerId,
            return_url: `${YOUR_DOMAIN}/Dashboard.html?token=${token}`, // The URL to redirect to after billing portal
        });

        res.json({ url: session.url });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});


//OPENAI





app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
