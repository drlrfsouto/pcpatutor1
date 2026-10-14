import matrixJson from "./pcpa-study-priority-matrix.v1.json" with { type: "json" };

export type StudyRoleId = "delegado" | "investigador" | "escrivao" | "papiloscopista";

export interface StudyTopic {
  name: string;
  relative_priority: "alta" | "media" | "base";
  evidence_ids: string[];
}

export interface StudyRoleSubject {
  name: string;
  question_count: number;
  points: number;
  relative_priority: "alta" | "media" | "base";
  scope_summary: string;
  topics: StudyTopic[];
}

export interface StudyRole {
  id: StudyRoleId;
  label: string;
  notice: "C-206/2020" | "C-207/2020";
  source_id: string;
  total_questions: number;
  total_points: number;
  subjects: StudyRoleSubject[];
}

interface StudyMatrix {
  schema_version: number;
  version: string;
  roles: StudyRole[];
}

export const STUDY_MATRIX = matrixJson as StudyMatrix;

export function normalizeStudyRoleId(value: unknown): StudyRoleId | null {
  if (typeof value !== "string") return null;
  return STUDY_MATRIX.roles.find((role) => role.id === value)?.id ?? null;
}

export function getStudyRole(roleId: unknown): StudyRole | null {
  const normalizedRoleId = normalizeStudyRoleId(roleId);
  if (!normalizedRoleId) return null;
  return STUDY_MATRIX.roles.find((role) => role.id === normalizedRoleId) ?? null;
}

export function getRoleSubject(roleId: unknown, subjectName: string): StudyRoleSubject | null {
  return getStudyRole(roleId)?.subjects.find((subject) => subject.name === subjectName) ?? null;
}

export function isStudySubject(roleId: unknown, subjectName: string): boolean {
  return Boolean(getRoleSubject(roleId, subjectName));
}

export function isStudyTopic(roleId: unknown, subjectName: string, topicName: string): boolean {
  if (topicName === "geral") return isStudySubject(roleId, subjectName);
  return Boolean(getRoleSubject(roleId, subjectName)?.topics.some((topic) => topic.name === topicName));
}
