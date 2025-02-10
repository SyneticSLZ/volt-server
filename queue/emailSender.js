const { ERROR_TYPES, ERROR_HANDLING } = require('./config');
const mailboxManager = require('./mailboxManager');
const { Customer, EData } = require('../models/schemas');

class EmailSender {
    constructor() {
        this.retryMap = new Map();
    }

    async sendCampaignEmail(campaign, email, mailbox) {
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
            const result = await this.sendEmail(
                mailbox,
                email.recipient,
                campaign.template.subject || content.subject_line,
                content.body_content,
                campaign.template.signature,
                campaign.attachments,
                campaign.userEmail
            );

            // Create EData record
            const eData = new EData({
                id: result.messageId,
                recipient: email.recipient,
                from: mailbox.smtp.user,
                UUID: result.UUID,
                threadId: result.threadId,
                body: content.body_content,
                subject: campaign.template.subject || content.subject_line,
                date: new Date().toISOString(),
                sentwith: mailbox.smtp.gmail ? 'gmail' : 'mailjet',
                status: 'delivered',
                customID: result.customID
            });

            await eData.save();

            // Update customer record
            await Customer.updateOne(
                { email: campaign.userEmail },
                { 
                    $push: { emails: eData },
                    $inc: { total_emails: 1 }
                }
            );

            return {
                success: true,
                messageId: result.messageId,
                eData: eData
            };

        } catch (error) {
            const errorType = this.categorizeError(error);
            const handling = ERROR_HANDLING[errorType];

            if (this.shouldRetry(email.recipient, errorType, handling)) {
                await this.scheduleRetry(campaign, email, handling.retryAfter);
            }

            throw error;
        }
    }

    async generateEmailContent(params) {
        try {
            const thread = await openai.beta.threads.create();
            
            await openai.beta.threads.messages.create(thread.id, {
                role: "user",
                content: `
                    Using this data: ${params.website}, create a personalized email.
                    User pitch: ${params.userPitch}
                    Sender name: ${params.Uname}
                    Recipient name: ${params.To}
                    Template style: ${params.Template}
                `
            });

            const run = await openai.beta.threads.runs.create(thread.id, {
                assistant_id: process.env.ASSISTANT_ID
            });

            // Wait for completion
            const content = await this.waitForCompletion(thread.id, run.id);
            
            return this.parseGeneratedContent(content);

        } catch (error) {
            console.error('Error generating email content:', error);
            throw error;
        }
    }

    async waitForCompletion(threadId, runId) {
        const maxAttempts = 30;
        let attempts = 0;

        while (attempts < maxAttempts) {
            const run = await openai.beta.threads.runs.retrieve(threadId, runId);
            
            if (run.status === 'completed') {
                const messages = await openai.beta.threads.messages.list(threadId);
                return messages.data[0].content[0].text.value;
            }

            if (run.status === 'failed') {
                throw new Error('Content generation failed');
            }

            attempts++;
            await new Promise(resolve => setTimeout(resolve, 1000));
        }

        throw new Error('Content generation timeout');
    }

    parseGeneratedContent(content) {
        const lines = content.split('\n');
        return {
            subject_line: lines[0].replace('Subject:', '').trim(),
            body_content: lines.slice(1).join('\n').trim()
        };
    }

    async sendEmail(mailbox, to, subject, body, signature, attachments, userEmail) {
        if (mailbox.smtp.gmail) {
            return this.sendGmailEmail(mailbox, to, subject, body, signature, attachments);
        } else {
            return this.sendMailjetEmail(mailbox, to, subject, body, signature, attachments);
        }
    }

    async sendGmailEmail(mailbox, to, subject, body, signature, attachments) {
        // Your existing Gmail sending logic here
        // Return format: { messageId, threadId }
    }

    async sendMailjetEmail(mailbox, to, subject, body, signature, attachments) {
        // Your existing Mailjet sending logic here
        // Return format: { messageId, UUID, customID }
    }

    categorizeError(error) {
        if (error.response?.status === 429) return ERROR_TYPES.RATE_LIMIT;
        if (error.response?.status === 401) return ERROR_TYPES.AUTH_ERROR;
        if (error.code === 'ECONNREFUSED') return ERROR_TYPES.NETWORK_ERROR;
        if (error.message.includes('mailbox')) return ERROR_TYPES.MAILBOX_ERROR;
        return ERROR_TYPES.RECIPIENT_ERROR;
    }

    shouldRetry(recipient, errorType, handling) {
        const retryCount = this.retryMap.get(recipient) || 0;
        return retryCount < handling.maxRetries;
    }

    async scheduleRetry(campaign, email, delay) {
        const retryCount = (this.retryMap.get(email.recipient) || 0) + 1;
        this.retryMap.set(email.recipient, retryCount);

        // Schedule retry
        setTimeout(async () => {
            try {
                const mailbox = await mailboxManager.getNextAvailableMailbox(campaign.userEmail);
                if (mailbox) {
                    await this.sendCampaignEmail(campaign, email, mailbox);
                }
            } catch (error) {
                console.error('Retry failed:', error);
            }
        }, delay);
    }
}

module.exports = new EmailSender();