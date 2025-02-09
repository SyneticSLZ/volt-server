const { Configuration, OpenAI } = require('openai');
const express = require('express');
const app = express();
const dotenv = require('dotenv');
const nodemailer = require('nodemailer');
const { google } = require('googleapis');
const bodyParser = require('body-parser');
const session = require('express-session');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');	
const { Email, Campaign, Customer, Mailbox, EData } = require('./models/customer');
const Driver = require('./models/Driver');
const { v4: uuidv4 } = require('uuid');
dotenv.config();
const axios = require('axios');
const cheerio = require('cheerio');
const puppeteer = require('puppeteer');
const url = require('url');
const bcrypt = require('bcryptjs');
const nlp = require('compromise');
// const fetch = require('node-fetch');
// const fs = require('fs');
// const fs = require('fs').promises;
const path = require('path');
const Hunter = require('hunter.io');
const { MongoClient } = require('mongodb');
const cron = require('node-cron');
const crypto = require('crypto');
const moment = require('moment-timezone');
const sgMail = require('@sendgrid/mail')
const { XMLParser } = require('fast-xml-parser');

const { JSDOM } = require('jsdom');
const rateLimit = require('express-rate-limit');

// Increase payload size limit
app.use(express.json({limit: '50mb'}));
app.use(express.urlencoded({limit: '50mb', extended: true}));
app.use(bodyParser.json({limit: '50mb'}));
app.use(bodyParser.urlencoded({limit: '50mb', extended: true}));


const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
    // Ensure correct IP resolution
    keyGenerator: (req) => {
      // Try to get IP from various headers
      return req.ip || 
             req.headers['x-forwarded-for']?.split(',')[0] || 
             req.socket.remoteAddress;
    },
    // Optional: Skip rate limiting for certain trusted IPs
    skip: (req) => {
      const trustedIPs = ['127.0.0.1']; // Add your trusted IPs here
      return trustedIPs.includes(req.ip);
    }
  });

app.use('/api/', apiLimiter);
app.set('trust proxy', true);
const fs = require('fs').promises;

const OPENAI_API_KEY = process.env.OPENAI_API_KEY; // Replace with your OpenAI API Key
const Mailjet = require('node-mailjet')

const mailjet = Mailjet.apiConnect(
    process.env.MJ_APIKEY_PUBLIC,
    process.env.MJ_APIKEY_PRIVATE
  );

// const axios = require('axios');
// const cheerio = require('cheerio');
// const puppeteer = require('puppeteer');
const natural = require('natural');
const { extractKeywords } = require('keyword-extractor');

const EmailTracker = require('./EmailTracker');
const AdvancedCompanyIntelligenceScraper = require('./Webscrape')
const WebScraper = require('./claude')
const AdvancedCompanyProfileScraper = require('./profile')
// const { setupLinkedInScraperRoute } = require('./linkedinscraper');

// const M_uri = 'mongodb+srv://syneticslz:<password>@synetictest.bl3xxux.mongodb.net/?retryWrites=true&w=majority&appName=SyneticTest'; // Replace with your MongoDB connection string
// const M_client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });

app.use(bodyParser.json());
sgMail.setApiKey(process.env.SENDGRID_API_KEY)

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });


//const ASSISTANT_ID ="asst_GEWAZTa3FphKwL5Whu7SblQE"
// const ASSISTANT_ID ="asst_shvdCBA7snGDSENhmE5iugIm" 
const ASSISTANT_ID ="asst_olg2G5eozjqnUHDVWIctpX2N"

let IsLogged_IN = false;

// Hunter.io API key
const hunter = process.env.HUNTER_API_KEY

// This is your test secret API key.
const stripe = require('stripe')(process.env.STRIPE_API_KEY);


const YOUR_DOMAIN = 'https://voltmailer.com' 

const port = process.env.PORT || 10000;
const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const REDIRECT_URI = process.env.REDIRECT_URI;
const oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);



const GOOGLE_OAUTH_CONFIG = {
    clientId: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET  , // Add your client secret here
    redirectUri: 'https://www.voltmailer.com/Dashboard.html',
    scopes: ['https://www.googleapis.com/auth/userinfo.email', 'https://www.googleapis.com/auth/gmail.send']
  };

let subject_c
let body_c

