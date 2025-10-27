import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Paper, Question, QuestionSource, Difficulty, Semester } from '../types';
import { t } from '../utils/localization';
import { generateQuestionsAI } from '../services/geminiService';
import { CLASSES, YEARS, SEMESTERS } from '../constants';
import { useHistory } from '../hooks/useHistory';
import Modal from './Modal';

declare var jspdf: any;
declare var XLSX: any;

const WBBSE_SYLLABUS_KEY = 'bioquest_wbbse_syllabus_only_v1';
const PAPER_GENERATOR_DRAFT_KEY = 'bioquest_paper_generator_draft_v1';

const questionTypes = ['Short Answer', 'Multiple Choice', 'Fill in the Blanks', 'True/False', 'Image-based'];

interface GeneratorSettings {
    markDistribution: string;
    aiChapter: string;
    aiDifficulty: Difficulty;
    aiKeywords: string;
    aiQuestionType: string[];
    aiGenerateAnswers: boolean;
    wbbseSyllabusOnly: boolean;
    generationMode: 'distribution' | 'totalMarks';
    totalMarks: string;
    allowedMarks: string;
}

interface PaperGeneratorDraft {
    title: string;
    year: number;
    selectedClass: number;
    semester: Semester;
    avoidPrevious: boolean;
    markDistribution: string;
    aiChapter: string;
    aiDifficulty: Difficulty;
    aiKeywords: string;
    aiQuestionType: string[];
    aiGenerateAnswers: boolean;
    wbbseSyllabusOnly: boolean;
    generationMode: 'distribution' | 'totalMarks';
    totalMarks: string;
    allowedMarks: string;
}

interface PaperGeneratorProps {
    questions: Question[];
    onSavePaper: (paper: Paper) => void;
    lang: 'en' | 'bn' | 'hi';
    showToast: (message: string, type?: 'success' | 'error') => void;
    userApiKey?: string;
}

