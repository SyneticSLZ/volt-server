const Campaign = require('./models/queCampaign');
const Customer = require('./models/customer');
const { generateEmailContent, sendEmailWithAttachments } = require('./emailservices.js');
// const { CampaignProcessor, MailboxManager, EmailSender } = require('./CampaignProcessor');

class CampaignProcessor {
    constructor(queueManager) {
        this.queueManager = queueManager;
    }

    async processCampaignWithUserLimits(campaign, userEmail) {
        if (!this.queueManager.userCampaigns.has(userEmail)) {
            this.queueManager.userCampaigns.set(userEmail, new Set());
        }
        this.queueManager.userCampaigns.get(userEmail).add(campaign._id);

        try {
            await this.processCampaign(campaign);
        } finally {
            // Clean up tracking
            if (this.queueManager.userCampaigns.has(userEmail)) {
                this.queueManager.userCampaigns.get(userEmail).delete(campaign._id);
                if (this.queueManager.userCampaigns.get(userEmail).size === 0) {
                    this.queueManager.userCampaigns.delete(userEmail);
                }
            }
        }
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
            const batches = this.createBatches(campaign.emails, this.queueManager.batchSize);
            let processedCount = 0;
            let successCount = 0;
            let failureCount = 0;

            for (const [batchIndex, batch] of batches.entries()) {
                try {
                    const batchResults = await this.processBatch(campaign, batch);
                    
                    // Update counts
                    processedCount += batch.length;
                    successCount += batchResults.filter(r => r.success).length;
                    failureCount += batchResults.filter(r => !r.success).length;

                    // Update campaign progress
                    await this.updateCampaignProgress(campaign._id, {
                        processedCount,
                        successCount,
                        failureCount,
                        batchIndex,
                        totalBatches: batches.length
                    });

                    // Add delay between batches
                    if (batchIndex < batches.length - 1) {
                        await new Promise(resolve => setTimeout(resolve, 1000));
                    }

                } catch (batchError) {
                    console.error(`Batch ${batchIndex} failed:`, batchError);
                    this.queueManager.emit('batchError', {
                        campaignId: campaign._id,
                        batchIndex,
                        error: batchError
                    });
                }
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
            throw error;
        }
    }

    createBatches(emails, batchSize) {
        const batches = [];
        for (let i = 0; i < emails.length; i += batchSize) {
            batches.push(emails.slice(i, i + batchSize));
        }
        return batches;
    }

    async processBatch(campaign, batch) {
        const results = [];
        const customer = await Customer.findOne({ email: campaign.userEmail });
        
        if (!customer) {
            throw new Error('Customer not found');
        }

        const mailboxManager = new MailboxManager(customer.mailboxes);
        
        for (const email of batch) {
            try {
                const mailbox = await mailboxManager.getNextAvailableMailbox();
                if (!mailbox) {
                    console.log('No available mailboxes, waiting...');
                    await new Promise(resolve => setTimeout(resolve, 300000)); // 5 min
                    continue;
                }

                // Generate and send email
                const result = await this.sendSingleEmail(campaign, email, mailbox);
                results.push(result);

                // Update mailbox stats
                await mailboxManager.updateMailboxStats(mailbox);

                // Add natural delay
                const delayApplied = await this.addNaturalDelay(campaign.warmupDays);
                console.log(`Waiting ${delayApplied}ms before next email`);

            } catch (error) {
                console.error(`Failed to send email to ${email.recipient}:`, error);
                results.push({
                    success: false,
                    error: error.message,
                    recipient: email.recipient
                });
            }
        }

        return results;
    }

    async sendSingleEmail(campaign, email, mailbox) {
        try {
            // Generate content
            const content = await this.generateEmailContent({
                website: email.metadata.website,
                userPitch: campaign.template.pitch,
                Uname: campaign.template.name,
                To: email.metadata.name,
                Template: campaign.template.templateId
            });

            // Send email
            const result = await sendEmailWithAttachments(
                mailbox,
                email.recipient,
                campaign.template.subject || content.subject_line,
                content.body_content,
                campaign.template.signature,
                campaign.attachments,
                campaign.userEmail
            );

            // Update email record
            await this.updateEmailRecord(campaign._id, email.recipient, {
                subject: campaign.template.subject || content.subject_line,
                body: content.body_content,
                status: 'sent',
                sentAt: new Date(),
                messageId: result?.messageId
            });

            return {
                success: true,
                recipient: email.recipient,
                messageId: result?.messageId
            };

        } catch (error) {
            throw error;
        }
    }

