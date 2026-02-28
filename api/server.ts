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
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    if (_req.method === 'OPTIONS') { res.sendStatus(200); return; }
    next();
});

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// --- MongoDB Connection ---
import { MongoClient, Db } from 'mongodb';

const MONGODB_URI = process.env.MONGODB_URI || '';
let cachedDb: Db | null = null;
let clientPromise: Promise<MongoClient> | null = null;

async function connectMongo(): Promise<Db> {
    if (cachedDb) return cachedDb;

    if (!MONGODB_URI) {
        throw new Error('❌ MONGODB_URI is missing from .env file');
    }

    if (!clientPromise) {
        const client = new MongoClient(MONGODB_URI);
        clientPromise = client.connect();
    }

    const client = await clientPromise;
    cachedDb = client.db('hirely');
    return cachedDb;
}

// Helper to get a collection safely (awaits connection)
async function col(name: string) {
    const db = await connectMongo();
    return db.collection(name);
}

// --- Local JSON DB Endpoints (now backed by MongoDB) ---

// JOBS
app.get('/api/db/jobs', async (_req, res) => {
    try {
        const jobs = await (await col('jobs')).find({}).sort({ _id: -1 }).toArray();
        res.json(jobs);
    } catch (e) { res.status(500).json({ error: 'DB error' }); }
});

app.post('/api/db/jobs', async (req, res) => {
    try {
        await (await col('jobs')).insertOne(req.body);
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: 'DB error' }); }
});

app.delete('/api/db/jobs/:id', async (req, res) => {
    try {
        await (await col('jobs')).deleteOne({ id: req.params.id });
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: 'DB error' }); }
});

// APPLICATIONS
app.get('/api/db/applications', async (_req, res) => {
    try {
        const apps = await (await col('applications')).find({}).sort({ appliedAt: -1 }).toArray();
        res.json(apps);
    } catch (e) { res.status(500).json({ error: 'DB error' }); }
});

app.post('/api/db/applications', async (req, res) => {
    try {
        await (await col('applications')).insertOne(req.body);
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: 'DB error' }); }
});

app.put('/api/db/applications/:id', async (req, res) => {
    try {
        await (await col('applications')).updateOne({ id: req.params.id }, { $set: req.body });
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: 'DB error' }); }
});

// PROFILES
app.get('/api/db/profiles', async (_req, res) => {
    try {
        const profiles = await (await col('profiles')).find({}).toArray();
        res.json(profiles);
    } catch (e) { res.status(500).json({ error: 'DB error' }); }
});

app.get('/api/db/profiles/:uid', async (req, res) => {
    try {
        const profile = await (await col('profiles')).findOne({ uid: req.params.uid });
        res.json(profile || null);
    } catch (e) { res.status(500).json({ error: 'DB error' }); }
});

app.post('/api/db/profiles', async (req, res) => {
    try {
        await (await col('profiles')).replaceOne({ uid: req.body.uid }, req.body, { upsert: true });
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: 'DB error' }); }
});

// MESSAGES
app.get('/api/db/messages/:appId', async (req, res) => {
    try {
        const doc = await (await col('messages')).findOne({ appId: req.params.appId });
        res.json(doc?.messages || []);
    } catch (e) { res.status(500).json({ error: 'DB error' }); }
});

app.post('/api/db/messages/:appId', async (req, res) => {
    try {
        await (await col('messages')).updateOne(
            { appId: req.params.appId },
            { $push: { messages: req.body } as any },
            { upsert: true }
        );
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: 'DB error' }); }
});

app.put('/api/db/messages/:appId/:msgId', async (req, res) => {
    try {
        await (await col('messages')).updateOne(
            { appId: req.params.appId, 'messages.id': req.params.msgId },
            { $set: { 'messages.$': { ...req.body } } }
        );
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: 'DB error' }); }
});

