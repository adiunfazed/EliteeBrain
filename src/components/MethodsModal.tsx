import React from 'react';
import { Eyebrow } from './ui/Eyebrow';
import { Button } from './ui/Button';
import { X, CheckCircle2, AlertTriangle, BookOpen } from 'lucide-react';

interface MethodsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const MethodsModal: React.FC<MethodsModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/30 backdrop-blur-xs select-none animate-fadeIn">
      <div className="bg-surface border border-rule rounded-[2px] w-full max-w-2xl max-h-[90vh] flex flex-col shadow-[0_24px_60px_-20px_rgba(20,23,26,0.28)]">
        {/* Header */}
        <div className="flex items-center justify-between p-4 md:p-6 border-b border-rule bg-surface-sunk">
          <div>
            <Eyebrow>PSYCHOMETRIC BATTERY METHODOLOGY</Eyebrow>
            <h2 className="text-lg md:text-xl font-display font-extrabold text-ink">
              Scientific Foundation & Transfer Limits
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-surface border border-rule rounded-[2px] text-ink-muted hover:text-ink cursor-pointer"
          >
            <X className="w-5 h-5 shrink-0" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 md:p-6 overflow-y-auto space-y-6 text-xs md:text-sm text-ink leading-relaxed font-sans">
          {/* Honest Statement */}
          <div className="p-4 bg-surface-sunk border border-rule rounded-[2px] space-y-2">
            <div className="flex items-center gap-2 font-mono font-bold text-ink">
              <BookOpen className="w-4 h-4 shrink-0 text-signal" />
              <span>TRANSPARENCY STATEMENT ON COGNITIVE TRAINING</span>
            </div>
            <p className="text-ink-muted">
              EliteLife implements peer-reviewed cognitive paradigms designed to measure and stress specific sub-components of executive function. We state plainly what training accomplishes and what remains unproven by scientific consensus.
            </p>
          </div>

          {/* Established Transfer Effects */}
          <div className="space-y-3">
            <h3 className="font-mono font-bold text-xs uppercase text-ink flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
              <span>What Is Scientifically Established</span>
            </h3>
            <ul className="space-y-2 pl-4 list-disc text-ink-muted">
              <li>
                <strong className="text-ink">Near-Transfer Mastery:</strong> Consistent practice on working memory (Digit Span) and N-back batteries reliably increases task-specific capacity and reduces cognitive latency.
              </li>
              <li>
                <strong className="text-ink">Inhibitory Control:</strong> Stroop color-word interference and Go/No-Go paradigms actively stress the prefrontal cortex, enhancing response inhibition under pressure.
              </li>
              <li>
                <strong className="text-ink">Cognitive Flexibility:</strong> Set-shifting tasks improve attentional switching speed and reduce rule-transition latency.
              </li>
            </ul>
          </div>

          {/* Limits & Non-Claims */}
          <div className="space-y-3">
            <h3 className="font-mono font-bold text-xs uppercase text-ink flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600" />
              <span>What Is NOT Claimed Or Proven</span>
            </h3>
            <ul className="space-y-2 pl-4 list-disc text-ink-muted">
              <li>
                <strong className="text-ink">No General IQ Guarantee:</strong> Brain training does not magically increase general intelligence (g-factor). It trains specific neural subroutines.
              </li>
              <li>
                <strong className="text-ink">No Clinical Medical Claims:</strong> EliteLife is a measurement and training instrument for healthy cognitive optimization, not a medical treatment for ADHD, dementia, or neurological disease.
              </li>
            </ul>
          </div>

          {/* Paradigm Reference Table */}
          <div className="space-y-3">
            <h3 className="font-mono font-bold text-xs uppercase text-ink">
              Paradigm Citations
            </h3>
            <div className="border border-rule rounded-[2px] overflow-hidden font-mono text-[11px]">
              <div className="grid grid-cols-3 bg-surface-sunk p-2 font-bold border-b border-rule">
                <div>Module</div>
                <div>Cognitive Paradigm</div>
                <div>Primary Reference</div>
              </div>
              <div className="divide-y divide-rule">
                <div className="grid grid-cols-3 p-2">
                  <div className="font-bold">Working Memory</div>
                  <div>Digit Span / Corsi Block</div>
                  <div>Miller (1956), Wechsler (1981)</div>
                </div>
                <div className="grid grid-cols-3 p-2">
                  <div className="font-bold">Attention Control</div>
                  <div>Stroop Color-Word Test</div>
                  <div>Stroop (1935), MacLeod (1991)</div>
                </div>
                <div className="grid grid-cols-3 p-2">
                  <div className="font-bold">Pattern Reasoning</div>
                  <div>Dual / Spatial N-Back</div>
                  <div>Jaeggi et al. (2008), Kirchner (1958)</div>
                </div>
                <div className="grid grid-cols-3 p-2">
                  <div className="font-bold">Response Inhibition</div>
                  <div>Go / No-Go Motor Inhibition</div>
                  <div>Donders (1969), Verbruggen (2008)</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-rule bg-surface-sunk flex justify-end">
          <Button variant="secondary" onClick={onClose}>
            Acknowledge & Close
          </Button>
        </div>
      </div>
    </div>
  );
};
