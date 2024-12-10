const axios = require('axios');
const cheerio = require('cheerio');
const puppeteer = require('puppeteer');
const { parse } = require('url');
const natural = require('natural');
const compromise = require('compromise');


// const browser = await puppeteer.launch({
//     headless: true,
//     args: ['--no-sandbox', '--disable-setuid-sandbox']
// });


class UltimateCompanyIntelligenceScraper {
    constructor(options = {}) {
        this.timeout = options.timeout || 30000;
        this.maxRetries = options.maxRetries || 3;
        
        this.tokenizer = new natural.WordTokenizer();
        this.sentimentAnalyzer = new natural.SentimentAnalyzer("English", natural.PorterStemmer, "afinn");
    }

    // Enhanced text cleaning and extraction
    cleanText(text) {
        // Remove extra whitespace, newlines, and trim
        return text.replace(/\s+/g, ' ')
                   .replace(/[\n\r]/g, ' ')
                   .trim();
    }

    // Improved text extraction with multiple fallback strategies
    extractCompanyDescription($) {
        const descriptionSelectors = [
            // Prioritized selectors for description
            'meta[property="og:description"]',
            'meta[name="description"]',
            '#company-description',
            '.company-description',
            'section.about-us',
            '#about-us',
            '.about-section p',
            'body p',
            'main p'
        ];

        for (const selector of descriptionSelectors) {
            let description = selector.startsWith('meta') 
                ? $(selector).attr('content') 
                : $(selector).first().text();
            
            description = this.cleanText(description);
            
            // Only return if description is meaningful (more than 30 characters)
            if (description && description.length > 30) {
                return description.substring(0, 500); // Limit to 500 characters
            }
        }

        return "Company description not found.";
    }

    // More intelligent company name extraction
    extractCompanyName($) {
        const nameStrategies = [
            () => $('h1').first().text().trim(),
            () => $('title').text().replace(/(\||-) .*$/, '').trim(),
            () => $('meta[property="og:site_name"]').attr('content'),
            () => $('meta[name="application-name"]').attr('content')
        ];

        for (const strategy of nameStrategies) {
            const name = strategy();
            if (name && name.length > 2 && name.length < 100) {
                return name;
            }
        }

        return "Unknown Company";
    }

    // Improved social link extraction
    extractSocialLinks($) {
        const socialPlatforms = {
            linkedin: ['linkedin.com/company', 'linkedin.com/in/'],
            twitter: ['twitter.com/', 'x.com/'],
            facebook: ['facebook.com/'],
            instagram: ['instagram.com/']
        };

        const socialLinks = {};

        $('a').each((i, elem) => {
            const href = $(elem).attr('href');
            if (href) {
                for (const [platform, patterns] of Object.entries(socialPlatforms)) {
                    if (patterns.some(pattern => href.toLowerCase().includes(pattern))) {
                        socialLinks[platform] = href;
                        break;
                    }
                }
            }
        });

        return socialLinks;
    }

    // More robust contact information extraction
    extractContactInfo($, pageText) {
        const contactRegex = {
            email: /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+)/gi,
            phone: /(?:\+\d{1,2}\s?)?(?:\(\d{3}\)|\d{3})[-.\s]?\d{3}[-.\s]?\d{4}/g
        };

        const extractedContacts = {
            email: null,
            phone: null
        };

        // Try meta tags first
        extractedContacts.email = $('meta[name="contact:email"]').attr('content') || 
                                   $('a[href^="mailto:"]').first().attr('href')?.replace('mailto:', '');

        // Scan page text for contacts if not found in meta
        if (!extractedContacts.email) {
            const emailMatches = pageText.match(contactRegex.email);
            extractedContacts.email = emailMatches ? emailMatches[0] : null;
        }

        const phoneMatches = pageText.match(contactRegex.phone);
        extractedContacts.phone = phoneMatches ? phoneMatches[0] : null;

