import React, { useState } from 'react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { UserProfile, ModuleId, DailyLog } from '../types';

interface Props {
  profile: UserProfile;
}

type MetricMode = 'composite' | 'digit-span' | 'stroop' | 'n-back' | 'stillness';

export const CognitiveChart: React.FC<Props> = ({ profile }) => {
  const [metric, setMetric] = useState<MetricMode>('composite');

  // Prepare chart data for all 30 days
  const dailyLogsList = Object.values(profile.dailyLogs) as DailyLog[];
  const chartData = dailyLogsList.map((log: DailyLog) => {
    const day = log.dayNumber;
    let val = log.cognitiveScore;

    if (metric !== 'composite') {
      const mId = metric as ModuleId;
      // Find latest level up to this day
      const historyUpToDay = profile.modules[mId]?.history?.slice(0, day) || [];
      val = historyUpToDay.length > 0 ? historyUpToDay[historyUpToDay.length - 1].level : 1;
    }

    return {
      day: `Day ${day}`,
      dayNum: day,
      score: val > 0 ? val : null,
      completed: log.status === 'completed',
      status: log.status,
    };
  });

  const activePoints = chartData.filter((d) => d.score !== null);
  const currentScore = activePoints.length > 0 ? activePoints[activePoints.length - 1].score : 500;
  const initialScore = activePoints.length > 0 ? activePoints[0].score : 500;
  const growthPct = currentScore && initialScore ? Math.round(((currentScore - initialScore) / initialScore) * 100) : 0;

  return (
    <div className="bg-[#171B22] border border-[#2A313C] rounded-2xl p-5 md:p-6 shadow-xl">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-[#5C6CF2]"></span>
            <h3 className="text-lg font-bold text-[#F4F6F8]">30-Day Cognitive Growth Matrix</h3>
          </div>
          <p className="text-xs text-[#98A2B3] mt-1">
            Tracking neuro-adaptive progress across all 30 protocol days
          </p>
        </div>

        {/* Metric Selector Pills */}
        <div className="flex flex-wrap items-center gap-1.5 bg-[#0E1116] p-1.5 rounded-xl border border-[#2A313C]">
          <button
            onClick={() => setMetric('composite')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              metric === 'composite'
                ? 'bg-[#5C6CF2]/20 text-[#5C6CF2] border border-[#5C6CF2]/40 shadow-sm'
                : 'text-[#98A2B3] hover:text-[#F4F6F8]'
            }`}
          >
            Brain Score
          </button>
          <button
            onClick={() => setMetric('digit-span')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              metric === 'digit-span'
                ? 'bg-[#5C6CF2]/20 text-[#5C6CF2] border border-[#5C6CF2]/40'
                : 'text-[#98A2B3] hover:text-[#F4F6F8]'
            }`}
          >
            Memory
          </button>
          <button
            onClick={() => setMetric('stroop')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              metric === 'stroop'
                ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40'
                : 'text-[#98A2B3] hover:text-[#F4F6F8]'
            }`}
          >
            Focus
          </button>
          <button
            onClick={() => setMetric('n-back')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              metric === 'n-back'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                : 'text-[#98A2B3] hover:text-[#F4F6F8]'
            }`}
          >
            Fluid IQ
          </button>
          <button
            onClick={() => setMetric('stillness')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              metric === 'stillness'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                : 'text-[#98A2B3] hover:text-[#F4F6F8]'
            }`}
          >
            Stillness
          </button>
        </div>
      </div>

      {/* Top Stat Highlights */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="bg-[#0E1116] border border-[#2A313C] rounded-xl p-3">
          <span className="text-[10px] uppercase tracking-wider text-[#98A2B3] font-medium">Current Rating</span>
          <div className="text-lg md:text-xl font-black text-[#5C6CF2] mt-0.5">
            {metric === 'composite' ? currentScore : `Lvl ${currentScore}`}
          </div>
        </div>
        <div className="bg-[#0E1116] border border-[#2A313C] rounded-xl p-3">
          <span className="text-[10px] uppercase tracking-wider text-[#98A2B3] font-medium">Growth Rate</span>
          <div className="text-lg md:text-xl font-black text-emerald-400 mt-0.5">
            +{growthPct}%
          </div>
        </div>
        <div className="bg-[#0E1116] border border-[#2A313C] rounded-xl p-3">
          <span className="text-[10px] uppercase tracking-wider text-[#98A2B3] font-medium">Protocol Day</span>
          <div className="text-lg md:text-xl font-black text-[#F4F6F8] mt-0.5">
            {profile.currentDay} <span className="text-xs font-normal text-[#98A2B3]">/ 30</span>
          </div>
        </div>
      </div>

      {/* Chart Canvas */}
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="indigoGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#5C6CF2" stopOpacity={0.35} />
                <stop offset="95%" stopColor="#5C6CF2" stopOpacity={0.0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#2A313C" vertical={false} />
            <XAxis
              dataKey="day"
              stroke="#98A2B3"
              fontSize={11}
              tickLine={false}
              interval={4}
              tickFormatter={(value) => value.replace('Day ', 'D')}
            />
            <YAxis
              stroke="#98A2B3"
              fontSize={11}
              tickLine={false}
              domain={metric === 'composite' ? [400, 'dataMax + 100'] : [0, 'dataMax + 2']}
            />
            <Tooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const data = payload[0].payload;
                  return (
                    <div className="bg-[#0E1116] border border-[#5C6CF2]/40 p-3 rounded-xl shadow-2xl backdrop-blur-lg text-xs">
                      <p className="font-bold text-[#F4F6F8]">{data.day}</p>
                      <p className="text-[#5C6CF2] font-semibold mt-1">
                        {metric === 'composite' ? `Brain Score: ${data.score || 'Unplayed'}` : `Level: ${data.score || '1'}`}
                      </p>
                      <span className="inline-block mt-1 text-[10px] px-2 py-0.5 rounded-full capitalize bg-[#171B22] text-[#98A2B3]">
                        Status: {data.status}
                      </span>
                    </div>
                  );
                }
                return null;
              }}
            />
            <Area
              type="monotone"
              dataKey="score"
              stroke="#5C6CF2"
              strokeWidth={3}
              fillOpacity={1}
              fill="url(#indigoGradient)"
              connectNulls
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
