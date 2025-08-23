import React, { useMemo, useState } from 'react';
import {
  X,
  Save,
  Type,
  Image,
  FileText,
  Film,
  Plus,
  Trash2,
  AlertCircle,
  Info
} from 'lucide-react';

const CATEGORIES = [
  { value: 'UTILITY', label: 'Utility', desc: 'Atualizações de conta, alertas, etc.' },
  { value: 'MARKETING', label: 'Marketing', desc: 'Promoções, ofertas, newsletters' },
  { value: 'AUTHENTICATION', label: 'Authentication', desc: 'Códigos OTP, verificações' },
];

const LANGS = [
  { code: 'pt_BR', label: 'Português (Brasil)' },
  { code: 'pt_PT', label: 'Português (Portugal)' },
  { code: 'en_US', label: 'English (US)' },
  { code: 'en_GB', label: 'English (UK)' },
  { code: 'es_ES', label: 'Español (España)' },
  { code: 'es_MX', label: 'Español (México)' },
  { code: 'fr_FR', label: 'Français (France)' },
  { code: 'de_DE', label: 'Deutsch (Deutschland)' },
  { code: 'it_IT', label: 'Italiano (Italia)' },
];

const HEADER_TYPES = [
  { value: 'NONE', label: 'Nenhum', icon: null },
  { value: 'TEXT', label: 'Texto', icon: Type },
  { value: 'IMAGE', label: 'Imagem', icon: Image },
  { value: 'DOCUMENT', label: 'Documento', icon: FileText },
  { value: 'VIDEO', label: 'Vídeo', icon: Film },
];

// Funções de validação WhatsApp
const validateTemplateName = (name) => {
  if (!name) return 'Nome é obrigatório';
  if (!/^[a-z0-9_]+$/.test(name)) return 'Use apenas letras minúsculas, números e underscore';
  if (name.length < 1 || name.length > 512) return 'Nome deve ter entre 1 e 512 caracteres';
  return null;
};

const extractVariables = (text) => {
  if (!text) return [];
  const matches = text.match(/\{\{\d+\}\}/g) || [];
  return matches.map(m => parseInt(m.replace(/[{}]/g, ''))).sort((a, b) => a - b);
};

const validateVariables = (text, context = 'texto') => {
  const vars = extractVariables(text);
  if (!vars.length) return null;
  
  // Variáveis devem ser sequenciais começando do 1
  for (let i = 0; i < vars.length; i++) {
    if (vars[i] !== i + 1) {
      return `${context}: variáveis devem ser sequenciais ({{1}}, {{2}}, {{3}}...)`;
    }
  }
  return null;
};

const MAX_BUTTONS = 3; // WhatsApp permite até 3 botões de ação
const MAX_QUICK_REPLIES = 3; // WhatsApp permite até 3 respostas rápidas

