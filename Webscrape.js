const axios = require('axios');
const cheerio = require('cheerio');
const { parse } = require('url');
const crypto = require('crypto');
const { Configuration, OpenAI } = require('openai');

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

class AdvancedCompanyIntelligenceScraper {
    constructor(options = {}) {
        // Comprehensive configuration for intelligent scraping
        this.config = {
            timeout: options.timeout || 30000,
            maxRetries: options.maxRetries || 3,
            rotatingProxies: options.proxies || [],
            userAgents: options.userAgents || [
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.1 Safari/605.1.15',
                'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/92.0.4515.107 Safari/537.36',
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:90.0) Gecko/20100101 Firefox/90.0'
            ],
            defaultHeaders: {
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9',
                'Accept-Encoding': 'gzip, deflate, br',
                'DNT': '1',
                'Connection': 'keep-alive',
                'Upgrade-Insecure-Requests': '1'
            },
            apiKeys: {
                openai: options.openaiApiKey,
                clearbit: options.clearbitApiKey,
                apollo: options.apolloApiKey
            }
        };

        // Advanced request management
        this.requestManager = {
            requestCount: 0,
            lastRequestTime: 0,
            rateLimitDelay: 1000, // Minimum delay between requests
            
            async throttle() {
                const now = Date.now();
                const timeSinceLastRequest = now - this.lastRequestTime;
                
                if (timeSinceLastRequest < this.rateLimitDelay) {
                    await new Promise(resolve => setTimeout(resolve, this.rateLimitDelay - timeSinceLastRequest));
                }
                
                this.requestCount++;
                this.lastRequestTime = Date.now();
            }
        };
    }

    // Intelligent User-Agent and Proxy Rotation
    _prepareRequest() {
        const userAgent = this.config.userAgents[Math.floor(Math.random() * this.config.userAgents.length)];
        const headers = {
            ...this.config.defaultHeaders,
            'User-Agent': userAgent
        };

        // Optional proxy rotation
        const proxyConfig = this.config.rotatingProxies.length > 0 
            ? this.config.rotatingProxies[Math.floor(Math.random() * this.config.rotatingProxies.length)]
            : null;

        return { headers, proxyConfig };
    }

    // Advanced text cleaning and normalization
    _cleanText(text) {
        if (!text) return '';
        return text
            .replace(/\s+/g, ' ')           // Normalize whitespace
            .replace(/[\n\r\t]/g, ' ')      // Remove newlines and tabs
            .replace(/\s{2,}/g, ' ')        // Remove excessive spaces
            .replace(/[^\x00-\x7F]/g, '')   // Remove non-ASCII characters
            .trim();
    }

    // Multi-source company information gathering
    async scrapeCompanyIntelligence(url) {
        const companyIntel = {
            basicInfo: { 
                url, 
                name: null, 
                description: null,
                domain: parse(url).hostname
            },
            digitalFootprint: { 
                socialLinks: {}, 
                contactInfo: {
                    email: null,
                    phone: null,
                    location: null
                } 
            },
            companyCharacteristics: { 
                industry: null, 
                size: null,
                founded: null
            },
            keyPeople: [],
            additionalInsights: {}
        };

        try {
            // Rate limiting and request preparation
            await this.requestManager.throttle();
            const { headers, proxyConfig } = this._prepareRequest();

            // Primary website scraping
            const websiteResponse = await this._fetchWithRetry(url, { headers, proxyConfig });
            const $ = cheerio.load(websiteResponse.data);

            // Parallel data extraction
            const [
                description, 
                keyPeople, 
                socialLinks
            ] = await Promise.all([
                this._extractCompanyDescription($),
                this._extractKeyPeople($),
                this._extractSocialLinks($)
            ]);

            // Update company intelligence
            companyIntel.basicInfo.description = description;
            companyIntel.keyPeople = keyPeople;
            companyIntel.digitalFootprint.socialLinks = socialLinks;

            // Industry and additional insights
            companyIntel.companyCharacteristics.industry = await this._detectIndustry(description);

            // Optional AI and API-based enhancements
            await Promise.all([
                this._enhanceWithClearbit(companyIntel),
                this._enhanceWithApollo(companyIntel),
                this._generateAIInsights(companyIntel)
            ]);

            return companyIntel;
        } catch (error) {
            console.error('Company intelligence gathering failed:', error);
            return companyIntel;
        }
    }

    // Robust fetching with retry mechanism
    async _fetchWithRetry(url, options, retries = 3) {
        for (let attempt = 1; attempt <= retries; attempt++) {
            try {
                const response = await axios.get(url, {
                    timeout: this.config.timeout,
                    ...options,
                    proxy: options.proxyConfig ? {
                        host: options.proxyConfig.host,
                        port: options.proxyConfig.port,
                        auth: options.proxyConfig.auth
                    } : undefined
                });
                return response;
            } catch (error) {
                if (attempt === retries) throw error;
                // Exponential backoff
                await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, attempt)));
            }
        }
    }

    // Advanced description extraction
    _extractCompanyDescription($) {
        const descriptionSelectors = [
            'meta[property="og:description"]',
            'meta[name="description"]',
            '[data-testid="company-description"]',
            '#company-description',
            '.company-description',
            'section.about-us p',
            '#about-us p',
            '.about-section p',
            'main p',
            'body p'
        ];

        for (const selector of descriptionSelectors) {
            const element = $(selector);
            const description = element.attr('content') || element.text();
            
            if (description && description.trim().length > 50) {
                return this._cleanText(description).substring(0, 500);
            }
        }

        return "Company description not available.";
    }

    // Key people extraction strategy
    _extractKeyPeople($) {
        const peopleSelectors = [
            '.leadership-team .team-member',
            '#leadership .leadership-member',
            '.executives .executive',
            'a[href*="linkedin.com/in/"]'
        ];

        const keyPeople = [];
        peopleSelectors.forEach(selector => {
            $(selector).each((i, elem) => {
                if (keyPeople.length >= 5) return false;

                const name = $(elem).find('.name, h3').text().trim() || 
                             $(elem).text().trim().split(/\s*-\s*/)[0];
                const title = $(elem).find('.title, .position').text().trim() || 
                              $(elem).text().trim().split(/\s*-\s*/)[1];

                if (name && title) {
                    keyPeople.push({ name, title });
                }
            });
        });

        return keyPeople.slice(0, 5);
    }

    // Social media link extraction
    _extractSocialLinks($) {
        const socialPlatforms = {
            linkedin: $('a[href*="linkedin.com/company"]').attr('href'),
            twitter: $('a[href*="twitter.com"]').attr('href'),
            facebook: $('a[href*="facebook.com"]').attr('href'),
            github: $('a[href*="github.com"]').attr('href')
        };

        return Object.fromEntries(
            Object.entries(socialPlatforms).filter(([_, link]) => link)
        );
    }

    // Industry detection with advanced keyword mapping
    async _detectIndustry(text) {
        const industryKeywords = {
            'SaaS & Enterprise Software': ['saas', 'cloud', 'software', 'enterprise', 'platform', 'solution'],
            'Technology & AI': ['ai', 'machine learning', 'algorithm', 'intelligence', 'tech'],
            'Marketing & Sales': ['marketing', 'sales', 'crm', 'customer', 'engagement'],
            'Finance & FinTech': ['finance', 'payment', 'investment', 'banking', 'fintech'],
            'Healthcare & Wellness': ['health', 'medical', 'wellness', 'healthcare', 'biotech'],
            'E-commerce & Retail': ['ecommerce', 'retail', 'online', 'marketplace', 'store']
        };

        const lowercaseText = text.toLowerCase();
        
        const industryMatches = Object.entries(industryKeywords)
            .map(([industry, keywords]) => ({
                industry,
                matchCount: keywords.filter(keyword => lowercaseText.includes(keyword)).length
            }))
            .filter(match => match.matchCount > 0)
            .sort((a, b) => b.matchCount - a.matchCount);

        return industryMatches.length > 0 ? industryMatches[0].industry : 'Other';
    }

    // Optional Clearbit API enhancement
    async _enhanceWithClearbit(companyIntel) {
        if (!this.config.apiKeys.clearbit) return;

        try {
            const response = await axios.get(`https://company.clearbit.com/v2/companies/domain/${companyIntel.basicInfo.domain}`, {
                headers: { 'Authorization': `Bearer ${this.config.apiKeys.clearbit}` }
            });

            const clearbitData = response.data;
            companyIntel.additionalInsights.clearbit = {
                companySize: clearbitData.metrics.employees,
                foundedYear: clearbitData.foundedYear,
                location: clearbitData.location,
                technology: clearbitData.tech
            };
        } catch (error) {
            console.warn('Clearbit enhancement failed', error);
        }
    }

    // Optional Apollo API enhancement
    async _enhanceWithApollo(companyIntel) {
        if (!this.config.apiKeys.apollo) return;

        try {
            const response = await axios.post('https://api.apollo.io/v1/organizations/search', {
                api_key: this.config.apiKeys.apollo,
                domain: companyIntel.basicInfo.domain
            });

            const apolloData = response.data.organizations[0];
            companyIntel.additionalInsights.apollo = {
                employeeCount: apolloData.employees_count,
                estimatedRevenueRange: apolloData.estimated_annual_revenue
            };
        } catch (error) {
            console.warn('Apollo enhancement failed', error);
        }
    }

    // AI-powered personalization insights
    async _generateAIInsights(companyIntel) {
        if (!this.config.apiKeys.openai) return;

        try {
            const openai = new OpenAI({ apiKey: this.config.apiKeys.openai });
            const response = await openai.chat.completions.create({
                model: "gpt-3.5-turbo",
                messages: [
                    {
                        role: "system",
                        content: "You are an expert at extracting personalization insights for cold emails from company descriptions."
                    },
                    {
                        role: "user",
                        content: `Analyze this company profile:
                        Description: ${companyIntel.basicInfo.description}
                        Industry: ${companyIntel.companyCharacteristics.industry}
please just provide a summary of this website and its services`
                    }
                ],
                max_tokens: 300
            });

            companyIntel.additionalInsights.aiPersonalization = 
                response.choices[0].message.content.trim();
        } catch (error) {
            console.warn('AI personalization insights generation failed', error);
        }
    }
}

