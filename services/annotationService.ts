import { supabase } from './supabaseClient';
import type { Annotation, AnnotationContent, AnnotationKind, AnnotationAnchor } from '../types';

type AnnotationRow = {
  id: string;
  user_id: string;
  document_id: string;
  page_number: number;
  kind: AnnotationKind;
  anchor: AnnotationAnchor;
  content: AnnotationContent | null;
  created_at: string;
  updated_at: string | null;
};

const mapAnnotationRow = (row: AnnotationRow): Annotation => ({
  id: row.id,
  userId: row.user_id,
  documentId: row.document_id,
  pageNumber: row.page_number,
  kind: row.kind,
  anchor: row.anchor,
  content: row.content ?? undefined,
  createdAt: row.created_at,
  updatedAt: row.updated_at ?? undefined,
});

export const fetchAnnotationsForDocument = async (documentId: string): Promise<Annotation[]> => {
  const { data, error } = await supabase
    .from('annotations')
    .select('*')
    .eq('document_id', documentId)
    .order('page_number', { ascending: true })
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Failed to load annotations:', error);
    return [];
  }

  return (data as AnnotationRow[]).map(mapAnnotationRow);
};

export const createAnnotation = async (input: {
  documentId: string;
  pageNumber: number;
  kind: AnnotationKind;
  anchor: AnnotationAnchor;
  content?: AnnotationContent;
}): Promise<Annotation | null> => {
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    console.error('Unable to load user for annotation:', userError);
    return null;
  }

  const { data, error } = await supabase
    .from('annotations')
    .insert({
      user_id: user.id,
      document_id: input.documentId,
      page_number: input.pageNumber,
      kind: input.kind,
      anchor: input.anchor,
      content: input.content ?? null,
    })
    .select('*')
    .single();

  if (error || !data) {
    console.error('Failed to create annotation:', error);
    return null;
  }

  return mapAnnotationRow(data as AnnotationRow);
};

export const updateAnnotation = async (annotationId: string, updates: {
  anchor?: AnnotationAnchor;
  content?: AnnotationContent;
  kind?: AnnotationKind;
}): Promise<Annotation | null> => {
  const { data, error } = await supabase
    .from('annotations')
    .update({
      anchor: updates.anchor,
      content: updates.content ?? null,
      kind: updates.kind,
    })
    .eq('id', annotationId)
    .select('*')
    .single();

  if (error || !data) {
    console.error('Failed to update annotation:', error);
    return null;
  }

  return mapAnnotationRow(data as AnnotationRow);
};

export const deleteAnnotation = async (annotationId: string): Promise<boolean> => {
  const { error } = await supabase
    .from('annotations')
    .delete()
    .eq('id', annotationId);

  if (error) {
    console.error('Failed to delete annotation:', error);
    return false;
  }

  return true;
};