export default function TemplateModal({ 
  isOpen = true, 
  onClose = () => {}, 
  onCreated = () => {},
  onSyncStatus = null, // Callback para sincronizar status
  templateToEdit = null // Para edição futura
}) {
  // Estados básicos
  const [name, setName] = useState('');
  const [language, setLanguage] = useState('pt_BR');
  const [category, setCategory] = useState('MARKETING');

  // Cabeçalho
  const [headerType, setHeaderType] = useState('NONE');
  const [headerText, setHeaderText] = useState('');
  const [headerExample, setHeaderExample] = useState('');

  // Corpo e rodapé
  const [bodyText, setBodyText] = useState(`Olá {{1}}, seu pedido foi confirmado!`);
  const [footerText, setFooterText] = useState('');

  // Botões
  const [buttonType, setButtonType] = useState('NONE'); // NONE, CALL_TO_ACTION, QUICK_REPLY
  const [callToActionButtons, setCallToActionButtons] = useState([]);
  const [quickReplies, setQuickReplies] = useState([]);

  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});
  const [syncingStatus, setSyncingStatus] = useState(false);

  // Função para sincronizar status de um template
  const syncTemplateStatus = async (templateId) => {
    if (!templateId || syncingStatus) return;
    
    setSyncingStatus(true);
    try {
      const result = await apiCall(`/templates/${templateId}/sync`, {
        method: 'POST'
      });
      
      console.log('Status sincronizado:', result);
      
      if (onSyncStatus) {
        onSyncStatus(templateId, result);
      }
      
      return result;
    } catch (error) {
      console.error('Erro ao sincronizar status:', error);
      throw error;
    } finally {
      setSyncingStatus(false);
    }
  };

  // Função para deletar template
  const deleteTemplate = async (templateId) => {
    if (!templateId) return;
    
    try {
      await apiCall(`/templates/${templateId}`, {
        method: 'DELETE'
      });
      
      console.log('Template deletado:', templateId);
      return true;
    } catch (error) {
      console.error('Erro ao deletar template:', error);
      throw error;
    }
  };

  // Validações em tempo real
  const validations = useMemo(() => {
    const errs = {};

    // Nome
    const nameErr = validateTemplateName(name);
    if (nameErr) errs.name = nameErr;

    // Cabeçalho
    if (headerType === 'TEXT' && !headerText.trim()) {
      errs.headerText = 'Texto do cabeçalho é obrigatório quando tipo TEXT é selecionado';
    }
    if (headerType === 'TEXT') {
      const headerVarErr = validateVariables(headerText, 'Cabeçalho');
      if (headerVarErr) errs.headerText = headerVarErr;
    }

    // Corpo (obrigatório)
    if (!bodyText.trim()) {
      errs.bodyText = 'Corpo da mensagem é obrigatório';
    } else {
      const bodyVarErr = validateVariables(bodyText, 'Corpo');
      if (bodyVarErr) errs.bodyText = bodyVarErr;
    }

    // Rodapé
    if (footerText && footerText.length > 60) {
      errs.footerText = 'Rodapé deve ter no máximo 60 caracteres';
    }

    // Botões de ação
    if (buttonType === 'CALL_TO_ACTION') {
      if (!callToActionButtons.length) {
        errs.buttons = 'Adicione pelo menos 1 botão de ação';
      } else {
        callToActionButtons.forEach((btn, idx) => {
          if (!btn.text?.trim()) {
            errs[`button_${idx}_text`] = 'Texto do botão é obrigatório';
          }
          if (btn.type === 'URL' && !btn.url?.trim()) {
            errs[`button_${idx}_url`] = 'URL é obrigatória';
          }
          if (btn.type === 'PHONE_NUMBER' && !btn.phone_number?.trim()) {
            errs[`button_${idx}_phone`] = 'Número de telefone é obrigatório';
          }
        });
      }
    }

    // Respostas rápidas
    if (buttonType === 'QUICK_REPLY') {
      if (!quickReplies.length) {
        errs.buttons = 'Adicione pelo menos 1 resposta rápida';
      } else {
        quickReplies.forEach((reply, idx) => {
          if (!reply.text?.trim()) {
            errs[`quick_${idx}_text`] = 'Texto da resposta é obrigatório';
          }
        });
      }
    }

    return errs;
  }, [name, headerType, headerText, bodyText, footerText, buttonType, callToActionButtons, quickReplies]);

  const canSave = Object.keys(validations).length === 0;

  // Manipuladores de botões
  const addCallToActionButton = () => {
    if (callToActionButtons.length >= MAX_BUTTONS) return;
    setCallToActionButtons([...callToActionButtons, { type: 'URL', text: '', url: '' }]);
  };

  const updateCallToActionButton = (index, updates) => {
    const updated = callToActionButtons.map((btn, idx) => 
      idx === index ? { ...btn, ...updates } : btn
    );
    setCallToActionButtons(updated);
  };

  const removeCallToActionButton = (index) => {
    setCallToActionButtons(callToActionButtons.filter((_, idx) => idx !== index));
  };

  const addQuickReply = () => {
    if (quickReplies.length >= MAX_QUICK_REPLIES) return;
    setQuickReplies([...quickReplies, { text: '' }]);
  };

  const updateQuickReply = (index, updates) => {
    const updated = quickReplies.map((reply, idx) => 
      idx === index ? { ...reply, ...updates } : reply
    );
    setQuickReplies(updated);
  };

  const removeQuickReply = (index) => {
    setQuickReplies(quickReplies.filter((_, idx) => idx !== index));
  };

  // Função para chamadas à API
  const apiCall = async (endpoint, options = {}) => {
    const baseUrl = '/api/v1'; // Ajuste conforme sua configuração
    const url = `${baseUrl}${endpoint}`;
    
    const defaultOptions = {
      headers: {
        'Content-Type': 'application/json',
      },
    };

    const response = await fetch(url, { ...defaultOptions, ...options });
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || `Erro HTTP: ${response.status}`);
    }

    return data;
  };

  // Envio do template
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canSave || saving) return;

    setSaving(true);
    setErrors({});

    try {
      // Preparar dados dos botões conforme API do WhatsApp
      let buttons = null;
      if (buttonType === 'CALL_TO_ACTION' && callToActionButtons.length) {
        buttons = callToActionButtons.map(btn => ({
          type: btn.type,
          text: btn.text.trim(),
          ...(btn.type === 'URL' ? { url: btn.url.trim() } : { phone_number: btn.phone_number.trim() })
        }));
      } else if (buttonType === 'QUICK_REPLY' && quickReplies.length) {
        buttons = quickReplies.map(reply => ({
          type: 'QUICK_REPLY',
          text: reply.text.trim()
        }));
      }

      // Preparar payload conforme esperado pela API
      const templatePayload = {
        name: name.trim(),
        language_code: language,
        category,
        header_type: headerType,
        header_text: headerType === 'TEXT' ? (headerText.trim() || null) : null,
        body_text: bodyText.trim(),
        footer_text: footerText.trim() || null,
        buttons,
        example: headerExample.trim() ? { header_url: headerExample.trim() } : null,
      };

      console.log('Enviando template para API:', templatePayload);

      // 1. Criar template local (draft)
      const createdTemplate = await apiCall('/templates', {
        method: 'POST',
        body: JSON.stringify(templatePayload)
      });

      console.log('Template local criado:', createdTemplate);

      // 2. Submeter para aprovação no WhatsApp
      const submitResult = await apiCall(`/templates/${createdTemplate.id}/submit`, {
        method: 'POST'
      });

      console.log('Template submetido para aprovação:', submitResult);

      // Resetar form
      setName('');
      setLanguage('pt_BR');
      setCategory('MARKETING');
      setHeaderType('NONE');
      setHeaderText('');
      setHeaderExample('');
      setBodyText(`Olá {{1}}, seu pedido foi confirmado!`);
      setFooterText('');
      setButtonType('NONE');
      setCallToActionButtons([]);
      setQuickReplies([]);
      
      // Callback para atualizar lista
      onCreated?.(createdTemplate);
      
      alert('Template criado e enviado para aprovação no WhatsApp com sucesso!');

    } catch (error) {
      console.error('Erro ao criar template:', error);
      
      // Tratar diferentes tipos de erro
      let errorMessage = 'Erro desconhecido ao criar template';
      
      if (error.message) {
        if (error.message.includes('WHATSAPP_TOKEN')) {
          errorMessage = 'Configuração do token WhatsApp ausente no servidor';
        } else if (error.message.includes('Graph API')) {
          errorMessage = 'Erro na API do WhatsApp: ' + error.message;
        } else if (error.message.includes('BUSINESS_ID')) {
          errorMessage = 'ID do negócio WhatsApp não configurado';
        } else {
          errorMessage = error.message;
        }
      }
      
      setErrors({ general: errorMessage });
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-gray-900/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h3 className="text-xl font-bold text-gray-900">Novo Template WhatsApp</h3>
            <p className="text-sm text-gray-500 mt-1">Crie um modelo de mensagem para aprovação</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label="Fechar"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content - Scrollable */}
        <div className="flex-1 overflow-auto">
          <div className="p-6 space-y-6">
            {errors.general && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
                <AlertCircle className="text-red-500 mt-0.5" size={20} />
                <div>
                  <div className="text-red-700 font-medium">Erro ao processar template</div>
                  <div className="text-red-600 text-sm mt-1">{errors.general}</div>
                  <div className="text-red-500 text-xs mt-2">
                    Verifique as configurações do servidor (tokens, IDs) ou tente novamente.
                  </div>
                </div>
              </div>
            )}

            {/* Nome e Configurações Básicas */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nome do Template *
                </label>
                <input
                  type="text"
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                    errors.name ? 'border-red-300' : 'border-gray-300'
                  }`}
                  placeholder="meu_template_promocional"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoFocus
                />
                {errors.name && (
                  <p className="text-red-600 text-xs mt-1">{errors.name}</p>
                )}
                <p className="text-gray-500 text-xs mt-1">
                  Apenas letras minúsculas, números e underscore
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Idioma *
                </label>
                <select
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                >
                  {LANGS.map(lang => (
                    <option key={lang.code} value={lang.code}>
                      {lang.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Categoria */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Categoria *
              </label>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {CATEGORIES.map(cat => (
                  <label
                    key={cat.value}
                    className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                      category === cat.value
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name="category"
                      value={cat.value}
                      checked={category === cat.value}
                      onChange={(e) => setCategory(e.target.value)}
                      className="sr-only"
                    />
                    <div className="font-medium text-gray-900">{cat.label}</div>
                    <div className="text-sm text-gray-500 mt-1">{cat.desc}</div>
                  </label>
                ))}
              </div>
            </div>

            {/* Cabeçalho */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Cabeçalho (Opcional)
              </label>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mb-4">
                {HEADER_TYPES.map(type => {
                  const Icon = type.icon;
                  const isActive = headerType === type.value;
                  return (
                    <button
                      key={type.value}
                      type="button"
                      className={`p-3 border rounded-lg text-sm font-medium transition-all ${
                        isActive
                          ? 'border-blue-500 bg-blue-50 text-blue-700'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                      onClick={() => {
                        setHeaderType(type.value);
                        if (type.value !== 'TEXT') setHeaderText('');
                      }}
                    >
                      <div className="flex flex-col items-center gap-1">
                        {Icon && <Icon size={18} />}
                        <span>{type.label}</span>
                      </div>
                    </button>
                  );
                })}
              </div>

              {headerType === 'TEXT' && (
                <div>
                  <input
                    type="text"
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                      errors.headerText ? 'border-red-300' : 'border-gray-300'
                    }`}
                    placeholder="Título da mensagem {`{{1}}`}"
                    value={headerText}
                    onChange={(e) => setHeaderText(e.target.value)}
                  />
                  {errors.headerText && (
                    <p className="text-red-600 text-xs mt-1">{errors.headerText}</p>
                  )}
                </div>
              )}

              {headerType !== 'NONE' && headerType !== 'TEXT' && (
                <div>
                  <input
                    type="url"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder={`URL de exemplo para ${headerType.toLowerCase()}`}
                    value={headerExample}
                    onChange={(e) => setHeaderExample(e.target.value)}
                  />
                  <p className="text-gray-500 text-xs mt-1">
                    URL de exemplo para teste (não será enviada na aprovação)
                  </p>
                </div>
              )}
            </div>

            {/* Corpo da Mensagem */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Corpo da Mensagem *
              </label>
              <textarea
                className={`w-full px-3 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                  errors.bodyText ? 'border-red-300' : 'border-gray-300'
                }`}
                rows={4}
                placeholder="Olá {`{{1}}`}, seu pedido {`{{2}}`} foi confirmado! Esperamos você em {`{{3}}`}."
                value={bodyText}
                onChange={(e) => setBodyText(e.target.value)}
              />
              {errors.bodyText && (
                <p className="text-red-600 text-xs mt-1">{errors.bodyText}</p>
              )}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mt-2">
                <div className="flex items-start gap-2">
                  <Info className="text-blue-500 mt-0.5" size={16} />
                  <div className="text-blue-700 text-xs">
                    <div className="font-medium mb-1">Variáveis detectadas:</div>
                    <div>{extractVariables(bodyText).length ? 
                      extractVariables(bodyText).map(v => `{{${v}}}`).join(', ') : 
                      'Nenhuma variável encontrada'}</div>
                    <div className="mt-1">Use {`{{1}}, {{2}}, {{3}}`}... para dados dinâmicos</div>
                    <div className="mt-1 font-medium">Exemplo de uso na API:</div>
                    <div className="bg-white/50 rounded p-2 mt-1 font-mono text-xs">
                      parameters: [{extractVariables(bodyText).map((v, i) => `"valor_${i + 1}"`).join(', ')}]
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Rodapé */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Rodapé (Opcional)
              </label>
              <input
                type="text"
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                  errors.footerText ? 'border-red-300' : 'border-gray-300'
                }`}
                placeholder="Texto opcional do rodapé"
                value={footerText}
                onChange={(e) => setFooterText(e.target.value)}
                maxLength={60}
              />
              {errors.footerText && (
                <p className="text-red-600 text-xs mt-1">{errors.footerText}</p>
              )}
              <p className="text-gray-500 text-xs mt-1">
                {footerText.length}/60 caracteres
              </p>
            </div>

            {/* Botões */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Botões (Opcional)
              </label>
              <div className="grid grid-cols-3 gap-2 mb-4">
                {[
                  { value: 'NONE', label: 'Nenhum' },
                  { value: 'CALL_TO_ACTION', label: 'Ação' },
                  { value: 'QUICK_REPLY', label: 'Resposta Rápida' }
                ].map(type => (
                  <button
                    key={type.value}
                    type="button"
                    className={`p-3 border rounded-lg text-sm font-medium transition-all ${
                      buttonType === type.value
                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                    onClick={() => setButtonType(type.value)}
                  >
                    {type.label}
                  </button>
                ))}
              </div>

              {buttonType === 'CALL_TO_ACTION' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">
                      Botões de Ação ({callToActionButtons.length}/{MAX_BUTTONS})
                    </span>
                    {callToActionButtons.length < MAX_BUTTONS && (
                      <button
                        type="button"
                        onClick={addCallToActionButton}
                        className="flex items-center gap-2 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                      >
                        <Plus size={16} /> Adicionar
                      </button>
                    )}
                  </div>
                  
                  {callToActionButtons.map((btn, index) => (
                    <div key={index} className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <span className="font-medium text-sm">Botão {index + 1}</span>
                        <button
                          type="button"
                          onClick={() => removeCallToActionButton(index)}
                          className="text-red-500 hover:bg-red-50 p-1 rounded"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <select
                          className="px-3 py-2 border border-gray-300 rounded-lg"
                          value={btn.type}
                          onChange={(e) => updateCallToActionButton(index, { 
                            type: e.target.value,
                            ...(e.target.value === 'URL' ? { phone_number: undefined } : { url: undefined })
                          })}
                        >
                          <option value="URL">Abrir URL</option>
                          <option value="PHONE_NUMBER">Ligar</option>
                        </select>
                        
                        <input
                          type="text"
                          className={`px-3 py-2 border rounded-lg ${
                            errors[`button_${index}_text`] ? 'border-red-300' : 'border-gray-300'
                          }`}
                          placeholder="Texto do botão"
                          value={btn.text}
                          onChange={(e) => updateCallToActionButton(index, { text: e.target.value })}
                        />
                        
                        <input
                          type={btn.type === 'URL' ? 'url' : 'tel'}
                          className={`px-3 py-2 border rounded-lg ${
                            errors[`button_${index}_${btn.type === 'URL' ? 'url' : 'phone'}`] ? 'border-red-300' : 'border-gray-300'
                          }`}
                          placeholder={btn.type === 'URL' ? 'https://exemplo.com' : '+5511999999999'}
                          value={btn.type === 'URL' ? (btn.url || '') : (btn.phone_number || '')}
                          onChange={(e) => updateCallToActionButton(index, { 
                            [btn.type === 'URL' ? 'url' : 'phone_number']: e.target.value 
                          })}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {buttonType === 'QUICK_REPLY' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">
                      Respostas Rápidas ({quickReplies.length}/{MAX_QUICK_REPLIES})
                    </span>
                    {quickReplies.length < MAX_QUICK_REPLIES && (
                      <button
                        type="button"
                        onClick={addQuickReply}
                        className="flex items-center gap-2 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                      >
                        <Plus size={16} /> Adicionar
                      </button>
                    )}
                  </div>
                  
                  {quickReplies.map((reply, index) => (
                    <div key={index} className="flex items-center gap-3">
                      <input
                        type="text"
                        className={`flex-1 px-3 py-2 border rounded-lg ${
                          errors[`quick_${index}_text`] ? 'border-red-300' : 'border-gray-300'
                        }`}
                        placeholder="Texto da resposta rápida"
                        value={reply.text}
                        onChange={(e) => updateQuickReply(index, { text: e.target.value })}
                      />
                      <button
                        type="button"
                        onClick={() => removeQuickReply(index)}
                        className="text-red-500 hover:bg-red-50 p-2 rounded"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {errors.buttons && (
                <p className="text-red-600 text-xs mt-2">{errors.buttons}</p>
              )}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 bg-gray-50">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSave || saving}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Save size={16} />
            {saving ? 'Enviando...' : 'Enviar para Aprovação'}
          </button>
        </div>
      </div>
    </div>
  );
}
