import React, { useState, useMemo, ChangeEvent, useRef } from 'react';
import { Paper, QuestionSource, Semester } from '../types';
import { t } from '../utils/localization';
import Modal from './Modal';
import { CLASSES, SEMESTERS, YEARS } from '../constants';
import { getBengaliFontBase64, getDevanagariFontBase64 } from '../utils/fontData';
import { loadScript } from '../utils/scriptLoader';

interface ExamArchiveProps {
  papers: Paper[];
  onDeletePaper: (id: string) => void;
  onUploadPaper: (paper: Paper, file: File, options: { signal: AbortSignal }) => Promise<void>;
  lang: 'en' | 'bn' | 'hi';
}

const PaperItem: React.FC<{ paper: Paper; onDelete: () => void; onView: () => void; lang: 'en' | 'bn' | 'hi' }> = ({ paper, onDelete, onView, lang }) => (
    <div className="flex items-center justify-between p-3 rounded-lg hover:bg-slate-50 transition-colors">
        <div>
            <p className="font-semibold text-slate-800">{paper.title}</p>
            <p className="text-sm text-slate-500">{t(paper.source, lang)} - {new Date(paper.created_at).toLocaleString()}</p>
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
  const [isUploading, setIsUploading] = useState(false);
  const uploadAbortControllerRef = useRef<AbortController | null>(null);

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

  const handleFileSelectAndUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const titleToUse = uploadData.title.trim() || (file.name.split('.').slice(0, -1).join('.') || file.name);

    const newPaper: Paper = {
      id: new Date().toISOString(),
      title: titleToUse,
      year: uploadData.year,
      class: uploadData.class,
      semester: uploadData.semester,
      source: QuestionSource.Upload,
      file_type: file.type,
      created_at: new Date().toISOString(),
      questions: [],
    };

    const controller = new AbortController();
    uploadAbortControllerRef.current = controller;

    setIsUploading(true);
    try {
      await onUploadPaper(newPaper, file, { signal: controller.signal });
    } catch (error: any) {
        // Errors are now thrown by onUploadPaper and displayed via its internal toast.
        // We only care about the AbortError here, which we can ignore since the user initiated it.
        if (error.name !== 'AbortError') {
          console.error("Upload failed in component:", error);
        }
    } finally {
      setIsUploading(false);
      setUploadModalOpen(false);
      uploadAbortControllerRef.current = null;
    }
  };

  const handleCancelUpload = () => {
    if (uploadAbortControllerRef.current) {
        uploadAbortControllerRef.current.abort();
    }
  };

  const handleExportPDF = async (paper: Paper) => {
    if (!paper) return;

    try {
        await loadScript("https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js");
    } catch (error) {
        console.error("Failed to load jsPDF library", error);
        // You might want to show a toast message to the user here.
        return;
    }

    const { jsPDF } = (window as any).jspdf;
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

    let fontName = 'helvetica';
    if (lang === 'bn') {
        const fontData = await getBengaliFontBase64();
        if (fontData) {
            doc.addFileToVFS('NotoSansBengali-Regular.ttf', fontData);
            doc.addFont('NotoSansBengali-Regular.ttf', 'NotoSansBengali', 'normal');
            fontName = 'NotoSansBengali';
        } else {
            console.error('Could not load Bengali font for PDF.');
        }
    } else if (lang === 'hi') {
        const fontData = await getDevanagariFontBase64();
        if (fontData) {
            doc.addFileToVFS('NotoSansDevanagari-Regular.ttf', fontData);
            doc.addFont('NotoSansDevanagari-Regular.ttf', 'NotoSansDevanagari', 'normal');
            fontName = 'NotoSansDevanagari';
        } else {
            console.error('Could not load Hindi font for PDF.');
        }
    }

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
    doc.setFont(fontName, 'bold');
    const titleLines = doc.splitTextToSize(paper.title, maxLineWidth);
    doc.text(titleLines, pageWidth / 2, y, { align: 'center' });
    y += titleLines.length * 6 + 8;

    doc.setFontSize(10);
    doc.setFont(fontName, 'normal');

    paper.questions.forEach((q, index) => {
        const questionText = `${index + 1}. ${q.text} (${q.marks} ${t('marks', lang)})`;
        
        if (q.image_data_url) {
            try {
                const imgProps = doc.getImageProperties(q.image_data_url);
                const imgWidth = 80; // Fixed width for consistency
                const imgHeight = (imgProps.height * imgWidth) / imgProps.width;
                checkPageBreak(imgHeight + 5); // Check for image height + padding
                doc.addImage(q.image_data_url, 'JPEG', margin, y, imgWidth, imgHeight);
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

    if (paper.grounding_sources && paper.grounding_sources.length > 0) {
        const sourcesTitle = t('sources', lang);
        checkPageBreak(8 + 3 + 4.5);
        y += 8;
        doc.setFontSize(12);
        doc.setFont(fontName, 'bold');
        doc.text(sourcesTitle, margin, y);
        y += 6 + 2;
        doc.setFontSize(8);
        doc.setFont(fontName, 'normal');
        paper.grounding_sources.forEach(source => {
            const sourceText = `${source.title || 'Untitled'}: ${source.uri}`;
            const lines = doc.splitTextToSize(sourceText, maxLineWidth);
            const textHeight = lines.length * 4;
            checkPageBreak(textHeight + 2);
            doc.textWithLink(source.title || source.uri, margin, y, { url: source.uri });
            y += textHeight + 2;
        });
    }

    const questionsWithAnswers = paper.questions.filter(q => q.answer);
    if (questionsWithAnswers.length > 0) {
        const answerKeyTitle = t('answerKey', lang);
        checkPageBreak(8 + 3 + 4.5);
        y += 8;
        doc.setFontSize(12);
        doc.setFont(fontName, 'bold');
        doc.text(answerKeyTitle, margin, y);
        y += 6 + 2;
        doc.setFontSize(10);
        doc.setFont(fontName, 'normal');

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
    
  const handleExportXLSX = async (paper: Paper) => {
    if (!paper) return;

    try {
        await loadScript("https://cdn.sheetjs.com/xlsx-latest/package/dist/xlsx.full.min.js");
    } catch (error) {
        console.error("Failed to load XLSX library", error);
        // You might want to show a toast message to the user here.
        return;
    }

    const XLSX = (window as any).XLSX;
    const questionData = paper.questions.map((q, index) => ({
        'No.': index + 1,
        'Question': q.image_data_url ? `[Image-based question] ${q.text}` : q.text,
        'Marks': q.marks,
    }));
    
    const answerData = paper.questions
        .filter(q => q.answer)
        .map((q) => ({
            'No.': paper.questions.findIndex(pq => pq.id === q.id) + 1,
            'Answer': q.answer,
        }));
    
    const sourceData = (paper.grounding_sources || []).map(s => ({
        'Title': s.title,
        'URL': s.uri,
    }));

    const questionSheet = XLSX.utils.json_to_sheet(questionData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, questionSheet, 'Questions');

    if (answerData.length > 0) {
        const answerSheet = XLSX.utils.json_to_sheet(answerData);
        XLSX.utils.book_append_sheet(wb, answerSheet, 'Answer Key');
    }

    if (sourceData.length > 0) {
        const sourceSheet = XLSX.utils.json_to_sheet(sourceData);
        XLSX.utils.book_append_sheet(wb, sourceSheet, 'Sources');
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

      <Modal isOpen={isUploadModalOpen} onClose={() => !isUploading && setUploadModalOpen(false)} title={t('uploadNewPaper', lang)}>
        {isUploading ? (
          <div className="flex flex-col items-center justify-center p-8">
            <div className="w-12 h-12 border-4 border-t-indigo-600 border-slate-200 rounded-full animate-spin"></div>
            <p className="mt-4 text-slate-600 font-semibold">Uploading and analyzing file...</p>
            <p className="text-sm text-slate-500">This may take a moment.</p>
            <button 
              onClick={handleCancelUpload}
              className="mt-6 px-4 py-2 bg-red-100 text-red-700 rounded-lg font-semibold hover:bg-red-200 transition-colors"
            >
              {t('cancel', lang)}
            </button>
          </div>
        ) : (
          <div className="space-y-4">
              <input
                type="text"
                placeholder={t('paperTitle', lang)}
                value={uploadData.title}
                onChange={e => setUploadData(prev => ({ ...prev, title: e.target.value }))}
                className="w-full p-2 border rounded-lg border-slate-300 bg-slate-50"
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
              
              <p className="text-xs text-center text-slate-500 pt-2">Max file size: 2MB. Please use optimized PDF or image files.</p>
              <label htmlFor="file-upload" className="w-full mt-4 block text-center cursor-pointer px-4 py-2 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 transition-all">
                Select File &amp; Upload
              </label>
              <input 
                id="file-upload"
                type="file" 
                onChange={handleFileSelectAndUpload} 
                accept="application/pdf,image/png,image/jpeg,image/gif" 
                className="hidden" 
              />
          </div>
        )}
      </Modal>

      <Modal isOpen={!!viewingPaper} onClose={() => setViewingPaper(null)} title={viewingPaper?.title || ""}>
        {viewingPaper && (
            <>
                <div>
                    {viewingPaper.data_url && viewingPaper.file_type?.startsWith('image/') && (
                        <img src={viewingPaper.data_url} alt="Paper preview" className="max-w-full h-auto rounded-md" />
                    )}
                    {viewingPaper.data_url && viewingPaper.file_type === 'application/pdf' && (
                        <iframe src={viewingPaper.data_url} className="w-full h-[60vh]" title="PDF preview"></iframe>
                    )}
                    {viewingPaper.text && (
                        <pre className="whitespace-pre-wrap bg-slate-100 p-4 rounded-md text-sm">{viewingPaper.text}</pre>
                    )}
                    {viewingPaper.questions.length > 0 && (
                        <div className="space-y-4 prose max-w-none prose-slate">
                            <div className="not-prose text-center">
                                <h2 className="text-xl font-bold font-serif-display text-slate-800">{viewingPaper.title}</h2>
                                <p className="text-sm text-slate-500">{new Date(viewingPaper.created_at).toLocaleString()}</p>
                            </div>
                            {viewingPaper.questions.map((q, i) => (
                                <div key={q.id}>
                                    {q.image_data_url && (
                                        <img src={q.image_data_url} alt="Question illustration" className="max-w-md mx-auto rounded-lg border my-2" />
                                    )}
                                    <p><strong>{i+1}.</strong> {q.text} <span className="text-sm text-slate-500">({q.marks} {t('marks', lang)})</span></p>
                                </div>
                            ))}
                             {viewingPaper.grounding_sources && viewingPaper.grounding_sources.length > 0 && (
                                <div className="mt-8 pt-4 border-t border-slate-200">
                                    <h3 className="text-lg font-bold font-serif-display text-slate-800 mb-3">{t('sources', lang)}</h3>
                                    <ul className="prose prose-sm max-w-none prose-slate list-disc list-inside space-y-1">
                                        {viewingPaper.grounding_sources.map(source => (
                                            <li key={source.uri}>
                                                <a href={source.uri} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline">
                                                    {source.title || source.uri}
                                                </a>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
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