app.use(bodyParser.json());
app.use(express.static('public'));
app.use(cors({
    origin: ['http://127.0.0.1:5502', 'https://voltmailer.com'],
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

// // Define a schema for the Rally-Drivers collection
// const driverSchema = new mongoose.Schema({
//     name: String,
//     url: String,
//     email: String,
//     nextRace: String,
//     emailSent: String
// });

// // Create a model based on the schema
// const Driver = mongoose.model('Driver', driverSchema);

// Helper functions
const fetchUserSignature = async (accessToken) => {
    oauth2Client.setCredentials({ access_token: accessToken });
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

    try {
        const response = await gmail.users.settings.sendAs.list({
            userId: 'me',
        });

        // Extract the default send-as address
        const sendAsAddress = response.data.sendAs.find(sendAs => sendAs.isDefault).sendAsEmail;

        // Fetch the signature for the default address
        const sendAsResponse = await gmail.users.settings.sendAs.get({
            userId: 'me',
            sendAsEmail: sendAsAddress,
        });

        const signature = sendAsResponse.data.signature || '';
        return signature;

    } catch (error) {
        console.error('Error fetching signature:', error);
        return '';
    }
};


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

// async function summarizeWebsite(url) {
//     if (!url) {
//         throw new Error('URL is required');
//     }
    
//     try {
//         // Fetch the website content
//         const { data } = await axios.get(url);
        
//         // Parse the HTML content
//         const $ = cheerio.load(data);

//         // Attempt to extract meta description
//         let description = $('meta[name="description"]').attr('content');
        
//         if (!description) {
//             // Fallback to using headings and first paragraphs if no meta description is present
//             const headings = $('h1, h2').map((i, el) => $(el).text()).get();
//             const paragraphs = $('p').map((i, el) => $(el).text()).get();
//             description = headings.concat(paragraphs).slice(0, 3).join(' ').trim();
//         }

//         return description;
//     } catch (error) {
//         console.error(error);
//         throw new Error('Failed to fetch and summarize the website');
//     }
// }


// const axios = require('axios');
// const cheerio = require('cheerio');







async function extractCompanyInsights(url, maxRetries = 3, retryDelay = 1000) {
    if (!url) {
        throw new Error('URL is required');
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const domain = new URL(url).hostname;
    const logFileName = `company_analysis_${domain}_${timestamp}.json`;

    let attempts = 0;

    while (attempts < maxRetries) {
        try {
            // Validate the URL with a HEAD request
            const headResponse = await axios.head(url, { timeout: 5000 });
            if (headResponse.status !== 200) {
                throw new Error(`HEAD request failed with status code ${headResponse.status}`);
            }

            const { data } = await axios.get(url, { timeout: 10000 });
            const $ = cheerio.load(data);

            // Initialize company analysis object
            const companyAnalysis = {
                basicInfo: {
                    description: '',
                    mission: '',
                    vision: '',
                    about: ''
                },
                businessModel: {
                    products: [],
                    services: [],
                    targetMarket: [],
                    valueProposition: '',
                    painPoints: [],
                    solutions: []
                },
                opportunities: {
                    collaborationAreas: [],
                    currentChallenges: [],
                    growthAreas: [],
                    techStack: [],
                    contactChannels: []
                },
                marketPresence: {
                    industries: [],
                    locations: [],
                    partnerships: [],
                    clientTypes: []
                }
            };

            const cleanText = (text) =>
                text.replace(/\s+/g, ' ').replace(/[\n\r\t]/g, ' ').trim();

            $('[class*="about"], [class*="company"], [class*="mission"], main').each((_, element) => {
                const section = $(element);
                const sectionText = section.text();
                section.find('h1, h2, h3, h4').each((_, heading) => {
                    const headingText = $(heading).text().toLowerCase();
                    const contentText = cleanText($(heading).next().text());

                    if (headingText.includes('about')) {
                        companyAnalysis.basicInfo.about += ' ' + contentText;
                    } else if (headingText.includes('mission')) {
                        companyAnalysis.basicInfo.mission += ' ' + contentText;
                    } else if (headingText.includes('product')) {
                        companyAnalysis.businessModel.products.push(contentText);
                    } else if (headingText.includes('service')) {
                        companyAnalysis.businessModel.services.push(contentText);
                    } else if (headingText.includes('challenge') || headingText.includes('problem')) {
                        companyAnalysis.businessModel.painPoints.push(contentText);
                    }
                });
            });

            $('[class*="contact"], [class*="footer"]').each((_, element) => {
                const contactText = $(element).text();
                const emails = contactText.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || [];
                const phones = contactText.match(/[\+]?[(]?[0-9]{3}[)]?[-\s\.]?[0-9]{3}[-\s\.]?[0-9]{4,6}/g) || [];
                companyAnalysis.opportunities.contactChannels.push(...emails, ...phones);
            });

            Object.keys(companyAnalysis).forEach((category) => {
                Object.keys(companyAnalysis[category]).forEach((key) => {
                    if (typeof companyAnalysis[category][key] === 'string') {
                        companyAnalysis[category][key] = cleanText(companyAnalysis[category][key]);
                    } else if (Array.isArray(companyAnalysis[category][key])) {
                        companyAnalysis[category][key] = [...new Set(
                            companyAnalysis[category][key]
                                .filter((item) => item && item.length > 0)
                                .map((item) => cleanText(item))
                        )];
                    }
                });
            });

            // Integrate AI for summary generation
            const aiSummary = await generateAISummary(url, companyAnalysis);

            // Log analysis to file
            await logAnalysisToFile(companyAnalysis, logFileName);

            // Return summary
            return { summary: "Analysis complete", analysis: companyAnalysis };

        } catch (error) {
            attempts++;
            console.error(`Attempt ${attempts} failed: ${error.message}`);

            if (error.response?.status === 404) {
                throw new Error(`404 Not Found: The URL ${url} does not exist`);
            }

            if (attempts >= maxRetries) {
                throw new Error(`Failed to fetch ${url} after ${maxRetries} attempts`);
            }

            // Exponential backoff for retries
            await new Promise(res => setTimeout(res, retryDelay * Math.pow(2, attempts - 1)));
        }
    }
}


async function generateAISummary(url, companyAnalysis) {
    const prompt = `
Analyze the following company data and summarize key points:
Company URL: ${url}

Basic Info:
Description: ${companyAnalysis.basicInfo.description}
Mission: ${companyAnalysis.basicInfo.mission}
Vision: ${companyAnalysis.basicInfo.vision}
About: ${companyAnalysis.basicInfo.about}

Business Model:
Products: ${companyAnalysis.businessModel.products.join(', ')}
Services: ${companyAnalysis.businessModel.services.join(', ')}
Pain Points: ${companyAnalysis.businessModel.painPoints.join(', ')}

Opportunities:
Tech Stack: ${companyAnalysis.opportunities.techStack.join(', ')}
Contact Channels: ${companyAnalysis.opportunities.contactChannels.join(', ')}

Market Presence:
Industries: ${companyAnalysis.marketPresence.industries.join(', ')}

Provide a concise analysis with key insights.
`;

    const response = await axios.post(
        'https://api.openai.com/v1/completions',
        {
            model: 'gpt-4',
            prompt,
            max_tokens: 500,
            temperature: 0.7
        },
        {
            headers: {
                'Authorization': `Bearer ${OPENAI_API_KEY}`,
                'Content-Type': 'application/json'
            }
        }
    );

    return response.data.choices[0].text.trim();
}

async function logAnalysisToFile(analysis, fileName) {
    try {
        const logsDir = path.join(process.cwd(), 'company_analysis_logs');
        await fs.mkdir(logsDir, { recursive: true });

        const filePath = path.join(logsDir, fileName);
        await fs.writeFile(filePath, JSON.stringify(analysis, null, 2), 'utf8');

        console.log(`Detailed analysis logged to: ${filePath}`);
    } catch (error) {
        console.error('Error logging analysis:', error);
    }
}

const scraper = new AdvancedCompanyIntelligenceScraper({
    // Optional API keys for enhanced data gathering
    openaiApiKey: process.env.OPENAI_API_KEY,
    clearbitApiKey: process.env.CLEARBIT_API_KEY,
    apolloApiKey: process.env.APOLLO_API_KEY,
    
    // Optional proxy configuration
    // proxies: [
    //     { 
    //         host: 'proxy1.example.com', 
    //         port: 8080, 
    //         auth: { username: 'user', password: 'pass' } 
    //     }
    // ]
});



// const scraper = new UltimateCompanyIntelligenceScraper();
async function summarizeWebsite( url, maxRetries = 3, retryDelay = 1000) {
    
    if (!url) {
    //     if (email === 'Test@gmail.com'){
    //         let description = 'no info found';
    //         return  description
    // }else {
    
        throw new Error('URL is required');
// }

    }

    // const pscraper = new AdvancedCompanyProfileScraper();
// try {
//     const companyProfile = await pscraper.extractCompanyProfile('https://rolex.com');
//     console.log(JSON.stringify(companyProfile, null, 2));
// } catch (error) {
//     console.error('Scraping failed:', error);
// }


try {
    // const companyIntel = await scraper.scrapeCompanyIntelligence(url);
    
    const scraper = new WebScraper();
    // const fs = require('fs').promises;
    const data = await scraper.scrape(url)
    console.log(`companyintel for ${url} : `)
//     .then(async result => 
        
//         await fs.writeFile('./results.json', JSON.stringify(result, null, 2)))
//         // console.log(`Data successfully saved to ${'results.json'}`),
//         // console.log(result))
//     .catch(error => console.error(error));
// const { metadata } = await axios.get(url, { timeout: 10000 });
            
// // Parse the HTML content
// const $ = cheerio.load(metadata);

// // Attempt to extract meta description
// let description = $('meta[name="description"]').attr('content');

// if (!description) {
//     // Fallback to using headings and first paragraphs if no meta description is present
//     const headings = $('h1, h2').map((i, el) => $(el).text()).get();
//     const paragraphs = $('p').map((i, el) => $(el).text()).get();
//     description = headings.concat(paragraphs).slice(0, 3).join(' ').trim();
// }


    // console.log(JSON.stringify(companyIntel, null, 2));
    let summary = `
    basicinfo: ${data.basicInfo}
    Company: ${data.basicInfo.companyName}
    Title: ${data.basicInfo.title}
    Description: ${data.basicInfo.description}
    Language: ${data.basicInfo.language}
    Industries: ${data.basicInfo.industryAnalysis.map(i => `${i.industry} (confidence: ${i.confidence})`).join(', ')}
    URL: ${data.url} (Favicon: ${data.basicInfo.favicon})
    Technical Details: ${data.technical.ssl ? 'Secure' : 'Non-secure'} and ${data.technical.mobileFriendly ? 'mobile-friendly' : 'not mobile-friendly'}
    Contact: ${data.contactInfo.phones?.[0] || 'Not available'}
    
    Metadata: ${Object.entries(data.metaData.meta.general).map(([key, value]) => `${key}: ${value}`).join(', ')}
    
    Business Offerings:
    ${Object.entries(data.businessInfo.offerings).map(([category, items]) => 
      `${category}: ${Array.isArray(items) ? items.join(', ') : 'None'}`
    ).join('\n')}
    
    Topics: ${data.textContent.topics.map(t => `${t.topic} (frequency: ${t.frequency}, score: ${t.score})`).join(', ')}
    
    Keywords: ${data.textContent.keywords.map(k => `${k.term} (score: ${k.score})`).join(', ')}
    
    `;
    // metadescription : ${description}
    // console.log(summary);


    return summary


} catch (error) {
    console.error('Scraping failed:', error);

    // Instantiate the scraper


// scraper.scrapeCompanyIntelligence(url)
//     .then(intelligence => {
//         console.log(JSON.stringify(intelligence, null, 2));
//         const outreachStrategy = scraper.generateColdOutreachStrategy(intelligence);
//         console.log(outreachStrategy.communicationProfile.keyMessageTopics, outreachStrategy.personalizedOpening, outreachStrategy.connectionPoints, outreachStrategy.potentialChallenges, outreachStrategy.recommendedApproach);
//         return outreachStrategy
//     })
//     .catch(console.error);


    let attempts = 0;
    while (attempts < maxRetries) {
        try {
            // Fetch the website content with a 10-second timeout
            const { data } = await axios.get(url, { timeout: 10000 });
            
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
            attempts++;
            console.error(`Attempt ${attempts} failed: ${error.code} - ${error.message}`);

            // Specific handling for network-related errors that may benefit from retrying
            if (error.code === 'ETIMEDOUT' || error.code === 'ECONNRESET') {
                if (attempts >= maxRetries) {
                    throw new Error(`Failed to fetch ${url} after ${maxRetries} attempts`);
                }
                // Exponential backoff delay
                await new Promise(res => setTimeout(res, retryDelay * Math.pow(2, attempts - 1)));
            } else {
                throw new Error('Failed to fetch and summarize the website');
            }
        }
    }
}

}


async function createTrialSubscription(email) {
    try {
      // 1. Create a customer with just an email
      const customer = await stripe.customers.create({
        email: email,
      });
  
      // 2. Create a subscription with trial
      const subscription = await stripe.subscriptions.create({
        customer: customer.id,
        items: [
          {
            price: 'price_1PdqxCKJeZAyw8f44eTYC7Rw', // Replace with your price ID from Stripe
          },
        ],
        trial_period_days: 14, // Adjust trial length as needed
        // Automatically cancel when trial ends if no payment method
        trial_settings: {
          end_behavior: {
            missing_payment_method: 'cancel'
          }
        }
      });
  console.log(customer.id,subscription.id,subscription.trial_end)
      return {
        customerId: customer.id,
        subscriptionId: subscription.id,
        trialEnd: subscription.trial_end
      };
    } catch (error) {
      console.error('Error creating trial subscription:', error);
      throw error;
    }
  }
  
  // Example Express.js route implementation
  async function handleTrialSignup(req, res) {
    try {
      const { email } = req.body;
  
      if (!email) {
        return res.status(400).json({ 
          error: 'Email is required' 
        });
      }
  
      // Check if customer already exists
      const existingCustomers = await stripe.customers.list({
        email: email,
        limit: 1
      });
  
      if (existingCustomers.data.length > 0) {
        return res.status(400).json({
          error: 'A trial for this email already exists'
        });
      }
  
      const trialData = await createTrialSubscription(email);
  
      // Store in your database
      await saveTrialToDatabase(email, trialData);
  
      res.json({
        success: true,
        ...trialData
      });
  
    } catch (error) {
      console.error('Signup error:', error);
      res.status(500).json({
        error: 'An error occurred during signup'
      });
    }
  }





async function CreateThread(){
    const thread = await openai.beta.threads.create();
    console.log("thread created", thread.id);
    return thread.id
}

let subject_line = "";
let body_content = "";

async function AddMessageToThread(ThreadID, website_content, user_pitch, To, Me, template) {
    try {
        // let content = 
//         if (email ==='Test@gmail.com') {
//             console.log("Message added for pakistani guy");
//             const content = 
//              ` This is the pitch I am going to use: ${user_pitch}.Only mention this pitch, nothing on the Company.You should address the reciever of this email with the name ${To}. You should also state that it was sent by me using my name: ${Me}. Generate the subject line then the email please use this template ${template}
// `
//         } else{
//               const  content = `This is the data I have on the company I'm sending this email to ${website_content}. This is the pitch I am going to use: ${user_pitch}. You should address the reciever of this email with the name ${To}. You should also state that it was sent by me using my name: ${Me}. Generate the subject line then the email please use this template ${template}
// `
//     }
    const message = await openai.beta.threads.messages.create(
        ThreadID,
        {
            role: "user",
            content:  `
                This is the data I have on the company I'm sending this email to [${website_content}]. This is the pitch I am going to use: [${user_pitch}]. You should address the reciever of this email with the name: ${To}. You should also state that it was sent by me using my name: ${Me}. Generate the subject line then the email please use this template ${template}

`
        }
    );

    // This is the data I have on the company I'm sending this email to ${website_content}. This is the pitch I am going to use: ${user_pitch}. You should address the reciever of this email with the name ${To}. You should also state that it was sent by me using my name: ${Me}. Generate the subject line then the email please use this template ${template}
// 
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

        // Polling loop for the run status  Guidelines:
// Generate a subject line with this format: "Subject: <subject line>" and keep it brief and tailored.
// Start with "Hi ${To}," and use a personalized intro based on ${website_content}.
// Focus the pitch on how the solution helps solve a specific problem the prospect faces.
// Make it clear and concise—avoid sounding too sales-focused or verbose.
// End with a call to action that shows your understanding of the prospect's needs.

// Goal: Craft a concise, human-sounding email to inspire action.
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
console.log("completed")
                    const messages = await openai.beta.threads.messages.list(
                        run.thread_id
                    );
                    // console.log("Messages listed", messages);


                    // for (const message of messages.data) {
                        // const content = message.content[0].text.value;
                        const content = messages.data[0].content[0].text.value

                        // Split the content to get the subject and body
                        const lines = content.split('\n');

			// const subjectMatch = content.match(/^Subject:\s*(.+)$/m);
			// const bodyMatch = content.match(/Body:\s*\n([\s\S]*)/);
			
                        subject_c = lines[0];
                     body_c = lines.slice(1).join('\n');
			// 
                        // const subject_c = subjectMatch ? subjectMatch[1].trim() : " no subj found ";
                        // const body_c = bodyMatch ? bodyMatch[1].trim() : " no body found ";
                         // const s = subject
                        //  const b = body
                        body_content = body_c
                        subject_line = subject_c
                        // console.log("Subject:", subject_c);
                        // console.log("Body:", body_c);
                        // await sendEmail(subject, body, To, token);
                        // SENT_EMAILS += 1;

                        return { subject_c , body_c };
                    // }


                } else {
                    console.log("status: ", run.status);
                    console.log(`vc ${timeElapsed} seconds`);
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
        let C_password = customer.password
        if (C_password == "null") {

            return 'Please sign in with Google';

        } else {

            return password === C_password ? true : 'Wrong Password';
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

const updateCustomer = async (email, updateData, res) => {
    try {
        const updatedCustomer = await Customer.findOneAndUpdate(
            { email: email },
            updateData,
            { new: true } // This option returns the modified document rather than the original
        );

        if (!updatedCustomer) {
            return res.status(404).send('Customer not found');
        }

        return res.json({ message: 'Customer updated successfully', customer: updatedCustomer });
    } catch (error) {
        console.error('Error updating customer:', error);
        return res.status(500).send('Error updating customer in the database');
    }
};


// const sendEmail = async (subject, message, to, token, myemail) => {

//     let transporter = nodemailer.createTransport({
//         service: 'gmail',
//         auth: {
//             user: 'voltmailerhelp@gmail.com',
//             pass: 'okwvawihfwmi'
//         }
//     });

//     let mailOptions = {
//         from: 'Voltmailer <voltmailerhelp@gmail.com>',
//         to,
//         subject,
//         text: message
//     };

//     try {
//         await transporter.sendMail(mailOptions);
//         console.log('Email sent successfully');
//     } catch (error) {
//         console.error('Error sending email:', error);
//     }
// };




const oldsendEmail = async (subject, message, to, token, myemail) => {
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

    const signature = await fetchUserSignature(tokens.access_token);

    const emailContent = [
        `To: <${to}>`,
        'Content-Type: text/html; charset=utf-8',
        'MIME-Version: 1.0',
        `Subject:  ${subject}`,
        '',
        `
        <html style="font-family: 'Open Sans', sans-serif;">
        <head>
        <link href="https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&display=swap" rel="stylesheet">
</head>
            <body style="font-family: 'Open Sans', sans-serif;">
                <pre style="font-family: 'Open Sans', sans-serif;">${message}</pre>
                <br><br>
                <pre>${signature}</pre>
            </body>
        </html>`,
    
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

        const customer = await Customer.findOne({ email: email });

        if (customer && customer.total_emails >= customer.
            plan_emails) {
            const newTotalEmails = customer.total_emails + 1;
            await Customer.updateOne(
                { email: email },
                { $set: { total_emails: newTotalEmails } }
            );
            console.log(`Emails used! ${newTotalEmails} emails used.`);
        }
        
        // } else {
        //     res.status(400).json({ message: "Not enough emails left or customer not found" });
        // }

    } catch (error) {
        console.error('Error sending email:', error);
        // res.status(500).send('Error sending email: ' + error.message);
    }
};

// Expose an endpoint to add an email to a campaign
app.post('/campaigns/:campaignId/add-email', async (req, res) => {
    const { campaignId } = req.params;
    const emailDetails = req.body;


    try {
        await addEmailToCampaign(campaignId, emailDetails, "rohanmehmi72@gmail.com");
        console.log("added email")
        res.json({ message: 'Email added to campaign successfully' });
    } catch (error) {
        console.error('Error adding email to campaign:', error);
        res.status(500).json({ message: 'Server error' });
    }
});


// const addEmailToCampaign = async (campaignId, emailDetails, email) => {
//     try {
//         // Find the campaign by ID
//         const campaign = await Campaign.findById(campaignId);

//         if (!campaign) {
//             console.log('Campaign not found');
//             return;
//         }
//         console.log("campaign found")

//         // Create a new email object
//         const newEmail = {
//             recipientEmail: emailDetails.recipientEmail,
//             subject: emailDetails.subject,
//             messageId: emailDetails.messageId,
//             threadId: emailDetails.threadId,
//             sentTime: new Date(),
//             status: emailDetails.status || 'sent',
//             bounces: emailDetails.bounces || false,
//             responseCount: emailDetails.responseCount || 0
//         };

//         // Add the new email to the campaign's `sentEmails` array
//         campaign.sentEmails.push(newEmail);
//         campaign.SENT_EMAILS += 1; // Increment the sent emails counter




//         await Customer.findOneAndUpdate(
//             { 'campaigns._id': campaignId },
//             {
//                 $set: { 'campaigns.$': campaign }
//             },
//             { new: true }
//         );

//         // // Save the campaign with the new email record
//         // await campaign.save();
//         // console.log("aved campaign")

//         // // Update customer's campaigns automatically if it’s part of customer schema
//         // const customer = await Customer.findOne({ email: email });
//         // if (customer) {
//         //     await customer.save(); // Ensure the updated campaign is saved under the customer
//         // }

//         console.log('Email added to campaign successfully');
//     } catch (error) {
//         console.error('Error adding email to campaign:', error);
//     }
// };







const sendEmail = async (subject, message, to, token, myemail,campaignId) => {
    console.log("data is:", to, message, subject);
    const userData = verifyJWT(token);

    if (!userData) {
        return;
    }

    console.log('User Data:', userData);
    const { email, tokens } = userData;

    console.log('Tokens:', tokens);

    oauth2Client.setCredentials(tokens);

    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

    const signature = await fetchUserSignature(tokens.access_token);

    const emailContent = [
        `To: <${to}>`,
        'Content-Type: text/html; charset=utf-8',
        'MIME-Version: 1.0',
        `Subject: ${subject}`,
        '',
        `
        <html style="font-family: 'Open Sans', sans-serif;">
        <head>
            <link href="https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&display=swap" rel="stylesheet">
        </head>
        <body style="font-family: 'Open Sans', sans-serif;">
            <pre style="font-family: 'Open Sans', sans-serif;">${message}</pre>
            <br><br>
            <pre>${signature}</pre>
        </body>
        </html>`
    ].join('\n');

    const base64EncodedEmail = Buffer.from(emailContent).toString('base64').replace(/\+/g, '-').replace(/\//g, '_');

    try {
        const result = await gmail.users.messages.send({
            userId: 'me',
            requestBody: {
                raw: base64EncodedEmail,
            },
        });

        console.log('Email sent successfully');

        const { id: messageId, threadId } = result.data;
        console.log(`Message ID: ${messageId}, Thread ID: ${threadId}`);

        const customer = await Customer.findOne({ email: email });
        const newTotalEmails = customer.total_emails + 1;   

        await Customer.updateOne(
                { email: email },
                { $set: { total_emails: newTotalEmails } }
            );
            console.log(`Emails used! ${newTotalEmails} emails used.`);

            const newEmail = {
                recipientEmail: to,
                subject: subject,
                messageId: messageId,
                threadId: threadId,
                sentTime: new Date(),
                status: 'sent',           // Default status
                bounces: false,           // Assume no bounce initially
                responseCount: 0          // Initial response count
            };
        
            // Call addEmailToCampaign function with necessary parameters
            const Emailresult = await addEmailToCampaign(email, campaignId, newEmail);
        
            // Check the result and handle any additional logic or error handling as needed
            if (Emailresult.success) {
                console.log(`Email successfully added to campaign: ${Emailresult.message}`);
            } else {
                console.error(`Failed to add email to campaign: ${Emailresult.message}`);
            }

        

        // Return messageId and threadId for further tracking
        return { messageId, threadId };
    }
    catch (error) {
        console.error('Error sending email:', error);
        throw new Error(`Error sending email: ${error.message}`);
    }
};

// Function to calculate overall metrics for a customer
async function calculateCustomerMetrics(customerId) {
    const customer = await Customer.findById(customerId);
    let totalSentEmails = 0;
    let totalBounces = 0;
    let totalReplies = 0;

    customer.campaigns.forEach(campaign => {
        totalSentEmails += campaign.SENT_EMAILS;
        totalBounces += campaign.sentEmails.filter(email => email.status === 'bounced').length;
        totalReplies += campaign.sentEmails.filter(email => email.responseCount > 0).length;
    });

    const bounceRate = (totalBounces / totalSentEmails) * 100;
    const replyRate = (totalReplies / totalSentEmails) * 100;

    await Customer.updateOne(
        { _id: customerId },
        {
            $set: {
                total_emails: totalSentEmails,
                bounceRate: bounceRate,
                replyRate: replyRate
            }
        }
    );

    return { totalSentEmails, bounceRate, replyRate };
}


// Function to track campaign metrics when the campaign finishes
async function trackCampaignMetrics(campaignId) {
    const customer = await Customer.findOne({ 'campaigns._id': campaignId });
    const campaign = customer.campaigns.id(campaignId);
  
    let totalEmails = campaign.sentEmails.length;
    let bounces = campaign.sentEmails.filter(email => email.status === 'bounced').length;
    let replies = campaign.sentEmails.filter(email => email.responseCount > 0).length;
  
    const bounceRate = (bounces / totalEmails) * 100;
    const replyRate = (replies / totalEmails) * 100;

    await Customer.updateOne(
        { 'campaigns._id': campaignId },
        {
            $set: {
                'campaigns.$.bounceRate': bounceRate,
                'campaigns.$.replyRate': replyRate,
                'campaigns.$.totalEmails': totalEmails
            }
        }
    );

    return { totalEmails, bounceRate, replyRate };
}

// Function to generate and send a summary email
async function sendCampaignSummary(customerId, campaignId) {
  const customer = await Customer.findById(customerId);
  const campaign = customer.campaigns.id(campaignId);
  
  const campaignMetrics = await trackCampaignMetrics(campaignId);
  const overallMetrics = await calculateCustomerMetrics(customerId);

  const emailBody = `
    Campaign ary:
    - Campaign Name: ${campaign.campaignName}
    - Total Emails Sent: ${campaignMetrics.totalEmails}
    - Bounce Rate: ${campaignMetrics.bounceRate}%
    - Reply Rate: ${campaignMetrics.replyRate}%

    Customer Overall Metrics:
    - Total Emails Sent: ${overallMetrics.totalSentEmails}
    - Overall Bounce Rate: ${overallMetrics.bounceRate}%
    - Overall Reply Rate: ${overallMetrics.replyRate}%
  `;

  // Send summary email (assuming you have a sendEmail function)
  await sendcampsummaryEmail({
    to: customer.email,
    subject: `Campaign Summary: ${campaign.campaignName}`,
    body: emailBody
  });

  console.log(`Summary email sent to ${customer.email}`);
}





  const emailTracker = new EmailTracker({
    imap: {
      user: process.env.IMAP_USER,
      password: process.env.IMAP_PASS,
      host: process.env.IMAP_HOST,
      port: process.env.IMAP_PORT,
      tls: true
    }
  });


//   async function refreshTokenIfNeeded(account) {
//     // Check if token is expired or about to expire
//     if (account.expiresAt && Date.now() >= account.expiresAt - 300000) { // 5 minutes buffer
//       try {
//         const refreshResponse = await axios.post('https://oauth2.googleapis.com/token', {
//           client_id: GOOGLE_OAUTH_CONFIG.clientId,
//           client_secret: GOOGLE_OAUTH_CONFIG.clientSecret,
//           refresh_token: account.refreshToken,
//           grant_type: 'refresh_token'
//         });

//         // Update tokens
//         account.accessToken = refreshResponse.data.access_token;
//         account.expiresAt = Date.now() + (refreshResponse.data.expires_in * 1000);

//         // Update in stored accounts
//         const index = this.accounts.findIndex(a => a.id === account.id);
//         if (index !== -1) {
//           this.accounts[index] = account;
//           this.saveAccounts();
//         }
//       } catch (error) {
//         console.error('Token refresh failed:', error);
//         throw error;
//       }
//     }
//   }

async function refreshGoogleToken(refreshToken) {
    try {
      const response = await axios.post('https://oauth2.googleapis.com/token', 
        new URLSearchParams({
          client_id: process.env.CLIENT_ID,
          client_secret: process.env.CLIENT_SECRET,
          refresh_token: refreshToken,
          grant_type: 'refresh_token'
        }).toString(),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      );
  
      return {
        accessToken: response.data.access_token,
        expiresAt: Date.now() + (response.data.expires_in * 1000)
      };
    } catch (error) {
      console.error('Token refresh failed:', {
        error: error.message,
        details: error.response?.data
      });
      throw new Error('Failed to refresh Google token');
    }
  }
  
  async function refreshTokenIfNeeded(account) {
    try {
      // Check if token is expired or will expire in next 5 minutes
      if (!account.expiresAt || Date.now() >= account.expiresAt - 300000) {
        console.log('Token needs refresh for account:', account.email);
        
        const { accessToken, expiresAt } = await refreshGoogleToken(account.refreshToken);
        
        // Update account with new tokens
        account.accessToken = accessToken;
        account.expiresAt = expiresAt;
  
        // If you're using a database, update it here
        try {
          await Customer.findOneAndUpdate(
            { email: account.email },
            { 
              accessToken: accessToken,
              expiresAt: expiresAt
            }
          );
        } catch (dbError) {
          console.error('Failed to update token in database:', dbError);
          // Continue anyway since we have the new token in memory
        }
      }
      
      return account;
    } catch (error) {
      console.error('Token refresh failed for account:', account.email);
      throw error;
    }
  }

      
  async function sendEmailGMAIL(to, subject, body, fromEmail, selectedAccount, htmlContent, attachments = []) {

    let retries = 0;
    let maxRetries = 4
    
    while (retries <= maxRetries) {
      try {
        // Refresh token if needed
        const refreshedAccount = await refreshTokenIfNeeded(selectedAccount);

      // Construct raw email message
    //   const rawMessage = btoa(
    //     `To: ${to}\r\n` +
    //     `Subject: ${subject}\r\n` +
    //     `Content-Type: text/plain; charset="UTF-8"\r\n\r\n` +
    //     body
    //   ).replace(/\+/g, '-').replace(/\//g, '_');

    // const rawMessage = Buffer.from(
    //     `MIME-Version: 1.0\r\n` +
    //     `To: ${to}\r\n` +
    //     `Subject: ${subject}\r\n` +
    //     `Content-Type: multipart/alternative; boundary="boundary"\r\n\r\n` +
    //     `--boundary\r\n` +
    //     `Content-Type: text/plain; charset="UTF-8"\r\n\r\n` +
    //     `${body}\r\n\r\n` +
    //     `--boundary\r\n` +
    //     `Content-Type: text/html; charset="UTF-8"\r\n\r\n` +
    //     `<div>${body}</div>\r\n\r\n` +
    //     `--boundary--`
    //   ).toString('base64')
    //     .replace(/\+/g, '-')
    //     .replace(/\//g, '_')
    //     .replace(/=+$/, '');


        const rawMessage 
        // = Buffer.from(
        //     `MIME-Version: 1.0\r\n` +
        //     `From: ${selectedAccount.email}\r\n` +
        //     `To: ${to}\r\n` +
        //     `Subject: ${subject}\r\n` +
        //     `Content-Type: multipart/alternative; boundary="boundary"\r\n\r\n` +
        //     `--boundary\r\n` +
        //     `Content-Type: text/plain; charset="UTF-8"\r\n\r\n` +
        //     `${body}\r\n\r\n` +
        //     `--boundary\r\n` +
        //     `Content-Type: text/html; charset="UTF-8"\r\n\r\n` +
        //     `<div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">` +
        //     `<p>${body.replace(/\n/g, '<br>')}</p>` +
        //     `<p style="margin-top: 20px; font-size: 12px; color: #777;"></p>` +
        //     `</div>\r\n\r\n` +
        //     `--boundary--`
        //   ).toString('base64')
        //     .replace(/\+/g, '-')
        //     .replace(/\//g, '_')
        //     .replace(/=+$/, '');

            = new Buffer.from(
                `MIME-Version: 1.0\r\n` +
                `From: ${selectedAccount.email}\r\n` +
                `To: ${to}\r\n` +
                `Subject: ${subject}\r\n` +
                `Content-Type: multipart/mixed; boundary="boundary"\r\n\r\n` +
                
                `--boundary\r\n` +
                `Content-Type: multipart/alternative; boundary="boundary-alt"\r\n\r\n` +
                
                `--boundary-alt\r\n` +
                `Content-Type: text/plain; charset="UTF-8"\r\n\r\n` +
                `${body}\r\n\r\n` +
                
                `--boundary-alt\r\n` +
                `Content-Type: text/html; charset="UTF-8"\r\n\r\n` +
                `${htmlContent}\r\n\r\n` +
                
                `--boundary-alt--\r\n` +
                
                // Add attachments if they exist
                attachments.map(att => 
                    `--boundary\r\n` +
                    `Content-Type: ${att.contentType}\r\n` +
                    `Content-Transfer-Encoding: base64\r\n` +
                    `Content-Disposition: attachment; filename="${att.filename}"\r\n\r\n` +
                    `${att.content}\r\n`
                ).join('\r\n') +
                
                `--boundary--`
            ).toString('base64')
                .replace(/\+/g, '-')
                .replace(/\//g, '_')
                .replace(/=+$/, '');


      // Send email via Gmail API
      const response = await axios.post(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/send`,
        { raw: rawMessage },
        {
          headers: {
            'Authorization': `Bearer ${selectedAccount.accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );
      console.log("success : ", response.data)
      const now = new Date();
      console.log(now.toISOString());


      const NewUpdatedEmail = new EData({
        id: response.data.id,
        recipient:to,
        from:selectedAccount.email,
        UUID:null,
        threadId:response.data.threadID,
        body:body,
        subject:subject,
        date: now.toISOString(),
        sentwith: 'gmail',
        status: 'delivered',
    });

    // Save the campaign to the database
    await NewUpdatedEmail.save();

    // Find the customer by email
    const customer = await Customer.findOne({ email: fromEmail });

    if (!customer) {
        console.log("customer not found")
        return res.status(404).json({ message: 'Customer not found' });
        
    }

    // Add the new campaign to the customer's campaigns array
    customer.emails.push(NewUpdatedEmail);
    
    // Save the updated customer to the database
    await customer.save();
    console.log("successfuly added email", NewUpdatedEmail)



      return response.data;
//     } catch (error) {
//       console.error('Failed to send email:', error);
//       throw error;
//     }
//   }

} catch (error) {
    if (error.response?.status === 401 && retries < maxRetries) {
      console.log(`Retry attempt ${retries + 1} due to auth error`);
      retries++;
      // Force token refresh on next attempt
      selectedAccount.expiresAt = 0;
      continue;
    }
    throw error;
  }
}
}

  
async function sendcampsummaryEmail({ to, email, subject, body, user, pass, service, campaignId }) {
 try {


//    const unsubscribeLink = `https://server.voltmailer.com/unsubscribe?sender=${encodeURIComponent(email)}&to=${encodeURIComponent(to)}`;
//    const transporter = nodemailer.createTransport({
//         service: 'gmail',
//         auth: {
//           user: user,
//           pass: pass, // App password if 2FA is enabled
//         },
//       });

//       const htmlTemplate = `
// <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
//   <p>${body.replace(/\n/g, '<br>')}</p>
//   <p style="margin-top: 20px; font-size: 12px; color: #777;">
    
//     <a href="${unsubscribeLink}" style="color: #007BFF;">unsubscribe</a>.
//   </p>
// </div>
// `;
    
//       // Define email options
//       const mailOptions = {  
//         from: user,
//         to: to,
//         subject: subject,
//         text: `${body}\n\nTo unsubscribe, visit: ${unsubscribeLink}`,
//         html: htmlTemplate,
//         // html: `<p>Click the link to reset your password: <a href="https://voltmailer.com/reset-password?token=${token}">Reset Password</a></p>`,
//         // html: `<p>${body.replace(/\n/g, '<br>')} </p>`,
//       };

//     const info = await transporter.sendMail(mailOptions)
//     console.log('Message sent: %s');


// const msg = {
//   to: to, // Change to your recipient
//   from: user, // Change to your verified sender
//   subject: subject,
//   text: body,
//   html: `
//    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
//   <p>${body.replace(/\n/g, '<br>')}</p>
//   <p style="margin-top: 20px; font-size: 12px; color: #777;">
    
//   </p>
// </div>`,
// }
// sgMail
//   .send(msg)
//   .then(() => {
//     console.log('Email sent')
//   })
//   .catch((error) => {
//     console.error(error)
//   })




//   const url = 'https://api.brevo.com/v3/smtp/email';
//   const apiKey = process.env.BREVO; // Replace with your actual API key

//   const data = {
//       sender: {
//           name: 'Alex',
//           email: user,
//       },
//       to: [
//           {
//               email: to,
//               name: 'Ro',
//           },
//       ],
//       subject: subject,
//       htmlContent: `<div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
//    <p>${body.replace(/\n/g, '<br>')}</p>
//    <p style="margin-top: 20px; font-size: 12px; color: #777;">
    
//    </p>
// </div>`,
//   };

//   try {
//       const info = await axios.post(url, data, {
//           headers: {
//               'accept': 'application/json',
//               'api-key': apiKey,
//               'content-type': 'application/json',
//           },
//       });

//       console.log('Email sent successfully:', info.data);
//   } catch (error) {
//       console.error('Error sending email:', error.info ? error.info.data : error.message);
//   }

const customer = await Customer.findOne({ email: email });
var google = false;

if (!customer) {
console.log("no customer found")
    return 'Customer not found' 
}

console.log("found customer", customer.mailboxes )

const mailboxFound = customer.mailboxes.find(mailboxObj => mailboxObj.smtp.user === user);

const accountGmail = mailboxFound.smtp.gmail


if (mailboxFound.smtp.user == accountGmail.email){
    console.log("google mailbox")
    google = true

}else {

    google = false
    console.log("mailjet")
    }


if (!mailboxFound) {
console.log("none found")
    return  'Mailbox not found'
}

console.log("active mailbox", mailboxFound.smtp)

if (google){
    console.log(accountGmail)
 sendEmailGMAIL(to, subject, body, email, accountGmail)

}else {
    const now = new Date();
    const customID = `${user}:${now.toISOString()}:${Math.floor(Math.random() * 10)}`

  const info = mailjet.post('send').request({
    FromEmail: user,
    FromName: 'Alex',
    Subject: subject,
    'Text-part':
      body,
    'Html-part':
      `<div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
  <p>${body.replace(/\n/g, '<br>')}</p>
  <p style="margin-top: 20px; font-size: 12px; color: #777;">
    
  </p>
</div>`,
    Recipients: [{ Email: to }],
    'Mj-CustomID': 'customID',
  })
  info
    .then(async (result) => {

    //   console.log( 'success : ', result.body)
    console.log('Email:', result.body.Sent[0]);
console.log('Email:', result.body.Sent[0].Email);
console.log('MessageID:', result.body.Sent[0].MessageID);
console.log('MessageUUID:', result.body.Sent[0].MessageUUID);



      console.log(now.toISOString());


      const NewUpdatedEmail = new EData({
        id: result.body.Sent[0].MessageID,
        recipient:to,
        from: user,
        UUID:result.body.Sent[0].MessageUUID,
        threadId:null,
        body:body,
        subject:subject,
        date: now.toISOString(),
        sentwith: 'mailjet',
        status: 'delivered',
        customID : customID
    });

    // Save the campaign to the database
    await NewUpdatedEmail.save();

    // Find the customer by email
    const customer = await Customer.findOne({ email: email });

    if (!customer) {
        console.log("customer not found")
        return res.status(404).json({ message: 'Customer not found' });
        
    }

    // Add the new campaign to the customer's campaigns array
    customer.emails.push(NewUpdatedEmail);
    
    // Save the updated customer to the database
    await customer.save();
    console.log("successfuly added email", NewUpdatedEmail)
      
    })
    .catch(err => {
      console.log(err.statusCode)
    })

}

        // const customer = await Customer.findOne({ email: email });
        const newTotalEmails = customer.total_emails + 1;   
    
        await Customer.updateOne(
                { email: email },
                { $set: { total_emails: newTotalEmails } }
            );


// Optional: Periodically check for bounces and replies
    //   try {
    //     // Check bounces within a reasonable timeframe
    //     setTimeout(async () => {
    //       const bounces = await emailTracker.checkBounces();
    //       const relevantBounces = bounces.filter(
    //         bounce => bounce.originalMessageId === info.messageId
    //       );

    //       if (relevantBounces.length > 0) {
    //         // Update email status or take appropriate action
    //         await updateEmailStatus(info.messageId, 'bounced');
    //       }
    //     }, 5 * 60 * 1000); // Check after 5 minutes

    //     // Check replies
    //     setTimeout(async () => {
    //       const replies = await emailTracker.trackReplies(info.trackingId);
    //       if (replies.length > 0) {
    //         // Update response count or take action
    //         await updateResponseCount(info.messageId, replies.length);
    //       }
    //     }, 15 * 60 * 1000); // Check after 15 minutes
    //   } catch (trackingError) {
    //     console.error('Error in tracking bounces/replies:', trackingError);
    //   }

    // return info;
  } catch (error) {
    console.error('Error sending test email:', error.message);
    throw new Error('Failed to send test email.');
  }
}


async function updateEmailStatus(messageId, status) {
    // Update email status in your database
    await Email.updateOne(
      { messageId: messageId },
      { $set: { status: status } }
    );
  }
  
  async function updateResponseCount(messageId, count) {
    // Update response count in your database
    await Email.updateOne(
      { messageId: messageId },
      { $inc: { responseCount: count } }
    );
  }



app.get('/get-unsubscribed-emails', async (req, res) => {
    try {
        const { sender } = req.query;

        if (!sender) {
            return res.status(400).json({ message: 'Sender email is required.' });
        }

        // Find the customer by sender email
        const customer = await Customer.findOne({ email: sender });

        if (!customer) {
            return res.status(404).json({ message: 'Sender not found.' });
        }

        // Return the unsubscribedEmails array
        res.status(200).json({ unsubscribedEmails: customer.unsubscribedEmails });
    } catch (error) {
        console.error('Error fetching unsubscribed emails:', error);
        res.status(500).json({ message: 'An error occurred while fetching unsubscribed emails.' });
    }
});


app.get('/unsubscribe', async (req, res) => {
    const { to, sender} = req.query;
    let email = to
    if (!email || !sender) {
      return res.status(400).send('Invalid unsubscribe request.');
    }
  
    const customer = await Customer.findOne({ email: sender });
    if (!customer) {
        return res.status(404).json({ message: 'Sender not found.' });
    }

    // Check if the email is already unsubscribed
    if (customer.unsubscribedEmails.includes(email)) {
        return res.status(400).json({ message: 'Email is already unsubscribed.' });
    }

    // Add email to unsubscribedEmails array
    customer.unsubscribedEmails.push(email);
    await customer.save();



  // Example confirmation HTML
  const confirmationHTML = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Unsubscribe Confirmation</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/animate.css/4.1.1/animate.min.css">
    <style>
        body {
            background: linear-gradient(135deg, #f6f8f9 0%, #e5ebee 100%);
        }
    </style>
</head>
<body class="flex items-center justify-center min-h-screen">
    <div class="w-full max-w-md p-8 space-y-6 bg-white rounded-xl shadow-2xl animate__animated animate__fadeIn">
        <div class="text-center">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-16 h-16 mx-auto mb-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h2 class="text-2xl font-bold text-gray-800 mb-2">Farewell, Inbox Warrior</h2>
            <p class="text-gray-600 mb-6">We've processed your unsubscribe request with the precision of a ninja.</p>
        </div>
        
        <div class="bg-gray-100 p-4 rounded-lg">
            <p class="text-sm text-gray-700 mb-2">
                <strong>Email:</strong> <span class="text-gray-900">${email}</span>
            </p>
            <p class="text-sm text-gray-700">
                <strong>Sender:</strong> <span class="text-gray-900">${sender}</span>
            </p>
        </div>
        
        <div class="space-y-4">
            <p class="text-center text-gray-600 text-sm">
                You've successfully unsubscribed from future communications.
            </p>
            
            <a href="mailto:${sender}" class="w-full block text-center bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 transition-colors">
                Oops, Change My Mind
            </a>
        </div>
        
        <div class="text-center text-xs text-gray-500 pt-4">
            Processed with care • No emails were harmed in this process
        </div>
    </div>
</body>
</html>
  `;

  // Send the dynamic HTML response
  res.send(confirmationHTML);
  });
  

  

async function checkForBounces(auth) {
    const gmail = google.gmail({ version: 'v1', auth });

    const result = await gmail.users.messages.list({
        userId: 'me',
        q: 'subject:"Delivery Status Notification (Failure)" OR subject:"Undelivered Mail Returned"',
        labelIds: ['INBOX'],
    });

    const messages = result.data.messages || [];
    for (const message of messages) {
        const msgData = await gmail.users.messages.get({
            userId: 'me',
            id: message.id,
        });

        const bounceDetails = parseBounceMessage(msgData.data);
        if (bounceDetails && bounceDetails.toEmail) {
            await markEmailAsBounced(bounceDetails.toEmail);
        }
    }
}

async function markEmailAsBounced(recipientEmail) {
    // Find the email in the customer campaigns and update the bounce status
    await Customer.updateOne(
        { "campaigns.sentEmails.recipientEmail": recipientEmail },
        { $set: { "campaigns.$.sentEmails.$[email].bounces": true, "campaigns.$.sentEmails.$[email].status": 'bounced' } },
        { arrayFilters: [{ "email.recipientEmail": recipientEmail }] }
    );
    console.log(`Marked email to ${recipientEmail} as bounced.`);
}



async function trackReplies(auth) {
    const gmail = google.gmail({ version: 'v1', auth });

    const customers = await Customer.find({ "campaigns.sentEmails": { $exists: true, $not: { $size: 0 } } });

    for (const customer of customers) {
        for (const campaign of customer.campaigns) {
            for (const sentEmail of campaign.sentEmails) {
                const result = await gmail.users.threads.get({
                    userId: 'me',
                    id: sentEmail.threadId,
                });

                // Calculate the number of responses
                const responseCount = result.data.messages.length - 1; // Subtract the original message

                // Update response count only if there are new responses
                if (responseCount > sentEmail.responseCount) {
                    await Customer.updateOne(
                        { "campaigns.sentEmails.messageId": sentEmail.messageId },
                        { $set: { "campaigns.$.sentEmails.$[email].responseCount": responseCount } },
                        { arrayFilters: [{ "email.messageId": sentEmail.messageId }] }
                    );
                    console.log(`Updated email to ${sentEmail.recipientEmail} with ${responseCount} responses.`);
                }
            }
        }
    }
}


// // Add a new email record to a specific campaign
// app.post('/api/campaigns/:campaignId/add-email', async (req, res) => {
//     const { campaignId } = req.params;
//     const { recipientEmail, subject, messageId, threadId, sentTime, status } = req.body;

//     try {
//         // Find the campaign by ID
//         const campaign = await Campaign.findById(campaignId);

//         if (!campaign) {
//             return res.status(404).json({ message: 'Campaign not found' });
//         }

//         // Create a new email object
//         const newEmail = {
//             recipientEmail,
//             subject,
//             messageId,
//             threadId,
//             sentTime: sentTime ? new Date(sentTime) : new Date(),
//             status,
//             bounces: status === 'bounced',
//             responseCount: 0
//         };

//         // Add the email to the campaign
//         campaign.sentEmails.push(newEmail);
//         campaign.SENT_EMAILS += 1; // Update the count of sent emails

//         // Save the updated campaign
//         await campaign.save();

//         res.json({ message: 'Email added to campaign successfully' });
//     } catch (error) {
//         console.error('Error adding email:', error);
//         res.status(500).json({ message: 'Server error' });
//     }
// });

app.post('/api/campaigns/addEmail', async (req, res) => {
    const { email, campaignId, newEmail } = req.body; // newEmail will contain details like recipientEmail, subject, etc.
    console.log("Adding email to campaign:", req.body);

    try {
        // Find the customer by their email address
        const customer = await Customer.findOne({ email: email });

        if (!customer) {
            console.log("Customer not found");
            return res.status(404).json({ message: 'Customer not found' });
        }

        // Find the specific campaign within the customer's campaigns array
        const campaign = customer.campaigns.id(campaignId);

        if (!campaign) {
            console.log("Campaign not found");
            return res.status(404).json({ message: 'Campaign not found' });
        }

        // Create the new email object
        const emailToAdd = {
            recipientEmail: newEmail.recipientEmail,
            subject: newEmail.subject,
            messageId: newEmail.messageId,
            threadId: newEmail.threadId,
            sentTime: new Date(), // or use newEmail.sentTime if provided
            status: newEmail.status || 'sent',
            bounces: newEmail.bounces || false,
            responseCount: newEmail.responseCount || 0
        };

        // Add the new email to the campaign's sentEmails array
        campaign.sentEmails.push(emailToAdd);

        // Update sent emails count for the campaign
        campaign.SENT_EMAILS += 1;

        // Save the updated customer data to the database
        await customer.save();

        console.log("Successfully added email to campaign");
        res.json({ message: 'Email added to campaign successfully', campaignId: campaign._id });
    } catch (error) {
        console.error('Error adding email to campaign:', error);
        res.status(500).json({ message: 'Server error' });
    }
});


// Internal function to add an email to a specific campaign
async function addEmailToCampaign(email, campaignId, newEmail) {
    try {
        // Find the customer by their email address
        const customer = await Customer.findOne({ email: email });

        if (!customer) {
            console.log("Customer not found");
            return { success: false, message: 'Customer not found' };
        }

        // Find the specific campaign within the customer's campaigns array
        const campaign = customer.campaigns.id(campaignId);

        if (!campaign) {
            console.log("Campaign not found");
            return { success: false, message: 'Campaign not found' };
        }

        // Create the new email object
        const emailToAdd = {
            recipientEmail: newEmail.recipientEmail,
            subject: newEmail.subject,
            messageId: newEmail.messageId,
            threadId: newEmail.threadId,
            sentTime: new Date(), // or use newEmail.sentTime if provided
            status: newEmail.status || 'sent',
            bounces: newEmail.bounces || false,
            responseCount: newEmail.responseCount || 0
        };

        // Add the new email to the campaign's sentEmails array
        campaign.sentEmails.push(emailToAdd);

        // Update sent emails count for the campaign
        campaign.SENT_EMAILS += 1;

        // Save the updated customer data to the database
        await customer.save();

        console.log("Successfully added email to campaign");
        return { success: true, message: 'Email added to campaign successfully', campaignId: campaign._id };
    } catch (error) {
        console.error('Error adding email to campaign:', error);
        return { success: false, message: 'Server error', error };
    }
}

// // Express route that uses the internal function
// app.post('/api/campaigns/addEmail', async (req, res) => {
//     const { email, campaignId, newEmail } = req.body;
//     console.log("Adding email to campaign:", req.body);

//     // Call the internal function
//     const result = await addEmailToCampaign(email, campaignId, newEmail);

//     // Send response based on the result of the internal function
//     if (result.success) {
//         res.json(result);
//     } else {
//         res.status(404).json(result);
//     }
// });



app.post('/api/campaigns/create', async (req, res) => {
    const { email, campaignName, template, pitch } = req.body;
    console.log("creating a campaign with: ", req.body)

    try {
        // Generate a unique campaign name if one is not provided
        const uniqueCampaignName = campaignName || `Campaign-${Math.random().toString(36).substring(2, 10)}`;

        // Create a new campaign object
        const newCampaign = new Campaign({
            campaignName: uniqueCampaignName,
            template,
            pitch,
            sentEmails: [],
            createdTime: new Date(),
            SENT_EMAILS: 0,
            bounceRate: 0,
            replyRate: 0
        });

        // Save the campaign to the database
        await newCampaign.save();

        // Find the customer by email
        const customer = await Customer.findOne({ email: email });

        if (!customer) {
            console.log("customer not found")
            return res.status(404).json({ message: 'Customer not found' });
            
        }

        // Add the new campaign to the customer's campaigns array
        customer.campaigns.push(newCampaign);
        
        // Save the updated customer to the database
        await customer.save();
        console.log("successfuly created campaign")
        res.json({ message: 'Campaign created successfully', campaignId: newCampaign._id });
    } catch (error) {
        console.error('Error creating campaign:', error);
        res.status(500).json({ message: 'Server error' });
    }
    
});


// app.post('/api/Mailboxes/create', async (req, res) => {
//     const { email, smtp } = req.body;
//     console.log("creating a mailbox with: ", req.body)

//     try {
//         // Generate a unique campaign name if one is not provided
//         // const uniqueCampaignName = campaignName || `Campaign-${Math.random().toString(36).substring(2, 10)}`;

//         // Create a new campaign object
//         const newMailbox = new Campaign({
//             smtp
//         });

//         // Save the campaign to the database
//         await newMailbox.save();

//         // Find the customer by email
//         const customer = await Customer.findOne({ email: email });

//         if (!customer) {
//             console.log("customer not found")
//             return res.status(404).json({ message: 'Customer not found' });
            
//         }

//         // Add the new campaign to the customer's campaigns array
//         customer.mailboxes.push(newMailbox);
        
//         // Save the updated customer to the database
//         await customer.save();
//         console.log("successfuly created Mailbox")
//         res.json({ message: 'Mailbox created successfully' });
//     } catch (error) {
//         console.error('Error creating Mailbox:', error);
//         res.status(500).json({ message: 'Server error' });
//     }
// });


app.post('/api/mailboxes/create', async (req, res) => {
    const { email, smtp } = req.body;

    try {
        console.log("Creating a mailbox with:", req.body);

        // Find the customer by email
        const customer = await Customer.findOne({ email });
        if (!customer) {
            console.log(email)
            return res.status(404).json({ message: 'Customer not found' });
        }

        // Create the new mailbox object
        const newMailbox = {
            smtp,
            isActive: customer.mailboxes.length === 0 // Automatically set active if it's the first mailbox
        };

        // Add the new mailbox to the customer's mailboxes array
        customer.mailboxes.push(newMailbox);

        // Save the updated customer to the database
        await customer.save();

        // Retrieve the newly added mailbox (last in the array)
        const addedMailbox = customer.mailboxes[customer.mailboxes.length - 1];

        console.log("Successfully created mailbox");
        res.json({
            message: 'Mailbox created successfully',
            mailbox: {
                id: addedMailbox._id,
                smtp: addedMailbox.smtp,
                isActive: addedMailbox.isActive
            }
        });
    } catch (error) {
        console.error('Error creating mailbox:', error);
        res.status(500).json({ message: 'Server error' });
    }
});


// https://server.voltmailer.com/api/mailboxes/delete

// Delete a specific mailbox
app.delete('/api/mailboxes/:email', async (req, res) => {
    const { id } = req.params;
    const { email } = req.body;

    try {
        // Find the user by email
        const customer = await Customer.findOne({ email });

        if (!customer) {
            return res.status(404).json({ message: 'Customer not found' });
        }

        // Remove the mailbox from the user's list
        customer.mailboxes = customer.mailboxes.filter(
            (mailboxId) => mailboxId.toString() !== id
        );

        // Save the updated user
        await customer.save();

        // Remove the mailbox from the database
        await Campaign.findByIdAndDelete(id);

        res.json({ message: 'Mailbox deleted successfully' });
    } catch (error) {
        console.error('Error deleting mailbox:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

app.post('/api/mailboxes/switch', async (req, res) => {
    const { email, mailboxUser } = req.body;

    try {
        const customer = await Customer.findOne({ email });
        if (!customer) {
            return res.status(404).json({ message: 'Customer not found' });
        }

        // Reset all mailboxes to inactive
        // customer.mailboxes.forEach(mailbox => mailbox.isActive = false);

        // Set the specified mailbox as active
                // Find the mailbox with the matching smtp.user
                const mailbox = customer.mailboxes.find(mailbox => mailbox.smtp.user === mailboxUser);
                if (!mailbox) {
                    return res.status(404).json({ message: 'Mailbox not found' });
                }
        
        if (!mailbox) {
            return res.status(404).json({ message: 'Mailbox not found' });
        }
        mailbox.isActive = true;

        await customer.save();
        res.json({ message: 'Active mailbox updated successfully' });
    } catch (error) {
        console.error('Error switching mailbox:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

    app.post('/api/mailboxes/delete', async (req, res) => {
        const { email, mailboxUser } = req.body;

    console.log(email, mailboxUser, 'deleting')

    try {
        const customer = await Customer.findOne({ email });
        console.log('found customer')
        if (!customer) {
            return res.status(404).json({ message: 'Customer not found' });
        }

        // Reset all mailboxes to inactive
        // customer.mailboxes.forEach(mailbox => mailbox.isActive = false);

        // Set the specified mailbox as active
        // console.log('Mailbox User:', mailboxUser);
        // console.log('Customer Mailboxes:', customer.mailboxes[0].smtp.user);

        // console.log('Looking for mailboxUser:', mailboxUser);
        // customer.mailboxes.forEach(mailbox => {
        //     console.log('DB mailbox user:', mailbox.smtp.user);
        //     console.log('Types:', {
        //         mailboxUser: typeof mailboxUser,
        //         dbUser: typeof mailbox.smtp.user
        //     });
        // });

        console.log('Direct comparison:', mailboxUser === customer.mailboxes[0].smtp.user);
console.log('String lengths:', {
  mailboxUser: mailboxUser.length,
  dbUser: customer.mailboxes[0].smtp.user.length
});

console.log('Character codes:');
console.log('mailboxUser:', [...mailboxUser].map(c => c.charCodeAt(0)));
console.log('dbUser:', [...customer.mailboxes[0].smtp.user].map(c => c.charCodeAt(0)));


const mailboxIndex = customer.mailboxes.findIndex(
    mailbox => mailbox.smtp.user.trim() === mailboxUser.trim()
);

        // const mailbox = customer.mailboxes.find(mailbox => mailbox.smtp.user === mailboxUser);
        // if (!mailbox) {
        //     return res.status(404).json({ message: 'Mailbox not found' });
        // }
        // customer.mailboxes = customer.mailboxes.filter(
        //     (mailbox) => mailbox.smtp.user !== mailboxUser
        // );

                // Find the index of the mailbox to be deleted
                // const mailboxIndex = customer.mailboxes.findIndex(mailbox => mailbox.smtp.user === mailboxUser);
                console.log(mailboxIndex)
        
                // Debug logs

        


                if (mailboxIndex === -1) {
                    return res.status(404).json({ message: 'Mailbox not found' });
                }
        
                // Remove the mailbox from the mailboxes array
                // customer.mailboxes.splice(mailboxIndex, 1);
                


        

        customer.mailboxes.splice(mailboxIndex, 1);
        console.log("Before save:", customer.mailboxes.length);
        const savedCustomer = await customer.save();
        console.log("After save:", savedCustomer.mailboxes.length);
        
        // Verify the database directly
        const verifyCustomer = await Customer.findOne({ email });
        console.log("Verified from DB:", verifyCustomer.mailboxes.length);

        console.log("customer gone")
        // await customer.save();
        res.json({ message: 'Active mailbox updated successfully' });
    } catch (error) {
        console.error('Error switching mailbox:', error);
        res.status(500).json({ message: 'Server error' });
    }
});


app.post('/api/mailboxes/inactive', async (req, res) => {
    const { email, mailboxUser } = req.body;

    try {
        const customer = await Customer.findOne({ email });
        if (!customer) {
            return res.status(404).json({ message: 'Customer not found' });
        }

        // Reset all mailboxes to inactive
        // customer.mailboxes.forEach(mailbox => mailbox.isActive = false);

        // Set the specified mailbox as active
        const mailbox = customer.mailboxes.find(mailbox => mailbox.smtp.user === mailboxUser);
        if (!mailbox) {
            return res.status(404).json({ message: 'Mailbox not found' });
        }
        mailbox.isActive = false;

        await customer.save();
        res.json({ message: 'Active mailbox updated successfully' });
    } catch (error) {
        console.error('Error switching mailbox:', error);
        res.status(500).json({ message: 'Server error' });
    }
});


// Fetch all mailboxes for a user
app.get('/api/mailboxes', async (req, res) => {
    const { email } = req.query;

    try {
        // Find the user by email
        const customer = await Customer.findOne({ email }).populate('mailboxes');

        if (!customer) {
            return res.status(404).json({ message: 'Customer not found' });
        }

        // Send back the mailboxes
        res.json(customer.mailboxes);
    } catch (error) {
        console.error('Error fetching mailboxes:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

app.get('/api/mailboxes/active', async (req, res) => {
    const { email } = req.query;

    try {
        // Find the customer by email
        const customer = await Customer.findOne({ email });
        if (!customer) {
            return res.status(404).json({ message: 'Customer not found' });
        }

        // Find the active mailbox
        
        // Filter all active mailboxes and extract their smtp.user
        const activeMailboxUsers = customer.mailboxes
            .filter(mailbox => mailbox.isActive) // Get active mailboxes
            .map(mailbox => mailbox.smtp.user); // Extract smtp.user

        

        // If no active mailbox exists, return null
        if (!activeMailboxUsers) {
            return res.json(null); // Respond with null
        }

        // Return the list of smtp.user values
        res.json(activeMailboxUsers);
    } catch (error) {
        console.error('Error retrieving active mailbox:', error);
        res.status(500).json({ message: 'Server error' });
    }
});


async function apiemails(email){

    try {
        // Find the customer by email
        const customer = await Customer.findOne({ email });
        if (!customer) {
            return ({ message: 'Customer not found' });
        }
        const Emails = customer.emails;

        if (!Emails) {
            return (null); // Respond with null
        }

        const updatedEmails = await Promise.all(Emails.map(async (
            email 
        ) => {
            if (email.sentwith === 'mailjet'){
                try{


const request = mailjet.get('message').request({
  CustomID: email.CustomID,
})
request
  .then(result => {
    // console.log(result.body)
    const MessageStatus = response.body.Data[0].Status;
    email.status = MessageStatus.toLowerCase();
    console.log('staus : ', email.status)
  })
  .catch(err => {
    console.log(err.statusCode)
  })

                } catch (mjerror) {
                    console.error('error fetching mailjet status: ', mjerror)
                }
            }
            return email
        }))

        res.json(updatedEmails);
    } catch (error) {
        console.error('Error retrieving active mailbox:', error);
        return ({ message: 'Server error' });
    }
}

app.get('/api/senders', async (req, res) => {
try {
const request = mailjet
	.get("sender", {'version': 'v3'})
	.request()
request
	.then((result) => {
		console.log(result.body)
        res.json(result.body.Data);
	})
	.catch((err) => {
		console.log(err.statusCode)
        res.json({ message : 'failed'})
	})
    

} catch (error) {
    console.error('Error retrieving active mailbox:', error);
    res.status(500).json({ message: 'Server error' });
}
});



app.get('/api/emails', async (req, res) => {
    const { email } = req.query;

    try {
        // Find the customer by email
        const customer = await Customer.findOne({ email });
        if (!customer) {
            return res.status(404).json({ message: 'Customer not found' });
        }
        const Emails = customer.emails;

        if (!Emails) {
            return res.json(null); // Respond with null
        }

//         const updatedEmails = await Promise.all(Emails.map(async (
//             email 
//         ) => {
//             if (email.sentwith === 'mailjet'){
//                 try{


// const request = mailjet.get('message').request({
//   CustomID: email.CustomID,
// })
// request
//   .then(result => {
//     console.log(result.body)
//     const MessageStatus = response.body.Data[0].Status;
//     email.status = MessageStatus.toLowerCase();
//     console.log('staus : ', email.status)
//   })
//   .catch(err => {
//     console.log(err.statusCode)
//   })

//                 } catch (mjerror) {
//                     console.error('error fetching mailjet status: ', mjerror)
//                 }
//             }
//             return email
//         }))

        res.json(Emails);
    } catch (error) {
        console.error('Error retrieving active mailbox:', error);
        res.status(500).json({ message: 'Server error' });
    }
});







async function GetEmailsxx(email){
    const customer = await Customer.findOne({ email });
    if (!customer) {
        return 'Customer not found' ;
    }

    // Find the active mailbox
    
    // Filter all active mailboxes and extract their smtp.user
    const Emails = customer.emails

    

    // If no active mailbox exists, return null
    if (!Emails) {
        return res.json(null); // Respond with null
    }

    // Return the list of smtp.user values
    return Emails;
}

async function mailboxessend(email, to, subject, text, mailbox){
    console.log("body : ", req.body)
    try {
        const customer = await Customer.findOne({ email });
        if (!customer) {
		console.log("no customer found")
            return 'Customer not found' 
        }
	    console.log("found customer", customer.mailboxes )

        const mailboxFound = customer.mailboxes.find(mailboxObj => mailboxObj.smtp.user === mailbox);

        if (!mailboxFound) {
		console.log("none found")
            return  'Mailbox not found'
        }
	    console.log("active mailbox", mailboxFound.smtp)
	    

        const { host, port, secure, user, pass } = mailboxFound.smtp;
console.log("activeMailbox.smtp : ", mailboxFound.smtp)
       await   sendcampsummaryEmail({
            to: to,
            subject: subject,
            body: text,
            user:  user,
            pass: pass, // App password
            service: 'gmail',
          });

        console.log("Email sent:");
       return  'Email sent successfully'
    } catch (error) {
        console.error('Error sending email:', error);
        return 'Server error' 
    }
};

app.post('/api/mailboxes/send', async (req, res) => {
    const { email, to, subject, text, mailbox, campaignid } = req.body;
    console.log("body : ", req.body)
    try {
        const customer = await Customer.findOne({ email });
        if (!customer) {
		console.log("no customer found")
            return res.status(403).json({ message: 'Customer not found' });
        }
	    console.log("found customer", customer.mailboxes )

        const mailboxFound = customer.mailboxes.find(mailboxObj => mailboxObj.smtp.user === mailbox);
        if (!mailboxFound) {
		console.log("none found")
            return res.status(403).json({ message: 'Mailbox not found' });
        }
	    console.log("active mailbox", mailboxFound.smtp)

        // Process email assets
        let signature = '';
        let mediaAttachments = [];
        
        if (req.body.signature) {
            signature = req.body.signature;
            console.log("Signature found and will be included");
        }
        
        if (req.body.mediaAttachments && Array.isArray(req.body.mediaAttachments)) {
            mediaAttachments = req.body.mediaAttachments;
            console.log("Attachments found:", mediaAttachments.length);
        }

	    

        const { host, port, secure, user, pass } = mailboxFound.smtp;
console.log("activeMailbox.smtp : ", mailboxFound.smtp)
    //    await   sendcampsummaryEmail({
    //         to: to,
    //         email:email,
    //         subject: subject,
    //         body: text,
    //         user:  user,
    //         pass: pass, // App password
    //         service: 'gmail',
    //         campaignid: campaignid
    //       });

          await sendEmailWithAttachments(
            mailboxFound.smtp,
            to,
            subject,
            text,
            signature,
            mediaAttachments,
            email
        );

        console.log("Email sent:");
        res.json({ message: 'Email sent successfully'});
    } catch (error) {
        console.error('Error sending email:', error);
        res.status(500).json({ message: 'Server error' });
    }
});


app.post('/verify-smtp', async (req, res) => {
    // const { host, port, secure, user, pass } = req.body;


const { smtp } = req.body;

    if (!smtp) {
        return res.status(400).json({ success: false, message: 'SMTP details are missing!' });
    }

    const { host, port, secure, user, pass } = smtp; 
    console.log(host, port, secure, user, pass)
console.log(smtp)
    // const transporter = nodemailer.createTransport({
    //     host: host,
    //     port: port,
    //     secure: secure,
    //     auth: {
    //         user: user, // Your email address
    //         pass: pass // Your email password
    //     }
    // });
    try {
        // Verify SMTP connection
        // await transporter.verify((error, success) => {
        //     if (error) {
        //         console.error('SMTP verification failed:', error);
        //     } else {
        //         console.log('SMTP is ready to send emails:', success);
        //     }
        // });
        // console.log('SMTP details are correct!');
        // sendcampsummaryEmail({
        //     to: 'rohanmehmi72@gmail.com',
        //     subject: 'Test Email',
        //     body: 'This is a test email',
        //     user:  'voltmailerhelp@gmail.com',
        //     pass: 'chys ltjh yxlo isbu', // App password
        //     service: 'gmail',
        //   });

       await   sendcampsummaryEmail({
            to: 'rohanmehmi72@gmail.com',
            subject: 'Test Email',
            body: 'This is a test email',
            user:  user,
            pass: pass, // App password
            service: 'gmail',
          });

        console.log("Email sent:");
        // res.json({ message: 'Email sent successfully', info });

        return res.status(200).json({ success: true, message: 'SMTP verified successfully!' });
    } catch (error) {
        console.error('Error verifying SMTP:', error.message);
        return res.status(400).json({ success: false, message: error.message });
    }
});



  


// const cron = require('node-cron');
// const { oauth2Client } = require('./oauth'); // Ensure you have the OAuth client setup for Gmail API

// // Schedule bounce tracking every hour
// cron.schedule('0 * * * *', () => {
//     checkForBounces(oauth2Client).catch(err => console.error("Error in bounce tracking:", err));
// });

// // Schedule reply tracking every hour
// cron.schedule('0 * * * *', () => {
//     trackReplies(oauth2Client).catch(err => console.error("Error in reply tracking:", err));
// });



// Helper function to extract emails from a page
const extractEmails = (text) => {
    return text.match(/[a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+/g);
  };
  
  // Helper function to get all internal links from a page
  const extractInternalLinks = (currentUrl, $) => {
    const links = [];
    $('a').each((i, el) => {
      const href = $(el).attr('href');
      if (href && href.startsWith('/') || href.includes(currentUrl)) {
        // Make sure to handle relative and absolute links
        const fullUrl = url.resolve(currentUrl, href);
        links.push(fullUrl);
      }
    });
    return links;
  };
  
  // Recursive crawler and email scraper
  const crawlAndScrapeEmails = async (startUrl, visitedUrls = new Set(), emails = new Set()) => {
    if (visitedUrls.has(startUrl)) return; // Prevent revisiting pages
    visitedUrls.add(startUrl);
  
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
  
    try {
      console.log(`Visiting: ${startUrl}`);
      await page.goto(startUrl, { waitUntil: 'networkidle2' });
      const pageContent = await page.content();
  
      // Load page content with cheerio
      const $ = cheerio.load(pageContent);
  
      // Extract emails from the page
      const pageEmails = extractEmails($.text());
      pageEmails && pageEmails.forEach(email => emails.add(email));
  
      // Extract internal links
      const internalLinks = extractInternalLinks(startUrl, $);
  
      await browser.close();
  
      // Crawl the links recursively
      for (const link of internalLinks) {
        if (!visitedUrls.has(link) && link.includes(url.parse(startUrl).hostname)) {
          await crawlAndScrapeEmails(link, visitedUrls, emails);
        }
      }
  
    } catch (error) {
      console.error(`Error scraping ${startUrl}:`, error);
      await browser.close();
    }
  
    return Array.from(emails);
  };
  

  ///////////////////////////////////// Routes  //////////////////////////////////////////////////


  // API route to scrape emails from the whole website
  app.get('/scrape-emails', async (req, res) => {
    const domain = req.query.domain;
  
    if (!domain) {
      return res.status(400).json({ error: 'Domain is required' });
    }
  
    const startUrl = `https://${domain}`;
    const emails = await crawlAndScrapeEmails(startUrl);
  
    res.json({ domain, emails });
  });




// Endpoint to get emails by domain
// app.post('/get-emails', async (req, res) => {
//     const { domain } = req.body;

//     if (!domain) {
//         return res.status(400).json({ error: 'No domain provided.' });
//     }

//     try {
//         const result = await hunter.domainSearch({
//             domain: domain,
//             limit: 10  // Adjust as needed
//         });
//         console.log(result)
//         if (result && result.data.emails) {
//             const emails = result.data.emails;
//             if (emails.length > 0) {
//                 const submittedData = emails.map(emailInfo => ({
//                     email: emailInfo.value,
//                     website: domain,
//                     name: emailInfo.first_name
//                 }));
//                 res.json({ success: true, submittedData });
//             } else {
//                 res.status(404).json({ error: `No emails found for ${domain}. x1` });
//             }
//         } else {
//             res.status(404).json({ error: `No results for ${domain}. y2` });
//         }
//     } catch (error) {
//         console.error('An error occurred:', error);
//         res.status(500).json({ error: 'An error occurred while fetching data.' });
//     }
// });

app.get('/get-emails', async (req, res) => {
    const domain = req.query.domain;
    console.log(domain)

    if (!domain) {
        return res.status(400).json({ error: 'No domain provided.' });
    }

    try {
        const response = await axios.get(`https://api.hunter.io/v2/domain-search`, {
            params: {
                domain: domain,
                api_key: hunter,
            }
        });
        console.log(response)
        res.json(response.data);
    } catch (error) {
        console.error('Error fetching data from Hunter API:', error);
        res.status(500).json({ error: 'Error fetching data from Hunter API.' });
    }
});

// Route to add a new driver
app.get('/add-driver', async (req, res) => {
    const { driver: name, url, email, nextRace = 'Unknown', emailSent = 'No' } = req.query;

    try {
        const newDriver = new Driver({ name, url, email, nextRace, emailSent });
        await newDriver.save();
        console.log('Driver added:', newDriver);
        res.status(200).json({ message: 'Driver added successfully' });
    } catch (error) {
        console.error('Error adding a new driver:', error);
        res.status(500).json({ error: 'Error adding a new driver.' });
    }
});

// Route to update a driver
app.get('/update-driver', async (req, res) => {
    const { url, fieldName, newData } = req.query;

    try {
        const update = { [fieldName]: newData };
        await Driver.updateOne({ url }, { $set: update });
        console.log(`Driver with URL ${url} updated: ${fieldName} = ${newData}`);
        res.status(200).json({ message: 'Driver updated successfully' });
    } catch (error) {
        console.error('Error updating driver:', error);
        res.status(500).json({ error: 'Error updating driver.' });
    }
});

app.post('/update-driver-full', async (req, res) => {
    const { url } = req.query;
    const newDriverData = req.body;

    try {
        await Driver.updateOne({ url }, { $set: newDriverData });
        console.log(`Driver with URL ${url} updated with new data:`, newDriverData);
        res.status(200).json({ message: 'Driver updated successfully' });
    } catch (error) {
        console.error('Error updating driver:', error);
        res.status(500).json({ error: 'Error updating driver.' });
    }
});


app.get('/update-driver-email', async (req, res) => {
    const { email, fieldName, newData } = req.query;

    try {
        const update = { [fieldName]: newData };
        await Driver.updateOne({ email }, { $set: update });
        console.log(`Driver with Email ${email} updated: ${fieldName} = ${newData}`);
        res.status(200).json({ message: 'Driver updated successfully' });
    } catch (error) {
        console.error('Error updating driver:', error);
        res.status(500).json({ error: 'Error updating driver.' });
    }
});


// // Route to get all drivers
// app.get('/get-drivers', async (req, res) => {
//     try {
//         const drivers = await Driver.find();
//         console.log('Drivers retrieved:', drivers);
//         const result = await Driver.updateMany(
//             { nextRace: "null" },
//             { $set: { nextRace: "no race found" } }
//         );
//         console.log('Drivers updated:', result.nModified);
//         res.status(200).json(drivers);
//     } catch (error) {
//         console.error('Error retrieving drivers:', error);
//         res.status(500).json({ error: 'Error retrieving drivers.' });
//     }
// });

app.get('/get-drivers', async (req, res) => {
    try {
        await Driver.updateMany(
            { nextRace: "null" },
            { $set: { nextRace: "no race found" } }
        );

        const drivers = await Driver.find();
        console.log('Drivers retrieved and updated:', drivers);
        res.status(200).json(drivers);
    } catch (error) {
        console.error('Error retrieving or updating drivers:', error);
        res.status(500).json({ error: 'Error retrieving or updating drivers.' });
    }
});


// Route to remove a driver
app.get('/remove-driver', async (req, res) => {
    const { url } = req.query;

    try {
        await Driver.deleteOne({ url });
        console.log(`Driver with URL ${url} removed`);
        res.status(200).json({ message: 'Driver removed successfully' });
    } catch (error) {
        console.error('Error removing driver:', error);
        res.status(500).json({ error: 'Error removing driver.' });
    }
});

function separateSubject(input) {
    // Check if the input starts with "Subject: "
    const prefix = "Subject: ";
    if (input.startsWith(prefix)) {
        // Extract the actual subject line by removing the prefix
        const actualSubject = input.substring(prefix.length);
        return {
            prefix: prefix.trim(),
            subject: actualSubject.trim()
        };
    } else {
        // If the input does not start with "Subject: ", return null or handle accordingly
        return null;
    }
}

// function calculateDelay(emailsPerHour) {
//     const cappedEmailsPerHour = Math.min(emailsPerHour, 90); // Cap at 90 emails/hour for delay calculation
//     const baseDelay = Math.ceil(3600 / cappedEmailsPerHour) * 1000; // Base delay in ms
//     const minVariance = -0.2 * baseDelay; // 20% faster than base delay
//     const maxVariance = 0.3 * baseDelay;  // 30% slower than base delay
//     return baseDelay + Math.random() * (maxVariance - minVariance) + minVariance;
// }

async function sendEmailWithAttachments(mailbox, to, subject, body, signature, attachments, myemail) {
    try{
        console.log('=== Starting Email Attachment Processing ===');
        console.log('Recipient:', to);
        console.log('Number of attachments received:', attachments ? attachments.length : 0);
        
        const MAX_TOTAL_SIZE = 25 * 1024 * 1024; // 25MB
    let totalSize = 0;
    
    const validAttachments = Array.isArray(attachments) ? attachments : [];
    console.log('Valid attachments array:', validAttachments.length);

    const processedAttachments = validAttachments
    .filter(att => {
        if (!att || !att.data) {
            console.log('Skipping invalid attachment:', att?.name || 'unnamed', '- Missing data');
            return false;
        }
        return true;
    })
    .filter(att => {
        try {
        // Handle both full data URLs and raw base64
        const base64Data = att.data.includes('base64,') ? 
            att.data.split('base64,')[1] : 
            att.data;
            
        const size = Buffer.from(base64Data, 'base64').length;
        console.log('Attachment details:', {
            name: att.name,
            type: att.type,
            size: `${(size / 1024 / 1024).toFixed(2)}MB`,
            totalAccumulatedSize: `${(totalSize / 1024 / 1024).toFixed(2)}MB`,
            withinLimit: (totalSize + size <= MAX_TOTAL_SIZE)
        });
        if (totalSize + size <= MAX_TOTAL_SIZE) {
            totalSize += size;
            return true;
        }
        console.warn(`Skipping attachment ${att.name}: size limit exceeded`);
        return false;
    } catch (error) {
        console.warn(`Invalid attachment data for ${att.name}:`, error);
        return false;
    }
});
console.log('Successfully processed attachments:', processedAttachments.length);
console.log('Total size of attachments:', `${(totalSize / 1024 / 1024).toFixed(2)}MB`);
const htmlContent = `
<div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
    <p>${body.replace(/\n/g, '<br>')}</p>
    ${signature ? `<div class="signature">${signature}</div>` : ''}
</div>
`;
// const accountGmail = mailbox.smtp.gmail


if (mailbox.gmail ){

// For Gmail
console.log('Using Gmail for sending');
const attachmentsFormatted = processedAttachments.map(att => {
   const base64Data = att.data.includes('base64,') ? 
       att.data.split('base64,')[1] : 
       att.data;
       
   console.log('Formatting attachment for Gmail:', {
       filename: att.name,
       type: att.type
   });

   return {
       filename: att.name,
       content: base64Data,
       encoding: 'base64',
       contentType: att.type
   };
});

console.log('Attempting to send email with', attachmentsFormatted.length, 'attachments');

const result = await sendEmailGMAIL(
   to, 
   subject, 
   body, 
   myemail, 
   mailbox.gmail, 
   htmlContent, 
   attachmentsFormatted
);

console.log('Email sent successfully with attachments');
return result;
} else {
        // For Mailjet
        const attachmentsFormatted = processedAttachments.map(att => ({
            'Content-Type': att.type,
            'Filename': att.name,
            'Base64Content': att.data.split('base64,')[1]
        }));

        const mailjetData = {
            FromEmail: mailbox.smtp.user,
            FromName: 'Alex',
            Subject: subject,
            'Text-part': body,
            'Html-part': htmlContent,
            Recipients: [{ Email: to }],
            Attachments: attachmentsFormatted
        };

        return mailjet.post('send').request(mailjetData);
    }
} catch (error) {
    console.error('=== Error in sendEmailWithAttachments ===');
    console.error('Error details:', error);
    console.error('Recipient:', to);
    console.error('Attempted attachments:', attachments?.length || 0);
    console.error('Full error:', error.stack);
    
    console.log('Attempting to send email without attachments as fallback');
    
    const htmlContent = `
        <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
            <p>${body.replace(/\n/g, '<br>')}</p>
            ${signature ? `<div class="signature">${signature}</div>` : ''}
        </div>
    `;

    const result = await sendEmailGMAIL(
        to, 
        subject, 
        body, 
        myemail, 
        mailbox.smtp.gmail, 
        htmlContent, 
        [] // Empty attachments array
    );

    console.log('Fallback email sent successfully without attachments');
    return result;
}
}

const tempStorage = new Map();
app.post('/upload/:id/chunk', async (req, res) => {
    const { id } = req.params;
    const chunk = req.body;
    
    const upload = tempStorage.get(id);
    if (upload) {
        upload.chunks.set(`${chunk.attachmentId}-${chunk.chunkIndex}`, chunk);
        res.sendStatus(200);
    } else {
        res.sendStatus(404);
    }
});

app.post('/upload/:id/complete', async (req, res) => {
    const { id } = req.params;
    const upload = tempStorage.get(id);
    
    if (upload) {
        upload.complete = true;
        res.sendStatus(200);
        
        // Clean up after some time
        setTimeout(() => {
            tempStorage.delete(id);
        }, 1800000); // 30 minutes
    } else {
        res.sendStatus(404);
    }
});


app.post('/send-emails', async (req, res) => {
    const { 
        submittedData, 
        userPitch, 
        Uname, 
        token, 
        myemail, 
        Template, 
        CampaignId, 
        UserSubject,
        signature,  // New
        mediaAttachments // New
    } = req.body;

    const uploadId = uuidv4();
    tempStorage.set(uploadId, {
        metadata: req.body.attachmentMetadata,
        chunks: new Map(),
        complete: false
    });

    res.json({ uploadUrl: `/upload/${uploadId}` });

    setImmediate(async () => {
        try {
            const customer = await Customer.findOne({ email: myemail });
            const activeMailboxes = customer.mailboxes
                .filter(mailbox => mailbox.isActive)
                .map(mailbox => ({
                    ...mailbox.smtp,
                    dailyCount: 0,
                    lastSendTime: null,
                    warmupDays: mailbox.warmupDays || 1 // Track how long this mailbox has been in use
                }));

            if (!activeMailboxes.length) {
                throw new Error('No active mailboxes found');
            }

            const failedEmails = [];
            let currentMailboxIndex = 0;

            // Calculate safe daily limits based on warmup period
            function getDailyLimit(warmupDays) {
                // Start with 20 emails/day, gradually increase up to 100
                const baseLimit = 20;
                const maxLimit = 100;
                const limit = Math.min(baseLimit + (warmupDays * 10), maxLimit);
                return limit;
            }

            // Get next available mailbox that hasn't hit limits
            function getNextAvailableMailbox() {
                const now = new Date();
                const midnight = new Date(now);
                midnight.setHours(0,0,0,0);

                // Reset daily counts if it's a new day
                if (now > midnight) {
                    activeMailboxes.forEach(mailbox => {
                        mailbox.dailyCount = 0;
                    });
                }

                // Try each mailbox
                for (let i = 0; i < activeMailboxes.length; i++) {
                    currentMailboxIndex = (currentMailboxIndex + 1) % activeMailboxes.length;
                    const mailbox = activeMailboxes[currentMailboxIndex];
                    const dailyLimit = getDailyLimit(mailbox.warmupDays);

                    // Check if this mailbox is available
                    if (mailbox.dailyCount < dailyLimit && 
                        (!mailbox.lastSendTime || 
                         (now - mailbox.lastSendTime) > getMinimumDelay(mailbox.warmupDays))) {
                        return mailbox;
                    }
                }
                return null;
            }

            // Calculate minimum delay between emails based on warmup period
            function getMinimumDelay(warmupDays) {
                // Start with 5 minutes, gradually decrease to 2 minutes
                const minDelay = 120000; // 2 minutes
                const maxDelay = 300000; // 5 minutes
                return Math.max(maxDelay - (warmupDays * 20000), minDelay);
            }

            // Add jitter to delays to make sending patterns look more natural
            function getRandomDelay(baseDelay) {
                const jitter = Math.floor(Math.random() * 60000); // Up to 1 minute of randomness
                return baseDelay + jitter;
            }
            


            for (const data of submittedData) {
                try {
                        console.log('\n=== Starting New Email Process ===');
                        console.log('Processing email for:', data.email);
                        console.log('Attachments being sent:', mediaAttachments?.length || 0);

                    // Find an available mailbox
                    const mailbox = getNextAvailableMailbox();
                    if (!mailbox) {
                        console.log('All mailboxes have reached their daily limits. Waiting for next day...');
                        // Wait until midnight
                        const now = new Date();
                        const tomorrow = new Date(now);
                        tomorrow.setDate(tomorrow.getDate() + 1);
                        tomorrow.setHours(0,0,0,0);
                        const waitTime = tomorrow - now;
                        await new Promise(resolve => setTimeout(resolve, waitTime));
                        continue;
                    }
                    console.log(mailbox)

                    // Generate content
                    console.log(`Generating content for ${data.email}...`);
                    const generatedContent = await generateEmailContent({
                        website: data.website,
                        userPitch,
                        Uname,
                        To: data.name,
                        Template
                    });

                    const subjectLine = UserSubject?.trim() 
                        ? UserSubject 
                        : separateSubject(generatedContent.subject_line).subject;

                    console.log('Email details:', {
                            to: data.email,
                            subject: subjectLine,
                            hasSignature: !!signature,
                            attachmentsCount: Array.isArray(mediaAttachments) ? mediaAttachments.length : 0
                        });

                    // Send email
                    console.log(`Sending to ${data.email} from ${mailbox.user}...`);

                    // await sendcampsummaryEmail({
                    //     to: data.email,
                    //     email: myemail,
                    //     subject: subjectLine,
                    //     body: generatedContent.body_content,
                    //     user: mailbox.user,
                    //     pass: mailbox.pass,
                    //     service: 'gmail',
                    //     campaignId: CampaignId
                    // });

                    await sendEmailWithAttachments(
                        mailbox,
                        data.email,
                        subjectLine,
                        generatedContent.body_content,
                        signature,
                        mediaAttachments,
                        myemail
                    );
                    console.log('Successfully processed email for:', data.email);
                    // Update mailbox stats
                    mailbox.dailyCount++;
                    mailbox.lastSendTime = new Date();

                    // Calculate and apply delay
                    const baseDelay = getMinimumDelay(mailbox.warmupDays);
                    const delay = getRandomDelay(baseDelay);
                    console.log(`Waiting ${delay/1000} seconds before next send...`);
                    await new Promise(resolve => setTimeout(resolve, delay));

                } catch (error) {
                    console.error(`Failed to process email for ${data.email}:`, error);
                    console.error('Full error stack:', error.stack);
                    failedEmails.push({
                        email: data.email,
                        error: error.message
                    });
                    
                    // Add extra delay after errors to be safe
                    await new Promise(resolve => setTimeout(resolve, 300000)); // 5 minute delay
                }
            }

            console.log('Email campaign completed');
            console.log('Failed emails:', failedEmails);

        } catch (error) {
            console.error('Campaign execution failed:', error);
        }
    });
});

// Helper function to generate email content
async function generateEmailContent({ website, userPitch, Uname, To, Template }) {
    const response = await fetch('https://server.voltmailer.com/generate-email-content', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
            website, 
            userPitch, 
            Uname,
            To,
            Template
        })
    });

    if (!response.ok) {
        throw new Error(`Failed to generate email content: ${response.statusText}`);
    }

    return response.json();
}

// app.post('/send-emails', async (req, res) => {
//     const { submittedData, userPitch, Uname, token, myemail, Template, CampaignId, UserSubject,  } = req.body;
//     res.status(200).send('Emails are being sen t in the background. You can close the tab.');
//     let SENT_EMAILS = 0;  

// let generatedData = []
//     for (let index = 0; index < submittedData.length; index++) {
        
//         const data = submittedData[index];
    
//         try {
//             const sddata = submittedData[index];
//             let website = sddata.website
//             // if (!/^https:\/\//i.test(website)) {
//             //         website = 'https://' + website;
//             //     }
//             const response = await fetch('https://server.voltmailer.com/generate-email-content', {
//                     method: 'POST',
//                     headers: {
//                         'Content-Type': 'application/json'
//                     },
//                     body: JSON.stringify({ 
//                         website: website, 
//                         userPitch: userPitch, 
//                         Uname: Uname,
//                         To: sddata.name,
//                     Template : Template
                
//                 })
//                 });
    
//                 if (!response.ok) {
//                     throw new Error('Failed to generate email content');
//                 }
    
//                 const data_new = await response.json();
//     let subjectline = ""
//     if (typeof UserSubject === 'string' && UserSubject.trim().length > 0) {
//      subjectline = UserSubject
//      console.log("if : ",subjectline)

//     }else{
//      subjectline = separateSubject(data_new.subject_line).subject
//     console.log("else : ", subjectline)
//     }
//                 // const subject_line = separateSubject(data_new.subject_line).subject
//                  subject_line = subjectline
//                 // console.log(subject_line)
//                  main_message = data_new.body_content
    
//                 console.log(main_message)
    
    
//             generatedData.push({
//                 email: sddata.email,
//                 subject: subject_line,
//                 content: main_message
//             });


//             await new Promise(resolve => setTimeout(resolve, 500)); // Simulate delay
//         } catch (error) {
//             console.error('Error generating email for', data.email, ':', error);
    
//         }
//     }
    









//     const customer = await Customer.findOne({ email: myemail });
//     const activeMailboxUsers = customer.mailboxes
//     .filter(mailbox => mailbox.isActive) // Get active mailboxes
//     .map(mailbox => mailbox.smtp.user); // Extract smtp.user
//      let senderIndex = 0;
//      const failedEmails = [];
// setImmediate(async () => {

// try {

//     // const cappedEmailsPerHour = Math.min(generatedData.length, 90); // Capped for safe pacing
//     // Example:
//     // const emailsPerHour = generatedData.length
//     // const startTime = Date.now();
//     // let emailsSent = 0;
//    // ~36 seconds for 100 emails/hour

//     for (const data of generatedData) {
//         // const delay = calculateDelay(cappedEmailsPerHour);
//         // console.log(delay)
//         // console.log(`Delaying next email by ${Math.round(delay)} ms`);
//         const minDelay = 120000; // 2 minutes
//         const maxDelay = 240000; // 4 minutes
//         const randomDelay = Math.floor(Math.random() * (maxDelay - minDelay + 1) + minDelay);
//         console.log(`Waiting ${randomDelay/1000} seconds before next send`);
//         await new Promise(resolve => setTimeout(resolve, randomDelay));
//         // await new Promise(resolve => setTimeout(resolve, 3000))

//         const currentSender = activeMailboxUsers[senderIndex];
//         console.log(currentSender)
//     console.log(`Starting send to ${data.email}`);
//     const To = data.email;
//     const mailboxFound = customer.mailboxes.find(mailboxObj => mailboxObj.smtp.user === currentSender);
//             if (!mailboxFound) {
//             console.log("none found")
//                 return 
//             }
//             console.log("active mailbox", mailboxFound.smtp)
//             const { host, port, secure, user, pass } = mailboxFound.smtp;
//             console.log("activeMailbox.smtp : ", mailboxFound.smtp)
//             await   sendcampsummaryEmail({
//                 to: data.email,
//                 email: myemail,
//                 subject: data.subject,
//                 body: data.content,
//                 user:  user,
//                 pass: pass, // App password
//                 service: 'gmail',
//                 campaignId: CampaignId
//               });
//             // const result = await mailboxessend(myemail, To, subject_line, body_content, currentSender)
//             // const result = await sendEmail(subject_line, body_content, data.email, token, myemail, CampaignId, currentSender);
//             senderIndex = (senderIndex + 1) % activeMailboxUsers.length;
//             // emailsSent ++;

//                     // Check if we're exceeding the hourly cap
//         // const elapsedTime = Date.now() - startTime;
//         // if (emailsSent >= cappedEmailsPerHour && elapsedTime < 3600000) {
//         //     const waitTime = 3600000 - elapsedTime; // Wait until one hour has passed
//         //     console.log(`Hourly limit reached. Waiting for ${Math.round(waitTime / 1000)} seconds.`);
//         //     await new Promise(resolve => setTimeout(resolve, waitTime));
//         //     emailsSent = 0; // Reset for the next hour
//         // }

//         } 
//         console.log("completed")

//     } catch (error) {
//         console.log(`Error: ${error}`);
//         // failedEmails.push(data.email);
//         // Handle the exception (log it, update status, etc.)
//     }
//     // res.json({ status: 'completed', sent_emails: SENT_EMAILS });
// 	// await sendCampaignSummary(customer._id, campaign._id);
    
// });
// console.log("Failed emails:", failedEmails);
// });


    // Retrieve customer details based on their email from the token
    //const userData = verifyJWT(token);

//    if (!userData) {
  //      return 
    //}

    //console.log('User Data:', userData);
    //const { email, tokens } = userData;
   


    // Create a new campaign
    // const campaignName = `Campaign ${new Date().toLocaleString()}`;
    // const newCampaign = {
    //     _id: new mongoose.Types.ObjectId(),
    //     campaignName: campaignName,
    //     sentEmails: [],
    //     createdTime: new Date(),
    //     SENT_EMAILS: 0,
    //     bounceRate: 0,
    //     replyRate: 0
    // };

    // await Customer.updateOne(
    //     { email: email },
    //     { $push: { campaigns: newCampaign } }
    // );

    // console.log("new campaign added", newCampaign._id, newCampaign)
    
    // const CampaignId = newCampaign._id
    // const campaign = customer.campaigns.create(newCampaign);
    // customer.campaigns.push(campaign);
    // await customer.save();


        // Find the active mailbox
        
        // Filter all active mailboxes and extract their smtp.user

            // try {
                // const summary = await extractCompanyInsights(data.website);
                // console.log('AI-Friendly Summary:', summary);
            //     // Full analysis is logged to: ./company_analysis_logs/company_analysis_example.com_2024-...json
            // } catch (error) {
            //     console.error('Analysis failed:', error);
            // }

            // console.log(summary);

            
            
            // const { s, b } = emailContent;
            // if (emailContent) {
                // console.log("Subject:", s);
                // console.log("Body:", b);
                
            // Send the email
            // await sendEmail(subject_line, body_content, data.email, token, myemail);
            // SENT_EMAILS += 1;

            // Send the email
            
            // console.log(result)
            // if (result) {
                // console.log("working")
                //     // Log sent email details to the campaign
                //     const { id: messageId, threadId } = result.data;

                //     const sentEmail = {
                //         recipientEmail: data.email,
                //         subject: emailContent.subject,
                //         messageId: messageId,
                //         threadId: threadId,
                //         sentTime: new Date(),
                //         status: 'sent'
                //     };

                //     await Customer.updateOne(
                //         { email: email, 'campaigns._id': CampaignId },
                //         { 
                //             $push: { 'campaigns.$.sentEmails': sentEmail },
                //             $inc: { 'campaigns.$.SENT_EMAILS': 1 }
                //         }
                //     );
                //     SENT_EMAILS++;

                //     console.log(`Email successfully sent to ${data.email}`);
            // }            

            // } else {
                // console.log("Failed to retrieve email content.");
            // }           

            // console.log(`Email: ${data.email}, Subject: ${subjectLine}, Message: ${mainMessage}`);



app.get('/fetch-profile-data', async (req, res) => {

    const profileUrl = req.query.url;
    if (!profileUrl) {
        return res.status(400).send('Profile URL is required');
    }

    try {
        const response = await fetch(profileUrl);
        const body = await response.text();
        res.send(body);
    } catch (error) {
        console.error('Error fetching data:', error);
        res.status(500).send('Error fetching data');
    }
});


// Route to send bulk emails manually
app.post('/send-bulk-manual', async (req, res) => {
    const { subject, content, email, myemail, campaignId, selectedMailbox } = req.body;
   console.log("selected mailbox : ", selectedMailbox, "myemail : ", myemail,  "email : ", email)
    // try {
        // await sendBulkEmails(generatedData, token);
        const customer = await Customer.findOne({ myemail });
        if (!customer) {
            return res.status(404).json({ message: 'Customer not found' });
        }
	    console.log("customer found")

        const mailbox = customer.mailboxes.find(mailbox => mailbox.smtp.user === selectedMailbox);
	    console.log("mailbox found:", mailbox)
        if (!mailbox) {
            return res.status(404).json({ message: 'Mailbox not found' });
        }

        const { host, port, secure, user, pass } = activeMailbox.smtp;
	    console.log("mailbox details : ", user, pass)
        await   sendcampsummaryEmail({
            to: email,
            email: myemail,
            subject: subject,
            body: content,
            user:  user,
            pass: pass, // App password
            service: 'gmail',
            campaignId: campaignId
          });

        console.log("Email sent:");
        // res.json({ message: 'Email sent successfully', info });

        // return res.status(200).json({ success: true, message: 'SMTP verified successfully!' });
        // await sendEmail(subject, content, email, token, myemail, campaignId);
        res.json({ message: 'Bulk emails sent successfully' });
    // } catch (error) {
    //     console.log(`Error sending bulk emails manually: ${error}`);
    //     res.status(500).json({ error: 'Failed to send bulk emails' });
    // }
});


// Route to generate email content
app.post('/generate-email-content', async (req, res) => {
    console.log("personalizing email", req.body)
    const { website, userPitch, Uname, To, Template} = req.body;
    const threadID = await CreateThread();
console.log("threadid :  ", threadID)
    try {

        const summary = await summarizeWebsite(website);
        // const summary = await extractCompanyInsights(website);
        // const summary = await extractCompanyInsights(data.website);
        console.log('AI-Friendly Summary:', summary);
        console.log("summarized : ", summary)

        const emailContent = await AddMessageToThread(threadID, summary, userPitch, To, Uname, Template);
        console.log("returned : ", emailContent)

        res.json({ subject_line, body_content, To });

    } catch (error) {
        res.status(500).json({ error: `Failed to generate email content ${error}` });
    }
});

app.post('/update-customer-by-email', async (req, res) => {
    const email = req.body.email;
    const updateField = req.body.updateField;
    const newData = req.body.newData;

    try {
        const customer = await Customer.findOne({ email: email });

        if (!customer) {
            return res.status(404).send('Customer not found');
        }

        const update = {};
        update[updateField] = newData;

        const updatedCustomer = await Customer.updateOne(
            { email: email },
            { $set: update }
        );

        console.log(`Customer updated! ${updateField} set to ${newData}.`);
        res.json({ message: 'Customer updated successfully', customer: updatedCustomer });
    } catch (error) {
        console.error('Error updating customer:', error);
        res.status(500).send('Error updating customer in the database');
    }
});


app.post('/add-customer-to-db', async (req, res) => {
    const data = req.body;
    console.log(data)
    try {

    // Create Stripe customer with trial
    let newCustomer;
    try {
        newCustomer = await createTrialSubscription(data.email);
        console.log('Stripe customer created:', newCustomer.customerId);
    } catch (stripeError) {
        console.error('Stripe error:', stripeError);
        return res.status(400).json({
            error: 'Failed to create Stripe customer',
            details: stripeError.message
        });
    }

        const customer = new Customer({
            stripeID: newCustomer.customerId || 'null',
            email: data.email,
            plan: data.plan,
            total_emails: data.total_emails || 0, // Initialize with 0 if not provided
            priceID: data.priceID,
            password: data.password,
            name: data.name,
            plan_emails: data.plan_emails,
            affiliate: data.affiliate,
            bounceRate: 0, // Default value
            replyRate: 0, // Default value
            campaigns: [] // Initialize with an empty array for campaigns
        });

        await customer.save()
        console.log('Customer added successfully');
        const token = generateEmailJWT(data.email);
        const dashboardUrl = `${YOUR_DOMAIN}/Dashboard.html?token=${token}`;
        
        res.json({ redirectUrl: dashboardUrl });

    } catch (error) {
        console.log(error)
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
    const { email, password, userName, plan } = req.body;
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
            redirectUrl: `https://voltmailer.com/pricing.html?email=${encodeURIComponent(email)}&password=${encodeURIComponent(password)}&username=${encodeURIComponent(userName)}&plan=${plan}` 
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
  
    const token = jwt.sign({ email: email }, "process.env.JWT_SECRET", { expiresIn: '15m' });
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
        text: `Click the link to reset your password: https://voltmailer.com/Oldlogin?token=${token}`,
        // html: `<p>Click the link to reset your password: <a href="https://voltmailer.com/reset-password?token=${token}">Reset Password</a></p>`,
        html: `
<!DOCTYPE html>
<html xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office" lang="en">

<head>
	<title></title>
	<meta http-equiv="Content-Type" content="text/html; charset=utf-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0"><!--[if mso]><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch><o:AllowPNG/></o:OfficeDocumentSettings></xml><![endif]--><!--[if !mso]><!--><!--<![endif]-->
	<style>
		* {
			box-sizing: border-box;
		}

		body {
			margin: 0;
			padding: 0;
		}

		a[x-apple-data-detectors] {
			color: inherit !important;
			text-decoration: inherit !important;
		}

		#MessageViewBody a {
			color: inherit;
			text-decoration: none;
		}

		p {
			line-height: inherit
		}

		.desktop_hide,
		.desktop_hide table {
			mso-hide: all;
			display: none;
			max-height: 0px;
			overflow: hidden;
		}

		.image_block img+div {
			display: none;
		}

		@media (max-width:620px) {

			.desktop_hide table.icons-inner,
			.social_block.desktop_hide .social-table {
				display: inline-block !important;
			}

			.icons-inner {
				text-align: center;
			}

			.icons-inner td {
				margin: 0 auto;
			}

			.mobile_hide {
				display: none;
			}

			.row-content {
				width: 100% !important;
			}

			.stack .column {
				width: 100%;
				display: block;
			}

			.mobile_hide {
				min-height: 0;
				max-height: 0;
				max-width: 0;
				overflow: hidden;
				font-size: 0px;
			}

			.desktop_hide,
			.desktop_hide table {
				display: table !important;
				max-height: none !important;
			}
		}
	</style>
</head>

<body class="body" style="margin: 0; background-color: #091548; padding: 0; -webkit-text-size-adjust: none; text-size-adjust: none;">
	<table class="nl-container" width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation" style="mso-table-lspace: 0pt; mso-table-rspace: 0pt; background-color: #091548;">
		<tbody>
			<tr>
				<td>
					<table class="row row-1" align="center" width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation" style="mso-table-lspace: 0pt; mso-table-rspace: 0pt; background-color: #091548; background-image: url('https://d1oco4z2z1fhwp.cloudfront.net/templates/default/3986/background_2.png'); background-position: center top; background-repeat: repeat;">
						<tbody>
							<tr>
								<td>
									<table class="row-content stack" align="center" border="0" cellpadding="0" cellspacing="0" role="presentation" style="mso-table-lspace: 0pt; mso-table-rspace: 0pt; color: #000000; width: 600px; margin: 0 auto;" width="600">
										<tbody>
											<tr>
												<td class="column column-1" width="100%" style="mso-table-lspace: 0pt; mso-table-rspace: 0pt; font-weight: 400; text-align: left; padding-bottom: 15px; padding-left: 10px; padding-right: 10px; padding-top: 5px; vertical-align: top; border-top: 0px; border-right: 0px; border-bottom: 0px; border-left: 0px;">
													<div class="spacer_block block-1" style="height:8px;line-height:8px;font-size:1px;">&#8202;</div>
													<table class="image_block block-2" width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation" style="mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
														<tr>
															<td class="pad" style="width:100%;padding-right:0px;padding-left:0px;">
																<div class="alignment" align="center" style="line-height:10px">
																	<div style="max-width: 232px;"><img src="https://d1oco4z2z1fhwp.cloudfront.net/templates/default/3986/header3.png" style="display: block; height: auto; border: 0; width: 100%;" width="232" alt="Main Image" title="Main Image" height="auto"></div>
																</div>
															</td>
														</tr>
													</table>
													<table class="paragraph_block block-3" width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation" style="mso-table-lspace: 0pt; mso-table-rspace: 0pt; word-break: break-word;">
														<tr>
															<td class="pad" style="padding-bottom:15px;padding-top:10px;">
																<div style="color:#ffffff;font-family:'Varela Round', 'Trebuchet MS', Helvetica, sans-serif;font-size:30px;line-height:120%;text-align:center;mso-line-height-alt:36px;">
																	<p style="margin: 0; word-break: break-word;"><span>Reset Your Password</span></p>
																</div>
															</td>
														</tr>
													</table>
													<table class="paragraph_block block-4" width="100%" border="0" cellpadding="5" cellspacing="0" role="presentation" style="mso-table-lspace: 0pt; mso-table-rspace: 0pt; word-break: break-word;">
														<tr>
															<td class="pad">
																<div style="color:#ffffff;font-family:'Varela Round', 'Trebuchet MS', Helvetica, sans-serif;font-size:14px;line-height:150%;text-align:center;mso-line-height-alt:21px;">
																	<p style="margin: 0; word-break: break-word;">We received a request to reset your password. Don’t worry,</p>
																	<p style="margin: 0; word-break: break-word;">we are here to help you.</p>
																</div>
															</td>
														</tr>
													</table>
													<table class="button_block block-5" width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation" style="mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
														<tr>
															<td class="pad" style="padding-bottom:20px;padding-left:15px;padding-right:15px;padding-top:20px;text-align:center;">
																<div class="alignment" align="center"><!--[if mso]>
<v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="https://voltmailer.com/OldLogin.html?token=${token}" style="height:40px;width:197px;v-text-anchor:middle;" arcsize="60%" stroke="false" fillcolor="#ffffff">
<w:anchorlock/>
<v:textbox inset="0px,0px,0px,0px">
<center dir="false" style="color:#091548;font-family:'Trebuchet MS', sans-serif;font-size:15px">
<![endif]--><a href="https://voltmailer.com/OldLogin.html?token=${token}" target="_blank" style="background-color:#ffffff;border-bottom:0px solid transparent;border-left:0px solid transparent;border-radius:24px;border-right:0px solid transparent;border-top:0px solid transparent;color:#091548;display:inline-block;font-family:'Varela Round', 'Trebuchet MS', Helvetica, sans-serif;font-size:15px;font-weight:undefined;mso-border-alt:none;padding-bottom:5px;padding-top:5px;text-align:center;text-decoration:none;width:auto;word-break:keep-all;"><span style="padding-left:25px;padding-right:25px;font-size:15px;display:inline-block;letter-spacing:normal;"><span style="word-break:break-word;"><span style="line-height: 30px;" data-mce-style><strong>RESET MY PASSWORD</strong></span></span></span></a><!--[if mso]></center></v:textbox></v:roundrect><![endif]--></div>
															</td>
														</tr>
													</table>
													<table class="divider_block block-6" width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation" style="mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
														<tr>
															<td class="pad" style="padding-bottom:15px;padding-left:10px;padding-right:10px;padding-top:10px;">
																<div class="alignment" align="center">
																	<table border="0" cellpadding="0" cellspacing="0" role="presentation" width="60%" style="mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
																		<tr>
																			<td class="divider_inner" style="font-size: 1px; line-height: 1px; border-top: 1px solid #5A6BA8;"><span>&#8202;</span></td>
																		</tr>
																	</table>
																</div>
															</td>
														</tr>
													</table>
													<table class="paragraph_block block-7" width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation" style="mso-table-lspace: 0pt; mso-table-rspace: 0pt; word-break: break-word;">
														<tr>
															<td class="pad" style="padding-bottom:10px;padding-left:25px;padding-right:25px;padding-top:10px;">
																<div style="color:#7f96ef;font-family:'Varela Round', 'Trebuchet MS', Helvetica, sans-serif;font-size:14px;line-height:150%;text-align:center;mso-line-height-alt:21px;">
																	<p style="margin: 0; word-break: break-word;"><strong>Didn’t request a password reset?</strong></p>
																	<p style="margin: 0; word-break: break-word;">You can safely ignore this message.</p>
																</div>
															</td>
														</tr>
													</table>
													<div class="spacer_block block-8" style="height:30px;line-height:30px;font-size:1px;">&#8202;</div>
												</td>
											</tr>
										</tbody>
									</table>
								</td>
							</tr>
						</tbody>
					</table>
					<table class="row row-2" align="center" width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation" style="mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
						<tbody>
							<tr>
								<td>
									<table class="row-content stack" align="center" border="0" cellpadding="0" cellspacing="0" role="presentation" style="mso-table-lspace: 0pt; mso-table-rspace: 0pt; color: #000000; width: 600px; margin: 0 auto;" width="600">
										<tbody>
											<tr>
												<td class="column column-1" width="100%" style="mso-table-lspace: 0pt; mso-table-rspace: 0pt; font-weight: 400; text-align: left; padding-bottom: 15px; padding-left: 10px; padding-right: 10px; padding-top: 15px; vertical-align: top; border-top: 0px; border-right: 0px; border-bottom: 0px; border-left: 0px;">
													<table class="image_block block-1" width="100%" border="0" cellpadding="5" cellspacing="0" role="presentation" style="mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
														<tr>
															<td class="pad">
																<div class="alignment" align="center" style="line-height:10px">
																	<div style="max-width: 145px;"><img src="https://da2b768f93.imgdist.com/pub/bfra/7qgj7bnm/kxf/r62/10n/vm.png" style="display: block; height: auto; border: 0; width: 100%;" width="145" alt="Your Logo" title="Your Logo" height="auto"></div>
																</div>
															</td>
														</tr>
													</table>
													<table class="divider_block block-2" width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation" style="mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
														<tr>
															<td class="pad" style="padding-bottom:15px;padding-left:10px;padding-right:10px;padding-top:15px;">
																<div class="alignment" align="center">
																	<table border="0" cellpadding="0" cellspacing="0" role="presentation" width="60%" style="mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
																		<tr>
																			<td class="divider_inner" style="font-size: 1px; line-height: 1px; border-top: 1px solid #5A6BA8;"><span>&#8202;</span></td>
																		</tr>
																	</table>
																</div>
															</td>
														</tr>
													</table>
													<table class="social_block block-3" width="100%" border="0" cellpadding="10" cellspacing="0" role="presentation" style="mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
														<tr>
															<td class="pad">
																<div class="alignment" align="center">
																	<table class="social-table" width="156px" border="0" cellpadding="0" cellspacing="0" role="presentation" style="mso-table-lspace: 0pt; mso-table-rspace: 0pt; display: inline-block;">
																		<tr>
																			<td style="padding:0 10px 0 10px;"><a href="https://www.facebook.com" target="_blank"><img src="https://app-rsrc.getbee.io/public/resources/social-networks-icon-sets/t-outline-circle-white/facebook@2x.png" width="32" height="auto" alt="Facebook" title="Facebook" style="display: block; height: auto; border: 0;"></a></td>
																			<td style="padding:0 10px 0 10px;"><a href="https://www.instagram.com" target="_blank"><img src="https://app-rsrc.getbee.io/public/resources/social-networks-icon-sets/t-outline-circle-white/instagram@2x.png" width="32" height="auto" alt="Instagram" title="Instagram" style="display: block; height: auto; border: 0;"></a></td>
																			<td style="padding:0 10px 0 10px;"><a href="https://www.twitter.com" target="_blank"><img src="https://app-rsrc.getbee.io/public/resources/social-networks-icon-sets/t-outline-circle-white/twitter@2x.png" width="32" height="auto" alt="Twitter" title="Twitter" style="display: block; height: auto; border: 0;"></a></td>
																		</tr>
																	</table>
																</div>
															</td>
														</tr>
													</table>
													<table class="paragraph_block block-4" width="100%" border="0" cellpadding="15" cellspacing="0" role="presentation" style="mso-table-lspace: 0pt; mso-table-rspace: 0pt; word-break: break-word;">
														<tr>
															<td class="pad">
																<div style="color:#4a60bb;font-family:'Varela Round', 'Trebuchet MS', Helvetica, sans-serif;font-size:12px;line-height:120%;text-align:center;mso-line-height-alt:14.399999999999999px;">
																	<p style="margin: 0; word-break: break-word;"><span>Copyright © 2024 SyneticX LTD, All rights reserved.</span></p>
																</div>
															</td>
														</tr>
													</table>
													<table class="html_block block-5" width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation" style="mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
														<tr>
															<td class="pad">
																<div style="font-family:'Varela Round', 'Trebuchet MS', Helvetica, sans-serif;text-align:center;" align="center"><div style="height-top: 20px;">&nbsp;</div></div>
															</td>
														</tr>
													</table>
												</td>
											</tr>
										</tbody>
									</table>
								</td>
							</tr>
						</tbody>
					</table>
				</td>
			</tr>
		</tbody>
	</table><!-- End -->
</body>

</html>
      `,
      };

  
    await transporter.sendMail(mailOptions);
    console.log('Message sent: %s');
    res.send('Password reset email sent.');

  });
  


  app.post('/send-email', async (req, res) => {
    const { email, textarea, website } = req.body;


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
        to: 'voltmailerhelp@gmail.com',
        subject: ` ${email} | ${website}|  Help`,
        text: textarea,
      };

  
    await transporter.sendMail(mailOptions);
    console.log('Message sent: %s');
    res.send('Password reset email sent.');


  });



  app.post('/reset-password', async (req, res) => {
    const { token, newPassword } = req.body;
  
    try {
      const decoded = jwt.verify(token, "process.env.JWT_SECRET");
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
        scope: ['https://www.googleapis.com/auth/gmail.send', 'https://www.googleapis.com/auth/userinfo.email', 'https://www.googleapis.com/auth/gmail.settings.basic'],
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



async function checkForBounces(oauth2Client) {
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
    try {
        // Step 1: Fetch messages that could be bounce notifications
        const response = await gmail.users.messages.list({
            userId: 'me',
            q: 'from:mailer-daemon@googlemail.com OR from:postmaster OR from:mailer-daemon OR from:mail-daemon OR subject:(Delivery Status Notification) OR subject:(Undelivered Mail Returned to Sender) OR subject:(Mail Delivery Failure) OR subject:(Mail delivery failed) OR subject:(failure notice) OR subject:(Returned mail) OR subject:(Unable to deliver)',
        });

        const messages = response.data.messages || [];
        console.log(`Found ${messages.length} possible bounce messages.`);

        let bounces = 0;

        // Step 2: Retrieve and check each message to confirm if it's a bounce
        for (const message of messages) {
            const messageId = message.id;
            const details = await gmail.users.messages.get({
                userId: 'me',
                id: messageId,
            });

            const headers = details.data.payload.headers;
            const subject = headers.find(header => header.name === 'Subject')?.value || '';
            const from = headers.find(header => header.name === 'From')?.value || '';

            // Define keywords that typically indicate a bounce
            const bounceIndicators = [
                "Mail Delivery Subsystem",
                "Undelivered Mail Returned to Sender",
                "mailer-daemon",
                "Delivery Status Notification",
                "failure notice",
                "Mail delivery failed",
                "postmaster",
                "Returned mail",
                "Unable to deliver"
            ];

            // Check if the subject or the sender matches known bounce indicators
            const isBounce = bounceIndicators.some(keyword =>
                subject.includes(keyword) || from.includes(keyword)
            );

            if (isBounce) {
                console.log(`Bounce detected: Subject - "${subject}", From - "${from}"`);
                bounces++;

                // Extract the recipient email (original recipient)
                const originalRecipient = headers.find(header => header.name === 'To')?.value;

                if (originalRecipient) {
                    // Find the customer associated with the bounced email
                    const customer = await Customer.findOne({ "campaigns.sentEmails.recipientEmail": originalRecipient });

                    if (customer) {
                        let campaignUpdated = false;

                        // Initialize customer-level bounce counter
                        customer.totalBounces = customer.totalBounces || 0;

                        // Locate the specific campaign and email
                        customer.campaigns.forEach(campaign => {
                            const emailRecord = campaign.sentEmails.find(email => email.recipientEmail === originalRecipient);
                            if (emailRecord) {
                                // Update the `bounces` field
                                emailRecord.bounces = true;
                                emailRecord.status = 'bounced';

                                // Increment campaign-level bounce counter
                                campaign.bounceRate = campaign.bounceRate || 0;
                                campaign.SENT_EMAILS = campaign.SENT_EMAILS || 0;

                                // Increment the total bounces for the campaign
                                campaign.bounceRate = (campaign.sentEmails.filter(email => email.bounces).length / campaign.SENT_EMAILS) * 100;

                                // Ensure the overall customer's bounces are updated
                                customer.totalBounces += 1;
                                campaignUpdated = true;
                            }
                        });

                        if (campaignUpdated) {
                            // Update the overall bounce rate for the customer
                            customer.bounceRate = customer.campaigns.reduce((totalBounces, campaign) => {
                                return totalBounces + campaign.sentEmails.filter(email => email.bounces).length;
                            }, 0) / customer.total_emails * 100;

                            // Save the updated customer record
                            await customer.save();
                            console.log(`Updated bounce status for ${originalRecipient}`);
                        }
                    }
                }
            }
        }

        console.log(`Total bounces detected: ${bounces}`);
        return bounces;
    } catch (error) {
        console.error('Error checking for bounces:', error);
    }
}




// Function to check for replies on a particular customer's campaigns
async function checkRepliesAndUpdate(customerEmail, oauth2Client) {
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

    try {
        // Fetch the customer
        const customer = await Customer.findOne({ email: customerEmail });

        if (!customer) {
            console.log("Customer not found");
            return;
        }

        // Initialize counters
        let totalReplies = 0;
        let totalSentEmails = 0;

        // Loop through all campaigns and emails to check for replies
        for (const campaign of customer.campaigns) {
            for (const email of campaign.sentEmails) {
                const threadId = email.threadId;

                try {
                    // Fetch the thread using Gmail API
                    const thread = await gmail.users.threads.get({
                        userId: 'me', // 'me' represents the authenticated user
                        id: threadId,
                    });

                    // Check if there are more than one message in the thread (indicating a reply)
                    const messages = thread.data.messages || [];
                    const isReplied = messages.length > 1;

                    if (isReplied && email.responseCount === 0) {
                        // Update the reply status if a reply is found
                        email.responseCount += 1;
                        totalReplies += 1;
                    }

                    // totalSentEmails += 1;

                } catch (gmailError) {
                    console.error(`Error fetching thread ${threadId}:`, gmailError);
                }
            }

            // Update campaign-level reply rate
            campaign.replyRate = totalSentEmails ? (totalReplies / totalSentEmails) * 100 : 0;
        }

        // Update overall reply rate for the customer
        customer.totalReplies = totalReplies;
        customer.replyRate = totalSentEmails ? (totalReplies / totalSentEmails) * 100 : 0;

        // Save the updated customer data
        await customer.save();
        console.log("Successfully updated reply statuses and reply rate.");
    } catch (error) {
        console.error("Error checking replies and updating data:", error);
    }
}


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
    //  checkRepliesAndUpdate(email, oauth2Client);
    // Call the function (example usage)
    //  checkForBounces(oauth2Client);

    if (IsLogged_IN){
        res.redirect(`https://voltmailer.com/Dashboard.html?connectedgoogletoken=${jwtToken}`);
    }
else {
    if (customer) {  

        if (email === 'rallybeacon@gmail.com'){
            res.redirect(`https://voltmailer.com/Rally-Beacon-Dashboard.html?googletoken=${jwtToken}`);
        }else{
            res.redirect(`https://voltmailer.com/Dashboard.html?googletoken=${jwtToken}`);
        }

    } else {
        // User does not exist, redirect to the pricing page for signup
        res.redirect(`https://voltmailer.com/OldLogin.html?email=${encodeURIComponent(userInfo.data.email)}&password=null&google=${jwtToken}`);
    }
}


    // req.session.tokens = tokens;
    // req.session.userEmail = userInfo.data.email;
    // res.redirect('https://voltmailer.com/');
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
        price: 'price_1QFBKZKJeZAyw8f4dw21L8Tw',
	      
	//  price: ' price_1QCRxKKJeZAyw8f463h2NoER',
        quantity: 1,
      },
    ],
    customer_email: customer_email,
    mode: 'subscription',
    return_url: `${YOUR_DOMAIN}/payment.html?session_id={CHECKOUT_SESSION_ID}&email=${customer_email}&password=${encodeURIComponent(password)}&name=${name}&newplan=p`,
  });

  res.send({clientSecret: session.client_secret});
});


app.post('/create-checkout-session-pro', async (req, res) => {
    const customer_email = req.body.email
    const name = req.body.name 
    const password = req.body.password

  const session = await stripe.checkout.sessions.create({
    ui_mode: 'embedded',
    line_items: [
      {
        // Provide the exact Price ID (for example, pr_1234) of the product you want to sell
        // price: 'price_1PJsseKJeZAyw8f4UVbMQfRa',
	      price: 'price_1QCRwyKJeZAyw8f4ciROi1PZ',
        quantity: 1,
      },
    ],
    customer_email: customer_email,
    mode: 'subscription',
    return_url: `${YOUR_DOMAIN}/payment.html?session_id={CHECKOUT_SESSION_ID}&email=${customer_email}&password=${encodeURIComponent(password)}&name=${name}&newplan=pro`,
  });

  res.send({clientSecret: session.client_secret});
});

app.post('/start-stripe-free-trial', async (req, res) => {
    const customer_email = req.body.email
    const password = req.body.password
    const name = req.body.name

    try {
        const customer = await stripe.customers.create({
            name: name,
            email: customer_email,
        });

        console.log("customer created", customer)

        // Create a subscription with a trial period
        const subscription = await stripe.subscriptions.create({
            customer: customer.id,
            items: [{
                price: 'price_1PdqxCKJeZAyw8f44eTYC7Rw', // Your price ID
            }],
            trial_period_days: 30,
            payment_behavior: 'default_incomplete',
            expand: ['latest_invoice.payment_intent'],
        });
        console.log("subsccription created", subscription)

        res.status(200).json({ success: true, customerId: customer.id, subscriptionId: subscription.id });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, error: error.message });
    }
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
            price: 'price_1PdqxCKJeZAyw8f44eTYC7Rw',
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
        price: 'price_1Pdqx3KJeZAyw8f4T0AfWCIJ',
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
            price: 'price_1PdqxCKJeZAyw8f44eTYC7Rw',
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


app.post('/create-free-sub', async (req, res) => {
    const { email, password, name } = req.body;

    try {
        // Step 1: Create a new customer
        const customer = await stripe.customers.create({
            email: email,
            name: name,
        });

        // Step 2: Create a subscription for the customer with a free trial
        const subscription = await stripe.subscriptions.create({
            customer: customer.id,
            items: [
                {
                    price: 'price_1PdqxCKJeZAyw8f44eTYC7Rw',
                    quantity: 1,
                },
            ],
            trial_period_days: 30,
            // Add metadata if you want to store additional information
            metadata: {
                password: password
            }
        });

        res.send({ success: true, subscriptionId: subscription.id });
    } catch (error) {
        console.error('Error creating subscription:', error);
        res.status(500).send({ error: 'Failed to create subscription' });
    }
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

app.post('/create-billing-portal-session-rally', async (req, res) => {
    const { customerId, email } = req.body; // Assuming customerId is sent in the body
    const token = generateEmailJWT(email);
    try {
        const session = await stripe.billingPortal.sessions.create({
            customer: customerId,
            return_url: `${YOUR_DOMAIN}/Rally-Beacon-Dashboard.html?token=${token}`, // The URL to redirect to after billing portal
        });

        res.json({ url: session.url });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});


//



app.post('/domain-search', async (req, res) => {
    const { domain, company, department, seniority, limit, offset } = req.body;
    const apiKey = 'f5fe414af8a4b569907f5dfbeae9359e06754a2a'; // Replace with your actual API key

    try {
        const fetch = await import('node-fetch'); // Dynamic import
        const response = await fetch.default(`https://api.hunter.io/v2/domain-search?domain=${domain}&company=${company}&department=${department.join(',')}&seniority=${seniority.join(',')}&limit=${limit}&offset=${offset}&api_key=${apiKey}`);
        const data = await response.json();

        if (response.ok) {
            const results = data.data.emails;
            const csvContent = results.map(result => [
                result.value,
                result.type,
                result.confidence,
                result.first_name,
                result.last_name,
                result.position,
                result.seniority,
                result.department
            ].join(',')).join('\n');

            fs.writeFileSync('results.csv', csvContent);
            res.status(200).json(data);
        } else {
            res.status(response.status).json(data);
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});


app.get('/api/metrics/:email', async (req, res) => {
    const { email } = req.params;
  
    try {
      // Find the customer by email
      const customer = await Customer.findOne({ email: email });
  
      if (!customer) {
        return res.status(404).json({ message: 'Customer not found' });
      }
  
      // Initialize total counters
      let totalEmailsSent = 0;
      let totalBounces = 0;
      let totalReplies = 0;
  
      // Get the number of campaigns
      const numberOfCampaigns = customer.campaigns.length;
      // Aggregate metrics across all campaigns
      customer.campaigns.forEach(campaign => {
        totalEmailsSent += campaign.sentEmails.length;
  
        // Count bounces and replies
        campaign.sentEmails.forEach(emailRecord => {
          if (emailRecord.bounces) totalBounces += 1;
          if (emailRecord.replies) totalReplies += 1;
        });
      });
  
      // Calculate rates
      const bounceRate = totalEmailsSent > 0 ? (totalBounces / totalEmailsSent) * 100 : 0;
      const replyRate = totalEmailsSent > 0 ? (totalReplies / totalEmailsSent) * 100 : 0;
  
      // Send the response back to the client
      res.json({
        email: customer.email,
        totalEmailsSent,
        totalBounces,
        totalReplies,
        bounceRate: bounceRate.toFixed(2),
        replyRate: replyRate.toFixed(2),
        numberOfCampaigns: numberOfCampaigns
      });
    } catch (error) {
      console.error('Error fetching metrics:', error);
      res.status(500).json({ message: 'Server error' });
    }
  });
  


// The function you want to run
function myDailyTask() {
    console.log('Running the daily task');
// Example usage of the function
updateAndRetrieveDrivers()
.then(async (drivers) => {
    console.log('Function executed successfully, updating drivers...');
    
    for (const driver of drivers) {
        // Assuming each driver has a `profileUrl` field that you need to pass
        // if (driver.profileUrl) {
            await updateDriverWithRaceData(driver);
        // } else {
        //     console.warn(`Driver ${driver} does not have a profile URL.`);
        // }
    }

    console.log('All drivers processed.');
})
.catch(error => {
    console.error('Function execution failed:', error);
});
}



// Define the function
async function updateAndRetrieveDrivers() {
    try {
        // Update drivers with nextRace as "null"
        await Driver.updateMany(
            { nextRace: "null" },
            { $set: { nextRace: "no race found" } }
        );

        // Retrieve all drivers
        const drivers = await Driver.find();
        console.log('Drivers retrieved and updated:', drivers);

        // Return the drivers
        return drivers;
    } catch (error) {
        console.error('Error retrieving or updating drivers:', error);
        // Handle the error appropriately, maybe throw it or return a specific value
        throw new Error('Error retrieving or updating drivers.');
    }
}


async function fetchNextRaceManual(url) {
    try {
        const response = await axios.get(url);  // Use axios to fetch the profile URL
        const html = response.data;  // axios stores the response body in 'data'

        const dom = new JSDOM(html);
        const doc = dom.window.document;

        const profileStartLine = doc.querySelector('.profile-start-line.d-flex.justify-content-start.w-100.lh-120.py-1.flex-wrap');

        if (profileStartLine) {
            const profileStartEvent = profileStartLine.querySelector('.profile-start-event.w-20');
            if (profileStartEvent) {
                const raceName = profileStartEvent.querySelector('a').textContent.trim();

                const profileStartOa = profileStartLine.querySelector('.profile-start-oa.font-weight-bold.d-flex.justify-content-start.flex-wrap.flex-column');
                if (profileStartOa) {
                    const hasNotRaced = profileStartOa.querySelector('div span.text-primary');
                    if (hasNotRaced) {
                        return { raceName, status: 'not_done' };
                    } else {
                        return { raceName, status: 'done' };
                    }
                } else {
                    return { raceName, status: 'not_done' };
                }
            } else {
                return { error: 'Event data not found' };
            }
        } else {
            return { error: 'Start line data not found' };
        }
    } catch (error) {
        console.error('Error fetching data:', error);
        return { error: 'Error fetching data' };
    }
}

async function updateDriverWithRaceData(driver) {
    try {
        const { url, email, nextRace, raceDone } = driver;
        const raceData = await fetchNextRaceManual(url);

        if (raceData.error) {
            console.error(raceData.error);
            return;
        }

        const { raceName, status } = raceData;

        if (raceName !== nextRace) {
            // New race found, update nextRace and reset emailSent to 'no'
            const newDriverData = {
                nextRace: raceName,
                raceDone: 'F',
                emailSent: 'NO'
            };
            updateDriverFunction(url, newDriverData)
            console.log(`Driver with URL ${url} updated: nextRace = ${raceName}, emailSent = 'no'`);
        } else if (raceName === nextRace && status === 'done' && raceDone !== 'done') {
            // Race is completed, update raceDone to 'done' and emailSent to 'yes'
            const newDriverData = {
                nextRace: raceName,
                raceDone: 'T',
                emailSent: 'YES'
            };
            updateDriverFunction(url, newDriverData)
            console.log(`Driver with Email ${email} updated: raceDone = 'done', emailSent = 'yes'`);
        } else {
            console.log('No updates needed.');
            if (status === 'done'){
                const newDriverData = {
                    raceDone: 'T',
                    emailSent: 'YES'
                };
                updateDriverFunction(url, newDriverData)
                console.log(`Driver with Email ${email} updated: raceDone = 'done', emailSent = 'yes'`);
            } else{
                const newDriverData = {
                    nextRace: raceName,
                    raceDone: 'F',
                };
                updateDriverFunction(url, newDriverData)
                console.log(`Driver with Email ${email} updated: raceDone = 'F'`);
            }
        }
    } catch (error) {
        console.error('Error updating driver:', error);
    }
}

async function updateDriverFunction(url, newDriverData){
    try {
        await Driver.updateOne({ url }, { $set: newDriverData });
        console.log(`Driver with URL ${url} updated with new data:`, newDriverData);
        console.log('Driver updated successfully' );
    } catch (error) {
        console.error('Error updating driver:', error);
        console.log('Error updating driver.' );
    }
};



// Schedule the task to run every day at 6:00 AM in a specific timezone
// cron.schedule('0 6 * * *', () => {
//     const now = moment().tz('America/New_York');
//     if (now.format('HH:mm') === '03:00') {
//         myDailyTask();
//     }
// });



// async function CreateThread(){
//     const thread = await openai.beta.threads.create();
//     console.log("thread created", thread.id);
//     return thread.id
// }

let subject_linkedin = "";
let body_linkedin = "";

let url_linkedin
let cookie
let UserAgent


function extractEmailContent(emailText) {
    // Try to split by known markers first
    const subjectMarkers = ['Subject Line:', 'Subject:', '**Subject Line**:', '**Subject:**'];
    const messageMarkers = ['Message:', 'Message Body:', '**Message:**', '**Message Body:**'];
    
    // Find the subject
    const subjectMatch = subjectMarkers.reduce((found, marker) => 
        found || emailText.split(marker)[1], null);
    
    // Find the message body
    const messageMatch = messageMarkers.reduce((found, marker) => 
        found || emailText.split(marker)[1], null);
    
    // Clean up subject
    const subject = subjectMatch 
        ? subjectMatch.split('"')[1] || subjectMatch.trim()
        : '';
    
    // Clean up body
    const body = messageMatch 
        ? messageMatch.replace(/"/g, '').trim()
        : '';
    
      return  { subject, body };
    }

// app.post('/linkedin/personalise', async (req, res) => {
//     const { url, cookie, userAgent, data, pitch } = req.body;

//     console.log(url, cookie, userAgent, data, pitch)
    
//     const{ subject_linkedin , body_linkedin } =  await linkedinpersonalise(url, cookie, userAgent, data, pitch)

//     await SendLinkedInMessage({
//         url: url,
//         cookie: cookie,
//         userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
//         message: body_linkedin,
//         subject: subject_linkedin
//       });

// });
app.post('/scrape', async (req, res) => {
    console.log("running scraper ")
const scraper = new UltimateCompanyIntelligenceScraper();
scraper.scrapeCompanyIntelligence('https://www.voltmailer.com/')
    .then(intelligence => {
        console.log(JSON.stringify(intelligence, null, 2));
        const outreachStrategy = scraper.generateColdOutreachStrategy(intelligence);
        console.log(outreachStrategy);
    })
    .catch(console.error);

})

const userSchema = new mongoose.Schema({
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    name: { type: String, required: true },
    plan: { 
        type: String, 
        enum: ['Free', 'Pro', 'Enterprise'], 
        default: 'Free' 
    },
    messagesSent: { type: Number, default: 0 },
    messageLimits: {
        daily: { type: Number, default: 5 },
        monthly: { type: Number, default: 5 }
    },
    pitchTemplates: [{
        name: String,
        content: String,
        lastUsed: Date
    }],
    linkedinCookies: [{
        value: String,
        email: String, // LinkedIn account email
        lastUsed: Date
    }],
    linkedinCookie: String,
    userAgent: String,
    createdAt: { type: Date, default: Date.now }
});

const messageSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    recipientUrl: String,
    recipientName: String,
    messageContent: String,
    status: { type: String, enum: ['Success', 'Failed'] },
    error: String,
    timestamp: { type: Date, default: Date.now }
});
// Add to your server.js

// Template Schema
const templateSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    name: {
        type: String,
        required: true
    },
    content: {
        type: String,
        required: true
    },
    lastUsed: {
        type: Date,
        default: Date.now
    }
});

const Template = mongoose.model('Template', templateSchema);
const User = mongoose.model('User', userSchema);
const Message = mongoose.model('Message', messageSchema);

const auth = async (req, res, next) => {
    try {
        const token = req.header('Authorization')?.replace('Bearer ', '');
        if (!token) throw new Error('No authentication token');

        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
        const user = await User.findById(decoded.userId);
        
        if (!user) throw new Error('User not found');
        
        req.user = user;
        next();
    } catch (error) {
        res.status(401).json({ error: 'Please authenticate' });
    }
};

// Auth Routes
app.get('/', async (req, res) => {
res.json({
    message: 'hello'
})
})

async function checkAgentStatus(phantombusterApiKey, agentId) {
    const options = {
        headers: {
            "x-phantombuster-key": phantombusterApiKey,
            "Content-Type": "application/json",
        }
    };

    try {
        const response = await axios.get(
            `https://api.phantombuster.com/api/v2/agents/fetch-output?id=${agentId}`,
            options
        );
        return response.data.status !== 'running';
    } catch (error) {
        console.error('Error checking agent status:', error.message);
        return false;
    }
}

async function waitForAgentAvailability(phantombusterApiKey, agentId, maxWaitTime = 300000) {
    const startTime = Date.now();
    const checkInterval = 10000; // Check every 10 seconds

    while (Date.now() - startTime < maxWaitTime) {
        console.log('Checking if agent is available...');
        const isAvailable = await checkAgentStatus(phantombusterApiKey, agentId);
        
        if (isAvailable) {
            console.log('Agent is now available');
            return true;
        }

        console.log('Agent is busy, waiting before next check...');
        await new Promise(resolve => setTimeout(resolve, checkInterval));
    }

    throw new Error('Timeout waiting for agent availability');
}



async function newlinkedinpersonalise(url, cookie, userAgent, data, pitch, name) {
    console.log('=== Starting linkedinpersonalise function ===');
    let attempts = 0;
    const maxAttempts = 5;

    while (attempts < maxAttempts) {
        attempts++;
        console.log(`Attempt ${attempts} of ${maxAttempts}`);

        try {
            console.log('Creating OpenAI thread...');
            const ThreadID = await newCreateThread();
            console.log('Thread created:', ThreadID);

            console.log('Creating message in thread...');
            const message = await openai.beta.threads.messages.create(
                ThreadID,
                {
                    role: "user",
                    content: `
                    Using this data: ${JSON.stringify(data)}, and signing off as: ${name}, create a highly personalized LinkedIn message. 
                    Follow these steps:
                    1. Reference a specific detail from the recipient’s profile or recent activity.
                    2. Relate the user pitch to their expertise, role, or company.
                    3. Ask a tailored question or suggest a relevant collaboration.
                    4. Conclude with a professional sign-off.

                    Format your response as:
                    - Subject: [Your subject line here]
                    - Message: [Your message content here]

                    The user's pitch is: ${pitch}. Ensure the output message is unique and genuinely personalized. Generic phrasing should be avoided. `
                }
            );
            console.log('Message created:', message.id);

            console.log('Creating run...');
            let run = await openai.beta.threads.runs.create(ThreadID, {
                assistant_id: ASSISTANT_ID
            });
            console.log('Run created:', run.id);

            let timeElapsed = 0;
            const timeout = 60;
            const interval = 2;

            while (timeElapsed < timeout) {
                console.log(`Checking run status... (${timeElapsed}s elapsed)`);
                run = await openai.beta.threads.runs.retrieve(ThreadID, run.id);

                if (run.status === 'completed') {
                    console.log('Run completed successfully');
                    const messages = await openai.beta.threads.messages.list(ThreadID);
                    const content = messages.data[0].content[0].text.value;
                    console.log('Generated content:', content);

                    // Extract content
                    const subjectMatch = content.match(/Subject:\s*(.*?)(?:\n|$)/);
                    const messageMatch = content.match(/Message:\s*([\s\S]*?)$/);

                    // Extract content with more flexible parsing
                    const subject = subjectMatch ? subjectMatch[1].trim() : "No subject found";
                    const body = messageMatch ? messageMatch[1].trim() : "No body found";

                    console.log('Extracted content:', { subject, body });

                    // Add validation that doesn't require quotes
                    if (!body || body === "No body found" || !subject || subject === "No subject found") {
                        throw new Error('Failed to parse message content');
                    }

                    body_linkedin = body;

                    // Send message via Phantombuster
                    console.log('Sending message via Phantombuster...');
                    await newSendLinkedInMessage({ url, cookie, userAgent, message: body, subject });
                    console.log('Message sent successfully');

                    return { body, subject };
                }

                await new Promise(resolve => setTimeout(resolve, interval * 1000));
                timeElapsed += interval;
            }

            throw new Error('Operation timed out');

        } catch (error) {
            console.error(`Error in linkedinpersonalise (Attempt ${attempts}):`, error);
            
            if (attempts === maxAttempts) {
                console.log('Max attempts reached, skipping...');
                throw new Error(`Failed after ${maxAttempts} attempts: ${error.message}`);
            }
            
            console.log('Retrying...');
            await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds before retrying
        }
    }
}

// Add these functions after your routes but before app.listen()

// Helper function to create OpenAI thread
async function newCreateThread() {
    try {
        const thread = await openai.beta.threads.create();
        return thread.id;
    } catch (error) {
        console.error('Error creating thread:', error);
        throw error;
    }
}

// async function linkedinpersonalise(url, cookie, userAgent, data, pitch, name) {
//     const ThreadID = await CreateThread();
    
//     try {
//         // Create message in thread
//         await openai.beta.threads.messages.create(ThreadID, {
//             role: "user",
//             content: `Using this data: ${JSON.stringify(data)} and signing off as: ${name}, 
//                      create a personalized LinkedIn message. Use this pitch template: ${pitch}. 
//                      Generate both a subject line and message body as a professional lead generation specialist.`
//         });

//         // Create and poll run
//         let run = await openai.beta.threads.runs.create(ThreadID, {
//             assistant_id: process.env.OPENAI_ASSISTANT_ID,
//             instructions: "Format the response with 'Subject Line:' and 'Message:' clearly separated."
//         });

//         // Poll for completion
//         let timeElapsed = 0;
//         const timeout = 60; // 60 seconds timeout
//         const interval = 2; // Check every 2 seconds

//         while (timeElapsed < timeout) {
//             run = await openai.beta.threads.runs.retrieve(ThreadID, run.id);
            
//             if (run.status === 'completed') {
//                 const messages = await openai.beta.threads.messages.list(ThreadID);
//                 const content = messages.data[0].content[0].text.value;
                
//                 // Extract subject and body
//                 const subjectMatch = content.match(/Subject Line: "(.*?)"/);
//                 const messageMatch = content.match(/Message:\s*"([\s\S]*?)"$/);
                
//                 const body = messageMatch ? messageMatch[1].trim() : null;
//                 const subject = subjectMatch ? subjectMatch[1].trim() : null;

//                 if (!body || !subject) {
//                     throw new Error('Failed to generate message content');
//                 }

//                 return { body, subject };
//             }
            
//             if (run.status === 'failed') {
//                 throw new Error('OpenAI request failed');
//             }

//             await new Promise(resolve => setTimeout(resolve, interval * 1000));
//             timeElapsed += interval;
//         }

//         throw new Error('Request timed out');
//     } catch (error) {
//         console.error('Error in linkedinpersonalise:', error);
//         throw error;
//     }
// }

async function newSendLinkedInMessage({ url, cookie, userAgent, message, subject }) {
    const AGENT_ID = '3591875049244378';
    const MAX_RETRIES = 3;
    const RETRY_DELAY = 5000;

    const options = {
        headers: {
            "x-phantombuster-key": process.env.PHANTOMBUSTER_API_KEY,
            "Content-Type": "application/json",
        }
    };

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            // Wait for agent availability before attempting to launch
            await waitForAgentAvailability(process.env.PHANTOMBUSTER_API_KEY, AGENT_ID);

            const response = await axios.post(
                "https://api.phantombuster.com/api/v2/agents/launch",
                {
                    "id": AGENT_ID,
                    "argument": {
                        numberOfProfilesPerLaunch: 7,
                        spreadsheetUrl: url,
                        spreadsheetUrlExclusionList: [],
                        sessionCookie: cookie,
                        userAgent: userAgent,
                        message: message,
                        sendInMail: true,
                        inMailSubject: subject
                    }
                },
                options
            );

            return response.data;

        } catch (error) {
            console.error(`Attempt ${attempt} failed:`, error.response?.data || error.message);

            if (error.response?.data?.error === 'Agent maximum parallel executions limit of 1 (agent limit) reached') {
                console.log('Agent is busy, will retry after waiting...');
                
                if (attempt < MAX_RETRIES) {
                    await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
                    continue;
                }
            }

            // If we've reached max retries or it's a different error, throw it
            throw new Error('Failed to send LinkedIn message: ' + (error.response?.data?.error || error.message));
        }
    }
}


// async function newSendLinkedInMessage({ url, cookie, userAgent, message, subject }) {
//     const options = {
//         headers: {
//             "x-phantombuster-key": process.env.PHANTOMBUSTER_API_KEY,
//             "Content-Type": "application/json",
//         }
//     };
    
//     try {
//         const response = await axios.post(
//             "https://api.phantombuster.com/api/v2/agents/launch",
//             {
//                 "id": '3591875049244378',
//                 "argument": {
//                     numberOfProfilesPerLaunch: 7,
//                     spreadsheetUrl: url,
//                     spreadsheetUrlExclusionList: [],
//                     sessionCookie: cookie,
//                     userAgent: userAgent,
//                     message: message,
//                     sendInMail: true,
//                     inMailSubject: subject
//                 }
//             },
//             options
//         );
        
//         return response.data;
//     } catch (error) {
//         console.error('Phantombuster API error:', error.response?.data || error.message);
//         throw new Error('Failed to send LinkedIn message');
//     }
// }
// Auth Routes
app.post('/api/register', async (req, res) => {
    try {
        const { email, password, name } = req.body;

        // Validate input
        if (!email || !password || !name) {
            return res.status(400).json({ error: 'All fields are required' });
        }

        // Check if user exists
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ error: 'Email already registered' });
        }

        // Create user
        const hashedPassword = await bcrypt.hash(password, 10);
        const user = new User({
            email,
            password: hashedPassword,
            name
        });

        await user.save();

        // Generate token
        const token = jwt.sign(
            { userId: user._id },
            process.env.JWT_SECRET || 'your-secret-key',
            { expiresIn: '7d' }
        );

        res.status(201).json({
            token,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                plan: user.plan,
                messagesSent: user.messagesSent,
                messageLimits: user.messageLimits
            }
        });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ error: 'Error creating user' });
    }
});

