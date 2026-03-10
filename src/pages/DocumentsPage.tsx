import React, { useState } from 'react';
import { useConsultation } from '@/context/ConsultationContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FileText, Image as ImageIcon, Trash2, Eye, Upload, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export function DocumentsPage() {
  const { data, updateData } = useConsultation();
  const [isUploading, setIsUploading] = useState(false);
  const navigate = useNavigate();

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    const newDocs = [...(data.documents || [])];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const reader = new FileReader();

      await new Promise<void>((resolve) => {
        reader.onload = (e) => {
          const content = e.target?.result as string;
          const isImage = file.type.startsWith('image/');
          
          newDocs.push({
            id: Math.random().toString(36).substr(2, 9),
            name: file.name,
            type: isImage ? 'image' : 'text',
            content: content,
            includeInAnalysis: true
          });
          resolve();
        };

        if (file.type.startsWith('image/')) {
          reader.readAsDataURL(file);
        } else {
          reader.readAsText(file);
        }
      });
    }

    updateData('documents', newDocs);
    setIsUploading(false);
    // Reset input
    if (event.target) {
      event.target.value = '';
    }
  };

  const removeDocument = (id: string) => {
    const newDocs = (data.documents || []).filter(doc => doc.id !== id);
    updateData('documents', newDocs);
  };

  const toggleAnalysis = (id: string) => {
    const newDocs = (data.documents || []).map(doc => {
      if (doc.id === id) {
        return { ...doc, includeInAnalysis: !doc.includeInAnalysis };
      }
      return doc;
    });
    updateData('documents', newDocs);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Документы</h2>
          <p className="text-slate-500">Загрузка выписок, справок и результатов обследований.</p>
        </div>
        <div className="flex gap-4">
          <input
            type="file"
            id="doc-upload"
            className="hidden"
            multiple
            accept=".txt,.md,.json,.csv,image/*"
            onChange={handleFileUpload}
          />
          <Label htmlFor="doc-upload">
            <Button variant="outline" className="cursor-pointer" asChild>
              <span>
                <Upload className="w-4 h-4 mr-2" />
                Загрузить файлы
              </span>
            </Button>
          </Label>
          <Button onClick={() => navigate('/diagnosis')} className="gap-2">
            Далее: Диагноз <ArrowRight className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {data.documents?.map((doc) => (
          <Card key={doc.id} className="relative group hover:shadow-md transition-shadow">
            <CardHeader className="pb-2">
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-2">
                  {doc.type === 'image' ? (
                    <ImageIcon className="w-5 h-5 text-blue-500" />
                  ) : (
                    <FileText className="w-5 h-5 text-slate-500" />
                  )}
                  <CardTitle className="text-base truncate max-w-[180px]" title={doc.name}>
                    {doc.name}
                  </CardTitle>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50"
                  onClick={() => removeDocument(doc.id)}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="aspect-video bg-slate-100 rounded-md mb-4 flex items-center justify-center overflow-hidden border border-slate-200">
                {doc.type === 'image' ? (
                  <img src={doc.content} alt={doc.name} className="object-cover w-full h-full" />
                ) : (
                  <div className="p-2 text-xs text-slate-500 overflow-hidden h-full w-full font-mono whitespace-pre-wrap">
                    {doc.content.slice(0, 200)}...
                  </div>
                )}
              </div>
              
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={doc.includeInAnalysis}
                    onChange={() => toggleAnalysis(doc.id)}
                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  Использовать для ИИ
                </label>
                
                {doc.type === 'text' && (
                   <Button variant="ghost" size="sm" onClick={() => console.log(doc.content)}>
                     <Eye className="w-4 h-4 mr-1" />
                     Просмотр
                   </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}

        {(!data.documents || data.documents.length === 0) && (
          <div className="col-span-full py-12 text-center text-slate-400 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50/50">
            <Upload className="w-12 h-12 mx-auto mb-4 opacity-20" />
            <p>Нет загруженных документов</p>
            <p className="text-sm">Загрузите выписки или результаты анализов для анализа ИИ</p>
          </div>
        )}
      </div>
    </div>
  );
}
