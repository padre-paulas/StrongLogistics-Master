import type { Priority } from '../types';

export function getPriorityColor(priority: Priority): string {
  switch (priority) {
    case 'critical': return '#ef4444';
    case 'elevated': return '#f59e0b';
    case 'normal':
    default: return '#22c55e';
  }
}

export function getPriorityMarkerColor(priority: Priority): string {
  switch (priority) {
    case 'critical': return 'red';
    case 'elevated': return 'orange';
    case 'normal':
    default: return 'green';
  }
}
