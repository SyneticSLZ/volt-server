const axios = require('axios');
const cheerio = require('cheerio');
const { URL } = require('url');

class AdvancedCompanyProfileScraper {
    /**
     * Enhanced method to extract comprehensive digital footprint and company characteristics
     * @param {string} url - Company website URL
     * @param {Object} options - Scraping configuration options
     * @returns {Promise<Object>} Detailed company digital footprint and characteristics
     */
    async extractCompanyProfile(url, options = {}) {
        const {
            maxRetries = 3,
            retryDelay = 1000,
            timeout = 15000
        } = options;

        if (!url) {
            throw new Error('URL is required');
        }

        let attempts = 0;
        while (attempts < maxRetries) {
            try {
                const response = await axios.get(url, {
                    timeout,
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
                        'Accept-Language': 'en-US,en;q=0.5'
                    }
                });

                const $ = cheerio.load(response.data);
                const parsedUrl = new URL(url);

                return {
                    digitalFootprint: this.extractDigitalFootprint($, parsedUrl),
                    companyCharacteristics: await this.extractCompanyCharacteristics($, parsedUrl)
                };
            } catch (error) {
                attempts++;
                console.error(`Attempt ${attempts} failed: ${error.code} - ${error.message}`);

                const retryableErrors = ['ETIMEDOUT', 'ECONNRESET', 'ENOTFOUND'];
                if (retryableErrors.includes(error.code)) {
                    if (attempts >= maxRetries) {
                        throw new Error(`Failed to fetch ${url} after ${maxRetries} attempts`);
                    }
                    await new Promise(res => setTimeout(res, retryDelay * Math.pow(2, attempts - 1)));
                } else {
                    throw error;
                }
            }
        }
    }

    /**
     * Extract comprehensive digital footprint information
     * @param {cheerio} $ - Cheerio parsed HTML
     * @param {URL} parsedUrl - Parsed URL object
     * @returns {Object} Digital footprint details
     */
    extractDigitalFootprint($, parsedUrl) {
        return {
            socialLinks: this.extractSocialLinks($, parsedUrl),
            contactInfo: this.extractContactInfo($, parsedUrl)
        };
    }

    /**
     * Extract social media links with enhanced detection
     * @param {cheerio} $ - Cheerio parsed HTML
     * @param {URL} parsedUrl - Parsed URL object
     * @returns {Object} Social media links
     */
    extractSocialLinks($, parsedUrl) {
        const socialLinks = {
            linkedin: [],
            twitter: [],
            facebook: [],
            instagram: [],
            youtube: [],
            github: []
        };

        const socialPatterns = {
            linkedin: /linkedin\.com\/(company|in|profile)/,
            twitter: /twitter\.com\//,
            facebook: /facebook\.com\//,
            instagram: /instagram\.com\//,
            youtube: /youtube\.com\/(channel|c)\//,
            github: /github\.com\//
        };

        // Check link tags and a tags for social media links
        $('a, link').each((i, el) => {
            const href = $(el).attr('href');
            if (!href) return;

            Object.entries(socialPatterns).forEach(([platform, regex]) => {
                if (regex.test(href)) {
                    socialLinks[platform].push(href);
                }
            });
        });

        // Check for social media share/follow icons
        const iconSelectors = [
            'a.social-icon', 
            'a[class*="social"]', 
            'a[href*="linkedin.com"]',
            'a[href*="twitter.com"]',
            'a[href*="facebook.com"]'
        ];

        iconSelectors.forEach(selector => {
            $(selector).each((i, el) => {
                const href = $(el).attr('href');
                if (!href) return;

                Object.entries(socialPatterns).forEach(([platform, regex]) => {
                    if (regex.test(href) && !socialLinks[platform].includes(href)) {
                        socialLinks[platform].push(href);
                    }
                });
            });
        });

        // Remove duplicates and limit to top 3 for each platform
        Object.keys(socialLinks).forEach(platform => {
            socialLinks[platform] = [...new Set(socialLinks[platform])].slice(0, 3);
        });

        return socialLinks;
    }

    /**
     * Extract contact information with advanced techniques
     * @param {cheerio} $ - Cheerio parsed HTML
     * @param {URL} parsedUrl - Parsed URL object
     * @returns {Object} Contact information
     */
    extractContactInfo($, parsedUrl) {
        const contactInfo = {
            email: [],
            phone: [],
            location: null
        };

        // Email extraction with advanced regex
        const emailRegex = /([a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g;
        const phoneRegex = /(\+?1?[-.\s]?)?(\(?\d{3}\)?[-.\s]?)?\d{3}[-.\s]?\d{4}/g;
        const locationKeywords = [
            'address', 'location', 'headquarter', 'contact us', 'contact'
        ];

        // Search for emails in various text elements
        $('*').each((i, el) => {
            const text = $(el).text();
            const emails = text.match(emailRegex);
            const phones = text.match(phoneRegex);

            if (emails) {
                emails.forEach(email => {
                    // Filter out generic emails and duplicates
                    if (!contactInfo.email.includes(email) && 
                        !email.includes('@example') && 
                        !email.includes('@test')) {
                        contactInfo.email.push(email);
                    }
                });
            }

            if (phones) {
                phones.forEach(phone => {
                    // Normalize phone number and filter duplicates
                    const normalizedPhone = phone.replace(/[^\d+]/g, '');
                    if (!contactInfo.phone.includes(normalizedPhone)) {
                        contactInfo.phone.push(normalizedPhone);
                    }
                });
            }
        });

        // Location extraction
        locationKeywords.forEach(keyword => {
            const locationEl = $(`*:contains("${keyword}")`).first();
            if (locationEl.length) {
                const locationText = locationEl.text();
                // Basic location extraction
                const locationMatch = locationText.match(/(\d+\s+[^,]+,\s*[A-Z]{2}\s+\d{5})/);
                if (locationMatch) {
                    contactInfo.location = locationMatch[1];
                }
            }
        });

        // Limit results
        contactInfo.email = contactInfo.email.slice(0, 3);
        contactInfo.phone = contactInfo.phone.slice(0, 2);

        return contactInfo;
    }

    /**
     * Extract company characteristics with industry detection
     * @param {cheerio} $ - Cheerio parsed HTML
     * @param {URL} parsedUrl - Parsed URL object
     * @returns {Promise<Object>} Company characteristics
     */
    async extractCompanyCharacteristics($, parsedUrl) {
        const characteristics = {
            industry: "Other",
            companyType: null,
            size: null,
            founded: null,
            keyProducts: []
        };

        // Industry detection keywords
        const industryKeywords = {
            "Technology": ["tech", "software", "cloud", "ai", "machine learning", "blockchain"],
            "SaaS": ["saas", "software as a service", "subscription", "cloud service"],
            "E-commerce": ["online store", "e-commerce", "marketplace", "shopping"],
            "Healthcare": ["medical", "health", "biotech", "pharma"],
            "Finance": ["fintech", "banking", "investment", "financial services"],
            "Marketing": ["marketing", "advertising", "branding", "digital marketing"],
            "Education": ["learning", "edtech", "online course", "training"],
            "Consulting": ["consulting", "advisory", "strategy", "professional services"]
        };

        // Extract text for industry detection
        const textContent = $('body').text().toLowerCase();

        // Detect industry
        for (const [industry, keywords] of Object.entries(industryKeywords)) {
            if (keywords.some(keyword => textContent.includes(keyword))) {
                characteristics.industry = industry;
                break;
            }
        }

        // Company type detection
        const companyTypeKeywords = {
            "Startup": ["startup", "early-stage", "venture"],
            "Enterprise": ["enterprise", "global", "multinational"],
            "Small Business": ["small business", "local", "boutique"]
        };

        for (const [type, keywords] of Object.entries(companyTypeKeywords)) {
            if (keywords.some(keyword => textContent.includes(keyword))) {
                characteristics.companyType = type;
                break;
            }
        }

        // Company size estimation
        if (textContent.includes("team of") || textContent.includes("employees")) {
            const sizeMatch = textContent.match(/(\d+)\s*(?:to)?\s*(\d+)?\s*employees?/i);
            if (sizeMatch) {
                const size = parseInt(sizeMatch[1]);
                characteristics.size = size <= 10 ? "Small (1-10)" :
                                       size <= 50 ? "Medium (11-50)" :
                                       size <= 200 ? "Large (51-200)" : 
                                       "Enterprise (200+)";
            }
        }

        // Founded year detection
        const foundedMatch = textContent.match(/founded\s*(?:in)?\s*(\d{4})/i);
        if (foundedMatch) {
            characteristics.founded = parseInt(foundedMatch[1]);
        }

        // Key products/services extraction
        const productSelectors = [
            '.products',
            '.services',
            '#products',
            '#services',
            '*:contains("our products")',
            '*:contains("our services")'
        ];

        productSelectors.forEach(selector => {
            $(selector).each((i, el) => {
                const products = $(el).find('li, h3, h4').map((j, productEl) => 
                    $(productEl).text().trim()
                ).get();
                
                characteristics.keyProducts.push(...products);
            });
        });

        // Limit key products
        characteristics.keyProducts = [...new Set(characteristics.keyProducts)].slice(0, 5);

        return characteristics;
    }
}



module.exports = AdvancedCompanyProfileScraper;