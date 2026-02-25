/**
 * ============================================================================
 * GWF DATA LAYER - Sistema de Rastreamento Avançado
 * ============================================================================
 * 
 * Arquivo: gwf-datalayer.js
 * Versão: 2.0.0
 * 
 * Descrição:
 * Sistema proprietário de captura e gestão de dados de rastreamento,
 * incluindo identificação de usuário, sessão, UTMs e integração com
 * plataforma Tray.

 * 
 * Estrutura:
 * - window.gwfDataLayer.utils: Funções utilitárias
 * - window.gwfDataLayer.context: Gerenciamento de contexto
 * - window.gwfDataLayer.events: Disparo de eventos personalizados
 * - Auto-inicialização
 * 
 * ============================================================================
 */

(function () {
	'use strict';

	console.log('[GWF DataLayer] Run file');

	// ============================================================================
	// NAMESPACE GLOBAL
	// ============================================================================

	window.gwfDataLayer = window.gwfDataLayer || {};

	// ============================================================================
	// OBJETO: UTILS (Funções Utilitárias)
	// ============================================================================

	window.gwfDataLayer.utils = {

		/**
		 * ========================================================================
		 * FUNÇÕES DE STRING
		 * ========================================================================
		 */

		/**
		 * Formatar string (lowercase, replace spaces)
		 */
		formatString: function (str) {
			if (!str) return '';
			return str.toLowerCase().trim().replace(/\s+/g, '_');
		},

		/**
		 * Separar nome completo em primeiro e último nome
		 */
		splitFullName: function (fullName) {
			if (!fullName) return { first: null, last: null };

			var parts = fullName.trim().split(' ');

			if (parts.length === 1) {
				return { first: parts[0], last: null };
			}

			var firstName = parts[0];
			var lastName = parts.slice(1).join(' ');

			return { first: firstName, last: lastName };
		},

		/**
		 * ========================================================================
		 * COOKIES - Trabalhar com OBJETOS COMPLETOS
		 * ========================================================================
		 */

		/**
		 * Ler cookie e retornar objeto parseado
		 * @param {string} name - Nome do cookie
		 * @returns {object|null} Objeto parseado ou null
		 */
		getCookie: function (name) {
			var value = "; " + document.cookie;
			var parts = value.split("; " + name + "=");

			if (parts.length === 2) {
				var cookieValue = parts.pop().split(";").shift();
				try {
					return JSON.parse(decodeURIComponent(cookieValue));
				} catch (e) {
					console.error('[GWF DataLayer] Erro ao parsear cookie:', name, e);
					return null;
				}
			}

			return null;
		},

		/**
		 * Escrever cookie com objeto completo
		 * @param {string} name - Nome do cookie
		 * @param {object} valueObj - Objeto a ser salvo
		 * @param {number} days - Duração em dias
		 * @param {object} options - Opções adicionais (domain, sameSite, etc.)
		 */
		setCookie: function (name, valueObj, days, options) {
			options = options || {};

			// Stringificar objeto
			var cookieValue = encodeURIComponent(JSON.stringify(valueObj));
			var cookieStr = name + "=" + cookieValue;

			// Expiração
			if (days) {
				var date = new Date();
				date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
				cookieStr += "; expires=" + date.toUTCString();
			}

			// Path
			cookieStr += "; path=" + (options.path || "/");

			// Domain
			if (options.domain) {
				cookieStr += "; domain=" + options.domain;
			}

			// SameSite
			cookieStr += "; SameSite=" + (options.sameSite || "Lax");

			// Secure (HTTPS)
			if (window.location.protocol === 'https:' || options.secure) {
				cookieStr += "; Secure";
			}

			document.cookie = cookieStr;
		},

		/**
		 * Deletar cookie
		 */
		deleteCookie: function (name, options) {
			options = options || {};
			options.path = options.path || "/";
			this.setCookie(name, {}, -1, options);
		},

		/**
		 * ========================================================================
		 * sessionStorage - Trabalhar com OBJETOS COMPLETOS
		 * ========================================================================
		 */

		/**
		 * Ler sessionStorage e retornar objeto parseado
		 * @param {string} key - Chave do storage
		 * @returns {object|null} Objeto parseado ou null
		 */
		getSession: function (key) {
			try {
				var value = sessionStorage.getItem(key);
				return value ? JSON.parse(value) : null;
			} catch (e) {
				console.error('[GWF DataLayer] Erro ao ler sessionStorage:', key, e);
				return null;
			}
		},

		/**
		 * Escrever sessionStorage com objeto completo
		 * @param {string} key - Chave do storage
		 * @param {object} valueObj - Objeto a ser salvo
		 */
		setSession: function (key, valueObj) {
			try {
				sessionStorage.setItem(key, JSON.stringify(valueObj));
			} catch (e) {
				console.error('[GWF DataLayer] Erro ao salvar sessionStorage:', key, e);
			}
		},

		/**
		 * Deletar sessionStorage
		 */
		deleteSession: function (key) {
			sessionStorage.removeItem(key);
		},

		/**
		 * ========================================================================
		 * HASH SHA-256
		 * ========================================================================
		 */

		/**
		 * Hash SHA-256 usando Web Crypto API (assíncrono)
		 */
		hashSHA256: async function (str) {
			if (!str) return null;

			try {
				var encoder = new TextEncoder();
				var data = encoder.encode(str);
				var hashBuffer = await crypto.subtle.digest('SHA-256', data);
				var hashArray = Array.from(new Uint8Array(hashBuffer));
				var hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
				return hashHex;
			} catch (e) {
				console.error('[GWF DataLayer] Erro ao gerar hash SHA-256:', e);
				return null;
			}
		},

		/**
		 * Hash simples (fallback síncrono)
		 */
		simpleHash: function (str) {
			if (!str) return null;
			return 'hash_' + btoa(str).substring(0, 20);
		},

		/**
		 * ========================================================================
		 * GERAR UUID
		 * ========================================================================
		 */

		generateUUID: function () {
			return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
				var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
				return v.toString(16);
			});
		},

		/**
		 * ========================================================================
		 * DATA LAYER TRAY
		 * ========================================================================
		 */

		/**
		 * Obter valor do dataLayer da Tray
		 */
		getDataLayerValue: function (key) {
			if (!window.dataLayer) return null;

			for (var i = window.dataLayer.length - 1; i >= 0; i--) {
				if (window.dataLayer[i][key] !== undefined) {
					return window.dataLayer[i][key];
				}
			}

			return null;
		},

		/**
		 * ========================================================================
		 * RESET DATA LAYER (Limpar objetos GWF)
		 * ========================================================================
		 */

		resetDataLayerGWF: function () {
			window.dataLayer = window.dataLayer || [];
			window.dataLayer.push({
				'event': 'gwf.linkbio.reset_datalayer',
				'gwf_event': null,
				'gwf_data': null
			});

			console.log('[GWF DataLayer] DataLayer GWF resetado');
		},

		getParents: function (el, parentSelector) {
			if (parentSelector === undefined) {
				parentSelector = document;
			}
			var parents = [];
			var p = el.parentNode;
			while (p !== parentSelector) {
				var o = p;
				parents.push(o);
				p = o.parentNode;
			}
			parents.push(parentSelector);
			return parents;
		}

	}; // Fim utils

	// ============================================================================
	// OBJETO: CONTEXT (Gerenciamento de Contexto)
	// ============================================================================

	window.gwfDataLayer.context = {
		/**
		 * ========================================================================
		 * CAPTURAR UTMs (COOKIE COM OBJETO COMPLETO)
		 * ========================================================================
		 */

		captureUTMs: function () {
			var utils = window.gwfDataLayer.utils;

			// Tentar ler cookie existente
			var gwfUtm = utils.getCookie('gwf_utm');

			if (!gwfUtm) {
				gwfUtm = {
					source_first: null,
					medium_first: null,
					campaign_first: null,
					content_first: null,
					term_first: null,
					source_last: null,
					medium_last: null,
					campaign_last: null,
					content_last: null,
					term_last: null,
					gclid: null,
					fbclid: null
				};
			}

			// Capturar UTMs da URL
			var urlParams = new URLSearchParams(window.location.search);

			var hasUtmsInUrl = (
				urlParams.has('utm_source') ||
				urlParams.has('utm_medium') ||
				urlParams.has('utm_campaign')
			);

			if (hasUtmsInUrl) {
				var urlUtms = {
					source: urlParams.get('utm_source'),
					medium: urlParams.get('utm_medium'),
					campaign: urlParams.get('utm_campaign'),
					content: urlParams.get('utm_content'),
					term: urlParams.get('utm_term')
				};

				var isInternal = (
					urlUtms.medium === 'internal' ||
					urlUtms.medium === 'banner' ||
					urlUtms.source === 'site' ||
					urlUtms.source === 'email_interno'
				);

				// FIRST TOUCH (apenas se não existe e é externo)
				if (!isInternal && !gwfUtm.source_first) {
					gwfUtm.source_first = urlUtms.source;
					gwfUtm.medium_first = urlUtms.medium;
					gwfUtm.campaign_first = urlUtms.campaign;
					gwfUtm.content_first = urlUtms.content;
					gwfUtm.term_first = urlUtms.term;

					console.log('[GWF DataLayer] UTMs FIRST capturadas:', urlUtms);
				}

				// LAST TOUCH (sempre atualiza)
				gwfUtm.source_last = urlUtms.source;
				gwfUtm.medium_last = urlUtms.medium;
				gwfUtm.campaign_last = urlUtms.campaign;
				gwfUtm.content_last = urlUtms.content;
				gwfUtm.term_last = urlUtms.term;

				console.log('[GWF DataLayer] UTMs LAST atualizadas:', urlUtms);
			}

			// Capturar gclid/fbclid
			if (urlParams.has('gclid')) {
				gwfUtm.gclid = urlParams.get('gclid');
				console.log('[GWF DataLayer] gclid capturado:', urlParams.get('gclid'));
			}

			if (urlParams.has('fbclid')) {
				gwfUtm.fbclid = urlParams.get('fbclid');
				console.log('[GWF DataLayer] fbclid capturado:', urlParams.get('fbclid'));
			}

			// Salvar cookie (90 dias)
			utils.setCookie('gwf_utm', gwfUtm, 90);

			return gwfUtm;
		},

		/**
		 * ========================================================================
		 * FUNÇÃO PRINCIPAL - setContext
		 * ========================================================================
		 */

		setContext: function () {
			var gwfUtm = this.captureUTMs();

			// Disparar evento (SEM objetos - GTM vai ler de cookies/storage)
			window.dataLayer = window.dataLayer || [];
			window.dataLayer.push({
				'event': 'gwf.linkbio.context_ready'
			});

			console.log('[GWF DataLayer] Context initialized (stored in cookies/sessionStorage):', {
				utm: gwfUtm
			});

			return {
				utm: gwfUtm
			};
		}

	}; // Fim context

	// ==========================================
	// OBJETO: EVENTS (Disparo de eventos)
	// ==========================================
	window.gwfDataLayer.events = {
		push_SelectContent: function (paramContent, paramId) {
			if (paramContent == undefined || paramId == undefined) {
				return console.error('[GWF DataLayer] push_SelectContent - Falta de parâmetro obrigatório');
			}

			window.gwfDataLayer.utils.resetDataLayerGWF();

			dataLayer.push({
				event: 'gwf.linkbio.select_content',
				gwf_event: "select_content",
				gwf_data: {
					content_type: paramContent,
					content_id: paramId
				}
			});
		},
		push_generateLead: function () {
			window.gwfDataLayer.utils.resetDataLayerGWF();

			dataLayer.push({
				event: 'gwf.linkbio.generate_lead',
				gwf_event: "generate_lead",
				gwf_data: {
					currency: "BRL",
					value: 1,
					lead_source: "SPF Link Bio"
				}
			});


			return
		}
	};

	// ==========================================
	// FUNÇÃO: GESTÃO DE AÇÕES NO DOM
	// ==========================================
	window.gwfDataLayer.handleActionsDOM = function () {
		// BOTÕES social
		document.querySelectorAll('.gwf-bio__social-link').forEach(element => {
			element.addEventListener('click', function (event) {
				dataLayer.push({
					event: 'gwf.linkbio.click_social',
					gwf_event: 'click_social',
					gwf_data: {
						social_network: event.currentTarget.ariaLabel
					}
				});
			});
		});

		// BOTÕES action
		document.querySelector('#whatsapp_btn_spf').addEventListener('click', function (event) {
			dataLayer.push({
				event: 'gwf.linkbio.click_whatsapp',
				gwf_event: 'click_whatsapp',
				gwf_data: {
					cta_location: 'header'
				}
			});
		});

		// BOTÕES action
		document.querySelector('#ecommerce_btn_spf').addEventListener('click', function (event) {
			dataLayer.push({
				event: 'gwf.linkbio.click_ecommerce',
				gwf_event: 'click_ecommerce',
				gwf_data: {
					cta_location: 'header'
				}
			});
		});

		// BOTÕES action
		document.querySelector('#see_all_btn_spf').addEventListener('click', function (event) {
			dataLayer.push({
				event: 'gwf.linkbio.click_ecommerce',
				gwf_event: 'click_ecommerce',
				gwf_data: {
					cta_location: 'shelf'
				}
			});
		});

		// BOTÕES slider
		document.querySelectorAll('.gwf-bio__links-item-produtos, .gwf-bio__loja-link').forEach(element => {
			element.addEventListener('click', function (event) {
				const product = element.closest('.gwf-bio__carrossel-slide');
				const item_id = product.dataset.prodId;
				const item_name = product.dataset.prodName;
				const item_price = product.dataset.prodPrice;
				const item_position = product.dataset.index;

				dataLayer.push({
					event: 'gwf.linkbio.click_shelf',
					gwf_event: 'click_shelf',
					gwf_data: {
						item_id: item_id,
						item_name: item_name,
						item_price: item_price,
						item_position: item_position
					}
				});
			});
		});

		// BOTÕES stores
		document.querySelector('#maps_store1_btn_spf').addEventListener('click', function (event) {
			dataLayer.push({
				event: 'gwf.linkbio.click_location_store1',
				gwf_event: 'click_location_store1',
				gwf_data: {
					store_id: 'store1',
					store_name: 'Vila Prel',
					nav_app: 'google_maps' // google_maps | waze
				}
			});
		});

		// BOTÕES stores
		document.querySelector('#waze_store1_btn_spf').addEventListener('click', function (event) {
			dataLayer.push({
				event: 'gwf.linkbio.click_location_store1',
				gwf_event: 'click_location_store1',
				gwf_data: {
					store_id: 'store1',
					store_name: 'Vila Prel',
					nav_app: 'waze' // google_maps | waze
				}
			});
		});

		// BOTÕES stores
		document.querySelector('#maps_store2_btn_spf').addEventListener('click', function (event) {
			dataLayer.push({
				event: 'gwf.linkbio.click_location_store2',
				gwf_event: 'click_location_store2',
				gwf_data: {
					store_id: 'store2',
					store_name: 'Capão Redondo',
					nav_app: 'google_maps' // google_maps | waze
				}
			});
		});

		// BOTÕES stores
		document.querySelector('#waze_store2_btn_spf').addEventListener('click', function (event) {
			dataLayer.push({
				event: 'gwf.linkbio.click_location_store2',
				gwf_event: 'click_location_store2',
				gwf_data: {
					store_id: 'store2',
					store_name: 'Capão Redondo',
					nav_app: 'waze' // google_maps | waze
				}
			});
		});

	};

	// ==========================================
	// AUTO-INICIALIZAÇÃO
	// ==========================================

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', function () {
			console.log('[GWF DataLayer] Initializing context on DOMContentLoaded');
			window.gwfDataLayer.utils.resetDataLayerGWF();
			window.gwfDataLayer.context.setContext();
			window.gwfDataLayer.handleActionsDOM(); // Descomentar se necessário
		});
	} else {
		console.log('[GWF DataLayer] Initializing context immediately');
		window.gwfDataLayer.utils.resetDataLayerGWF();
		window.gwfDataLayer.context.setContext();
		window.gwfDataLayer.handleActionsDOM(); // Descomentar se necessário
	}

	console.log('[GWF DataLayer] gwfDataLayer initialized and ready');

})();