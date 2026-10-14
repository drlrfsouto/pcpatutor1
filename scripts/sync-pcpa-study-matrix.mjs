import { copyFile, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const canonicalPath = resolve(root, 'supabase/data/pcpa-study-priority-matrix.v1.json');
const functionPath = resolve(root, 'supabase/functions/_shared/pcpa-study-priority-matrix.v1.json');
const matrix = JSON.parse(await readFile(canonicalPath, 'utf8'));

const requiredRoles = ['delegado', 'investigador', 'escrivao', 'papiloscopista'];
const roleIds = matrix.roles?.map((role) => role.id) ?? [];
if (JSON.stringify(roleIds) !== JSON.stringify(requiredRoles)) {
  throw new Error(`A matriz deve conter exatamente as trilhas ${requiredRoles.join(', ')}.`);
}
if (matrix.schema_version !== 1 || !/^\d{4}-\d{2}-\d{2}\.\d+$/.test(matrix.version)) {
  throw new Error('Versão ou schema da matriz inválido.');
}

const sourceIds = new Set(matrix.sources?.map((source) => source.id) ?? []);
const expected = {
  delegado: { notice: 'C-206/2020', questions: 80, points: 10, subjects: 14 },
  investigador: { notice: 'C-207/2020', questions: 60, points: 10, subjects: 11 },
  escrivao: { notice: 'C-207/2020', questions: 60, points: 10, subjects: 11 },
  papiloscopista: { notice: 'C-207/2020', questions: 60, points: 10, subjects: 13 },
};
const expectedSubjects = {
  delegado: ['Língua Portuguesa', 'Informática', 'Conhecimentos sobre o Estado do Pará', 'Direito Administrativo', 'Direito Constitucional', 'Direito Penal Geral', 'Direito Processual Penal', 'Direito Civil', 'Direito Processual Civil', 'Direito Ambiental', 'Direitos Humanos', 'Legislação Especial', 'Criminologia', 'Medicina Legal'],
  investigador: ['Língua Portuguesa', 'Raciocínio Lógico', 'Informática', 'Conhecimentos sobre o Estado do Pará', 'Estatística', 'Contabilidade', 'Direito Administrativo', 'Direito Constitucional', 'Direito Penal Geral', 'Direito Processual Penal', 'Legislação Especial'],
  escrivao: ['Língua Portuguesa', 'Raciocínio Lógico', 'Informática', 'Conhecimentos sobre o Estado do Pará', 'Estatística', 'Direito Administrativo', 'Direito Constitucional', 'Direito Penal Geral', 'Direito Processual Penal', 'Legislação Especial', 'Arquivologia'],
  papiloscopista: ['Língua Portuguesa', 'Raciocínio Lógico', 'Informática', 'Conhecimentos sobre o Estado do Pará', 'Direito Administrativo', 'Direito Constitucional', 'Direito Penal Geral', 'Direito Processual Penal', 'Legislação Especial', 'Medicina Legal', 'Biologia', 'Física', 'Química'],
};
const c207Source = matrix.sources.find((source) => source.id === 'pcpa-c207-edital');
if (c207Source?.url !== 'https://www.ioepa.com.br/pages/2020/2020.11.13.DOE.pdf') {
  throw new Error('A fonte primária do C-207 deve permanecer a edição oficial do DOE nº 34.405 no portal IOEPA.');
}

for (const role of matrix.roles) {
  const rule = expected[role.id];
  const questionTotal = role.subjects.reduce((sum, subject) => sum + subject.question_count, 0);
  const pointsTotal = role.subjects.reduce((sum, subject) => sum + subject.points, 0);
  const uniqueSubjects = new Set(role.subjects.map((subject) => subject.name));
  const expectedSubjectNames = new Set(expectedSubjects[role.id]);
  if (role.subjects.length !== expectedSubjectNames.size || role.subjects.some((subject) => !expectedSubjectNames.has(subject.name))) {
    throw new Error(`A trilha ${role.id} contém matéria ausente ou específica de outro cargo.`);
  }
  if (role.notice !== rule.notice || role.total_questions !== rule.questions || role.total_points !== rule.points) {
    throw new Error(`Cabeçalho ou edital incompatível na trilha ${role.id}.`);
  }
  if (questionTotal !== rule.questions || Math.abs(pointsTotal - rule.points) > 0.0001) {
    throw new Error(`A soma de questões/pontos não confere na trilha ${role.id}: ${questionTotal} questões, ${pointsTotal} pontos.`);
  }
  if (role.subjects.length !== rule.subjects || uniqueSubjects.size !== role.subjects.length) {
    throw new Error(`Quantidade ou nomes de matérias duplicados na trilha ${role.id}.`);
  }
  for (const subject of role.subjects) {
    const expectedPriority = subject.points / role.total_points >= 0.1
      ? 'alta'
      : subject.points / role.total_points >= 0.05
      ? 'media'
      : 'base';
    if (subject.relative_priority !== expectedPriority) {
      throw new Error(`Prioridade relativa incompatível com os pontos oficiais: ${role.id} / ${subject.name}.`);
    }
    if (!subject.scope_summary?.trim() || !Array.isArray(subject.topics) || !subject.topics.length) {
      throw new Error(`Falta escopo ou tópicos em ${role.id} / ${subject.name}.`);
    }
    if (role.notice === 'C-207/2020' && subject.name === 'Legislação Especial') {
      const c207SpecialScope = [subject.scope_summary, ...subject.topics.map((topic) => topic.name)].join(' ').toLowerCase();
      if (c207SpecialScope.includes('crime hediondo') || c207SpecialScope.includes('identificação criminal')) {
        throw new Error(`A matéria específica da trilha ${role.id} parece misturar tópicos de outro edital/cargo.`);
      }
    }
    for (const topic of subject.topics) {
      if (!topic.name?.trim() || !['alta', 'media', 'base'].includes(topic.relative_priority)) {
        throw new Error(`Tópico ou prioridade inválida em ${role.id} / ${subject.name}.`);
      }
      if (!Array.isArray(topic.evidence_ids) || !topic.evidence_ids.length || topic.evidence_ids.some((id) => !sourceIds.has(id))) {
        throw new Error(`Referência ausente ou inválida em ${role.id} / ${subject.name} / ${topic.name}.`);
      }
    }
  }
}

await copyFile(canonicalPath, functionPath);
console.log(`Matriz ${matrix.version} validada e sincronizada para a Edge Function.`);
