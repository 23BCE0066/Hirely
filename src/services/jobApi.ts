/// <reference types="vite/client" />
import { Job } from '../types';

export const fetchExternalJobs = async (searchQuery: string = 'Developer or Internship'): Promise<Job[]> => {
  try {
    const jobs: Job[] = [];

    // Fetch from our Express backend (SerpApi Google Jobs)
    // We pass the dynamic searchQuery to ensure we get relevant, live jobs/internships
    try {
      const encodeQuery = encodeURIComponent(searchQuery);
      // tbs=qdr:w fetches jobs posted in the past week to ensure freshness
      const serpResponse = await fetch(`/api/jobs/search?q=${encodeQuery}&location=India&pages=2`);
      if (serpResponse.ok) {
        const serpData = await serpResponse.json();
        if (serpData.success && serpData.jobs) {
          jobs.push(...serpData.jobs);
        }
      }
    } catch (err) {
      console.error("Error fetching from SerpApi backend:", err);
    }

    // Shuffle jobs slightly 
    return jobs.sort(() => Math.random() - 0.5);
  } catch (error) {
    console.error("Error fetching external jobs:", error);
    return [];
  }
};