        return extractedContacts;
    }

    // Enhanced industry detection with more nuanced categorization
    detectIndustry(text) {
        const industryKeywords = {
            'SaaS & Cloud': ['saas', 'cloud', 'software', 'platform', 'service', 'subscription'],
            'Telecommunications': ['telecom', 'phone', 'communication', 'voip', 'call', 'network'],
            'Artificial Intelligence': ['ai', 'machine learning', 'algorithm', 'intelligence', 'cognitive'],
            'Enterprise Software': ['enterprise', 'business', 'solution', 'management', 'workflow'],
            'Marketing Technology': ['marketing', 'crm', 'analytics', 'advertising', 'campaign'],
            'Cybersecurity': ['security', 'protect', 'threat', 'privacy', 'encryption'],
            'Productivity Tools': ['productivity', 'collaboration', 'team', 'workspace', 'efficiency']
        };

        const lowercaseText = text.toLowerCase();
        
        const industryMatches = Object.entries(industryKeywords)
            .map(([industry, keywords]) => ({
                industry,
                matchCount: keywords.filter(keyword => lowercaseText.includes(keyword)).length
            }))
            .filter(match => match.matchCount > 0)
            .sort((a, b) => b.matchCount - a.matchCount);

        return industryMatches.length > 0 ? industryMatches[0].industry : 'Technology';
    }

    // Comprehensive scraping method with enhanced error handling
    async scrapeCompanyIntelligence(url) {
        const companyIntel = {
            basicInfo: { url, name: null, description: null },
            digitalFootprint: { socialLinks: {}, contactInfo: {} },
            companyCharacteristics: { industry: null, communicationStyle: null },
            communicationProfile: { sentimentScore: null, keyMessageTopics: [] }
        };

        try {
            console.log('Puppeteer launch environment:', {
                NODE_ENV: process.env.NODE_ENV,
                PUPPETEER_EXECUTABLE_PATH: process.env.PUPPETEER_EXECUTABLE_PATH,
                DefaultExecutablePath: puppeteer.executablePath()
            });

            const browser = await puppeteer.launch({ 
                executablePath: process.env.NODE_ENV === "production" ? process.env.PUPPETEER_EXECUTABLE_PATH : puppeteer.executablePath(),
                args: [
                    '--no-sandbox', 
                    '--disable-setuid-sandbox', 
                    '--single-process',
                    '--no-zygote',
                ],
                dumpio: true
            });
            const page = await browser.newPage();
            
            await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
            await page.setExtraHTTPHeaders({
                'Accept-Language': 'en-US,en;q=0.9'
            });

            await page.goto(url, { 
                waitUntil: 'networkidle0', 
                timeout: this.timeout 
            });

            const content = await page.content();
            const $ = cheerio.load(content);
            const pageText = $('body').text();

            // Enhanced extraction methods
            companyIntel.basicInfo.name = this.extractCompanyName($);
            companyIntel.basicInfo.description = this.extractCompanyDescription($);
            companyIntel.digitalFootprint.socialLinks = this.extractSocialLinks($);
            companyIntel.digitalFootprint.contactInfo = this.extractContactInfo($, pageText);

            // Advanced text analysis
            const processedText = this.cleanText(companyIntel.basicInfo.description);
            
            if (processedText) {
                // Sentiment and NLP analysis
                const tokens = this.tokenizer.tokenize(processedText);
                companyIntel.communicationProfile.sentimentScore = 
                    this.sentimentAnalyzer.getSentiment(tokens);

                const doc = compromise(processedText);
                companyIntel.communicationProfile.keyMessageTopics = 
                    doc.nouns().out('array')
                       .filter(topic => topic.length > 2)
                       .slice(0, 5);

                // Detect communication and industry characteristics
                companyIntel.companyCharacteristics.industry = 
                    this.detectIndustry(processedText);

                const communicationStyles = [
                    { style: 'Technical', score: processedText.match(/\b(solution|technology|platform)\b/gi)?.length || 0 },
                    { style: 'Professional', score: processedText.match(/\b(service|expertise|quality|leader)\b/gi)?.length || 0 },
                    { style: 'Innovative', score: processedText.match(/\b(innovative|creative|cutting-edge)\b/gi)?.length || 0 }
                ];

                const dominantStyle = communicationStyles
                    .sort((a, b) => b.score - a.score)[0];
                
                companyIntel.companyCharacteristics.communicationStyle = 
                    dominantStyle.score > 0 ? dominantStyle.style : 'Neutral';
            }

            await browser.close();

            return companyIntel;
        } catch (error) {
            console.warn('Company intelligence scraping error:', error);
            return {
                error: 'Scraping failed',
                details: error.message,
                url
            };
        }
    }

    // Improved cold outreach strategy generation
    generateColdOutreachStrategy(companyIntel) {
        if (!companyIntel || companyIntel.error) {
            return null;
        }

        const outreachStrategy = {
            personalizedOpening: null,
            connectionPoints: [],
            potentialChallenges: [],
            recommendedApproach: null
        };

        const name = companyIntel.basicInfo.name || 'the company';
        const industry = companyIntel.companyCharacteristics.industry || 'your industry';

        // More nuanced personalized opening
        outreachStrategy.personalizedOpening = 
            `I was impressed by ${name}'s innovative approach in the ${industry} sector.`;

        // Intelligent connection points
        const keyTopics = companyIntel.communicationProfile.keyMessageTopics;
        outreachStrategy.connectionPoints = [
            ...(keyTopics.length > 0 
                ? [`Your strategic focus on ${keyTopics.slice(0, 2).join(' and ')}`] 
                : []),
            `The evolving challenges in ${industry}`
        ];

        // Potential engagement challenges
        outreachStrategy.potentialChallenges = [
            `Navigating transformation in ${industry}`,
            ...(keyTopics.length > 0 
                ? [`Addressing innovative approaches to ${keyTopics[0]}`] 
                : [])
        ];

        // Tailored communication approach
        const communicationStyle = companyIntel.companyCharacteristics.communicationStyle || 'Professional';
        const sentimentScore = companyIntel.communicationProfile.sentimentScore || 0;

        outreachStrategy.recommendedApproach = 
            `Considering your ${communicationStyle.toLowerCase()} communication style, ` +
            `a ${sentimentScore > 0 ? 'collaborative and insightful' : 'direct and value-driven'} approach would likely resonate most effectively.`;

        return outreachStrategy;
    }
}

module.exports = UltimateCompanyIntelligenceScraper;

