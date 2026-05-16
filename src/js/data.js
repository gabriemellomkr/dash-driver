/**
 * DashDriver - Data Management
 * Local and Supabase data synchronization.
 */

window.data = {
  async loadAll() {
    try {
      await Promise.all([
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
      custoRevisao: data.custo_revisao || 0,
      kmRevisao:    data.km_revisao    || 0,
      precoKm:      data.preco_km      || 0,
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
    const { data, error } = await sb.get('dashdriver_promos', '?order=id.desc');
    if (!error) {
      APP_STATE.promos = data;
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