module.exports = AdvancedCompanyIntelligenceScraper;



// // Activation code to run the script
// if (require.main === module) {
//     main();
// }


// const { chromium } = require('@playwright/test');
// const { parse } = require('url');
// const axios = require('axios');
// const cheerio = require('cheerio');
// const natural = require('natural');
// const compromise = require('compromise');
// const OpenAI = require('openai');
// // const { extractEmails } = require('email-extractor');

// class AdvancedCompanyIntelligenceScraper {
//     constructor(options = {}) {
//         // Configurable options for more flexible scraping
//         this.config = {
//             timeout: options.timeout || 45000,
//             maxRetries: options.maxRetries || 3,
//             proxyConfig: options.proxyConfig || null,
//             userAgents: options.userAgents || [
//                 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
//                 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
//                 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36'
//             ],
//             // Focus on cold email personalization-relevant fields
//             relevantFields: [
//                 'basicInfo',
//                 'digitalFootprint',
//                 'companyCharacteristics',
//                 'keyPeople'
//             ]
//         };

//         // NLP and analysis tools
//         this.tokenizer = new natural.WordTokenizer();
//         this.sentimentAnalyzer = new natural.SentimentAnalyzer("English", natural.PorterStemmer, "afinn");
        
//         // Optional AI integration for enhanced analysis
//         this.openai = options.openaiApiKey 
//             ? new OpenAI({ apiKey: options.openaiApiKey }) 
//             : null;
//     }