// --- Google Jobs via SerpApi ---
app.get('/api/jobs/search', async (req, res) => {
    try {
        const query = (req.query.q as string) || 'Software Developer';
        const location = (req.query.location as string) || 'India';
        const maxPages = Math.min(parseInt(req.query.pages as string) || 1, 3);

        const allJobs: any[] = [];
        let nextPageToken: string | null = null;

        for (let page = 0; page < maxPages; page++) {
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

            for (const job of jobResults) {
                let applyUrl = job.share_link || '';
                if (job.apply_options && job.apply_options.length > 0) {
                    applyUrl = job.apply_options[0].link || applyUrl;
                }
                let source = 'Google Jobs';
                if (job.via) source = job.via.replace('via ', '');

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
        res.status(500).json({ success: false, error: 'Failed to fetch jobs', message: error.message });
    }
});

// --- Adzuna Jobs API (India) ---
app.get('/api/jobs/adzuna', async (req, res) => {
    try {
        const ADZUNA_APP_ID = process.env.ADZUNA_APP_ID;
        const ADZUNA_API_KEY = process.env.ADZUNA_API_KEY;

        if (!ADZUNA_APP_ID || !ADZUNA_API_KEY) {
            return res.status(500).json({ success: false, error: 'Adzuna API credentials not configured' });
        }

        const query = (req.query.q as string) || 'software developer';
        const page = parseInt(req.query.page as string) || 1;
        const resultsPerPage = parseInt(req.query.results_per_page as string) || 20;

        const params = new URLSearchParams({
            app_id: ADZUNA_APP_ID,
            app_key: ADZUNA_API_KEY,
            results_per_page: String(resultsPerPage),
            what: query,
            sort_by: 'date',
        });

        const location = (req.query.location as string) || '';
        if (location) params.set('where', location);

        const adzunaUrl = `https://api.adzuna.com/v1/api/jobs/in/search/${page}?${params.toString()}`;
        console.log(`🔍 Adzuna: Fetching "${query}" page ${page}...`);

        const response = await fetch(adzunaUrl);

        if (!response.ok) {
            const errText = await response.text();
            console.error('❌ Adzuna API error:', errText);
            return res.status(response.status).json({ success: false, error: 'Adzuna API request failed', details: errText });
        }

        const data = await response.json();
        const results = data.results || [];

        const jobs = results.map((job: any) => ({
            id: `adzuna_${job.id || Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
            title: job.title || 'Untitled',
            company: job.company?.display_name || 'Unknown Company',
            location: job.location?.display_name || 'India',
            type: detectJobTypeFromTitle(job.title || ''),
            salary: job.salary_min && job.salary_max
                ? `₹${Math.round(job.salary_min).toLocaleString('en-IN')} - ₹${Math.round(job.salary_max).toLocaleString('en-IN')}`
                : job.salary_min ? `₹${Math.round(job.salary_min).toLocaleString('en-IN')}+`
                    : 'Not specified',
            category: mapAdzunaCategory(job.category?.label || '', job.title || ''),
            postedAt: job.created ? new Date(job.created).toLocaleDateString() : 'Recently',
            description: job.description || 'No description available.',
            logo: `https://ui-avatars.com/api/?name=${encodeURIComponent(job.company?.display_name || 'C')}&background=6366f1&color=fff&size=100`,
            isExternal: true,
            externalUrl: job.redirect_url || '',
            externalSource: 'Adzuna',
        }));

        console.log(`✅ Adzuna: Retrieved ${jobs.length} jobs for "${query}"`);

        res.json({ success: true, count: jobs.length, total: data.count || 0, query, jobs });
    } catch (error: any) {
        console.error('❌ Adzuna fetch error:', error.message);
        res.status(500).json({ success: false, error: 'Failed to fetch from Adzuna', message: error.message });
    }
});

// Health check
app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', serpApiConfigured: !!SERPAPI_KEY, mongodb: !!cachedDb });
});

// --- AI Chatbot ---
import { GoogleGenAI } from '@google/genai';

