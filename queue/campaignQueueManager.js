const { EventEmitter } = require('events');
const { QUEUE_CONFIG, queueEvents } = require('./config');
const mailboxManager = require('./mailboxManager');
const emailSender = require('./emailSender.js');
const { Customer, Campaign } = require('../models/schemas');

class CampaignQueueManager extends EventEmitter {
    constructor() {
        super();
        this.isProcessing = false;
        this.activeWorkers = new Map();
        this.userCampaigns = new Map();
        this.batchSize = QUEUE_CONFIG.batchSize;
        this.setupEventListeners();
    }

    setupEventListeners() {
        queueEvents.on('campaignComplete', this.handleCampaignComplete.bind(this));
        queueEvents.on('campaignError', this.handleCampaignError.bind(this));
        queueEvents.on('emailSent', this.handleEmailSent.bind(this));
    }

    async start() {
        if (this.isProcessing) {
            console.log('Queue manager already running');
            return;
        }

        console.log('Starting campaign queue manager...');
        this.isProcessing = true;

        try {
            while (this.isProcessing) {
                await this.processQueueCycle();
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        } catch (error) {
            console.error('Queue processing error:', error);
            this.isProcessing = false;
        }
    }

    async processQueueCycle() {
        try {
            const pendingCampaigns = await this.getPendingCampaigns();
            
            if (pendingCampaigns.length === 0) {
                await new Promise(resolve => setTimeout(resolve, 5000));
                return;
            }

            const campaignsByUser = this.groupCampaignsByUser(pendingCampaigns);
            const processingPromises = [];

            for (const [userEmail, campaigns] of campaignsByUser) {
                const userPromises = this.processUserCampaigns(userEmail, campaigns);
                processingPromises.push(...userPromises);
            }

            await Promise.all(processingPromises);

        } catch (error) {
            console.error('Error in queue cycle:', error);
        }
    }

    async getPendingCampaigns() {
        return await Campaign.find({
            status: 'pending',
            $or: [
                { scheduledFor: { $exists: false } },
                { scheduledFor: { $lte: new Date() } }
            ]
        }).sort({ createdTime: 1 }).limit(QUEUE_CONFIG.maxConcurrentCampaigns * 2);
    }

    groupCampaignsByUser(campaigns) {
        const campaignsByUser = new Map();
        campaigns.forEach(campaign => {
            if (!campaignsByUser.has(campaign.userEmail)) {
                campaignsByUser.set(campaign.userEmail, []);
            }
            campaignsByUser.get(campaign.userEmail).push(campaign);
        });
        return campaignsByUser;
    }

    processUserCampaigns(userEmail, campaigns) {
        const activeCount = this.getUserActiveCampaignCount(userEmail);
        const availableSlots = QUEUE_CONFIG.maxCampaignsPerUser - activeCount;
        
        if (availableSlots <= 0) return [];

        const campaignsToProcess = campaigns.slice(0, availableSlots);
        return campaignsToProcess.map(campaign => 
            this.processCampaign(campaign)
        );
    }

    async processCampaign(campaign) {
        try {
            // Mark campaign as processing
            await Campaign.updateOne(
                { _id: campaign._id },
                { 
                    $set: { 
                        status: 'processing',
                        startedAt: new Date()
                    }
                }
            );

            // Process in batches
            const batches = this.createBatches(campaign.sentEmails, this.batchSize);
            let processedCount = 0;
            let successCount = 0;
            let failureCount = 0;

            for (const batch of batches) {
                const batchResults = await this.processBatch(campaign, batch);
                
                processedCount += batch.length;
                successCount += batchResults.filter(r => r.success).length;
                failureCount += batchResults.filter(r => !r.success).length;

                // Update progress
                await this.updateCampaignProgress(campaign._id, {
                    processedCount,
                    successCount,
                    failureCount,
                    totalEmails: campaign.sentEmails.length
                });

                // Add delay between batches
                await new Promise(resolve => setTimeout(resolve, 1000));
            }

            // Mark campaign as completed
            await this.completeCampaign(campaign._id, {
                processedCount,
                successCount,
                failureCount
            });

        } catch (error) {
            console.error(`Campaign ${campaign._id} failed:`, error);
            await this.failCampaign(campaign._id, error);
        }
    }

    async processBatch(campaign, batch) {
        const results = [];
        
        for (const email of batch) {
            try {
                const mailbox = await mailboxManager.getNextAvailableMailbox(campaign.userEmail);
                if (!mailbox) {
                    console.log('No available mailboxes, waiting...');
                    await new Promise(resolve => setTimeout(resolve, 300000));
                    continue;
                }

                const result = await emailSender.sendCampaignEmail(campaign, email, mailbox);
                results.push(result);

                // Update mailbox stats
                await mailboxManager.updateMailboxStats(mailbox.smtp.user, true);

                // Add natural delay
                await this.addNaturalDelay(mailbox.warmupDays);

            } catch (error) {
                console.error(`Failed to send email to ${email.recipient}:`, error);
                results.push({
                    success: false,
                    error: error.message
                });
            }
        }

        return results;
    }

    createBatches(emails, batchSize) {
        const batches = [];
        for (let i = 0; i < emails.length; i += batchSize) {
            batches.push(emails.slice(i, i + batchSize));
        }
        return batches;
    }

    async updateCampaignProgress(campaignId, progress) {
        await Campaign.updateOne(
            { _id: campaignId },
            {
                $set: {
                    processedEmails: progress.processedCount,
                    successfulEmails: progress.successCount,
                    failedEmails: progress.failureCount,
                    lastProcessedAt: new Date(),
                    progress: {
                        percentage: Math.round((progress.processedCount / progress.totalEmails) * 100)
                    }
                }
            }
        );
    }

    async completeCampaign(campaignId, stats) {
        await Campaign.updateOne(
            { _id: campaignId },
            {
                $set: {
                    status: 'completed',
                    completedAt: new Date(),
                    processedEmails: stats.processedCount,
                    successfulEmails: stats.successCount,
                    failedEmails: stats.failureCount
                }
            }
        );
    }

    async failCampaign(campaignId, error) {
        await Campaign.updateOne(
            { _id: campaignId },
            {
                $set: {
                    status: 'failed',
                    error: error.message,
                    failedAt: new Date()
                }
            }
        );
    }

    async addNaturalDelay(warmupDays) {
        const baseDelay = Math.max(
            QUEUE_CONFIG.delays.maxDelay - (warmupDays * 20000),
            QUEUE_CONFIG.delays.minDelay
        );
        const jitter = Math.floor(Math.random() * 60000);
        await new Promise(resolve => setTimeout(resolve, baseDelay + jitter));
    }

    getUserActiveCampaignCount(userEmail) {
        return this.userCampaigns.get(userEmail)?.size || 0;
    }

    handleCampaignComplete(campaignId) {
        // Cleanup after campaign completion
        this.activeWorkers.delete(campaignId);
    }

    handleCampaignError(campaignId, error) {
        console.error(`Campaign ${campaignId} error:`, error);
    }

    handleEmailSent(data) {
        queueEvents.emit('emailSent', data);
    }

    stop() {
        console.log('Stopping campaign queue manager...');
        this.isProcessing = false;
        this.activeWorkers.clear();
        this.userCampaigns.clear();
    }

    getStatus() {
        return {
            isProcessing: this.isProcessing,
            activeCampaigns: this.activeWorkers.size,
            activeUsers: this.userCampaigns.size,
            queueStats: {
                pendingCampaigns: 0, // You can add actual count here
                processedToday: 0    // You can add actual count here
            }
        };
    }
}

module.exports = new CampaignQueueManager();