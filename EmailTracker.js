

const nodemailer = require('nodemailer');
const simpleParser = require('mailparser').simpleParser;
const imap = require('imap');

class EmailTracker {
    constructor(options = {}) {
      // Default configuration with optional overrides
      this.config = {
        tracking: {
          enabled: true,
          prefix: 'track',
          headerName: 'X-Tracking-ID'
        },
        smtp: options.smtp || null,
        imap: options.imap || null,
        logger: options.logger || console
      };
    }
  
    /**
     * Generate a unique tracking ID
     * @returns {string} Tracking identifier
     */
    generateTrackingId() {
      return `${this.config.tracking.prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }
  
    /**
     * Enhance email options with tracking information
     * @param {Object} mailOptions - Original mail options
     * @returns {Object} Enhanced mail options
     */
    addTrackingToEmail(mailOptions) {
      if (!this.config.tracking.enabled) return mailOptions;
  
      const trackingId = this.generateTrackingId();
      
      return {
        ...mailOptions,
        headers: {
          ...mailOptions.headers,
          [this.config.tracking.headerName]: trackingId
        },
        trackingId // Attach tracking ID to the options for later reference
      };
    }
  
    /**
     * Wrap existing email sending function with tracking
     * @param {Function} sendEmailFn - Original email sending function
     * @returns {Function} Enhanced email sending function
     */
    wrapEmailSender(sendEmailFn) {
      return async (mailOptions, ...args) => {
        try {
          // Add tracking to email options
          const trackedOptions = this.addTrackingToEmail(mailOptions);
          
          // Remove trackingId from options before sending
          const { trackingId, ...sendOptions } = trackedOptions;
  
          // Send email using original function
          const result = await sendEmailFn(sendOptions, ...args);
  
          // Return result with tracking information
          return {
            ...result,
            trackingId
          };
        } catch (error) {
          this.config.logger.error('Email Sending Error', {
            error: error.message,
            stack: error.stack
          });
          throw error;
        }
      };
    }
  
    /**
     * Check for email bounces
     * @returns {Promise<Array>} List of bounce notifications
     */
    async checkBounces() {
      if (!this.config.imap) {
        throw new Error('IMAP configuration is required for bounce tracking');
      }
  
      return new Promise((resolve, reject) => {
        const imapConnection = new imap(this.config.imap);
        const bounces = [];
  
        imapConnection.once('error', (err) => {
          this.config.logger.error('IMAP Connection Error', err);
          reject(err);
        });
  
        imapConnection.once('ready', () => {
          imapConnection.openBox('INBOX', false, (err, box) => {
            if (err) {
              this.config.logger.error('Mailbox Open Error', err);
              imapConnection.end();
              reject(err);
              return;
            }
  
            const bounceSearchCriteria = [
              ['HEADER', 'Subject', 'Delivery Status Notification (Failure)'],
              ['UNSEEN']
            ];
  
            imapConnection.search(bounceSearchCriteria, (err, results) => {
              if (err) {
                this.config.logger.error('Bounce Search Error', err);
                imapConnection.end();
                reject(err);
                return;
              }
  
              if (!results || results.length === 0) {
                imapConnection.end();
                resolve([]);
                return;
              }
  
              const fetchOptions = { bodies: '' };
              const fetchMessages = imapConnection.fetch(results, fetchOptions);
              
              fetchMessages.on('message', (msg) => {
                msg.on('body', async (stream) => {
                  try {
                    const parsed = await simpleParser(stream);
                    bounces.push({
                      from: parsed.from?.text,
                      subject: parsed.subject,
                      text: parsed.text,
                      originalMessageId: parsed.headers.get('In-Reply-To')
                    });
                  } catch (parseError) {
                    this.config.logger.error('Bounce Parsing Error', parseError);
                  }
                });
              });
  
              fetchMessages.once('error', (fetchErr) => {
                this.config.logger.error('Fetch Messages Error', fetchErr);
                imapConnection.end();
                reject(fetchErr);
              });
  
              fetchMessages.once('end', () => {
                imapConnection.end();
                resolve(bounces);
              });
            });
          });
        });
  
        imapConnection.connect();
      });
    }
  
    /**
     * Track replies for a specific tracking ID
     * @param {string} trackingId - Tracking ID to search for
     * @returns {Promise<Array>} List of reply emails
     */
    async trackReplies(trackingId) {
      if (!this.config.imap) {
        throw new Error('IMAP configuration is required for reply tracking');
      }
  
      return new Promise((resolve, reject) => {
        const imapConnection = new imap(this.config.imap);
        const replies = [];
  
        imapConnection.once('error', (err) => {
          this.config.logger.error('IMAP Connection Error', err);
          reject(err);
        });
  
        imapConnection.once('ready', () => {
          imapConnection.openBox('INBOX', false, (err, box) => {
            if (err) {
              this.config.logger.error('Mailbox Open Error', err);
              imapConnection.end();
              reject(err);
              return;
            }
  
            const replySearchCriteria = [
              ['HEADER', this.config.tracking.headerName, trackingId],
              ['UNSEEN']
            ];
  
            imapConnection.search(replySearchCriteria, (err, results) => {
              if (err) {
                this.config.logger.error('Reply Search Error', err);
                imapConnection.end();
                reject(err);
                return;
              }
  
              if (!results || results.length === 0) {
                imapConnection.end();
                resolve([]);
                return;
              }
  
              const fetchOptions = { bodies: '' };
              const fetchMessages = imapConnection.fetch(results, fetchOptions);
              
              fetchMessages.on('message', (msg) => {
                msg.on('body', async (stream) => {
                  try {
                    const parsed = await simpleParser(stream);
                    replies.push({
                      from: parsed.from?.text,
                      subject: parsed.subject,
                      text: parsed.text,
                      date: parsed.date
                    });
                  } catch (parseError) {
                    this.config.logger.error('Reply Parsing Error', parseError);
                  }
                });
              });
  
              fetchMessages.once('error', (fetchErr) => {
                this.config.logger.error('Fetch Messages Error', fetchErr);
                imapConnection.end();
                reject(fetchErr);
              });
  
              fetchMessages.once('end', () => {
                imapConnection.end();
                resolve(replies);
              });
            });
          });
        });
  
        imapConnection.connect();
      });
    }
  }
  
  // Example usage
  async function exampleUsage() {
    // Existing email sending function (e.g., from nodemailer or your custom implementation)
    const originalSendEmail = async (mailOptions) => {
      // Your existing email sending logic
      const transporter = nodemailer.createTransport({
        host: 'smtp.gmail.com',
        port: 587,
        auth: {
          user: 'syneticslz@gmail.com',
          pass: 'gble ksdb ntdq hqlx'
        }
      });
  
      return transporter.sendMail(mailOptions);
    };
  
    // Initialize tracker with optional configuration
    const tracker = new EmailTracker({
      tracking: {
        enabled: true,
        prefix: 'custom-track',
        headerName: 'X-Custom-Tracking'
      },
      imap: {
        user: 'syneticslz@gmail.com',
        password: 'gble ksdb ntdq hqlx',
        host: 'imap.gmail.com',
        port: 993,
        tls: true
      },
      logger: console // Custom logger (optional)
    });
  
    // Wrap the existing send email function with tracking
    const sendTrackedEmail = tracker.wrapEmailSender(originalSendEmail);
  
    try {
      // Send a tracked email using the wrapped function
      const sentEmail = await sendTrackedEmail({
        from: 'sender@example.com',
        to: 'recipient@example.com',
        subject: 'Tracked Email',
        text: 'This is a tracked email'
      });
  
      console.log('Sent Email Tracking ID:', sentEmail.trackingId);
  
      // Check for bounces
      const bounces = await tracker.checkBounces();
      console.log('Bounced Emails:', bounces);
  
      // Track replies for a specific tracking ID
      const replies = await tracker.trackReplies(sentEmail.trackingId);
      console.log('Email Replies:', replies);
    } catch (error) {
      console.error('Tracking Error:', error);
    }
  }
  
  module.exports = EmailTracker;