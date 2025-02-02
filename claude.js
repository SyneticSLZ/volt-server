const axios = require('axios');
const cheerio = require('cheerio');
const compromise = require('compromise');
const natural = require('natural');

class WebScraper {
    constructor(options = {}) {
        // Core configuration
        this.config = {
            timeout: options.timeout || 30000,
            maxRetries: options.maxRetries || 3,
            retryDelay: options.retryDelay || 2000,
            rateLimitDelay: options.rateLimitDelay || 3000,
            userAgents: [
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.1 Safari/605.1.15',
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:90.0) Gecko/20100101 Firefox/90.0'
            ],
            headers: {
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9',
                'Accept-Encoding': 'gzip, deflate, br',
                'DNT': '1',
                'Connection': 'keep-alive',
                'Upgrade-Insecure-Requests': '1'
            }
        };

        // Rate limiting state
        this.lastRequestTime = 0;

        // Initialize NLP tools
        this.tokenizer = new natural.WordTokenizer();
        this.sentiment = new natural.SentimentAnalyzer('English', natural.PorterStemmer, 'afinn');
        this.TfIdf = natural.TfIdf;
        this.stemmer = natural.PorterStemmer;
        
        // For keyword extraction and topic modeling
        this.stopWords = new Set([
            'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from', 'has', 'he',
            'in', 'is', 'it', 'its', 'of', 'on', 'that', 'the', 'to', 'was', 'were',
            'will', 'with', 'the', 'this', 'but', 'they', 'have', 'had', 'what', 'when',
            'where', 'who', 'which', 'why', 'how', 'all', 'any', 'both', 'each', 'few',
            'more', 'most', 'other', 'some', 'such', 'no', 'nor', 'not', 'only', 'own',
            'same', 'so', 'than', 'too', 'very'
        ]);

        // Industry and company patterns
        this.industryKeywords = {
            'Technology': ['software', 'tech', 'digital', 'IT', 'computer', 'web', 'cloud', 'saas', 'platform'],
            'E-commerce': ['shop', 'store', 'retail', 'commerce', 'marketplace', 'buy', 'sell'],
            'Finance': ['bank', 'finance', 'investment', 'trading', 'fintech', 'insurance'],
            'Healthcare': ['health', 'medical', 'healthcare', 'wellness', 'pharma', 'biotech'],
            'Education': ['education', 'learning', 'training', 'school', 'course', 'teach'],
            'Marketing': ['marketing', 'advertising', 'media', 'brand', 'PR', 'promotion']
        };

