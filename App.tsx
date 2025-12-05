import React, { useState, useRef, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import PptxGenJS from 'pptxgenjs';
import { 
  PresentationState, 
  SlideContent, 
  GenerationStep, 
  OutlineItem, 
  SlideLayout,
  WorkflowStep
} from './types';
import { 
  generateOutline, 
  generateSlideContent, 
  regenerateSlide, 
  parseFileToText,
  generateImage
} from './services/geminiService';
import SlideCanvas from './components/SlideCanvas';
import ThumbnailList from './components/ThumbnailList';
import { 
  Wand2, 
  FileText, 
  Loader2, 
  RefreshCcw, 
  LayoutTemplate, 
  ChevronRight, 
  Image as ImageIcon,
  Presentation,
  Play,
  X,
  Upload,
  Palette,
  ArrowRight,
  CheckCircle,
  Pencil,
  Download
} from 'lucide-react';

export default function App() {
  // State
  const [workflowStep, setWorkflowStep] = useState<WorkflowStep>(WorkflowStep.INPUT);
  const [inputMode, setInputMode] = useState<'text' | 'file'>('text');
  const [prompt, setPrompt] = useState('');
  const [fileInput, setFileInput] = useState<File | null>(null);
  const [step, setStep] = useState<GenerationStep>(GenerationStep.IDLE);
  const [outline, setOutline] = useState<OutlineItem[]>([]);
  const [presentation, setPresentation] = useState<PresentationState>({
    slides: [],
    title: 'Untitled Presentation',
    theme: 'light'
  });
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [refinePrompt, setRefinePrompt] = useState('');
  const [showRefineInput, setShowRefineInput] = useState(false);
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [isGeneratingBg, setIsGeneratingBg] = useState(false);
  
  const slideRef = useRef<HTMLDivElement>(null);
  const exportContainerRef = useRef<HTMLDivElement>(null);

  // Keyboard navigation for preview mode
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isPreviewMode) return;
      
      if (e.key === 'ArrowRight' || e.key === 'Space') {
        setCurrentSlideIndex(prev => Math.min(prev + 1, presentation.slides.length - 1));
      } else if (e.key === 'ArrowLeft') {
        setCurrentSlideIndex(prev => Math.max(prev - 1, 0));
      } else if (e.key === 'Escape') {
        setIsPreviewMode(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPreviewMode, presentation.slides.length]);

  // Handlers
  const handleGenerateOutline = async () => {
    if (inputMode === 'text' && !prompt.trim()) return;
    if (inputMode === 'file' && !fileInput) return;
    
    setStep(inputMode === 'file' ? GenerationStep.PARSING_FILE : GenerationStep.GENERATING_OUTLINE);
    try {
      let context = prompt;
      
      if (inputMode === 'file' && fileInput) {
        const fileText = await parseFileToText(fileInput);
        context = fileText;
      }

      const generatedOutline = await generateOutline(context, inputMode === 'file');
      setOutline(generatedOutline);
      setStep(GenerationStep.IDLE);
      // Move to Editor Step automatically after outline is generated
      setWorkflowStep(WorkflowStep.EDITOR);
    } catch (error) {
      console.error(error);
      alert('Failed to generate outline. Please check your API key and try again.');
      setStep(GenerationStep.IDLE);
    }
  };

  const handleGenerateSlides = async () => {
    if (outline.length === 0) return;
    
    setStep(GenerationStep.GENERATING_SLIDES);
    const newSlides: SlideContent[] = [];
    
    try {
      // First generate structure text for all slides
      for (const item of outline) {
        // Add a small delay between requests to avoid rate limiting (429)
        if (newSlides.length > 0) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }

        const content = await generateSlideContent(item, presentation.theme);
        const slideId = uuidv4();
        const slide: SlideContent = { ...content, id: slideId };
        
        newSlides.push(slide);
        
        // Update state progressively so user sees text coming in
        setPresentation(prev => ({ 
            ...prev, 
            slides: prev.slides.some(s => s.id === slideId) ? prev.slides : [...prev.slides, slide] 
        }));

        // If the slide needs an image, generate it asynchronously
        if (content.layout === SlideLayout.IMAGE_TEXT && content.imagePrompt) {
           // Small delay before triggering image generation to space out requests
           setTimeout(() => {
             generateImage(content.imagePrompt!).then(imageUrl => {
                 setPresentation(prev => ({
                     ...prev,
                     slides: prev.slides.map(s => s.id === slideId ? { ...s, imageUrl } : s)
                 }));
             }).catch(err => console.error("Failed to generate image for slide", err));
           }, 2000 * newSlides.length); // Stagger image generation
        }
      }
      
      setCurrentSlideIndex(0);
    } catch (error) {
      console.error(error);
      alert('Error generating slides. The AI is busy, please try again in a moment.');
    } finally {
      setStep(GenerationStep.IDLE);
    }
  };

  const handleGenerateBackground = async () => {
     setIsGeneratingBg(true);
     try {
       const topic = prompt || (outline.length > 0 ? outline[0].title : "Professional Presentation");
       const themeContext = presentation.theme === 'dark' ? "dark mode, elegant black/grey tones" : "light mode, clean white/grey tones";
       
       // Improved Prompt for Backgrounds: Minimalist, abstract, low contrast
       const bgPrompt = `Professional presentation background wallpaper for topic: "${topic}". 
       Style: ${themeContext}, Minimalist, Abstract, Geometric, Soft Gradients, High-End Corporate. 
       CRITICAL: Low contrast, No text, No realistic people, No complex details. 
       Must have plenty of negative space for overlaying text. 4k resolution.`;
       
       const imageUrl = await generateImage(bgPrompt);
       setPresentation(prev => ({ ...prev, backgroundImage: imageUrl }));
     } catch (e) {
       console.error(e);
       alert("Failed to generate background. Please try again.");
     } finally {
       setIsGeneratingBg(false);
     }
  };

  const handleRegenerateSlide = async () => {
    if (!refinePrompt || presentation.slides.length === 0) return;
    
    setStep(GenerationStep.REGENERATING_SLIDE);
    const currentSlide = presentation.slides[currentSlideIndex];
    
    try {
      const newContent = await regenerateSlide(currentSlide, refinePrompt);
      const updatedSlides = [...presentation.slides];
      updatedSlides[currentSlideIndex] = { ...newContent, id: currentSlide.id };
      setPresentation(prev => ({ ...prev, slides: updatedSlides }));
      setRefinePrompt('');
      setShowRefineInput(false);
    } catch (error) {
      console.error(error);
      alert('Failed to regenerate slide.');
    } finally {
      setStep(GenerationStep.IDLE);
    }
  };

  const handleSlideUpdate = (updatedSlide: SlideContent) => {
    const newSlides = [...presentation.slides];
    newSlides[currentSlideIndex] = updatedSlide;
    setPresentation(prev => ({ ...prev, slides: newSlides }));
  };

  // Export Logic
  const handleExportPDF = async () => {
    if (presentation.slides.length === 0) return;
    setIsExportingPdf(true);

    setTimeout(async () => {
      try {
        const doc = new jsPDF({ orientation: 'landscape', unit: 'px', format: [1280, 720] });
        
        if (exportContainerRef.current) {
            const slideElements = exportContainerRef.current.children;
            
            for (let i = 0; i < slideElements.length; i++) {
                const el = slideElements[i] as HTMLElement;
                const canvas = await html2canvas(el, { 
                    scale: 2, 
                    useCORS: true,
                    logging: false
                });
                const imgData = canvas.toDataURL('image/png');
                
                if (i > 0) doc.addPage([1280, 720], 'landscape');
                doc.addImage(imgData, 'PNG', 0, 0, 1280, 720);
            }
            doc.save('presentation.pdf');
        }
      } catch (e) {
        console.error("PDF Export failed", e);
        alert("Failed to export PDF.");
      } finally {
        setIsExportingPdf(false);
      }
    }, 500);
  };

  const handleExportPPTX = async () => {
    const pptx = new PptxGenJS();
    pptx.layout = 'LAYOUT_16x9';

    const getThemeColors = (theme: string) => {
      if (presentation.backgroundImage) {
        return { bg: '000000', text: 'ffffff', accent: 'ffffff', muted: 'e5e5e5' };
      }
      switch(theme) {
        case 'dark': return { bg: '0f172a', text: 'ffffff', accent: '818cf8', muted: 'cbd5e1' };
        case 'blue': return { bg: '1e3a8a', text: 'eff6ff', accent: '93c5fd', muted: 'bfdbfe' };
        case 'modern': return { bg: 'f5f5f5', text: '171717', accent: 'f43f5e', muted: '737373' };
        default: return { bg: 'ffffff', text: '111827', accent: '4f46e5', muted: '6b7280' };
      }
    };

    const colors = getThemeColors(presentation.theme);
    const fontFace = 'Microsoft YaHei';

    for (const slide of presentation.slides) {
      const s = pptx.addSlide();
      
      if (presentation.backgroundImage) {
        s.background = { data: presentation.backgroundImage };
        s.addShape(pptx.ShapeType.rect, { x:0, y:0, w:'100%', h:'100%', fill:{color:'000000', transparency:60} });
      } else {
        s.background = { color: colors.bg };
        s.color = colors.text;
        s.addShape(pptx.ShapeType.ellipse, {
            x: 8.5, y: -1.5, w: 3, h: 3,
            fill: { color: colors.text, transparency: 97 },
            line: { color: undefined }
        });
        s.addShape(pptx.ShapeType.ellipse, {
            x: -1.0, y: 4.5, w: 2.5, h: 2.5,
            fill: { color: colors.text, transparency: 97 },
            line: { color: undefined }
        });
      }

      if (slide.speakerNotes) s.addNotes(slide.speakerNotes);

      switch (slide.layout) {
        case SlideLayout.TITLE:
          s.addText(slide.title, { 
            x: 0.5, y: 2.0, w: '90%', h: 1.5,
            fontSize: 44, align: 'center', bold: true, color: colors.accent, fontFace
          });
          if(slide.subtitle) {
            s.addText(slide.subtitle, { 
              x: 1.5, y: 3.5, w: '70%', h: 1,
              fontSize: 24, align: 'center', color: colors.text, transparency: 20, fontFace
            });
          }
          break;

        case SlideLayout.BULLETS:
          s.addText(slide.title, { 
            x: 0.5, y: 0.4, w: '90%', h: 1,
            fontSize: 32, bold: true, color: colors.accent, align: 'left', fontFace
          });
          if(slide.bullets && slide.bullets.length > 0) {
             const bullets = slide.bullets.map(b => ({ 
               text: b, 
               options: { fontSize: 18, color: colors.text, breakLine: true, indent: 0, fontFace } 
             }));
             s.addText(bullets, { 
               x: 0.5, y: 1.4, w: '90%', h: 4, 
               bullet: { type: 'bullet' }, 
               lineSpacing: 32
             });
          }
          break;

        case SlideLayout.TWO_COLUMN:
            s.addText(slide.title, { 
              x: 0.5, y: 0.4, w: '90%', h: 1,
              fontSize: 32, bold: true, color: colors.accent, align: 'left', fontFace
            });
            if(slide.columnLeft && slide.columnLeft.length > 0) {
                const bLeft = slide.columnLeft.map(b => ({ 
                  text: b, 
                  options: { fontSize: 16, color: colors.text, breakLine: true, fontFace } 
                }));
                s.addText(bLeft, { 
                  x: 0.5, y: 1.4, w: 4.25, h: 4, 
                  bullet: { type: 'bullet' }, 
                  lineSpacing: 28 
                });
            }
            if(slide.columnRight && slide.columnRight.length > 0) {
                const bRight = slide.columnRight.map(b => ({ 
                  text: b, 
                  options: { fontSize: 16, color: colors.text, breakLine: true, fontFace } 
                }));
                s.addText(bRight, { 
                  x: 5.25, y: 1.4, w: 4.25, h: 4, 
                  bullet: { type: 'bullet' }, 
                  lineSpacing: 28 
                });
            }
            break;

        case SlideLayout.QUOTE:
            s.addText('"', { 
              x: 0.5, y: 1.0, w: '90%', h: 1,
              fontSize: 80, color: colors.accent, align: 'center', transparency: 50, fontFace
            });
            s.addText(`"${slide.quote}"`, { 
              x: 1, y: 2.0, w: '80%', h: 2,
              fontSize: 28, italic: true, align: 'center', color: colors.text, fontFace: 'Georgia'
            });
            if(slide.author) {
              s.addText(`— ${slide.author}`, { 
                x: 1, y: 4.0, w: '80%', h: 0.5,
                fontSize: 18, align: 'center', color: colors.accent, bold: true, fontFace
              });
            }
            break;

        case SlideLayout.BIG_NUMBER:
            s.addText(slide.title, { 
              x: 0.5, y: 0.5, w: '90%', h: 0.5,
              fontSize: 24, color: colors.text, transparency: 20, align: 'center', bold: true, fontFace
            });
            if(slide.statistic) {
              s.addText(slide.statistic, { 
                x: 0, y: 1.5, w: '100%', h: 2,
                fontSize: 80, align: 'center', bold: true, color: colors.accent, fontFace
              });
            }
            if(slide.description) {
              s.addText(slide.description, { 
                x: 2, y: 3.5, w: 6, h: 1.5,
                fontSize: 18, align: 'center', color: colors.text, fontFace
              });
            }
            break;

        case SlideLayout.CODE:
          s.addText(slide.title, { 
            x: 0.5, y: 0.4, w: '90%', h: 0.8,
            fontSize: 32, bold: true, color: colors.accent, align: 'left', fontFace
          });
          const lineCount = slide.code ? slide.code.split('\n').length : 0;
          const isSplit = lineCount >= 6;
          let codeX = 0.5, codeY = 1.4, codeW = 9.0, codeH = 3.5;
          let textX = 0.5, textY = 4.0, textW = 9.0, textH = 1.5;

          if (isSplit) {
            codeX = 0.5; codeY = 1.4; codeW = 4.8; codeH = 3.8;
            textX = 5.6; textY = 1.4; textW = 3.9; textH = 3.8;
          } else {
            codeW = 9.0; codeH = 2.5; 
            textY = 4.1; textH = 1.3;
          }
          s.addShape(pptx.ShapeType.rect, { x: codeX, y: codeY, w: codeW, h: 0.3, fill: { color: '252526' }, line: { color: '1e1e1e', width: 1 } });
          s.addShape(pptx.ShapeType.rect, { x: codeX, y: codeY + 0.3, w: codeW, h: codeH - 0.3, fill: { color: '1e1e1e' }, line: { color: '2d2d2d', width: 1 } });
          
          if (slide.code) {
             s.addText(slide.code, {
               x: codeX + 0.1, y: codeY + 0.4, w: codeW - 0.2, h: codeH - 0.5,
               fontSize: 10, fontFace: 'Courier New', color: 'd4d4d4', 
               align: 'left', valign: 'top'
             });
          }
          if(slide.description) {
            s.addText(slide.description, { x: textX, y: textY, w: textW, h: textH, fontSize: 14, color: colors.text, valign: 'top', fontFace });
          }
          break;

        case SlideLayout.IMAGE_TEXT:
           s.addText(slide.title, { x: 0.5, y: 0.4, w: '90%', h: 1, fontSize: 32, bold: true, color: colors.accent, align: 'left', fontFace });
           if(slide.bullets && slide.bullets.length > 0) {
             const bullets = slide.bullets.map(b => ({ text: b, options: { fontSize: 18, color: colors.text, breakLine: true, indent: 0, fontFace } }));
             s.addText(bullets, { x: 0.5, y: 1.4, w: 4.5, h: 4, bullet: { type: 'bullet' }, lineSpacing: 32 });
           }
           if(slide.imageUrl) {
             s.addImage({ data: slide.imageUrl, x: 5.25, y: 1.4, w: 4.25, h: 4, sizing: { type: 'cover', w: 4.25, h: 4 } });
           }
           break;
      }
    }
    pptx.writeFile({ fileName: "presentation.pptx" });
  };

  // --- Views ---

  const renderInputView = () => (
    <div className="flex flex-col items-center justify-center h-screen bg-gray-50 p-6">
       <div className="max-w-2xl w-full bg-white rounded-2xl shadow-xl p-10 border border-gray-100">
          <div className="flex flex-col items-center text-center mb-8">
             <div className="w-16 h-16 bg-indigo-100 rounded-2xl flex items-center justify-center mb-4 text-indigo-600">
                <Wand2 className="w-8 h-8" />
             </div>
             <h1 className="text-3xl font-bold text-gray-900 mb-2">GenAI PPT Creator</h1>
             <p className="text-gray-500">Transform your ideas or documents into professional presentations in seconds.</p>
          </div>

          <div className="flex bg-gray-100 p-1.5 rounded-xl mb-8 w-full max-w-sm mx-auto">
            <button 
              className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${inputMode === 'text' ? 'bg-white shadow-sm text-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}
              onClick={() => { setInputMode('text'); setFileInput(null); }}
            >
              From Topic
            </button>
            <button 
              className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${inputMode === 'file' ? 'bg-white shadow-sm text-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}
              onClick={() => { setInputMode('file'); }} 
            >
              From File
            </button>
          </div>

          <div className="mb-8">
            {inputMode === 'text' ? (
               <div className="relative">
                 <textarea
                   className="w-full p-4 text-base border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none resize-none h-32 bg-gray-50 focus:bg-white transition-colors"
                   placeholder="Enter your presentation topic or a detailed description..."
                   value={prompt}
                   onChange={(e) => setPrompt(e.target.value)}
                 />
               </div>
            ) : (
                <div 
                  className={`relative border-2 border-dashed rounded-xl p-8 text-center transition-all ${fileInput ? 'border-indigo-500 bg-indigo-50/50' : 'border-gray-300 hover:border-indigo-400 hover:bg-gray-50'}`}
                >
                    {!fileInput ? (
                        <div className="flex flex-col items-center cursor-pointer">
                           <input 
                              type="file" 
                              accept=".md,.txt" 
                              onChange={(e) => {
                                  if(e.target.files?.[0]) setFileInput(e.target.files[0]);
                              }} 
                              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                           />
                           <Upload className="w-10 h-10 text-gray-400 mb-3" />
                           <p className="text-base font-medium text-gray-600">Click to upload Markdown or Text</p>
                           <p className="text-sm text-gray-400 mt-1">Supports .md and .txt files</p>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center">
                             <FileText className="w-12 h-12 text-indigo-600 mb-3" />
                             <p className="text-lg font-medium text-gray-900 mb-1">{fileInput.name}</p>
                             <p className="text-sm text-gray-500 mb-4">{(fileInput.size / 1024).toFixed(1)} KB</p>
                             <button 
                                className="text-sm text-red-500 hover:text-red-700 font-medium px-4 py-2 bg-white rounded-lg border border-gray-200 hover:bg-red-50 z-10 relative transition-colors" 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setFileInput(null);
                                }}
                             >
                                Remove File
                             </button>
                        </div>
                    )}
                </div>
            )}
          </div>

          <button
            onClick={handleGenerateOutline}
            disabled={step !== GenerationStep.IDLE || (inputMode === 'text' && !prompt) || (inputMode === 'file' && !fileInput)}
            className="w-full py-4 bg-indigo-600 text-white rounded-xl font-bold text-lg hover:bg-indigo-700 transition-all transform hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none shadow-lg shadow-indigo-200 flex items-center justify-center gap-3"
          >
            {step === GenerationStep.GENERATING_OUTLINE || step === GenerationStep.PARSING_FILE ? <Loader2 className="w-6 h-6 animate-spin"/> : <Wand2 className="w-6 h-6" />}
            {step === GenerationStep.PARSING_FILE ? 'Analyzing File...' : step === GenerationStep.GENERATING_OUTLINE ? 'Generating Outline...' : 'Create Presentation Outline'}
          </button>
       </div>
    </div>
  );

  const renderEditorView = () => (
    <div className="flex h-screen bg-gray-50 text-slate-800 font-sans">
      {/* Left Sidebar: Outline */}
      <div className="w-80 bg-white border-r border-gray-200 flex flex-col h-full shadow-sm z-10">
         <div className="h-16 flex items-center px-6 border-b border-gray-100 justify-between">
            <button onClick={() => setWorkflowStep(WorkflowStep.INPUT)} className="text-xs font-medium text-gray-400 hover:text-gray-700 flex items-center gap-1">
               <ArrowRight className="w-3 h-3 rotate-180"/> Back
            </button>
            <span className="text-xs font-bold text-gray-900 uppercase tracking-wider">Editor</span>
            <div className="w-4"></div>
         </div>
         
         <div className="flex-1 overflow-y-auto p-4">
             {/* Outline View */}
             {presentation.slides.length === 0 ? (
               <div className="space-y-4">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-bold text-gray-900">Review Outline</h3>
                  </div>
                  <div className="space-y-3">
                    {outline.map((item, i) => (
                      <div key={i} className="p-3 bg-white rounded-lg border border-gray-200 text-sm shadow-sm">
                        <div className="font-semibold text-gray-800 mb-1">{i+1}. {item.title}</div>
                        <div className="text-gray-500 text-xs line-clamp-3">{item.description}</div>
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={handleGenerateSlides}
                    disabled={step !== GenerationStep.IDLE}
                    className="w-full py-3 bg-emerald-600 text-white rounded-lg font-bold hover:bg-emerald-700 transition-colors shadow-md shadow-emerald-100 flex items-center justify-center gap-2 mt-4 sticky bottom-0"
                  >
                    {step === GenerationStep.GENERATING_SLIDES ? <Loader2 className="w-4 h-4 animate-spin"/> : <LayoutTemplate className="w-4 h-4" />}
                    Generate Slides
                  </button>
               </div>
             ) : (
                /* Slides Thumbnails */
                <ThumbnailList 
                    slides={presentation.slides} 
                    currentIndex={currentSlideIndex} 
                    onSelect={setCurrentSlideIndex} 
                />
             )}
         </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 bg-gray-100/50">
         {/* Toolbar */}
         <div className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6 shadow-sm">
             <div className="flex items-center gap-6">
                <div className="flex items-center gap-3">
                   <span className="text-xs font-medium text-gray-400 uppercase">Theme</span>
                   <div className="flex gap-1.5">
                      {['light', 'dark', 'blue', 'modern'].map(t => (
                        <button 
                          key={t}
                          onClick={() => setPresentation(p => ({...p, theme: t as any}))}
                          className={`w-5 h-5 rounded-full border border-gray-300 shadow-sm ${t === 'light' ? 'bg-white' : t === 'dark' ? 'bg-slate-900' : t === 'blue' ? 'bg-blue-900' : 'bg-rose-500'} ${presentation.theme === t ? 'ring-2 ring-offset-1 ring-indigo-500 scale-110' : 'hover:scale-110'} transition-all`}
                        />
                      ))}
                   </div>
                </div>
                
                <div className="h-4 w-px bg-gray-200"></div>

                <button 
                  onClick={handleGenerateBackground}
                  disabled={isGeneratingBg || presentation.slides.length === 0}
                  className="text-xs font-medium text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-full flex items-center gap-1.5 transition-colors disabled:opacity-50"
                >
                  {isGeneratingBg ? <Loader2 className="w-3 h-3 animate-spin"/> : <Palette className="w-3 h-3" />}
                  Generate Background
                </button>
             </div>

             <div className="flex items-center gap-3">
                {presentation.slides.length > 0 && (
                   <button 
                      onClick={() => setWorkflowStep(WorkflowStep.EXPORT)}
                      className="px-4 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm flex items-center gap-2 transition-all"
                   >
                     Finish & Export <ArrowRight className="w-4 h-4" />
                   </button>
                )}
             </div>
         </div>

         {/* Canvas */}
         <div className="flex-1 flex flex-col items-center justify-center p-8 overflow-hidden relative">
            {presentation.slides.length > 0 ? (
               <div className="w-full max-w-5xl aspect-video shadow-2xl relative group">
                  {/* Quick Action Overlay */}
                  <div className="absolute top-4 right-4 z-20 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={() => setIsPreviewMode(true)}
                        className="bg-black/70 hover:bg-black text-white p-2 rounded-lg backdrop-blur-sm transition-colors"
                        title="Fullscreen Preview"
                      >
                        <Play className="w-4 h-4"/>
                      </button>
                      <button 
                        onClick={() => setShowRefineInput(!showRefineInput)}
                        className="bg-black/70 hover:bg-black text-white px-3 py-2 rounded-lg backdrop-blur-sm text-xs font-medium flex items-center gap-2 transition-colors"
                      >
                        <RefreshCcw className="w-3 h-3" /> AI Edit
                      </button>
                  </div>

                  <SlideCanvas 
                      ref={slideRef}
                      slide={presentation.slides[currentSlideIndex]} 
                      theme={presentation.theme} 
                      onEdit={handleSlideUpdate} 
                      backgroundImage={presentation.backgroundImage}
                  />
                  
                  {/* Refine Popover */}
                  {showRefineInput && (
                    <div className="absolute top-14 right-4 z-30 w-80 bg-white/95 backdrop-blur p-4 rounded-xl shadow-xl border border-gray-200 animate-in fade-in zoom-in-95 origin-top-right">
                        <div className="flex justify-between items-center mb-2">
                          <h4 className="text-xs font-bold text-gray-900 uppercase">AI Slide Editor</h4>
                          <button onClick={() => setShowRefineInput(false)}><X className="w-3 h-3 text-gray-400 hover:text-gray-700"/></button>
                        </div>
                        <textarea 
                            value={refinePrompt}
                            onChange={(e) => setRefinePrompt(e.target.value)}
                            placeholder="e.g., Change layout to two columns, add a joke..."
                            className="w-full text-sm border border-gray-200 rounded-lg p-3 mb-3 h-24 outline-none focus:border-indigo-500 resize-none bg-white"
                        />
                        <button 
                            onClick={handleRegenerateSlide} 
                            disabled={step === GenerationStep.REGENERATING_SLIDE || !refinePrompt}
                            className="w-full py-2 text-xs font-bold bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center gap-2 transition-colors"
                        >
                            {step === GenerationStep.REGENERATING_SLIDE ? <Loader2 className="w-3 h-3 animate-spin"/> : 'Update Slide'}
                        </button>
                    </div>
                  )}
               </div>
            ) : (
               <div className="flex flex-col items-center justify-center text-gray-400 animate-pulse">
                  <div className="w-20 h-20 bg-gray-200 rounded-full mb-4"></div>
                  <div className="h-4 w-48 bg-gray-200 rounded mb-2"></div>
                  <div className="h-4 w-32 bg-gray-200 rounded"></div>
               </div>
            )}
         </div>

         {/* Navigation */}
         {presentation.slides.length > 0 && (
             <div className="h-14 bg-white border-t border-gray-200 flex items-center justify-center gap-8 shadow-[0_-1px_3px_rgba(0,0,0,0.05)]">
                 <button 
                    disabled={currentSlideIndex === 0}
                    onClick={() => setCurrentSlideIndex(i => i - 1)}
                    className="p-2 hover:bg-gray-100 rounded-full disabled:opacity-30 text-gray-600"
                 >
                     <ChevronRight className="w-6 h-6 rotate-180" />
                 </button>
                 <span className="font-mono text-sm font-medium text-gray-500">
                     {currentSlideIndex + 1} / {presentation.slides.length}
                 </span>
                 <button 
                    disabled={currentSlideIndex === presentation.slides.length - 1}
                    onClick={() => setCurrentSlideIndex(i => i + 1)}
                    className="p-2 hover:bg-gray-100 rounded-full disabled:opacity-30 text-gray-600"
                 >
                     <ChevronRight className="w-6 h-6" />
                 </button>
             </div>
         )}
      </div>

       {/* Right Sidebar: Notes (only shown in Editor) */}
       {presentation.slides.length > 0 && (
          <div className="w-72 bg-white border-l border-gray-200 flex flex-col shadow-sm z-10 hidden 2xl:flex">
             <div className="h-16 flex items-center px-6 border-b border-gray-100">
               <span className="text-xs font-bold text-gray-900 uppercase tracking-wider">Speaker Notes</span>
             </div>
              <textarea 
                  className="flex-1 resize-none text-sm text-gray-600 bg-transparent outline-none focus:bg-gray-50 p-6 leading-relaxed"
                  value={presentation.slides[currentSlideIndex].speakerNotes || ''}
                  onChange={(e) => handleSlideUpdate({ ...presentation.slides[currentSlideIndex], speakerNotes: e.target.value })}
                  placeholder="Add notes for your presentation here..."
              />
          </div>
      )}
    </div>
  );

  const renderExportView = () => (
     <div className="flex flex-col items-center justify-center h-screen bg-gray-50 p-8">
        <div className="w-full max-w-4xl bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col md:flex-row h-[600px]">
           {/* Preview Side */}
           <div className="flex-1 bg-gray-100 p-8 flex flex-col items-center justify-center relative overflow-hidden">
               <div className="absolute inset-0 opacity-10 pattern-grid-lg text-gray-400"></div>
               <div className="relative z-10 w-full aspect-video shadow-2xl rounded-lg overflow-hidden transform hover:scale-105 transition-transform duration-500">
                   {presentation.slides.length > 0 && (
                      <SlideCanvas 
                        slide={presentation.slides[0]} 
                        theme={presentation.theme} 
                        scale={0.5} // Scale down for preview
                        backgroundImage={presentation.backgroundImage}
                      />
                   )}
               </div>
               <div className="mt-8 text-center relative z-10">
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">{presentation.slides[0]?.title || "Presentation Ready"}</h2>
                  <p className="text-gray-500">{presentation.slides.length} Slides • {presentation.theme} Theme</p>
               </div>
           </div>

           {/* Action Side */}
           <div className="w-full md:w-96 bg-white p-10 flex flex-col justify-center">
               <div className="flex items-center gap-3 mb-8 text-green-600">
                  <CheckCircle className="w-8 h-8" />
                  <span className="text-xl font-bold">Ready to Export</span>
               </div>
               
               <div className="space-y-4">
                  <button 
                    onClick={handleExportPPTX} 
                    className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow-lg shadow-indigo-200 flex items-center justify-center gap-3 transition-transform active:scale-95"
                  >
                     <Presentation className="w-5 h-5" /> Download PPTX
                  </button>
                  <button 
                    onClick={handleExportPDF} 
                    disabled={isExportingPdf}
                    className="w-full py-4 bg-white border-2 border-gray-200 hover:border-gray-300 text-gray-700 rounded-xl font-bold flex items-center justify-center gap-3 transition-colors"
                  >
                     {isExportingPdf ? <Loader2 className="w-5 h-5 animate-spin"/> : <Download className="w-5 h-5" />} 
                     Download PDF
                  </button>
               </div>

               <div className="mt-12 pt-8 border-t border-gray-100 flex flex-col gap-3">
                  <button 
                     onClick={() => setWorkflowStep(WorkflowStep.EDITOR)}
                     className="text-sm font-medium text-gray-500 hover:text-indigo-600 flex items-center justify-center gap-2"
                  >
                     <Pencil className="w-4 h-4" /> Keep Editing
                  </button>
                  <button 
                     onClick={() => {
                        setPresentation({ slides: [], title: 'Untitled', theme: 'light' });
                        setOutline([]);
                        setPrompt('');
                        setFileInput(null);
                        setWorkflowStep(WorkflowStep.INPUT);
                     }}
                     className="text-sm font-medium text-red-400 hover:text-red-600 flex items-center justify-center gap-2"
                  >
                     Start New
                  </button>
               </div>
           </div>
        </div>
     </div>
  );

  return (
    <>
      {/* Hidden container for PDF generation */}
      <div 
        ref={exportContainerRef} 
        style={{ position: 'absolute', top: '-9999px', left: '-9999px', width: '1280px' }}
      >
        {isExportingPdf && presentation.slides.map((slide) => (
             <div key={slide.id} style={{ width: '1280px', height: '720px' }}>
                <SlideCanvas 
                  slide={slide} 
                  theme={presentation.theme} 
                  backgroundImage={presentation.backgroundImage}
                />
             </div>
        ))}
      </div>

      {/* Fullscreen Preview Modal */}
      {isPreviewMode && presentation.slides.length > 0 && (
        <div className="fixed inset-0 z-50 bg-black flex items-center justify-center animate-in fade-in duration-200">
            <button 
                onClick={() => setIsPreviewMode(false)}
                className="absolute top-6 right-6 text-white/50 hover:text-white p-2 transition-colors z-50"
            >
                <X className="w-8 h-8" />
            </button>
            <div className="w-full h-full max-w-[177.78vh] max-h-[56.25vw] aspect-video shadow-2xl">
                 <SlideCanvas 
                    slide={presentation.slides[currentSlideIndex]} 
                    theme={presentation.theme} 
                    backgroundImage={presentation.backgroundImage}
                />
            </div>
            <div className="absolute bottom-6 left-0 right-0 flex justify-center gap-8 text-white/50">
                 <button onClick={() => setCurrentSlideIndex(Math.max(0, currentSlideIndex - 1))} className="hover:text-white transition-colors"><ChevronRight className="rotate-180 w-10 h-10"/></button>
                 <span className="text-lg font-mono pt-1">{currentSlideIndex + 1} / {presentation.slides.length}</span>
                 <button onClick={() => setCurrentSlideIndex(Math.min(presentation.slides.length -1, currentSlideIndex + 1))} className="hover:text-white transition-colors"><ChevronRight className="w-10 h-10"/></button>
            </div>
        </div>
      )}

      {/* Main Render Switch */}
      {workflowStep === WorkflowStep.INPUT && renderInputView()}
      {workflowStep === WorkflowStep.EDITOR && renderEditorView()}
      {workflowStep === WorkflowStep.EXPORT && renderExportView()}
    </>
  );
}