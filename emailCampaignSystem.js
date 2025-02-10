const CampaignQueueManager = require('./CampaignQueueManager');
const { CampaignProcessor, MailboxManager, EmailSender } = require('./CampaignProcessor');
const Campaign = require('./models/queCampaign');

class EmailCampaignSystem {
    constructor(options = {}) {
        this.queueManager = new CampaignQueueManager(options);
        this.processor = new CampaignProcessor(this.queueManager);
        
        // Set up event handlers
        this.setupEventHandlers();
        
        // Initialize monitoring
        this.setupMonitoring();
    }

    setupEventHandlers() {
        // Queue manager events
        this.queueManager.on('started', () => {
            console.log('Campaign queue manager started');
        });

        this.queueManager.on('stopped', (error) => {
            console.log('Campaign queue manager stopped', error || '');
        });

        this.queueManager.on('error', (error) => {
            console.error('Campaign queue manager error:', error);
        });

        this.queueManager.on('statsUpdated', (stats) => {
            console.log('Queue stats updated:', stats);
        });
    }

    setupMonitoring() {
        // Monitor queue health every 5 minutes
        setInterval(() => {
            const status = this.queueManager.getStatus();
            console.log('Queue system status:', status);
            
            // Alert if there are issues
            if (status.lastError) {
                console.error('Queue system error detected:', status.lastError);
            }
        }, 5 * 60 * 1000);
    }

    async start() {
        try {
            console.log('Starting email campaign system...');
            await this.queueManager.start();
        } catch (error) {
            console.error('Failed to start email campaign system:', error);
            throw error;
        }
    }

    async stop() {
        try {
            console.log('Stopping email campaign system...');
            await this.queueManager.stop();
        } catch (error) {
            console.error('Error stopping email campaign system:', error);
            throw error;
        }
    }

    // API methods for external use
    async submitCampaign(campaignData) {
        try {
            const campaign = await this.createCampaign(campaignData);
            return campaign;
        } catch (error) {
            console.error('Error submitting campaign:', error);
            throw error;
        }
    }

    async createCampaign(campaignData) {
        try {
            // Validate required fields
            if (!campaignData.userEmail || !campaignData.emails || campaignData.emails.length === 0) {
                throw new Error('Invalid campaign data: userEmail and emails are required');
            }
    
            const newCampaign = new Campaign({
                userEmail: campaignData.userEmail,
                template: {
                    pitch: campaignData.pitch || '',
                    name: campaignData.name || '',
                    subject: campaignData.subject || '',
                    templateId: campaignData.templateId || '',
                    signature: campaignData.signature || ''
                },
                emails: campaignData.emails.map(email => ({
                    recipient: email.recipient,
                    metadata: email.metadata || {},
                    status: 'pending'
                })),
                attachments: campaignData.attachments || [],
                scheduledFor: campaignData.scheduledFor || new Date(),
                warmupDays: campaignData.warmupDays || 1,
                status: 'pending',
                totalEmails: campaignData.emails.length
            });
    
            return await newCampaign.save();
        } catch (error) {
            console.error('Error creating campaign:', error);
            throw error;
        }
    }

    async getCampaignStatus(campaignId) {
        try {
            const campaign = await Campaign.findById(campaignId);
            if (!campaign) {
                throw new Error('Campaign not found');
            }
            return {
                id: campaign._id,
                status: campaign.status,
                progress: {
                    processed: campaign.processedEmails,
                    successful: campaign.successfulEmails,
                    failed: campaign.failedEmails,
                    total: campaign.totalEmails
                },
                timing: {
                    created: campaign.createdAt,
                    started: campaign.startedAt,
                    completed: campaign.completedAt
                },
                error: campaign.error
            };
        } catch (error) {
            console.error('Error getting campaign status:', error);
            throw error;
        }
    }

    async pauseCampaign(campaignId) {
        try {
            await Campaign.updateOne(
                { _id: campaignId },
                { $set: { status: 'paused' } }
            );
            return { success: true, message: 'Campaign paused successfully' };
        } catch (error) {
            console.error('Error pausing campaign:', error);
            throw error;
        }
    }

    async resumeCampaign(campaignId) {
        try {
            await Campaign.updateOne(
                { _id: campaignId },
                { $set: { status: 'pending' } }
            );
            return { success: true, message: 'Campaign resumed successfully' };
        } catch (error) {
            console.error('Error resuming campaign:', error);
            throw error;
        }
    }

    async getSystemStatus() {
        return this.queueManager.getStatus();
    }
}

// Create and export singleton instance
const emailCampaignSystem = new EmailCampaignSystem({
    maxConcurrentCampaigns: 15,
    maxCampaignsPerUser: 3,
    batchSize: 10,
    retryAttempts: 3
});

module.exports = emailCampaignSystem;

// Usage in your main application:
/*
const emailCampaignSystem = require('./emailCampaignSystem');

// Start the system when your app starts
app.listen(port, async () => {
    console.log(`Server is running on port ${port}`);
    await emailCampaignSystem.start();
});

// Handle graceful shutdown
process.on('SIGTERM', async () => {
    console.log('Received SIGTERM signal');
    await emailCampaignSystem.stop();
    process.exit(0);
});
*/