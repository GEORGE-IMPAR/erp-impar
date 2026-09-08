/* ERP ÍMPAR — cancelamento e retorno de anexos, V0.8.1.
 * Somente interface: nenhum fetch, armazenamento persistente, navegação externa,
 * criação de sessão, geração de resposta ou alteração de dados do ERP.
 */
(() => {
  'use strict';
  const KEY = '__george_attachment_panel_v081';
  class GeorgeAttachmentPanel {
    constructor({trigger, picker, scrollContainer, onOpen, onClose, onFile}) {
      if (!trigger || !picker) throw new Error('Controles de anexo não encontrados.');
      Object.assign(this, {trigger, picker, scrollContainer, onOpen, onClose, onFile});
      this.isOpen = false;
      this.selected = null;
      this.pickPending = false;
      this.ownsHistory = false;
      this.id = '';
      this.build();
      trigger.onclick = () => this.open();
      picker.addEventListener('change', () => this.selectionChanged());
      picker.addEventListener('cancel', (event) => {
        event.stopPropagation();
        this.pickPending = false;
        if (!this.isOpen) return;
        this.say(this.selected
          ? 'Seleção cancelada. O arquivo anterior continua disponível.'
          : 'Seleção cancelada. Toque em Voltar ao George para continuar a conversa.');
      });
      window.addEventListener('popstate', () => {
        if (this.isOpen && history.state?.[KEY] !== this.id) this.close(false);
      });
      window.addEventListener('focus', () => {
        if (!this.isOpen || !this.pickPending) return;
        // Some mobile pickers omit cancel. Never guess a selected file or send it.
        setTimeout(() => {
          if (this.isOpen && this.pickPending && !this.selected)
            this.say('Escolha um arquivo ou toque em Voltar ao George. Nada foi enviado.');
        }, 400);
      });
    }
    build() {
      const style = document.createElement('style');
      style.textContent = `
        #georgeAttachmentPanel{box-sizing:border-box;width:min(480px,calc(100vw - 24px));max-height:calc(100dvh - 24px);overflow:auto;margin:auto;border:1px solid #dce7ed;border-radius:22px;padding:20px;background:#fafdfd;color:#183b50;box-shadow:0 24px 70px #041a3860;font-family:system-ui,-apple-system,'Segoe UI',sans-serif}
        #georgeAttachmentPanel::backdrop{background:#092b4699;backdrop-filter:blur(4px)}
        #georgeAttachmentPanel h2{margin:0;font-size:23px;line-height:1.25}
        #georgeAttachmentPanel p{font-size:16px;line-height:1.45;margin:12px 0;color:#486575}
        #georgeAttachmentPanel .ga-head{display:flex;align-items:center;justify-content:space-between;gap:12px}
        #georgeAttachmentPanel button{font-family:inherit;font-size:16px;font-weight:750;border-radius:14px;min-height:48px;padding:11px 14px;border:1px solid #d1e2e9;cursor:pointer}
        #georgeAttachmentPanel .ga-x{width:48px;font-size:26px;padding:4px;background:#e9f2f6;color:#164a63}
        #georgeAttachmentPanel .ga-pick{width:100%;background:#e9f3f8;color:#17425c}
        #georgeAttachmentPanel .ga-file{border:1px solid #d6e7ed;border-radius:12px;padding:12px;font-size:15px;overflow-wrap:anywhere;background:white;margin:12px 0}
        #georgeAttachmentPanel .ga-status{font-size:14px;min-height:42px}
        #georgeAttachmentPanel .ga-actions{display:flex;flex-wrap:wrap;gap:10px;margin-top:16px}
        #georgeAttachmentPanel .ga-back{flex:1;background:#edf3f6;color:#244f65}
        #georgeAttachmentPanel .ga-send{flex:1;background:#148ece;color:#fff;border-color:#148ece}
        #georgeAttachmentPanel .ga-send:disabled{opacity:.48;cursor:not-allowed}
        @media(prefers-reduced-motion:reduce){#georgeAttachmentPanel{scroll-behavior:auto}}
      `;
      document.head.appendChild(style);
      const dialog = document.createElement('dialog');
      dialog.id = 'georgeAttachmentPanel';
      dialog.setAttribute('aria-labelledby', 'gaTitle');
      dialog.innerHTML = `
        <div class="ga-head"><h2 id="gaTitle">Anexar ao George</h2><button type="button" class="ga-x" id="gaClose" aria-label="Voltar ao George">×</button></div>
        <p>A conversa permanece nesta tela. Nada será enviado até você confirmar.</p>
        <button type="button" class="ga-pick" id="gaChoose">Escolher arquivo no celular</button>
        <div class="ga-file" id="gaFile">Nenhum arquivo selecionado.</div>
        <p class="ga-status" id="gaStatus" role="status" aria-live="polite">Você pode voltar sem escolher um arquivo.</p>
        <div class="ga-actions"><button type="button" class="ga-back" id="gaBack">Voltar ao George</button><button type="button" class="ga-send" id="gaSend" disabled>Enviar ao George</button></div>
      `;
      document.body.appendChild(dialog);
      this.dialog = dialog;
      this.fileLabel = dialog.querySelector('#gaFile');
      this.status = dialog.querySelector('#gaStatus');
      this.send = dialog.querySelector('#gaSend');
      dialog.querySelector('#gaClose').onclick = () => this.close(true);
      dialog.querySelector('#gaBack').onclick = () => this.close(true);
      dialog.querySelector('#gaChoose').onclick = () => {
        this.pickPending = true;
        this.say('No seletor do celular, escolha um arquivo ou use Cancelar/Voltar.');
        try {
          // Synchronous user gesture. No new tab, link or location assignment.
          this.picker.value = '';
          this.picker.click();
        } catch (error) {
          this.pickPending = false;
          this.say('Não foi possível abrir o seletor. Você pode voltar ao George.');
          console.warn('anexo: seletor', error);
        }
      };
      this.send.onclick = () => {
        if (!this.selected) return;
        const selected = this.selected;
        this.close(true);
        // A File object, not a server path. Existing app processing is unchanged.
        Promise.resolve().then(() => this.onFile?.(selected)).catch((error) => {
          console.error('anexo: processamento', error);
        });
      };
      dialog.addEventListener('cancel', event => {
        event.preventDefault();
        this.close(true);
      });
      dialog.addEventListener('close', () => {
        if (this.isOpen) this.close(true);
      });
    }
    say(message) { this.status.textContent = message; }
    open() {
      if (this.isOpen) return;
      if (typeof this.dialog.showModal !== 'function') {
        // Fail visibly rather than navigate away or open an unknown replacement.
        this.dialog.setAttribute('open', '');
      } else this.dialog.showModal();
      this.isOpen = true;
      this.selected = null;
      this.pickPending = false;
      this.picker.value = '';
      this.scrollTop = this.scrollContainer?.scrollTop || 0;
      this.fileLabel.textContent = 'Nenhum arquivo selecionado.';
      this.send.disabled = true;
      this.say('Você pode voltar sem escolher um arquivo.');
      this.id = String(Date.now()) + '-' + Math.random().toString(36).slice(2, 9);
      // A single same-document entry: Android/Browser Back closes only this panel.
      this.ownsHistory = false;
      try {
        const previous = history.state && typeof history.state === 'object' ? history.state : {};
        history.pushState({...previous, [KEY]: this.id}, '', location.href);
        this.ownsHistory = true;
      } catch (_) { /* Some local file viewers forbid History API. */ }
      this.onOpen?.();
      this.dialog.querySelector('#gaChoose').focus({preventScroll:true});
    }
    selectionChanged() {
      this.pickPending = false;
      if (!this.isOpen) { this.picker.value = ''; return; }
      this.selected = this.picker.files?.[0] || this.selected;
      if (!this.selected) {
        this.say('Nenhum arquivo selecionado. Voltar ao George mantém sua conversa.');
        return;
      }
      const size = this.selected.size < 1048576
        ? `${(this.selected.size / 1024).toFixed(1)} KB`
        : `${(this.selected.size / 1048576).toFixed(1)} MB`;
      this.fileLabel.textContent = `${this.selected.name} • ${size}`;
      this.say('Arquivo selecionado. Ele ainda não foi enviado.');
      this.send.disabled = false;
    }
    close(popOwnEntry) {
      if (!this.isOpen) return;
      const pop = popOwnEntry && this.ownsHistory && history.state?.[KEY] === this.id;
      this.isOpen = false;
      this.ownsHistory = false;
      this.pickPending = false;
      this.selected = null;
      this.picker.value = '';
      if (typeof this.dialog.close === 'function') this.dialog.close();
      else this.dialog.removeAttribute('open');
      this.onClose?.();
      // No textarea focus: doing so would change the current audio mode.
      this.trigger.focus({preventScroll:true});
      requestAnimationFrame(() => {
        if (this.scrollContainer) this.scrollContainer.scrollTop = this.scrollTop;
      });
      if (pop) history.back();
    }
  }
  window.GeorgeAttachmentPanel = GeorgeAttachmentPanel;
})();
