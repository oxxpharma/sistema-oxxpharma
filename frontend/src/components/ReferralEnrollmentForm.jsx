import React, { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { Button } from './ui/Button';
import { X, Loader2, CreditCard } from 'lucide-react';
import { toast } from 'sonner';

// Máscaras simples
function applyMask(value, mask) {
  if (!value) return value;
  const d = value.replace(/\D/g, '');
  if (mask === 'cpf') {
    return d.slice(0, 11)
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
  }
  if (mask === 'phone') {
    return d.slice(0, 11)
      .replace(/^(\d{2})(\d)/, '($1) $2')
      .replace(/(\d{5})(\d{1,4})$/, '$1-$2');
  }
  if (mask === 'cep') {
    return d.slice(0, 8).replace(/(\d{5})(\d{1,3})$/, '$1-$2');
  }
  return value;
}

export default function ReferralEnrollmentForm({ onClose, onSuccess }) {
  const [fields, setFields] = useState([]);
  const [values, setValues] = useState({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get('/api/public/card-enrollment-fields');
        setFields(res.fields || []);
      } catch {
        toast.error('Não foi possível carregar o formulário');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const setField = (key, val) => setValues(v => ({ ...v, [key]: val }));

  const submit = async (e) => {
    e.preventDefault();
    // Validar required
    for (const f of fields) {
      if (f.required && !String(values[f.key] || '').trim()) {
        toast.error(`Preencha o campo: ${f.label}`);
        return;
      }
    }
    setSubmitting(true);
    try {
      const resp = await api.post('/api/users/me/referral-enrollment', values);
      onSuccess && onSuccess(resp);
    } catch (err) {
      toast.error(err?.message || 'Erro ao enviar');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-start justify-center py-6 sm:py-12 px-4 overflow-y-auto overscroll-contain" data-testid="enroll-form-modal">
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl mb-6">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div className="flex items-center gap-2 text-txt-primary">
            <CreditCard className="w-5 h-5 text-brand-main" />
            <h3 className="font-heading font-black text-lg">Aderir ao Programa</h3>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-bg-secondary rounded-lg" data-testid="enroll-close-btn">
            <X className="w-5 h-5" />
          </button>
        </div>

        {loading ? (
          <div className="p-12 text-center"><Loader2 className="w-8 h-8 animate-spin inline text-brand-main" /></div>
        ) : fields.length === 0 ? (
          <div className="p-6 text-sm text-txt-secondary">
            O administrador ainda não configurou o formulário de adesão. Entre em contato.
          </div>
        ) : (
          <form onSubmit={submit} className="p-5 space-y-4" data-testid="enroll-form">
            <p className="text-sm text-txt-secondary">
              Preencha os dados abaixo para enviar sua solicitação de adesão ao programa de indicação.
            </p>
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800">
              <b>Atenção:</b> sua adesão será analisada pelo administrador antes de ser ativada. Você receberá um e-mail com a resposta.
            </div>
            {fields.map(f => (
              <FieldRenderer key={f.key} field={f} value={values[f.key]} onChange={(v) => setField(f.key, v)} />
            ))}
            <div className="pt-3 flex gap-2 justify-end">
              <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
              <Button type="submit" disabled={submitting} data-testid="enroll-submit-btn">
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CreditCard className="w-4 h-4" />}
                {submitting ? 'Enviando...' : 'Solicitar adesão'}
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

function FieldRenderer({ field, value, onChange }) {
  const common = {
    value: value || '',
    onChange: (e) => {
      const v = e.target.value;
      onChange(field.mask ? applyMask(v, field.mask) : v);
    },
    required: !!field.required,
    placeholder: field.placeholder || '',
    className: 'w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:border-brand-main text-sm',
    'data-testid': `enroll-field-${field.key}`,
  };

  if (field.type === 'select') {
    return (
      <div>
        <label className="text-xs font-semibold text-txt-primary mb-1 block">
          {field.label}{field.required && ' *'}
        </label>
        <select {...common}>
          <option value="">Selecione...</option>
          {(field.options || []).map(opt => (
            <option key={opt.value || opt} value={opt.value || opt}>{opt.label || opt}</option>
          ))}
        </select>
      </div>
    );
  }

  if (field.type === 'textarea') {
    return (
      <div>
        <label className="text-xs font-semibold text-txt-primary mb-1 block">
          {field.label}{field.required && ' *'}
        </label>
        <textarea {...common} rows={3} />
      </div>
    );
  }

  return (
    <div>
      <label className="text-xs font-semibold text-txt-primary mb-1 block">
        {field.label}{field.required && ' *'}
      </label>
      <input type={field.type || 'text'} {...common} />
      {field.help && <div className="text-xs text-txt-secondary mt-1">{field.help}</div>}
    </div>
  );
}
