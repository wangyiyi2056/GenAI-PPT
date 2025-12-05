
export enum SlideLayout {
  TITLE = 'TITLE',
  BULLETS = 'BULLETS',
  TWO_COLUMN = 'TWO_COLUMN',
  QUOTE = 'QUOTE',
  BIG_NUMBER = 'BIG_NUMBER',
  CODE = 'CODE',
  IMAGE_TEXT = 'IMAGE_TEXT'
}

export interface SlideContent {
  id: string;
  title: string;
  subtitle?: string; // For TITLE layout
  bullets?: string[]; // For BULLETS or TWO_COLUMN
  columnLeft?: string[]; // For TWO_COLUMN
  columnRight?: string[]; // For TWO_COLUMN
  quote?: string; // For QUOTE
  author?: string; // For QUOTE
  statistic?: string; // For BIG_NUMBER
  description?: string; // For BIG_NUMBER or CODE context
  code?: string; // For CODE
  language?: string; // For CODE
  imagePrompt?: string; // For IMAGE_TEXT (AI suggestion)
  imageUrl?: string; // For IMAGE_TEXT (Generated result)
  speakerNotes?: string;
  layout: SlideLayout;
}

export interface PresentationState {
  slides: SlideContent[];
  title: string;
  theme: 'light' | 'dark' | 'blue' | 'modern';
  backgroundImage?: string;
}

export enum GenerationStep {
  IDLE = 'IDLE',
  GENERATING_OUTLINE = 'GENERATING_OUTLINE',
  GENERATING_SLIDES = 'GENERATING_SLIDES',
  REGENERATING_SLIDE = 'REGENERATING_SLIDE',
  PARSING_FILE = 'PARSING_FILE',
  GENERATING_IMAGE = 'GENERATING_IMAGE'
}

export enum WorkflowStep {
  INPUT = 'INPUT',
  EDITOR = 'EDITOR',
  EXPORT = 'EXPORT'
}

export interface OutlineItem {
  title: string;
  description: string;
}