//     // Enhanced text cleaning method
//     cleanText(text) {
//         if (!text) return '';
//         return text
//             .replace(/\s+/g, ' ')           // Normalize whitespace
//             .replace(/[\n\r\t]/g, ' ')      // Remove newlines and tabs
//             .replace(/\s{2,}/g, ' ')        // Remove excessive spaces
//             .replace(/[^\x00-\x7F]/g, '')   // Remove non-ASCII characters
//             .trim();
//     }

//     // Advanced key people extraction
//     async extractKeyPeople(page, $) {
//         try {
//             // Look for leadership team pages or sections
//             const keyPeopleSelectors = [
//                 '.leadership-team',
//                 '#leadership',
//                 '.team-section',
//                 '[data-testid="leadership-team"]',
//                 'section.leadership'
//             ];

//             // JavaScript-based extraction for dynamic content
//             const keyPeople = await page.evaluate((selectors) => {
//                 const people = [];
                
//                 // Try multiple strategies to find key people
//                 for (const selector of selectors) {
//                     const teamContainer = document.querySelector(selector);
//                     if (teamContainer) {
//                         const profileElements = teamContainer.querySelectorAll('.team-member, .leadership-member, .executive');
//                         profileElements.forEach(member => {
//                             const name = member.querySelector('h3, .name')?.textContent.trim();
//                             const title = member.querySelector('.title, .position')?.textContent.trim();
                            
//                             if (name && title) {
//                                 people.push({ name, title });
//                             }
//                         });
//                     }
//                 }

//                 // Fallback to LinkedIn-style extraction
//                 if (people.length === 0) {
//                     const linkedinProfiles = document.querySelectorAll('a[href*="linkedin.com/in/"]');
//                     linkedinProfiles.forEach(profile => {
//                         const nameElement = profile.querySelector('.name') || profile;
//                         const name = nameElement.textContent.trim();
//                         people.push({ name, title: 'Professional' });
//                     });
//                 }