app.post('/api/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        // Find user
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Check password
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Generate token
        const token = jwt.sign(
            { userId: user._id },
            process.env.JWT_SECRET || 'your-secret-key',
            { expiresIn: '7d' }
        );

        res.json({
            token,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                plan: user.plan,
                messagesSent: user.messagesSent,
                messageLimits: user.messageLimits
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Error logging in' });
    }
});

// Protected Routes
app.get('/api/profile', auth, async (req, res) => {
    try {
        const user = await User.findById(req.user._id).select('-password');
        res.json(user);
    } catch (error) {
        res.status(500).json({ error: 'Error fetching profile' });
    }
});

app.patch('/api/profile', auth, async (req, res) => {
    try {
        const updates = Object.keys(req.body);
        const allowedUpdates = ['name', 'email', 'linkedinCookie', 'userAgent'];
        const isValidOperation = updates.every(update => allowedUpdates.includes(update));

        if (!isValidOperation) {
            return res.status(400).json({ error: 'Invalid updates' });
        }

        updates.forEach(update => {
            req.user[update] = req.body[update];
        });
        await req.user.save();
        
        res.json(req.user);
    } catch (error) {
        res.status(400).json({ error: 'Error updating profile' });
    }
});


// Get user templates
app.get('/api/templates', auth, async (req, res) => {
    try {
        const templates = await Template.find({ userId: req.user._id })
            .sort({ lastUsed: -1 });
        res.json(templates);
    } catch (error) {
        res.status(500).json({ error: 'Error fetching templates' });
    }
});

