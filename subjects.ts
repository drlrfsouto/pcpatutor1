import {
  BarChart3,
  BookOpen,
  Brain,
  Building2,
  FileCheck2,
  FileText,
  Gavel,
  Laptop,
  Scale,
  ScrollText,
} from 'lucide-react';

export const PCPA_SUBJECTS = [
  { name: 'Língua Portuguesa', icon: BookOpen, color: 'text-sky-300', bgColor: 'bg-sky-400/10', borderColor: 'border-sky-400/30' },
  { name: 'Redação', icon: FileText, color: 'text-violet-300', bgColor: 'bg-violet-400/10', borderColor: 'border-violet-400/30' },
  { name: 'Raciocínio Lógico', icon: Brain, color: 'text-pink-300', bgColor: 'bg-pink-400/10', borderColor: 'border-pink-400/30' },
  { name: 'Informática', icon: Laptop, color: 'text-cyan-300', bgColor: 'bg-cyan-400/10', borderColor: 'border-cyan-400/30' },
  { name: 'Direito Administrativo', icon: Building2, color: 'text-orange-300', bgColor: 'bg-orange-400/10', borderColor: 'border-orange-400/30' },
  { name: 'Legislação Administrativa - Regime Jurídico Único - RJU', icon: ScrollText, color: 'text-amber-300', bgColor: 'bg-amber-400/10', borderColor: 'border-amber-400/30' },
  { name: 'Direito Constitucional', icon: Scale, color: 'text-emerald-300', bgColor: 'bg-emerald-400/10', borderColor: 'border-emerald-400/30' },
  { name: 'Direito Penal Geral', icon: Gavel, color: 'text-rose-300', bgColor: 'bg-rose-400/10', borderColor: 'border-rose-400/30' },
  { name: 'Direito Processual Penal', icon: FileCheck2, color: 'text-red-300', bgColor: 'bg-red-400/10', borderColor: 'border-red-400/30' },
  { name: 'Legislação Especial', icon: ScrollText, color: 'text-indigo-300', bgColor: 'bg-indigo-400/10', borderColor: 'border-indigo-400/30' },
  { name: 'Estatística', icon: BarChart3, color: 'text-teal-300', bgColor: 'bg-teal-400/10', borderColor: 'border-teal-400/30' },
] as const;

export type SubjectName = (typeof PCPA_SUBJECTS)[number]['name'];
export const SUBJECT_NAMES = PCPA_SUBJECTS.map((subject) => subject.name) as SubjectName[];

export function getSubject(name: string) {
  return PCPA_SUBJECTS.find((subject) => subject.name === name);
}

export function isOfficialSubject(name: string): name is SubjectName {
  return SUBJECT_NAMES.includes(name as SubjectName);
}
