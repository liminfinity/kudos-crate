(function() {
  'use strict';

  var MiraWidget = {
    _config: null,
    _iframe: null,
    _container: null,
    _overlay: null,

    init: function(config) {
      if (!config || !config.surveyId) {
        console.error('[MiraWidget] surveyId is required');
        return;
      }

      this._config = {
        surveyId: config.surveyId,
        theme: config.theme || 'light',
        position: config.position || 'inline',
        container: config.container || null,
        baseUrl: config.baseUrl || window.location.origin
      };

      // Determine base URL from script src
      var scripts = document.getElementsByTagName('script');
      for (var i = 0; i < scripts.length; i++) {
        if (scripts[i].src && scripts[i].src.indexOf('widget.js') !== -1) {
          var url = new URL(scripts[i].src);
          this._config.baseUrl = url.origin;
          break;
        }
      }

      if (this._config.position === 'inline') {
        this._renderInline();
      } else if (this._config.position === 'floating') {
        this._renderFloating();
      } else if (this._config.position === 'popup') {
        this._renderFloating();
      }

      this._listenMessages();
    },

    _createIframe: function() {
      var iframe = document.createElement('iframe');
      var src = this._config.baseUrl + '/embed/survey/' + this._config.surveyId + '?theme=' + this._config.theme;
      iframe.src = src;
      iframe.style.cssText = 'width:100%;height:600px;border:none;border-radius:12px;';
      iframe.setAttribute('loading', 'lazy');
      iframe.setAttribute('allow', 'clipboard-write');
      this._iframe = iframe;
      return iframe;
    },

    _renderInline: function() {
      var container = this._config.container
        ? document.querySelector(this._config.container)
        : document.getElementById('mira-survey');

      if (!container) {
        console.error('[MiraWidget] Container not found:', this._config.container || '#mira-survey');
        return;
      }

      container.appendChild(this._createIframe());
    },

    _renderFloating: function() {
      // Create floating button
      var btn = document.createElement('button');
      btn.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg><span style="margin-left:8px;font-size:14px;font-weight:500;">Пройти опрос</span>';
      btn.style.cssText = 'position:fixed;bottom:24px;right:24px;z-index:99999;display:flex;align-items:center;padding:12px 20px;border-radius:999px;border:none;cursor:pointer;font-family:system-ui,sans-serif;box-shadow:0 4px 20px rgba(0,0,0,0.15);transition:transform 0.2s;';
      
      if (this._config.theme === 'dark') {
        btn.style.backgroundColor = '#2563eb';
        btn.style.color = '#fff';
      } else {
        btn.style.backgroundColor = '#1e3a5f';
        btn.style.color = '#fff';
      }

      btn.onmouseenter = function() { btn.style.transform = 'scale(1.05)'; };
      btn.onmouseleave = function() { btn.style.transform = 'scale(1)'; };

      var self = this;
      btn.onclick = function() {
        self._openPopup();
      };

      document.body.appendChild(btn);
      this._floatingBtn = btn;
    },

    _openPopup: function() {
      // Overlay
      var overlay = document.createElement('div');
      overlay.style.cssText = 'position:fixed;inset:0;z-index:100000;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;padding:20px;';

      // Modal container
      var modal = document.createElement('div');
      modal.style.cssText = 'position:relative;width:100%;max-width:720px;max-height:90vh;background:' + (this._config.theme === 'dark' ? '#1a1a2e' : '#fff') + ';border-radius:16px;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,0.3);';

      // Close button
      var closeBtn = document.createElement('button');
      closeBtn.innerHTML = '&times;';
      closeBtn.style.cssText = 'position:absolute;top:12px;right:16px;z-index:10;border:none;background:none;font-size:24px;cursor:pointer;color:' + (this._config.theme === 'dark' ? '#ccc' : '#666') + ';';

      var self = this;
      closeBtn.onclick = function() { self._closePopup(); };
      overlay.onclick = function(e) { if (e.target === overlay) self._closePopup(); };

      var iframe = this._createIframe();
      iframe.style.height = '80vh';
      iframe.style.maxHeight = '80vh';
      iframe.style.borderRadius = '0';

      modal.appendChild(closeBtn);
      modal.appendChild(iframe);
      overlay.appendChild(modal);
      document.body.appendChild(overlay);
      this._overlay = overlay;
    },

    _closePopup: function() {
      if (this._overlay) {
        document.body.removeChild(this._overlay);
        this._overlay = null;
      }
    },

    _listenMessages: function() {
      var self = this;
      window.addEventListener('message', function(e) {
        if (!e.data) return;

        if (e.data.type === 'mira-resize' && self._iframe) {
          self._iframe.style.height = e.data.height + 'px';
        }

        if (e.data.type === 'mira-submitted') {
          // Close popup after delay
          if (self._overlay) {
            setTimeout(function() { self._closePopup(); }, 3000);
          }
          // Hide floating button
          if (self._floatingBtn) {
            self._floatingBtn.style.display = 'none';
          }
        }
      });
    }
  };

  // Expose globally
  window.MiraWidget = MiraWidget;
})();
