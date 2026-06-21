import { z } from 'zod';
import type { InstrumentType } from '@/types/sonic';
import type { GenreKey, TrackMap } from '@/lib/music/genreTemplates';

export const TrackIdSchema = z.enum(['drums', 'bass', 'melody', 'voice', 'fx']);
export const MusicScopeSchema = z.enum(['full_arrangement', 'track_only', 'modify_current', 'tempo_only', 'repair', 'chat']);
export const DensitySchema = z.enum(['sparse', 'balanced', 'dense']);
export const SectionIntentSchema = z.enum(['intro', 'core_loop', 'fill', 'drop', 'variation', 'repair']);

export const TrackMapSchema = z.object({
    drums: z.string().nullable(),
    bass: z.string().nullable(),
    melody: z.string().nullable(),
    voice: z.string().nullable(),
    fx: z.string().nullable(),
});
export const MusicQualityTargetSchema = z.object({
    styleIdentity: z.string(),
    artistReference: z.string().nullable(),
    tempoRange: z.tuple([z.number().int().min(40).max(240), z.number().int().min(40).max(240)]),
    rhythmicFeel: z.string(),
    harmony: z.string(),
    arrangement: z.string(),
    energy: z.string(),
    soundDesign: z.array(z.string()),
    requiredTracks: z.array(TrackIdSchema),
    requiredCodeTraits: z.array(z.string()),
    forbiddenTraits: z.array(z.string()),
});

export const MusicBriefSchema = z.object({
    prompt: z.string(),
    intentKind: z.string(),
    genre: z.string(),
    subgenre: z.string().nullable(),
    mood: z.array(z.string()),
    bpm: z.number().int().min(40).max(240),
    key: z.string(),
    scale: z.string(),
    instruments: z.array(TrackIdSchema),
    targetTracks: z.array(TrackIdSchema),
    preserveTracks: z.array(TrackIdSchema),
    clearTracks: z.array(TrackIdSchema),
    requestedScope: MusicScopeSchema,
    sectionIntent: SectionIntentSchema,
    references: z.array(z.string()),
    constraints: z.array(z.string()),
    qualityTarget: MusicQualityTargetSchema,
    currentBpm: z.number().int().min(40).max(240),
    contextSummary: z.string(),
    variationSeed: z.number().int(),
});

export const TheoryPlanSchema = z.object({
    bpm: z.number().int().min(40).max(240),
    key: z.string(),
    scale: z.string(),
    chordProgression: z.array(z.string()),
    bassRoots: z.array(z.string()),
    rhythmicFeel: z.string(),
    arrangement: z.string(),
    density: DensitySchema,
    variationSeed: z.number().int(),
});

export const SoundPlanSchema = z.object({
    drumPalette: z.array(z.string()),
    bassPalette: z.array(z.string()),
    melodyPalette: z.array(z.string()),
    fxPalette: z.array(z.string()),
    mixRules: z.array(z.string()),
    realismNotes: z.array(z.string()),
});

export const GeneratedTrackSetSchema = z.object({
    bpm: z.number().int().min(40).max(240),
    tracks: TrackMapSchema,
    thought: z.string(),
});

export const ValidationIssueSchema = z.object({
    trackId: TrackIdSchema,
    reason: z.string(),
});

export const ValidationReportSchema = z.object({
    valid: z.boolean(),
    issues: z.array(ValidationIssueSchema),
});

export const QualityReviewSchema = z.object({
    score: z.number().min(0).max(1),
    matchesIntent: z.boolean(),
    listenability: z.boolean(),
    problems: z.array(z.string()),
    improvements: z.array(z.string()),
});

export type TrackId = z.infer<typeof TrackIdSchema>;
export type MusicScope = z.infer<typeof MusicScopeSchema>;
export type Density = z.infer<typeof DensitySchema>;
export type SectionIntent = z.infer<typeof SectionIntentSchema>;
export type MusicQualityTarget = z.infer<typeof MusicQualityTargetSchema>;
export type MusicBrief = z.infer<typeof MusicBriefSchema> & { genre: GenreKey };
export type TheoryPlan = z.infer<typeof TheoryPlanSchema>;
export type SoundPlan = z.infer<typeof SoundPlanSchema>;
export type GeneratedTrackSet = z.infer<typeof GeneratedTrackSetSchema> & { tracks: TrackMap };
export type ValidationReport = z.infer<typeof ValidationReportSchema>;
export type QualityReview = z.infer<typeof QualityReviewSchema>;

export type MusicAgentStage =
    | 'UserIntentAgent'
    | 'MusicTheoryAgent'
    | 'SoundDesignAgent'
    | 'StrudelCodeAgent'
    | 'CodeValidationAgent'
    | 'MusicQualityReviewAgent'
    | 'RefinementAgent';

export type MusicAgentTrace = {
    stage: MusicAgentStage;
    summary: string;
};

export type MusicAgentPipelineResult = GeneratedTrackSet & {
    brief: MusicBrief;
    theory: TheoryPlan;
    sound: SoundPlan;
    validation: ValidationReport;
    review: QualityReview;
    traces: MusicAgentTrace[];
    source: 'local_pipeline' | 'openrouter_agent' | 'fallback';
};

export const TRACK_IDS: InstrumentType[] = ['drums', 'bass', 'melody', 'voice', 'fx'];