    async updateEmailRecord(campaignId, recipient, data) {
        await Campaign.updateOne(
            { 
                _id: campaignId,
                'emails.recipient': recipient 
            },
            {
                $set: {
                    'emails.$': {
                        ...data,
                        recipient,
                        updatedAt: new Date()
                    }
                }
            }
        );
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
                        currentBatch: progress.batchIndex + 1,
                        totalBatches: progress.totalBatches,
                        percentage: Math.round((progress.processedCount / progress.totalBatches) * 100)
                    }
                }
            }
        );
    }

    async completeCampaign(campaignId, stats) {
        const campaign = await Campaign.findById(campaignId);
        await Campaign.updateOne(
            { _id: campaignId },
            {
                $set: {
                    status: 'completed',
                    completedAt: new Date(),
                    processedEmails: stats.processedCount,
                    successfulEmails: stats.successCount,
                    failedEmails: stats.failureCount,
                    metrics: {
                        successRate: (stats.successCount / stats.processedCount) * 100,
                        completionTime: Date.now() - campaign.startedAt
                    }
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
        try {
            // Validate warmup days
            const validWarmupDays = Math.max(1, Math.min(warmupDays || 1, 30));
            
            // Calculate base delay
            const baseDelay = this.calculateBaseDelay(validWarmupDays);
            
            // Add random jitter (up to 1 minute)
            const jitter = Math.floor(Math.random() * 60000);
            
            // Add time-of-day variation
            const timeBasedDelay = this.getTimeBasedDelay();
            
            // Combine all delays with a minimum threshold
            const totalDelay = Math.max(
                baseDelay + jitter + timeBasedDelay,
                30000 // Minimum 30 seconds
            );
    
            // Log delay for monitoring
            console.log(`Adding natural delay: ${totalDelay}ms`, {
                baseDelay,
                jitter,
                timeBasedDelay,
                warmupDays: validWarmupDays
            });
    
            // Apply the delay
            await new Promise(resolve => setTimeout(resolve, totalDelay));
    
            return totalDelay;
        } catch (error) {
            console.error('Error in addNaturalDelay:', error);
            // Fallback to minimum safe delay if something goes wrong
            await new Promise(resolve => setTimeout(resolve, 30000));
            return 30000;
        }
    }
    
    calculateBaseDelay(warmupDays) {
        // Base delay ranges from 5 minutes to 2 minutes depending on warmup
        const minDelay = 120000; // 2 minutes
        const maxDelay = 300000; // 5 minutes
        
        // Gradually decrease delay as warmup days increase
        const calculatedDelay = maxDelay - (warmupDays * 20000);
        
        // Ensure delay stays within bounds
        return Math.max(minDelay, Math.min(calculatedDelay, maxDelay));
    }
    
    getTimeBasedDelay() {
        const hour = new Date().getHours();
        
        // Add extra delay during typical off-hours
        if (hour < 6 || hour > 22) { // Between 10 PM and 6 AM
            return 180000; // Add 3 minutes
        } else if (hour < 8 || hour > 20) { // Early morning or late evening
            return 120000; // Add 2 minutes
        } else if (hour === 12 || hour === 13) { // Lunch hours
            return 60000; // Add 1 minute
        }
        
        return 0; // No additional delay during business hours
    }
    
    isWorkingHours() {
        const now = new Date();
        const hour = now.getHours();
        const dayOfWeek = now.getDay();
        
        // Check if it's weekend
        if (dayOfWeek === 0 || dayOfWeek === 6) {
            return false;
        }
        
        // Check if it's between 8 AM and 6 PM
        return hour >= 8 && hour < 18;
    }
    
    getDelayMultiplier() {
        if (!this.isWorkingHours()) {
            return 2.0; // Double the delay outside working hours
        }
        return 1.0;
    }

    async generateEmailContent(params) {
        try {
            const content = await generateEmailContent(params);
            if (!content || !content.subject_line || !content.body_content) {
                throw new Error('Failed to generate email content');
            }
            return content;
        } catch (error) {
            console.error('Error generating email content:', error);
            throw error;
        }
    }
}

// Mailbox management class
class MailboxManager {
    constructor(mailboxes) {
        this.mailboxes = mailboxes.filter(mailbox => mailbox.isActive).map(mailbox => ({
            ...mailbox.smtp,
            dailyCount: 0,
            lastSendTime: null,
            warmupDays: mailbox.warmupDays || 1
        }));
        this.currentIndex = 0;
    }

    async getNextAvailableMailbox() {
        const now = new Date();
        const midnight = new Date(now);


        midnight.setHours(0, 0, 0, 0);

        // Reset daily counts if it's a new day
        if (now > midnight) {
            this.mailboxes.forEach(mailbox => {
                mailbox.dailyCount = 0;
            });
        }

        // Try each mailbox
        for (let i = 0; i < this.mailboxes.length; i++) {
            this.currentIndex = (this.currentIndex + 1) % this.mailboxes.length;
            const mailbox = this.mailboxes[this.currentIndex];
            const dailyLimit = this.getDailyLimit(mailbox.warmupDays);

            if (this.isMailboxAvailable(mailbox, dailyLimit, now)) {
                return mailbox;
            }
        }

        return null;
    }

    isMailboxAvailable(mailbox, dailyLimit, now) {
        return mailbox.dailyCount < dailyLimit && 
               (!mailbox.lastSendTime || 
                (now - mailbox.lastSendTime) > this.getMinimumDelay(mailbox.warmupDays));
    }

    getDailyLimit(warmupDays) {
        const baseLimit = 20;
        const maxLimit = 100;
        return Math.min(baseLimit + (warmupDays * 10), maxLimit);
    }

    getMinimumDelay(warmupDays) {
        const minDelay = 120000; // 2 minutes
        const maxDelay = 300000; // 5 minutes
        return Math.max(maxDelay - (warmupDays * 20000), minDelay);
    }

    async updateMailboxStats(mailbox) {
        mailbox.dailyCount++;
        mailbox.lastSendTime = new Date();
        
        // Update warmup days if needed
        if (!mailbox.warmupStart) {
            mailbox.warmupStart = new Date();
        }
        mailbox.warmupDays = Math.ceil((new Date() - mailbox.warmupStart) / (1000 * 60 * 60 * 24));
    }
}

// Email sending wrapper
class EmailSender {
    constructor(campaign, mailbox) {
        this.campaign = campaign;
        this.mailbox = mailbox;
    }

    async sendEmail(recipient, subject, body) {
        let retries = 0;
        const maxRetries = 3;

        while (retries < maxRetries) {
            try {
                const result = await sendEmailWithAttachments(
                    this.mailbox,
                    recipient,
                    subject,
                    body,
                    this.campaign.template.signature,
                    this.campaign.attachments,
                    this.campaign.userEmail
                );

                // Return success result
                return {
                    success: true,
                    messageId: result.messageId,
                    sentAt: new Date()
                };

            } catch (error) {
                retries++;
                console.error(`Email send attempt ${retries} failed:`, error);

                if (retries === maxRetries) {
                    throw new Error(`Failed to send email after ${maxRetries} attempts: ${error.message}`);
                }

                // Wait before retrying
                await new Promise(resolve => setTimeout(resolve, 5000 * retries));
            }
        }
    }

    async validateAndPrepareAttachments(attachments) {
        if (!attachments || !Array.isArray(attachments)) {
            return [];
        }

        return attachments.map(att => ({
            filename: att.filename,
            contentType: att.contentType || this.getContentType(att.filename),
            content: att.data,
            size: att.size || Buffer.from(att.data, 'base64').length
        }));
    }

    getContentType(filename) {
        const ext = filename.split('.').pop().toLowerCase();
        const contentTypes = {
            'pdf': 'application/pdf',
            'doc': 'application/msword',
            'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'jpg': 'image/jpeg',
            'jpeg': 'image/jpeg',
            'png': 'image/png',
            'gif': 'image/gif'
        };
        return contentTypes[ext] || 'application/octet-stream';
    }
}

module.exports = {
    CampaignProcessor,
    MailboxManager,
    EmailSender
};