import React from 'react';
import { motion } from 'motion/react';
import {
  Dumbbell, Apple, PersonStanding, Shirt, Mic, MessageSquare, ChevronRight,
} from 'lucide-react';

export type CoachToolId = 'physique' | 'food' | 'posture' | 'outfit' | 'voice' | 'chat';

export interface CoachTool {
  id: CoachToolId;
  name: string;
  blurb: string;
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  accent: string;
  /** What the tool needs. Stated up front rather than sprung as a prompt. */
  needs?: 'camera' | 'microphone';
}

export const COACH_TOOLS: CoachTool[] = [
  {
    id: 'chat',
    name: 'Chat with Coach',
    blurb: 'Ask anything. It knows your tasks, habits, routine and goals.',
    icon: MessageSquare,
    accent: '#7C5CFF',
  },
  {
    id: 'food',
    name: 'Food scanner',
    blurb: 'Photograph a meal for a rough breakdown and one way to balance it.',
    icon: Apple,
    accent: '#00C2A8',
    needs: 'camera',
  },
  {
    id: 'posture',
    name: 'Posture check',
    blurb: 'A side-on photo, and what to stretch or strengthen.',
    icon: PersonStanding,
    accent: '#7FD4E8',
    needs: 'camera',
  },
  {
    id: 'physique',
    name: 'Training check',
    blurb: 'Feedback on what your training is building and what to add next.',
    icon: Dumbbell,
    accent: '#FFB020',
    needs: 'camera',
  },
  {
    id: 'outfit',
    name: 'Outfit feedback',
    blurb: 'What works, and two things that would work better.',
    icon: Shirt,
    accent: '#E8A0C8',
    needs: 'camera',
  },
  {
    id: 'voice',
    name: 'Voice coach',
    blurb: 'Speak on a prompt and get feedback on how you said it.',
    icon: Mic,
    accent: '#A78BFA',
    needs: 'microphone',
  },
];

interface Props {
  onOpen: (id: CoachToolId) => void;
}

/**
 * Coach home.
 *
 * One row per tool: icon, name, what it does, and what it needs. Naming the
 * permission here rather than springing a browser prompt later is the
 * difference between a tool and an ambush.
 */
export const CoachTools: React.FC<Props> = ({ onOpen }) => (
  <div className="space-y-2">
    {COACH_TOOLS.map((tool, i) => {
      const Icon = tool.icon;

      return (
        <motion.button
          key={tool.id}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.24, delay: Math.min(i * 0.04, 0.2) }}
          onClick={() => onOpen(tool.id)}
          className="w-full text-left rounded-2xl p-4 flex items-center gap-4 transition-transform active:scale-[0.99]"
          style={{ background: 'var(--surface)', border: '1px solid var(--rule)' }}
        >
          <span
            className="w-11 h-11 rounded-xl shrink-0 flex items-center justify-center"
            style={{ background: `color-mix(in oklab, ${tool.accent} 16%, transparent)` }}
          >
            <Icon className="w-5 h-5 shrink-0" style={{ color: tool.accent }} />
          </span>

          <span className="min-w-0 flex-1">
            <span className="t-section block">{tool.name}</span>
            <span className="t-sub block mt-0.5 leading-snug">{tool.blurb}</span>
            {tool.needs && <span className="t-meta block mt-1.5">Uses your {tool.needs}</span>}
          </span>

          <ChevronRight className="w-5 h-5 shrink-0" style={{ color: 'var(--ink-dim)' }} />
        </motion.button>
      );
    })}
  </div>
);
