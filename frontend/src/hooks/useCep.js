import { useState, useCallback } from 'react';

/**
 * Hook para buscar endereco via CEP usando API ViaCEP (gratuita, sem key).
 * Uso: const { lookup, loading, error } = useCep();
 *      const address = await lookup('01001-000');
 */
export default function useCep() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const lookup = useCallback(async (cep) => {
    setError(null);
    const cleaned = (cep || '').replace(/\D/g, '');
    if (cleaned.length !== 8) {
      setError('CEP deve ter 8 dígitos');
      return null;
    }
    setLoading(true);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${cleaned}/json/`);
      const data = await res.json();
      if (data.erro) {
        setError('CEP não encontrado');
        return null;
      }
      return {
        zip_code: cleaned.replace(/(\d{5})(\d{3})/, '$1-$2'),
        street: data.logradouro || '',
        neighborhood: data.bairro || '',
        city: data.localidade || '',
        state: data.uf || '',
        complement: data.complemento || '',
      };
    } catch (e) {
      setError('Erro ao consultar CEP');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return { lookup, loading, error };
}

export function maskCep(value) {
  const digits = (value || '').replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 5) return digits;
  return digits.replace(/(\d{5})(\d{1,3})/, '$1-$2');
}
