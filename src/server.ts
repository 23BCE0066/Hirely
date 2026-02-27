import express from 'express';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = 3001;

const SERPAPI_KEY = process.env.SERPAPI_KEY;

if (!SERPAPI_KEY) {
    console.error('❌ SERPAPI_KEY is missing from .env file');
    process.exit(1);
}

// CORS middleware for development
app.use((_req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    next();
});

app.use(express.json());

// --- Google Jobs via SerpApi ---
app.get('/api/jobs/search', async (req, res) => {
    try {
        const query = (req.query.q as string) || 'Software Developer';
        const location = (req.query.location as string) || 'India';
        const maxPages = Math.min(parseInt(req.query.pages as string) || 1, 3); // Cap at 3 pages

        const allJobs: any[] = [];
        let nextPageToken: string | null = null;

        for (let page = 0; page < maxPages; page++) {
            // Build SerpApi URL
            // tbs: 'qdr:w' means past week, 'qdr:d' means past 24 hours. We use 'qdr:w' for a good mix of freshness and volume.
            const params = new URLSearchParams({
                engine: 'google_jobs',
                q: query,
                location: location,
                hl: 'en',
                tbs: 'qdr:w',
                api_key: SERPAPI_KEY,
            });

            if (nextPageToken) {
                params.set('next_page_token', nextPageToken);
            }

            const serpResponse = await fetch(`https://serpapi.com/search.json?${params.toString()}`);

            if (!serpResponse.ok) {
                const errorText = await serpResponse.text();
                console.error(`SerpApi error (page ${page + 1}):`, errorText);
                break;
            }

            const data = await serpResponse.json();
            const jobResults = data.jobs_results || [];

            // Normalize jobs for the frontend
            for (const job of jobResults) {
                // Extract apply link - prefer the first detected extension link
                let applyUrl = job.share_link || '';
                if (job.apply_options && job.apply_options.length > 0) {
                    applyUrl = job.apply_options[0].link || applyUrl;
                }

                // Extract source name
                let source = 'Google Jobs';
                if (job.via) {
                    source = job.via.replace('via ', '');
                }

                allJobs.push({
                    id: `serp_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
                    title: job.title || 'Untitled',
                    company: job.company_name || 'Unknown Company',
                    location: job.location || location,
                    type: detectJobType(job),
                    salary: extractSalary(job),
                    category: detectCategory(job.title || ''),
                    postedAt: job.detected_extensions?.posted_at || 'Recently',
                    description: job.description || 'No description available.',
                    logo: job.thumbnail || `https://ui-avatars.com/api/?name=${encodeURIComponent(job.company_name || 'C')}&background=6366f1&color=fff&size=100`,
                    isExternal: true,
                    externalUrl: applyUrl,
                    externalSource: source,
                });
            }

            // Check for next page
            nextPageToken = data.serpapi_pagination?.next_page_token || null;
            if (!nextPageToken) break;
        }

        console.log(`✅ Fetched ${allJobs.length} jobs for "${query}" in "${location}"`);

        res.json({
            success: true,
            count: allJobs.length,
            query,
            location,
            jobs: allJobs,
        });
    } catch (error: any) {
        console.error('❌ Error fetching jobs from SerpApi:', error.message);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch jobs',
            message: error.message,
        });
    }
});

// Health check
app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', serpApiConfigured: !!SERPAPI_KEY });
});

// --- AI Chatbot ---
import { GoogleGenAI } from '@google/genai';

app.post('/api/chat', async (req, res) => {
    try {
        const { message } = req.body;
        if (!message) {
            return res.status(400).json({ error: 'Message is required' });
        }

        const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
        if (!GEMINI_API_KEY) {
            // Provide a friendly fallback if the user hasn't setup the key yet
            return res.json({
                reply: "I am currently in setup mode! Please ask your administrator to add the `GEMINI_API_KEY` to the `.env` file so my neural nets can come online. 🤖"
            });
        }

        const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `You are Hirely AI, a highly professional, helpful, and concise recruiter assistant for an innovative job portal named Hirely. Keep your answers short (1-3 sentences) and friendly. 
            User says: ${message}`
        });

        res.json({ reply: response.text });
    } catch (error: any) {
        console.error('❌ Error in AI Chatbot:', error.message);
        res.status(500).json({ error: 'Failed to process chat message' });
    }
});

// --- Helper Functions ---

function detectJobType(job: any): string {
    const extensions = job.detected_extensions || {};
    const description = (job.description || '').toLowerCase();
    const title = (job.title || '').toLowerCase();

    if (extensions.schedule_type) return extensions.schedule_type;
    if (title.includes('intern')) return 'Internship';
    if (description.includes('full-time') || description.includes('full time')) return 'Full-time';
    if (description.includes('part-time') || description.includes('part time')) return 'Part-time';
    if (description.includes('contract')) return 'Contract';
    if (description.includes('remote')) return 'Remote';
    return 'Full-time';
}

function extractSalary(job: any): string {
    const extensions = job.detected_extensions || {};
    if (extensions.salary) return extensions.salary;

    // Try to extract from description
    const desc = job.description || '';
    const salaryMatch = desc.match(/(?:₹|Rs\.?|INR|USD|\$)\s*[\d,]+(?:\s*[-–to]+\s*(?:₹|Rs\.?|INR|USD|\$)?\s*[\d,]+)?(?:\s*(?:per|\/|p\.?)\s*(?:month|annum|year|hr|hour))?/i);
    if (salaryMatch) return salaryMatch[0];

    return 'Not specified';
}

function detectCategory(title: string): string {
    const t = title.toLowerCase();
    if (t.includes('engineer') || t.includes('developer') || t.includes('software') || t.includes('devops') || t.includes('backend') || t.includes('frontend') || t.includes('full stack')) return 'Engineering';
    if (t.includes('design') || t.includes('ui') || t.includes('ux') || t.includes('graphic')) return 'Design';
    if (t.includes('market') || t.includes('seo') || t.includes('content') || t.includes('social media')) return 'Marketing';
    if (t.includes('sales') || t.includes('business development') || t.includes('account')) return 'Sales';
    if (t.includes('product') || t.includes('project manager') || t.includes('scrum')) return 'Product';
    if (t.includes('data') || t.includes('analyst') || t.includes('machine learning') || t.includes('ai')) return 'Engineering';
    if (t.includes('intern')) return 'Engineering';
    return 'Other';
}

// Start server
app.listen(PORT, () => {
    console.log(`\n🚀 Hirely Backend Server running at http://localhost:${PORT}`);
    console.log(`📡 SerpApi endpoint: http://localhost:${PORT}/api/jobs/search?q=developer&location=India`);
    console.log(`❤️  Health check: http://localhost:${PORT}/api/health\n`);
});
