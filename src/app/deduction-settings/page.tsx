'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { apiGet, apiPut, apiPost } from '../../lib/api';
import {
  Coins,
  ShieldCheck,
  Clock,
  Percent,
  Sliders,
  AlertTriangle,
  CheckCircle2,
  FileSpreadsheet,
  ArrowRight,
  Calculator,
  RotateCcw,
  MapPin,
  LocateFixed,
  Navigation,
} from 'lucide-react';

export default function DeductionSettingsPage() {
  const { user, hasRole } = useAuth();
  const [rule, setRule] = useState<any>({
    title: 'Neximet Enterprise Attendance & Late Deduction Policy',
    shiftStartTime: '09:00',
    shiftEndTime: '18:00',
    gracePeriodMinutes: 15,
    lateThresholdMinutes: 30,
    deductionType: 'percentage',
    percentageDeductionRate: 5,
    fixedDeductionAmount: 1000,
    halfDayThresholdMinutes: 60,
    fullDayAbsentThresholdMinutes: 180,
    consecutiveLateThreshold: 3,
    consecutivePenaltyMultiplier: 1.5,
    currencySymbol: 'PKR',
    officeLocation: {
      officeAddress: 'Neximet Head Office, Karachi',
      latitude: 24.8607,
      longitude: 67.0011,
      radiusMeters: 200,
      enforceLocation: true,
    },
  });

  const [detectingGps, setDetectingGps] = useState(false);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Simulator state
  const [testMinutesLate, setTestMinutesLate] = useState(35);
  const [testDailyWage, setTestDailyWage] = useState(4667);
  const [simulationResult, setSimulationResult] = useState<any>(null);

  // Monthly report state
  const [monthlyReport, setMonthlyReport] = useState<any>(null);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const res = await apiGet('/deductions/rules');
      if (res.success && res.rule) {
        setRule(res.rule);
      }

      const reportRes = await apiGet('/deductions/monthly-report');
      if (reportRes.success) {
        setMonthlyReport(reportRes);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  // Update simulator whenever test inputs or rule changes
  useEffect(() => {
    let deduction = 0;
    let deductionPercentage = 0;
    let status = 'present';
    let explanation = '';

    if (testMinutesLate <= rule.gracePeriodMinutes) {
      status = 'present';
      explanation = `Arrival is within ${rule.gracePeriodMinutes} mins grace window. 0 PKR deducted.`;
    } else if (testMinutesLate >= rule.halfDayThresholdMinutes) {
      status = 'half_day';
      deductionPercentage = 50;
      deduction = Math.round(testDailyWage * 0.5);
      explanation = `Exceeded ${rule.halfDayThresholdMinutes}m threshold. Applied 50% half-day pay penalty = PKR ${deduction}`;
    } else {
      status = 'late';
      if (rule.deductionType === 'percentage') {
        deductionPercentage = rule.percentageDeductionRate;
        deduction = Math.round((testDailyWage * rule.percentageDeductionRate) / 100);
        explanation = `Late by ${testMinutesLate} mins. Deducts ${rule.percentageDeductionRate}% of daily wage (PKR ${testDailyWage}) = PKR ${deduction}`;
      } else {
        deduction = rule.fixedDeductionAmount;
        deductionPercentage = Math.round((rule.fixedDeductionAmount / testDailyWage) * 100);
        explanation = `Late by ${testMinutesLate} mins. Deducts flat penalty of PKR ${rule.fixedDeductionAmount}.`;
      }
    }

    setSimulationResult({
      status,
      deduction,
      deductionPercentage,
      explanation,
    });
  }, [testMinutesLate, testDailyWage, rule]);

  const handleCaptureOfficeGps = () => {
    if (typeof window === 'undefined' || !navigator.geolocation) {
      setMsg({ type: 'error', text: 'Geolocation is not supported by your browser.' });
      return;
    }
    setDetectingGps(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setRule((prev: any) => ({
          ...prev,
          officeLocation: {
            ...(prev.officeLocation || {}),
            latitude: Number(pos.coords.latitude.toFixed(6)),
            longitude: Number(pos.coords.longitude.toFixed(6)),
          },
        }));
        setDetectingGps(false);
        setMsg({ type: 'success', text: `Captured office GPS coordinates: ${pos.coords.latitude.toFixed(6)}, ${pos.coords.longitude.toFixed(6)}` });
      },
      (err) => {
        setDetectingGps(false);
        setMsg({ type: 'error', text: `Failed to detect GPS coordinates: ${err.message}` });
      },
      { enableHighAccuracy: true }
    );
  };

  const handleSaveRule = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMsg(null);

    try {
      const res = await apiPut('/deductions/rules', rule);
      if (res.success) {
        setMsg({ type: 'success', text: 'Attendance, deduction, and office geofence policies updated successfully!' });
        setRule(res.rule);
      } else {
        setMsg({ type: 'error', text: res.message || 'Failed to update rule' });
      }
    } catch (err: any) {
      setMsg({ type: 'error', text: err.message });
    } finally {
      setSaving(false);
    }
  };

  if (!hasRole('CEO')) {
    return (
      <div className="bg-[#111827] border border-[#1F293D] rounded-3xl p-12 text-center max-w-xl mx-auto my-12 space-y-4 shadow-xl">
        <ShieldCheck className="w-12 h-12 text-amber-400 mx-auto" />
        <h3 className="text-lg font-bold text-white">CEO / Executive Access Required</h3>
        <p className="text-xs text-gray-400 leading-relaxed">
          Company salary deduction rules and financial penalty thresholds can only be modified by the Chief Executive Officer.
        </p>
        <p className="text-xs text-[#5CC5FA] font-semibold">
          Please sign in with executive credentials (e.g. <strong>ceo@neximet.com</strong>) to configure company deduction policies.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight flex items-center gap-2.5">
            <Coins className="w-6 h-6 text-[#5470F4]" />
            <span>Configurable Salary Deduction Engine</span>
          </h1>
          <p className="text-xs text-gray-400 mt-1">
            Configure automated late penalties, grace periods, percentage/fixed deduction models, and review monthly ledgers.
          </p>
        </div>

        <span className="px-3 py-1.5 rounded-xl bg-amber-500/10 text-amber-300 border border-amber-500/30 text-xs font-bold flex items-center gap-2">
          <ShieldCheck className="w-4 h-4" />
          <span>Executive Authority Granted</span>
        </span>
      </div>

      {msg && (
        <div className={`p-4 rounded-2xl border text-xs font-semibold flex items-center gap-2.5 ${msg.type === 'success'
            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
            : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
          }`}>
          {msg.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
          <span>{msg.text}</span>
        </div>
      )}

      {/* Main Settings & Simulator Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Form: Policy Rules Configuration */}
        <div className="lg:col-span-2 bg-[#111827] border border-[#1F293D] rounded-3xl p-6 sm:p-8 shadow-xl space-y-6">
          <div className="border-b border-[#1F293D] pb-4">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Sliders className="w-5 h-5 text-[#5470F4]" />
              <span>Company Deduction Rules & Thresholds</span>
            </h3>
            <p className="text-xs text-gray-400 mt-0.5">
              Customize when late marks trigger and how money is deducted from daily wages.
            </p>
          </div>

          <form onSubmit={handleSaveRule} className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">Standard Shift Start Time</label>
                <input
                  type="time"
                  required
                  value={rule.shiftStartTime}
                  onChange={(e) => setRule({ ...rule, shiftStartTime: e.target.value })}
                  className="w-full bg-[#0B0F19] border border-[#1F293D] focus:border-[#5470F4] rounded-xl px-3 py-2 text-xs text-white outline-none font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">Standard Shift End Time</label>
                <input
                  type="time"
                  required
                  value={rule.shiftEndTime}
                  onChange={(e) => setRule({ ...rule, shiftEndTime: e.target.value })}
                  className="w-full bg-[#0B0F19] border border-[#1F293D] focus:border-[#5470F4] rounded-xl px-3 py-2 text-xs text-white outline-none font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">
                  Grace Period (Minutes)
                  <span className="text-[10px] text-gray-400 font-normal ml-1">No penalty applied</span>
                </label>
                <input
                  type="number"
                  min={0}
                  max={60}
                  required
                  value={rule.gracePeriodMinutes}
                  onChange={(e) => setRule({ ...rule, gracePeriodMinutes: Number(e.target.value) })}
                  className="w-full bg-[#0B0F19] border border-[#1F293D] focus:border-[#5470F4] rounded-xl px-3 py-2 text-xs text-white outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">Deduction Calculation Model</label>
                <select
                  value={rule.deductionType}
                  onChange={(e) => setRule({ ...rule, deductionType: e.target.value })}
                  className="w-full bg-[#0B0F19] border border-[#1F293D] focus:border-[#5470F4] rounded-xl px-3 py-2 text-xs text-white outline-none"
                >
                  <option value="percentage">Percentage of Employee Daily Wage (%)</option>
                  <option value="fixed">Fixed Currency Amount (PKR / flat)</option>
                </select>
              </div>

              {rule.deductionType === 'percentage' ? (
                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1">
                    Deduction Rate (% of Daily Wage)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    required
                    value={rule.percentageDeductionRate}
                    onChange={(e) => setRule({ ...rule, percentageDeductionRate: Number(e.target.value) })}
                    className="w-full bg-[#0B0F19] border border-[#1F293D] focus:border-[#5470F4] rounded-xl px-3 py-2 text-xs text-white outline-none"
                  />
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1">
                    Fixed Penalty Amount (PKR per late arrival)
                  </label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={rule.fixedDeductionAmount}
                    onChange={(e) => setRule({ ...rule, fixedDeductionAmount: Number(e.target.value) })}
                    className="w-full bg-[#0B0F19] border border-[#1F293D] focus:border-[#5470F4] rounded-xl px-3 py-2 text-xs text-white outline-none"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">
                  Half-Day Threshold (Minutes)
                  <span className="text-[10px] text-gray-400 font-normal ml-1">Triggers 50% wage loss</span>
                </label>
                <input
                  type="number"
                  min={30}
                  max={240}
                  required
                  value={rule.halfDayThresholdMinutes}
                  onChange={(e) => setRule({ ...rule, halfDayThresholdMinutes: Number(e.target.value) })}
                  className="w-full bg-[#0B0F19] border border-[#1F293D] focus:border-[#5470F4] rounded-xl px-3 py-2 text-xs text-white outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">
                  Consecutive Late Threshold (Count)
                </label>
                <input
                  type="number"
                  min={1}
                  max={10}
                  required
                  value={rule.consecutiveLateThreshold}
                  onChange={(e) => setRule({ ...rule, consecutiveLateThreshold: Number(e.target.value) })}
                  className="w-full bg-[#0B0F19] border border-[#1F293D] focus:border-[#5470F4] rounded-xl px-3 py-2 text-xs text-white outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">
                  Repeat Infraction Multiplier
                </label>
                <input
                  type="number"
                  step="0.1"
                  min={1}
                  max={5}
                  required
                  value={rule.consecutivePenaltyMultiplier}
                  onChange={(e) => setRule({ ...rule, consecutivePenaltyMultiplier: Number(e.target.value) })}
                  className="w-full bg-[#0B0F19] border border-[#1F293D] focus:border-[#5470F4] rounded-xl px-3 py-2 text-xs text-white outline-none"
                />
              </div>
            </div>

            {/* Office Geofencing & Location Enforcement Section */}
            <div className="pt-5 border-t border-[#1F293D] space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-[#5470F4]" />
                    <span>Office Geofence & Location Enforcement</span>
                  </h4>
                  <p className="text-[11px] text-gray-400 mt-0.5">
                    Prevent employees from checking in remotely from home. Enforce mandatory office GPS boundary.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleCaptureOfficeGps}
                  disabled={detectingGps}
                  className="px-3 py-1.5 rounded-xl bg-[#161F30] hover:bg-[#1E293D] text-[#5CC5FA] border border-[#5470F4]/30 text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm"
                >
                  <LocateFixed className={`w-3.5 h-3.5 ${detectingGps ? 'animate-spin' : ''}`} />
                  <span>{detectingGps ? 'Detecting Location...' : 'Use My Current GPS Position'}</span>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-gray-300 mb-1">
                    Office Premises Name / Address
                  </label>
                  <input
                    type="text"
                    required
                    value={rule.officeLocation?.officeAddress || ''}
                    onChange={(e) =>
                      setRule({
                        ...rule,
                        officeLocation: {
                          ...(rule.officeLocation || {}),
                          officeAddress: e.target.value,
                        },
                      })
                    }
                    placeholder="e.g. Neximet Head Office, Karachi"
                    className="w-full bg-[#0B0F19] border border-[#1F293D] focus:border-[#5470F4] rounded-xl px-3 py-2 text-xs text-white outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1">
                    Office Latitude
                  </label>
                  <input
                    type="number"
                    step="0.000001"
                    required
                    value={rule.officeLocation?.latitude ?? 24.8607}
                    onChange={(e) =>
                      setRule({
                        ...rule,
                        officeLocation: {
                          ...(rule.officeLocation || {}),
                          latitude: Number(e.target.value),
                        },
                      })
                    }
                    className="w-full bg-[#0B0F19] border border-[#1F293D] focus:border-[#5470F4] rounded-xl px-3 py-2 text-xs text-white font-mono outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1">
                    Office Longitude
                  </label>
                  <input
                    type="number"
                    step="0.000001"
                    required
                    value={rule.officeLocation?.longitude ?? 67.0011}
                    onChange={(e) =>
                      setRule({
                        ...rule,
                        officeLocation: {
                          ...(rule.officeLocation || {}),
                          longitude: Number(e.target.value),
                        },
                      })
                    }
                    className="w-full bg-[#0B0F19] border border-[#1F293D] focus:border-[#5470F4] rounded-xl px-3 py-2 text-xs text-white font-mono outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1">
                    Allowed Geofence Radius (Meters)
                  </label>
                  <select
                    value={rule.officeLocation?.radiusMeters || 200}
                    onChange={(e) =>
                      setRule({
                        ...rule,
                        officeLocation: {
                          ...(rule.officeLocation || {}),
                          radiusMeters: Number(e.target.value),
                        },
                      })
                    }
                    className="w-full bg-[#0B0F19] border border-[#1F293D] focus:border-[#5470F4] rounded-xl px-3 py-2 text-xs text-white outline-none"
                  >
                    <option value={50}>50 meters (Strict Building boundary)</option>
                    <option value={100}>100 meters (Office & Parking lot)</option>
                    <option value={200}>200 meters (Standard Campus Geofence)</option>
                    <option value={500}>500 meters (Extended Premises)</option>
                  </select>
                </div>

                <div className="flex items-center gap-3 pt-5">
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={rule.officeLocation?.enforceLocation ?? true}
                      onChange={(e) =>
                        setRule({
                          ...rule,
                          officeLocation: {
                            ...(rule.officeLocation || {}),
                            enforceLocation: e.target.checked,
                          },
                        })
                      }
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#5470F4]"></div>
                    <span className="ml-2.5 text-xs font-semibold text-white">
                      Enforce Geofencing (Reject Remote Check-Ins)
                    </span>
                  </label>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-4 border-t border-[#1F293D]">
              <button
                type="submit"
                disabled={saving}
                className="px-6 py-2.5 rounded-xl text-xs font-bold gradient-btn text-white shadow-lg shadow-[#5470F4]/30 hover:scale-[1.02] transition-all"
              >
                {saving ? 'Saving Rules...' : 'Save Configuration Policy'}
              </button>
            </div>
          </form>
        </div>

        {/* Live Deduction What-If Simulator */}
        <div className="bg-[#111827] border border-[#1F293D] rounded-3xl p-6 shadow-xl space-y-5 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="border-b border-[#1F293D] pb-3 flex items-center justify-between">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Calculator className="w-4 h-4 text-[#5CC5FA]" />
                <span>Live What-If Simulator</span>
              </h3>
              <span className="text-[10px] text-[#5CC5FA] bg-[#5470F4]/15 px-2 py-0.5 rounded-full">
                Interactive
              </span>
            </div>

            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-xs font-semibold text-gray-300 mb-1.5">
                  <span>Minutes Late:</span>
                  <span className="text-white font-mono font-bold">{testMinutesLate} mins</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={120}
                  step={5}
                  value={testMinutesLate}
                  onChange={(e) => setTestMinutesLate(Number(e.target.value))}
                  className="w-full accent-[#5470F4] cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-gray-500 mt-1">
                  <span>0m (On-time)</span>
                  <span>Grace: {rule.gracePeriodMinutes}m</span>
                  <span>Half-Day: {rule.halfDayThresholdMinutes}m</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">Employee Daily Wage (PKR)</label>
                <input
                  type="number"
                  value={testDailyWage}
                  onChange={(e) => setTestDailyWage(Number(e.target.value))}
                  className="w-full bg-[#0B0F19] border border-[#1F293D] focus:border-[#5470F4] rounded-xl px-3 py-2 text-xs text-white font-mono outline-none"
                />
              </div>
            </div>

            {/* Calculated Output Card */}
            {simulationResult && (
              <div className="p-4 rounded-2xl bg-[#161F30] border border-[#1F293D] space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-gray-400">Resulting Status:</span>
                  <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full capitalize ${simulationResult.status === 'present'
                      ? 'bg-emerald-500/20 text-emerald-300'
                      : simulationResult.status === 'half_day'
                        ? 'bg-rose-500/20 text-rose-300'
                        : 'bg-amber-500/20 text-amber-300'
                    }`}>
                    {simulationResult.status.replace('_', ' ')}
                  </span>
                </div>

                <div className="flex items-baseline justify-between border-t border-[#1F293D] pt-2">
                  <span className="text-xs font-bold text-gray-300">Deduction Calculated:</span>
                  <span className="text-2xl font-black text-rose-400 font-mono">
                    -PKR {simulationResult.deduction}
                  </span>
                </div>

                <p className="text-[11px] text-gray-300 bg-[#0B0F19] p-2.5 rounded-xl border border-[#1F293D] leading-relaxed">
                  {simulationResult.explanation}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Monthly Deductions Report & Penalty Audit Ledger */}
      <div className="bg-[#111827] border border-[#1F293D] rounded-3xl p-6 sm:p-8 shadow-xl space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#1F293D] pb-4">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-[#5470F4]" />
              <span>Monthly Deductions Ledger & Penalty Audit</span>
            </h3>
            <p className="text-xs text-gray-400 mt-0.5">
              Detailed breakdown of salary deductions accrued per team member for the active billing cycle.
            </p>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right">
              <span className="text-[10px] text-gray-400 font-bold uppercase block">Total Penalties</span>
              <span className="text-lg font-black text-rose-400 font-mono">
                -PKR {monthlyReport?.grandTotalDeductions?.toLocaleString() || '0'}
              </span>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="text-gray-400 uppercase tracking-wider font-bold border-b border-[#1F293D] bg-[#0B0F19]">
              <tr>
                <th className="py-3 px-4">Employee</th>
                <th className="py-3 px-4">Department</th>
                <th className="py-3 px-4">Late Incidents</th>
                <th className="py-3 px-4">Total Delay</th>
                <th className="py-3 px-4">Total Money Deducted</th>
                <th className="py-3 px-4">Recent Infraction Detail</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1F293D]">
              {monthlyReport?.report && monthlyReport.report.length > 0 ? (
                monthlyReport.report.map((item: any) => (
                  <tr key={item.user?._id} className="hover:bg-[#161F30]/60 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[#161F30] to-[#1E293D] border border-[#5470F4]/30 flex items-center justify-center font-bold text-[11px] text-[#5CC5FA] shrink-0">
                          {item.user?.name ? item.user.name.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase() : 'US'}
                        </div>
                        <div>
                          <p className="font-bold text-white">{item.user?.name}</p>
                          <p className="text-[10px] text-gray-400">{item.user?.designation}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-gray-300">{item.user?.department}</td>
                    <td className="py-3.5 px-4">
                      <span className="px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-300 font-bold">
                        {item.totalLateIncidents} times
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-gray-300 font-mono font-bold">
                      {item.totalMinutesLate} mins
                    </td>
                    <td className="py-3.5 px-4 font-mono">
                      <span className="text-rose-400 font-black text-sm">
                        -PKR {item.totalDeductions}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-gray-400 max-w-xs truncate">
                      {item.incidents && item.incidents.length > 0
                        ? item.incidents[item.incidents.length - 1].reason
                        : 'Rule penalty'}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-gray-500">
                    No deductions accrued for this month. All employees arrived on time!
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
