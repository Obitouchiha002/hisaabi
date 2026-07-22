import { useState } from 'react';
import { CATEGORIES, categoryMeta, formatINR, toPaise, toRupees, type CategoryId, type DraftEntry } from '@engine';
import { Sheet } from './ui';

/**
 * Ek entry / draft ko theek karne wali sheet.
 * Category badalne pe engine seekh leta hai — do baar wahi correction, aur rule ban jata hai.
 */

export function EntryEditor({
  draft, title = 'Theek kar lo', onSave, onDelete, onClose,
}: {
  draft: DraftEntry;
  title?: string;
  onSave(next: DraftEntry, categoryChanged: boolean): void;
  onDelete?(): void;
  onClose(): void;
}) {
  const [name, setName] = useState(draft.title);
  const [amount, setAmount] = useState(String(toRupees(draft.amountPaise)));
  const [category, setCategory] = useState<CategoryId>(draft.category ?? 'other');

  const amountNum = Number(amount);
  const valid = name.trim().length > 0 && isFinite(amountNum) && amountNum > 0;

  function save() {
    if (!valid) return;
    onSave(
      { ...draft, title: name.trim(), amountPaise: toPaise(amountNum), category, categorySource: 'learned' },
      category !== draft.category,
    );
  }

  return (
    <Sheet onClose={onClose}>
      <h2>{title}</h2>

      <div className="field-row">
        <label>
          <span className="f-k">Kis cheez ka</span>
          <input className="text-field" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} />
        </label>
        <label style={{ maxWidth: 150 }}>
          <span className="f-k">Kitne ka</span>
          <input
            className="text-field num"
            value={amount}
            inputMode="decimal"
            onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ''))}
          />
        </label>
      </div>

      <div className="section-title"><h2 style={{ fontSize: 15 }}>Category</h2></div>
      <div className="cat-grid">
        {CATEGORIES.filter((c) => c.id !== 'income' || draft.type === 'income').map((c) => (
          <button
            key={c.id}
            className="cat"
            data-selected={category === c.id}
            onClick={() => setCategory(c.id)}
            type="button"
          >
            <span aria-hidden="true">{c.emoji}</span>
            {c.label}
          </button>
        ))}
      </div>

      {category !== draft.category && (
        <div className="dev-note">
          Do baar yahi badloge to Hisaabi <b>{name || 'is dukaan'}</b> ko hamesha ke liye{' '}
          {categoryMeta(category).label} me daalne lagega.
        </div>
      )}

      <div className="q-foot">
        <button className="btn btn-primary btn-block" onClick={save} disabled={!valid}>
          Save karo · {valid ? formatINR(toPaise(amountNum)) : '—'}
        </button>
        {onDelete && (
          <button className="btn btn-quiet btn-block" style={{ color: 'var(--bad)' }} onClick={onDelete}>
            Ye entry hata do
          </button>
        )}
        <button className="btn btn-quiet btn-block" onClick={onClose}>Rehne do</button>
      </div>
    </Sheet>
  );
}
