type Compensation = { baseSalary?: number | string | null; dailyWage?: number | string | null; leaveBalances?: { casual?: number | string; sick?: number | string; annual?: number | string } };
const defaults = { casual: 10, sick: 8, annual: 14 };
const nullableAmount = (value: unknown) => {
  if (value === '' || value === null || value === undefined) return null;
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 0) throw new Error('Pay and leave balances must be finite, non-negative numbers.');
  return amount;
};
const snapshot = (value: unknown) => value === '' || value == null ? null : Number.isFinite(Number(value)) ? Number(value) : String(value);

export function creationCompensation(baseSalary: unknown, dailyWage: unknown) {
  const salary = nullableAmount(baseSalary);
  return { baseSalary: salary, dailyWage: dailyWage === '' || dailyWage == null ? salary == null ? null : Math.round(salary / 30) : nullableAmount(dailyWage) };
}

export function employeeCompensationChanges(original: Compensation, current: Compensation) {
  const result: { baseSalary?: number | null; dailyWage?: number | null; expectedPay?: Record<string, number | string | null>; leaveBalances?: Record<string, number>; expectedLeaveBalances?: Record<string, number | string | null> } = {};
  for (const key of ['baseSalary', 'dailyWage'] as const) {
    const value = nullableAmount(current[key]);
    const before = snapshot(original[key]);
    if (value !== before) { result[key] = value; (result.expectedPay ||= {})[key] = before; }
  }
  for (const key of ['casual', 'sick', 'annual'] as const) {
    const value = nullableAmount(current.leaveBalances?.[key] ?? defaults[key]);
    const before = snapshot(original.leaveBalances?.[key] ?? defaults[key]);
    if (value !== before && value !== null) { (result.leaveBalances ||= {})[key] = value; (result.expectedLeaveBalances ||= {})[key] = before; }
  }
  return result;
}
