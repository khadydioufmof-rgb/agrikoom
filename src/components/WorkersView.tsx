import React, { useMemo, useState } from 'react';
import { Check, CheckCircle2, Plus, UserCheck } from 'lucide-react';
import { formatFcfa } from '../i18n/translations';
import type {
  AttendanceRecord,
  AttendanceStatus,
  ContractType,
  PayBasis,
  UserRole,
  Worker,
} from '../types/agrikoom';

interface WorkersViewProps {
  role: UserRole;
  workers: Worker[];
  attendance: AttendanceRecord[];
  onCreateWorker: (input: {
    fullName: string;
    phone: string;
    contractType: ContractType;
    payBasis: PayBasis;
    rateFcfa: number;
  }) => Promise<void>;
  onMarkAttendance: (params: {
    worker: Worker;
    workDate: string;
    status: AttendanceStatus;
    unitsCompleted: number;
    advanceGivenFcfa: number;
  }) => Promise<void>;
  onSettlePayroll: (worker: Worker, unpaidRecords: AttendanceRecord[]) => Promise<void>;
}

export const WorkersView: React.FC<WorkersViewProps> = ({
  role,
  workers,
  attendance,
  onCreateWorker,
  onMarkAttendance,
  onSettlePayroll,
}) => {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10));
  const [showAddWorker, setShowAddWorker] = useState(false);
  const [taskUnitsMap, setTaskUnitsMap] = useState<Record<string, number>>({});
  const [advanceInputMap, setAdvanceInputMap] = useState<Record<string, number>>({});
  const [signedWorkerId, setSignedWorkerId] = useState<string | null>(null);

  // New worker state
  const [wName, setWName] = useState('');
  const [wPhone, setWPhone] = useState('+221 77 ');
  const [wContract, setWContract] = useState<ContractType>('journalier');
  const [wBasis, setWBasis] = useState<PayBasis>('jour');
  const [wRate, setWRate] = useState('4000');

  const payrollSummaries = useMemo(() => {
    return workers.map((w) => {
      const workerLogs = attendance.filter((a) => a.workerId === w.id && !a.paidOut);
      const grossEarned = workerLogs.reduce((s, a) => s + a.earnedFcfa, 0);
      const advances = w.advancesFcfa + workerLogs.reduce((s, a) => s + a.advanceGivenFcfa, 0);
      const netToPay = Math.max(0, grossEarned - advances);
      const todayRecord = attendance.find((a) => a.workerId === w.id && a.workDate === selectedDate);
      return {
        worker: w,
        unpaidRecords: workerLogs,
        grossEarned,
        advances,
        netToPay,
        todayRecord,
      };
    });
  }, [workers, attendance, selectedDate]);

  const totalNetPayroll = payrollSummaries.reduce((s, x) => s + x.netToPay, 0);

  const handleAddWorker = async (e: React.FormEvent) => {
    e.preventDefault();
    await onCreateWorker({
      fullName: wName.trim(),
      phone: wPhone.trim(),
      contractType: wContract,
      payBasis: wBasis,
      rateFcfa: Math.max(0, Number(wRate || 0)),
    });
    setShowAddWorker(false);
    setWName('');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-[#1E293B]">Main-d&apos;Œuvre &amp; Paie des Ouvriers</h1>
          <p className="text-xs text-slate-500">
            Pointage quotidien simplifié, suivi des acomptes et journal de paie avec émargement numérique
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-mono-num min-h-[48px]"
          />
          {role !== 'pointer' && (
            <button
              type="button"
              onClick={() => setShowAddWorker(true)}
              className="inline-flex items-center gap-2 rounded-xl bg-[#2E7D32] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#256428] min-h-[48px] whitespace-nowrap shrink-0"
            >
              <Plus className="h-4 w-4" />
              <span>Ajouter un ouvrier</span>
            </button>
          )}
        </div>
      </div>

      {/* Payroll Net Summary Bar */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-medium text-slate-500">Net à payer cumulé (période en cours non soldée)</span>
          <p className="mt-1 font-mono-num text-2xl font-bold text-[#1E293B]">{formatFcfa(totalNetPayroll)}</p>
        </div>
        <div className="text-xs text-slate-500">
          {workers.length} ouvriers actifs · Date de pointage : <span className="font-mono-num font-semibold text-[#1E293B]">{selectedDate}</span>
        </div>
      </div>

      {/* Workers Pointage & Payroll Cards */}
      <div className="space-y-4">
        {payrollSummaries.map(({ worker, unpaidRecords, grossEarned, advances, netToPay, todayRecord }) => {
          const units = taskUnitsMap[worker.id] ?? 10;
          const adv = advanceInputMap[worker.id] ?? 0;

          return (
            <div key={worker.id} className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2.5">
                    <h3 className="font-display text-base font-bold text-[#1E293B]">{worker.fullName}</h3>
                    <span className="text-xs text-slate-500">
                      · {worker.contractType} · {formatFcfa(worker.rateFcfa)} / {worker.payBasis}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    Brut dû : <span className="font-mono-num font-semibold text-[#1E293B]">{formatFcfa(grossEarned)}</span> · Avances :{' '}
                    <span className="font-mono-num font-semibold text-[#B45309]">{formatFcfa(advances)}</span> · Net à payer :{' '}
                    <span className="font-mono-num font-bold text-[#2E7D32]">{formatFcfa(netToPay)}</span>
                  </p>
                </div>

                {todayRecord && (
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#2E7D32]">
                    <CheckCircle2 className="h-4 w-4" />
                    Pointé ({todayRecord.status}) · +{formatFcfa(todayRecord.earnedFcfa)}
                  </span>
                )}
              </div>

              {/* Quick Touch Attendance Buttons */}
              <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100">
                {worker.payBasis === 'tache' ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <label className="text-xs font-medium text-slate-600">Caisses / Unités récoltées :</label>
                    <input
                      type="number"
                      min={1}
                      value={units}
                      onChange={(e) => setTaskUnitsMap((m) => ({ ...m, [worker.id]: Number(e.target.value || 0) }))}
                      className="w-20 rounded-lg border border-slate-300 px-2.5 py-2 font-mono-num text-sm min-h-[44px]"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        onMarkAttendance({
                          worker,
                          workDate: selectedDate,
                          status: 'tache',
                          unitsCompleted: units,
                          advanceGivenFcfa: adv,
                        })
                      }
                      className="inline-flex items-center gap-1.5 rounded-xl bg-[#2E7D32] px-4 py-2 text-xs font-semibold text-white hover:bg-[#256428] min-h-[44px]"
                    >
                      <Check className="h-4 w-4" />
                      <span>Valider rendement ({formatFcfa(units * worker.rateFcfa)})</span>
                    </button>
                  </div>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() =>
                        onMarkAttendance({
                          worker,
                          workDate: selectedDate,
                          status: 'present',
                          unitsCompleted: 1,
                          advanceGivenFcfa: adv,
                        })
                      }
                      className="rounded-xl bg-[#2E7D32] px-4 py-2 text-xs font-semibold text-white hover:bg-[#256428] min-h-[44px]"
                    >
                      Présent (100%)
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        onMarkAttendance({
                          worker,
                          workDate: selectedDate,
                          status: 'demi_journee',
                          unitsCompleted: 0.5,
                          advanceGivenFcfa: adv,
                        })
                      }
                      className="rounded-xl border border-[#FFB300] bg-[#FFB300]/15 px-4 py-2 text-xs font-semibold text-[#1E293B] min-h-[44px]"
                    >
                      Demi-journée (50%)
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        onMarkAttendance({
                          worker,
                          workDate: selectedDate,
                          status: 'absent',
                          unitsCompleted: 0,
                          advanceGivenFcfa: 0,
                        })
                      }
                      className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-600 min-h-[44px]"
                    >
                      Absent
                    </button>
                  </>
                )}

                <div className="flex items-center gap-1.5 ml-auto">
                  <label className="text-xs text-slate-500">Acompte :</label>
                  <input
                    type="number"
                    min={0}
                    placeholder="0"
                    value={adv || ''}
                    onChange={(e) => setAdvanceInputMap((m) => ({ ...m, [worker.id]: Number(e.target.value || 0) }))}
                    className="w-24 rounded-lg border border-slate-300 px-2.5 py-2 font-mono-num text-xs min-h-[40px]"
                  />
                </div>

                {role !== 'pointer' && unpaidRecords.length > 0 && (
                  <button
                    type="button"
                    onClick={async () => {
                      await onSettlePayroll(worker, unpaidRecords);
                      setSignedWorkerId(worker.id);
                    }}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-[#1A73E8] bg-[#1A73E8]/10 px-3.5 py-2 text-xs font-semibold text-[#1A73E8] hover:bg-[#1A73E8]/15 min-h-[44px]"
                  >
                    <UserCheck className="h-4 w-4" />
                    <span>Émarger &amp; Payer ({formatFcfa(netToPay)})</span>
                  </button>
                )}
              </div>

              {signedWorkerId === worker.id && (
                <p className="text-xs font-semibold text-[#2E7D32]">
                  Émargement numérique validé : paie enregistrée dans le journal d&apos;audit.
                </p>
              )}
            </div>
          );
        })}
      </div>

      {/* Add Worker Modal */}
      {showAddWorker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
          <form onSubmit={handleAddWorker} className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 space-y-4 shadow-xl">
            <h3 className="font-display text-lg font-bold text-[#1E293B]">Nouvel ouvrier / saisonnier</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Nom &amp; Prénom</label>
                <input required value={wName} onChange={(e) => setWName(e.target.value)} placeholder="Ex: Abdoulaye Faye" className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm min-h-[44px]" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Téléphone</label>
                <input value={wPhone} onChange={(e) => setWPhone(e.target.value)} className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm min-h-[44px]" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Contrat</label>
                  <select value={wContract} onChange={(e) => setWContract(e.target.value as ContractType)} className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm min-h-[44px]">
                    <option value="journalier">Journalier</option>
                    <option value="saisonnier">Saisonnier</option>
                    <option value="permanent">Permanent</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Base de calcul</label>
                  <select value={wBasis} onChange={(e) => setWBasis(e.target.value as PayBasis)} className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm min-h-[44px]">
                    <option value="jour">Par jour</option>
                    <option value="semaine">Par semaine</option>
                    <option value="tache">À la tâche / rendement</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Tarif unitaire (FCFA)</label>
                <input type="number" min={0} required value={wRate} onChange={(e) => setWRate(e.target.value)} className="w-full rounded-xl border border-slate-300 px-3 py-2 font-mono-num text-sm min-h-[44px]" />
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => setShowAddWorker(false)} className="flex-1 rounded-xl border border-slate-300 py-2.5 text-sm font-semibold min-h-[48px]">Annuler</button>
              <button type="submit" className="flex-1 rounded-xl bg-[#2E7D32] py-2.5 text-sm font-semibold text-white min-h-[48px]">Ajouter</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
