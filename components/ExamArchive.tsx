import React, { useState, useMemo, ChangeEvent } from 'react';
import { Paper, QuestionSource, Semester } from '../types';
import { t } from '../utils/localization';
import Modal from './Modal';
import { CLASSES, SEMESTERS, YEARS } from '../constants';

declare var jspdf: any;
declare var XLSX: any;

interface ExamArchiveProps {
  papers: Paper[];
  onDeletePaper: (id: string) => void;
  onUploadPaper: (paper: Paper, file: File) => void;
  lang: 'en' | 'bn' | 'hi';
}

const PaperItem: React.FC<{ paper: Paper; onDelete: () => void; onView: () => void; lang: 'en' | 'bn' | 'hi' }> = ({ paper, onDelete, onView, lang }) => (
    <div className="flex items-center justify-between p-3 rounded-lg hover:bg-slate-50 transition-colors">
        <div>
            <p className="font-semibold text-slate-800">{paper.title}</p>
            <p className="text-sm text-slate-500">{t(paper.source, lang)} - {new Date(paper.createdAt).toLocaleDateString()}</p>
        </div>
        <div className="space-x-3">
            <button onClick={onView} className="text-indigo-600 hover:text-indigo-800 text-sm font-semibold">{t('view', lang)}</button>
            <button onClick={onDelete} className="text-red-600 hover:text-red-800 text-sm font-semibold">{t('delete', lang)}</button>
        </div>
    </div>
);

const initialUploadState = {
  title: '',
  year: new Date().getFullYear(),
  class: 10,
  semester: Semester.First,
  file: null as File | null,
};