app.post('/api/chat', async (req, res) => {
    try {
        const { message } = req.body;
        if (!message) return res.status(400).json({ error: 'Message is required' });

        const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
        if (!GEMINI_API_KEY) {
            return res.json({ reply: "I am currently in setup mode! Please add the `GEMINI_API_KEY` to the `.env` file. 🤖" });
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

// --- AI Voice Chat (Interview Coach) ---
app.post('/api/voice-chat', async (req, res) => {
    try {
        const { message, mode, history } = req.body;
        if (!message) return res.status(400).json({ error: 'Message is required' });

        const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
        if (!GEMINI_API_KEY) {
            return res.json({ reply: "Voice AI is not configured." });
        }

        const modePrompts: Record<string, string> = {
            'hr': 'You conduct HR-style interview questions: motivation, teamwork, salary expectations, career goals, company culture fit, strengths and weaknesses.',
            'technical': 'You ask technical interview questions relevant to software engineering: data structures, algorithms, system design, coding patterns, debugging, and technology-specific questions.',
            'behavioral': 'You ask behavioral/situational interview questions using the STAR method: "Tell me about a time when...", conflict resolution, leadership, problem-solving under pressure.',
            'resume': 'You analyze and discuss resume-related topics: gaps in experience, project explanations, skill relevance, how to improve their resume, and career trajectory.',
        };

        const modeInstruction = modePrompts[mode] || modePrompts['technical'];
        const conversationContext = (history || [])
            .map((m: any) => `${m.role === 'ai' ? 'Interviewer' : 'Candidate'}: ${m.text}`)
            .join('\n');

        const systemPrompt = `You are Hirely AI, a professional and realistic job interview coach.
You are conducting a live voice mock interview. ${modeInstruction}
Rules:
- Keep responses conversational, concise (2-4 sentences max), and suitable for text-to-speech.
- Ask ONE clear follow-up question at the end of each response.
- Be encouraging but honest. Give brief feedback on the answer before asking the next question.
- Do NOT use markdown, bullet points, or special formatting. Speak naturally.
- If this is the start of the conversation, introduce yourself briefly and ask the first question.

${conversationContext ? `Conversation so far:\n${conversationContext}\n` : ''}
Candidate just said: "${message}"

Respond naturally as the interviewer:`;

        const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
        const response = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: systemPrompt });

        res.json({ reply: response.text });
    } catch (error: any) {
        console.error('❌ Voice Chat Error:', error.message);
        res.status(500).json({ error: 'Failed to process voice chat' });
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

function detectJobTypeFromTitle(title: string): string {
    const t = title.toLowerCase();
    if (t.includes('intern')) return 'Internship';
    if (t.includes('part-time') || t.includes('part time')) return 'Part-time';
    if (t.includes('contract')) return 'Contract';
    if (t.includes('remote')) return 'Remote';
    if (t.includes('freelance')) return 'Freelance';
    return 'Full-time';
}

function extractSalary(job: any): string {
    const extensions = job.detected_extensions || {};
    if (extensions.salary) return extensions.salary;
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

function mapAdzunaCategory(adzunaLabel: string, title: string): string {
    const label = adzunaLabel.toLowerCase();
    if (label.includes('it') || label.includes('engineering') || label.includes('software') || label.includes('tech')) return 'Engineering';
    if (label.includes('design') || label.includes('creative')) return 'Design';
    if (label.includes('marketing') || label.includes('pr') || label.includes('advertising')) return 'Marketing';
    if (label.includes('sales') || label.includes('retail')) return 'Sales';
    if (label.includes('product') || label.includes('project') || label.includes('consult')) return 'Product';
    return detectCategory(title);
}

// Export for Vercel Serverless
export default app;

// Start server locally
if (process.env.NODE_ENV !== 'production' || process.env.VERCEL !== '1') {
    connectMongo().then(() => {
        app.listen(PORT, () => {
            console.log(`\n🚀 Hirely Backend Server running at http://localhost:${PORT}`);
            console.log(`📡 SerpApi endpoint: http://localhost:${PORT}/api/jobs/search?q=developer&location=India`);
            console.log(`🍃 Adzuna endpoint: http://localhost:${PORT}/api/jobs/adzuna?q=developer`);
            console.log(`❤️  Health check: http://localhost:${PORT}/api/health\n`);
        });
    }).catch(err => {
        console.error('❌ Failed to connect to MongoDB:', err);
        process.exit(1);
    });
} else {
    // In serverless, just connect to Mongo when a request comes in if not already connected
    // This connects immediately for Vercel's boot process
    connectMongo().catch(console.error);
}
