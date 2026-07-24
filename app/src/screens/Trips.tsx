import { useState } from 'react';
import { formatINR, tripSummary, type TripMember } from '@engine';
import { Icon, Sheet, useToast } from '@/components/ui';
import { CalcButton } from '@/components/CalcButton';
import { useStore } from '@/lib/store';
import { useT } from '@/lib/i18n';

/**
 * Trip list + naya trip banana.
 *
 * Asli zindagi me ek hi banda hisaab rakhta hai aur baaki log WhatsApp pe
 * hote hain — isliye "invite" ke bajaye members sirf naam hain, aur aakhir me
 * WhatsApp pe bhejne layak summary milti hai. Bina kisi server ke chalta hai.
 */

const EMOJIS = ['🏖️', '🏔️', '🎉', '🍻', '🚗', '✈️', '🎂', '🏏', '🎬', '🏕️'];

export function Trips() {
  const t = useT();
  const { trips, setRoute, openTrip, createTrip } = useStore();
  const [creating, setCreating] = useState(false);

  return (
    <div className="screen">
      <header className="home-top">
        <button className="icon-btn" onClick={() => setRoute('home')} aria-label={t('Back', 'Peeche')}>{Icon.back}</button>
        <div className="grow" style={{ marginLeft: 4 }}>
          <div className="greet">{t('Group expenses', 'Doston ka hisaab')}</div>
          <div className="name">{trips.length ? t(`${trips.length} trip${trips.length === 1 ? '' : 's'}`, `${trips.length} trip`) : t('Trips', 'Trips')}</div>
        </div>
        <CalcButton />
      </header>

      {trips.length === 0 ? (
        <div className="empty">
          <div className="big">🏖️</div>
          <p>
            {t(
              'A trip, a party, eating out — wherever costs get split, make a trip. At the end the app tells you who owes whom.',
              'Trip, party ya bahar khana — jahan kharcha baant-na ho, wahan ek trip bana lo. Aakhir me app khud batayegi kaun kisko kitna de.',
            )}
          </p>
        </div>
      ) : (
        <div className="trip-list">
          {trips.map((trip, i) => {
            const s = tripSummary(trip);
            const pending = s.transfers.length;

            return (
              <button key={trip.id} className="trip-card" style={{ animationDelay: `${i * 50}ms` }}
                      onClick={() => openTrip(trip.id)}>
                <span className="trip-emoji" aria-hidden="true">{trip.emoji}</span>
                <span className="grow" style={{ minWidth: 0 }}>
                  <span className="e-t">{trip.name}</span>
                  <span className="e-s">
                    {t(`${trip.members.length} people · ${s.expenseCount} spends`, `${trip.members.length} log · ${s.expenseCount} kharche`)}
                    {pending ? t(` · ${pending} to settle`, ` · ${pending} hisaab baaki`) : t(' · all settled ✅', ' · hisaab barabar ✅')}
                  </span>
                </span>
                <span className="e-a num">{formatINR(s.totalPaise)}</span>
              </button>
            );
          })}
        </div>
      )}

      <div className="q-foot">
        <button className="btn btn-primary btn-block" onClick={() => setCreating(true)}>
          {Icon.plus} {t('New trip', 'Naya trip')}
        </button>
      </div>

      {creating && (
        <CreateTrip
          onClose={() => setCreating(false)}
          onCreate={async (name, emoji, members) => {
            const trip = await createTrip(name, emoji, members);
            setCreating(false);
            openTrip(trip.id);
          }}
        />
      )}
    </div>
  );
}

function CreateTrip({ onClose, onCreate }: {
  onClose(): void;
  onCreate(name: string, emoji: string, members: TripMember[]): void;
}) {
  const t = useT();
  const { profile } = useStore();
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState(EMOJIS[0]!);
  const [names, setNames] = useState(profile?.name ? `${profile.name}, ` : '');
  const toast = useToast();

  const members: TripMember[] = names
    .split(',')
    .map((n) => n.trim())
    .filter(Boolean)
    .map((n, i) => ({ id: `m${i}_${n.toLowerCase().replace(/\W/g, '')}`, name: n }));

  const valid = name.trim().length > 0 && members.length >= 2;

  return (
    <Sheet onClose={onClose}>
      <h2>{t('New trip', 'Naya trip')}</h2>

      <label>
        <span className="f-k">{t('Where to', 'Kahan ja rahe ho')}</span>
        <input className="text-field" value={name} maxLength={30} autoFocus
               placeholder={t('Goa, Manali, Rahul\'s party…', 'Goa, Manali, Rahul ki party…')}
               onChange={(e) => setName(e.target.value)} />
      </label>

      <div className="section-title"><h2 style={{ fontSize: 15 }}>{t('Icon', 'Nishaan')}</h2></div>
      <div className="emoji-row">
        {EMOJIS.map((e) => (
          <button key={e} className="emoji-pick" data-selected={e === emoji} onClick={() => setEmoji(e)}>{e}</button>
        ))}
      </div>

      <div className="section-title"><h2 style={{ fontSize: 15 }}>{t('Who\'s in', 'Kaun-kaun hai')}</h2></div>
      <input className="text-field" value={names}
             placeholder="Vansh, Rahul, Aman, Sneha"
             onChange={(e) => setNames(e.target.value)} />
      <p className="hint-line">
        {t('Separate with commas.', 'Comma se alag karo.')} {members.length >= 2
          ? t(`${members.length} people — ${members.map((m) => m.name).join(', ')}`, `${members.length} log — ${members.map((m) => m.name).join(', ')}`)
          : t('At least 2 people.', 'Kam se kam 2 log chahiye.')}
      </p>

      <div className="q-foot">
        <button className="btn btn-primary btn-block" disabled={!valid}
                onClick={() => valid ? onCreate(name, emoji, members) : toast.show(t('Need a name and 2 people', 'Naam aur 2 log to chahiye'))}>
          {t('Create trip', 'Trip banao')}
        </button>
        <button className="btn btn-quiet btn-block" onClick={onClose}>{t('Keep it', 'Rehne do')}</button>
      </div>

      {toast.node}
    </Sheet>
  );
}
