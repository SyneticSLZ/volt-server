const { QUEUE_CONFIG } = require('./config');
const rateLimiter = require('./rateLimiter.js');
const { Customer } = require('../models/schemas');

class MailboxManager {
    constructor() {
        this.activeMailboxes = new Map(); // mailboxId -> mailbox state
        this.lastRotation = new Map();    // mailboxId -> last use timestamp
    }

    async getNextAvailableMailbox(userEmail) {
        const customer = await Customer.findOne({ email: userEmail });
        if (!customer) throw new Error('Customer not found');

        const activeMailboxes = customer.mailboxes.filter(m => m.isActive);
        if (!activeMailboxes.length) {
            throw new Error('No active mailboxes found');
        }

        // Try each mailbox
        for (const mailbox of activeMailboxes) {
            if (await this.isMailboxAvailable(mailbox, customer)) {
                return mailbox;
            }
        }

        return null;
    }

    async isMailboxAvailable(mailbox, customer) {
        const mailboxId = mailbox.smtp.user;
        const mailboxState = this.getMailboxState(mailboxId);

        // Check rate limits
        if (!rateLimiter.checkAndIncrement(mailboxId)) {
            return false;
        }

        // Check warmup limits
        const dailyLimit = this.calculateDailyLimit(mailboxState.warmupDays);
        if (mailboxState.dailyCount >= dailyLimit) {
            return false;
        }

        // Check minimum delay between sends
        const lastUseTime = this.lastRotation.get(mailboxId) || 0;
        const timeSinceLastUse = Date.now() - lastUseTime;
        const minDelay = this.calculateMinimumDelay(mailboxState.warmupDays);
        
        return timeSinceLastUse >= minDelay;
    }

    getMailboxState(mailboxId) {
        if (!this.activeMailboxes.has(mailboxId)) {
            this.activeMailboxes.set(mailboxId, {
                dailyCount: 0,
                warmupDays: 1,
                lastReset: this.getStartOfDay(),
                errors: 0
            });
        }

        const state = this.activeMailboxes.get(mailboxId);
        
        // Reset daily counts if needed
        if (this.shouldResetCounts(state.lastReset)) {
            state.dailyCount = 0;
            state.lastReset = this.getStartOfDay();
            state.warmupDays += 1; // Increment warmup days
        }

        return state;
    }

    calculateDailyLimit(warmupDays) {
        const { startingLimit, maxLimit, incrementPerDay } = QUEUE_CONFIG.warmup;
        return Math.min(startingLimit + (warmupDays * incrementPerDay), maxLimit);
    }

    calculateMinimumDelay(warmupDays) {
        const { minDelay, maxDelay } = QUEUE_CONFIG.delays;
        return Math.max(maxDelay - (warmupDays * 20000), minDelay);
    }

    getStartOfDay() {
        const now = new Date();
        now.setHours(0, 0, 0, 0);
        return now.getTime();
    }

    shouldResetCounts(lastReset) {
        return Date.now() > lastReset + 24 * 60 * 60 * 1000;
    }

    async updateMailboxStats(mailboxId, success = true) {
        const state = this.getMailboxState(mailboxId);
        
        if (success) {
            state.dailyCount++;
            state.errors = 0;
        } else {
            state.errors++;
        }

        this.lastRotation.set(mailboxId, Date.now());
        
        // Disable mailbox if too many errors
        if (state.errors >= 5) {
            await this.disableMailbox(mailboxId);
        }
    }

    async disableMailbox(mailboxId) {
        try {
            await Customer.updateOne(
                { 'mailboxes.smtp.user': mailboxId },
                { $set: { 'mailboxes.$.isActive': false } }
            );
            
            this.activeMailboxes.delete(mailboxId);
            this.lastRotation.delete(mailboxId);
            
            console.log(`Mailbox ${mailboxId} disabled due to errors`);
        } catch (error) {
            console.error('Error disabling mailbox:', error);
        }
    }

    getMailboxMetrics(mailboxId) {
        const state = this.getMailboxState(mailboxId);
        const rateLimits = rateLimiter.getMailboxStats(mailboxId);

        return {
            dailyCount: state.dailyCount,
            dailyLimit: this.calculateDailyLimit(state.warmupDays),
            warmupDays: state.warmupDays,
            errors: state.errors,
            rateLimits
        };
    }
}

module.exports = new MailboxManager();