//                 return people.slice(0, 5); // Limit to top 5 key people
//             }, keyPeopleSelectors);

//             return keyPeople;
//         } catch (error) {
//             console.warn('Key people extraction failed', error);
//             return [];
//         }
//     }

//     // Enhanced company description extraction
//     async extractCompanyDescription(page, $) {
//         try {
//             // Advanced description extraction strategies
//             const descriptionStrategies = [
//                 async () => {
//                     // JavaScript-based dynamic content extraction
//                     return await page.evaluate(() => {
//                         const descriptionSelectors = [
//                             'meta[property="og:description"]',
//                             'meta[name="description"]',
//                             '[data-testid="company-description"]',
//                             '#company-description',
//                             '.company-description',
//                             'section.about-us',
//                             '#about-us',
//                             '.about-section p',
//                             'main p',
//                             'body p'
//                         ];

//                         for (const selector of descriptionSelectors) {
//                             const element = document.querySelector(selector);
//                             if (element) {
//                                 return element.textContent?.trim() || 
//                                        element.getAttribute('content')?.trim() || 
//                                        element.innerText?.trim();
//                             }
//                         }

//                         return null;
//                     });
//                 },
//                 () => {
//                     // Cheerio-based static content extraction
//                     for (const selector of [
//                         'meta[property="og:description"]',
//                         'meta[name="description"]',
//                         '[data-testid="company-description"]',
//                         '#company-description',
//                         '.company-description'
//                     ]) {
//                         const description = selector.startsWith('meta') 
//                             ? $(selector).attr('content') 
//                             : $(selector).first().text();
                        
//                         if (description && description.trim().length > 50) {
//                             return this.cleanText(description);
//                         }
//                     }
//                     return null;
//                 }
//             ];

//             // Try each description extraction strategy
//             for (const strategy of descriptionStrategies) {
//                 const description = await strategy();
//                 if (description) {
//                     return description.substring(0, 500); // Limit description length
//                 }
//             }

//             return "Company description not available.";
//         } catch (error) {
//             console.warn('Description extraction failed', error);
//             return "Company description not available.";
//         }
//     }

//     // Comprehensive scraping method focused on cold email personalization
//     async scrapeCompanyIntelligence(url) {
//         // Initialize company intelligence structure
//         const companyIntel = {
//             basicInfo: { 
//                 url, 
//                 name: null, 
//                 description: null 
//             },
//             digitalFootprint: { 
//                 socialLinks: {}, 
//                 contactInfo: {
//                     email: null,
//                     phone: null,
//                     location: null
//                 } 
//             },
//             companyCharacteristics: { 
//                 industry: null, 
//                 size: null 
//             },
//             keyPeople: []
//         };

//         let browser, page;
//         try {
//             // Launch browser with advanced configuration
//             browser = await chromium.launch({
//                 headless: true,
//                 timeout: this.config.timeout,
//                 args: [
//                     '--no-sandbox',
//                     '--disable-setuid-sandbox',
//                     '--disable-web-security',
//                     '--disable-features=IsolateOrigins',
//                     '--disable-site-isolation-trials'
//                 ]
//             });

//             // Create context with randomized user agent
//             const context = await browser.newContext({
//                 userAgent: this.config.userAgents[Math.floor(Math.random() * this.config.userAgents.length)],
//                 extraHTTPHeaders: {
//                     'Accept-Language': 'en-US,en;q=0.9',
//                     'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8'
//                 },
//                 // Optional proxy configuration
//                 ...(this.config.proxyConfig && { 
//                     proxy: this.config.proxyConfig 
//                 })
//             });

//             page = await context.newPage();
            
//             // Advanced navigation with multiple strategies
//             try {
//                 await page.goto(url, { 
//                     waitUntil: 'networkidle', 
//                     timeout: this.config.timeout 
//                 });
//             } catch (navigationError) {
//                 // Fallback navigation strategy
//                 await page.goto(url, { 
//                     waitUntil: 'domcontentloaded', 
//                     timeout: this.config.timeout 
//                 });
//             }

//             // Extract page content
//             const content = await page.content();
//             const $ = cheerio.load(content);

//             // Parallel extraction of key information
//             const [
//                 description, 
//                 keyPeople
//             ] = await Promise.all([
//                 this.extractCompanyDescription(page, $),
//                 this.extractKeyPeople(page, $)
//             ]);

