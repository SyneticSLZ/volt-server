const { RATE_LIMITS } = require('./config');

class RateLimiter {
    constructor() {
        this.counters = new Map();
        this.resetTimers();
    }

    resetTimers() {
        this.counters.clear();
        
        // Initialize counters
        this.counters.set('second', { count: 0, reset: Date.now() + 1000 });
        this.counters.set('minute', { count: 0, reset: Date.now() + 60000 });
        this.counters.set('hour', { count: 0, reset: Date.now() + 3600000 });
        this.counters.set('day', { count: 0, reset: this.getEndOfDay() });
    }

    getEndOfDay() {
        const now = new Date();
        const endOfDay = new Date(now);
        endOfDay.setHours(23, 59, 59, 999);
        return endOfDay.getTime();
    }

    checkAndIncrement(mailboxId) {
        const now = Date.now();
        let canSend = true;

        // Check and reset counters if needed
        for (const [timeframe, counter] of this.counters.entries()) {
            if (now >= counter.reset) {
                counter.count = 0;
                counter.reset = now + this.getResetTime(timeframe);
            }

            // Check if sending would exceed limits
            if (counter.count >= this.getLimit(timeframe)) {
                canSend = false;
                break;
            }
        }

        if (canSend) {
            // Increment all counters
            for (const counter of this.counters.values()) {
                counter.count++;
            }
            return true;
        }

        return false;
    }

    getResetTime(timeframe) {
        switch(timeframe) {
            case 'second': return 1000;
            case 'minute': return 60000;
            case 'hour': return 3600000;
            case 'day': return this.getEndOfDay() - Date.now();
            default: return 0;
        }
    }

    getLimit(timeframe) {
        switch(timeframe) {
            case 'second': return RATE_LIMITS.perSecond;
            case 'minute': return RATE_LIMITS.perMinute;
            case 'hour': return RATE_LIMITS.perHour;
            case 'day': return RATE_LIMITS.perDay;
            default: return 0;
        }
    }

    async waitForAvailability(mailboxId) {
        return new Promise(resolve => {
            const check = () => {
                if (this.checkAndIncrement(mailboxId)) {
                    resolve();
                } else {
                    setTimeout(check, 1000); // Check again in 1 second
                }
            };
            check();
        });
    }

    getMailboxStats(mailboxId) {
        return {
            currentRates: Object.fromEntries(
                Array.from(this.counters.entries()).map(([timeframe, counter]) => [
                    timeframe,
                    {
                        count: counter.count,
                        remaining: this.getLimit(timeframe) - counter.count,
                        resetIn: counter.reset - Date.now()
                    }
                ])
            )
        };
    }
}

module.exports = new RateLimiter();