// Save new template
app.post('/api/templates', auth, async (req, res) => {
    try {
        const { name, content } = req.body;
        
        const template = new Template({
            userId: req.user._id,
            name,
            content
        });

        await template.save();
        res.status(201).json(template);
    } catch (error) {
        res.status(500).json({ error: 'Error saving template' });
    }
});

// Get specific template
app.get('/api/templates/:id', auth, async (req, res) => {
    try {
        const template = await Template.findOne({
            _id: req.params.id,
            userId: req.user._id
        });

        if (!template) {
            return res.status(404).json({ error: 'Template not found' });
        }

        template.lastUsed = new Date();
        await template.save();

        res.json(template);
    } catch (error) {
        res.status(500).json({ error: 'Error fetching template' });
    }
});

// Delete template
app.delete('/api/templates/:id', auth, async (req, res) => {
    try {
        const result = await Template.deleteOne({
            _id: req.params.id,
            userId: req.user._id
        });

        if (result.deletedCount === 0) {
            return res.status(404).json({ error: 'Template not found' });
        }

        res.json({ message: 'Template deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Error deleting template' });
    }
});



// LinkedIn Automation Routes
// Update your LinkedIn route with detailed logging
app.post('/api/linkedin/personalise', auth, async (req, res) => {
    console.log('=== START OF LINKEDIN PERSONALIZATION REQUEST ===');
    console.log('Request Body:', JSON.stringify(req.body, null, 2));
    console.log('Authenticated User:', req.user._id);

    try {
        const { url, cookie, data, pitch, name, userAgent } = req.body;
        
        // Log the extracted data
        console.log('Extracted Data:', {
            url: url,
            cookiePresent: !!cookie,
            dataPresent: !!data,
            pitch: pitch,
            name: name
        });

        // Validate input
        if (!url || !cookie || !data || !pitch || !name) {
            console.log('Validation Failed:', {
                url: !!url,
                cookie: !!cookie,
                data: !!data,
                pitch: !!pitch,
                name: !!name
            });
            return res.status(400).json({
                error: 'Missing required fields',
                details: { url: !!url, cookie: !!cookie, data: !!data, pitch: !!pitch, name: !!name }
            });
        }

        // Check rate limits
        console.log('Rate Limit Check:', {
            messagesSent: req.user.messagesSent,
            dailyLimit: req.user.messageLimits.daily
        });

        if (req.user.messagesSent >= req.user.messageLimits.daily) {
            console.log('Rate limit exceeded');
            return res.status(429).json({
                error: 'Daily message limit reached',
                limit: req.user.messageLimits.daily,
                reset: new Date(new Date().setHours(24, 0, 0, 0))
            });
        }

        console.log('Starting LinkedIn personalization...');
        const result = await newlinkedinpersonalise(url, cookie || req.user.linkedinCookie, 
            req.user.userAgent, data, pitch, name);
        console.log('Personalization result:', result);

        // Log message
        console.log('Creating message record...');
        const messageRecord = await Message.create({
            userId: req.user._id,
            recipientUrl: url,
            recipientName: name,
            messageContent: result.body,
            status: 'Success'
        });
        console.log('Message record created:', messageRecord._id);

        // Update user message count
        console.log('Updating user message count...');
        req.user.messagesSent += 1;
        await req.user.save();
        console.log('User message count updated');

        console.log('=== END OF SUCCESSFUL REQUEST ===');
        res.json({
            status: 'success',
            message: 'LinkedIn message personalized and sent',
            body: result.body,
            messagesSent: req.user.messagesSent,
            messagesRemaining: req.user.messageLimits.daily - req.user.messagesSent
        });

    } catch (error) {
        console.error('=== ERROR IN LINKEDIN PERSONALIZATION ===');
        console.error('Error details:', error);
        console.error('Stack trace:', error.stack);
        
        try {
            // Log failed attempt
            console.log('Logging failed attempt...');
            await Message.create({
                userId: req.user._id,
                recipientUrl: req.body.url,
                status: 'Failed',
                error: error.message
            });
            console.log('Failed attempt logged');
        } catch (logError) {
            console.error('Error logging failure:', logError);
        }

        res.status(500).json({
            error: 'Message personalization failed',
            message: error.message
        });
    }
});