//             // Populate company intelligence
//             companyIntel.basicInfo.description = description;
//             companyIntel.keyPeople = keyPeople;

//             // Advanced text analysis for industry detection
//             if (description) {
//                 companyIntel.companyCharacteristics.industry = await this.detectIndustry(description);
//             }

//             // Optional: AI-powered enhancement
//             if (this.openai) {
//                 try {
//                     // Use AI to extract additional insights
//                     const aiInsights = await this.enhanceCompanyProfile(companyIntel);
//                     Object.assign(companyIntel, aiInsights);
//                 } catch (aiError) {
//                     console.warn('AI enhancement failed', aiError);
//                 }
//             }

//             return companyIntel;
//         } catch (error) {
//             console.error('Company intelligence scraping failed', error);
//             return companyIntel;
//         } finally {
//             // Ensure browser is closed
//             if (browser) await browser.close();
//         }
//     }

//     // AI-powered profile enhancement
//     async enhanceCompanyProfile(companyIntel) {
//         if (!this.openai) return {};

//         try {
//             const response = await this.openai.chat.completions.create({
//                 model: "gpt-3.5-turbo",
//                 messages: [
//                     {
//                         role: "system",
//                         content: "You are an expert at extracting personalization insights for cold emails from company descriptions."
//                     },
//                     {
//                         role: "user",
//                         content: `Analyze this company profile and provide key personalization insights:
//                         Description: ${companyIntel.basicInfo.description}
//                         Industry: ${companyIntel.companyCharacteristics.industry}
                        
//                         Provide:
//                         1. Potential pain points
//                         2. Key messaging angles
//                         3. Recommended email tone
//                         4. Potential conversation starters`
//                     }
//                 ],
//                 max_tokens: 300
//             });

//             const insights = response.choices[0].message.content.trim();
//             return { personalizedInsights: insights };
//         } catch (error) {
//             console.warn('AI profile enhancement failed', error);
//             return {};
//         }
//     }

//     // Detect industry based on description
//     async detectIndustry(text) {
//         // Simplified industry detection focused on cold email relevance
//         const industryKeywords = {
//             'SaaS & Enterprise Software': ['saas', 'cloud', 'software', 'enterprise', 'platform', 'solution'],
//             'Technology & AI': ['ai', 'machine learning', 'algorithm', 'intelligence', 'tech'],
//             'Marketing & Sales': ['marketing', 'sales', 'crm', 'customer', 'engagement'],
//             'Finance & FinTech': ['finance', 'payment', 'investment', 'banking', 'fintech'],
//             'Healthcare & Wellness': ['health', 'medical', 'wellness', 'healthcare', 'biotech'],
//             'E-commerce & Retail': ['ecommerce', 'retail', 'online', 'marketplace', 'store']
//         };

//         const lowercaseText = text.toLowerCase();
        
//         const industryMatches = Object.entries(industryKeywords)
//             .map(([industry, keywords]) => ({
//                 industry,
//                 matchCount: keywords.filter(keyword => lowercaseText.includes(keyword)).length
//             }))
//             .filter(match => match.matchCount > 0)
//             .sort((a, b) => b.matchCount - a.matchCount);

//         return industryMatches.length > 0 ? industryMatches[0].industry : 'Other';
//     }
// }

// // Deployment Guide and Configuration
// const deploymentGuide = `
// # Comprehensive Deployment Guide: Localhost to Render.com

// ## Prerequisites
// 1. Node.js (v16+ recommended)
// 2. GitHub Account
// 3. Render.com Account

// ## Local Setup
// 1. Initialize Project
// \`\`\`bash
// mkdir company-intelligence-scraper
// cd company-intelligence-scraper
// npm init -y
// \`\`\`

// 2. Install Dependencies
// \`\`\`bash
// npm install @playwright/test axios cheerio natural compromise openai email-extractor
// npx playwright install-deps
// \`\`\`

// 3. Create Main Script (index.js)
// - Add the AdvancedCompanyIntelligenceScraper class
// - Create example usage script

// 4. Environment Configuration
// \`\`\`bash
// npm install dotenv
// \`\`\`
// Create .env file:
// \`\`\`
// OPENAI_API_KEY=your_openai_key
// \`\`\`

// ## Render.com Deployment
// 1. GitHub Repository
// - Push code to GitHub repository
// - Include .env.example (without actual secrets)

// 2. Render Web Service Configuration
// - Select Web Service
// - Connect GitHub Repository
// - Build Command: \`npm install\`
// - Start Command: \`node index.js\`

