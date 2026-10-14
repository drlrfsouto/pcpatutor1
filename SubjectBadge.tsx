import { Badge } from '@/components/ui/badge';
import { getSubject } from '@/lib/constants/subjects';
import { cn } from '@/lib/utils';

interface SubjectBadgeProps {
  subject: string;
  showIcon?: boolean;
  className?: string;
}

export function SubjectBadge({ subject, showIcon = true, className }: SubjectBadgeProps) {
  const subjectData = getSubject(subject);
  if (!subjectData) return <Badge variant="outline" className={cn('whitespace-normal', className)}>{subject}</Badge>;
  const Icon = subjectData.icon;
  return (
    <Badge variant="outline" className={cn(subjectData.color, subjectData.bgColor, subjectData.borderColor, 'whitespace-normal', className)}>
      {showIcon && <Icon aria-hidden="true" className="mr-1.5 h-3 w-3 shrink-0" />}
      <span>{subjectData.name}</span>
    </Badge>
  );
}

export default SubjectBadge;
