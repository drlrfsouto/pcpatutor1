import {
  Archive,
  Atom,
  BarChart3,
  BookOpen,
  Brain,
  Building2,
  Calculator,
  FileCheck2,
  FileText,
  Fingerprint,
  FlaskConical,
  Gavel,
  Laptop,
  Leaf,
  MapPin,
  Microscope,
  Scale,
  ScrollText,
  ShieldCheck,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import studyMatrixJson from '../../../supabase/data/pcpa-study-priority-matrix.v1.json';

export type StudyPriority = 'alta' | 'media' | 'base';

export interface StudyTopicPriority {
  name: string;
  relative_priority: StudyPriority;
  evidence_ids: string[];
}

export interface RoleSubjectProfile {
  name: string;
  question_count: number;
  points: number;
  relative_priority: StudyPriority;
  scope_summary: string;
  topics: StudyTopicPriority[];
}

export interface StudyRoleProfile {
  id: 'delegado' | 'investigador' | 'escrivao' | 'papiloscopista';
  label: string;
  notice: 'C-206/2020' | 'C-207/2020';
  source_id: string;
  total_questions: number;
  total_points: number;
  question_format: { type: 'multipla_escolha'; alternatives: 5; correct_answers: 1 };
  discursive_note: string;
  subjects: RoleSubjectProfile[];
}

interface PCPAStudyMatrix {
  schema_version: number;
  version: string;
  last_reviewed: string;
  methodology: {
    title: string;
    disclaimer: string;
    historical_notice_warning: string;
    role_separation: string;
    priority_rules: Record<string, string | number>;
    comparative_method: string;
    question_policy: string;
    source_validation_note?: string;
  };
  sources: Array<Record<string, unknown>>;
  comparators: Array<Record<string, unknown>>;
  roles: StudyRoleProfile[];
}

export const PCPA_STUDY_MATRIX = studyMatrixJson as PCPAStudyMatrix;

interface SubjectDefinition {
  name: string;
  icon: LucideIcon;
  color: string;
  bgColor: string;
  borderColor: string;
}

// Superset for legacy records, badges and statistics. Study screens use
// getSubjectsForRole() so cargo-specific subjects are never mixed in selectors.
export const PCPA_SUBJECTS = [
  { name: 'Língua Portuguesa', icon: BookOpen, color: 'text-sky-300', bgColor: 'bg-sky-400/10', borderColor: 'border-sky-400/30' },
  { name: 'Redação', icon: FileText, color: 'text-violet-300', bgColor: 'bg-violet-400/10', borderColor: 'border-violet-400/30' },
  { name: 'Raciocínio Lógico', icon: Brain, color: 'text-pink-300', bgColor: 'bg-pink-400/10', borderColor: 'border-pink-400/30' },
  { name: 'Informática', icon: Laptop, color: 'text-cyan-300', bgColor: 'bg-cyan-400/10', borderColor: 'border-cyan-400/30' },
  { name: 'Conhecimentos sobre o Estado do Pará', icon: MapPin, color: 'text-lime-300', bgColor: 'bg-lime-400/10', borderColor: 'border-lime-400/30' },
  { name: 'Contabilidade', icon: Calculator, color: 'text-emerald-300', bgColor: 'bg-emerald-400/10', borderColor: 'border-emerald-400/30' },
  { name: 'Estatística', icon: BarChart3, color: 'text-teal-300', bgColor: 'bg-teal-400/10', borderColor: 'border-teal-400/30' },
  { name: 'Direito Administrativo', icon: Building2, color: 'text-orange-300', bgColor: 'bg-orange-400/10', borderColor: 'border-orange-400/30' },
  { name: 'Legislação Administrativa - Regime Jurídico Único - RJU', icon: ScrollText, color: 'text-amber-300', bgColor: 'bg-amber-400/10', borderColor: 'border-amber-400/30' },
  { name: 'Direito Constitucional', icon: Scale, color: 'text-emerald-300', bgColor: 'bg-emerald-400/10', borderColor: 'border-emerald-400/30' },
  { name: 'Direito Penal Geral', icon: Gavel, color: 'text-rose-300', bgColor: 'bg-rose-400/10', borderColor: 'border-rose-400/30' },
  { name: 'Direito Processual Penal', icon: FileCheck2, color: 'text-red-300', bgColor: 'bg-red-400/10', borderColor: 'border-red-400/30' },
  { name: 'Legislação Especial', icon: ScrollText, color: 'text-indigo-300', bgColor: 'bg-indigo-400/10', borderColor: 'border-indigo-400/30' },
  { name: 'Arquivologia', icon: Archive, color: 'text-amber-200', bgColor: 'bg-amber-300/10', borderColor: 'border-amber-300/30' },
  { name: 'Medicina Legal', icon: Microscope, color: 'text-fuchsia-300', bgColor: 'bg-fuchsia-400/10', borderColor: 'border-fuchsia-400/30' },
  { name: 'Biologia', icon: ShieldCheck, color: 'text-green-300', bgColor: 'bg-green-400/10', borderColor: 'border-green-400/30' },
  { name: 'Física', icon: Atom, color: 'text-blue-300', bgColor: 'bg-blue-400/10', borderColor: 'border-blue-400/30' },
  { name: 'Química', icon: FlaskConical, color: 'text-cyan-200', bgColor: 'bg-cyan-300/10', borderColor: 'border-cyan-300/30' },
  { name: 'Direito Civil', icon: BookOpen, color: 'text-amber-200', bgColor: 'bg-amber-300/10', borderColor: 'border-amber-300/30' },
  { name: 'Direito Processual Civil', icon: FileText, color: 'text-orange-200', bgColor: 'bg-orange-300/10', borderColor: 'border-orange-300/30' },
  { name: 'Direito Ambiental', icon: Leaf, color: 'text-green-200', bgColor: 'bg-green-300/10', borderColor: 'border-green-300/30' },
  { name: 'Direitos Humanos', icon: Scale, color: 'text-rose-200', bgColor: 'bg-rose-300/10', borderColor: 'border-rose-300/30' },
  { name: 'Criminologia', icon: Fingerprint, color: 'text-purple-200', bgColor: 'bg-purple-300/10', borderColor: 'border-purple-300/30' },
] as const satisfies readonly SubjectDefinition[];

export type SubjectName = (typeof PCPA_SUBJECTS)[number]['name'];
export type StudyRoleId = StudyRoleProfile['id'];
export type SubjectInfo = (typeof PCPA_SUBJECTS)[number];

export const SUBJECT_NAMES = PCPA_SUBJECTS.map((subject) => subject.name) as SubjectName[];
export const STUDY_ROLES = PCPA_STUDY_MATRIX.roles.map(({ id, label, notice }) => ({ id, label, notice }));

export function getSubject(name: string) {
  return PCPA_SUBJECTS.find((subject) => subject.name === name);
}

export function isOfficialSubject(name: string): name is SubjectName {
  return SUBJECT_NAMES.includes(name as SubjectName);
}

export function isStudyRoleId(value: unknown): value is StudyRoleId {
  return typeof value === 'string' && PCPA_STUDY_MATRIX.roles.some((role) => role.id === value);
}

export function getStudyRole(roleId: StudyRoleId | null | undefined) {
  return roleId ? PCPA_STUDY_MATRIX.roles.find((role) => role.id === roleId) : undefined;
}

export function getSubjectsForRole(roleId: StudyRoleId | null | undefined): SubjectInfo[] {
  const role = getStudyRole(roleId);
  if (!role) return [];
  return role.subjects
    .map((profile) => getSubject(profile.name))
    .filter((subject): subject is SubjectInfo => Boolean(subject));
}

export function getRoleSubject(roleId: StudyRoleId | null | undefined, name: string) {
  return getStudyRole(roleId)?.subjects.find((subject) => subject.name === name);
}

export function isSubjectInRole(roleId: StudyRoleId | null | undefined, name: string): boolean {
  return Boolean(getRoleSubject(roleId, name));
}

export function getPriorityLabel(priority: StudyPriority): string {
  if (priority === 'alta') return 'Alta';
  if (priority === 'media') return 'Média';
  return 'Base do edital';
}
