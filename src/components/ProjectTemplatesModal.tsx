import React from 'react';
import { X, Sparkles, Activity, Bot, Smartphone, Gamepad2, ArrowRight, Layers } from 'lucide-react';
import { PROJECT_TEMPLATES } from '../templates';
import { ProjectTemplate } from '../types';

interface ProjectTemplatesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectTemplate: (template: ProjectTemplate) => void;
}

export const ProjectTemplatesModal: React.FC<ProjectTemplatesModalProps> = ({
  isOpen,
  onClose,
  onSelectTemplate,
}) => {
  if (!isOpen) return null;

  const iconMap: Record<string, React.ReactNode> = {
    Activity: <Activity className="w-6 h-6 text-indigo-400" />,
    Bot: <Bot className="w-6 h-6 text-purple-400" />,
    Smartphone: <Smartphone className="w-6 h-6 text-emerald-400" />,
    Gamepad2: <Gamepad2 className="w-6 h-6 text-pink-400" />,
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="w-full max-w-3xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Starter Blueprints & Templates</h2>
              <p className="text-xs text-slate-400">Jumpstart your project with production-grade architectures</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Grid of Templates */}
        <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          {PROJECT_TEMPLATES.map((tmpl) => (
            <div
              key={tmpl.id}
              onClick={() => {
                onSelectTemplate(tmpl);
                onClose();
              }}
              className="p-5 rounded-2xl bg-slate-950/80 border border-slate-800/90 hover:border-indigo-500/50 hover:bg-slate-950 transition-all cursor-pointer group flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between mb-3">
                  <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                    {iconMap[tmpl.icon] || <Sparkles className="w-6 h-6 text-indigo-400" />}
                  </div>
                  {tmpl.badge && (
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                      {tmpl.badge}
                    </span>
                  )}
                </div>

                <h3 className="text-sm font-bold text-white group-hover:text-indigo-300 transition-colors">
                  {tmpl.title}
                </h3>
                <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                  {tmpl.description}
                </p>
              </div>

              <div className="mt-5 pt-3 border-t border-slate-850 flex items-center justify-between text-xs text-slate-500 font-medium">
                <span>{tmpl.category}</span>
                <span className="flex items-center gap-1 text-indigo-400 group-hover:translate-x-1 transition-transform">
                  Load Template <ArrowRight className="w-3.5 h-3.5" />
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
