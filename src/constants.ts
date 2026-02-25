import { Question, InstallationLevel } from './types';

export const PSM_QUESTIONS: Question[] = [
  {
    id: "PSM-001",
    text: "¿Se cuenta con una política de seguridad de procesos firmada por la alta gerencia?",
    category: "Compromiso con la Seguridad",
    applicableLevels: [InstallationLevel.LEVEL_1, InstallationLevel.LEVEL_2, InstallationLevel.LEVEL_3, InstallationLevel.LEVEL_4, InstallationLevel.LEVEL_5]
  },
  {
    id: "PSM-002",
    text: "¿Los P&IDs están actualizados y reflejan la realidad física de la planta?",
    category: "Información de Seguridad de Procesos",
    applicableLevels: [InstallationLevel.LEVEL_3, InstallationLevel.LEVEL_4, InstallationLevel.LEVEL_5]
  },
  {
    id: "PSM-003",
    text: "¿Se han realizado análisis de riesgos (PHA) en los últimos 5 años?",
    category: "Análisis de Riesgos",
    applicableLevels: [InstallationLevel.LEVEL_2, InstallationLevel.LEVEL_3, InstallationLevel.LEVEL_4, InstallationLevel.LEVEL_5]
  },
  // ... Adding a few more for the demo, in a real app we'd have all 188
  {
    id: "PSM-004",
    text: "¿Existe un programa de integridad mecánica para equipos críticos?",
    category: "Integridad Mecánica",
    applicableLevels: [InstallationLevel.LEVEL_4, InstallationLevel.LEVEL_5]
  },
  {
    id: "PSM-005",
    text: "¿Se investigan todos los incidentes y cuasi-incidentes de proceso?",
    category: "Investigación de Incidentes",
    applicableLevels: [InstallationLevel.LEVEL_1, InstallationLevel.LEVEL_2, InstallationLevel.LEVEL_3, InstallationLevel.LEVEL_4, InstallationLevel.LEVEL_5]
  }
];
