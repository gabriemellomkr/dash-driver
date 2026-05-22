/**
 * DashDriver - Data Management
 * Local and Supabase data synchronization.
 */

window.data = {
  async loadAll() {
    try {
      await Promise.all([
        this.loadPlan(),      // plano primeiro — usado para bloquear acesso
        this.loadConfig(),
        this.loadCorridas(),
        this.loadAbastecimentos(),
        this.loadOutrasDespesas(),
        this.loadOutrasEntradas(),
        this.loadJornadas(),
        this.loadPromos(),
        this.loadMetas()
      ]);
      return true;
    } catch (e) {
      console.error("Erro ao carregar dados:", e);
      return false;
    }
  },

  async loadPlan() {
    if (!APP_STATE.user) return;
    const { data, error } = await supabase
      .from('dashdriver_plans')
      .select('plano, trial_ends_at, expires_at, stripe_customer_id, stripe_subscription_id')
      .eq('user_id', APP_STATE.user.id)
      .maybeSingle();

    // Sem registro → trata como trial sem data (admin pode não ter criado ainda)
    APP_STATE.plan = (!error && data) ? data : { plano: 'trial', trial_ends_at: null, expires_at: null };
  },

  async loadConfig() {
    if (!APP_STATE.user) return;
    const { data, error } = await supabase
      .from('dashdriver_config')
      .select('*')
      .eq('user_id', APP_STATE.user.id)
      .maybeSingle();

    if (error) { console.warn('loadConfig:', error.message); return; }
    if (!data) return;

    Object.assign(CONFIG_DATA, {
      nome:         data.nome          || CONFIG_DATA.nome,
      precoLitro:   data.preco_litro   || 0,
      consumo:      data.consumo       || 0,
      metaDiaria:   data.meta_diaria   || 0,
      metaSemanal:  data.meta_semanal  || 0,
      metaMensal:   data.meta_mensal   || 0,
      custoRevisao: data.custo_revisao || 0,
      kmRevisao:    data.km_revisao    || 0,
      precoKm:      data.preco_km      || 0,
      timezone:     data.timezone      || CONFIG_DATA.timezone,
      telefone:     data.telefone      || '',
    });

    // Veículo: salva no localStorage como cache local
    if (data.veiculo && Object.keys(data.veiculo).length > 0) {
      localStorage.setItem('dd_veiculo', JSON.stringify(data.veiculo));
    }

    // Atualiza cache local
    localStorage.setItem('dash_config', JSON.stringify(CONFIG_DATA));
  },

  async loadCorridas() {
    const { data, error } = await sb.get('dashdriver_corridas', '?order=data.desc,id.desc');
    if (!error) {
      APP_STATE.corridas = data.map(r => ({
        id: r.id,
        data: r.data,
        plat: r.plataforma,
        pag: r.pagamento,
        km: parseFloat(r.km) || 0,
        bruto: parseFloat(r.bruto) || 0,
        liquido: parseFloat(r.liquido) || 0,
        outras: parseFloat(r.outras) || 0,
        tempo: parseFloat(r.tempo) || 0
      }));
    }
  },

  async loadAbastecimentos() {
    const { data, error } = await sb.get('dashdriver_abastecimentos', '?order=data.desc,id.desc');
    if (!error) {
      APP_STATE.abastecimentos = data.map(r => ({
        id: r.id,
        data: r.data,
        valor: parseFloat(r.valor) || 0,
        litros: parseFloat(r.litros) || 0
      }));
    }
  },

  async loadOutrasDespesas() {
    const { data, error } = await sb.get('dashdriver_outras_despesas', '?order=data.desc,id.desc');
    if (!error) {
      APP_STATE.despesas = data.map(r => ({
        id: r.id,
        data: r.data,
        categoria: r.categoria,
        descricao: r.descricao || '',
        valor: parseFloat(r.valor) || 0
      }));
    }
  },

  async loadOutrasEntradas() {
    const { data, error } = await sb.get('dashdriver_outras_entradas', '?order=data.desc,id.desc');
    if (!error) {
      APP_STATE.entradas = data.map(r => ({
        id: r.id,
        data: r.data,
        categoria: r.categoria,
        descricao: r.descricao || '',
        valor: parseFloat(r.valor) || 0
      }));
    }
  },

  async loadJornadas() {
    const { data, error } = await sb.get('dashdriver_jornadas', '?order=data.desc,id.desc');
    if (!error) {
      APP_STATE.jornadas = data.map(r => ({
        id: r.id,
        data: r.data,
        inicio: r.inicio,
        fim: r.fim
      }));
    }
  },

  async loadPromos() {
    if (!APP_STATE.user) return;
    const { data: rows, error } = await supabase
      .from('dashdriver_promos')
      .select('*')
      .eq('user_id', APP_STATE.user.id)
      .eq('ativa', true)
      .order('data_fim', { ascending: true });
    if (!error && rows) {
      APP_STATE.promos = rows.map(r => ({
        id:           r.id,
        plat:         r.plataforma,
        desc:         r.descricao,
        inicio:       r.data_inicio,
        fim:          r.data_fim,
        metaCorridas: r.meta_corridas,
        bonus:        r.bonus_valor,
        ativa:        r.ativa,
      }));
    }
  },

  async loadMetas() {
    const { data, error } = await sb.get('dashdriver_metas', '?order=id.desc');
    if (!error) {
      APP_STATE.metas = data;
    }
  },

  async saveCorrida(item) {
    const res = await sb.post('dashdriver_corridas', item);
    await this.loadCorridas();
    return res;
  },

  async deleteCorrida(id) {
    const res = await sb.delete('dashdriver_corridas', `?id=eq.${id}`);
    await this.loadCorridas();
    return res;
  }
};
