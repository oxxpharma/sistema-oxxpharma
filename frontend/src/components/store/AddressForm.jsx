import React from 'react';
import { Input, Select } from '../ui/Input';
import useCep, { maskCep } from '../../hooks/useCep';
import { Loader2, Search } from 'lucide-react';

const STATES = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'];

export default function AddressForm({ value, onChange, showDefault = true }) {
  const { lookup, loading, error } = useCep();

  const handleCepBlur = async () => {
    const result = await lookup(value.zip_code);
    if (result) {
      onChange({
        ...value,
        zip_code: result.zip_code,
        street: result.street || value.street,
        neighborhood: result.neighborhood || value.neighborhood,
        city: result.city || value.city,
        state: result.state || value.state,
        complement: result.complement || value.complement,
      });
    }
  };

  const set = (k, v) => onChange({ ...value, [k]: v });

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-3">
        <div className="relative">
          <Input
            label="CEP*"
            required
            value={value.zip_code || ''}
            onChange={e => set('zip_code', maskCep(e.target.value))}
            onBlur={handleCepBlur}
            placeholder="00000-000"
            maxLength={9}
            data-testid="addr-cep"
            error={error}
          />
          {loading && <Loader2 className="w-4 h-4 animate-spin absolute right-3 top-[34px] text-brand-main" />}
          {!loading && (value.zip_code || '').length >= 8 && !error && (
            <Search className="w-4 h-4 absolute right-3 top-[34px] text-gray-400" />
          )}
        </div>
        <Input
          label="Nome (ex: Casa)"
          value={value.label || ''}
          onChange={e => set('label', e.target.value)}
          className="col-span-2"
        />
      </div>
      <div className="grid grid-cols-3 gap-3">
        <Input label="Rua*" required className="col-span-2" value={value.street || ''} onChange={e => set('street', e.target.value)} data-testid="addr-street" />
        <Input label="Número*" required value={value.number || ''} onChange={e => set('number', e.target.value)} data-testid="addr-number" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Input label="Complemento" value={value.complement || ''} onChange={e => set('complement', e.target.value)} />
        <Input label="Bairro*" required value={value.neighborhood || ''} onChange={e => set('neighborhood', e.target.value)} data-testid="addr-neighborhood" />
      </div>
      <div className="grid grid-cols-3 gap-3">
        <Input label="Cidade*" required className="col-span-2" value={value.city || ''} onChange={e => set('city', e.target.value)} data-testid="addr-city" />
        <Select label="UF*" value={value.state || 'SP'} onChange={e => set('state', e.target.value)} data-testid="addr-state">
          {STATES.map(s => <option key={s} value={s}>{s}</option>)}
        </Select>
      </div>
      {showDefault && (
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={!!value.is_default} onChange={e => set('is_default', e.target.checked)} />
          Definir como endereço padrão
        </label>
      )}
    </div>
  );
}