        // Social media patterns
        this.socialPatterns = {
            facebook: ['facebook.com', 'fb.com'],
            twitter: ['twitter.com', 'x.com'],
            linkedin: ['linkedin.com'],
            instagram: ['instagram.com'],
            youtube: ['youtube.com'],
            github: ['github.com'],
            tiktok: ['tiktok.com']
        };
    }

    // Delay utility for rate limiting
    async _delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // Rate limiting mechanism
    async _respectRateLimit() {
        const now = Date.now();
        const timeSinceLastRequest = now - this.lastRequestTime;
        
        if (timeSinceLastRequest < this.config.rateLimitDelay) {
            await this._delay(this.config.rateLimitDelay - timeSinceLastRequest);
        }
        
        this.lastRequestTime = Date.now();
    }

    // Get random user agent
    _getRandomUserAgent() {
        return this.config.userAgents[Math.floor(Math.random() * this.config.userAgents.length)];
    }

    // Clean text utility
    _cleanText(text) {
        if (!text) return '';
        return text
            .replace(/\s+/g, ' ')           // Normalize whitespace
            .replace(/[\n\r\t]/g, ' ')      // Remove newlines and tabs
            .replace(/\s{2,}/g, ' ')        // Remove excessive spaces
            .replace(/[^\x00-\x7F]/g, '')   // Remove non-ASCII characters
            .trim();
    }

    // Fetch with retry logic
    async _fetchWithRetry(url) {
        let lastError;
        
        for (let attempt = 0; attempt < this.config.maxRetries; attempt++) {
            try {
                // Respect rate limiting
                await this._respectRateLimit();

                // Prepare headers with random user agent
                const headers = {
                    ...this.config.headers,
                    'User-Agent': this._getRandomUserAgent()
                };

                // Make request
                const response = await axios.get(url, {
                    headers,
                    timeout: this.config.timeout
                });

                return response.data;
            } catch (error) {
                lastError = error;
                
                // Don't retry on 4xx errors (except 429 Too Many Requests)
                if (error.response && error.response.status < 500 && error.response.status !== 429) {
                    throw error;
                }

                // Exponential backoff
                const delay = this.config.retryDelay * Math.pow(2, attempt);
                await this._delay(delay);
            }
        }

        throw lastError;
    }

    // Basic health check of a URL
    async checkUrl(url) {
        try {
            const response = await axios.head(url, {
                timeout: 5000,
                headers: { 'User-Agent': this._getRandomUserAgent() }
            });
            return {
                status: response.status,
                accessible: true,
                contentType: response.headers['content-type']
            };
        } catch (error) {
            return {
                status: error.response?.status,
                accessible: false,
                error: error.message
            };
        }
    }

        // Extract meta tags
    _extractMetaTags($) {
        const metaTags = {
            general: {},
            openGraph: {},
            twitter: {},
            dublin: {},
            article: {},
            product: {},
            business: {}
        };

        // General meta tags
        $('meta').each((_, elem) => {
            const name = $(elem).attr('name') || $(elem).attr('property');
            const content = $(elem).attr('content');
            
            if (name && content) {
                if (name.startsWith('og:')) {
                    metaTags.openGraph[name.replace('og:', '')] = content;
                } else if (name.startsWith('twitter:')) {
                    metaTags.twitter[name.replace('twitter:', '')] = content;
                } else if (name.startsWith('dc:')) {
                    metaTags.dublin[name.replace('dc:', '')] = content;
                } else if (name.startsWith('article:')) {
                    metaTags.article[name.replace('article:', '')] = content;
                } else if (name.startsWith('product:')) {
                    metaTags.product[name.replace('product:', '')] = content;
                } else if (name.startsWith('business:')) {
                    metaTags.business[name.replace('business:', '')] = content;
                } else {
                    metaTags.general[name] = content;
                }
            }
        });

        return metaTags;
    }

    // Extract JSON-LD data
    _extractJSONLD($) {
        const jsonLdData = [];
        $('script[type="application/ld+json"]').each((_, elem) => {
            try {
                const data = JSON.parse($(elem).html());
                jsonLdData.push(data);
            } catch (error) {
                console.warn('Failed to parse JSON-LD:', error.message);
            }
        });
        return jsonLdData;
    }

    // Extract company name using multiple strategies
    _extractCompanyName($, metaTags) {
        const strategies = [
            // Strategy 1: Check structured data
            () => {
                const jsonLd = this._extractJSONLD($);
                return jsonLd.find(data => data?.organization?.name || data?.name)?.organization?.name || 
                       jsonLd.find(data => data?.organization?.name || data?.name)?.name;
            },
            // Strategy 2: Check meta tags
            () => {
                return metaTags.openGraph.site_name || 
                       metaTags.general['application-name'] ||
                       metaTags.general['company-name'];
            },
            // Strategy 3: Check common header elements
            () => {
                return $('.logo, .brand, .company-name, header .name').first().text().trim() ||
                       $('header h1').first().text().trim();
            },
            // Strategy 4: Parse from title
            () => {
                const title = $('title').text().trim();
                return title.split(/[\-\|]/)[0].trim();
            }
        ];

        for (const strategy of strategies) {
            const name = strategy();
            if (name && name.length > 1 && name.length < 100) {
                return name;
            }
        }

        return null;
    }

    // Extract contact information
    _extractContactInfo($) {
        const contactInfo = {
            emails: [],
            phones: [],
            addresses: [],
            contact_pages: []
        };
    
        // Enhanced email detection
        const emailPatterns = [
            /\b[\w\.-]+@[\w\.-]+\.\w{2,}\b/g,  // Basic email
            /(?:mailto:)([\w\.-]+@[\w\.-]+\.\w{2,})/g,  // Mailto links
            /(?:email|contact|e-mail)(?:\s?(?:us|me)?(?:\s?at|@|\[at\]|\(at\))\s?)([\w\.-]+(?:\s?(?:@|\[at\]|\(at\))\s?|\s+at\s+)[\w\.-]+\.\w{2,})/gi  // Email with "at" text
        ];
    
        // Check multiple sources for emails
        const sources = [
            $('body').text(),  // Full text
            $('a[href^="mailto:"]').attr('href'),  // Mailto links
            $('a:contains("email"), a:contains("contact")').text(),  // Contact links
            $('.contact, .footer, [class*="contact"], [class*="footer"]').text()  // Contact sections
        ];
    
        sources.forEach(source => {
            if (!source) return;
            emailPatterns.forEach(pattern => {
                const matches = source.match(pattern) || [];
                matches.forEach(email => {
                    const cleanEmail = email.toLowerCase()
                        .replace(/\s+at\s+/, '@')
                        .replace(/\[at\]|\(at\)/, '@')
                        .replace(/^mailto:/, '');
                    
                    if (this._isValidEmail(cleanEmail)) {
                        contactInfo.emails.push(cleanEmail);
                    }
                });
            });
        });
    
        // Enhanced phone detection
        const phonePatterns = [
            /\+?\d{1,4}[-.\s]?\(?\d{1,3}\)?[-.\s]?\d{1,4}[-.\s]?\d{1,4}/g,  // International
            /\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g,  // US/Canada
            /\+\d{10,}/g,  // Plain international
            /(?:tel|phone|call)(?:\s*(?::|\())?\s*([+\d\s.-]{10,})/gi  // With prefix
        ];
    
        sources.forEach(source => {
            if (!source) return;
            phonePatterns.forEach(pattern => {
                const matches = source.match(pattern) || [];
                matches.forEach(phone => {
                    const cleanPhone = phone.replace(/[^\d+]/g, '');
                    if (cleanPhone.length >= 10) {
                        contactInfo.phones.push(cleanPhone);
                    }
                });
            });
        });
    
        // Remove duplicates and filter invalid entries
        contactInfo.emails = [...new Set(contactInfo.emails)]
            .filter(email => 
                !email.includes('example.com') && 
                !email.includes('domain.com') &&
                !email.includes('yourcompany') &&
                email.length < 100
            );
    
        contactInfo.phones = [...new Set(contactInfo.phones)]
            .filter(phone => phone.length >= 10 && phone.length <= 15);
    
        return contactInfo;
    }

    // Helper method to validate email
    _isValidEmail(email) {
        const emailRegex = /^[\w\.-]+@[\w\.-]+\.\w{2,}$/;
        return emailRegex.test(email) && 
            email.length < 100 &&
            !email.includes('example.com') &&
            !email.includes('domain.com');
    }

    // Extract social media links
    _extractSocialMedia($, baseUrl) {
        const socialLinks = {};
        
        // Enhanced selectors
        const socialSelectors = [
            'a[href*="linkedin"]', 
            'a[href*="twitter"]', 
            'a[href*="facebook"]',
            'a[href*="instagram"]',
            '.social a',  // Common class for social links
            '[class*="social"] a',  // Partial class match
            'footer a[href*="social"]',  // Footer social links
            'nav a[href*="social"]'  // Navigation social links
        ];
    
        socialSelectors.forEach(selector => {
            $(selector).each((_, elem) => {
                const href = $(elem).attr('href');
                if (!href) return;
    
                try {
                    const fullUrl = href.startsWith('http') ? href : new URL(href, baseUrl).href;
                    
                    // Check against social patterns
                    for (const [platform, domains] of Object.entries(this.socialPatterns)) {
                        if (domains.some(domain => fullUrl.toLowerCase().includes(domain))) {
                            socialLinks[platform] = fullUrl;
                        }
                    }
                } catch (error) {
                    console.warn('Invalid social URL:', href);
                }
            });
        });
    
        return socialLinks;
    }

    // Detect industry based on content
    _detectIndustry(text) {
        const matches = {};
        const lowercaseText = text.toLowerCase();

        for (const [industry, keywords] of Object.entries(this.industryKeywords)) {
            matches[industry] = keywords.filter(keyword => 
                lowercaseText.includes(keyword.toLowerCase())
            ).length;
        }

        // Get industry with most matches
        const topIndustry = Object.entries(matches)
            .sort(([,a], [,b]) => b - a)
            .filter(([,count]) => count > 0)[0];

        return topIndustry ? topIndustry[0] : 'Other';
    }

    _checkForFrameworks($) {
        const frameworkSignatures = {
            'React': [/react/, /jsx/, /_jsx/, /createElement/],
            'Vue.js': [/vue/, /v-[\w]+/, /Vue\./, /nuxt/],
            'Angular': [/angular/, /ng-[\w]+/, /\[\(ngModel\)\]/],
            'Next.js': [/next\//, /_next\//, /useRouter/],
            'Remix': [/remix/, /__remix/],
            'Svelte': [/svelte/, /SvelteComponent/],
            'jQuery': [/jquery/, /\$\(/, /\.ready\(/],
            'Tailwind': [/tailwind/, /tw-/],
            'Bootstrap': [/bootstrap/, /navbar-/, /btn-/]
        };
    
        const detectedFrameworks = [];
    
        // Check both script contents and class names
        const allScripts = $('script').map((_, el) => $(el).text()).get().join(' ');
        const allClasses = $('[class]').map((_, el) => $(el).attr('class')).get().join(' ');
    
        Object.entries(frameworkSignatures).forEach(([framework, patterns]) => {
            if (patterns.some(pattern => 
                pattern.test(allScripts) || 
                pattern.test(allClasses) ||
                pattern.test($('html').html())
            )) {
                detectedFrameworks.push(framework);
            }
        });
    
        return detectedFrameworks;
    }



    _extractTechnologies($) {
    const technologies = {
        analytics: [],
        frameworks: [],
        hosting: [],
        cms: [],
        marketing: [],
        payment: [],
        security: [],
        libraries: [],
        infrastructure: []
    };

    // Technology signatures
    const signatures = {
        analytics: {
            'Google Analytics': [/google-analytics\.com/, /gtag/, /ga\.js/, 'G-', 'UA-'],
            'Hotjar': [/hotjar/, /hj\.js/],
            'Mixpanel': [/mixpanel/],
            'Segment': [/segment\.com/, /analytics\.js/],
            'Plausible': [/plausible\.io/],
            'Amplitude': [/amplitude\.com/],
            'Heap': [/heap-analytics/],
            'Logrocket': [/logrocket/]
        },
        frameworks: {
            'React': [/react/, /jsx/, /_jsx/, /createElement/, 'useEffect', 'useState'],
            'Vue.js': [/vue/, /v-[\w]+/, /Vue\./, /nuxt/, 'v-bind', 'v-model'],
            'Angular': [/angular/, /ng-[\w]+/, /\[\(ngModel\)\]/, 'ng-controller'],
            'Next.js': [/next\//, /_next\//, /useRouter/, '__NEXT_DATA__'],
            'Remix': [/remix/, /__remix/, 'remix-run'],
            'Svelte': [/svelte/, /SvelteComponent/],
            'jQuery': [/jquery/, /\$\(/, /\.ready\(/],
            'Tailwind': [/tailwind/, /tw-/, 'space-x-', 'space-y-'],
            'Bootstrap': [/bootstrap/, /navbar-/, /btn-/, 'container-fluid']
        },
        cms: {
            'WordPress': [/wp-content/, /wp-includes/, /wp-json/],
            'Webflow': [/webflow/, 'w-'],
            'Shopify': [/shopify/, /myshopify/],
            'Wix': [/wix\.com/, 'wix-'],
            'Squarespace': [/squarespace/, 'sqsp-'],
            'Ghost': [/ghost\.io/, 'ghost-'],
            'Contentful': [/contentful/],
            'Strapi': [/strapi/]
        },
        payment: {
            'Stripe': [/stripe\.com/, 'stripe.js', /Stripe\(/],
            'PayPal': [/paypal/, 'braintree'],
            'Square': [/squareup/, 'square.js'],
            'Shopify Payments': [/shop\.app/, 'shopifypaymentsapi'],
            'Paddle': [/paddle\.js/, 'paddle.com'],
            'Gumroad': [/gumroad/]
        },
        marketing: {
            'HubSpot': [/hubspot/, 'hs-'],
            'Mailchimp': [/mailchimp/, 'mc_'],
            'Intercom': [/intercom/, 'intercomSettings'],
            'Drift': [/drift\.com/, 'drift-'],
            'Zendesk': [/zendesk/, 'zd-'],
            'Crisp': [/crisp\.chat/],
            'Tawk.to': [/tawk\.to/],
            'SendGrid': [/sendgrid/]
        },
        security: {
            'Cloudflare': [/cloudflare/, '__cf_'],
            'reCAPTCHA': [/recaptcha/, 'g-recaptcha'],
            'hCaptcha': [/hcaptcha/],
            'Auth0': [/auth0\.js/, 'auth0.com'],
            'OAuth': [/oauth/],
            'Okta': [/okta/]
        },
        infrastructure: {
            'AWS': [/aws-/, /amazonaws\.com/],
            'Vercel': [/vercel\.app/, /_vercel/],
            'Netlify': [/netlify/, 'netlify-'],
            'Heroku': [/herokuapp\.com/],
            'DigitalOcean': [/digitalocean/],
            'Cloudflare': [/cloudflare/, 'cf-']
        },
        libraries: {
            'Lodash': [/lodash/, '_\.'],
            'Moment.js': [/moment\.js/, 'moment('],
            'Axios': [/axios/],
            'Chart.js': [/chart\.js/, 'Chart('],
            'Three.js': [/three\.js/, 'THREE.'],
            'D3.js': [/d3\.js/, 'd3.'],
            'Socket.io': [/socket\.io/]
        }
    };

    // Check HTML content
    const htmlContent = $('html').html();
    const scriptContents = $('script').map((_, el) => $(el).text()).get().join(' ');
    const linkHrefs = $('link').map((_, el) => $(el).attr('href')).get().join(' ');
    const scriptSrcs = $('script').map((_, el) => $(el).attr('src')).get().join(' ');
    const allClasses = $('[class]').map((_, el) => $(el).attr('class')).get().join(' ');
    const metaTags = $('meta').map((_, el) => $(el).attr('content')).get().join(' ');

    const contentToCheck = [
        htmlContent,
        scriptContents,
        linkHrefs,
        scriptSrcs,
        allClasses,
        metaTags
    ].join(' ');

    // Check for technology signatures
    Object.entries(signatures).forEach(([category, techList]) => {
        Object.entries(techList).forEach(([techName, patterns]) => {
            const hasMatch = patterns.some(pattern => {
                if (typeof pattern === 'string') {
                    return contentToCheck.includes(pattern);
                }
                return pattern.test(contentToCheck);
            });

            if (hasMatch && !technologies[category].includes(techName)) {
                technologies[category].push(techName);
            }
        });
    });

    // Additional custom checks
    
    // Check for Google Tag Manager
    if ($('script[src*="googletagmanager"]').length || contentToCheck.includes('gtm.js')) {
        technologies.analytics.push('Google Tag Manager');
    }

    // Check for meta generator tag
    const generator = $('meta[name="generator"]').attr('content');
    if (generator) {
        technologies.cms.push(generator.split(' ')[0]);
    }

    // Check for PWA capabilities
    if ($('link[rel="manifest"]').length) {
        technologies.infrastructure.push('Progressive Web App');
    }

    // Check for SPA indicators
    if (contentToCheck.includes('router') || contentToCheck.includes('history.pushState')) {
        technologies.infrastructure.push('Single Page Application');
    }

    // Remove duplicates and sort
    Object.keys(technologies).forEach(category => {
        technologies[category] = [...new Set(technologies[category])].sort();
    });

    // Clean empty categories
    Object.keys(technologies).forEach(category => {
        if (technologies[category].length === 0) {
            delete technologies[category];
        }
    });

    return technologies;
}
    
    // Helper method to check technology patterns
    _checkTechnologyPatterns(text, technologies, allPatterns) {
        if (!text) return;
    
        // Check each category
        Object.entries(allPatterns).forEach(([category, patterns]) => {
            // Make sure the category exists in technologies
            if (!technologies[category]) {
                technologies[category] = [];
            }
    
            // Check each technology in the category
            Object.entries(patterns).forEach(([tech, regexPatterns]) => {
                if (regexPatterns.some(pattern => pattern.test(text))) {
                    technologies[category].push(tech);
                }
            });
        });
    }

    // Extract important keywords using TF-IDF
    _extractKeywords(text, numKeywords = 10) {
        try {
            const tfidf = new this.TfIdf();
            
            // Add the document
            tfidf.addDocument(text);
            
            // Get all terms with their weights
            const terms = [];
            tfidf.listTerms(0).forEach(item => {
                // Filter out stop words and short terms
                if (!this.stopWords.has(item.term) && item.term.length > 2) {
                    terms.push(item);
                }
            });
            
            // Sort by weight and get top N keywords
            return terms
                .sort((a, b) => b.tfidf - a.tfidf)
                .slice(0, numKeywords)
                .map(item => ({
                    term: item.term,
                    score: item.tfidf
                }));
        } catch (error) {
            console.warn('Keyword extraction failed:', error);
            return [];
        }
    }

    // Extract topics using basic clustering
    _extractTopics(text, numTopics = 5) {
        try {
            const words = text.toLowerCase()
                .split(/\W+/)
                .filter(word => 
                    word.length > 2 && 
                    !this.stopWords.has(word)
                );

            // Create word frequency map
            const wordFreq = {};
            words.forEach(word => {
                const stem = this.stemmer.stem(word);
                wordFreq[stem] = (wordFreq[stem] || 0) + 1;
            });

            // Convert to array and sort by frequency
            const topics = Object.entries(wordFreq)
                .sort(([,a], [,b]) => b - a)
                .slice(0, numTopics)
                .map(([word, freq]) => ({
                    topic: word,
                    frequency: freq,
                    score: freq / words.length
                }));

            return topics;
        } catch (error) {
            console.warn('Topic extraction failed:', error);
            return [];
        }
    }

    // Analyze text readability using Flesch-Kincaid
    _analyzeReadability(text) {
        try {
            // Split into sentences and words
            const sentences = text.split(/[.!?]+/);
            const words = text.split(/\s+/).filter(word => word.length > 0);
            const syllables = words.reduce((count, word) => {
                return count + this._countSyllables(word);
            }, 0);

            // Calculate Flesch-Kincaid Grade Level
            const avgSentenceLength = words.length / sentences.length;
            const avgSyllablesPerWord = syllables / words.length;
            const gradeLevel = 0.39 * avgSentenceLength + 11.8 * avgSyllablesPerWord - 15.59;

            return {
                sentences: sentences.length,
                words: words.length,
                syllables,
                gradeLevel: Math.round(gradeLevel * 10) / 10,
                avgSentenceLength: Math.round(avgSentenceLength * 10) / 10,
                avgSyllablesPerWord: Math.round(avgSyllablesPerWord * 10) / 10
            };
        } catch (error) {
            console.warn('Readability analysis failed:', error);
            return null;
        }
    }

    // Helper function to count syllables
    _countSyllables(word) {
        word = word.toLowerCase();
        if (word.length <= 3) return 1;
        
        word = word.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '');
        word = word.replace(/^y/, '');
        const syllables = word.match(/[aeiouy]{1,2}/g);
        return syllables ? syllables.length : 1;
    }

    // Enhanced industry detection with confidence score
    _detectIndustryEnhanced(text) {
        // Enhanced industry keywords
        this.industryKeywords = {
            'Technology & SaaS': [
                'software', 'tech', 'digital', 'IT', 'computer', 'web', 'cloud', 'saas', 'platform',
                'automation', 'api', 'integration', 'data', 'analytics', 'ai', 'machine learning'
            ],
            'Marketing & Advertising': [
                'marketing', 'advertising', 'media', 'brand', 'PR', 'promotion', 'seo', 'content',
                'social media', 'campaign', 'audience', 'outreach', 'leads', 'engagement'
            ],
            'E-commerce': [
                'shop', 'store', 'retail', 'commerce', 'marketplace', 'buy', 'sell', 'product',
                'inventory', 'shopping', 'cart', 'checkout', 'merchant', 'payment'
            ],
            'Business Services': [
                'consulting', 'service', 'solution', 'business', 'professional', 'management',
                'strategy', 'optimization', 'efficiency', 'productivity', 'workflow'
            ],
            'Financial Services': [
                'bank', 'finance', 'investment', 'trading', 'fintech', 'insurance', 'payment',
                'transaction', 'money', 'capital', 'credit', 'lending'
            ]
        };
    
        const matches = {};
        const terms = text.toLowerCase().split(/\W+/);
        const totalTerms = terms.length;
    
        // Context-aware scoring
        const contextMultipliers = {
            'title': 2.0,
            'description': 1.5,
            'heading': 1.3,
            'body': 1.0
        };
    
        for (const [industry, keywords] of Object.entries(this.industryKeywords)) {
            const matchedKeywords = new Set();
            let weightedFrequency = 0;
    
            keywords.forEach(keyword => {
                // Check for exact matches and partial matches
                const keywordParts = keyword.toLowerCase().split(' ');
                const isMatch = keywordParts.every(part => terms.includes(part));
                
                if (isMatch) {
                    matchedKeywords.add(keyword);
                    
                    // Calculate frequency with context
                    const keywordFrequency = terms.filter(term => term === keywordParts[0]).length;
                    const contextScore = this._getContextScore(text, keyword);
                    weightedFrequency += keywordFrequency * contextScore;
                }
            });
    
            if (matchedKeywords.size > 0) {
                matches[industry] = {
                    matchCount: matchedKeywords.size,
                    frequency: weightedFrequency,
                    confidence: (weightedFrequency / totalTerms) * (matchedKeywords.size / keywords.length),
                    matchedTerms: Array.from(matchedKeywords)
                };
            }
        }
    
        // Get top industries with enhanced scoring
        const topIndustries = Object.entries(matches)
            .sort(([,a], [,b]) => b.confidence - a.confidence)
            .map(([industry, stats]) => ({
                industry,
                confidence: Math.round(stats.confidence * 100) / 100,
                matchedKeywords: stats.matchCount,
                keyTerms: stats.matchedTerms
            }))
            .slice(0, 3);
    
        return topIndustries.length > 0 ? 
            topIndustries : 
            [{ industry: 'Other', confidence: 0, matchedKeywords: 0, keyTerms: [] }];
    }
    
    // Helper method for context scoring
    _getContextScore(text, keyword) {
        const titleMultiplier = text.toLowerCase().includes(keyword.toLowerCase()) ? 2 : 1;
        return titleMultiplier;
    }

    // Extract potential product/service offerings
    _extractOfferings($, text) {
        const offerings = {
            products: [],
            services: [],
            features: []
        };
    
        // Look for pricing sections
        $('*:contains("$"), *:contains("Price"), *:contains("Membership"), *:contains("Plan")').each((_, section) => {
            const priceMatch = $(section).text().match(/\$(\d+(?:,\d{3})*(?:\.\d{2})?)\s*(?:\/\s*(?:Month|mo|year|yr))?/i);
            if (priceMatch) {
                const surroundingText = $(section).closest('div').text().split('\n')[0];
                if (surroundingText.length > 0 && surroundingText.length < 200) {
                    offerings.products.push(this._cleanText(surroundingText));
                }
            }
        });
    
        // Extract features from bullet points and lists more precisely
        $('ul li, ol li').each((_, elem) => {
            const text = $(elem).text().trim();
            if (text.length > 10 && text.length < 200 && !this.stopWords.has(text.toLowerCase())) {
                offerings.features.push(this._cleanText(text));
            }
        });
    
        // Look for service indicators
        $('*:contains("Service"), *:contains("Solution")').each((_, elem) => {
            const text = $(elem).text().trim();
            if (text.length > 10 && text.length < 200) {
                const serviceText = this._cleanText(text);
                if (!offerings.services.includes(serviceText)) {
                    offerings.services.push(serviceText);
                }
            }
        });
    
        // Cleanup and deduplicate
        return {
            products: [...new Set(offerings.products)]
                .filter(p => p.length > 5 && p.length < 200)
                .slice(0, 5),
            services: [...new Set(offerings.services)]
                .filter(s => s.length > 5 && s.length < 200)
                .slice(0, 5),
            features: [...new Set(offerings.features)]
                .filter(f => f.length > 5 && f.length < 200)
                .slice(0, 10)
        };
    }
    // Extract possible business locations
    _extractLocations($, text) {
        const locations = new Set();
        
        // Enhanced location patterns
        const locationPatterns = [
            /(?:headquartered|based|located|office)(?:\s+in\s+)([A-Za-z\s,]{2,50})/gi,
            /(?:locations?|offices?)(?:\s*:?\s*)([A-Za-z\s,]{2,50})/gi,
            /([A-Za-z]+(?:\s*,\s*[A-Za-z]+)*(?:\s+\d{5})?)/g  // City, State ZIP pattern
        ];
    
        // Exclude common navigation/footer terms
        const excludeTerms = ['about', 'contact', 'privacy', 'policy', 'terms', 'blog', 'resources', 
                             'features', 'solutions', 'products', 'directory'];
    
        // Extract locations
        $('[class*="location"], [class*="address"], address').each((_, elem) => {
            const text = $(elem).text().trim();
            if (text.length > 0) {
                locations.add(text);
            }
        });
    
        // Process location patterns
        locationPatterns.forEach(pattern => {
            const matches = text.matchAll(pattern);
            for (const match of matches) {
                if (match[1]) {
                    const location = this._cleanText(match[1]);
                    if (location.length > 2 && 
                        location.length < 50 && 
                        !excludeTerms.some(term => location.toLowerCase().includes(term))) {
                        locations.add(location);
                    }
                }
            }
        });
    
        return [...locations]
            .filter(loc => {
                const locLower = loc.toLowerCase();
                return loc.length > 2 && 
                       loc.length < 50 && 
                       !excludeTerms.some(term => locLower.includes(term)) &&
                       !/^[0-9\s]*$/.test(loc); // Exclude numeric-only strings
            })
            .slice(0, 5);
    }

    // Extract favicon
    _extractFavicon($, baseUrl) {
        try {
        const faviconSelectors = [
            'link[rel="icon"]',
            'link[rel="shortcut icon"]',
            'link[rel="apple-touch-icon"]',
            'link[rel="apple-touch-icon-precomposed"]'
        ];

        for (const selector of faviconSelectors) {
            const favicon = $(selector).attr('href');
            if (favicon) {
                // Handle relative URLs
                return favicon.startsWith('http') 
                    ? favicon 
                    : new URL(favicon, baseUrl).href;
            }
        }

        // Default favicon location as fallback
        return new URL('/favicon.ico', baseUrl).href;
    } catch (error) {
        console.warn('Favicon extraction failed:', error);
        return null;
    }
}

    // Main scraping method
    async scrape(url) {
        let $ = null;
        try {
            if (!url || typeof url !== 'string') {
                throw new Error('Invalid URL provided');
            }

            // Validate URL format
            if (!url.startsWith('http')) {
                url = 'https://' + url;
            }

            // Initial health check
            const health = await this.checkUrl(url);
            if (!health.accessible) {
                throw new Error(`URL not accessible: ${health.error}`);
            }

            // Fetch page content
            const html = await this._fetchWithRetry(url);
            $ = cheerio.load(html);

            // Extract all data
            const metaTags = this._extractMetaTags($);
            const jsonLdData = this._extractJSONLD($);
            const favicon = this._extractFavicon($, url);

            // Basic semantic extraction
            const title = $('title').text().trim() || metaTags.openGraph.title || metaTags.general.title;
            const description = metaTags.general.description || metaTags.openGraph.description || '';
            
            // Get main content text
            const mainText = $('main, article, [role="main"]')
                .first()
                .text()
                .trim() || $('body').text().trim();

            const cleanMainText = this._cleanText(mainText).substring(0, 5000); // Limit text length

            // Extract company information
            const companyName = this._extractCompanyName($, metaTags);
            const contactInfo = this._extractContactInfo($);
            const socialMedia = this._extractSocialMedia($, url);
            const technologies = this._extractTechnologies($);
            const industry = this._detectIndustry(cleanMainText + ' ' + description);

            // Perform sentiment analysis on main content
            const tokens = this.tokenizer.tokenize(cleanMainText);
            const sentimentScore = this.sentiment.getSentiment(tokens);

            // Advanced content analysis
            const keywords = this._extractKeywords(cleanMainText);
            const topics = this._extractTopics(cleanMainText);
            const readability = this._analyzeReadability(cleanMainText);
            const industryAnalysis = this._detectIndustryEnhanced(cleanMainText + ' ' + description);
            const offerings = this._extractOfferings($, cleanMainText);
            const locations = this._extractLocations($, cleanMainText);

            return {
                url,
                status: 'success',
                timestamp: new Date().toISOString(),
                basicInfo: {
                    title,
                    companyName,
                    description,
                    favicon,
                    language: $('html').attr('lang') || metaTags.general['language'] || 'en',
                    industryAnalysis,
                    locations
                },
                metaData: {
                    meta: metaTags,
                    jsonLd: jsonLdData
                },
                contactInfo: {
                    ...contactInfo,
                    social: socialMedia
                },
                technical: {
                    technologies,
                    ssl: url.startsWith('https'),
                    mobileFriendly: metaTags.general['viewport'] ? true : false
                },
                textContent: {
                    main: cleanMainText,
                    wordCount: cleanMainText.split(/\s+/).length,
                    sentiment: sentimentScore,
                    readability,
                    keywords,
                    topics
                },
                businessInfo: {
                    offerings,
                    locations
                }
            };

        } catch (error) {
            return {
                url,
                status: 'error',
                error: error.message,
                timestamp: new Date().toISOString()
            };
        }
    }
}

module.exports = WebScraper;

// Example usage:
// const scraper = new WebScraper();
// scraper.scrape('example.com')
//     .then(result => console.log(result))
//     .catch(error => console.error(error));