// 3. Environment Variables in Render
// - Add all sensitive variables in Render's dashboard
// - OPENAI_API_KEY
// - Other configuration variables

// ## Advanced Configuration
// - Set up multiple proxy configurations
// - Implement robust error handling
// - Add logging mechanism

// ## Performance Optimization
// 1. Implement caching mechanism
// 2. Use connection pooling
// 3. Add request throttling

// ## Security Considerations
// - Use environment variables
// - Implement rate limiting
// - Add input validation
// - Secure API endpoints

// ## Monitoring & Logging
// 1. Implement comprehensive logging
// 2. Set up error tracking (Sentry, etc.)
// 3. Monitor scraping performance
// `;

// // Export the class and deployment guide
// module.exports =
//     AdvancedCompanyIntelligenceScraper;
// // Example Usage


// // Uncomment to run
// // exampleUsage();

// // const axios = require('axios');
// // const cheerio = require('cheerio');
// // const puppeteer = require('puppeteer');
// // const { parse } = require('url');
// // const natural = require('natural');
// // const compromise = require('compromise');


// // // const browser = await puppeteer.launch({
// // //     headless: true,
// // //     args: ['--no-sandbox', '--disable-setuid-sandbox']
// // // });


// // class UltimateCompanyIntelligenceScraper {
// //     constructor(options = {}) {
// //         this.timeout = options.timeout || 30000;
// //         this.maxRetries = options.maxRetries || 3;
// //         this.tokenizer = new natural.WordTokenizer();
// //         this.sentimentAnalyzer = new natural.SentimentAnalyzer("English", natural.PorterStemmer, "afinn");
// //     }

// //     // Enhanced text cleaning and extraction
// //     cleanText(text) {
// //         // Remove extra whitespace, newlines, and trim
// //         return text.replace(/\s+/g, ' ')
// //                    .replace(/[\n\r]/g, ' ')
// //                    .trim();
// //     }

// //     // Improved text extraction with multiple fallback strategies
// //     extractCompanyDescription($) {
// //         const descriptionSelectors = [
// //             // Prioritized selectors for description
// //             'meta[property="og:description"]',
// //             'meta[name="description"]',
// //             '#company-description',
// //             '.company-description',
// //             'section.about-us',
// //             '#about-us',
// //             '.about-section p',
// //             'body p',
// //             'main p'
// //         ];

// //         for (const selector of descriptionSelectors) {
// //             let description = selector.startsWith('meta') 
// //                 ? $(selector).attr('content') 
// //                 : $(selector).first().text();
            
// //             description = this.cleanText(description);
            
// //             // Only return if description is meaningful (more than 30 characters)
// //             if (description && description.length > 30) {
// //                 return description.substring(0, 500); // Limit to 500 characters
// //             }
// //         }

// //         return "Company description not found.";
// //     }

// //     // More intelligent company name extraction
// //     extractCompanyName($) {
// //         const nameStrategies = [
// //             () => $('h1').first().text().trim(),
// //             () => $('title').text().replace(/(\||-) .*$/, '').trim(),
// //             () => $('meta[property="og:site_name"]').attr('content'),
// //             () => $('meta[name="application-name"]').attr('content')
// //         ];

// //         for (const strategy of nameStrategies) {
// //             const name = strategy();
// //             if (name && name.length > 2 && name.length < 100) {
// //                 return name;
// //             }
// //         }

// //         return "Unknown Company";
// //     }

// //     // Improved social link extraction
// //     extractSocialLinks($) {
// //         const socialPlatforms = {
// //             linkedin: ['linkedin.com/company', 'linkedin.com/in/'],
// //             twitter: ['twitter.com/', 'x.com/'],
// //             facebook: ['facebook.com/'],
// //             instagram: ['instagram.com/']
// //         };

// //         const socialLinks = {};

// //         $('a').each((i, elem) => {
// //             const href = $(elem).attr('href');
// //             if (href) {
// //                 for (const [platform, patterns] of Object.entries(socialPlatforms)) {
// //                     if (patterns.some(pattern => href.toLowerCase().includes(pattern))) {
// //                         socialLinks[platform] = href;
// //                         break;
// //                     }
// //                 }
// //             }
// //         });

// //         return socialLinks;
// //     }

// //     // More robust contact information extraction
// //     extractContactInfo($, pageText) {
// //         const contactRegex = {
// //             email: /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+)/gi,
// //             phone: /(?:\+\d{1,2}\s?)?(?:\(\d{3}\)|\d{3})[-.\s]?\d{3}[-.\s]?\d{4}/g
// //         };

