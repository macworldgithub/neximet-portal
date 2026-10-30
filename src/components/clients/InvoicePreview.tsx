type InvoiceDocument = {
  number: string; currency: string; issuedAt: string; dueAt: string; status: string;
  subtotal: number; taxRate: number; tax: number; total: number;
  items: { description: string; quantity: number; rate: number; amount?: number }[];
  billTo: { name: string; company: string; email: string; address: string };
  issuer?: { name?: string; email?: string; phone?: string; address?: string; taxId?: string };
  reference?: string; projectTitle?: string; paymentTerms?: string; paymentDetails: string; notes: string;
};
const amount = (value: number, currency: string) => new Intl.NumberFormat('en-US', { style: 'currency', currency, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
const date = (value: string) => new Date(value).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' });
const caption = 'text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500';

export default function InvoicePreview({ invoice }: { invoice: InvoiceDocument }) {
  const issuer = invoice.issuer || { name: 'Neximet' };
  const due = invoice.status === 'issued' ? invoice.total : 0;
  return <article aria-label="Neximet invoice" className="overflow-hidden rounded-xl bg-white text-slate-800 shadow-xl">
    <div className="h-1.5 bg-gradient-to-r from-[#5470F4] to-[#5CC5FA]" />
    <div className="p-5 sm:p-9">
      <header className="flex flex-wrap justify-between gap-6 border-b border-slate-200 pb-7">
        <div className="min-w-0"><img src="/neximet-logo.avif" alt="Neximet" className="mb-5 h-9 w-auto" /><p className="text-sm font-semibold">{issuer.name || 'Neximet'}</p><div className="mt-2 space-y-1 whitespace-pre-wrap break-words text-xs leading-5 text-slate-500">{issuer.address && <p>{issuer.address}</p>}{issuer.email && <p>{issuer.email}</p>}{issuer.phone && <p>{issuer.phone}</p>}{issuer.taxId && <p>Tax / registration ID: {issuer.taxId}</p>}</div></div>
        <div className="min-w-0 sm:text-right"><h3 className="text-3xl font-light tracking-[0.12em] text-slate-900">INVOICE</h3><p className="mt-3 break-all font-mono text-xs text-[#4662cc]">{invoice.number}</p><span className={`mt-3 inline-flex rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-wider ${invoice.status === 'paid' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : invoice.status === 'void' ? 'border-slate-200 bg-slate-100 text-slate-500' : 'border-blue-200 bg-blue-50 text-blue-700'}`}>{invoice.status === 'issued' ? 'Payment pending' : invoice.status}</span></div>
      </header>
      <div className="grid gap-6 py-7 sm:grid-cols-2">
        <section><h4 className={caption}>Bill to</h4><p className="mt-3 break-words text-sm font-semibold">{invoice.billTo.company || invoice.billTo.name}</p>{invoice.billTo.company && invoice.billTo.company !== invoice.billTo.name && <p className="mt-1 text-xs">{invoice.billTo.name}</p>}<p className="mt-2 break-words text-xs text-slate-500">{invoice.billTo.email}</p><p className="mt-1 whitespace-pre-wrap break-words text-xs leading-5 text-slate-500">{invoice.billTo.address}</p></section>
        <dl className="space-y-3 text-xs"><div className="flex justify-between gap-4"><dt className="text-slate-500">Invoice date</dt><dd className="font-medium">{date(invoice.issuedAt)}</dd></div><div className="flex justify-between gap-4"><dt className="text-slate-500">Payment due</dt><dd className="font-medium">{date(invoice.dueAt)}</dd></div><div className="flex justify-between gap-4"><dt className="text-slate-500">Currency</dt><dd className="font-medium">{invoice.currency}</dd></div>{invoice.reference && <div className="flex justify-between gap-4"><dt className="shrink-0 text-slate-500">Reference / PO</dt><dd className="break-words text-right font-medium">{invoice.reference}</dd></div>}</dl>
      </div>
      {invoice.projectTitle && <p className="mb-5 rounded-lg bg-slate-50 px-4 py-3 text-xs"><span className="text-slate-500">Project </span><span className="font-medium">{invoice.projectTitle}</span></p>}
      <div className="overflow-x-auto"><table className="w-full min-w-[440px] border-collapse text-left text-xs"><thead className="bg-[#172238] text-white"><tr><th className="rounded-tl-lg px-3 py-3 font-medium">#</th><th className="px-3 py-3 font-medium">Description</th><th className="whitespace-nowrap px-3 py-3 text-right font-medium">Qty</th><th className="whitespace-nowrap px-3 py-3 text-right font-medium">Unit price</th><th className="rounded-tr-lg whitespace-nowrap px-3 py-3 text-right font-medium">Amount</th></tr></thead><tbody>{invoice.items.map((item, index) => <tr key={index} className="border-b border-slate-200 even:bg-slate-50/80"><td className="px-3 py-4 align-top text-slate-400">{String(index + 1).padStart(2, '0')}</td><td className="min-w-32 max-w-64 whitespace-pre-wrap break-words px-3 py-4 align-top leading-5">{item.description}</td><td className="px-3 py-4 text-right align-top">{item.quantity}</td><td className="whitespace-nowrap px-3 py-4 text-right align-top">{amount(item.rate, invoice.currency)}</td><td className="whitespace-nowrap px-3 py-4 text-right align-top font-medium">{amount(item.amount || 0, invoice.currency)}</td></tr>)}</tbody></table></div>
      <div className="mt-7 grid gap-6 sm:grid-cols-[1fr_240px]">
        <section className="min-w-0">{invoice.paymentDetails && <><h4 className={caption}>Payment instructions</h4><p className="mt-3 whitespace-pre-wrap break-words text-xs leading-5 text-slate-600">{invoice.paymentDetails}</p></>}{invoice.paymentTerms && <div className="mt-5"><h4 className={caption}>Payment terms</h4><p className="mt-2 break-words text-xs leading-5 text-slate-600">{invoice.paymentTerms}</p></div>}</section>
        <div><dl className="space-y-3 text-xs"><div className="flex justify-between gap-4"><dt className="text-slate-500">Subtotal</dt><dd>{amount(invoice.subtotal, invoice.currency)}</dd></div><div className="flex justify-between gap-4"><dt className="text-slate-500">Tax ({invoice.taxRate}%)</dt><dd>{amount(invoice.tax, invoice.currency)}</dd></div><div className="flex justify-between gap-4 border-t border-slate-200 pt-3 font-semibold"><dt>Invoice total</dt><dd>{amount(invoice.total, invoice.currency)}</dd></div></dl><div className="mt-5 rounded-lg border border-indigo-100 bg-indigo-50 p-4"><p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-indigo-600">{invoice.status === 'void' ? 'Voided invoice' : 'Amount due'}</p><p className="mt-2 break-words text-2xl font-semibold tracking-tight text-[#293e91]">{amount(due, invoice.currency)}</p></div></div>
      </div>
      {invoice.notes && <section className="mt-7 border-t border-slate-200 pt-5"><h4 className={caption}>Notes</h4><p className="mt-2 whitespace-pre-wrap break-words text-xs leading-5 text-slate-500">{invoice.notes}</p></section>}
      <footer className="mt-8 flex flex-wrap justify-between gap-3 border-t border-slate-200 pt-4 text-[10px] text-slate-400"><span>Thank you for choosing {issuer.name || 'Neximet'}.</span><span>Please include the invoice number with your payment.</span></footer>
    </div>
  </article>;
}
