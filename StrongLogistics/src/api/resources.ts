import apiClient from './client';
import type { Resource } from '../types';

export async function fetchResources(): Promise<Resource[]> {
  const { data } = await apiClient.get<Resource[]>('/api/resources/');
  return data;
}