// //         const extractedContacts = {
// //             email: null,
// //             phone: null
// //         };

// //         // Try meta tags first
// //         extractedContacts.email = $('meta[name="contact:email"]').attr('content') || 
// //                                    $('a[href^="mailto:"]').first().attr('href')?.replace('mailto:', '');

// //         // Scan page text for contacts if not found in meta
// //         if (!extractedContacts.email) {
// //             const emailMatches = pageText.match(contactRegex.email);
// //             extractedContacts.email = emailMatches ? emailMatches[0] : null;
// //         }

// //         const phoneMatches = pageText.match(contactRegex.phone);
// //         extractedContacts.phone = phoneMatches ? phoneMatches[0] : null;

// //         return extractedContacts;
// //     }

// //     // Enhanced industry detection with more nuanced categorization
// //     detectIndustry(text) {
// //         const industryKeywords = {
// //             'SaaS & Cloud': ['saas', 'cloud', 'software', 'platform', 'service', 'subscription'],
// //             'Telecommunications': ['telecom', 'phone', 'communication', 'voip', 'call', 'network'],
// //             'Artificial Intelligence': ['ai', 'machine learning', 'algorithm', 'intelligence', 'cognitive'],
// //             'Enterprise Software': ['enterprise', 'business', 'solution', 'management', 'workflow'],
// //             'Marketing Technology': ['marketing', 'crm', 'analytics', 'advertising', 'campaign'],
// //             'Cybersecurity': ['security', 'protect', 'threat', 'privacy', 'encryption'],
// //             'Productivity Tools': ['productivity', 'collaboration', 'team', 'workspace', 'efficiency']
// //         };

// //         const lowercaseText = text.toLowerCase();
        
// //         const industryMatches = Object.entries(industryKeywords)
// //             .map(([industry, keywords]) => ({
// //                 industry,
// //                 matchCount: keywords.filter(keyword => lowercaseText.includes(keyword)).length
// //             }))
// //             .filter(match => match.matchCount > 0)
// //             .sort((a, b) => b.matchCount - a.matchCount);

// //         return industryMatches.length > 0 ? industryMatches[0].industry : 'Technology';
// //     }


// //     async findChromiumExecutable() {
// //         const possiblePaths = [
// //             '/usr/bin/chromium',
// //             '/usr/bin/google-chrome',
// //             '/usr/bin/chromium-browser',
// //             process.env.PUPPETEER_EXECUTABLE_PATH
// //         ];
    
// //         for (const path of possiblePaths) {
// //             try {
// //                 // Check if the file exists and is executable
// //                 await fs.access(path, fs.constants.X_OK);
// //                 console.log(`Found executable Chromium at: ${path}`);
// //                 return path;
// //             } catch (error) {
// //                 console.log(`Path not executable: ${path}`);
// //             }
// //         }
    
// //         throw new Error('No Chromium executable found');
// //     }


// //     // Comprehensive scraping method with enhanced error handling
// //     async scrapeCompanyIntelligence(url) {
// //         const companyIntel = {
// //             basicInfo: { url, name: null, description: null },
// //             digitalFootprint: { socialLinks: {}, contactInfo: {} },
// //             companyCharacteristics: { industry: null, communicationStyle: null },
// //             communicationProfile: { sentimentScore: null, keyMessageTopics: [] }
// //         };

// //         try {
// //             console.log('Puppeteer launch environment:', {
// //                 NODE_ENV: process.env.NODE_ENV,
// //                 PUPPETEER_EXECUTABLE_PATH: process.env.PUPPETEER_EXECUTABLE_PATH,
// //                 DefaultExecutablePath: puppeteer.executablePath()
// //             });

// //             console.log('Checking possible Chromium paths:', [
// //                 '/usr/bin/chromium',
// //                 '/usr/bin/google-chrome',
// //                 '/usr/bin/chromium-browser',
// //                 process.env.PUPPETEER_EXECUTABLE_PATH
// //             ]);
        
// //             // Attempt to find the actual executable
// //             const execPath = await this.findChromiumExecutable();
        
// //             const browser = await puppeteer.launch({ 
// //                 executablePath: execPath,
// //                 headless: true, 
// //                 args: [
// //                     '--no-sandbox', 
// //                     '--disable-setuid-sandbox', 
// //                     '--disable-web-security',
// //                 ],
// //                 dumpio: true
// //             });
// //             const page = await browser.newPage();
            
