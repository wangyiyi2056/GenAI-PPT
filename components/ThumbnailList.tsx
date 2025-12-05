
import React from 'react';
import { SlideContent } from '../types';
import { Layout, Image as ImageIcon } from 'lucide-react';

interface Props {
  slides: SlideContent[];
  currentIndex: number;
  onSelect: (index: number) => void;
}

const ThumbnailList: React.FC<Props> = ({ slides, currentIndex, onSelect }) => {
  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-white border-r border-gray-200">
      {slides.map((slide, index) => (
        <div 
          key={slide.id}
          onClick={() => onSelect(index)}
          className={`cursor-pointer group relative flex flex-col gap-2 p-2 rounded-lg transition-all ${
            index === currentIndex 
              ? 'bg-indigo-50 ring-2 ring-indigo-500' 
              : 'hover:bg-gray-50 border border-gray-200'
          }`}
        >
          <div className="flex items-center justify-between text-xs text-gray-500 px-1">
            <span className="font-bold">#{index + 1}</span>
            <span className="uppercase tracking-wider text-[10px]">{slide.layout.replace('_', ' ')}</span>
          </div>
          
          <div className="aspect-video w-full bg-white border border-gray-100 rounded flex items-center justify-center overflow-hidden relative">
            {/* Simple mini-preview using text */}
             <div className="p-2 text-[6px] w-full h-full overflow-hidden leading-tight text-gray-400 select-none">
                <div className="font-bold text-gray-800 mb-1 truncate">{slide.title}</div>
                {slide.bullets && slide.bullets.slice(0,3).map((b, i) => <div key={i} className="truncate">• {b}</div>)}
                {slide.quote && <div className="italic text-center mt-2">"{slide.quote.substring(0,20)}..."</div>}
                
                {slide.code && (
                  <div className="mt-1 bg-gray-800 text-gray-300 p-1 rounded font-mono text-[4px] opacity-75">
                    {slide.code.slice(0, 50)}...
                  </div>
                )}

                {slide.imageUrl && (
                  <div className="mt-1 w-full h-10 bg-gray-100 rounded overflow-hidden">
                    <img src={slide.imageUrl} className="w-full h-full object-cover opacity-80" />
                  </div>
                )}
             </div>
          </div>
        </div>
      ))}
      {slides.length === 0 && (
         <div className="text-center text-gray-400 mt-10 text-sm">
            No slides yet.
         </div>
      )}
    </div>
  );
};

export default ThumbnailList;
