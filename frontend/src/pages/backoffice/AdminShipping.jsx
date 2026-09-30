import React, { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Truck, Loader2, Save, Play, Eye, EyeOff, Check, Clock, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { formatCurrency } from '../../lib/utils';

export default function AdminShipping() {
  const [cfg, setCfg] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Testes de Rastreamento (Diagnóstico)
  const [trackCodeInput, setTrackCodeInput] = useState('');
  const [trackTesting, setTrackTesting] = useState(false);
  const [trackResult, setTrackResult] = useState(null);

  // Testes de Cotação de Frete
  const [freightCepInput, setFreightCepInput] = useState('');
  const [freightTesting, setFreightTesting] = useState(false);
  const [freightResult, setFreightResult] = useState(null);

  // Ação Imediata (Sync Cron Manual)
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState(null);

  const loadConfig = async () => {
    setLoading(true);
    try {
      const data = await api.get('/api/admin/correios-config');
      setCfg(data);
    } catch (err) {
      toast.error(err?.message || 'Falha ao carregar configurações de frete');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadConfig();
  }, []);

  const setField = (key, val) => {
    setCfg((prev) => ({ ...prev, [key]: val }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const updated = await api.put('/api/admin/correios-config', cfg);
      setCfg(updated);
      toast.success('Configurações de frete salvas com sucesso!');
    } catch (err) {
      toast.error(err?.message || 'Erro ao salvar configurações');
    } finally {
      setSaving(false);
    }
  };

  // Executa Teste de Rastreamento Oficial (Diagnóstico)
  const runTrackingTest = async () => {
    const code = trackCodeInput.trim().toUpperCase();
    if (!code) {
      toast.error('Informe um código de rastreamento para testar');
      return;
    }
    setTrackTesting(true);
    setTrackResult(null);
    try {
      const res = await api.post('/api/admin/shipping/test-tracking', { tracking_code: code });
      setTrackResult(res);
      if (res.ok) {
        toast.success(`Rastreio concluído! ${res.events?.length || 0} evento(s) encontrado(s).`);
      } else {
        toast.warning('Chamada executada, veja os detalhes da resposta abaixo.');
      }
    } catch (err) {
      toast.error(err?.message || 'Erro ao consultar API de rastreamento');
    } finally {
      setTrackTesting(false);
    }
  };

  // Executa Teste de Cotação de Frete em Tempo Real
  const runFreightTest = async () => {
    const cep = freightCepInput.replace(/\D/g, '');
    if (cep.length !== 8) {
      toast.error('Digite um CEP válido com 8 dígitos');
      return;
    }
    setFreightTesting(true);
    setFreightResult(null);
    try {
      const res = await api.post('/api/admin/shipping/test-freight', { cep });
      setFreightResult(res);
      if (res.options?.length) {
        toast.success(`${res.options.length} opção(ões) de frete calculada(s)!`);
      } else {
        toast.info('Nenhuma opção de frete retornada para este CEP.');
      }
    } catch (err) {
      toast.error(err?.message || 'Erro ao calcular frete em tempo real');
    } finally {
      setFreightTesting(false);
    }
  };

  // Dispara Sincronização e Rastreamento de Pedidos Imediato
  const runImmediateSync = async () => {
    setSyncing(true);
    setSyncResult(null);
    try {
      const res = await api.post('/api/admin/shipping/sync-tracking');
      setSyncResult(res);
      toast.success(
        `Varredura concluída: ${res.checked || 0} pedido(s) checado(s), ${res.delivered_count || 0} entregue(s), ${res.notifications_sent || 0} e-mail(s) enviado(s).`
      );
    } catch (err) {
      toast.error(err?.message || 'Erro ao sincronizar rastreamento dos pedidos');
    } finally {
      setSyncing(false);
    }
  };

  if (loading) {
    return (
      <div className="p-12 text-center" data-testid="shipping-loading">
        <Loader2 className="w-8 h-8 animate-spin inline text-orange-600 mb-2" />
        <p className="text-sm text-slate-500 font-medium">Carregando configurações dos Correios...</p>
      </div>
    );
  }

  if (!cfg) return null;

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-12" data-testid="admin-shipping-page">
      {/* Cabeçalho Principal */}
      <div className="flex items-start justify-between flex-wrap gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="p-2.5 bg-orange-100 text-orange-700 rounded-xl">
              <Truck className="w-6 h-6" />
            </div>
            <h1 className="font-heading font-black text-2xl text-slate-900">Configurações de Envio</h1>
          </div>
          <p className="text-sm text-slate-500 max-w-3xl">
            Parâmetros de cotação de frete oficial dos Correios, Melhor Envio e dimensões padrão de encomendas
          </p>
        </div>

        <Button onClick={handleSave} loading={saving} className="bg-orange-600 hover:bg-orange-700 text-white font-bold px-6 shadow-md" data-testid="save-shipping-btn">
          <Save className="w-4 h-4 mr-2" /> Salvar Alterações
        </Button>
      </div>

      {/* 1. CEP Origem & Dimensões Padrão */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
              CEP Origem Frete:
            </label>
            <input
              type="text"
              value={cfg.shipping_origin_cep || cfg.correios_origin_cep || ''}
              onChange={(e) => {
                setField('shipping_origin_cep', e.target.value);
                setField('correios_origin_cep', e.target.value);
              }}
              placeholder="87033-370"
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-semibold focus:bg-white focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none"
              data-testid="input-origin-cep"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
              Dimensões padrão dos pedidos em: (AxCxL)
            </label>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <input
                  type="number"
                  value={cfg.shipping_default_height || cfg.correios_default_height_cm || 24}
                  onChange={(e) => {
                    const val = parseInt(e.target.value || 0);
                    setField('shipping_default_height', val);
                    setField('correios_default_height_cm', val);
                  }}
                  placeholder="Alt (cm)"
                  className="w-full text-center px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-semibold focus:bg-white focus:ring-2 focus:ring-orange-500 outline-none"
                  data-testid="input-height"
                />
                <span className="text-[10px] text-slate-400 text-center block mt-1">Altura (cm)</span>
              </div>
              <div>
                <input
                  type="number"
                  value={cfg.shipping_default_length || cfg.correios_default_length_cm || 34}
                  onChange={(e) => {
                    const val = parseInt(e.target.value || 0);
                    setField('shipping_default_length', val);
                    setField('correios_default_length_cm', val);
                  }}
                  placeholder="Comp (cm)"
                  className="w-full text-center px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-semibold focus:bg-white focus:ring-2 focus:ring-orange-500 outline-none"
                  data-testid="input-length"
                />
                <span className="text-[10px] text-slate-400 text-center block mt-1">Compr. (cm)</span>
              </div>
              <div>
                <input
                  type="number"
                  value={cfg.shipping_default_width || cfg.correios_default_width_cm || 14}
                  onChange={(e) => {
                    const val = parseInt(e.target.value || 0);
                    setField('shipping_default_width', val);
                    setField('correios_default_width_cm', val);
                  }}
                  placeholder="Larg (cm)"
                  className="w-full text-center px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-semibold focus:bg-white focus:ring-2 focus:ring-orange-500 outline-none"
                  data-testid="input-width"
                />
                <span className="text-[10px] text-slate-400 text-center block mt-1">Largura (cm)</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Credenciais API Correios CWS */}
      <div className="bg-slate-50/70 border border-slate-200 rounded-2xl p-6 space-y-6 shadow-sm">
        <div className="flex items-center justify-between flex-wrap gap-2 border-b border-slate-200 pb-4">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-orange-600" />
            <h2 className="font-heading font-bold text-base text-slate-900">
              Credenciais API Correios CWS (Rastreamento e Envio Oficial)
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">Ambiente:</span>
            <select
              value={cfg.correios_environment || 'producao'}
              onChange={(e) => setField('correios_environment', e.target.value)}
              className="bg-white border border-slate-300 text-slate-800 text-xs font-bold rounded-lg px-2.5 py-1"
              data-testid="select-environment"
            >
              <option value="producao">Oficial (api.correios.com.br)</option>
              <option value="homologacao">Homologação (apihom.correios.com.br)</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Contrato Correios:</label>
            <input
              type="text"
              value={cfg.shipping_correios_contract || cfg.correios_contract || ''}
              onChange={(e) => {
                setField('shipping_correios_contract', e.target.value);
                setField('correios_contract', e.target.value);
              }}
              placeholder="Ex: 9912536173"
              className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-sm font-semibold text-slate-800 focus:ring-2 focus:ring-orange-500 outline-none"
              data-testid="input-contract"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Usuário / IdCorreios:</label>
            <input
              type="text"
              value={cfg.shipping_correios_user || cfg.correios_user || ''}
              onChange={(e) => {
                setField('shipping_correios_user', e.target.value);
                setField('correios_user', e.target.value);
              }}
              placeholder="Ex: 30721838000135"
              className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-sm font-semibold text-slate-800 focus:ring-2 focus:ring-orange-500 outline-none"
              data-testid="input-user"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Código de Acesso / Senha API:</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={cfg.shipping_correios_password || cfg.correios_api_code || ''}
                onChange={(e) => {
                  setField('shipping_correios_password', e.target.value);
                  setField('correios_api_code', e.target.value);
                }}
                placeholder="••••••••••••••••"
                className="w-full pl-3.5 pr-10 py-2 bg-white border border-slate-300 rounded-xl text-sm font-semibold text-slate-800 focus:ring-2 focus:ring-orange-500 outline-none"
                data-testid="input-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Cartão de Postagem (Opcional - padrão: igual ao contrato):
            </label>
            <input
              type="text"
              value={cfg.shipping_correios_posting_card || cfg.correios_posting_card || ''}
              onChange={(e) => {
                setField('shipping_correios_posting_card', e.target.value);
                setField('correios_posting_card', e.target.value);
              }}
              placeholder="Ex: 0079705995"
              className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-sm font-semibold text-slate-800 focus:ring-2 focus:ring-orange-500 outline-none"
              data-testid="input-posting-card"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Código DR (Diretoria Regional):</label>
            <input
              type="text"
              value={cfg.shipping_correios_dr || cfg.correios_dr || ''}
              onChange={(e) => {
                setField('shipping_correios_dr', e.target.value);
                setField('correios_dr', e.target.value);
              }}
              placeholder="Ex: 72"
              className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-sm font-semibold text-slate-800 focus:ring-2 focus:ring-orange-500 outline-none"
              data-testid="input-dr"
            />
          </div>
        </div>

        {/* Teste de Rastreamento Oficial da API dos Correios */}
        <div className="pt-4 border-t border-slate-200/80">
          <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <Truck className="w-4 h-4 text-orange-600" />
              <span className="text-sm font-bold text-slate-900">Teste de Rastreamento Oficial da API dos Correios:</span>
            </div>
            <span className="text-xs text-slate-500">Executa chamada direta e exibe logs da requisição e response</span>
          </div>

          <div className="flex gap-2 flex-wrap sm:flex-nowrap">
            <input
              type="text"
              value={trackCodeInput}
              onChange={(e) => setTrackCodeInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && runTrackingTest()}
              placeholder="Informe um código (ex: AD825894655BR ou QQ588651634BR)"
              className="flex-1 px-4 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-orange-500 outline-none"
              data-testid="input-track-code-test"
            />
            <Button
              onClick={runTrackingTest}
              loading={trackTesting}
              className="bg-orange-600 hover:bg-orange-700 text-white font-bold px-6 shrink-0"
              data-testid="btn-test-tracking"
            >
              <Play className="w-4 h-4 mr-1.5" /> Testar Rastreamento
            </Button>
          </div>

          {/* Log Visual do Diagnóstico de Rastreamento */}
          {trackResult && (
            <div className="mt-4 bg-slate-900 text-slate-100 rounded-xl p-4 font-mono text-xs space-y-4 border border-slate-800 shadow-inner" data-testid="card-track-result">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <span className="font-bold text-orange-400">Resultado do Diagnóstico SRO — Código {trackResult.tracking_code}</span>
                <Badge variant={trackResult.ok ? 'success' : 'error'}>{trackResult.ok ? 'SUCESSO' : 'ATENÇÃO'}</Badge>
              </div>

              {/* Passos de execução */}
              {trackResult.steps?.map((st) => (
                <div key={st.step} className="bg-slate-950/70 p-3 rounded-lg border border-slate-800 space-y-1.5">
                  <div className="flex items-center justify-between text-slate-300 font-bold">
                    <span>Passo {st.step}: {st.title}</span>
                    <span className={`px-2 py-0.5 rounded text-[10px] ${st.ok ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' : 'bg-red-950 text-red-400 border border-red-800'}`}>
                      HTTP {st.status_code || '---'} ({st.duration_ms || 0}ms)
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-400 truncate"><b>Endpoint:</b> {st.endpoint}</div>
                  {st.headers && (
                    <div className="text-[11px] text-slate-400"><b>Headers:</b> {JSON.stringify(st.headers)}</div>
                  )}
                  {st.payload && (
                    <div className="text-[11px] text-slate-400"><b>Payload:</b> {JSON.stringify(st.payload)}</div>
                  )}
                  {st.response_body && (
                    <div className="mt-1 bg-slate-900 p-2 rounded text-[11px] text-emerald-300 max-h-40 overflow-y-auto whitespace-pre-wrap border border-slate-800">
                      {typeof st.response_body === 'object' ? JSON.stringify(st.response_body, null, 2) : String(st.response_body)}
                    </div>
                  )}
                </div>
              ))}

              {/* Lista de eventos parseados */}
              {trackResult.events && trackResult.events.length > 0 && (
                <div className="border-t border-slate-800 pt-3">
                  <div className="text-slate-300 font-bold mb-2">Eventos de Rastreamento Encontrados ({trackResult.events.length}):</div>
                  <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                    {trackResult.events.map((ev, idx) => (
                      <div key={idx} className="flex gap-3 bg-slate-950 p-2.5 rounded border border-slate-800 text-slate-300">
                        <div className="text-orange-400 shrink-0 font-bold">{ev.date} {ev.time}</div>
                        <div>
                          <div className="font-bold text-slate-100">{ev.status}</div>
                          <div className="text-[11px] text-slate-400">{ev.location} — {ev.description}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 3. Formas de Envio */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
        <h2 className="font-heading font-bold text-base text-slate-900">Formas de Envio:</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <label
            className={`flex items-center justify-center gap-2 p-3 rounded-xl border-2 cursor-pointer font-bold text-sm transition ${
              cfg.shipping_enable_pac ? 'bg-slate-900 text-white border-slate-900' : 'bg-slate-50 text-slate-600 border-slate-200'
            }`}
            data-testid="toggle-pac"
          >
            <input
              type="checkbox"
              checked={!!cfg.shipping_enable_pac}
              onChange={(e) => setField('shipping_enable_pac', e.target.checked)}
              className="sr-only"
            />
            {cfg.shipping_enable_pac && <Check className="w-4 h-4 text-emerald-400" />} Pac
          </label>

          <label
            className={`flex items-center justify-center gap-2 p-3 rounded-xl border-2 cursor-pointer font-bold text-sm transition ${
              cfg.shipping_enable_sedex ? 'bg-slate-900 text-white border-slate-900' : 'bg-slate-50 text-slate-600 border-slate-200'
            }`}
            data-testid="toggle-sedex"
          >
            <input
              type="checkbox"
              checked={!!cfg.shipping_enable_sedex}
              onChange={(e) => setField('shipping_enable_sedex', e.target.checked)}
              className="sr-only"
            />
            {cfg.shipping_enable_sedex && <Check className="w-4 h-4 text-emerald-400" />} Sedex
          </label>

          <label
            className={`flex items-center justify-center gap-2 p-3 rounded-xl border-2 cursor-pointer font-bold text-sm transition ${
              cfg.shipping_enable_pickup ? 'bg-slate-900 text-white border-slate-900' : 'bg-slate-50 text-slate-600 border-slate-200'
            }`}
            data-testid="toggle-pickup-btn"
          >
            <input
              type="checkbox"
              checked={!!cfg.shipping_enable_pickup}
              onChange={(e) => {
                setField('shipping_enable_pickup', e.target.checked);
                setField('pickup_enabled', e.target.checked);
              }}
              className="sr-only"
            />
            {cfg.shipping_enable_pickup && <Check className="w-4 h-4 text-emerald-400" />} Retirada no Local
          </label>

          <label
            className={`flex items-center justify-center gap-2 p-3 rounded-xl border-2 cursor-pointer font-bold text-sm transition ${
              cfg.shipping_enable_melhorenvio ? 'bg-slate-900 text-white border-slate-900' : 'bg-slate-50 text-slate-600 border-slate-200'
            }`}
            data-testid="toggle-melhorenvio"
          >
            <input
              type="checkbox"
              checked={!!cfg.shipping_enable_melhorenvio}
              onChange={(e) => setField('shipping_enable_melhorenvio', e.target.checked)}
              className="sr-only"
            />
            {cfg.shipping_enable_melhorenvio && <Check className="w-4 h-4 text-emerald-400" />} Melhor Envio
          </label>
        </div>

        {cfg.shipping_enable_melhorenvio && (
          <div className="pt-2">
            <label className="block text-xs font-bold text-slate-700 mb-1">Token Melhor Envio:</label>
            <input
              type="password"
              value={cfg.shipping_melhorenvio_token || ''}
              onChange={(e) => setField('shipping_melhorenvio_token', e.target.value)}
              placeholder="Cole seu Bearer Token JWT do painel do Melhor Envio"
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-semibold focus:bg-white focus:ring-2 focus:ring-orange-500 outline-none"
              data-testid="input-melhorenvio-token"
            />
          </div>
        )}
      </div>

      {/* 4. Testar Cotação de Frete em Tempo Real */}
      <div className="bg-white rounded-2xl border border-orange-200/80 p-6 shadow-sm space-y-4">
        <h2 className="font-heading font-bold text-base text-slate-900">Testar Cotação de Frete em Tempo Real</h2>
        <div className="flex gap-3 flex-wrap sm:flex-nowrap">
          <input
            type="text"
            value={freightCepInput}
            onChange={(e) => setFreightCepInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && runFreightTest()}
            placeholder="Digite um CEP de Destino (Ex: 01001-000)"
            className="flex-1 px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-semibold focus:bg-white focus:ring-2 focus:ring-orange-500 outline-none"
            data-testid="input-freight-test-cep"
          />
          <Button
            onClick={runFreightTest}
            loading={freightTesting}
            className="bg-orange-600 hover:bg-orange-700 text-white font-bold px-6 shrink-0"
            data-testid="btn-test-freight"
          >
            <Truck className="w-4 h-4 mr-2" /> Calcular Frete
          </Button>
        </div>

        {freightResult && (
          <div className="mt-3 bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3" data-testid="card-freight-result">
            <div className="text-xs font-bold text-slate-700">
              Opções retornadas ({freightResult.options?.length || 0}) — Pacote {freightResult.package?.weight_kg}kg ({freightResult.package?.length_cm}x{freightResult.package?.width_cm}x{freightResult.package?.height_cm}cm):
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {freightResult.options?.map((opt, i) => (
                <div key={i} className="flex items-center justify-between p-3 bg-white rounded-lg border border-slate-200 shadow-sm">
                  <div>
                    <span className="font-bold text-sm text-slate-900">{opt.label}</span>
                    <span className="text-xs text-slate-500 ml-2">({opt.carrier || 'Correios'})</span>
                    <div className="text-xs text-slate-500 mt-0.5">Prazo estimado: <b>{opt.deadline_days} dias úteis</b></div>
                  </div>
                  <div className="text-right font-black text-orange-600 text-base">
                    {formatCurrency(opt.price)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 5. Card Dark: Rastreamento Automático & Alertas por E-mail */}
      <div className="bg-[#0B132B] text-white rounded-3xl p-6 sm:p-8 space-y-6 shadow-xl border border-slate-800" data-testid="dark-card-tracking">
        {/* Top Header Card Dark */}
        <div className="flex items-center justify-between flex-wrap gap-4 border-b border-slate-800 pb-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-amber-500/10 border border-amber-500/30 text-amber-400 rounded-2xl">
              <Clock className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-heading font-black text-lg text-white">Rastreamento Automático & Alertas por E-mail</h2>
                <Badge variant={cfg.shipping_tracking_enabled ? 'success' : 'warning'}>
                  {cfg.shipping_tracking_enabled ? 'Cron Ativo' : 'Cron Inativo'}
                </Badge>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Monitora pedidos em transporte, atualiza o status para Entregue e avisa os clientes.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 bg-slate-900/80 px-4 py-2 rounded-xl border border-slate-800">
            <span className="text-xs font-bold text-slate-300">Monitoramento:</span>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={!!cfg.shipping_tracking_enabled}
                onChange={(e) => setField('shipping_tracking_enabled', e.target.checked)}
                className="sr-only peer"
                data-testid="toggle-auto-tracking"
              />
              <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-600"></div>
            </label>
          </div>
        </div>

        {/* Linha de Controles (Intervalo + Ação Imediata) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-end">
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-2">Intervalo de Checagem dos Pedidos:</label>
            <select
              value={cfg.shipping_tracking_interval_hours || 4}
              onChange={(e) => setField('shipping_tracking_interval_hours', parseInt(e.target.value))}
              className="w-full px-4 py-3 bg-[#1C2541] border border-slate-700 rounded-xl text-sm font-bold text-white focus:ring-2 focus:ring-orange-500 outline-none"
              data-testid="select-tracking-interval"
            >
              <option value={1}>A cada 1 hora</option>
              <option value={2}>A cada 2 horas</option>
              <option value={4}>A cada 4 horas (Recomendado)</option>
              <option value={6}>A cada 6 horas</option>
              <option value={12}>A cada 12 horas</option>
              <option value={24}>A cada 24 horas</option>
            </select>
          </div>

          <div>
            <span className="block text-xs font-bold text-slate-300 mb-2">Ação Imediata:</span>
            <Button
              onClick={runImmediateSync}
              loading={syncing}
              className="w-full bg-orange-600 hover:bg-orange-700 text-white font-bold py-3 px-6 rounded-xl shadow-lg flex items-center justify-center gap-2"
              data-testid="btn-sync-tracking-now"
            >
              <ZapIcon className="w-4 h-4 text-amber-300 fill-amber-300" /> Sincronizar e Rastrear Pedidos Agora
            </Button>
          </div>
        </div>

        {/* Retorno do Sync Manual */}
        {syncResult && (
          <div className="bg-slate-900/90 border border-slate-800 p-4 rounded-2xl text-xs space-y-1 text-slate-300" data-testid="card-sync-result">
            <div className="font-bold text-orange-400">Varredura de Rastreamento Executada:</div>
            <div>
              • <b>{syncResult.checked || 0}</b> pedido(s) em transporte verificados.
            </div>
            <div>
              • <b>{syncResult.delivered_count || 0}</b> pedido(s) atualizados para <b>Entregue</b>.
            </div>
            <div>
              • <b>{syncResult.notifications_sent || 0}</b> e-mail(s) de alerta enviados aos clientes.
            </div>
          </div>
        )}

        {/* Grid de Cards de E-mail Configurados */}
        <div className="space-y-3 pt-2 border-t border-slate-800/80">
          <span className="text-[11px] font-bold tracking-wider uppercase text-slate-400 block">
            ALERTAS E DISPAROS POR E-MAIL CONFIGURADOS:
          </span>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Card 1: Pedido Entregue */}
            <div className="bg-[#1C2541]/90 border border-emerald-500/30 rounded-2xl p-4 space-y-2">
              <div className="flex items-center gap-2.5">
                <span className="text-xl">🎁</span>
                <span className="font-bold text-sm text-emerald-400">Pedido Entregue</span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Muda status para Entregue e envia e-mail de confirmação ao cliente.
              </p>
            </div>

            {/* Card 2: Carteiro Não Atendido */}
            <div className="bg-[#1C2541]/90 border border-amber-500/30 rounded-2xl p-4 space-y-2">
              <div className="flex items-center gap-2.5">
                <span className="text-xl">⚠️</span>
                <span className="font-bold text-sm text-amber-400">Carteiro Não Atendido</span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Avisa o cliente por e-mail sobre a nova tentativa no próximo dia útil.
              </p>
            </div>

            {/* Card 3: Aguardando Retirada */}
            <div className="bg-[#1C2541]/90 border border-blue-500/30 rounded-2xl p-4 space-y-2">
              <div className="flex items-center gap-2.5">
                <span className="text-xl">📍</span>
                <span className="font-bold text-sm text-blue-400">Aguardando Retirada</span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Envia e-mail com instruções e endereço da agência dos Correios para retirada.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ZapIcon(props) {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  );
}
