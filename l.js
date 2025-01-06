// server.js
const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const OpenAI = require('openai');
const axios = require('axios');
require('dotenv').config();

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

const ASSISTANT_ID ="asst_olg2G5eozjqnUHDVWIctpX2N"



const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI || 'mongodb+srv://syneticslz:gMN1GUBtevSaw8DE@synetictest.bl3xxux.mongodb.net/linkedin?retryWrites=true&w=majority')
    .then(() => console.log('MongoDB Connected'))
    .catch(err => console.error('MongoDB Connection Error:', err));

// Rate Limiting
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP, please try again later.'
});

// Schemas
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
        daily: { type: Number, default: 100 },
        monthly: { type: Number, default: 2000 }
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

// Auth Middleware
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
        const result = await linkedinpersonalise(url, cookie || req.user.linkedinCookie, 
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
async function linkedinpersonalise(url, cookie, userAgent, data, pitch, name) {
    console.log('=== Starting linkedinpersonalise function ===');
    let attempts = 0;
    const maxAttempts = 3;

    while (attempts < maxAttempts) {
        attempts++;
        console.log(`Attempt ${attempts} of ${maxAttempts}`);

        try {
            console.log('Creating OpenAI thread...');
            const ThreadID = await CreateThread();
            console.log('Thread created:', ThreadID);

            console.log('Creating message in thread...');
            const message = await openai.beta.threads.messages.create(
                ThreadID,
                {
                    role: "user",
                    content: `Using this data: ${JSON.stringify(data)} and signing off as: ${name}, create a personalized LinkedIn message. Format the response exactly as follows:
                    Subject: [Your subject line here]
                    Message: [Your message content here]
                    Use this pitch template: ${pitch}`
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
                    await SendLinkedInMessage({ url, cookie, userAgent, message: body, subject });
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
async function CreateThread() {
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

async function SendLinkedInMessage({ url, cookie, userAgent, message, subject }) {
    const options = {
        headers: {
            "x-phantombuster-key": process.env.PHANTOMBUSTER_API_KEY,
            "Content-Type": "application/json",
        }
    };
    
    try {
        const response = await axios.post(
            "https://api.phantombuster.com/api/v2/agents/launch",
            {
                "id": process.env.PHANTOMBUSTER_AGENT_ID,
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
        console.error('Phantombuster API error:', error.response?.data || error.message);
        throw new Error('Failed to send LinkedIn message');
    }
}


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

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});