const ExamArchive: React.FC<ExamArchiveProps> = ({ papers, onDeletePaper, onUploadPaper, lang }) => {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [isUploadModalOpen, setUploadModalOpen] = useState(false);
  const [uploadData, setUploadData] = useState(initialUploadState);
  const [viewingPaper, setViewingPaper] = useState<Paper | null>(null);

  type PaperGroup = { year: number; classNum: number; semester: Semester; papers: Paper[] };

  const groupedPapers = useMemo(() => {
    return papers.reduce((acc, paper) => {
      const year = paper.year;
      const classNum = paper.class;
      const semester = paper.semester;
      const key = `${year}-${classNum}-${semester}`;
      if (!acc[key]) {
        acc[key] = { year, classNum, semester, papers: [] };
      }
      acc[key].papers.push(paper);
      return acc;
    }, {} as Record<string, PaperGroup>);
  }, [papers]);

  const sortedGroups = (Object.values(groupedPapers) as PaperGroup[]).sort((a,b) => b.year - a.year || b.classNum - a.classNum);

  const toggleExpand = (key: string) => {
    setExpanded(prev => ({ ...prev, [key]: !prev[key] }));
  };
  
  const expandAll = () => {
    const allKeys = sortedGroups.reduce((acc, group) => ({...acc, [`${group.year}-${group.classNum}-${group.semester}`]: true}), {});
    setExpanded(allKeys);
  }
  
  const collapseAll = () => {
    setExpanded({});
  }
  
  const openUploadModal = () => {
    setUploadData(initialUploadState);
    setUploadModalOpen(true);
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const fileNameWithoutExtension = file.name.split('.').slice(0, -1).join('.') || file.name;
      setUploadData(prev => ({ ...prev, file, title: fileNameWithoutExtension }));
    }
  }

  const handleUploadSubmit = () => {
    if(uploadData.file && uploadData.title.trim()) {
      const newPaper: Paper = {
        id: new Date().toISOString(),
        title: uploadData.title.trim(),
        year: uploadData.year,
        class: uploadData.class,
        semester: uploadData.semester,
        source: QuestionSource.Upload,
        fileType: uploadData.file.type,
        createdAt: new Date().toISOString(),
        questions: []
      };
      onUploadPaper(newPaper, uploadData.file);
      setUploadModalOpen(false);
    }
  }

  const handleExportPDF = (paper: Paper) => {
    if (!paper) return;

    const { jsPDF } = jspdf;
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

    const pageHeight = doc.internal.pageSize.getHeight();
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 15;
    const maxLineWidth = pageWidth - margin * 2;
    let y = margin;

    const checkPageBreak = (neededHeight: number) => {
        if (y + neededHeight > pageHeight - margin) {
            doc.addPage();
            y = margin;
        }
    };
    
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    const titleLines = doc.splitTextToSize(paper.title, maxLineWidth);
    doc.text(titleLines, pageWidth / 2, y, { align: 'center' });
    y += titleLines.length * 6 + 8;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');

    paper.questions.forEach((q, index) => {
        const questionText = `${index + 1}. ${q.text} (${q.marks} ${t('marks', lang)})`;
        
        if (q.imageDataURL) {
            try {
                const imgProps = doc.getImageProperties(q.imageDataURL);
                const imgWidth = 80; // Fixed width for consistency
                const imgHeight = (imgProps.height * imgWidth) / imgProps.width;
                checkPageBreak(imgHeight + 5); // Check for image height + padding
                doc.addImage(q.imageDataURL, 'JPEG', margin, y, imgWidth, imgHeight);
                y += imgHeight + 5; // Move y cursor down
            } catch(e) {
                console.error("Error adding image to PDF:", e);
            }
        }

        const lines = doc.splitTextToSize(questionText, maxLineWidth);
        const textHeight = lines.length * 4.5;
        checkPageBreak(textHeight + 3);
        doc.text(lines, margin, y);
        y += textHeight + 3;
    });

    const questionsWithAnswers = paper.questions.filter(q => q.answer);
    if (questionsWithAnswers.length > 0) {
        const answerKeyTitle = t('answerKey', lang);
        checkPageBreak(8 + 3 + 4.5);
        y += 8;
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text(answerKeyTitle, margin, y);
        y += 6 + 2;
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');

        questionsWithAnswers.forEach((q) => {
            const answerIndex = paper.questions.findIndex(pq => pq.id === q.id) + 1;
            const answerText = `${answerIndex}. ${q.answer}`;
            const lines = doc.splitTextToSize(answerText, maxLineWidth);
            const textHeight = lines.length * 4.5;

            checkPageBreak(textHeight + 2);
            
            doc.text(lines, margin, y);
            y += textHeight + 2;
        });
    }

    doc.save(`${paper.title.replace(/ /g, '_')}.pdf`);
  };
    
  const handleExportXLSX = (paper: Paper) => {
    if (!paper) return;

    const questionData = paper.questions.map((q, index) => ({
        'No.': index + 1,
        'Question': q.imageDataURL ? `[Image-based question] ${q.text}` : q.text,
        'Marks': q.marks,
    }));
    
    const answerData = paper.questions
        .filter(q => q.answer)
        .map((q) => ({
            'No.': paper.questions.findIndex(pq => pq.id === q.id) + 1,
            'Answer': q.answer,
        }));

    const questionSheet = XLSX.utils.json_to_sheet(questionData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, questionSheet, 'Questions');

    if (answerData.length > 0) {
        const answerSheet = XLSX.utils.json_to_sheet(answerData);
        XLSX.utils.book_append_sheet(wb, answerSheet, 'Answer Key');
    }

    XLSX.writeFile(wb, `${paper.title.replace(/ /g, '_')}.xlsx`);
  };

  return (
    <div className="p-2 sm:p-4 space-y-4">
      <div className="flex justify-between items-center">
        <div className="space-x-2">
            <button onClick={expandAll} className="px-3 py-1.5 text-sm bg-white border border-slate-300 rounded-md hover:bg-slate-50 transition-colors font-medium">{t('expandAll', lang)}</button>
            <button onClick={collapseAll} className="px-3 py-1.5 text-sm bg-white border border-slate-300 rounded-md hover:bg-slate-50 transition-colors font-medium">{t('collapseAll', lang)}</button>
        </div>
        <button onClick={openUploadModal} className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-semibold shadow-sm hover:shadow-md hover:-translate-y-px transition-all">Upload Paper</button>
      </div>

      {sortedGroups.length === 0 ? (
         <div className="text-center py-12 text-slate-500 bg-white rounded-xl border border-slate-200">
            <p>{t('noPapers', lang)}</p>
        </div>
      ) : (
      <div className="space-y-4">
        {sortedGroups.map(group => {
            const key = `${group.year}-${group.classNum}-${group.semester}`;
            const isExpanded = expanded[key];
            return (
                <div key={key} className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                    <button onClick={() => toggleExpand(key)} className="w-full text-left flex justify-between items-center">
                        <h3 className="text-lg font-bold font-serif-display text-slate-800">{`${group.year} - Class ${group.classNum} - Semester ${group.semester}`}</h3>
                        <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 text-slate-500 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} viewBox="0 0 20 20" fill="currentColor">
                           <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                    </button>
                    {isExpanded && (
                        <div className="mt-4 space-y-2 pl-4 border-l-2 border-indigo-200">
                            {group.papers.map(paper => (
                                <PaperItem key={paper.id} paper={paper} onDelete={() => onDeletePaper(paper.id)} onView={() => setViewingPaper(paper)} lang={lang}/>
                            ))}
                        </div>
                    )}
                </div>
            )
        })}
      </div>
      )}

      <Modal isOpen={isUploadModalOpen} onClose={() => setUploadModalOpen(false)} title={t('uploadNewPaper', lang)}>
        <div className="space-y-4">
            <input
              type="text"
              placeholder={t('paperTitle', lang)}
              value={uploadData.title}
              onChange={e => setUploadData(prev => ({ ...prev, title: e.target.value }))}
              className="w-full p-2 border rounded-lg border-slate-300 bg-slate-50"
              required
            />
            <select value={uploadData.year} onChange={e => setUploadData(prev => ({...prev, year: parseInt(e.target.value)}))} className="w-full p-2 border rounded-lg border-slate-300 bg-slate-50">
                {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
             <select value={uploadData.class} onChange={e => setUploadData(prev => ({...prev, class: parseInt(e.target.value)}))} className="w-full p-2 border rounded-lg border-slate-300 bg-slate-50">
                {CLASSES.map(c => <option key={c} value={c}>Class {c}</option>)}
            </select>
             <select value={uploadData.semester} onChange={e => setUploadData(prev => ({...prev, semester: e.target.value as Semester}))} className="w-full p-2 border rounded-lg border-slate-300 bg-slate-50">
                {SEMESTERS.map(s => <option key={s} value={s}>Sem {s}</option>)}
            </select>
            <input type="file" onChange={handleFileChange} accept=".pdf,.doc,.docx,.txt,.jpg,.png" className="w-full p-2 border rounded-lg border-slate-300" />
            <div className="flex justify-end">
                <button onClick={handleUploadSubmit} disabled={!uploadData.file || !uploadData.title.trim()} className="px-4 py-2 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 disabled:bg-indigo-300 transition-all">Upload</button>
            </div>
        </div>
      </Modal>

      <Modal isOpen={!!viewingPaper} onClose={() => setViewingPaper(null)} title={viewingPaper?.title || ""}>
        {viewingPaper && (
            <>
                <div>
                    {viewingPaper.dataURL && viewingPaper.fileType?.startsWith('image/') && (
                        <img src={viewingPaper.dataURL} alt="Paper preview" className="max-w-full h-auto rounded-md" />
                    )}
                    {viewingPaper.dataURL && viewingPaper.fileType === 'application/pdf' && (
                        <iframe src={viewingPaper.dataURL} className="w-full h-[60vh]" title="PDF preview"></iframe>
                    )}
                    {viewingPaper.text && (
                        <pre className="whitespace-pre-wrap bg-slate-100 p-4 rounded-md text-sm">{viewingPaper.text}</pre>
                    )}
                    {viewingPaper.questions.length > 0 && (
                        <div className="space-y-4 prose max-w-none prose-slate">
                             <h2 className="text-xl font-bold font-serif-display text-slate-800 text-center">{viewingPaper.title}</h2>
                            {viewingPaper.questions.map((q, i) => (
                                <div key={q.id}>
                                    {q.imageDataURL && (
                                        <img src={q.imageDataURL} alt="Question illustration" className="max-w-md mx-auto rounded-lg border my-2" />
                                    )}
                                    <p><strong>{i+1}.</strong> {q.text} <span className="text-sm text-slate-500">({q.marks} {t('marks', lang)})</span></p>
                                </div>
                            ))}
                             {viewingPaper.questions.some(q => q.answer) && (
                                <div className="mt-8 pt-4 border-t border-slate-200">
                                    <h3 className="text-lg font-bold font-serif-display text-slate-800 mb-3">{t('answerKey', lang)}</h3>
                                    <div className="prose max-w-none prose-slate space-y-2">
                                        {viewingPaper.questions.map((q, index) => (
                                            q.answer ? (
                                                <p key={`ans-${q.id}`}><strong>{index + 1}.</strong> {q.answer}</p>
                                            ) : null
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {viewingPaper.questions.length > 0 && (
                    <div className="flex flex-wrap justify-end gap-3 pt-4 mt-4 border-t border-slate-200">
                        <button onClick={() => handleExportXLSX(viewingPaper!)} className="px-5 py-2.5 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 shadow-sm hover:shadow-md hover:-translate-y-px transition-all">{t('exportXLSX', lang)}</button>
                        <button onClick={() => handleExportPDF(viewingPaper!)} className="px-5 py-2.5 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 shadow-sm hover:shadow-md hover:-translate-y-px transition-all">{t('exportPDF', lang)}</button>
                    </div>
                )}
            </>
        )}
      </Modal>
    </div>
  );
};

export default ExamArchive;