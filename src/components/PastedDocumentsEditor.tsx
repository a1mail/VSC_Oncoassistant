import { useState } from 'react';
import { useConsultation } from '@/context/ConsultationContext';
import { MAX_DOCUMENT_TEXT_LENGTH, MAX_PASTED_DOCUMENTS, validatePastedDocument } from '@/lib/clinicalHistory';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';

/** Pasting plain text preserves access to evidence when file attachment is unavailable. */
export function PastedDocumentsEditor() {
  const { data, updateData } = useConsultation();
  const [name, setName] = useState('');
  const [content, setContent] = useState('');
  const [error, setError] = useState('');
  const documents = data.documents || [];
  const pasted = documents.filter((document) => document.source === 'paste');
  const handleAdd = () => {
    try {
      validatePastedDocument(name, content, pasted.length);
      updateData('documents', [...documents, {
        id: crypto.randomUUID(), name: name.trim(), content, type: 'text',
        source: 'paste', includeInAnalysis: true,
      }]);
      setName(''); setContent(''); setError('');
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Не удалось добавить документ.');
    }
  };
  const handleChange = (id: string, field: 'name' | 'content', value: string) =>
    updateData('documents', documents.map((document) => document.id === id ? { ...document, [field]: value } : document));
  return (
    <Card>
      <CardHeader><CardTitle>Вставить текст документа ({pasted.length}/{MAX_PASTED_DOCUMENTS})</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <label className="block text-sm">Название документа
          <Input value={name} maxLength={200} onChange={(event) => setName(event.target.value)} />
        </label>
        <label className="block text-sm">Текст документа (Ctrl+V)
          <Textarea value={content} maxLength={MAX_DOCUMENT_TEXT_LENGTH} onChange={(event) => setContent(event.target.value)} className="min-h-[160px]" />
        </label>
        {error && <p role="alert" className="text-red-600">{error}</p>}
        <Button type="button" disabled={pasted.length >= MAX_PASTED_DOCUMENTS} onClick={handleAdd}>Добавить текстовый документ</Button>
        {pasted.map((document) => (
          <details key={document.id} className="border rounded-lg p-3">
            <summary>Редактировать: {document.name}</summary>
            <label className="block text-sm">Название
              <Input value={document.name} maxLength={200} onChange={(event) => handleChange(document.id, 'name', event.target.value)} />
            </label>
            <label className="block text-sm">Текст
              <Textarea value={document.content} maxLength={MAX_DOCUMENT_TEXT_LENGTH} onChange={(event) => handleChange(document.id, 'content', event.target.value)} />
            </label>
          </details>
        ))}
      </CardContent>
    </Card>
  );
}