const PaperGenerator: React.FC<PaperGeneratorProps> = ({ questions, onSavePaper, lang, showToast, userApiKey }) => {
    const [title, setTitle] = useState('');
    const [year, setYear] = useState(new Date().getFullYear());
    const [selectedClass, setClass] = useState(10);
    const [semester, setSemester] = useState<Semester>(Semester.First);
    const [avoidPrevious, setAvoidPrevious] = useState(true);
    const [isGenerating, setIsGenerating] = useState(false);
    const [generatedPaper, setGeneratedPaper] = useState<Paper | null>(null);
    const [isDraftLoaded, setIsDraftLoaded] = useState(false);
    const [isImageViewerOpen, setImageViewerOpen] = useState(false);
    const [viewingImage, setViewingImage] = useState<string | null>(null);
    
    const draftStateRef = useRef<PaperGeneratorDraft>();

    const getInitialWbbseState = () => {
        const saved = localStorage.getItem(WBBSE_SYLLABUS_KEY);
        return saved !== null ? JSON.parse(saved) : true;
    };

    const {
        state: settings,
        set: setSettings,
        undo,
        redo,
        canUndo,
        canRedo,
        reset: resetSettings
    } = useHistory<GeneratorSettings>({
        markDistribution: '5x1, 5x2, 2x5',
        aiChapter: '',
        aiDifficulty: Difficulty.Moderate,
        aiKeywords: '',
        aiQuestionType: [],
        aiGenerateAnswers: false,
        wbbseSyllabusOnly: getInitialWbbseState(),
        generationMode: 'distribution',
        totalMarks: '25',
        allowedMarks: '1, 2, 3, 5',
    });

    useEffect(() => {
        localStorage.setItem(WBBSE_SYLLABUS_KEY, JSON.stringify(settings.wbbseSyllabusOnly));
    }, [settings.wbbseSyllabusOnly]);

    const stableShowToast = useCallback(showToast, []);

    useEffect(() => {
        const savedDraft = localStorage.getItem(PAPER_GENERATOR_DRAFT_KEY);
        if (savedDraft) {
            const draftData = JSON.parse(savedDraft);
            setTitle(draftData.title || '');
            setYear(draftData.year || new Date().getFullYear());
            setClass(draftData.selectedClass || 10);
            setSemester(draftData.semester || Semester.First);
            setAvoidPrevious(draftData.avoidPrevious !== undefined ? draftData.avoidPrevious : true);
            
            const loadedAiQuestionType = draftData.aiQuestionType;
            let aiQuestionTypeArray: string[] = [];
            if (Array.isArray(loadedAiQuestionType)) {
                aiQuestionTypeArray = loadedAiQuestionType;
            } else if (typeof loadedAiQuestionType === 'string' && loadedAiQuestionType) {
                aiQuestionTypeArray = [loadedAiQuestionType];
            }

            resetSettings({
                markDistribution: draftData.markDistribution || '5x1, 5x2, 2x5',
                aiChapter: draftData.aiChapter || '',
                aiDifficulty: draftData.aiDifficulty || Difficulty.Moderate,
                aiKeywords: draftData.aiKeywords || '',
                aiQuestionType: aiQuestionTypeArray,
                aiGenerateAnswers: draftData.aiGenerateAnswers !== undefined ? draftData.aiGenerateAnswers : false,
                wbbseSyllabusOnly: draftData.wbbseSyllabusOnly !== undefined ? draftData.wbbseSyllabusOnly : true,
                generationMode: draftData.generationMode || 'distribution',
                totalMarks: draftData.totalMarks || '25',
                allowedMarks: draftData.allowedMarks || '1, 2, 3, 5',
            });

            setIsDraftLoaded(true);
            stableShowToast(t('draftLoaded', lang));
        }
    }, [lang, stableShowToast, resetSettings]);

    useEffect(() => {
        const intervalId = setInterval(() => {
            if (draftStateRef.current) {
                localStorage.setItem(PAPER_GENERATOR_DRAFT_KEY, JSON.stringify(draftStateRef.current));
            }
        }, 30000); // Auto-save every 30 seconds

        return () => clearInterval(intervalId); // Cleanup on unmount
    }, []);

    const draftData: PaperGeneratorDraft = {
        title,
        year,
        selectedClass,
        semester,
        avoidPrevious,
        ...settings,
    };
    draftStateRef.current = draftData;
    
    const handleSettingsChange = useCallback((field: keyof GeneratorSettings, value: string | boolean | Difficulty | 'distribution' | 'totalMarks' | string[]) => {
        setSettings({ ...settings, [field]: value });
    }, [settings, setSettings]);
    
    const handleQuestionTypeChange = (type: string) => {
        const isAdding = !settings.aiQuestionType.includes(type);
        const newTypes = isAdding
            ? [...settings.aiQuestionType, type]
            : settings.aiQuestionType.filter(t => t !== type);

        const requiresAnswer = ['Multiple Choice', 'Fill in the Blanks', 'True/False'].includes(type);

        if (isAdding && requiresAnswer) {
            // When adding a type that requires an answer, automatically check the box.
            setSettings({ ...settings, aiQuestionType: newTypes, aiGenerateAnswers: true });
        } else {
             setSettings({ ...settings, aiQuestionType: newTypes });
        }
    };

    const generateFromBank = useCallback((distribution: [number, number][]): { questions: Question[] } | { error: string } => {
        let sourcePool = questions.filter(q => q.class === selectedClass);
        if (avoidPrevious) {
            sourcePool = sourcePool.filter(q => q.usedIn.length === 0);
        }

        const requiredCounts = new Map<number, number>();
        for (const [count, marks] of distribution) {
            requiredCounts.set(marks, (requiredCounts.get(marks) || 0) + count);
        }

        const missingMessages: string[] = [];
        for (const [marks, requiredCount] of requiredCounts.entries()) {
            const availableCount = sourcePool.filter(q => q.marks === marks).length;
            if (availableCount < requiredCount) {
                missingMessages.push(`need ${requiredCount} for ${marks} marks (found ${availableCount})`);
            }
        }

        if (missingMessages.length > 0) {
            return { error: `Not enough questions in bank: ${missingMessages.join('; ')}.` };
        }
        
        let finalQuestions: Question[] = [];
        for (const [count, marks] of distribution) {
            const suitableQuestions = sourcePool.filter(q => q.marks === marks);
            const selected = suitableQuestions.sort(() => 0.5 - Math.random()).slice(0, count);
            finalQuestions.push(...selected);
            sourcePool = sourcePool.filter(q => !selected.some(s => s.id === q.id));
        }
        return { questions: finalQuestions };
    }, [questions, selectedClass, avoidPrevious]);
    
    const createPaper = useCallback((questions: Question[], source: QuestionSource): Paper => {
        return {
            id: new Date().toISOString(),
            title: title.trim() || `Class ${selectedClass} Paper - ${year}`,
            year,
            class: selectedClass,
            semester,
            source,
            questions,
            createdAt: new Date().toISOString()
        };
    }, [title, year, selectedClass, semester]);


    const handleGenerate = async (useAI: boolean) => {
        setIsGenerating(true);
        setGeneratedPaper(null);

        try {
            let distribution: [number, number][] | null;

            if (settings.generationMode === 'distribution') {
                distribution = settings.markDistribution.split(',')
                    .map(s => s.trim().split('x').map(p => parseInt(p, 10)))
                    .filter((parts): parts is [number, number] => parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1]));

                if (distribution.length === 0 && settings.markDistribution.trim() !== '') {
                    showToast('Invalid mark distribution format.', 'error');
                    setIsGenerating(false);
                    return;
                }
            } else { // 'totalMarks' mode
                const findDistribution = (): [number, number][] | null => {
                    const target = parseInt(settings.totalMarks, 10);
                    const uniqueMarks = [...new Set<number>(settings.allowedMarks.split(',').map(s => parseInt(s.trim(), 10)).filter(m => !isNaN(m) && m > 0))];

                    if (isNaN(target) || target <= 0 || uniqueMarks.length === 0) {
                        showToast('Invalid total marks or allowed marks.', 'error');
                        return null;
                    }

                    const dp = new Array(target + 1).fill(false);
                    dp[0] = true;

                    for (let i = 1; i <= target; i++) {
                        for (const mark of uniqueMarks) {
                            if (i >= mark && dp[i - mark]) {
                                dp[i] = true;
                                break;
                            }
                        }
                    }

                    if (!dp[target]) {
                        return null; 
                    }

                    const resultMarks: number[] = [];
                    let currentTotal = target;

                    while (currentTotal > 0) {
                        const possibleMoves = uniqueMarks.filter(mark => {
                            return currentTotal >= mark && dp[currentTotal - mark];
                        });
                        
                        if (possibleMoves.length === 0) {
                            console.error("Stuck in distribution generation, this should not happen.");
                            return null; 
                        }

                        const randomMove = possibleMoves[Math.floor(Math.random() * possibleMoves.length)];
                        resultMarks.push(randomMove);
                        currentTotal -= randomMove;
                    }
                    
                    const distributionMap = new Map<number, number>();
                    for (const mark of resultMarks) {
                        distributionMap.set(mark, (distributionMap.get(mark) || 0) + 1);
                    }

                    return Array.from(distributionMap.entries()).map(([mark, count]) => [count, mark]);
                };
                
                distribution = findDistribution();

                if (!distribution) {
                    showToast(t('distributionGenerationFailed', lang), 'error');
                    setIsGenerating(false);
                    return;
                }
            }

            if (useAI) {
                try {
                    const aiChapters = settings.aiChapter.split(',').map(c => c.trim()).filter(Boolean);
                    if (aiChapters.length === 0) {
                        showToast('Please provide at least one chapter for AI generation.', 'error');
                        return; // No finally block here, so need to set isGenerating to false
                    }
                    
                    let existingQuestionPool = questions.filter(q => 
                        q.class === selectedClass && 
                        (avoidPrevious ? q.usedIn.length === 0 : true)
                    );
                    
                    let finalQuestions: Question[] = [];

                    for (const [count, marks] of distribution) {
                        if (count <= 0) continue;

                        const selectedTypes = settings.aiQuestionType.length > 0 ? settings.aiQuestionType : ['Short Answer'];

                        const requestsToMake: { count: number; type: string }[] = [];

                        if (selectedTypes.length <= 1) {
                            requestsToMake.push({ count, type: selectedTypes[0] });
                        } else {
                            const numTypes = selectedTypes.length;
                            const baseCount = Math.floor(count / numTypes);
                            const remainder = count % numTypes;
                            
                            for (let i = 0; i < numTypes; i++) {
                                const subCount = baseCount + (i < remainder ? 1 : 0);
                                if (subCount > 0) {
                                    requestsToMake.push({ count: subCount, type: selectedTypes[i] });
                                }
                            }
                        }
                        
                        for (const request of requestsToMake) {
                            if (finalQuestions.length > 0) {
                            await new Promise(resolve => setTimeout(resolve, 1500));
                            }
                            
                            const chapterForThisGroup = aiChapters[Math.floor(Math.random() * aiChapters.length)];

                            const generatedBatch = await generateQuestionsAI({
                                class: selectedClass,
                                chapter: chapterForThisGroup,
                                marks,
                                difficulty: settings.aiDifficulty,
                                count: request.count,
                                questionType: request.type,
                                keywords: settings.aiKeywords,
                                generateAnswer: settings.aiGenerateAnswers,
                                wbbseSyllabusOnly: settings.wbbseSyllabusOnly,
                                lang: lang,
                            }, existingQuestionPool, userApiKey);

                            if (generatedBatch.length > 0) {
                                const newQuestions = generatedBatch.map((g): Question => ({
                                    id: `gen-${new Date().toISOString()}-${Math.random()}`,
                                    text: g.text!,
                                    answer: g.answer,
                                    imageDataURL: g.imageDataURL,
                                    class: selectedClass,
                                    chapter: chapterForThisGroup,
                                    marks,
                                    difficulty: settings.aiDifficulty,
                                    usedIn: [],
                                    source: QuestionSource.Generated,
                                    year: year,
                                    semester: semester,
                                    tags: settings.aiKeywords.split(',').map(t => t.trim()).filter(Boolean),
                                }));
                                finalQuestions.push(...newQuestions);
                                existingQuestionPool.push(...newQuestions);
                            }
                        }
                    }

                    const paper = createPaper(finalQuestions, QuestionSource.Generated);
                    setGeneratedPaper(paper);

                } catch (error: any) {
                    console.error("Error generating paper with AI:", error);

                    let isQuotaError = false;
                    // Check for quota error in the response
                    if (error?.error?.status === 'RESOURCE_EXHAUSTED' || error?.error?.code === 429) {
                        isQuotaError = true;
                    } else if (typeof error.message === 'string' && error.message.includes('429')) {
                        try {
                            const errorJson = JSON.parse(error.message.substring(error.message.indexOf('{')));
                            if (errorJson?.error?.status === 'RESOURCE_EXHAUSTED' || errorJson?.error?.code === 429) {
                                isQuotaError = true;
                            }
                        } catch {
                            // ignore if parsing fails
                        }
                    }
                    
                    if (isQuotaError) {
                        showToast(t('apiQuotaError', lang), 'error');
                    } else {
                        showToast(t('apiError', lang), 'error');
                    }
                    
                    showToast(t('fallbackToBank', lang), 'success');
                    
                    const fallbackResult = generateFromBank(distribution);
                    if ('error' in fallbackResult) {
                        showToast(fallbackResult.error, 'error');
                    } else {
                        const paper = createPaper(fallbackResult.questions, QuestionSource.Manual);
                        setGeneratedPaper(paper);
                        showToast(t('fallbackSuccess', lang), 'success');
                    }
                }
            } else {
                const result = generateFromBank(distribution);
                if ('error' in result) {
                    showToast(result.error, 'error');
                } else {
                    const paper = createPaper(result.questions, QuestionSource.Manual);
                    setGeneratedPaper(paper);
                }
            }
        } catch (error: any) {
            console.error("Error generating paper:", error);
            showToast('Paper generation failed. Check your settings.', 'error');
        } finally {
            setIsGenerating(false);
        }
    };

    const openImageViewer = (imageDataURL: string) => {
        setViewingImage(imageDataURL);
        setImageViewerOpen(true);
    };
    
    const handleSaveDraft = () => {
        localStorage.setItem(PAPER_GENERATOR_DRAFT_KEY, JSON.stringify(draftData));
        showToast(t('draftSaved', lang));
    };

    const handleClearDraft = () => {
        localStorage.removeItem(PAPER_GENERATOR_DRAFT_KEY);
        setTitle('');
        setYear(new Date().getFullYear());
        setClass(10);
        setSemester(Semester.First);
        setAvoidPrevious(true);
        resetSettings({
            markDistribution: '5x1, 5x2, 2x5',
            aiChapter: '',
            aiDifficulty: Difficulty.Moderate,
            aiKeywords: '',
            aiQuestionType: [],
            aiGenerateAnswers: false,
            wbbseSyllabusOnly: getInitialWbbseState(),
            generationMode: 'distribution',
            totalMarks: '25',
            allowedMarks: '1, 2, 3, 5',
        });
        showToast(t('draftCleared', lang));
    };

    const handleClearAISettings = () => {
        const currentSettings = { ...settings };
        currentSettings.aiChapter = '';
        currentSettings.aiKeywords = '';
        currentSettings.aiQuestionType = [];
        currentSettings.aiDifficulty = Difficulty.Moderate;
        currentSettings.aiGenerateAnswers = false;
        setSettings(currentSettings);
        showToast(t('aiSettingsCleared', lang));
    };
    
    const handleSaveAndArchive = () => {
        if (generatedPaper) {
            onSavePaper(generatedPaper);
            setGeneratedPaper(null);
            setTitle(''); // Reset title for next paper
        }
    };

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
                } catch (e) {
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

    const calculatedTotal = useMemo(() => {
        if (settings.generationMode === 'totalMarks') return settings.totalMarks;
        try {
            return settings.markDistribution
                .split(',')
                .map(s => s.trim().split('x').map(p => parseInt(p, 10)))
                .filter((parts): parts is [number, number] => parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1]))
                .reduce((acc, [count, marks]) => acc + (count * marks), 0);
        } catch {
            return 'N/A';
        }
    }, [settings.markDistribution, settings.generationMode, settings.totalMarks]);
    
    const inputStyles = "w-full p-2.5 border border-slate-300 bg-white rounded-lg shadow-sm focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 transition";
    const labelStyles = "block text-sm font-semibold text-slate-600 mb-1";

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 p-2 sm:p-4">
            {/* Left Column: Generator Settings */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 space-y-5">
                <h2 className="text-xl font-bold font-serif-display text-slate-800">{t('generatePaper', lang)}</h2>
                
                {/* Basic Info */}
                <div className="space-y-4">
                    <div>
                        <label htmlFor="title" className={labelStyles}>{t('paperTitle', lang)}</label>
                        <input id="title" type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder={`e.g., Mid-term Exam`} className={inputStyles} />
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                        <div>
                            <label htmlFor="year" className={labelStyles}>{t('year', lang)}</label>
                            <select id="year" value={year} onChange={e => setYear(parseInt(e.target.value))} className={inputStyles}>
                                {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                            </select>
                        </div>
                        <div>
                            <label htmlFor="class" className={labelStyles}>{t('class', lang)}</label>
                            <select id="class" value={selectedClass} onChange={e => setClass(parseInt(e.target.value))} className={inputStyles}>
                                {CLASSES.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                        </div>
                        <div>
                            <label htmlFor="semester" className={labelStyles}>{t('semester', lang)}</label>
                            <select id="semester" value={semester} onChange={e => setSemester(e.target.value as Semester)} className={inputStyles}>
                                 {SEMESTERS.map(s => <option key={s} value={s}>{`Sem ${s}`}</option>)}
                            </select>
                        </div>
                    </div>
                </div>
                
                {/* Mark Distribution */}
                <div className="border-t border-slate-200 pt-5">
                    <div className="flex items-center justify-between mb-2">
                         <label className={labelStyles}>{t('generateBy', lang)}</label>
                         <p className="text-sm font-bold text-slate-700">{t('totalMarks', lang)}: <span className="text-indigo-600">{calculatedTotal}</span></p>
                    </div>
                   <div className="flex items-center bg-slate-100 rounded-lg p-1 space-x-1">
                        <button onClick={() => handleSettingsChange('generationMode', 'distribution')} className={`flex-1 py-1.5 text-sm font-semibold rounded-md transition-colors ${settings.generationMode === 'distribution' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-600 hover:bg-white/70'}`}>{t('markDistributionMode', lang)}</button>
                        <button onClick={() => handleSettingsChange('generationMode', 'totalMarks')} className={`flex-1 py-1.5 text-sm font-semibold rounded-md transition-colors ${settings.generationMode === 'totalMarks' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-600 hover:bg-white/70'}`}>{t('totalMarksMode', lang)}</button>
                    </div>
                    {settings.generationMode === 'distribution' ? (
                        <div className="mt-3">
                            <label htmlFor="markDistribution" className={labelStyles}>{t('markDistribution', lang)}</label>
                            <input id="markDistribution" type="text" value={settings.markDistribution} onChange={e => handleSettingsChange('markDistribution', e.target.value)} className={inputStyles} placeholder="e.g., 5x1, 5x2, 2x5" />
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 gap-4 mt-3">
                            <div>
                                <label htmlFor="totalMarks" className={labelStyles}>{t('totalMarks', lang)}</label>
                                <input id="totalMarks" type="text" value={settings.totalMarks} onChange={e => handleSettingsChange('totalMarks', e.target.value)} className={inputStyles} placeholder="e.g., 70" />
                            </div>
                            <div>
                                <label htmlFor="allowedMarks" className={labelStyles}>{t('allowedQuestionMarks', lang)}</label>
                                <input id="allowedMarks" type="text" value={settings.allowedMarks} onChange={e => handleSettingsChange('allowedMarks', e.target.value)} className={inputStyles} placeholder="e.g., 1,2,5,10" />
                            </div>
                        </div>
                    )}
                </div>
                
                 {/* AI Settings */}
                <div className="border-t border-slate-200 pt-5 space-y-4">
                    <div className="flex justify-between items-center">
                        <h3 className="text-lg font-bold text-slate-700">AI Generation</h3>
                        <div className="flex items-center space-x-2">
                             <button onClick={handleClearAISettings} className="text-xs font-semibold text-slate-500 hover:text-red-600 transition-colors">{t('clearAISettings', lang)}</button>
                            <div className="flex items-center space-x-2">
                                <button onClick={undo} disabled={!canUndo} className="disabled:opacity-40">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                                    <span className="sr-only">{t('undo', lang)}</span>
                                </button>
                                <button onClick={redo} disabled={!canRedo} className="disabled:opacity-40">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" /></svg>
                                    <span className="sr-only">{t('redo', lang)}</span>
                                </button>
                            </div>
                        </div>
                    </div>
                     <div>
                        <label htmlFor="aiChapter" className={labelStyles}>{t('chapterForAI', lang)}</label>
                        <input id="aiChapter" type="text" value={settings.aiChapter} onChange={e => handleSettingsChange('aiChapter', e.target.value)} className={inputStyles} />
                    </div>
                    <div>
                        <label htmlFor="aiKeywords" className={labelStyles}>{t('keywordsForAI', lang)}</label>
                        <input id="aiKeywords" type="text" value={settings.aiKeywords} onChange={e => handleSettingsChange('aiKeywords', e.target.value)} className={inputStyles} />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className={labelStyles}>{t('questionTypeForAI', lang)}</label>
                            <div className="flex flex-wrap gap-2 mt-2">
                                {questionTypes.map(type => (
                                    <button
                                        key={type}
                                        type="button"
                                        onClick={() => handleQuestionTypeChange(type)}
                                        className={`px-3 py-1.5 text-xs sm:text-sm font-semibold rounded-full transition-colors ${
                                            settings.aiQuestionType.includes(type)
                                                ? 'bg-indigo-600 text-white shadow-sm'
                                                : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                                        }`}
                                    >
                                        {t(type, lang)}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div>
                             <label htmlFor="aiDifficulty" className={labelStyles}>{t('difficulty', lang)}</label>
                            <select id="aiDifficulty" value={settings.aiDifficulty} onChange={e => handleSettingsChange('aiDifficulty', e.target.value as Difficulty)} className={inputStyles}>
                                {Object.values(Difficulty).map(d => <option key={d} value={d}>{t(d, lang)}</option>)}
                            </select>
                        </div>
                    </div>
                     <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3 pt-2">
                        <label className="flex items-center space-x-2 cursor-pointer">
                            <input type="checkbox" checked={avoidPrevious} onChange={e => setAvoidPrevious(e.target.checked)} className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
                            <span className="text-sm font-medium text-slate-700">{t('avoidPrevious', lang)}</span>
                        </label>
                        <label className="flex items-center space-x-2 cursor-pointer">
                            <input type="checkbox" checked={settings.aiGenerateAnswers} onChange={e => handleSettingsChange('aiGenerateAnswers', e.target.checked)} className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
                            <span className="text-sm font-medium text-slate-700">{t('generateAnswersForAI', lang)}</span>
                        </label>
                         <label className="flex items-center space-x-2 cursor-pointer">
                            <input type="checkbox" checked={settings.wbbseSyllabusOnly} onChange={e => handleSettingsChange('wbbseSyllabusOnly', e.target.checked)} className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
                            <span className="text-sm font-medium text-slate-700">{t('wbbseSyllabusOnly', lang)}</span>
                        </label>
                    </div>
                </div>

                {/* Actions */}
                <div className="border-t border-slate-200 pt-5 space-y-3">
                    <div className="flex flex-col sm:flex-row gap-3">
                        <button onClick={() => handleGenerate(false)} disabled={isGenerating} className="flex-1 px-5 py-3 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 shadow-sm hover:shadow-md hover:-translate-y-px transition-all disabled:bg-indigo-300">
                            {isGenerating ? t('generating', lang) : t('generate', lang)}
                        </button>
                        <button onClick={() => handleGenerate(true)} disabled={isGenerating} className="flex-1 px-5 py-3 bg-gradient-to-r from-purple-500 to-indigo-600 text-white font-semibold rounded-lg hover:from-purple-600 hover:to-indigo-700 shadow-sm hover:shadow-md hover:-translate-y-px transition-all disabled:from-purple-300 disabled:to-indigo-400">
                           {isGenerating ? t('generating', lang) : `🚀 ${t('generateWithAI', lang)}`}
                        </button>
                    </div>
                    <div className="flex justify-center space-x-4">
                        <button onClick={handleSaveDraft} className="text-sm font-semibold text-slate-600 hover:text-indigo-700">{t('saveDraft', lang)}</button>
                        <button onClick={handleClearDraft} className="text-sm font-semibold text-slate-600 hover:text-red-700">{t('clearDraft', lang)}</button>
                    </div>
                </div>
            </div>

            {/* Right Column: Paper Preview */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 lg:max-h-[85vh] flex flex-col">
                 <h2 className="text-xl font-bold font-serif-display text-slate-800 mb-4">{t('paperPreview', lang)}</h2>
                {isGenerating && <div className="flex-grow flex items-center justify-center"><p>{t('generating', lang)}</p></div>}
                
                {!isGenerating && generatedPaper && (
                    <div className="flex-grow flex flex-col">
                        <div className="overflow-y-auto pr-2 flex-grow">
                             <h3 className="text-xl font-bold font-serif-display text-slate-800 text-center mb-6">{generatedPaper.title}</h3>
                            <div className="prose max-w-none prose-slate space-y-4">
                                {generatedPaper.questions.map((q, index) => (
                                    <div key={q.id}>
                                        {q.imageDataURL && (
                                            <img 
                                                src={q.imageDataURL} 
                                                alt="Question illustration" 
                                                className="max-w-xs mx-auto rounded-lg border my-2 cursor-pointer hover:shadow-md transition-shadow"
                                                onClick={() => openImageViewer(q.imageDataURL!)}
                                            />
                                        )}
                                        <p><strong>{index + 1}.</strong> {q.text} <span className="text-sm text-slate-500">({q.marks} {t('marks', lang)})</span></p>
                                    </div>
                                ))}
                            </div>
                            
                            {generatedPaper.questions.some(q => q.answer) && (
                                <div className="mt-8 pt-4 border-t border-slate-200">
                                    <h3 className="text-lg font-bold font-serif-display text-slate-800 mb-3">{t('answerKey', lang)}</h3>
                                    <div className="prose max-w-none prose-slate space-y-2">
                                        {generatedPaper.questions.map((q, index) => (
                                            q.answer ? (
                                                <p key={`ans-${q.id}`}><strong>{index + 1}.</strong> {q.answer}</p>
                                            ) : null
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                        <div className="flex flex-wrap justify-end gap-3 pt-4 mt-4 border-t border-slate-200">
                            <button onClick={() => handleExportXLSX(generatedPaper)} className="px-5 py-2.5 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 shadow-sm hover:shadow-md hover:-translate-y-px transition-all">{t('exportXLSX', lang)}</button>
                            <button onClick={() => handleExportPDF(generatedPaper)} className="px-5 py-2.5 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 shadow-sm hover:shadow-md hover:-translate-y-px transition-all">{t('exportPDF', lang)}</button>
                            <button onClick={handleSaveAndArchive} className="px-5 py-2.5 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 shadow-sm hover:shadow-md hover:-translate-y-px transition-all">Save & Archive</button>
                        </div>
                    </div>
                )}
                {!isGenerating && !generatedPaper && <div className="flex-grow flex items-center justify-center text-slate-500"><p>Generate a paper to see a preview.</p></div>}
            </div>

            <Modal isOpen={isImageViewerOpen} onClose={() => setImageViewerOpen(false)} title="Image Preview">
                {viewingImage && <img src={viewingImage} alt="Full size preview" className="w-full h-auto rounded-lg" />}
            </Modal>
        </div>
    );
};

export default PaperGenerator;