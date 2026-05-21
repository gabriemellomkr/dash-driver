/* DashDriver — Importação de Corrida via Print (OCR) */

/**
 * Abre o seletor de imagem para importar um print de corrida.
 */
window.triggerOCR = function() {
  const input = document.getElementById('ocr-input');
  if (input) input.click();
};

/**
 * Chamado quando o usuário seleciona uma imagem.
 * Comprime, envia para a API de OCR e preenche o formulário.
 */
window.handleOCRImage = async function(input) {
  const file = input.files[0];
  if (!file) return;
  input.value = ''; // reset para permitir selecionar o mesmo arquivo de novo

  const btn = document.getElementById('btn-ocr');
  const originalHTML = btn ? btn.innerHTML : '';
  if (btn) {
    btn.innerHTML = '<span class="material-symbols-outlined animate-spin" style="font-size:14px">sync</span> Analisando...';
    btn.disabled = true;
  }

  // Overlay de loading no modal
  const form = document.getElementById('form-corrida');
  let overlay = null;
  if (form) {
    overlay = document.createElement('div');
    overlay.id = 'ocr-overlay';
    overlay.style.cssText = `
      position:absolute;inset:0;background:rgba(0,0,0,0.65);
      display:flex;flex-direction:column;align-items:center;justify-content:center;
      border-radius:1.5rem;z-index:50;gap:12px;backdrop-filter:blur(2px)
    `;
    overlay.innerHTML = `
      <span class="material-symbols-outlined animate-spin" style="font-size:40px;color:#60a5fa">sync</span>
      <p style="color:#93c5fd;font-size:13px;font-weight:600;margin:0">Analisando o print…</p>
      <p style="color:#6b7280;font-size:11px;margin:0">Isso leva alguns segundos</p>
    `;
    // Posiciona no container pai do modal (relativo)
    const modalBox = form.closest('.glass-strong') || form.parentElement;
    if (modalBox) {
      modalBox.style.position = 'relative';
      modalBox.appendChild(overlay);
    }
  }

  try {
    // Comprime a imagem antes de enviar (reduz para max 1200px e qualidade 80%)
    // compressImage (global, definida em index.html) retorna a dataURL completa
    const dataUrl = await compressImage(file, 1200, 0.8);
    const base64  = typeof dataUrl === 'object' ? dataUrl.base64 : dataUrl.split(',')[1];
    const mimeType = 'image/jpeg';

    const res = await fetch('/api/ocr-corrida', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        image_base64: base64,
        mime_type: mimeType,
        user_id: (typeof APP_STATE !== 'undefined' && APP_STATE.user?.id) || null,
      })
    });

    if (!res.ok) {
      let errMsg = 'Erro ao processar print';
      try {
        const err = await res.json();
        errMsg = err.error || errMsg;
      } catch (_) {}
      utils.toast('❌ ' + errMsg, 'error');
      return;
    }

    const data = await res.json();

    if (data.confianca === 'baixa') {
      utils.toast('❓ Não consegui identificar a corrida nesse print', 'error');
      return;
    }

    applyOCRData(data);

    const icon = data.confianca === 'alta' ? '✅' : '⚠️';
    const msg  = data.confianca === 'alta'
      ? 'Print importado! Confira e salve.'
      : 'Importado com dúvidas — confira os valores.';
    utils.toast(`${icon} ${msg}`, 'success');

  } catch (e) {
    console.error('OCR error:', e);
    utils.toast('❌ Erro ao ler a imagem', 'error');
  } finally {
    if (btn) {
      btn.innerHTML = originalHTML;
      btn.disabled = false;
    }
    // Remove overlay de loading
    if (overlay) overlay.remove();
  }
};

/**
 * Comprime uma imagem usando Canvas e retorna base64 + mimeType.
 */
function compressImage(file, maxSize, quality) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        let { width, height } = img;

        // Reduz mantendo proporção
        if (width > maxSize || height > maxSize) {
          if (width > height) {
            height = Math.round((height / width) * maxSize);
            width = maxSize;
          } else {
            width = Math.round((width / height) * maxSize);
            height = maxSize;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        const mimeType = 'image/jpeg'; // sempre converte para JPEG na compressão
        const dataUrl = canvas.toDataURL(mimeType, quality);
        const base64 = dataUrl.split(',')[1];
        resolve({ base64, mimeType });
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Aplica os dados extraídos do OCR no formulário de corrida.
 */
function applyOCRData(data) {
  // Plataforma
  if (data.plataforma) {
    const platBtn = Array.from(document.querySelectorAll('.plat-btn'))
      .find(b => b.innerText.trim().includes(data.plataforma));
    if (platBtn) setPlat(data.plataforma, platBtn);
  }

  // Tipo (normal/cancelamento)
  if (data.tipo) setTipoReg(data.tipo);

  // Data
  if (data.data) {
    const fData = document.getElementById('f-data');
    if (fData) fData.value = data.data;
  }

  // KM
  if (data.km != null && data.km > 0) {
    const fKm = document.getElementById('f-km');
    if (fKm) {
      fKm.disabled = false;
      fKm.value = data.km;
    }
  }

  // Valores — depende do modo (split ou direto)
  const plat     = document.getElementById('f-plataforma')?.value || '';
  const isDireto = (typeof PLAT_DIRETO !== 'undefined') && PLAT_DIRETO.includes(plat);

  if (isDireto) {
    if (data.liquido != null) {
      const el = document.getElementById('f-liquido-direto');
      if (el) el.value = data.liquido;
    }
    if (typeof calcQuickStatsDireto === 'function') calcQuickStatsDireto();
  } else {
    if (data.bruto != null) {
      const el = document.getElementById('f-bruto');
      if (el) el.value = data.bruto;
    }
    if (data.liquido != null) {
      const el = document.getElementById('f-liquido');
      if (el) el.value = data.liquido;
    }
    if (typeof calcQuickStats === 'function') calcQuickStats();
  }

  // Pagamento
  if (data.pagamento) {
    // Mapeia "App" para o botão "APP / Cartão"
    const pagTarget = data.pagamento === 'App' ? 'APP' : data.pagamento;
    const pagBtn = Array.from(document.querySelectorAll('.pag-btn'))
      .find(b => b.innerText.trim().toUpperCase().includes(pagTarget.toUpperCase()));
    if (pagBtn) setPag(data.pagamento, pagBtn);
  }
}
