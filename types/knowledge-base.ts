export interface PersonContact {
  name?: string;
  email?: string;
  relationship?: string;
  notes?: string;
  company?: string;
}

export interface ChildProfile {
  name?: string;
  age?: string;
  school?: string;
  peDay?: string[];
  activities?: Record<string, string>;
  notes?: string;
}

export interface ImportantDate {
  label?: string;
  date?: string;
  notes?: string;
}

export interface JobApplication {
  company?: string;
  role?: string;
  status?: string;
  nextAction?: string;
  priority?: number;
}

export interface PersonalBuild {
  name?: string;
  description?: string;
  status?: string;
  nextAction?: string;
}

export interface StructuredProjects {
  jobApplications?: JobApplication[];
  personalBuilds?: PersonalBuild[];
}

export type CurrentProjects = string[] | StructuredProjects;

export function getProjectCount(projects?: CurrentProjects): number {
  if (!projects) return 0;
  if (Array.isArray(projects)) return projects.length;
  return (projects.jobApplications?.length ?? 0) + (projects.personalBuilds?.length ?? 0);
}

export function hasProjects(projects?: CurrentProjects): boolean {
  return getProjectCount(projects) > 0;
}

export interface KnowledgeBase {
  identity?: {
    name?: string;
    preferredName?: string;
    pronouns?: string;
    age?: string;
    role?: string;
    company?: string;
    industry?: string;
    location?: string;
    timezone?: string;
    languages?: string[];
    bio?: string;
    background?: string;
    aspirations?: string;
    values?: string[];
    strengths?: string[];
    growthAreas?: string[];
    linkedIn?: string;
    personalEmail?: string;
    workEmail?: string;
    phone?: string;
    website?: string;
  };
  work?: {
    role?: string;
    title?: string;
    department?: string;
    companyStage?: string;
    industry?: string;
    teamSize?: string;
    manager?: PersonContact;
    directReports?: PersonContact[];
    currentProjects?: CurrentProjects;
    keyStakeholders?: string[];
    keyContacts?: PersonContact[];
    toolsAndStack?: string[];
    communicationStyle?: string;
    meetingPreferences?: string;
    typicalDay?: string;
    deepWorkBlocks?: string;
    workHours?: string;
    officeLocation?: string;
    emailHandlingRules?: string;
    decisionStyle?: string;
    careerFocus?: string;
    urgentFrom?: string[];
    skipFrom?: string[];
  };
  relationships?: {
    mentors?: PersonContact[];
    collaborators?: PersonContact[];
    innerCircle?: PersonContact[];
    friends?: PersonContact[];
    reviewFrequency?: number;
    importantDates?: ImportantDate[];
    lastMonitorRun?: string;
    interactionGraph?: {
      updatedAt?: string;
      entries?: Array<{
        name: string;
        email?: string;
        relationship?: string;
        company?: string;
        lastTouch?: string;
        channels?: string[];
        interactions?: Array<{ at: string; channel: string; summary?: string }>;
      }>;
    };
  };
  family?: {
    partner?: PersonContact & { work?: string };
    children?: ChildProfile[];
    pets?: string[];
    householdNotes?: string;
    caregiving?: string;
  };
  health?: {
    workoutSchedule?: Record<string, string>;
    fitnessLevel?: string;
    injuries?: string[];
    dietaryPreferences?: string[];
    goalCalories?: number;
    currentGoals?: string[];
    sleepSchedule?: string;
    energyPatterns?: string;
    allergies?: string[];
    medications?: string[];
    medicalNotes?: string;
    mentalHealthNotes?: string;
    sync?: {
      provider?: 'strava' | 'apple_health' | 'whoop' | 'manual';
      lastSyncedAt?: string;
      recentActivities?: Array<{ type: string; at: string; durationMins?: number; notes?: string }>;
    };
  };
  routines?: {
    morningRoutine?: string;
    eveningRoutine?: string;
    weeklyRituals?: string[];
    commute?: string;
  };
  goals?: {
    lifePriorities?: string[];
    shortTerm?: string[];
    longTerm?: string[];
    nonNegotiables?: string[];
    antiGoals?: string[];
    legacyVision?: string;
  };
  learning?: {
    interests?: string[];
    currentlyLearning?: string[];
    readingList?: string[];
  };
  preferences?: {
    newsTopics?: string[];
    briefingTime?: string;
    focusHours?: string;
    defaultAutonomyLevel?: 'supervised' | 'semi-autonomous' | 'autonomous';
    domainAutonomy?: Partial<Record<'email' | 'calendar' | 'kb' | 'finance' | 'health', 'supervised' | 'semi-autonomous' | 'autonomous'>>;
    writingTone?: string;
    decisionSpeed?: string;
    notificationPreferences?: string;
    onboardingComplete?: boolean;
    onboardingMode?: 'quick' | 'full';
  };
  _notes?: string[];
}

export const WORKOUT_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;

export const TIMEZONES = [
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Asia/Tokyo',
  'Asia/Singapore',
  'Australia/Sydney',
  'Pacific/Auckland',
] as const;

export const PRONOUNS = ['she/her', 'he/him', 'they/them', 'she/they', 'he/they', 'prefer not to say'] as const;

export const COMPANY_STAGES = ['pre-seed', 'seed', 'series-a', 'series-b+', 'growth', 'enterprise', 'solo/freelance', 'non-profit', 'other'] as const;