// Analytics Routes
app.get('/api/messages/history', auth, async (req, res) => {
    try {
        const messages = await Message.find({ userId: req.user._id })
            .sort({ timestamp: -1 })
            .limit(100);

        res.json(messages);
    } catch (error) {
        res.status(500).json({ error: 'Error fetching message history' });
    }
});

app.get('/api/user/stats', auth, async (req, res) => {
    try {
        // Get message statistics
        const stats = await Message.aggregate([
            { $match: { userId: req.user._id } },
            { $group: {
                _id: '$status',
                count: { $sum: 1 }
            }}
        ]);

        // Get daily stats for the last 7 days
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        const dailyStats = await Message.aggregate([
            { 
                $match: { 
                    userId: req.user._id,
                    timestamp: { $gte: sevenDaysAgo }
                }
            },
            {
                $group: {
                    _id: {
                        $dateToString: { format: "%Y-%m-%d", date: "$timestamp" }
                    },
                    count: { $sum: 1 }
                }
            }
        ]);

        res.json({
            messagesSent: req.user.messagesSent,
            messagesRemaining: req.user.messageLimits.daily - req.user.messagesSent,
            stats: stats.reduce((acc, stat) => {
                acc[stat._id.toLowerCase()] = stat.count;
                return acc;
            }, {}),
            dailyStats: dailyStats.reduce((acc, stat) => {
                acc[stat._id] = stat.count;
                return acc;
            }, {})
        });
    } catch (error) {
        res.status(500).json({ error: 'Error fetching user stats' });
    }
});





