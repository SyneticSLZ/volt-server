const express = require('express');
const router = express.Router();
const emailQueueSystem = require('../queue');
const { requireDatabaseConnection } = require('../config/database');

// Middleware to ensure queue system is initialized
const requireQueueSystem = async (req, res, next) => {
    try {
        if (!emailQueueSystem.isInitialized) {
            await emailQueueSystem.initialize();
        }
        next();
    } catch (error) {
        res.status(500).json({ error: 'Queue system initialization error' });
    }
};

// Submit new campaign
router.post('/send-emails', requireDatabaseConnection, requireQueueSystem, async (req, res) => {
    const { 
        submittedData, 
        userPitch, 
        Uname, 
        myemail, 
        Template, 
        UserSubject,
        signature,
        mediaAttachments 
    } = req.body;

    try {
        const campaignData = {
            userEmail: myemail,
            template: {
                pitch: userPitch,
                name: Uname,
                subject: UserSubject,
                templateId: Template,
                signature: signature
            },
            sentEmails: submittedData.map(data => ({
                recipient: data.email,
                metadata: {
                    name: data.name,
                    website: data.website
                }
            })),
            attachments: mediaAttachments
        };

        const uploadId = uuidv4();
    tempStorage.set(uploadId, {
        metadata: req.body.attachmentMetadata,
        chunks: new Map(),
        complete: false
    });

    res.json({ uploadUrl: `/upload/${uploadId}` });

        const campaign = await emailQueueSystem.submitCampaign(campaignData);


        res.json({
            message: 'Campaign queued successfully',
            campaignId: campaign._id
        });

    } catch (error) {
        console.error('Failed to queue campaign:', error);
        res.status(500).json({
            error: 'Failed to queue campaign',
            details: error.message
        });
    }
});



// Get campaign status
router.get('/campaign-status/:campaignId', requireDatabaseConnection, async (req, res) => {
    try {
        const status = await emailQueueSystem.getCampaignStatus(req.params.campaignId);
        res.json(status);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch campaign status' });
    }
});

// Pause campaign
router.post('/campaigns/:campaignId/pause', requireDatabaseConnection, async (req, res) => {
    try {
        await emailQueueSystem.pauseCampaign(req.params.campaignId);
        res.json({ message: 'Campaign paused successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to pause campaign' });
    }
});

// Resume campaign
router.post('/campaigns/:campaignId/resume', requireDatabaseConnection, async (req, res) => {
    try {
        await emailQueueSystem.resumeCampaign(req.params.campaignId);
        res.json({ message: 'Campaign resumed successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to resume campaign' });
    }
});

// Get system status
router.get('/system-status', requireDatabaseConnection, async (req, res) => {
    try {
        const status = emailQueueSystem.getSystemStatus();
        res.json(status);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch system status' });
    }
});

module.exports = router;