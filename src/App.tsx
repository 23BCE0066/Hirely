/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Search, 
  MapPin, 
  Briefcase, 
  Building2, 
  Zap, 
  Trophy, 
  ChevronRight, 
  Menu, 
  X, 
  ArrowRight,
  ArrowDown,
  Star,
  Users,
  CheckCircle2,
  Globe,
  Mail,
  Lock,
  Settings,
  MousePointerClick,
  Bot
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { jobs, companies, stats } from './data';
import { Job, Company } from './types';
import { auth, db, storage } from './firebase';
import { useUser, useAuth, SignIn, SignUp, UserButton, useClerk } from '@clerk/clerk-react';
import { doc, setDoc, getDoc, collection, query, where, getDocs, addDoc, updateDoc, onSnapshot, orderBy, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { UserProfile, Application } from './types';
import { fetchExternalJobs } from './services/jobApi';
import { ChatModal } from './components/ChatModal';

// Utility for tailwind classes
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- Components ---

const Navbar = ({ activePage, setActivePage }: { activePage: string, setActivePage: (p: string) => void }) => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { isSignedIn } = useUser();
  const { signOut } = useClerk();

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navItems = [
    { id: 'home', label: 'Home' },
    { id: 'jobs', label: 'Find Jobs' },
    { id: 'companies', label: 'Companies' },
  ];

  return (
    <nav className={cn(
      "fixed top-0 left-0 right-0 z-50 transition-all duration-300 px-6 py-4",
      isScrolled ? "glass py-3" : "bg-transparent"
    )}>
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <div 
          className="flex items-center gap-1 cursor-pointer" 
          onClick={() => setActivePage('home')}
        >
          <span className="text-3xl font-display font-bold tracking-tighter text-slate-900">Hirely<span className="text-rose-500">:</span></span>
        </div>

        {/* Desktop Nav */}
        <div className="hidden md:flex items-center gap-8">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActivePage(item.id)}
              className={cn(
                "text-sm font-medium transition-colors hover:text-indigo-600",
                activePage === item.id ? "text-indigo-600" : "text-slate-600"
              )}
            >
              {item.label}
            </button>
          ))}
          {isSignedIn ? (
            <div className="flex items-center gap-4">
              <button onClick={() => setActivePage('dashboard')} className="text-sm font-medium text-slate-600 hover:text-indigo-600">Dashboard</button>
              <UserButton afterSignOutUrl="/" />
            </div>
          ) : (
            <button 
              onClick={() => setActivePage('join')}
              className="bg-indigo-600 text-white px-6 py-2.5 rounded-full text-sm font-semibold hover:bg-indigo-700 transition-all hover:shadow-lg hover:shadow-indigo-200"
            >
              Join Portal
            </button>
          )}
        </div>

        {/* Mobile Menu Toggle */}
        <button className="md:hidden text-slate-900" onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>
          {isMobileMenuOpen ? <X /> : <Menu />}
        </button>
      </div>

      {/* Mobile Nav */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="absolute top-full left-0 right-0 bg-white border-t border-slate-100 p-6 flex flex-col gap-4 md:hidden shadow-xl"
          >
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => {
                  setActivePage(item.id);
                  setIsMobileMenuOpen(false);
                }}
                className={cn(
                  "text-left text-lg font-medium py-2",
                  activePage === item.id ? "text-indigo-600" : "text-slate-600"
                )}
              >
                {item.label}
              </button>
            ))}
            {isSignedIn ? (
              <>
                <button onClick={() => { setActivePage('dashboard'); setIsMobileMenuOpen(false); }} className="text-left text-lg font-medium py-2 text-slate-600">Dashboard</button>
                <div className="mt-2 flex justify-center">
                  <UserButton afterSignOutUrl="/" />
                </div>
              </>
            ) : (
              <button 
                onClick={() => {
                  setActivePage('join');
                  setIsMobileMenuOpen(false);
                }}
                className="bg-indigo-600 text-white px-6 py-3 rounded-xl text-center font-semibold mt-2"
              >
                Join Portal
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
};

const JobCard: React.FC<{ job: Job; onApply: () => void; onViewDetails?: () => void; isApplying?: boolean; hasApplied?: boolean }> = ({ job, onApply, onViewDetails, isApplying, hasApplied }) => (
  <motion.div
    layout
    initial={{ opacity: 0, y: 20 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true }}
    whileHover={{ y: -5 }}
    className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm hover:shadow-xl transition-all group flex flex-col h-full"
  >
    <div className="flex justify-between items-start mb-4">
      <div className="flex gap-4">
        <img 
          src={job.logo} 
          alt={job.company} 
          referrerPolicy="no-referrer"
          className="w-14 h-14 rounded-2xl object-cover border border-slate-100" 
        />
        <div>
          <h3 className="text-lg font-bold text-slate-900 group-hover:text-indigo-600 transition-colors line-clamp-1">{job.title}</h3>
          <p className="text-slate-500 text-sm flex items-center gap-1">
            <Building2 className="w-3 h-3" /> {job.company}
          </p>
        </div>
      </div>
      {job.aiMatchScore && (
        <div className="bg-emerald-50 text-emerald-700 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1 whitespace-nowrap ml-2">
          <Zap className="w-3 h-3 fill-emerald-500" /> {job.aiMatchScore}% Match
        </div>
      )}
    </div>
    
    <div className="flex flex-wrap gap-2 mb-4">
      <span className="bg-slate-50 text-slate-600 px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1">
        <MapPin className="w-3 h-3" /> {job.location}
      </span>
      <span className="bg-slate-50 text-slate-600 px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1">
        <Briefcase className="w-3 h-3" /> {job.type}
      </span>
      <span className="bg-indigo-50 text-indigo-600 px-3 py-1 rounded-full text-xs font-bold">
        {job.salary}
      </span>
    </div>

    <p className="text-slate-600 text-sm mb-6 line-clamp-3 flex-grow">{job.description}</p>

    <div className="flex items-center justify-between pt-4 border-t border-slate-50 mt-auto">
      <span className="text-slate-400 text-xs">Posted {job.postedAt}</span>
      <div className="flex gap-3">
        {onViewDetails && (
          <button 
            onClick={onViewDetails}
            className="text-slate-500 font-bold text-sm hover:text-slate-700 transition-all"
          >
            Details
          </button>
        )}
        <button 
          onClick={onApply}
          disabled={isApplying || hasApplied}
          className={cn(
            "font-bold text-sm flex items-center gap-1 transition-all",
            hasApplied ? "text-emerald-600" : "text-indigo-600 hover:gap-2 disabled:opacity-50"
          )}
        >
          {hasApplied ? (
            <><CheckCircle2 className="w-4 h-4" /> Applied</>
          ) : isApplying ? (
            'Applying...'
          ) : (
            <>Apply <ArrowRight className="w-4 h-4" /></>
          )}
        </button>
      </div>
    </div>
  </motion.div>
);

const JobDetailsModal = ({ job, onClose, onApply, isApplying, hasApplied }: { job: Job, onClose: () => void, onApply: () => void, isApplying?: boolean, hasApplied?: boolean }) => (
  <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="bg-white rounded-[2rem] p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl relative"
    >
      <button onClick={onClose} className="absolute top-6 right-6 text-slate-400 hover:text-slate-600">
        <X className="w-6 h-6" />
      </button>
      
      <div className="flex gap-6 items-start mb-8">
        <img src={job.logo} alt={job.company} referrerPolicy="no-referrer" className="w-20 h-20 rounded-2xl object-cover border border-slate-100" />
        <div>
          <h2 className="text-3xl font-bold text-slate-900 mb-2">{job.title}</h2>
          <p className="text-lg text-slate-600 flex items-center gap-2">
            <Building2 className="w-5 h-5" /> {job.company}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 mb-8">
        <span className="bg-slate-50 text-slate-700 px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2"><MapPin className="w-4 h-4" /> {job.location}</span>
        <span className="bg-slate-50 text-slate-700 px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2"><Briefcase className="w-4 h-4" /> {job.type}</span>
        <span className="bg-indigo-50 text-indigo-700 px-4 py-2 rounded-xl text-sm font-bold">{job.salary}</span>
        {job.isExternal && <span className="bg-amber-50 text-amber-700 px-4 py-2 rounded-xl text-sm font-bold">External Listing</span>}
      </div>

      <div className="mb-8">
        <h3 className="text-xl font-bold text-slate-900 mb-4">Job Description</h3>
        <div className="text-slate-600 leading-relaxed whitespace-pre-wrap">
          {job.description}
        </div>
      </div>

      <div className="flex justify-end gap-4 pt-6 border-t border-slate-100">
        <button onClick={onClose} className="px-6 py-3 rounded-xl font-bold text-slate-600 hover:bg-slate-50">Close</button>
        <button 
          onClick={onApply}
          disabled={isApplying || hasApplied}
          className={cn(
            "px-8 py-3 rounded-xl font-bold flex items-center gap-2 transition-all",
            hasApplied ? "bg-emerald-100 text-emerald-700" : "bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50"
          )}
        >
          {hasApplied ? 'Applied' : isApplying ? 'Applying...' : (job.isExternal ? 'Apply Externally' : 'Apply Now')}
        </button>
      </div>
    </motion.div>
  </div>
);

const FloatingPill = ({ text, top, left, delay, onClick }: { text: string, top: string, left: string, delay: number, onClick: () => void }) => (
  <motion.button
    onClick={onClick}
    initial={{ opacity: 0, scale: 0.8 }}
    animate={{ opacity: 1, scale: 1 }}
    transition={{ delay, duration: 0.5 }}
    className={`absolute bg-white border border-slate-200 shadow-sm rounded-full px-4 py-2 text-sm font-medium text-slate-700 hover:border-slate-300 hover:shadow-md transition-all z-10 animate-float`}
    style={{ top, left, animationDelay: `${delay}s` }}
  >
    {text}
  </motion.button>
);

const SplitFeatures = () => (
  <section className="flex flex-col md:flex-row w-full border-t border-slate-200">
    {/* Left Side */}
    <div className="flex-1 bg-white p-12 md:p-24">
      <h3 className="text-lg font-bold text-slate-900 mb-4">Got talent?</h3>
      <h2 className="text-4xl md:text-5xl font-display font-bold text-slate-900 mb-12">Why job seekers love us</h2>
      
      <div className="space-y-10">
        <FeatureItem 
          icon={<Star className="w-6 h-6 text-rose-500" />}
          text="Connect directly with founders at top startups - no third party recruiters allowed."
        />
        <FeatureItem 
          icon={<Briefcase className="w-6 h-6 text-rose-500" />}
          text="Everything you need to know, all upfront. View salary, stock options, and more before applying."
        />
        <FeatureItem 
          icon={<CheckCircle2 className="w-6 h-6 text-rose-500" />}
          text="Say goodbye to cover letters - your profile is all you need. One click to apply and you're done."
        />
        <FeatureItem 
          icon={<Zap className="w-6 h-6 text-rose-500" />}
          text="Unique jobs at startups and tech companies you can't find anywhere else."
        />
      </div>
    </div>

    {/* Right Side */}
    <div className="flex-1 bg-[#fff8f8] p-12 md:p-24">
      <h3 className="text-lg font-bold text-slate-900 mb-4">Need talent?</h3>
      <h2 className="text-4xl md:text-5xl font-display font-bold text-slate-900 mb-12">Why recruiters love us</h2>
      
      <div className="space-y-10">
        <FeatureItem 
          icon={<Users className="w-6 h-6 text-rose-500" />}
          text="Tap into a community of 10M+ engaged, startup-ready candidates."
        />
        <FeatureItem 
          icon={<Settings className="w-6 h-6 text-rose-500" />}
          text="Everything you need to kickstart your recruiting — set up job posts, company branding, and HR tools within 10 minutes, all for free."
        />
        <FeatureItem 
          icon={<MousePointerClick className="w-6 h-6 text-rose-500" />}
          text="A free applicant tracking system, or free integration with any ATS you may already use."
        />
        <FeatureItem 
          icon={<Bot className="w-6 h-6 text-rose-500" />}
          text="Let us handle the heavy-lifting with Hirely AI. Our new AI-Recruiter scans 500M+ candidates, filters it down based on your unique calibration, and schedules your favorites on your calendar in a matter of days."
        />
      </div>
    </div>
  </section>
);

const FeatureItem = ({ icon, text }: { icon: React.ReactNode, text: string }) => (
  <div className="flex gap-6 items-start">
    <div className="w-12 h-12 rounded-full bg-rose-100 flex items-center justify-center shrink-0">
      {icon}
    </div>
    <p className="text-slate-700 leading-relaxed text-lg">{text}</p>
  </div>
);

const AiRecruiterSection = () => (
  <section className="p-6 md:p-12 bg-white">
    <div className="max-w-7xl mx-auto bg-[#1a1122] rounded-[3rem] p-12 md:p-20 flex flex-col lg:flex-row items-center gap-16 overflow-hidden relative">
      <div className="flex-1 z-10">
        <h2 className="text-5xl md:text-6xl font-display font-bold text-white mb-8 leading-tight">
          Meet Autopilot:<br/>Hirely's AI recruiter
        </h2>
        <p className="text-xl text-white/80 mb-8 leading-relaxed max-w-lg">
          Just tell us what you need. Our expert recruiters backed by AI deliver qualified candidates to your calendar.
        </p>
        <p className="text-xl text-white/80 mb-12 max-w-lg">
          All at a fraction of the cost of an agency.
        </p>
        <button className="bg-white text-slate-900 px-8 py-4 rounded-full font-bold text-lg hover:bg-slate-100 transition-all">
          Learn more
        </button>
      </div>
      
      <div className="flex-1 relative z-10 w-full hidden md:block">
        <div className="bg-white rounded-3xl p-6 shadow-2xl max-w-md ml-auto relative mt-24">
          <div className="absolute -top-16 -left-12 bg-white p-4 rounded-2xl shadow-xl flex items-center gap-3 w-80">
             <div className="w-10 h-10 rounded-full bg-indigo-100 overflow-hidden shrink-0">
               <img src="https://picsum.photos/seed/recruiter/100/100" alt="Recruiter" referrerPolicy="no-referrer" />
             </div>
             <p className="text-sm font-medium">Send me candidates interested in <span className="bg-amber-100 text-amber-800 px-2 py-0.5 rounded text-xs">FINTECH</span> with experience in <span className="bg-slate-100 text-slate-800 px-2 py-0.5 rounded text-xs">PYTHON</span></p>
          </div>
          
          <div className="absolute -top-32 right-0 bg-rose-500 text-white p-4 rounded-2xl shadow-xl rounded-br-none w-64">
             <p className="text-sm font-medium">Absolutely! Sending you a list of relevant candidates now.</p>
          </div>

          <h3 className="text-xl font-bold text-rose-900 mb-6 mt-8">Your qualified candidate review list</h3>
          
          <div className="space-y-4">
            {[1, 2].map((i) => (
              <div key={i} className="flex items-center justify-between p-4 border border-slate-100 rounded-2xl hover:shadow-md transition-all bg-white">
                <div className="flex items-center gap-4">
                  <img src={`https://picsum.photos/seed/cand${i}/100/100`} className="w-12 h-12 rounded-full object-cover" alt="Candidate" referrerPolicy="no-referrer" />
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-slate-900">Candidate {i}</h4>
                      <span className="bg-emerald-100 text-emerald-700 text-[10px] px-2 py-0.5 rounded-full font-bold">INTERESTED</span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">Experience in <span className="bg-slate-100 px-1.5 py-0.5 rounded">PYTHON</span></p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button className="w-8 h-8 rounded-full border border-emerald-200 flex items-center justify-center text-emerald-600 hover:bg-emerald-50"><CheckCircle2 className="w-4 h-4" /></button>
                  <button className="w-8 h-8 rounded-full border border-rose-200 flex items-center justify-center text-rose-600 hover:bg-rose-50"><X className="w-4 h-4" /></button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  </section>
);

const CompanyMarquee = () => {
  const logos = [
    <span key="1" className="text-3xl font-bold font-sans tracking-tighter text-white">DOORDASH</span>,
    <span key="2" className="text-3xl font-black font-display tracking-tight text-white">ROBLOX</span>,
    <span key="3" className="text-4xl font-serif italic tracking-tight text-white lowercase">honey</span>,
    <span key="4" className="text-3xl font-bold font-sans tracking-widest text-white uppercase flex items-center gap-2"><div className="w-6 h-6 rounded-full border-4 border-white border-t-transparent rotate-45"></div>PELOTON</span>,
    <span key="5" className="text-4xl font-black font-sans tracking-tighter text-white">IFTTT</span>,
  ];

  return (
    <div className="w-full overflow-hidden bg-[#1a1122] py-16 relative flex flex-col items-center">
      <div className="w-full border-t border-white/10 absolute top-0"></div>
      <div className="absolute inset-y-0 left-0 w-16 md:w-32 bg-gradient-to-r from-[#1a1122] to-transparent z-10"></div>
      <div className="absolute inset-y-0 right-0 w-16 md:w-32 bg-gradient-to-l from-[#1a1122] to-transparent z-10"></div>
      <div className="flex w-max animate-marquee gap-24 md:gap-32 px-8 mb-12">
        {logos}
        {logos}
        {logos}
      </div>
      <p className="text-sm text-white/70">Startups who used our platform</p>
    </div>
  );
};

// --- Pages ---

const HomePage = ({ setActivePage, setSearchQuery }: { setActivePage: (p: string) => void, setSearchQuery: (q: string) => void }) => {
  const handlePillClick = (query: string) => {
    setSearchQuery(query);
    setActivePage('jobs');
  };

  return (
    <div className="pt-32 pb-0 bg-white min-h-screen flex flex-col">
      {/* Hero Section */}
      <section className="relative px-6 flex-grow flex flex-col items-center justify-center min-h-[70vh]">
        
        {/* Floating Pills */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none hidden md:block">
          <div className="relative w-full max-w-6xl mx-auto h-full">
            <FloatingPill text="React Developers" top="40%" left="15%" delay={0} onClick={() => handlePillClick('React')} />
            <FloatingPill text="Mental Health" top="50%" left="20%" delay={1} onClick={() => handlePillClick('Mental Health')} />
            <FloatingPill text="Web3" top="55%" left="28%" delay={2} onClick={() => handlePillClick('Web3')} />
            <FloatingPill text="Full Stack Developers" top="70%" left="35%" delay={0.5} onClick={() => handlePillClick('Full Stack')} />
            <FloatingPill text="Boston" top="15%" left="18%" delay={1.5} onClick={() => handlePillClick('Boston')} />
            <FloatingPill text="Aerospace" top="20%" left="35%" delay={0.2} onClick={() => handlePillClick('Aerospace')} />
            
            <FloatingPill text="E-commerce" top="18%" left="70%" delay={0.8} onClick={() => handlePillClick('E-commerce')} />
            <FloatingPill text="iOS Developers" top="45%" left="85%" delay={1.2} onClick={() => handlePillClick('iOS')} />
            <FloatingPill text="New York" top="52%" left="88%" delay={0.3} onClick={() => handlePillClick('New York')} />
            <FloatingPill text="Node JS Developers" top="65%" left="85%" delay={1.8} onClick={() => handlePillClick('Node JS')} />
            <FloatingPill text="Cyber Security" top="75%" left="80%" delay={0.6} onClick={() => handlePillClick('Cyber Security')} />
            <FloatingPill text="Hardware" top="60%" left="72%" delay={1.1} onClick={() => handlePillClick('Hardware')} />
            <FloatingPill text="Vue JS" top="62%" left="65%" delay={0.4} onClick={() => handlePillClick('Vue JS')} />
            <FloatingPill text="San Francisco" top="45%" left="70%" delay={1.4} onClick={() => handlePillClick('San Francisco')} />
            <FloatingPill text="Seattle" top="48%" left="45%" delay={0.9} onClick={() => handlePillClick('Seattle')} />
          </div>
        </div>

        <div className="text-center z-10 relative mt-12">
          <div className="inline-block relative">
            <h1 className="text-5xl md:text-8xl font-display font-bold text-slate-900 tracking-tight px-6 md:px-12 py-4 md:py-6 border-4 border-dashed border-rose-500 rounded-[2rem] bg-white">
              Find what's next
            </h1>
            <div className="absolute -left-12 md:-left-20 top-1/2 -translate-y-1/2 flex flex-col gap-2 hidden sm:flex">
              <span className="text-5xl md:text-7xl font-display font-bold text-slate-900">h</span>
              <div className="w-3 h-3 rounded-full bg-rose-500 ml-auto"></div>
              <div className="w-3 h-3 rounded-full bg-rose-500 ml-auto"></div>
            </div>
          </div>
        </div>

        <div className="mt-24 md:mt-32 text-center z-10">
          <h2 className="text-3xl md:text-5xl font-display font-bold text-slate-900 mb-10">
            Where startups and job seekers connect
          </h2>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button 
              onClick={() => setActivePage('join')}
              className="bg-[#1a1122] text-white px-8 py-4 rounded-2xl font-bold text-lg hover:bg-black transition-all"
            >
              Find your next hire
            </button>
            <button 
              onClick={() => { setSearchQuery(''); setActivePage('jobs'); }}
              className="bg-white text-slate-900 border border-slate-200 px-8 py-4 rounded-2xl font-bold text-lg hover:border-slate-400 transition-all shadow-sm"
            >
              Find your next job
            </button>
          </div>
        </div>

        <div className="mt-16 md:mt-24 mb-12 animate-bounce">
          <div className="w-12 h-12 bg-[#1a1122] rounded-full flex items-center justify-center text-white mx-auto">
            <ArrowDown className="w-6 h-6" />
          </div>
        </div>
      </section>

      <CompanyMarquee />
      <SplitFeatures />
      <AiRecruiterSection />
    </div>
  );
};

const JobsPage = ({ userProfile, setActivePage, initialSearch = '' }: { userProfile: UserProfile | null, setActivePage: (p: string) => void, initialSearch?: string }) => {
  const [search, setSearch] = useState(initialSearch);
  const [category, setCategory] = useState('All');

  useEffect(() => {
    setSearch(initialSearch);
  }, [initialSearch]);

  const [allJobs, setAllJobs] = useState<Job[]>(jobs);
  const [loading, setLoading] = useState(true);
  const [applyingTo, setApplyingTo] = useState<string | null>(null);
  const [appliedJobs, setAppliedJobs] = useState<string[]>([]);
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  useEffect(() => {
    const fetchJobsAndApps = async () => {
      try {
        const jobsSnapshot = await getDocs(collection(db, 'jobs'));
        const firestoreJobs: Job[] = [];
        jobsSnapshot.forEach(doc => firestoreJobs.push({ id: doc.id, ...doc.data() } as Job));
        
        // Fetch external jobs
        const externalJobs = await fetchExternalJobs();

        setAllJobs([...jobs, ...firestoreJobs, ...externalJobs]);

        if (userProfile?.role === 'candidate') {
          const appsQuery = query(collection(db, 'applications'), where('candidateId', '==', userProfile.uid));
          const appsSnapshot = await getDocs(appsQuery);
          const appliedIds: string[] = [];
          appsSnapshot.forEach(doc => appliedIds.push(doc.data().jobId));
          setAppliedJobs(appliedIds);
        }
      } catch (error) {
        console.error("Error fetching jobs:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchJobsAndApps();
  }, [userProfile]);

  const handleApply = async (job: Job) => {
    if (!userProfile) {
      setActivePage('join');
      return;
    }
    if (userProfile.role !== 'candidate') {
      alert("Only candidates can apply for jobs.");
      return;
    }

    if (!resumeFile && !job.isExternal) {
      alert("Please select a resume file to upload before applying.");
      fileInputRef.current?.click();
      return;
    }

    setApplyingTo(job.id);
    try {
      let resumeUrl = '';
      if (resumeFile) {
        // Upload Resume to Firebase Storage
        const storageRef = ref(storage, `${userProfile.uid}/resumes/${Date.now()}_${resumeFile.name}`);
        const snapshot = await uploadBytes(storageRef, resumeFile);
        resumeUrl = await getDownloadURL(snapshot.ref);
      }

      const applicationData: Omit<Application, 'id'> = {
        jobId: job.id,
        employerId: job.employerId,
        candidateId: userProfile.uid,
        candidateName: userProfile.name,
        candidateEmail: userProfile.email,
        appliedAt: Date.now(),
        status: 'pending',
        resumeUrl
      };
      await addDoc(collection(db, 'applications'), applicationData);
      setAppliedJobs([...appliedJobs, job.id]);
      
      if (resumeFile) {
        setResumeFile(null); // Reset file input
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
      
      if (job.isExternal && job.externalUrl) {
        window.open(job.externalUrl, '_blank');
      } else {
        alert("Application submitted successfully!");
      }
    } catch (error) {
      console.error("Error applying:", error);
      alert("Failed to apply. Please try again.");
    } finally {
      setApplyingTo(null);
    }
  };
  
  const filteredJobs = allJobs.filter(j => 
    (category === 'All' || j.category === category) &&
    (j.title.toLowerCase().includes(search.toLowerCase()) || 
     j.company.toLowerCase().includes(search.toLowerCase()) ||
     j.description.toLowerCase().includes(search.toLowerCase()) ||
     j.location.toLowerCase().includes(search.toLowerCase()))
  );

  const categories = ['All', 'Engineering', 'Design', 'Marketing', 'Sales', 'Product'];

  return (
    <div className="pt-32 pb-20 px-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-12 text-center">
          <h1 className="text-5xl font-display font-bold text-slate-900 mb-4">Find your next challenge</h1>
          <p className="text-slate-500">Browse thousands of high-quality roles from innovative companies.</p>
        </div>

        {/* Search & Filter */}
        <div className="glass p-4 rounded-[2rem] mb-12 flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
            <input 
              type="text" 
              placeholder="Search by role or company..." 
              className="w-full pl-12 pr-4 py-4 bg-slate-50 rounded-2xl border-none focus:ring-2 focus:ring-indigo-500 outline-none"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex gap-2 overflow-x-auto pb-2 md:pb-0 no-scrollbar items-center">
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setCategory(cat)}
                className={cn(
                  "px-6 py-4 rounded-2xl font-bold text-sm whitespace-nowrap transition-all",
                  category === cat ? "bg-indigo-600 text-white shadow-lg shadow-indigo-100" : "bg-slate-50 text-slate-600 hover:bg-slate-100"
                )}
              >
                {cat}
              </button>
            ))}
            {userProfile?.role === 'candidate' && (
              <div className="ml-4 flex items-center gap-2 border-l border-slate-200 pl-4">
                <input 
                  type="file" 
                  accept=".pdf,.doc,.docx" 
                  className="hidden" 
                  ref={fileInputRef}
                  onChange={(e) => setResumeFile(e.target.files?.[0] || null)}
                />
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  className="bg-emerald-50 text-emerald-600 px-4 py-3 rounded-xl font-bold text-sm whitespace-nowrap hover:bg-emerald-100 transition-all flex items-center gap-2"
                >
                  {resumeFile ? 'Resume Selected' : 'Upload Resume'}
                </button>
                {resumeFile && <span className="text-xs text-slate-500 max-w-[100px] truncate">{resumeFile.name}</span>}
              </div>
            )}
          </div>
        </div>

        {loading ? (
          <div className="py-20 text-center">
            <p className="text-slate-500">Loading jobs...</p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredJobs.map(job => (
              <JobCard 
                key={job.id} 
                job={job} 
                onApply={() => handleApply(job)} 
                onViewDetails={() => setSelectedJob(job)}
                isApplying={applyingTo === job.id}
                hasApplied={appliedJobs.includes(job.id)}
              />
            ))}
          </div>
        )}
        
        {!loading && filteredJobs.length === 0 && (
          <div className="py-20 text-center">
            <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <Search className="text-slate-300 w-10 h-10" />
            </div>
            <h3 className="text-xl font-bold text-slate-900">No jobs found</h3>
            <p className="text-slate-500">Try adjusting your search or filters.</p>
          </div>
        )}

        {selectedJob && (
          <JobDetailsModal 
            job={selectedJob} 
            onClose={() => setSelectedJob(null)} 
            onApply={() => handleApply(selectedJob)}
            isApplying={applyingTo === selectedJob.id}
            hasApplied={appliedJobs.includes(selectedJob.id)}
          />
        )}
      </div>
    </div>
  );
};

const CompaniesPage = () => {
  return (
    <div className="pt-32 pb-20">
      <div className="max-w-7xl mx-auto px-6">
        <div className="mb-16 text-center">
          <h1 className="text-5xl font-display font-bold text-slate-900 mb-4">Work with the best</h1>
          <p className="text-slate-500">Explore company profiles and their unique cultures.</p>
        </div>
      </div>

      <CompanyMarquee />

      <div className="max-w-7xl mx-auto px-6 mt-16">
        <div className="grid gap-12">
          {companies.map((company, idx) => (
            <motion.div
              key={company.id}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="bg-white rounded-[3rem] border border-slate-100 overflow-hidden shadow-sm hover:shadow-xl transition-all"
            >
              <div className="grid lg:grid-cols-5">
                <div className="lg:col-span-2 relative h-64 lg:h-auto">
                  <img 
                    src={company.logo} 
                    alt={company.name} 
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover" 
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex items-end p-8">
                    <h2 className="text-3xl font-bold text-white">{company.name}</h2>
                  </div>
                </div>
                <div className="lg:col-span-3 p-8 lg:p-12">
                  <div className="flex flex-wrap gap-4 mb-8">
                    <span className="bg-indigo-50 text-indigo-600 px-4 py-2 rounded-xl text-sm font-bold">{company.industry}</span>
                    <span className="bg-slate-50 text-slate-600 px-4 py-2 rounded-xl text-sm font-bold">{company.size}</span>
                    <span className="bg-slate-50 text-slate-600 px-4 py-2 rounded-xl text-sm font-bold">Founded {company.founded}</span>
                  </div>
                  <p className="text-lg text-slate-600 mb-10 leading-relaxed">{company.description}</p>
                  
                  <div className="mb-10">
                    <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-6">Milestones</h3>
                    <div className="space-y-6">
                      {company.milestones.map((m, i) => (
                        <div key={i} className="flex gap-6 items-start">
                          <span className="text-indigo-600 font-display font-bold text-lg pt-1">{m.year}</span>
                          <div className="flex-1 pt-1.5 border-t border-slate-100">
                            <p className="text-slate-900 font-bold">{m.event}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <button className="bg-slate-900 text-white px-8 py-4 rounded-2xl font-bold hover:bg-slate-800 transition-all flex items-center gap-2">
                    View Open Roles <ArrowRight className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
};

const JoinPage = () => {
  const [role, setRole] = useState<'candidate' | 'recruiter'>('candidate');
  const [isLogin, setIsLogin] = useState(false);

  useEffect(() => {
    localStorage.setItem('intendedRole', role);
  }, [role]);

  return (
    <div className="min-h-screen pt-32 pb-20 px-6 flex items-center justify-center bg-slate-50">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md"
      >
        <div className="bg-white p-10 rounded-[3rem] shadow-2xl shadow-slate-200 border border-slate-100 flex flex-col items-center">
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-indigo-100">
              <Zap className="text-white w-8 h-8" />
            </div>
            <h1 className="text-3xl font-display font-bold text-slate-900 mb-2">
              {isLogin ? 'Welcome Back' : 'Join the Network'}
            </h1>
            <p className="text-slate-500">
              {isLogin 
                ? (role === 'candidate' ? 'Log in to your talent portal' : 'Log in to your employer portal') 
                : (role === 'candidate' ? 'Start your AI-powered career journey' : 'Find the perfect candidates with AI')}
            </p>
          </div>
          
          <div className="flex bg-slate-100 p-1 rounded-2xl mb-8 w-full">
            <button
              type="button"
              onClick={() => setRole('candidate')}
              className={cn(
                "flex-1 py-3 rounded-xl text-sm font-bold transition-all",
                role === 'candidate' ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
              )}
            >
              Candidate
            </button>
            <button
              type="button"
              onClick={() => setRole('recruiter')}
              className={cn(
                "flex-1 py-3 rounded-xl text-sm font-bold transition-all",
                role === 'recruiter' ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
              )}
            >
              Recruiter
            </button>
          </div>

          <div className="w-full flex justify-center">
            {isLogin ? <SignIn routing="hash" /> : <SignUp routing="hash" />}
          </div>

          <div className="mt-8 pt-8 border-t border-slate-50 text-center w-full">
            <p className="text-slate-500 text-sm">
              {isLogin ? "Don't have an account?" : "Already have an account?"}{' '}
              <button 
                type="button"
                onClick={() => setIsLogin(!isLogin)}
                className="text-indigo-600 font-bold hover:underline"
              >
                {isLogin ? 'Sign Up' : 'Log In'}
              </button>
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

const JobSeekerDashboard = ({ userProfile, setActivePage }: { userProfile: UserProfile, setActivePage: (p: string) => void }) => {
  const [applications, setApplications] = useState<Application[]>([]);
  const [externalJobs, setExternalJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingJobs, setLoadingJobs] = useState(true);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [selectedChatApp, setSelectedChatApp] = useState<Application | null>(null);

  useEffect(() => {
    const fetchApplications = async () => {
      try {
        const q = query(collection(db, 'applications'), where('candidateId', '==', userProfile.uid));
        const querySnapshot = await getDocs(q);
        const apps: Application[] = [];
        querySnapshot.forEach((doc) => {
          apps.push({ id: doc.id, ...doc.data() } as Application);
        });
        setApplications(apps);
      } catch (error) {
        console.error("Error fetching applications:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchApplications();
  }, [userProfile.uid]);

  useEffect(() => {
    const getExternalJobs = async () => {
      try {
        const jobs = await fetchExternalJobs();
        setExternalJobs(jobs.slice(0, 6)); // Show top 6
      } catch (error) {
        console.error("Error fetching external jobs:", error);
      } finally {
        setLoadingJobs(false);
      }
    };
    getExternalJobs();
  }, []);

  const handleApplyExternal = async (job: Job) => {
    try {
      const applicationData: Omit<Application, 'id'> = {
        jobId: job.id,
        employerId: job.employerId,
        candidateId: userProfile.uid,
        candidateName: userProfile.name,
        candidateEmail: userProfile.email,
        appliedAt: Date.now(),
        status: 'pending'
      };
      await addDoc(collection(db, 'applications'), applicationData);
      setApplications([...applications, { id: 'temp', ...applicationData } as Application]);
      
      if (job.externalUrl) {
        window.open(job.externalUrl, '_blank');
      }
      setSelectedJob(null);
    } catch (error) {
      console.error("Error applying:", error);
      alert("Failed to record application.");
    }
  };

  return (
    <div className="pt-32 pb-20 px-6 min-h-[70vh]">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center gap-4 mb-12">
          <div className="w-16 h-16 bg-indigo-100 rounded-2xl flex items-center justify-center">
            <Users className="text-indigo-600 w-8 h-8" />
          </div>
          <div>
            <h1 className="text-4xl font-display font-bold text-slate-900">Welcome, {userProfile.name}</h1>
            <p className="text-slate-500">Candidate Dashboard</p>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-12">
          <div className="lg:col-span-1 space-y-8">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
                <h3 className="text-slate-500 font-medium mb-2 text-sm">Applications Sent</h3>
                <p className="text-3xl font-bold text-slate-900">{applications.length}</p>
              </div>
              <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
                <h3 className="text-slate-500 font-medium mb-2 text-sm">Interviews</h3>
                <p className="text-3xl font-bold text-slate-900">0</p>
              </div>
            </div>

            <div>
              <h2 className="text-2xl font-bold text-slate-900 mb-6">Your Applications</h2>
              {loading ? (
                <p className="text-slate-500">Loading applications...</p>
              ) : applications.length === 0 ? (
                <div className="bg-slate-50 p-8 rounded-3xl text-center border border-slate-100">
                  <Briefcase className="w-10 h-10 text-slate-300 mx-auto mb-4" />
                  <h3 className="text-lg font-bold text-slate-900 mb-2">No applications yet</h3>
                  <p className="text-slate-500 text-sm mb-6">Start applying to jobs to see them here.</p>
                  <button 
                    onClick={() => setActivePage('jobs')}
                    className="bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-indigo-700 transition-all text-sm w-full"
                  >
                    Find Jobs
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {applications.map(app => (
                    <div key={app.id} className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col gap-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="font-bold text-slate-900 text-sm">Job ID: {app.jobId}</h3>
                          <p className="text-xs text-slate-500">Applied on {new Date(app.appliedAt).toLocaleDateString()}</p>
                        </div>
                        <span className={cn(
                          "px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider",
                          app.status === 'pending' ? "bg-amber-50 text-amber-600" :
                          app.status === 'reviewed' ? "bg-blue-50 text-blue-600" :
                          app.status === 'accepted' ? "bg-emerald-50 text-emerald-600" :
                          app.status === 'on_hold' ? "bg-amber-50 text-amber-600" :
                          "bg-rose-50 text-rose-600"
                        )}>
                          {app.status}
                        </span>
                      </div>
                      {app.status === 'accepted' && (
                        <div className="mt-2 pt-2 border-t border-slate-50 flex justify-end">
                          <button onClick={() => setSelectedChatApp(app)} className="text-xs font-bold px-3 py-1.5 rounded-lg bg-indigo-50 text-indigo-600 hover:bg-indigo-100">Chat / Interview</button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="lg:col-span-2">
            <div className="flex justify-between items-end mb-6">
              <div>
                <h2 className="text-2xl font-bold text-slate-900">Recommended Opportunities</h2>
                <p className="text-slate-500 text-sm">External jobs curated for you</p>
              </div>
              <button 
                onClick={() => setActivePage('jobs')}
                className="text-indigo-600 font-bold text-sm hover:text-indigo-700 transition-colors"
              >
                View All Jobs &rarr;
              </button>
            </div>

            {loadingJobs ? (
              <div className="py-12 text-center">
                <p className="text-slate-500">Fetching latest opportunities...</p>
              </div>
            ) : externalJobs.length === 0 ? (
              <div className="bg-slate-50 p-12 rounded-3xl text-center border border-slate-100">
                <Globe className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                <h3 className="text-xl font-bold text-slate-900 mb-2">No external jobs found</h3>
                <p className="text-slate-500 mb-6">Check back later for more opportunities.</p>
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 gap-6">
                {externalJobs.map(job => (
                  <JobCard 
                    key={job.id} 
                    job={job} 
                    onApply={() => handleApplyExternal(job)} 
                    onViewDetails={() => setSelectedJob(job)}
                    hasApplied={applications.some(app => app.jobId === job.id)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {selectedJob && (
          <JobDetailsModal 
            job={selectedJob} 
            onClose={() => setSelectedJob(null)} 
            onApply={() => handleApplyExternal(selectedJob)}
            hasApplied={applications.some(app => app.jobId === selectedJob.id)}
          />
        )}

        {selectedChatApp && (
          <ChatModal 
            application={selectedChatApp} 
            currentUser={userProfile} 
            onClose={() => setSelectedChatApp(null)} 
          />
        )}
      </div>
    </div>
  );
};

const EmployerDashboard = ({ userProfile }: { userProfile: UserProfile }) => {
  const [employerJobs, setEmployerJobs] = useState<Job[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateJob, setShowCreateJob] = useState(false);
  const [newJob, setNewJob] = useState({ title: '', company: '', location: '', type: 'Full-time', salary: '', category: '', description: '' });
  const [jobDocFile, setJobDocFile] = useState<File | null>(null);
  const [isPublishing, setIsPublishing] = useState(false);
  const [selectedChatApp, setSelectedChatApp] = useState<Application | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const jobsQuery = query(collection(db, 'jobs'), where('employerId', '==', userProfile.uid));
        const jobsSnapshot = await getDocs(jobsQuery);
        const fetchedJobs: Job[] = [];
        jobsSnapshot.forEach(doc => fetchedJobs.push({ id: doc.id, ...doc.data() } as Job));
        setEmployerJobs(fetchedJobs);

        if (fetchedJobs.length > 0) {
          const appsQuery = query(collection(db, 'applications'), where('employerId', '==', userProfile.uid));
          const appsSnapshot = await getDocs(appsQuery);
          const fetchedApps: Application[] = [];
          appsSnapshot.forEach(doc => {
            fetchedApps.push({ id: doc.id, ...doc.data() } as Application);
          });
          setApplications(fetchedApps);
        }
      } catch (error) {
        console.error("Error fetching employer data:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [userProfile.uid]);

  const handleCreateJob = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsPublishing(true);
    try {
      let documentUrl = '';
      if (jobDocFile) {
        const storageRef = ref(storage, `${userProfile.uid}/job_docs/${Date.now()}_${jobDocFile.name}`);
        const snapshot = await uploadBytes(storageRef, jobDocFile);
        documentUrl = await getDownloadURL(snapshot.ref);
      }

      const jobData = {
        ...newJob,
        employerId: userProfile.uid,
        postedAt: new Date().toLocaleDateString(),
        logo: 'https://picsum.photos/seed/company/100/100',
        documentUrl
      };
      const docRef = await addDoc(collection(db, 'jobs'), jobData);
      setEmployerJobs([...employerJobs, { id: docRef.id, ...jobData } as Job]);
      setShowCreateJob(false);
      setNewJob({ title: '', company: '', location: '', type: 'Full-time', salary: '', category: '', description: '' });
      setJobDocFile(null);
    } catch (error) {
      console.error("Error creating job:", error);
      alert("Failed to create job.");
    } finally {
      setIsPublishing(false);
    }
  };

  const updateApplicationStatus = async (appId: string, newStatus: Application['status']) => {
    try {
      await updateDoc(doc(db, 'applications', appId), { status: newStatus });
      setApplications(applications.map(app => app.id === appId ? { ...app, status: newStatus } : app));
    } catch (error) {
      console.error("Error updating status:", error);
      alert("Failed to update status.");
    }
  };

  return (
    <div className="pt-32 pb-20 px-6 min-h-[70vh]">
      <div className="max-w-5xl mx-auto">
        <div className="flex justify-between items-end mb-12">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-emerald-100 rounded-2xl flex items-center justify-center">
              <Building2 className="text-emerald-600 w-8 h-8" />
            </div>
            <div>
              <h1 className="text-4xl font-display font-bold text-slate-900">Welcome, {userProfile.name}</h1>
              <p className="text-slate-500">Employer Dashboard</p>
            </div>
          </div>
          <button 
            onClick={() => setShowCreateJob(!showCreateJob)}
            className="bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100"
          >
            {showCreateJob ? 'Cancel' : 'Post New Job'}
          </button>
        </div>

        {showCreateJob && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="bg-white p-8 rounded-3xl border border-slate-100 shadow-xl mb-12"
          >
            <h2 className="text-2xl font-bold text-slate-900 mb-6">Create Job Post</h2>
            <form onSubmit={handleCreateJob} className="grid md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Job Title</label>
                <input required type="text" value={newJob.title} onChange={e => setNewJob({...newJob, title: e.target.value})} className="w-full p-3 bg-slate-50 rounded-xl border-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Company Name</label>
                <input required type="text" value={newJob.company} onChange={e => setNewJob({...newJob, company: e.target.value})} className="w-full p-3 bg-slate-50 rounded-xl border-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Location</label>
                <input required type="text" value={newJob.location} onChange={e => setNewJob({...newJob, location: e.target.value})} className="w-full p-3 bg-slate-50 rounded-xl border-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Salary Range</label>
                <input required type="text" value={newJob.salary} onChange={e => setNewJob({...newJob, salary: e.target.value})} placeholder="e.g. $100k - $120k" className="w-full p-3 bg-slate-50 rounded-xl border-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-bold text-slate-700 mb-2">Description</label>
                <textarea required value={newJob.description} onChange={e => setNewJob({...newJob, description: e.target.value})} rows={4} className="w-full p-3 bg-slate-50 rounded-xl border-none focus:ring-2 focus:ring-indigo-500"></textarea>
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-bold text-slate-700 mb-2">Upload Job Profile / Specification Document (Optional)</label>
                <input 
                  type="file" 
                  accept=".pdf,.doc,.docx" 
                  onChange={(e) => setJobDocFile(e.target.files?.[0] || null)}
                  className="w-full p-3 bg-slate-50 rounded-xl border-none focus:ring-2 focus:ring-indigo-500 text-sm" 
                />
              </div>
              <div className="md:col-span-2 flex justify-end">
                <button disabled={isPublishing} type="submit" className="bg-indigo-600 text-white px-8 py-3 rounded-xl font-bold hover:bg-indigo-700 disabled:opacity-50">
                  {isPublishing ? 'Publishing...' : 'Publish Job'}
                </button>
              </div>
            </form>
          </motion.div>
        )}

        <div className="grid md:grid-cols-2 gap-12">
          <div>
            <h2 className="text-2xl font-bold text-slate-900 mb-6">Your Active Jobs</h2>
            {loading ? <p className="text-slate-500">Loading...</p> : employerJobs.length === 0 ? (
              <p className="text-slate-500 bg-slate-50 p-6 rounded-2xl border border-slate-100">No jobs posted yet.</p>
            ) : (
              <div className="space-y-4">
                {employerJobs.map(job => (
                  <div key={job.id} className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="font-bold text-slate-900 text-lg">{job.title}</h3>
                      {job.documentUrl && (
                        <a href={job.documentUrl} target="_blank" rel="noreferrer" className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded-md hover:bg-indigo-100">
                          View Doc
                        </a>
                      )}
                    </div>
                    <p className="text-slate-500 text-sm mb-4">{job.location} • {job.salary}</p>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-slate-400">Posted {job.postedAt}</span>
                      <span className="bg-indigo-50 text-indigo-600 px-3 py-1 rounded-full font-bold">
                        {applications.filter(a => a.jobId === job.id).length} Applicants
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <h2 className="text-2xl font-bold text-slate-900 mb-6">Recent Applicants</h2>
            {loading ? <p className="text-slate-500">Loading...</p> : applications.length === 0 ? (
              <p className="text-slate-500 bg-slate-50 p-6 rounded-2xl border border-slate-100">No applicants yet.</p>
            ) : (
              <div className="space-y-4">
                {applications.map(app => (
                  <div key={app.id} className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h3 className="font-bold text-slate-900">{app.candidateName}</h3>
                        <p className="text-slate-500 text-sm">{app.candidateEmail}</p>
                      </div>
                      <span className={cn(
                        "px-3 py-1 rounded-full text-xs font-bold uppercase",
                        app.status === 'accepted' ? "bg-emerald-50 text-emerald-600" :
                        app.status === 'rejected' ? "bg-rose-50 text-rose-600" :
                        app.status === 'on_hold' ? "bg-amber-50 text-amber-600" :
                        "bg-indigo-50 text-indigo-600"
                      )}>
                        {app.status}
                      </span>
                    </div>
                    <div className="flex justify-between items-center mt-4">
                      <p className="text-sm text-slate-400">Applied for Job ID: {app.jobId}</p>
                      {app.resumeUrl && (
                        <a href={app.resumeUrl} target="_blank" rel="noreferrer" className="text-xs font-bold text-indigo-600 hover:underline">
                          View Resume
                        </a>
                      )}
                    </div>
                    <div className="mt-4 pt-4 border-t border-slate-50 flex flex-wrap gap-2">
                      <button onClick={() => updateApplicationStatus(app.id, 'accepted')} className="text-xs font-bold px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100">Accept</button>
                      <button onClick={() => updateApplicationStatus(app.id, 'rejected')} className="text-xs font-bold px-3 py-1.5 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100">Reject</button>
                      <button onClick={() => updateApplicationStatus(app.id, 'on_hold')} className="text-xs font-bold px-3 py-1.5 rounded-lg bg-amber-50 text-amber-600 hover:bg-amber-100">On Hold</button>
                      {app.status === 'accepted' && (
                        <button onClick={() => setSelectedChatApp(app)} className="text-xs font-bold px-3 py-1.5 rounded-lg bg-indigo-50 text-indigo-600 hover:bg-indigo-100 ml-auto">Chat / Interview</button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {selectedChatApp && (
          <ChatModal 
            application={selectedChatApp} 
            currentUser={userProfile} 
            onClose={() => setSelectedChatApp(null)} 
          />
        )}
      </div>
    </div>
  );
};

const DashboardPage = ({ setActivePage, userProfile }: { setActivePage: (p: string) => void, userProfile: UserProfile | null }) => {
  if (!userProfile) {
    return (
      <div className="pt-32 pb-20 px-6 min-h-[70vh] flex items-center justify-center">
        <p className="text-slate-500">Loading profile...</p>
      </div>
    );
  }

  if (userProfile.role === 'recruiter') {
    return <EmployerDashboard userProfile={userProfile} />;
  }

  return <JobSeekerDashboard userProfile={userProfile} setActivePage={setActivePage} />;
};

const Footer = ({ setActivePage }: { setActivePage: (p: string) => void }) => (
  <footer className="bg-slate-900 text-white py-20 px-6">
    <div className="max-w-7xl mx-auto">
      <div className="grid md:grid-cols-4 gap-12 mb-16">
        <div className="col-span-2">
          <div className="flex items-center gap-2 mb-6">
            <div className="w-8 h-8 bg-indigo-500 rounded-lg flex items-center justify-center">
              <Zap className="text-white w-5 h-5" />
            </div>
            <span className="text-xl font-display font-bold tracking-tight">Hirely</span>
          </div>
          <p className="text-slate-400 max-w-sm mb-8">
            The world's most advanced AI-powered job portal. Connecting top talent with innovative companies through neural matching.
          </p>
          <div className="flex gap-4">
            {['Twitter', 'LinkedIn', 'Instagram'].map(s => (
              <a key={s} href="#" className="text-slate-400 hover:text-white transition-colors text-sm font-bold">{s}</a>
            ))}
          </div>
        </div>
        <div>
          <h4 className="font-bold mb-6">Platform</h4>
          <ul className="space-y-4 text-slate-400">
            <li><button onClick={() => setActivePage('jobs')} className="hover:text-white transition-colors">Find Jobs</button></li>
            <li><button onClick={() => setActivePage('companies')} className="hover:text-white transition-colors">Companies</button></li>
            <li><button onClick={() => setActivePage('join')} className="hover:text-white transition-colors">Talent Network</button></li>
            <li><button className="hover:text-white transition-colors">For Employers</button></li>
          </ul>
        </div>
        <div>
          <h4 className="font-bold mb-6">Company</h4>
          <ul className="space-y-4 text-slate-400">
            <li><button className="hover:text-white transition-colors">Careers</button></li>
            <li><button className="hover:text-white transition-colors">Privacy Policy</button></li>
            <li><button className="hover:text-white transition-colors">Contact</button></li>
          </ul>
        </div>
      </div>
      <div className="pt-8 border-t border-slate-800 flex flex-col md:flex-row justify-between items-center gap-4 text-slate-500 text-sm">
        <p>© 2024 Hirely Inc. All rights reserved.</p>
        <p>Built with precision for the future of work.</p>
      </div>
    </div>
  </footer>
);

export default function App() {
  const [activePage, setActivePage] = useState('home');
  const [searchQuery, setSearchQuery] = useState('');
  const { user, isLoaded, isSignedIn } = useUser();
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [checkingProfile, setCheckingProfile] = useState(true);

  useEffect(() => {
    const fetchProfile = async () => {
      if (isSignedIn && user) {
        setCheckingProfile(true);
        try {
          const docRef = doc(db, 'users', user.id);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            setUserProfile(docSnap.data() as UserProfile);
          } else {
            const intendedRole = (localStorage.getItem('intendedRole') as 'candidate' | 'recruiter') || 'candidate';
            const newProfile: UserProfile = {
              uid: user.id,
              email: user.primaryEmailAddress?.emailAddress || '',
              name: user.fullName || user.primaryEmailAddress?.emailAddress?.split('@')[0] || 'User',
              role: intendedRole
            };
            await setDoc(docRef, newProfile);
            setUserProfile(newProfile);
          }
        } catch (error) {
          console.error("Error fetching user profile:", error);
        } finally {
          setCheckingProfile(false);
        }
      } else {
        setUserProfile(null);
        setCheckingProfile(false);
      }
    };

    if (isLoaded) {
      fetchProfile();
    }
  }, [isSignedIn, user?.id, isLoaded]);

  // Scroll to top on page change
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [activePage]);

  // Auto-redirect to dashboard after sign-in
  useEffect(() => {
    if (isLoaded && isSignedIn && activePage === 'join') {
      setActivePage('dashboard');
    }
  }, [isLoaded, isSignedIn, activePage]);

  if (isLoaded && isSignedIn && checkingProfile && !userProfile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-slate-500 font-medium">Loading your profile...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col selection:bg-indigo-100 selection:text-indigo-900">
      <Navbar activePage={activePage} setActivePage={setActivePage} />
      
      <main className="flex-grow">
        <AnimatePresence mode="wait">
          <motion.div
            key={activePage}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
          >
            {activePage === 'home' && <HomePage setActivePage={setActivePage} setSearchQuery={setSearchQuery} />}
            {activePage === 'jobs' && <JobsPage userProfile={userProfile} setActivePage={setActivePage} initialSearch={searchQuery} />}
            {activePage === 'companies' && <CompaniesPage />}
            {activePage === 'join' && <JoinPage />}
            {activePage === 'dashboard' && <DashboardPage setActivePage={setActivePage} userProfile={userProfile} />}
          </motion.div>
        </AnimatePresence>
      </main>

      <Footer setActivePage={setActivePage} />
    </div>
  );
}