let data = []
// let body_linkedin

app.post('/linkedin/personalise', async (req, res) => {
    try {
        // Validate input
        const { url, cookie, userAgent, data, pitch, name } = req.body;

        // Check for required fields
        if (!url || !cookie || !userAgent || !data || !pitch) {
            return res.status(400).json({
                error: 'Missing required fields',
                details: {
                    url: !!url,
                    cookie: !!cookie,
                    userAgent: !!userAgent,
                    data: !!data,
                    pitch: !!pitch
                }
            });
        }

        // Log incoming request (consider removing sensitive info in production)
        console.log('Received LinkedIn personalization request', { 
            url: url.substring(0, 50) + '...', 
            dataLength: data.length 
        });

        // Attempt personalization
        await linkedinpersonalise(url, cookie, userAgent, data, pitch, name);

        // } catch (personaliseError) {
        //     console.error('Personalization failed:', personaliseError);
        //     return res.status(500).json({
        //         error: 'Personalization process failed',
        //         message: personaliseError.message
        //     });
        // }

        // Destructure result with default fallback
        // const { 
        //     subject_linkedin = 'Default LinkedIn Message', 
        //     body_linkedin = 'No personalized message generated' 
        // } = linkedinPersonaliseResult || {};

        // Attempt to send LinkedIn message

        // Success response
        res.status(200).json({
            status: 'success',
            message: 'LinkedIn message personalized and sent',
            body: body_linkedin,
            details: {
                subjectLength: subject_linkedin.length,
                bodyLength: body_linkedin.length
            }
        });

    } catch (globalError) {
        // Catch any unexpected errors
        console.error('Unexpected error in LinkedIn personalization:', globalError);
        res.status(500).json({
            error: 'Internal server error',
            message: 'An unexpected error occurred during LinkedIn personalization'
        });
    }
});

