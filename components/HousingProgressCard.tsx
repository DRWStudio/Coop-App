'use client';

import { formatKoboToNaira } from '@/types/database';
import { ContributeModal } from '@/components/ContributeModal';
import type { VirtualAccount } from '@/types/database';

interface Props {
  housingContributedKobo: number;
  targetGoalKobo?: number;
  planFrequency?: 'daily' | 'monthly';
  installmentAmountKobo?: number;
  virtualAccount: VirtualAccount | null;
}

export function HousingProgressCard({
  housingContributedKobo,
  targetGoalKobo = 500000000, // ₦5,000,000
  planFrequency = 'monthly',
  installmentAmountKobo = 5000000, // ₦50,000/mo
  virtualAccount,
}: Props) {
  const percentage = Math.min(
    100,
    Math.round((housingContributedKobo / targetGoalKobo) * 100)
  );

  const remainingKobo = Math.max(0, targetGoalKobo - housingContributedKobo);

  return (
    <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-sm relative overflow-hidden space-y-6">
      {/* Top Header & Badges */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-700 flex items-center justify-center font-bold text-2xl shadow-xs">
            🏡
          </div>
          <div>
            <h3 className="font-extrabold text-slate-900 text-lg sm:text-xl">
              Cooperative Housing Scheme
            </h3>
            <p className="text-xs text-slate-500">
              Targeted property & estate acquisition project
            </p>
          </div>
        </div>

        {/* Action Button: Contribute to Housing */}
        <div className="flex items-center gap-2">
          <ContributeModal
            virtualAccount={virtualAccount}
            defaultService="housing"
            buttonLabel="Contribute to Housing"
            buttonClassName="bg-amber-600 hover:bg-amber-700 text-white text-xs sm:text-sm font-bold px-4 py-2.5 rounded-xl shadow-md transition active:scale-95 cursor-pointer flex items-center gap-2"
          />
        </div>
      </div>

      {/* Numerical Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2">
        <div className="bg-slate-50 border border-slate-100 p-4 rounded-2xl">
          <span className="text-xs text-slate-400 block uppercase font-medium">
            Total Contributed
          </span>
          <span className="text-lg sm:text-xl font-extrabold text-slate-900 mt-1 block">
            {formatKoboToNaira(housingContributedKobo)}
          </span>
        </div>

        <div className="bg-slate-50 border border-slate-100 p-4 rounded-2xl">
          <span className="text-xs text-slate-400 block uppercase font-medium">
            Target Goal
          </span>
          <span className="text-lg sm:text-xl font-bold text-slate-600 mt-1 block">
            {formatKoboToNaira(targetGoalKobo)}
          </span>
        </div>

        <div className="bg-slate-50 border border-slate-100 p-4 rounded-2xl">
          <span className="text-xs text-slate-400 block uppercase font-medium">
            Remaining Target
          </span>
          <span className="text-lg sm:text-xl font-bold text-amber-600 mt-1 block">
            {formatKoboToNaira(remainingKobo)}
          </span>
        </div>

        <div className="bg-slate-50 border border-slate-100 p-4 rounded-2xl">
          <span className="text-xs text-slate-400 block uppercase font-medium">
            Plan Type
          </span>
          <span className="text-sm font-bold text-slate-700 capitalize mt-1 block">
            {planFrequency} ({formatKoboToNaira(installmentAmountKobo)})
          </span>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold text-slate-700">Project Goal Progress</span>
          <span className="font-extrabold text-emerald-700">{percentage}% Achieved</span>
        </div>

        <div className="w-full bg-slate-100 rounded-full h-4 overflow-hidden p-0.5 border border-slate-200">
          <div
            className="bg-gradient-to-r from-amber-500 via-emerald-500 to-teal-500 h-full rounded-full transition-all duration-700 ease-out shadow-xs"
            style={{ width: `${Math.max(percentage, 2)}%` }}
          />
        </div>
      </div>

      {/* Non-Refundable Advisory Notice */}
      <div className="p-3.5 bg-amber-50/80 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-start gap-2.5 leading-relaxed">
        <span className="text-base leading-none">⚠️</span>
        <div>
          <strong className="font-semibold">Important Non-Refundable Policy:</strong> Contributions made to this housing project are earmarked for land acquisition, architectural development, and building construction. They are <strong>strictly non-refundable</strong> and cannot be withdrawn. Only voluntary savings qualify for the 3-month withdrawal cycle.
        </div>
      </div>
    </div>
  );
}