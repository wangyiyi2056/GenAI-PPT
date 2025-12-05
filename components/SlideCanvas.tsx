
import React, { forwardRef } from 'react';
import { SlideContent, SlideLayout } from '../types';
import { Quote, Terminal, Image as ImageIcon } from 'lucide-react';

interface Props {
  slide: SlideContent;
  theme: string;
  onEdit?: (newSlide: SlideContent) => void;
  scale?: number; // Added to support PDF export scaling
  backgroundImage?: string;
}

const SlideCanvas = forwardRef<HTMLDivElement, Props>(({ slide, theme, onEdit, scale = 1, backgroundImage }, ref) => {
  
  // Helper to handle text updates
  const handleUpdate = (field: keyof SlideContent, value: any) => {
    if (onEdit) {
      onEdit({ ...slide, [field]: value });
    }
  };

  const handleArrayUpdate = (field: 'bullets' | 'columnLeft' | 'columnRight', index: number, value: string) => {
    if (onEdit && slide[field]) {
      const newArray = [...(slide[field] || [])];
      newArray[index] = value;
      handleUpdate(field, newArray);
    }
  };

  const editableProps = (field: keyof SlideContent) => ({
    contentEditable: !!onEdit,
    suppressContentEditableWarning: true,
    onBlur: (e: React.FocusEvent<HTMLElement>) => handleUpdate(field, e.currentTarget.innerText),
    className: `outline-none border border-transparent hover:border-dashed hover:border-gray-400/50 rounded px-1 transition-colors cursor-text empty:before:content-[attr(data-placeholder)] empty:before:text-gray-400`
  });

  const getThemeColors = () => {
    // If background image is present, we enforce white text with shadows/overlay
    if (backgroundImage) {
      return 'text-white drop-shadow-md';
    }

    switch(theme) {
      case 'dark': return 'bg-slate-900 text-white border-slate-700';
      case 'blue': return 'bg-blue-900 text-blue-50 border-blue-700';
      case 'modern': return 'bg-neutral-100 text-neutral-900 border-neutral-200';
      default: return 'bg-white text-gray-900 border-gray-200';
    }
  };

  const getAccentColor = () => {
    if (backgroundImage) return 'text-white';
    switch(theme) {
      case 'dark': return 'text-indigo-400';
      case 'blue': return 'text-blue-300';
      case 'modern': return 'text-rose-500';
      default: return 'text-indigo-600';
    }
  };

  const renderContent = () => {
    switch (slide.layout) {
      case SlideLayout.TITLE:
        return (
          <div className="flex flex-col items-center justify-center h-full text-center px-12 relative z-10">
            <h1 
              {...editableProps('title')}
              className={`text-5xl font-bold mb-6 ${getAccentColor()} ${editableProps('title').className}`}
            >{slide.title}</h1>
            <h2 
              {...editableProps('subtitle')}
              className={`text-2xl opacity-80 min-h-[2rem] min-w-[50%] ${editableProps('subtitle').className}`}
              data-placeholder="Subtitle"
            >{slide.subtitle}</h2>
          </div>
        );

      case SlideLayout.BULLETS:
        return (
          <div className="flex flex-col h-full px-12 py-10 relative z-10">
            <h2 
              {...editableProps('title')}
              className={`text-4xl font-bold mb-8 ${getAccentColor()} ${editableProps('title').className}`}
            >{slide.title}</h2>
            <ul className="space-y-4 text-xl flex-1">
              {slide.bullets?.map((bullet, idx) => (
                <li key={idx} className="flex items-start">
                  <span className={`mr-3 mt-1.5 h-2 w-2 rounded-full flex-shrink-0 ${backgroundImage ? 'bg-white' : (theme === 'light' || theme === 'modern' ? 'bg-indigo-600' : 'bg-indigo-400')}`}></span>
                  <span 
                    contentEditable={!!onEdit}
                    suppressContentEditableWarning
                    onBlur={(e) => handleArrayUpdate('bullets', idx, e.currentTarget.innerText)}
                    className="outline-none border border-transparent hover:border-dashed hover:border-gray-400/50 rounded px-1 flex-1"
                  >{bullet}</span>
                </li>
              ))}
            </ul>
          </div>
        );

      case SlideLayout.TWO_COLUMN:
        return (
          <div className="flex flex-col h-full px-12 py-10 relative z-10">
             <h2 
              {...editableProps('title')}
              className={`text-4xl font-bold mb-8 ${getAccentColor()} ${editableProps('title').className}`}
            >{slide.title}</h2>
            <div className="grid grid-cols-2 gap-12 flex-1">
              <div>
                <ul className="space-y-4 text-lg">
                  {slide.columnLeft?.map((item, idx) => (
                     <li key={idx} className="flex items-start">
                     <span className={`mr-3 mt-1.5 h-2 w-2 rounded-full flex-shrink-0 ${backgroundImage ? 'bg-white' : (theme === 'light' || theme === 'modern' ? 'bg-indigo-600' : 'bg-indigo-400')}`}></span>
                     <span 
                        contentEditable={!!onEdit}
                        suppressContentEditableWarning
                        onBlur={(e) => handleArrayUpdate('columnLeft', idx, e.currentTarget.innerText)}
                        className="outline-none border border-transparent hover:border-dashed hover:border-gray-400/50 rounded px-1 flex-1"
                      >{item}</span>
                   </li>
                  ))}
                </ul>
              </div>
              <div>
                 <ul className="space-y-4 text-lg">
                  {slide.columnRight?.map((item, idx) => (
                     <li key={idx} className="flex items-start">
                     <span className={`mr-3 mt-1.5 h-2 w-2 rounded-full flex-shrink-0 ${backgroundImage ? 'bg-white' : (theme === 'light' || theme === 'modern' ? 'bg-indigo-600' : 'bg-indigo-400')}`}></span>
                     <span 
                        contentEditable={!!onEdit}
                        suppressContentEditableWarning
                        onBlur={(e) => handleArrayUpdate('columnRight', idx, e.currentTarget.innerText)}
                        className="outline-none border border-transparent hover:border-dashed hover:border-gray-400/50 rounded px-1 flex-1"
                      >{item}</span>
                   </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        );

      case SlideLayout.QUOTE:
        return (
          <div className="flex flex-col items-center justify-center h-full px-20 text-center relative z-10">
            <Quote className={`w-12 h-12 mb-6 opacity-50 ${getAccentColor()}`} />
            <blockquote 
               {...editableProps('quote')}
              className={`text-3xl font-serif italic mb-8 leading-relaxed ${editableProps('quote').className}`}
            >
              "{slide.quote}"
            </blockquote>
            <cite className="text-xl font-semibold not-italic flex items-center gap-2">
              — 
              <span
                {...editableProps('author')}
                className={editableProps('author').className}
              >{slide.author}</span>
            </cite>
          </div>
        );
      
      case SlideLayout.BIG_NUMBER:
        return (
          <div className="flex flex-col items-center justify-center h-full px-12 text-center relative z-10">
             <h2 
              {...editableProps('title')}
              className={`text-3xl font-bold mb-12 opacity-80 ${editableProps('title').className}`}
            >{slide.title}</h2>
            <div 
               {...editableProps('statistic')}
               className={`text-8xl font-black mb-6 ${getAccentColor()} ${editableProps('statistic').className}`}
            >
              {slide.statistic}
            </div>
            <p 
               {...editableProps('description')}
               className={`text-2xl max-w-2xl leading-relaxed opacity-90 ${editableProps('description').className}`}
            >
              {slide.description}
            </p>
          </div>
        );

      case SlideLayout.CODE:
        // Calculate lines to decide layout
        const lineCount = slide.code ? slide.code.split('\n').length : 0;
        const isSplit = lineCount >= 6; // If 6 or more lines, split view. Else stacked.

        return (
          <div className="flex flex-col h-full px-12 py-8 relative z-10">
            <h2 
              {...editableProps('title')}
              className={`text-3xl font-bold mb-6 ${getAccentColor()} ${editableProps('title').className}`}
            >{slide.title}</h2>
            
            <div className={`flex flex-1 min-h-0 gap-8 ${isSplit ? 'flex-row' : 'flex-col'}`}>
               {/* Code Window */}
               <div className={`flex flex-col rounded-lg shadow-xl overflow-hidden border border-gray-700/50 bg-[#1e1e1e] ${isSplit ? 'w-1/2 h-full' : 'w-full h-auto max-h-[60%]'}`}>
                  {/* Window Header */}
                  <div className="flex items-center px-4 py-3 bg-[#252526] border-b border-black/20 gap-2 shrink-0">
                    <div className="flex gap-1.5">
                      <div className="w-3 h-3 rounded-full bg-[#ff5f56] border border-[#e0443e]"></div>
                      <div className="w-3 h-3 rounded-full bg-[#ffbd2e] border border-[#dea123]"></div>
                      <div className="w-3 h-3 rounded-full bg-[#27c93f] border border-[#1aab29]"></div>
                    </div>
                    <div className="ml-4 text-xs text-gray-400 font-mono flex-1 text-center pr-12 opacity-60">
                      {slide.language ? `${slide.language.toLowerCase()}` : 'terminal'}
                    </div>
                  </div>
                  
                  {/* Code Content */}
                  <div className="flex-1 overflow-auto bg-[#1e1e1e] p-6 text-left">
                    <pre className="font-mono text-sm leading-relaxed text-[#d4d4d4]">
                        <code 
                          contentEditable={!!onEdit}
                          suppressContentEditableWarning
                          onBlur={(e) => handleUpdate('code', e.currentTarget.innerText)}
                          className="outline-none block w-full h-full whitespace-pre font-['Fira_Code','Consolas','Monaco','monospace']"
                          style={{ tabSize: 2 }}
                        >
                          {slide.code}
                        </code>
                    </pre>
                  </div>
               </div>

               {/* Description Area */}
               {slide.description && (
                  <div className={`${isSplit ? 'w-1/2 flex flex-col justify-center' : 'w-full flex-1 overflow-auto'}`}>
                    <div className="prose prose-lg dark:prose-invert max-w-none">
                       <p 
                        {...editableProps('description')}
                        className={`text-xl leading-relaxed opacity-90 whitespace-pre-wrap ${editableProps('description').className}`}
                      >
                        {slide.description}
                      </p>
                    </div>
                  </div>
               )}
            </div>
          </div>
        );

      case SlideLayout.IMAGE_TEXT:
          return (
            <div className="flex flex-col h-full px-12 py-10 relative z-10">
               <h2 
                {...editableProps('title')}
                className={`text-4xl font-bold mb-8 ${getAccentColor()} ${editableProps('title').className}`}
              >{slide.title}</h2>
              <div className="flex flex-1 gap-8 items-center">
                 {/* Text Side */}
                 <div className="w-1/2 flex flex-col gap-4">
                     <ul className="space-y-4 text-xl flex-1">
                      {slide.bullets?.map((bullet, idx) => (
                        <li key={idx} className="flex items-start">
                          <span className={`mr-3 mt-1.5 h-2 w-2 rounded-full flex-shrink-0 ${backgroundImage ? 'bg-white' : (theme === 'light' || theme === 'modern' ? 'bg-indigo-600' : 'bg-indigo-400')}`}></span>
                          <span 
                            contentEditable={!!onEdit}
                            suppressContentEditableWarning
                            onBlur={(e) => handleArrayUpdate('bullets', idx, e.currentTarget.innerText)}
                            className="outline-none border border-transparent hover:border-dashed hover:border-gray-400/50 rounded px-1 flex-1"
                          >{bullet}</span>
                        </li>
                      ))}
                    </ul>
                 </div>
                 
                 {/* Image Side */}
                 <div className="w-1/2 h-full rounded-xl overflow-hidden shadow-lg bg-gray-100 flex items-center justify-center relative group">
                    {slide.imageUrl ? (
                      <img src={slide.imageUrl} alt="Generated illustration" className="w-full h-full object-cover" />
                    ) : (
                      <div className="flex flex-col items-center text-gray-400 p-8 text-center">
                         <ImageIcon className="w-12 h-12 mb-2 opacity-50"/>
                         <p className="text-sm">Image generating...</p>
                         {slide.imagePrompt && <p className="text-xs mt-2 opacity-50 italic">"{slide.imagePrompt}"</p>}
                      </div>
                    )}
                 </div>
              </div>
            </div>
          );

      default:
        return <div>Unknown Layout</div>;
    }
  };

  return (
    <div 
      ref={ref}
      className={`w-full h-full relative overflow-hidden shadow-2xl ${getThemeColors()}`}
      style={{ 
        aspectRatio: '16/9',
        transform: scale !== 1 ? `scale(${scale})` : undefined,
        transformOrigin: 'top left'
      }}
    >
       {/* Global Background Image */}
       {backgroundImage && (
         <>
            <img src={backgroundImage} alt="Background" className="absolute inset-0 w-full h-full object-cover" />
            <div className="absolute inset-0 bg-black/40 backdrop-blur-[1px]"></div>
         </>
       )}

      {/* Abstract Background Elements (Only if no BG image) */}
      {!backgroundImage && (
        <>
          <div className="absolute top-0 right-0 w-64 h-64 bg-current opacity-[0.03] rounded-bl-full pointer-events-none transform translate-x-1/2 -translate-y-1/2"></div>
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-current opacity-[0.03] rounded-tr-full pointer-events-none transform -translate-x-1/3 translate-y-1/3"></div>
        </>
      )}
      
      {renderContent()}
    </div>
  );
});

SlideCanvas.displayName = 'SlideCanvas';

export default SlideCanvas;
