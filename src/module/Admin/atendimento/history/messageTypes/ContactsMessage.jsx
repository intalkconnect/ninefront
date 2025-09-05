import React from 'react';
import './styles/ContactsMessage.css';

// -------- Utils: vCard <-> objeto simples --------
function escapeV(v = '') {
  return String(v).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
}

function buildVCard(c) {
  const fn =
    c.fullName || c.formatted_name || c.name?.formatted_name ||
    [c.firstName || c.name?.first_name || '', c.lastName || c.name?.last_name || ''].filter(Boolean).join(' ').trim();

  const org = c.org?.company || c.company || '';
  const title = c.org?.title || c.title || '';

  const lines = [
    'BEGIN:VCARD',
    'VERSION:3.0',
    `FN:${escapeV(fn)}`,
    org ? `ORG:${escapeV(org)}` : null,
    title ? `TITLE:${escapeV(title)}` : null,
  ].filter(Boolean);

  (c.phones || c.phone || c.telephones || []).forEach(p => {
    if (!p) return;
    const num = typeof p === 'string' ? p : (p.phone || p.value || '');
    const typ = (typeof p === 'object' && p.type) ? `;TYPE=${String(p.type).toUpperCase()}` : '';
    if (num) lines.push(`TEL${typ}:${escapeV(num)}`);
  });

  (c.emails || []).forEach(e => {
    const mail = typeof e === 'string' ? e : (e.email || e.value || '');
    const typ = (typeof e === 'object' && e.type) ? `;TYPE=${String(e.type).toUpperCase()}` : '';
    if (mail) lines.push(`EMAIL${typ}:${escapeV(mail)}`);
  });

  (c.urls || []).forEach(u => {
    const url = typeof u === 'string' ? u : (u.url || u.href || '');
    if (url) lines.push(`URL:${escapeV(url)}`);
  });

  lines.push('END:VCARD');
  return lines.join('\n');
}

// Parser simples de vCard (FN/ORG/TITLE/TEL/EMAIL/URL)
function parseVCard(text) {
  const contact = { phones: [], emails: [], urls: [], org: {} };
  const lines = String(text).split(/\r?\n/);
  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith('BEGIN') || line.startsWith('END') || line.startsWith('VERSION')) continue;
    const [keyPart, ...rest] = line.split(':');
    const value = rest.join(':'); // preserva ':' em URLs
    const key = keyPart.toUpperCase();

    if (key.startsWith('FN')) contact.fullName = value;
    else if (key.startsWith('ORG')) contact.org.company = value;
    else if (key.startsWith('TITLE')) contact.org.title = value;
    else if (key.startsWith('TEL')) contact.phones.push({ phone: value, type: (key.match(/TYPE=([^;]+)/i) || [,''])[1] });
    else if (key.startsWith('EMAIL')) contact.emails.push({ email: value, type: (key.match(/TYPE=([^;]+)/i) || [,''])[1] });
    else if (key.startsWith('URL')) contact.urls.push({ url: value });
  }
  return contact;
}

// Normaliza vários formatos possíveis do backend/WhatsApp/vCard
function normalizeContacts(data) {
  // WhatsApp Cloud API: { contacts: [ { name:{formatted_name,...}, phones:[{phone,wa_id,type}], emails:[...], org:{company,title}, ... } ] }
  if (Array.isArray(data?.contacts)) return data.contacts;

  if (Array.isArray(data)) return data; // já é a lista

  if (data?.vcard || data?.vCard) return [parseVCard(data.vcard || data.vCard)];
  if (Array.isArray(data?.vcards)) return data.vcards.map(parseVCard);

  if (typeof data === 'string') {
    const s = data.trim();
    if (s.startsWith('{') || s.startsWith('[')) {
      try {
        const o = JSON.parse(s);
        return normalizeContacts(o);
      } catch {}
    }
    if (/BEGIN:VCARD/i.test(s)) return [parseVCard(s)];
  }

  // fallback: nada mapeável
  return [];
}

function firstNonEmpty(...vals) {
  for (const v of vals) {
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return '';
}

export default function ContactsMessage({ data, small }) {
  const contacts = normalizeContacts(data);

  if (!contacts.length) {
    return <div className="contacts-empty">Contato não disponível.</div>;
  }

  const saveVcf = (c) => {
    const vcf = buildVCard(c);
    const blob = new Blob([vcf], { type: 'text/vcard;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const name =
      firstNonEmpty(
        c.fullName,
        c.formatted_name,
        c.name?.formatted_name,
        [c.name?.first_name, c.name?.last_name].filter(Boolean).join(' ')
      ) || 'contato';
    const a = document.createElement('a');
    a.href = url;
    a.download = `${name}.vcf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div className={`contacts-container ${small ? 'contacts-small' : ''}`}>
      {contacts.map((c, idx) => {
        const fullName = firstNonEmpty(
          c.fullName,
          c.formatted_name,
          c.name?.formatted_name,
          [c.name?.first_name, c.name?.last_name].filter(Boolean).join(' ')
        ) || 'Contato';
        const company = c.org?.company || c.company || '';
        const title = c.org?.title || c.title || '';
        const phones = c.phones || c.phone || [];
        const emails = c.emails || [];
        const urls = c.urls || [];

        return (
          <div className="contact-card" key={idx}>
            <div className="contact-header">
              <div className="contact-avatar">{(fullName[0] || '?').toUpperCase()}</div>
              <div className="contact-name-role">
                <div className="contact-name">{fullName}</div>
                {(company || title) && (
                  <div className="contact-role">
                    {[company, title].filter(Boolean).join(' • ')}
                  </div>
                )}
              </div>
              <button className="contact-save" onClick={() => saveVcf(c)} title="Salvar .vcf">Salvar</button>
            </div>

            {!!phones?.length && (
              <div className="contact-section">
                <div className="contact-section-title">Telefones</div>
                {phones.map((p, i) => {
                  const num = typeof p === 'string' ? p : (p.phone || p.value || '');
                  const label = (typeof p === 'object' && (p.type || p.wa_id)) ?
                    String(p.type || p.wa_id) : '';
                  return (
                    <a className="contact-line" key={i} href={`tel:${num}`} target="_blank" rel="noreferrer">
                      <span className="contact-primary">{num}</span>
                      {label && <span className="contact-secondary">{label}</span>}
                    </a>
                  );
                })}
              </div>
            )}

            {!!emails?.length && (
              <div className="contact-section">
                <div className="contact-section-title">E-mails</div>
                {emails.map((e, i) => {
                  const mail = typeof e === 'string' ? e : (e.email || e.value || '');
                  const label = (typeof e === 'object' && e.type) ? String(e.type) : '';
                  return (
                    <a className="contact-line" key={i} href={`mailto:${mail}`}>
                      <span className="contact-primary">{mail}</span>
                      {label && <span className="contact-secondary">{label}</span>}
                    </a>
                  );
                })}
              </div>
            )}

            {!!urls?.length && (
              <div className="contact-section">
                <div className="contact-section-title">Links</div>
                {urls.map((u, i) => {
                  const url = typeof u === 'string' ? u : (u.url || u.href || '');
                  return (
                    <a className="contact-line" key={i} href={url} target="_blank" rel="noreferrer">
                      <span className="contact-primary">{url}</span>
                    </a>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
