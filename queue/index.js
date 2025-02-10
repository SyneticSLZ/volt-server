const campaignQueueManager = require('./campaignQueueManager');
const emailSender = require('./emailSender');
const mailboxManager = require('./mailboxManager');
const { queueEvents } = require('./config');
const { dbManager } = require('../config/database');

class EmailQueueSystem {
    constructor() {
        this.queueManager = campaignQueueManager;
        this.emailSender = emailSender;
        this.mailboxManager = mailboxManager;
        this.isInitialized = false;
    }

    async initialize() {
        if (this.isInitialized) {
            return;
        }

        try {
            // Ensure database connection
            await dbManager.connect();

            // Set up event listeners
            this.setupEventListeners();

            // Start queue manager
            await this.queueManager.start();

            this.isInitialized = true;
            console.log('Email queue system initialized successfully');

        } catch (error) {
            console.error('Failed to initialize email queue system:', error);
            throw error;
        }
    }

    setupEventListeners() {
        queueEvents.on('emailSent', this.handleEmailSent.bind(this));
        queueEvents.on('emailError', this.handleEmailError.bind(this));
        queueEvents.on('campaignComplete', this.handleCampaignComplete.bind(this));
    }

    async submitCampaign(campaignData) {
        if (!this.isInitialized) {
            throw new Error('Queue system not initialized');
        }

        try {
            // Process campaign data and start sending
            const campaign = await this.queueManager.processCampaign(campaignData);
            return campaign;

        } catch (error) {
            console.error('Error submitting campaign:', error);
            throw error;
        }
    }

    async getCampaignStatus(campaignId) {
        return await this.queueManager.getCampaignStatus(campaignId);
    }

    async pauseCampaign(campaignId) {
        return await this.queueManager.pauseCampaign(campaignId);
    }

    async resumeCampaign(campaignId) {
        return await this.queueManager.resumeCampaign(campaignId);
    }

    handleEmailSent(data) {
        console.log('Email sent successfully:', data);
    }

    handleEmailError(error) {
        console.error('Email error:', error);
    }

    handleCampaignComplete(campaignId) {
        console.log('Campaign completed:', campaignId);
    }

    async shutdown() {
        console.log('Shutting down email queue system...');
        await this.queueManager.stop();
        await dbManager.disconnect();
        this.isInitialized = false;
    }

    getSystemStatus() {
        return {
            initialized: this.isInitialized,
            queueStatus: this.queueManager.getStatus(),
            mailboxStats: this.mailboxManager.getMailboxMetrics()
        };
    }
}

// Create and export singleton instance
const emailQueueSystem = new EmailQueueSystem();
module.exports = emailQueueSystem;