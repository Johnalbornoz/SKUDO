/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export enum InstallationLevel {
  LEVEL_1 = 1,
  LEVEL_2 = 2,
  LEVEL_3 = 3,
  LEVEL_4 = 4,
  LEVEL_5 = 5
}

export enum EffectivenessLevel {
  SUFFICIENT = "Suficiente (75-100%)",
  SCARCE = "Escasa (50-74%)",
  AT_LEAST_ONE = "Al menos una (1-49%)",
  NONE = "No hay (0%)"
}

export interface Question {
  id: string;
  text: string;
  category: string;
  applicableLevels: InstallationLevel[];
}

export interface Finding {
  situation: string;
  evidence: string;
  recommendation: string;
}

export interface DiagnosisResponse {
  questionId: string;
  score: number; // 0-100
  effectiveness: EffectivenessLevel;
  finding: Finding;
  triangulation: {
    documents: string[];
    observations: string[];
    interviews: string[];
  };
  expertId?: string;
}

export interface DiagnosisSession {
  id: string;
  userId?: string;
  installationName: string;
  level: InstallationLevel;
  sector: string;
  substances: string;
  staffCount: number;
  age: number;
  responses: DiagnosisResponse[];
  status: 'draft' | 'completed';
  createdAt: string;
  fieldNotes: string[];
  interviews: { person: string; role: string; notes: string }[];
}

export interface SystemConfig {
  id: string;
  systemPrompt: string;
  updatedAt: string;
}
