import React, { createContext, useContext, useState, ReactNode, useCallback } from 'react';
import { Icon } from '../components/Icon';

type DialogType = 'alert' | 'confirm' | 'prompt';

interface DialogOptions {
  title?: string;
  message: string;
  type?: DialogType;
  promptDefault?: string;
  confirmText?: string;
  cancelText?: string;
}

interface DialogContextType {
  showDialog: (options: DialogOptions) => Promise<string | boolean | null>;
}

const DialogContext = createContext<DialogContextType | undefined>(undefined);

export const DialogProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [options, setOptions] = useState<DialogOptions | null>(null);
  const [promptValue, setPromptValue] = useState('');
  
  // Resolve function to be called when the dialog closes
  const [resolveFn, setResolveFn] = useState<(value: string | boolean | null) => void>(() => () => {});

  const showDialog = useCallback((opts: DialogOptions) => {
    return new Promise<string | boolean | null>((resolve) => {
      setOptions({
        type: 'alert',
        confirmText: 'OK',
        cancelText: 'Cancelar',
        title: opts.type === 'confirm' ? 'Confirmação' : opts.type === 'prompt' ? 'Ação Necessária' : 'Aviso',
        ...opts
      });
      setPromptValue(opts.promptDefault || '');
      setResolveFn(() => resolve);
      setIsOpen(true);
    });
  }, []);

  const handleClose = (value: string | boolean | null) => {
    setIsOpen(false);
    resolveFn(value);
  };

  return (
    <DialogContext.Provider value={{ showDialog }}>
      {children}
      {isOpen && options && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl p-6 sm:p-8 max-w-sm w-full shadow-2xl transform transition-all scale-100 animate-slide-up">
            
            <div className="flex items-center gap-3 mb-4">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${options.type === 'alert' ? 'bg-orange-100 text-orange-600' : options.type === 'confirm' ? 'bg-blue-100 text-blue-600' : 'bg-green-100 text-green-600'`}`}>
                 <Icon name={options.type === 'alert' ? 'warning' : options.type === 'confirm' ? 'help_outline' : 'edit'} />
              </div>
              <h3 className="text-lg font-extrabold text-slate-900">{options.title}</h3>
            </div>
            
            <p className="text-slate-600 font-medium mb-6 text-sm">{options.message}</p>

            {options.type === 'prompt' && (
              <input 
                type="text" 
                className="w-full border border-slate-300 rounded-lg px-4 py-2 mb-6 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none text-slate-800"
                value={promptValue}
                onChange={(e) => setPromptValue(e.target.value)}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleClose(promptValue);
                  if (e.key === 'Escape') handleClose(null);
                }}
              />
            )}

            <div className="flex justify-end gap-3 mt-2">
              {options.type !== 'alert' && (
                <button 
                  onClick={() => handleClose(options.type === 'prompt' ? null : false)}
                  className="px-4 py-2 rounded-lg font-bold text-slate-600 hover:bg-slate-100 transition-colors"
                >
                  {options.cancelText}
                </button>
              )}
              <button 
                onClick={() => handleClose(options.type === 'prompt' ? promptValue : true)}
                className={`px-5 py-2 rounded-lg font-bold text-white shadow-md transition-all active:scale-95 ${options.type === 'alert' ? 'bg-orange-500 hover:bg-orange-600 w-full' : 'bg-blue-600 hover:bg-blue-700'`}`}
              >
                {options.confirmText}
              </button>
            </div>

          </div>
        </div>
      )}
    </DialogContext.Provider>
  );
};

export const useDialog = () => {
  const context = useContext(DialogContext);
  if (!context) {
    throw new Error('useDialog must be used within a DialogProvider');
  }
  return context;
};