// Optional: Add error handling middleware for unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    // Optional: You might want to send an alert or log to a monitoring service
});

async function linkedinpersonalise(url, cookie, userAgent, data, pitch, name){

ThreadID = await CreateThread()
try {
const message = await openai.beta.threads.messages.create(
    ThreadID,
    {
        role: "user",
        content:  `using this data  :  ${data} the persons name that i am sending the message from is also in that data at the end, make sure you sign off using this name: ${name} can you please create me a personalised linkedin profile using data from these fields  in this file . This is the pitch I am going to use: ${pitch}.  Generate the subject line then the body of the message please as you would as you are a professional lead generation and cold outreach specialist.
`
    }
);
    console.log("Message added");
    let run = await openai.beta.threads.runs.createAndPoll(
        ThreadID,
        {
            assistant_id: 'asst_URUrBKJEYZhACXb6YNmZ4xj3',
            instructions: ""
        }
    );
    console.log("Run created");
    let timeElapsed = 0;
    const timeout = 140; // Timeout duration in seconds
    const interval = 5; // Interval duration in seconds

    const checkRunStatus = async () => {
        while (timeElapsed < timeout) {
            try {
                run = await openai.beta.threads.runs.retrieve(ThreadID, run.id);
            } catch (error) {
                console.error('Error retrieving run status:', error);
                break;
            }
            if (run.status === 'completed') {
                console.log("completed")
                const messages = await openai.beta.threads.messages.list(
                    run.thread_id
                );
                    const content = messages.data[0].content[0].text.value
                    console.log(content)
                    originalMessage = content
                    const subjectMatch = originalMessage.match(/Subject Line: "(.*?)"/);
                    const messageMatch = originalMessage.match(/Message:\s*"([\s\S]*?)"$/);
                    
                    const subjectLine = subjectMatch ? subjectMatch[1] : "No subject found";
                    const body = messageMatch ? messageMatch[1] : "No body found";

                    body_linkedin = body
                    // data.push[{
                    //     body: body, subject:subjectLine
                    // }]
                    // console.log(data)
                    await SendLinkedInMessage({
                        url: url,
                        cookie: cookie,
                        userAgent: userAgent,
                        message: body,
                        subject: subjectLine
                    });
                    // const { subject_linkedin, body_linkedin } = extractEmailContent(content);

                //    const { subject, body } = extractEmailContent(content)
                    // const lines = content.split('\n');
                    // subject_linkedin = lines[0];
                    // body_linkedin = lines.slice(1).join('\n');

                    // console.log(url, cookie, userAgent, body_linkedin, subject_linkedin)


                    // res.json({ body: body_linkedin, subject : subject_linkedin });
                    return { body , subjectLine }
                    // break

            } else {
                console.log("status: ", run.status);
                console.log(`vc ${timeElapsed} seconds`);
                timeElapsed += interval;
                await new Promise(resolve => setTimeout(resolve, interval * 1000)); // Wait for the interval duration
            }
        }
        console.log('Timeout reached');
        return {body: null, subjecLine: null};
    };
    await checkRunStatus();
} catch (error) {
    console.error('Error:', error);
    return {body: null, subjecLine: null};
}
}

async function SendLinkedInMessage({ url, cookie, userAgent, message, subject }) {
    console.log(url, cookie, userAgent, body_linkedin, subject_linkedin)
    const options = {
        headers: {
            "x-phantombuster-key": process.env.PHANTOMBUSTER_API_KEY,
            "Content-Type": "application/json",
        },
    }
    
    axios
        .post(
            "https://api.phantombuster.com/api/v2/agents/launch",
            {
            "id":"3591875049244378",
            "argument":{
                "numberOfProfilesPerLaunch":7,
                "spreadsheetUrl":`${url}`,
                "spreadsheetUrlExclusionList":[],
                "sessionCookie":`${cookie}`,
                "userAgent":`${userAgent}`,
                "message":`${message}`,
                "sendInMail":true,
                "inMailSubject":`${subject}` }
            },
            options,
        )
        .then((res) => console.log(res.body))
        .catch((error) => console.error("Something went wrong :(", error))
}



const sendTransactionalEmail = async (to,
    email,
    subject,
    body,
    user,
    pass,
    service,
    campaignid) => {
  const url = 'https://api.brevo.com/v3/smtp/email';
  const apiKey = process.env.BREVO; // Replace with your actual API key

  const data = {
      sender: {
          name: 'Alex',
          email: user,
      },
      to: [
          {
              email: to,
              name: 'Ro',
          },
      ],
      subject: subject,
      htmlContent: `<div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
   <p>${body.replace(/\n/g, '<br>')}</p>
   <p style="margin-top: 20px; font-size: 12px; color: #777;">
    
   </p>
</div>`,
  };

  try {
      const info = await axios.post(url, data, {
          headers: {
              'accept': 'application/json',
              'api-key': apiKey,
              'content-type': 'application/json',
          },
      });

      console.log('Email sent successfully:', info.data);
  } catch (error) {
      console.error('Error sending email:', error.info ? error.info.data : error.message);
  }
};

async function updateEmailStatusMongo(emailId, newStatus) {
    try {

        const customer = await Customer.findOne({ 'emails.UUID': emailId });

        if (!customer) {
            throw new Error(`No email found with id: ${emailId}`);
        }
        console.log("found")
        const emailIndex = customer.emails.findIndex(email => email.UUID === emailId);
        
        // Update the specific email using the index
        customer.emails[emailIndex].status = newStatus;
        
        // Save the changes
        await customer.save();
        
        return customer;
    } catch (error) {
        console.error('Error updating email status:', error);
        throw error;
    }
}

