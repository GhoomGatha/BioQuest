import React, { useState, useEffect } from 'react';
import { Question, Difficulty, Semester, QuestionSource } from '../types';
import { CLASSES, MARKS, SEMESTERS, YEARS } from '../constants';
import { t } from '../utils/localization';

interface QuestionFormProps {
  onSubmit: (question: Question) => void;
  onCancel: () => void;
  initialData?: Question | null;
  lang: 'en' | 'bn' | 'hi';
}

const QuestionForm: React.FC<QuestionFormProps> = ({ onSubmit, onCancel, initialData, lang }) => {
  const [formData, setFormData] = useState({
    class: initialData?.class || 10,
    chapter: initialData?.chapter || '',
    text: initialData?.text || '',
    answer: initialData?.answer || '',
    marks: initialData?.marks || 1,
    difficulty: initialData?.difficulty || Difficulty.Easy,
    year: initialData?.year || new Date().getFullYear(),
    semester: initialData?.semester || Semester.First,
    tags: initialData?.tags?.join(', ') || '',
  });
  const [imageDataURL, setImageDataURL] = useState<string | null>(initialData?.imageDataURL || null);


  useEffect(() => {
    if (initialData) {
      setFormData({
        class: initialData.class,
        chapter: initialData.chapter,
        text: initialData.text,
        answer: initialData.answer || '',
        marks: initialData.marks,
        difficulty: initialData.difficulty,
        year: initialData.year,
        semester: initialData.semester,
        tags: initialData.tags?.join(', ') || '',
      });
      setImageDataURL(initialData.imageDataURL || null);
    }
  }, [initialData]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: name === 'class' || name === 'marks' || name === 'year' ? parseInt(value) : value }));
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImageDataURL(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveImage = () => {
    setImageDataURL(null);
    const fileInput = document.getElementById('image-upload') as HTMLInputElement;
    if (fileInput) {
      fileInput.value = '';
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const { tags, ...restOfData } = formData;
    const questionData: Question = {
      ...restOfData,
      id: initialData?.id || new Date().toISOString(),
      usedIn: initialData?.usedIn || [],
      source: initialData?.source || QuestionSource.Manual,
      tags: tags.split(',').map(t => t.trim()).filter(Boolean),
      imageDataURL: imageDataURL || undefined,
    };
    onSubmit(questionData);
  };

  const inputStyles = "mt-1 block w-full rounded-lg border-slate-300 bg-slate-50 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm transition";

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-600">{t('class', lang)}</label>
          <select name="class" value={formData.class} onChange={handleChange} className={inputStyles}>
            {CLASSES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-600">{t('chapter', lang)}</label>
          <input type="text" name="chapter" value={formData.chapter} onChange={handleChange} required className={inputStyles} />
        </div>
      </div>
       <div>
        <label className="block text-sm font-medium text-slate-600">Image (Optional)</label>
        {imageDataURL && (
          <div className="mt-2 relative group w-fit">
            <img src={imageDataURL} alt="Question preview" className="rounded-lg max-h-48 w-auto border border-slate-300" />
            <button
              type="button"
              onClick={handleRemoveImage}
              className="absolute top-2 right-2 bg-white/70 backdrop-blur-sm text-red-600 rounded-full p-1 shadow-md hover:bg-red-100 transition-all opacity-0 group-hover:opacity-100"
              aria-label="Remove image"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        )}
        <div className="mt-2">
            <input
                id="image-upload"
                type="file"
                name="image"
                onChange={handleImageChange}
                accept="image/png, image/jpeg, image/gif"
                className="block w-full text-sm text-slate-500
                    file:mr-4 file:py-2 file:px-4
                    file:rounded-full file:border-0
                    file:text-sm file:font-semibold
                    file:bg-indigo-50 file:text-indigo-700
                    hover:file:bg-indigo-100"
            />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-600">{t('questionText', lang)}</label>
        <textarea name="text" value={formData.text} onChange={handleChange} required rows={4} className={inputStyles}></textarea>
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-600">Tags (comma-separated)</label>
        <input type="text" name="tags" value={formData.tags} onChange={handleChange} className={inputStyles} placeholder="e.g., Photosynthesis, Cell Division" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-600">{t('marks', lang)}</label>
          <select name="marks" value={formData.marks} onChange={handleChange} className={inputStyles}>
            {MARKS.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-600">{t('difficulty', lang)}</label>
          <select name="difficulty" value={formData.difficulty} onChange={handleChange} className={inputStyles}>
            {Object.values(Difficulty).map(d => <option key={d} value={d}>{t(d, lang)}</option>)}
          </select>
        </div>
      </div>
       <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-600">{t('year', lang)}</label>
          <select name="year" value={formData.year} onChange={handleChange} className={inputStyles}>
            {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-600">{t('semester', lang)}</label>
          <select name="semester" value={formData.semester} onChange={handleChange} className={inputStyles}>
            {SEMESTERS.map(s => <option key={s} value={s}>{`Sem ${s}`}</option>)}
          </select>
        </div>
      </div>
      <div className="flex justify-end space-x-3 pt-4">
        <button type="button" onClick={onCancel} className="px-4 py-2 bg-slate-200 text-slate-800 rounded-lg hover:bg-slate-300 font-medium transition-colors">{t('cancel', lang)}</button>
        <button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-semibold shadow-sm hover:shadow-md hover:-translate-y-px transition-all">{t('save', lang)}</button>
      </div>
    </form>
  );
};

export default QuestionForm;