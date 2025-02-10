const pLimit = require('p-limit');
const { EventEmitter } = require('events');
const Campaign = require('./models/queCampaign'); // Adjust the path to where your Campaign model is defined
const { CampaignProcessor, MailboxManager, EmailSender } = require('./CampaignProcessor');
const campaignProcessor = new CampaignProcessor(this);


class CampaignQueueManager extends EventEmitter {
    constructor(options = {}) {
        super();
        
        // Configuration
        this.maxConcurrentCampaigns = options.maxConcurrentCampaigns || 15;
        this.maxCampaignsPerUser = options.maxCampaignsPerUser || 3;
        this.batchSize = options.batchSize || 10;
        this.retryAttempts = options.retryAttempts || 3;
        this.retryDelay = options.retryDelay || 5000;

        // Initialize limits
        this.globalLimit = pLimit(this.maxConcurrentCampaigns);
        
        // State tracking
        this.userCampaigns = new Map(); // userId -> Set of active campaign IDs
        this.activeWorkers = new Map();  // campaignId -> Worker
        this.isProcessing = false;
        this.lastError = null;

        // Statistics
        this.stats = {
            totalProcessed: 0,
            totalSuccessful: 0,
            totalFailed: 0,
            activeUsers: 0
        };

        // Bind methods
        this.start = this.start.bind(this);
        this.stop = this.stop.bind(this);
        // this.processCampaign = this.processCampaign.bind(this);
        this.getUserActiveCampaignCount = this.getUserActiveCampaignCount.bind(this);

        // Set up error handling
        this.on('error', this.handleError.bind(this));
    }

    handleError(error) {
        this.lastError = error;
        console.error('Campaign Queue Manager Error:', error);
        // Emit for external error handling
        this.emit('managerError', error);
    }

    getUserActiveCampaignCount(userEmail) {
        return this.userCampaigns.get(userEmail)?.size || 0;
    }

    async start() {
        if (this.isProcessing) {
            console.log('Queue manager already running');
            return;
        }

        console.log('Starting campaign queue manager...');
        this.isProcessing = true;
        this.emit('started');

        try {
            while (this.isProcessing) {
                await this.processQueueCycle();
                // Small delay between cycles to prevent CPU hogging
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        } catch (error) {
            this.handleError(error);
            this.isProcessing = false;
            this.emit('stopped', error);
        }
    }

    async processCampaignWithUserLimits(campaign, userEmail) {
        if (!this.userCampaigns.has(userEmail)) {
            this.userCampaigns.set(userEmail, new Set());
        }
        this.userCampaigns.get(userEmail).add(campaign._id);
    
        try {
            // You'll need to import or define a campaign processor
            await campaignProcessor.processCampaign(campaign);
            this.stats.totalSuccessful++;
        } catch (error) {
            this.stats.totalFailed++;
            this.handleError(error);
        } finally {
            // Clean up tracking
            if (this.userCampaigns.has(userEmail)) {
                this.userCampaigns.get(userEmail).delete(campaign._id);
                if (this.userCampaigns.get(userEmail).size === 0) {
                    this.userCampaigns.delete(userEmail);
                }
            }
        }
    }

    async processQueueCycle() {
        try {
            // Get pending campaigns with user info
            const pendingCampaigns = await this.getPendingCampaigns();

            if (pendingCampaigns.length === 0) {
                await new Promise(resolve => setTimeout(resolve, 5000));
                return;
            }

            // Group campaigns by user for fair processing
            const campaignsByUser = this.groupCampaignsByUser(pendingCampaigns);
            
            // Process each user's campaigns
            const processingPromises = [];
            for (const [userEmail, campaigns] of campaignsByUser) {
                const userPromises = this.processUserCampaigns(userEmail, campaigns);
                processingPromises.push(...userPromises);
            }

            // Wait for current batch to complete
            await Promise.all(processingPromises);

            // Update stats
            this.updateStats();

        } catch (error) {
            this.handleError(error);
        }
    }

    async getPendingCampaigns() {
        try {
            return await Campaign.aggregate([
                { 
                    $match: { 
                        status: 'pending',
                        // Don't process campaigns scheduled for the future
                        $or: [
                            { scheduledFor: { $exists: false } },
                            { scheduledFor: { $lte: new Date() } }
                        ]
                    } 
                },
                { 
                    $lookup: {
                        from: 'customers',
                        localField: 'userEmail',
                        foreignField: 'email',
                        as: 'user'
                    }
                },
                { $sort: { createdAt: 1 } },
                { $limit: this.maxConcurrentCampaigns * 2 } // Get extra for buffer
            ]);
        } catch (error) {
            this.handleError(error);
            return [];
        }
    }

    groupCampaignsByUser(campaigns) {
        const campaignsByUser = new Map();
        campaigns.forEach(campaign => {
            const userEmail = campaign.userEmail;
            if (!campaignsByUser.has(userEmail)) {
                campaignsByUser.set(userEmail, []);
            }
            campaignsByUser.get(userEmail).push(campaign);
        });
        return campaignsByUser;
    }

    processUserCampaigns(userEmail, campaigns) {
        const activeCount = this.getUserActiveCampaignCount(userEmail);
        const availableSlots = this.maxCampaignsPerUser - activeCount;
        
        if (availableSlots <= 0) return [];

        const campaignsToProcess = campaigns.slice(0, availableSlots);
        return campaignsToProcess.map(campaign => 
            this.globalLimit(() => this.processCampaignWithUserLimits(campaign, userEmail))
        );
    }

    updateStats() {
        this.stats.activeUsers = this.userCampaigns.size;
        this.emit('statsUpdated', this.stats);
    }

    stop() {
        console.log('Stopping campaign queue manager...');
        this.isProcessing = false;
        
        // Clean up workers
        for (const [campaignId, worker] of this.activeWorkers) {
            worker.terminate();
            this.activeWorkers.delete(campaignId);
        }

        // Clear tracking maps
        this.userCampaigns.clear();
        
        this.emit('stopped');
    }

    getStatus() {
        return {
            isProcessing: this.isProcessing,
            activeUsers: this.userCampaigns.size,
            activeCampaigns: this.activeWorkers.size,
            stats: { ...this.stats },
            lastError: this.lastError?.message
        };
    }
}



module.exports = CampaignQueueManager;