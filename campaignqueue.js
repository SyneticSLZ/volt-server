// CampaignQueue.js
class CampaignQueue {
    constructor() {
        this.queue = new Map(); // Map of campaignId -> campaign data
        this.processing = new Set(); // Set of currently processing campaign IDs
        this.maxConcurrent = 3; // Maximum number of concurrent campaigns
    }

    // Add a new campaign to the queue
    async addCampaign(campaignData) {
        const { campaignId, emails, userPitch, userName, token, userEmail, template } = campaignData;
        
        this.queue.set(campaignId, {
            campaignId,
            emails,
            userPitch,
            userName,
            token,
            userEmail,
            template,
            status: 'queued',
            progress: 0,
            totalEmails: emails.length,
            sentEmails: 0,
            failedEmails: [],
            lastProcessed: null,
            mailboxIndex: 0
        });

        // Try to process campaigns if slots are available
        this.processNextCampaigns();
    }

    // Process next campaigns if slots available
    async processNextCampaigns() {
        while (this.processing.size < this.maxConcurrent && this.queue.size > 0) {
            // Get next queued campaign
            const nextCampaign = Array.from(this.queue.values())
                .find(campaign => campaign.status === 'queued');
            
            if (!nextCampaign) break;

            // Start processing campaign
            this.processing.add(nextCampaign.campaignId);
            nextCampaign.status = 'processing';
            
            this.processCampaign(nextCampaign).catch(error => {
                console.error(`Error processing campaign ${nextCampaign.campaignId}:`, error);
            });
        }
    }

    // Process a single campaign
    async processCampaign(campaign) {
        try {
            const customer = await Customer.findOne({ email: campaign.userEmail });
            if (!customer) {
                throw new Error('Customer not found');
            }

            const activeMailboxes = customer.mailboxes
                .filter(mailbox => mailbox.isActive)
                .map(mailbox => ({
                    ...mailbox.smtp,
                    dailyCount: 0,
                    lastSendTime: null
                }));

            if (!activeMailboxes.length) {
                throw new Error('No active mailboxes found');
            }

            for (const [index, email] of campaign.emails.entries()) {
                if (campaign.status === 'paused' || campaign.status === 'cancelled') {
                    break;
                }

                try {
                    // Get next available mailbox
                    const mailbox = await this.getNextAvailableMailbox(activeMailboxes, campaign.mailboxIndex);
                    if (!mailbox) {
                        // Wait and try again if no mailbox is available
                        await new Promise(resolve => setTimeout(resolve, 60000));
                        continue;
                    }

                    // Generate email content
                    const emailContent = await this.generateEmailContent({
                        website: email.website,
                        userPitch: campaign.userPitch,
                        userName: campaign.userName,
                        to: email.name,
                        template: campaign.template
                    });

                    // Send email
                    await sendcampsummaryEmail({
                        to: email.email,
                        email: campaign.userEmail,
                        subject: emailContent.subject,
                        body: emailContent.body,
                        user: mailbox.user,
                        pass: mailbox.pass,
                        service: 'gmail',
                        campaignId: campaign.campaignId
                    });

                    // Update campaign progress
                    campaign.sentEmails++;
                    campaign.progress = (campaign.sentEmails / campaign.totalEmails) * 100;
                    campaign.lastProcessed = new Date();
                    
                    // Update mailbox stats
                    mailbox.dailyCount++;
                    mailbox.lastSendTime = new Date();
                    
                    // Add random delay between emails
                    const delay = this.calculateDelay(mailbox.warmupDays || 1);
                    await new Promise(resolve => setTimeout(resolve, delay));

                } catch (error) {
                    campaign.failedEmails.push({
                        email: email.email,
                        error: error.message,
                        timestamp: new Date()
                    });
                    console.error(`Error sending to ${email.email}:`, error);
                }
            }

            // Campaign completed
            campaign.status = 'completed';
            this.processing.delete(campaign.campaignId);
            this.queue.delete(campaign.campaignId);

            // Process next campaigns
            this.processNextCampaigns();

        } catch (error) {
            campaign.status = 'failed';
            this.processing.delete(campaign.campaignId);
            throw error;
        }
    }

    // Get next available mailbox considering rate limits
    async getNextAvailableMailbox(mailboxes, currentIndex) {
        const now = new Date();
        const midnight = new Date(now);
        midnight.setHours(0, 0, 0, 0);

        // Reset daily counts if it's a new day
        if (now > midnight) {
            mailboxes.forEach(mailbox => {
                mailbox.dailyCount = 0;
            });
        }

        // Try each mailbox starting from the current index
        for (let i = 0; i < mailboxes.length; i++) {
            const index = (currentIndex + i) % mailboxes.length;
            const mailbox = mailboxes[index];
            
            const dailyLimit = this.getDailyLimit(mailbox.warmupDays || 1);
            const minDelay = this.getMinimumDelay(mailbox.warmupDays || 1);

            if (mailbox.dailyCount < dailyLimit && 
                (!mailbox.lastSendTime || (now - mailbox.lastSendTime > minDelay))) {
                return mailbox;
            }
        }

        return null;
    }

    // Calculate daily limit based on warmup period
    getDailyLimit(warmupDays) {
        const baseLimit = 20;
        const maxLimit = 100;
        return Math.min(baseLimit + (warmupDays * 10), maxLimit);
    }

    // Calculate minimum delay between emails
    getMinimumDelay(warmupDays) {
        const minDelay = 120000; // 2 minutes
        const maxDelay = 300000; // 5 minutes
        return Math.max(maxDelay - (warmupDays * 20000), minDelay);
    }

    // Add randomness to delays
    calculateDelay(warmupDays) {
        const baseDelay = this.getMinimumDelay(warmupDays);
        const jitter = Math.floor(Math.random() * 60000); // Up to 1 minute of randomness
        return baseDelay + jitter;
    }

    // Campaign management methods
    pauseCampaign(campaignId) {
        const campaign = this.queue.get(campaignId);
        if (campaign) {
            campaign.status = 'paused';
        }
    }

    resumeCampaign(campaignId) {
        const campaign = this.queue.get(campaignId);
        if (campaign && campaign.status === 'paused') {
            campaign.status = 'queued';
            this.processNextCampaigns();
        }
    }

    cancelCampaign(campaignId) {
        const campaign = this.queue.get(campaignId);
        if (campaign) {
            campaign.status = 'cancelled';
            this.processing.delete(campaignId);
            this.queue.delete(campaignId);
        }
    }

    getCampaignStatus(campaignId) {
        return this.queue.get(campaignId) || null;
    }

    getAllCampaignStatuses() {
        return Array.from(this.queue.values());
    }
}

// Create a singleton instance
const campaignQueue = new CampaignQueue();
module.exports = campaignQueue;