import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { api, Patient } from '@/lib/api';
import { useConsultation } from '@/context/ConsultationContext';
import { Loader2, Search, User, X, Trash2 } from 'lucide-react';
import { Input } from '@/components/ui/input';

interface LoadPatientDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export function LoadPatientDialog({ isOpen, onClose }: LoadPatientDialogProps) {
  const { updateData, triggerReload, consultationId } = useConsultation();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (isOpen) {
      loadPatients();
    }
  }, [isOpen]);

  const loadPatients = async () => {
    setIsLoading(true);
    try {
      const data = await api.getPatients();
      setPatients(data);
    } catch (error) {
      console.error(error);
      console.error('Не удалось загрузить список пациентов');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeletePatient = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation(); // Prevent row click
    if (!confirm('Вы уверены, что хотите удалить этого пациента и все его консультации? Это действие нельзя отменить.')) {
      return;
    }
    setIsLoading(true);
    try {
      await api.deletePatient(id);
      setPatients(patients.filter(p => p.id !== id));
    } catch (error) {
      console.error(error);
      alert('Ошибка при удалении пациента');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectPatient = async (patient: Patient) => {
    setIsLoading(true);
    try {
      // Load the latest consultation for this patient
      const consultation = await api.getConsultation(patient.id!);
      
      if (consultation && consultation.data) {
        const parsedData = JSON.parse(consultation.data);
        // Update all sections with loaded data
        Object.keys(parsedData).forEach(key => {
          updateData(key as any, parsedData[key]);
        });
        // Ensure patient data is also set/updated from the DB record
        updateData('patient', patient);
        console.log(`Пациент ${patient.full_name} успешно загружен`);
      } else {
        // If no consultation exists, just load the patient data
        updateData('patient', patient);
        // Clear other sections
        ['anamnesis', 'exam', 'diagnostics', 'diagnosis', 'treatment'].forEach(key => {
            updateData(key as any, null);
        });
        console.log(`Пациент ${patient.full_name} загружен (нет сохраненных консультаций)`);
      }
      triggerReload();
      onClose();
    } catch (error) {
      console.error(error);
      console.error('Ошибка при загрузке данных пациента');
    } finally {
      setIsLoading(false);
    }
  };

  const filteredPatients = patients.filter(p => {
    const q = searchQuery.toLowerCase();
    return (
      p.full_name.toLowerCase().includes(q) ||
      (p.snils && p.snils.includes(q)) ||
      (p.policy_number && p.policy_number.includes(q)) ||
      (p.latest_diagnosis && p.latest_diagnosis.toLowerCase().includes(q))
    );
  });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[80vh] flex flex-col relative">
        <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 z-10">
          <X className="w-5 h-5" />
        </button>

        <div className="p-6 border-b border-slate-100">
          <h2 className="text-xl font-bold text-slate-900">Загрузить пациента из базы данных</h2>
          <p className="text-sm text-slate-500 mt-1">
            Выберите пациента из списка для продолжения работы
          </p>
        </div>

        <div className="p-4 border-b border-slate-100 bg-slate-50">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Поиск по ФИО, СНИЛС или полису..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 bg-white"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {isLoading ? (
            <div className="flex justify-center items-center h-40">
              <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            </div>
          ) : filteredPatients.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-slate-500">
              <User className="h-12 w-12 mb-2 opacity-20" />
              <p>Пациенты не найдены</p>
            </div>
          ) : (
            <div className="divide-y border rounded-md">
              {filteredPatients.map((patient) => (
                <div 
                  key={patient.id}
                  className="p-4 hover:bg-slate-50 cursor-pointer transition-colors flex justify-between items-center group"
                  onClick={() => handleSelectPatient(patient)}
                >
                  <div className="flex-1 mr-4">
                    <h3 className="font-medium text-slate-900 group-hover:text-blue-700 transition-colors">{patient.full_name}</h3>
                    <div className="text-sm text-slate-500 flex flex-wrap gap-x-4 gap-y-1 mt-1">
                      <span>{new Date(patient.birth_date).toLocaleDateString('ru-RU')}</span>
                      <span>{patient.gender === 'male' ? 'Муж' : 'Жен'}</span>
                      {patient.snils && <span>СНИЛС: {patient.snils}</span>}
                      {patient.updated_at && (
                        <span className="text-slate-400">
                          Сохранено: {new Date(patient.updated_at).toLocaleString('ru-RU')}
                        </span>
                      )}
                    </div>
                    {patient.latest_diagnosis && (
                      <div className="text-sm text-slate-600 mt-2 bg-blue-50 p-2 rounded line-clamp-2">
                        <span className="font-medium text-blue-800">Диагноз:</span> {patient.latest_diagnosis}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="opacity-0 group-hover:opacity-100 transition-opacity text-red-500 hover:text-red-700 hover:bg-red-50"
                      onClick={(e) => handleDeletePatient(e, patient.id!)}
                      title="Удалить пациента"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="sm" className="opacity-0 group-hover:opacity-100 transition-opacity">
                      Загрузить
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