// //             await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
// //             await page.setExtraHTTPHeaders({
// //                 'Accept-Language': 'en-US,en;q=0.9'
// //             });

// //             await page.goto(url, { 
// //                 waitUntil: 'networkidle0', 
// //                 timeout: this.timeout 
// //             });

// //             const content = await page.content();
// //             const $ = cheerio.load(content);
// //             const pageText = $('body').text();

// //             // Enhanced extraction methods
// //             companyIntel.basicInfo.name = this.extractCompanyName($);
// //             companyIntel.basicInfo.description = this.extractCompanyDescription($);
// //             companyIntel.digitalFootprint.socialLinks = this.extractSocialLinks($);
// //             companyIntel.digitalFootprint.contactInfo = this.extractContactInfo($, pageText);

// //             // Advanced text analysis
// //             const processedText = this.cleanText(companyIntel.basicInfo.description);
            
// //             if (processedText) {
// //                 // Sentiment and NLP analysis
// //                 const tokens = this.tokenizer.tokenize(processedText);
// //                 companyIntel.communicationProfile.sentimentScore = 
// //                     this.sentimentAnalyzer.getSentiment(tokens);

// //                 const doc = compromise(processedText);
// //                 companyIntel.communicationProfile.keyMessageTopics = 
// //                     doc.nouns().out('array')
// //                        .filter(topic => topic.length > 2)
// //                        .slice(0, 5);

// //                 // Detect communication and industry characteristics
// //                 companyIntel.companyCharacteristics.industry = 
// //                     this.detectIndustry(processedText);

// //                 const communicationStyles = [
// //                     { style: 'Technical', score: processedText.match(/\b(solution|technology|platform)\b/gi)?.length || 0 },
// //                     { style: 'Professional', score: processedText.match(/\b(service|expertise|quality|leader)\b/gi)?.length || 0 },
// //                     { style: 'Innovative', score: processedText.match(/\b(innovative|creative|cutting-edge)\b/gi)?.length || 0 }
// //                 ];

// //                 const dominantStyle = communicationStyles
// //                     .sort((a, b) => b.score - a.score)[0];
                
// //                 companyIntel.companyCharacteristics.communicationStyle = 
// //                     dominantStyle.score > 0 ? dominantStyle.style : 'Neutral';
// //             }

// //             await browser.close();

// //             return companyIntel;
// //         } catch (error) {
// //             console.warn('Company intelligence scraping error:', error);
// //             return {
// //                 error: 'Scraping failed',
// //                 details: error.message,
// //                 url
// //             };
// //         }
// //     }

// //     // Improved cold outreach strategy generation
// //     generateColdOutreachStrategy(companyIntel) {
// //         if (!companyIntel || companyIntel.error) {
// //             return null;
// //         }

// //         const outreachStrategy = {
// //             personalizedOpening: null,
// //             connectionPoints: [],
// //             potentialChallenges: [],
// //             recommendedApproach: null
// //         };

// //         const name = companyIntel.basicInfo.name || 'the company';
// //         const industry = companyIntel.companyCharacteristics.industry || 'your industry';

// //         // More nuanced personalized opening
// //         outreachStrategy.personalizedOpening = 
// //             `I was impressed by ${name}'s innovative approach in the ${industry} sector.`;

// //         // Intelligent connection points
// //         const keyTopics = companyIntel.communicationProfile.keyMessageTopics;
// //         outreachStrategy.connectionPoints = [
// //             ...(keyTopics.length > 0 
// //                 ? [`Your strategic focus on ${keyTopics.slice(0, 2).join(' and ')}`] 
// //                 : []),
// //             `The evolving challenges in ${industry}`
// //         ];

// //         // Potential engagement challenges
// //         outreachStrategy.potentialChallenges = [
// //             `Navigating transformation in ${industry}`,
// //             ...(keyTopics.length > 0 
// //                 ? [`Addressing innovative approaches to ${keyTopics[0]}`] 
// //                 : [])
// //         ];

// //         // Tailored communication approach
// //         const communicationStyle = companyIntel.companyCharacteristics.communicationStyle || 'Professional';
// //         const sentimentScore = companyIntel.communicationProfile.sentimentScore || 0;

// //         outreachStrategy.recommendedApproach = 
// //             `Considering your ${communicationStyle.toLowerCase()} communication style, ` +
// //             `a ${sentimentScore > 0 ? 'collaborative and insightful' : 'direct and value-driven'} approach would likely resonate most effectively.`;

// //         return outreachStrategy;
// //     }
// // }

// // module.exports = UltimateCompanyIntelligenceScraper;