app.get('/api/fda-filings', async (req, res) => {
    try {
      const response = await axios.get(`https://api.fda.gov/drug/drugsfda.json`, {
        params: {
          api_key: process.env.FDA_API_KEY,
          // search: "submission_status_date:[2024-01-01 TO 2024-12-19]",
          // Correct date format
          limit: 20,
          // sort: undefined
          sort: 'submissions.submission_status_date:desc'
        }
      });
  
      const filings = response.data.results.map(filing => ({
        company: filing.sponsor_name,
        type: filing.submissions[0]?.submission_type || 'N/A',
        date: filing.submissions[0]?.submission_status_date || 'N/A',
        status: filing.submissions[0]?.submission_status || 'Pending',
        id: filing.application_number
      }));
  
      res.json(filings);
    } catch (error) {
      console.error('FDA API Error Details:', error.response?.data);
  
      // console.error('FDA API Error:', error);
      res.status(500).json({ error: 'Error fetching FDA filings' });
    }
  });
  
  app.get('/api/patents', async (req, res) => {
    try {
      const url = 'https://api.patentsview.org/patents/query';
      
      const requestBody = {
        q: {
          _and: [
            {
              _gte: {
                patent_date: "2024-01-01",
                assignee_organization: true
              }
            },
  
          ]
        },
        f: [
          "patent_number",
          "patent_title", 
          "patent_date",
          "patent_type",           // Type of patent
          "patent_kind",           // Kind code
          "assignee_organization", // Organization name
          "assignee_first_name",   // Individual assignee first name
          "assignee_last_name",    // Individual assignee last name
          // To help determine status
          "patent_processing_time", // Time taken for processing
  
          // Joint venture indicators
          "assignee_sequence",          // Multiple assignees indicate collaboration
          // "coexaminer_group",          // Different examination groups can indicate tech breadth
          
          // Technology transfer indicators
          "uspc_sequence",             // Multiple classifications suggest tech overlap areas
          "cited_patent_number",       // Who they cite shows who they follow
          "citedby_patent_number",     // Who cites them shows industry influence
          // "num_cited_by_us_patents",   // Citation count indicates tech importance
          
          // Geographic scope
          "assignee_country",          // International presence
          "inventor_country",          // R&D locations
          
          // Tech field breadth
          // "wipo_field",               // Technology sectors
          "cpc_group_id",             // Detailed tech classification
          // "uspc_class",               // US tech classification
          
          // Partnership indicators
          // "inventor_organization",     // Research partnerships
          "govint_org_name"           // Government/institution partnerships
  
        ],
        o: {
          "patent_date": "desc"
        },
        s: [{"patent_date": "desc"}],
        per_page: 100
      };
      
      const response = await axios.post(url, requestBody, {
        headers: {
          'Content-Type': 'application/json'
        }
      });
  
      const patents = response.data.patents.map(patent => {
        // Get patent status based on available fields
        const status = determinePatentStatus(patent.patent_kind, patent.patent_type);
        
        // Handle company/assignee information
        const assigneeInfo = getAssigneeInfo(patent);
        console.log(patent)
        return {
          title: patent.patent_title,
          company: assigneeInfo.company,
          assigneeType: assigneeInfo.type,
          issueDate: patent.patent_date,
          id: patent.patent_number,
          status: status,
          type: patent.patent_type || 'Unknown Type',
          applicationNumber: patent.application_number,
          asignee : patent.assignees[0].assignee_organization || 'Unknown Type'
        };
      });
      
      res.json(patents);
    } catch (error) {
      console.error('PatentsView API Error:', error.response?.data || error.message);
      res.status(500).json({ 
        error: 'Error fetching patent data',
        details: error.response?.data || error.message 
      });
    }
  });
  
  // Helper function to determine patent status from available fields
  function determinePatentStatus(kindCode, patentType) {
    // Kind codes indicate the publication level
    const kindCodeMap = {
      'A1': 'Patent Application Publication',
      'A2': 'Second Patent Application Publication',
      'A9': 'Corrected Patent Application Publication',
      'B1': 'Granted Patent (No previous publication)',
      'B2': 'Granted Patent (Previously published)',
      'P1': 'Plant Patent Application Publication',
      'P2': 'Plant Patent Grant',
      'P3': 'Plant Patent Application Publication',
      'P4': 'Plant Patent Grant (Previously published)',
      'P9': 'Corrected Plant Patent Application Publication',
      'H1': 'Statutory Invention Registration',
      'S1': 'Design Patent'
    };
  
    // If we have a kind code, use it
    if (kindCode && kindCodeMap[kindCode]) {
      return kindCodeMap[kindCode];
    }
  
    // Fall back to patent type if available
    if (patentType) {
      return `${patentType} Patent`;
    }
  
    return 'Status Unknown';
  }
  
  // Helper function to handle assignee information
  function getAssigneeInfo(patent) {
    // Check for organization first
    if (patent.assignee_organization?.[0]) {
      return {
        company: patent.assignee_organization[0],
        type: 'Organization'
      };
    }
    
    // If no organization, check for individual inventor
    if (patent.assignee_first_name?.[0] || patent.assignee_last_name?.[0]) {
      const firstName = patent.assignee_first_name?.[0] || '';
      const lastName = patent.assignee_last_name?.[0] || '';
      return {
        company: `${firstName} ${lastName}`.trim(),
        type: 'Individual'
      };
    }
    
    // Default case if no assignee information is available
    return {
      company: 'Unassigned',
      type: 'Unknown'
    };
  }
    //fcc submissions
    
    // More aggressive XML sanitization
  
    
    app.get('/api/fcc-submissions', async (req, res) => {
      try {
        const response = await axios.get('https://www.fcc.gov/news-events/daily-digest.xml', {
          timeout: 10000,
          maxRedirects: 3,
          headers: {
            'Accept': 'application/xml, application/rss+xml',
            'User-Agent': 'Mozilla/5.0 (compatible; YourApp/1.0;)',
          },
          // Get response as raw text
          responseType: 'text',
          transformResponse: [data => data]
        });
    
        // Create parser with very lenient options
        const parser = new XMLParser({
          ignoreAttributes: false,
          parseAttributeValue: true,
          trimValues: true,
          parseTagValue: true,
          allowBooleanAttributes: true,
          ignoreDeclaration: true,
          ignorePiTags: true,
          removeNSPrefix: true,
          numberParseOptions: {
            skipLike: /./
          }
        });
    
        // Parse the XML
        const result = parser.parse(response.data);
        console.log(result)
        
        // Navigate through the parsed structure to find items
        const items = result?.rss?.channel?.item || [];
        const submissions = (Array.isArray(items) ? items : [items])
          .slice(0, 10)
          .map(item => ({
            title: (item.title || 'No Title').trim(),
            type: 'Daily Digest Entry',
            date: formatDate(item.pubDate || item['dc:date'] || new Date()),
            status: 'Published',
            id: item.guid || item.link || `fcc-${Date.now()}-${Math.random().toString(36).slice(2)}`,
            link: item.link || 'https://www.fcc.gov/rss/daily-digest.xml'
          }));
    console.log(submissions)
        res.json(submissions);
        
      } catch (error) {
        console.error('FCC Feed Error:', {
          message: error.message,
          stack: error.stack
        });
    
        // Return fallback data
        res.json([{
          title: 'FCC Daily Digest Feed Temporarily Unavailable',
          type: 'System Notice',
          date: new Date().toISOString(),
          status: 'Feed Error',
          id: `error-${Date.now()}`,
          link: 'https://www.fcc.gov/news-events/daily-digest'
        }]);
      }
    });
    
    function formatDate(dateStr) {
      try {
        const date = new Date(dateStr);
        return date.toString() === 'Invalid Date' ? 
          new Date().toISOString() : 
          date.toISOString();
      } catch {
        return new Date().toISOString();
      }
    }
  
  
  // Company Data Enrichment
  app.post('/api/enrich-company', async (req, res) => {
    const { companyName } = req.body;
    
    try {
      // Fetch additional company data from Apollo
      const apolloResponse = await axios.get(`https://api.apollo.io/v1/organizations/enrich`, {
        headers: {
          'X-API-KEY': process.env.APOLLO_API_KEY
        },
        params: {
          domain: companyName.toLowerCase().replace(/\s+/g, '') + '.com'
        }
      });
  
      // Get employee email patterns using Hunter.io
      const hunterResponse = await axios.get('https://api.hunter.io/v2/domain-search', {
        params: {
          domain: apolloResponse.data.domain,
          api_key: process.env.HUNTER_API_KEY
        }
      });
  
      const enrichedData = {
        companyInfo: apolloResponse.data,
        emailPatterns: hunterResponse.data.data.pattern
      };
  
      res.json(enrichedData);
    } catch (error) {
      console.error('Enrichment Error:', error);
      res.status(500).json({ error: 'Error enriching company data' });
    }
  });
  
  // Funding Rounds (using Crunchbase API)
  // Fetch funding rounds from Crunchbase API
  app.get('/api/funding-rounds', async (req, res) => {
    try {
      const { CRUNCHBASE_API_KEY } = process.env;
  
      if (!CRUNCHBASE_API_KEY) {
        return res.status(500).json({ error: 'Crunchbase API key is missing' });
      }
  
      const response = await axios.post(
        'https://api.crunchbase.com/api/v4/searches/organizations',
        {
          field_ids: [
            "identifier",
            "name",
            "short_description",
            // "funding_total",
            // "categories",
            // "website",
            // "founded_on",
            "rank_org"
          ],
          query: [
            // {
            //   type: "predicate",
            //   field_id: "funding_total",
            //   operator_id: "gt",
            //   values: [0]
            // },
            {
              type: "predicate",
              field_id: "facet_ids",
              operator_id: "includes",
              values: [
                "company"
              ]
            }
          ],
          order: [
            {
              field_id: "rank_org",
              sort: "asc"  // Lower rank means more recent/important updates
            }
          ],
          limit: 10
        },
        {
          headers: { 
            'X-cb-user-key': CRUNCHBASE_API_KEY,
            'Content-Type': 'application/json'
          }
        }
      );
  
      const companies = response.data.entities.map(org => ({
        company: org.properties.name,
        description: org.properties.short_description || 'No description available',
        totalFunding: org.properties.funding_total
          ? `$${(org.properties.funding_total / 1000000).toFixed(1)}M`
          : 'Undisclosed',
        founded: org.properties.founded_on || 'Unknown',
        website: org.properties.website?.url || 'Not available',
        categories: org.properties.categories || [],
        rank: org.properties.rank_org,
        id: org.properties.identifier
      }));
  
      res.json(companies);
    } catch (error) {
      console.error('Crunchbase API Error:', error.response?.data || error);
      res.status(error.response?.status || 500).json({ 
        error: 'Error fetching company data'
      });
    }
  });


// const Campaign = mongoose.model('Campaign', CampaignSchema);

app.post('/api/campaigns', async (req, res) => {
    try {
      const campaign = new Campaign(req.body);
      await campaign.save();
      res.json(campaign);
    } catch (error) {
      res.status(500).json({ error: 'Error creating campaign' });
    }
  });
  
  app.get('/api/campaigns', async (req, res) => {
    try {
      const campaigns = await Campaign.find();
      res.json(campaigns);
    } catch (error) {
      res.status(500).json({ error: 'Error fetching campaigns' });
    }
  });

  


app.post('/webhooks/mailjet', async (req, res) => {
    try {
        console.log("hi")
        const events = req.body;

        // Iterate over each event
        for (const event of events) {
            const { event: eventType, email, timestamp, MessageID, Message_GUID } = event;

            switch (eventType) {
                case 'open':
                    console.log(event)
                    console.log(`Email opened: ${email}, Message ID: ${MessageID}`);
                    updateEmailStatusMongo(event.Message_GUID, 'opened')
                    res.status(200).send('Webhook received');
                    // Handle opened event (e.g., log to DB)
                    // break;

                case 'bounce':
                    console.log(event.MessageID)
                    console.log(`Email bounced: ${email}, Message ID: ${messageID}`);
                    updateEmailStatusMongo(event.MessageGUID, 'bounced')
                    res.status(200).send('Webhook received');
                    // Handle bounce event (e.g., mark email as invalid)
                    // break;

                case 'spam':
                    console.log(event.MessageID)
                    console.log(`Email marked as spam: ${email}, Message ID: ${messageID}`);
                    updateEmailStatusMongo(event.MessageGUID, 'spam')
                    // Handle spam event (e.g., flag in DB)
                    res.status(200).send('Webhook received');
                    // break;

                default:
                    console.log(`Unhandled event: ${eventType}`);
                    res.status(200).send('Webhook received');
            }
        };

        res.status(200).send('Webhook received');
    } catch (error) {
        console.error('Error processing webhook:', error);
        res.status(200).send('Server error');
    }
});


// //signatures

// // MongoDB Schema
// const signatureSchema = new mongoose.Schema({
//     userId: {
//         type: mongoose.Schema.Types.ObjectId,
//         required: true,
//         ref: 'User'
//     },
//     name: {
//         type: String,
//         required: true
//     },
//     content: {
//         type: String,
//         required: true
//     },
//     isActive: {
//         type: Boolean,
//         default: false
//     },
//     createdAt: {
//         type: Date,
//         default: Date.now
//     }
// });

// const Signature = mongoose.model('Signature', signatureSchema);

// // API Routes
// app.get('/api/signatures',  async (req, res) => {
//     try {
//         const signatures = await Signature.find({ userId: req.user._id });
//         res.json(signatures);
//     } catch (error) {
//         res.status(500).json({ error: 'Failed to fetch signatures', error });
//     }
// });

// app.post('/api/signatures',  async (req, res) => {
//     try {
//         const { name, content } = req.body;
//         const signature = new Signature({
//             userId: req.user._id,
//             name,
//             content
//         });
//         await signature.save();
//         res.status(201).json(signature);
//     } catch (error) {
//         res.status(500).json({ error: 'Failed to create signature' });
//     }
// });

// app.put('/api/signatures/:id',  async (req, res) => {
//     try {
//         const { name, content } = req.body;
//         const signature = await Signature.findOneAndUpdate(
//             { _id: req.params.id, userId: req.user._id },
//             { name, content },
//             { new: true }
//         );
//         if (!signature) {
//             return res.status(404).json({ error: 'Signature not found' });
//         }
//         res.json(signature);
//     } catch (error) {
//         res.status(500).json({ error: 'Failed to update signature' });
//     }
// });

// app.delete('/api/signatures/:id',  async (req, res) => {
//     try {
//         const signature = await Signature.findOneAndDelete({
//             _id: req.params.id,
//             userId: req.user._id
//         });
//         if (!signature) {
//             return res.status(404).json({ error: 'Signature not found' });
//         }
//         res.status(204).send();
//     } catch (error) {
//         res.status(500).json({ error: 'Failed to delete signature' });
//     }
// });

// app.post('/api/signatures/:id/activate',  async (req, res) => {
//     try {
//         await Signature.updateMany(
//             { userId: req.user._id },
//             { isActive: false }
//         );
        
//         const signature = await Signature.findOneAndUpdate(
//             { _id: req.params.id, userId: req.user._id },
//             { isActive: true },
//             { new: true }
//         );
        
//         if (!signature) {
//             return res.status(404).json({ error: 'Signature not found' });
//         }
//         res.json(signature);
//     } catch (error) {
//         res.status(500).json({ error: 'Failed to activate signature' });
//     }
// });




app.listen(port, async () => {
    console.log(`Server is running on port ${port}`);
    // const data = await createTrialSubscription("sdaa@gmail.com");
    // console.log(data.customerId)

    // apiemails('margaeryfrey.325319@gmail.com')
    // const companyIntel = await scraper.scrapeCompanyIntelligence('https://knipper.com');
    // console.log(companyIntel)

    // const scraper = new WebScraper();
//     const fs = require('fs').promises;
// const data =  await scraper.scrape('startupstage.app')
// let summary = `
// Company: ${data.basicInfo.companyName}
// Title: ${data.basicInfo.title}
// Description: ${data.basicInfo.description}
// Language: ${data.basicInfo.language}
// Industries: ${data.basicInfo.industryAnalysis.map(i => `${i.industry} (confidence: ${i.confidence})`).join(', ')}
// URL: ${data.url} (Favicon: ${data.basicInfo.favicon})
// Technical Details: ${data.technical.ssl ? 'Secure' : 'Non-secure'} and ${data.technical.mobileFriendly ? 'mobile-friendly' : 'not mobile-friendly'}
// Contact: ${data.contactInfo.phones?.[0] || 'Not available'}

// Metadata: ${Object.entries(data.metaData.meta.general).map(([key, value]) => `${key}: ${value}`).join(', ')}

// Business Offerings:
// ${Object.entries(data.businessInfo.offerings).map(([category, items]) => 
//   `${category}: ${Array.isArray(items) ? items.join(', ') : 'None'}`
// ).join('\n')}

// Topics: ${data.textContent.topics.map(t => `${t.topic} (frequency: ${t.frequency}, score: ${t.score})`).join(', ')}

// Keywords: ${data.textContent.keywords.map(k => `${k.term} (score: ${k.score})`).join(', ')}
// `;

// console.log(summary);
    // .then(async result => 
        
//         await fs.writeFile('./results.json', JSON.stringify(result, null, 2)))
//         // console.log(`Data successfully saved to ${'results.json'}`),
//         // console.log(result))
//     .catch(error => console.error(error));

    // console.log(await GetEmailsxx('margaeryfrey.325319@gmail.com'))
    // await   sendcampsummaryEmail({
    //     to: 'syneticslz@gmail.com',
    //     email:'margaeryfrey.325319@gmail.com',
    //     subject: 'subject',
    //     body: 'text',
    //     user:  'rohanmehmi72@gmail.com',
    //     pass: 'pass', // App password
    //     service: 'gmail',
    //     campaignid: 'campaignid'
    //   });

//     const request = mailjet
// 	.get("message")
// 	.request({
// 		"UUID":"40fc52d2-09cc-4f5f-b0fa-e864725c0e7e"
// 	})
// request
// 	.then((result) => {
// 		console.log(result.body)
// 	})
// 	.catch((err) => {
// 		console.log(err.statusCode)
// 	})


//     sendTransactionalEmail({
//         to: 'rohanmehmi72@gmail.com',
//             email:'rohanmehmi72@gmail.com',
//             subject: 'subject',
//             body: 'text',
//             user:  'alexrmacgregor@gmail.com',
//             pass: 'pass', // App password
//             service: 'gmail',
//             campaignid: 'campaignid'
// });

    // const request = mailjet.post('send').request({
    //     Messages: [
    //       {
    //         FromEmail: 'syneticslz@gmail.com',
    //         FromName: 'Alex',
    //         Recipients: [{ Email: 'rohanmehmi72@gmail.com', Name: 'passenger 1' }],
    //         Subject: 'Your email flight plan!',
    //         'Text-part':
    //           'Dear passenger 1, welcome to Mailjet! May the delivery force be with you!',
    //         'Html-part':
    //           '<h3>Dear passenger 1, welcome to <a href="https://www.mailjet.com/">Mailjet</a>!<br />May the delivery force be with you!',
    //       },
    //       {
    //         FromEmail: 'rohanmehmi72@gmail.com',
    //         FromName: 'Mailjet Pilot',
    //         Recipients: [{ Email: 'varityclothes@gmail.com', Name: 'passenger 2' }],
    //         Subject: 'Your email flight plan!',
    //         'Text-part':
    //           'Dear passenger 2, welcome to Mailjet! May the delivery force be with you!',
    //         'Html-part':
    //           '<h3>Dear passenger 2, welcome to <a href="https://www.mailjet.com/">Mailjet</a>!<br />May the delivery force be with you!',
    //       },
    //     ],
    //   })
    //   request
    //     .then(result => {
    //       console.log(result.body)
    //     })
    //     .catch(error => {
    //       console.log(error.statusCode)
    //     })

        // const scraper = new AdvancedCompanyIntelligenceScraper({
        //     openaiApiKey: process.env.OPENAI_API_KEY,
        //     timeout: 60000,
        //     maxRetries: 3
        // });
    
        // try {
        //     const companyUrl = 'https://voltmailer.com';
        //     const companyIntel = await scraper.scrapeCompanyIntelligence(companyUrl);
        //     console.log(JSON.stringify(companyIntel, null, 2));
        // } catch (error) {
        //     console.error('Scraping failed:', error);
        // }
    
// const msg = {
//   to: 'syneticslz@gmail.com', // Change to your recipient
//   from: 'rohanmehmi72@gmail.com', // Change to your verified sender
//   subject: 'Sending with SendGrid is Fun',
//   text: 'and easy to do anywhere, even with Node.js',
//   html: '<strong>and easy to do anywhere, even with Node.js</strong>',
// }
// sgMail
//   .send(msg)
//   .then(() => {
//     console.log('Email sent')
//   })
//   .catch((error) => {
//     console.error(error)
//   })


    // Client-side or Postman
// console.log(await customlinkedinscrape())
// runScraper();
// async function main() {
//     try {
//         const scrapedData = await runScraper();
//         console.log(scrapedData);
//     } catch (error) {
//         console.error('Error:', error);
//     }
// // }



// const axios = require("axios")

// const options = {
// 	headers: {
// 		"x-phantombuster-key": process.env.PHANTOMBUSTER_API_KEY,
// 		"Content-Type": "application/json",
// 	},
// }

// axios
// 	.post(
// 		"https://api.phantombuster.com/api/v2/agents/launch",
// 		{
//         "id":"3591875049244378",
//         "argument":{
//             "numberOfProfilesPerLaunch":7,
//             "spreadsheetUrl":"https://www.linkedin.com/sales/lead/ACwAAACcvj0BgAW9RF57mBJF2cGU36Dohf8UEu0,NAME_SEARCH,ztro",
//             "spreadsheetUrlExclusionList":[],
//             "sessionCookie":"AQEFAREBAAAAABLde_IAAAGToq54SgAAAZPGu0B9TgAAtHVybjpsaTplbnRlcnByaXNlQXV0aFRva2VuOmVKeGpaQUFDb1RseVdpQmFzRXVXR1VRTGZNNndZUVF4WXZsV3Q0RVpVZFk2SnhnWUFYelJCb0k9XnVybjpsaTplbnRlcnByaXNlUHJvZmlsZToodXJuOmxpOmVudGVycHJpc2VBY2NvdW50OjMxMjIyMTIyNiwyOTQyNjQwNjcpXnVybjpsaTptZW1iZXI6MTA4ODE1Mzc5NEcWa-KKPWlOAy-B07wNP1cJj5ddp7uBvhr0nGFj2nLK-Qw-ygDPBn4amQU_BZSjelh_Ft9ycImsFm3bYtz0C3AF6OuFbkA5EASSchVM5l5OCZpMDyX7FIg9S0AAi3jU2BzTuxArMn2RyQwpoiXHKOHhIwZ_vbHbcVnufLFb3SlXFndiNo3uJQaq-1o1e1sQzXWUIys",
//             "userAgent":"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
//             "message":"Hey #firstName#, \n\nThe reason I'm reaching out to you is because I believe I can help your business rank on Google's first page and turn more of your website visitors into customers.\n\nI work with a Canadian firm that has 20+ years of experience in crafting SEO content that ranks and converts, they even have 80% of their clients come from referrals. \n\nLet me know if your interested in boosting your websites visibility so you can get more inbound sales.\n\nThanks for your time,",
//             "sendInMail":true,
//             "inMailSubject":"Quick Question?" }
//         },
// 		options,
// 	)
// 	.then((res) => console.log(res.body))
// 	.catch((error) => console.error("Something went wrong :(", error))

    // Instantiate the scraper

    // (async () => {
    //     const scraper = new AdvancedCompanyIntelligenceScraper();
    //     const data = await scraper.scrape("https://www.voltmailer.com/");
    //     console.log(data);
    //   })();


      // Example usage



    
    

    //   try {
    //     // Send a tracked email using the wrapped function
    //     await   sendcampsummaryEmail({
    //         to: 'rohanmehmi72@gmail.com',
    //         subject: 'Test Email',
    //         body: 'This is a test email',
    //         user:  user,
    //         pass: pass, // App password
    //         service: 'gmail',
    //       });
    
    //     console.log('Sent Email Tracking ID:', sentEmail.trackingId);
    
    //     // Check for bounces
    //     const bounces = await tracker.checkBounces();
    //     console.log('Bounced Emails:', bounces);
    
    //     // Track replies for a specific tracking ID
    //     const replies = await tracker.trackReplies(sentEmail.trackingId);
    //     console.log('Email Replies:', replies);
    //   } catch (error) {
    //     console.error('Tracking Error:', error);
    //   }
    // await summarizeWebsite('https://www.designelectronics.net')

// Bulk scrape multiple URLs
// const urls = [
//     'https://site1.com', 
//     'https://site2.com', 
//     'https://site3.com'
// ];

// scraper.scrapeBulk(urls)
//     .then(results => console.log(results))
//     .catch(error => console.error(error));

    // Optional: Use the scraped data (e.g., send an email summary)
    // sendcampsummaryEmail({
    //   to: 'rohanmehmi72@gmail.com',
    //   subject: 'Scraped Data Summary',
    //   body: JSON.stringify(scrapedData, null, 2),
    //   user: 'voltmailerhelp@gmail.com',
    //   pass: 'chys ltjh yxlo isbu', // App password
    //   service: 'gmail',
    // });
} );