/// <reference types="vite/client" />
import { Job } from '../types';

export const fetchExternalJobs = async (): Promise<Job[]> => {
  try {
    // Using Remotive API which is completely free and requires no API keys
    const response = await fetch('https://remotive.com/api/remote-jobs?limit=30');
    if (!response.ok) throw new Error("Failed to fetch external jobs");
    
    const data = await response.json();
    
    return data.jobs.map((job: any) => {
      // Strip HTML tags from the description
      const cleanDescription = job.description ? job.description.replace(/<[^>]*>?/gm, '') : 'No description provided.';
      
      return {
        id: String(job.id),
        title: job.title,
        company: job.company_name,
        location: job.candidate_required_location || 'Worldwide',
        type: 'Remote',
        salary: job.salary || 'Not specified',
        category: job.category || 'Other',
        postedAt: new Date(job.publication_date).toLocaleDateString(),
        description: cleanDescription,
        logo: job.company_logo || `https://picsum.photos/seed/${job.id}/100/100`,
        isExternal: true,
        externalUrl: job.url
      };
    });
  } catch (error) {
    console.error("Error fetching external jobs:", error);
    return [];
  }
};
