/**
 * ============================================================================
 * GWF DATA LAYER - Sistema de Rastreamento Avançado
 * ============================================================================
 *
 * Arquivo: gwf-datalayer.js
 * Versão: 1.0.0
 * Contexto: Landing Page (Link Bio)
 *
 * Descrição:
 * Sistema proprietário de captura e gestão de dados de rastreamento para
 * Landing Pages. Inclui identificação de sessão, captura de UTMs com
 * modelo first/last touch, leitura de identifiers GA4 e disparo de
 * eventos de interação com botões da página.
 *
 * Armazenamento:
 * - gwf_utm     → Cookie (90 dias) — UTMs e click IDs
 * - gwf_session → sessionStorage   — Dados de sessão e contexto de página
 *
 * Namespace:
 * - window.gwfDataLayer.utils    → Funções utilitárias
 * - window.gwfDataLayer.context  → Gerenciamento de contexto
 * - window.gwfDataLayer.events   → Disparo de eventos
 * - window.gwfDataLayer.handleActionsDOM → Listeners de DOM
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
		 * Formatar string para snake_case lowercase
		 * @param {string} str
		 * @returns {string}
		 */
		formatString: function (str) {
			if (!str) return '';
			return str.toLowerCase().trim().replace(/\s+/g, '_');
		},

		/**
		 * ========================================================================
		 * COOKIES - Trabalhar com OBJETOS COMPLETOS (JSON)
		 * ========================================================================
		 *
		 * IMPORTANTE: Estes métodos são para cookies GWF que armazenam objetos
		 * JSON codificados. NÃO usar para ler cookies de terceiros como _ga,
		 * _ga_XXXX, _fbp, que possuem formatos próprios.
		 */

		/**
		 * Ler cookie GWF e retornar objeto parseado
		 * @param {string} name - Nome do cookie
		 * @returns {object|null} Objeto parseado ou null
		 */
		getCookie: function (name) {
			const value = '; ' + document.cookie;
			const parts = value.split('; ' + name + '=');

			if (parts.length === 2) {
				const cookieValue = parts.pop().split(';').shift();
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
		 * Escrever cookie GWF com objeto completo
		 * @param {string} name      - Nome do cookie
		 * @param {object} valueObj  - Objeto a ser salvo como JSON
		 * @param {number} days      - Duração em dias
		 * @param {object} [options] - Opções adicionais (domain, sameSite, etc.)
		 */
		setCookie: function (name, valueObj, days, options) {
			options = options || {};

			const cookieValue = encodeURIComponent(JSON.stringify(valueObj));
			let cookieStr = name + '=' + cookieValue;

			if (days) {
				const date = new Date();
				date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
				cookieStr += '; expires=' + date.toUTCString();
			}

			cookieStr += '; path=' + (options.path || '/');

			if (options.domain) {
				cookieStr += '; domain=' + options.domain;
			}

			cookieStr += '; SameSite=' + (options.sameSite || 'Lax');

			if (window.location.protocol === 'https:' || options.secure) {
				cookieStr += '; Secure';
			}

			document.cookie = cookieStr;
		},

		/**
		 * Deletar cookie GWF
		 * @param {string} name
		 * @param {object} [options]
		 */
		deleteCookie: function (name, options) {
			options = options || {};
			options.path = options.path || '/';
			this.setCookie(name, {}, -1, options);
		},

		/**
		 * ========================================================================
		 * sessionStorage - Trabalhar com OBJETOS COMPLETOS (JSON)
		 * ========================================================================
		 */

		/**
		 * Ler sessionStorage e retornar objeto parseado
		 * @param {string} key
		 * @returns {object|null}
		 */
		getSession: function (key) {
			try {
				const value = sessionStorage.getItem(key);
				return value ? JSON.parse(value) : null;
			} catch (e) {
				console.error('[GWF DataLayer] Erro ao ler sessionStorage:', key, e);
				return null;
			}
		},

		/**
		 * Escrever sessionStorage com objeto completo
		 * @param {string} key
		 * @param {object} valueObj
		 */
		setSession: function (key, valueObj) {
			try {
				sessionStorage.setItem(key, JSON.stringify(valueObj));
			} catch (e) {
				console.error('[GWF DataLayer] Erro ao salvar sessionStorage:', key, e);
			}
		},

		/**
		 * Deletar item do sessionStorage
		 * @param {string} key
		 */
		deleteSession: function (key) {
			sessionStorage.removeItem(key);
		},

		/**
		 * ========================================================================
		 * GERAR UUID v4
		 * ========================================================================
		 */

		/**
		 * Gerar UUID v4 aleatório
		 * @returns {string}
		 */
		generateUUID: function () {
			return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
				const r = Math.random() * 16 | 0;
				const v = c === 'x' ? r : (r & 0x3 | 0x8);
				return v.toString(16);
			});
		},

		/**
		 * ========================================================================
		 * LEITURA DE COOKIES DE TERCEIROS (formato não-JSON)
		 * ========================================================================
		 *
		 * Métodos específicos para cookies com formato proprietário.
		 * Separados do getCookie padrão para evitar erros de parse.
		 */

		/**
		 * Ler cookie _ga e extrair o client_id do GA4
		 * Formato do cookie: GA1.1.XXXXXXXXXX.XXXXXXXXXX
		 * Client ID = terceiro e quarto segmentos unidos por ponto
		 * @returns {string|null}
		 */
		getGAClientId: function () {
			try {
				const gaCookie = document.cookie
					.split('; ')
					.find(row => row.startsWith('_ga='));

				if (!gaCookie) return null;

				const parts = gaCookie.split('=')[1].split('.');

				// Formato esperado: GA1.1.CLIENT_ID_PART1.CLIENT_ID_PART2
				if (parts.length >= 4) {
					return parts.slice(2).join('.');
				}

				return null;
			} catch (e) {
				console.error('[GWF DataLayer] Erro ao ler _ga client_id:', e);
				return null;
			}
		},

		/**
		 * Ler cookie _ga_XXXX e extrair o session_id do GA4
		 * Formato do cookie: GS1.1.SESSION_ID.SESSION_NUMBER.IS_NEW.LAST_EVENT.ENGAGED
		 * Session ID = terceiro segmento
		 * @returns {string|null}
		 */
		getGASessionId: function () {
			try {
				const gaSessionCookie = document.cookie
					.split('; ')
					.find(row => row.startsWith('_ga_'));

				if (!gaSessionCookie) return null;

				const parts = gaSessionCookie.split('=')[1].split('.');

				// Formato esperado: GS1.1.SESSION_ID.SESSION_NUMBER...
				if (parts.length >= 3) {
					return parts[2] || null;
				}

				return null;
			} catch (e) {
				console.error('[GWF DataLayer] Erro ao ler _ga_ session_id:', e);
				return null;
			}
		},

		/**
		 * ========================================================================
		 * RESET DATA LAYER (Limpar objetos GWF entre eventos)
		 * ========================================================================
		 */

		/**
		 * Resetar campos GWF no dataLayer antes de cada novo evento.
		 * Evita que dados de eventos anteriores contaminem o próximo disparo.
		 */
		resetDataLayerGWF: function () {
			window.dataLayer = window.dataLayer || [];
			window.dataLayer.push({
				event: 'gwf.linkbio.reset_datalayer',
				gwf_event: null,
				gwf_data: null
			});

			console.log('[GWF DataLayer] DataLayer GWF resetado');
		}

	}; // Fim utils

	// ============================================================================
	// OBJETO: CONTEXT (Gerenciamento de Contexto)
	// ============================================================================

	window.gwfDataLayer.context = {
		/**
		 * ========================================================================
		 * INICIALIZAR gwf_session (sessionStorage)
		 * ========================================================================
		 *
		 * Cria ou reutiliza a sessão atual e persiste no sessionStorage.
		 * Inclui identificadores GA4 para garantir rastreabilidade e permitir
		 * deduplicação futura em implementação server-side.
		 *
		 * Campos:
		 * - id              → ID GWF proprietário da sessão (UUID)
		 * - timestamp       → Timestamp de início da sessão (ms)
		 * - page_count      → Número de páginas vistas na sessão
		 * - time_elapsed    → Tempo decorrido desde início da sessão (segundos)
		 * - ga_client_id    → Client ID do GA4 (lido do cookie _ga)
		 * - ga_session_id   → Session ID do GA4 (lido do cookie _ga_XXXX)
		 * - page_location   → URL completa da página atual
		 * - page_referrer   → URL da página de origem (null se acesso direto)
		 *
		 * NOTA: ga_client_id e ga_session_id podem ser null na primeira visita
		 * caso o GA4 ainda não tenha gravado seus cookies. Comportamento esperado.
		 */
		initSession: function () {
			const utils = window.gwfDataLayer.utils;

			let gwfSession = utils.getSession('gwf_session');

			if (!gwfSession || !gwfSession.id) {
				// Nova sessão — criar objeto completo
				gwfSession = {
					id: 'gwf_session_' + utils.generateUUID(),
					timestamp: Date.now(),
					page_count: 0,
					time_elapsed: 0,
					ga_client_id: utils.getGAClientId(),
					ga_session_id: utils.getGASessionId(),
					page_location: window.location.href,
					page_referrer: document.referrer || null
				};

				console.log('[GWF DataLayer] gwf_session criado:', gwfSession);
			} else {
				// Sessão existente — atualizar métricas dinâmicas
				gwfSession.page_location = window.location.href;
				gwfSession.page_referrer = document.referrer || null;
				gwfSession.time_elapsed = Math.floor((Date.now() - gwfSession.timestamp) / 1000);

				// Tentar enriquecer GA IDs caso não tenham sido capturados na criação
				// (GA4 pode demorar alguns ms para gravar seus cookies)
				if (!gwfSession.ga_client_id) {
					gwfSession.ga_client_id = utils.getGAClientId();
				}
				if (!gwfSession.ga_session_id) {
					gwfSession.ga_session_id = utils.getGASessionId();
				}
			}

			// Incrementar page_count
			gwfSession.page_count++;

			// Persistir sessionStorage atualizado
			utils.setSession('gwf_session', gwfSession);

			console.log('[GWF DataLayer] gwf_session atualizado:', gwfSession);

			return gwfSession;
		},

		/**
		 * ========================================================================
		 * CAPTURAR UTMs (Cookie gwf_utm)
		 * ========================================================================
		 *
		 * Modelo de atribuição duplo:
		 * - FIRST TOUCH → capturado uma vez, na primeira visita com UTMs externas
		 * - LAST TOUCH  → sempre atualizado com a última origem conhecida
		 *
		 * Campos do objeto gwf_utm:
		 * - source_first / source_last
		 * - medium_first / medium_last
		 * - campaign_first / campaign_last
		 * - content_first / content_last
		 * - term_first / term_last
		 * - gclid  → Google Click ID (Google Ads)
		 * - fbclid → Facebook Click ID (Meta Ads)
		 *
		 * Origens internas NÃO sobrescrevem o first touch.
		 * Classificadas como internas: medium (internal, banner) | source (site, email_interno)
		 */
		captureUTMs: function () {
			const utils = window.gwfDataLayer.utils;

			let gwfUtm = utils.getCookie('gwf_utm');

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
					gads_account: null,
					gclid: null,
					fbclid: null
				};
			}

			const urlParams = new URLSearchParams(window.location.search);

			const hasUtmsInUrl = (
				urlParams.has('utm_source') ||
				urlParams.has('utm_medium') ||
				urlParams.has('utm_campaign')
			);

			if (hasUtmsInUrl) {
				const urlUtms = {
					source: urlParams.get('utm_source'),
					medium: urlParams.get('utm_medium'),
					campaign: urlParams.get('utm_campaign'),
					content: urlParams.get('utm_content'),
					term: urlParams.get('utm_term')
				};

				const isInternal = (
					urlUtms.medium === 'internal' ||
					urlUtms.medium === 'banner' ||
					urlUtms.source === 'site' ||
					urlUtms.source === 'email_interno'
				);

				// FIRST TOUCH — apenas se ainda não existe e não é tráfego interno
				if (!isInternal && !gwfUtm.source_first) {
					gwfUtm.source_first = urlUtms.source;
					gwfUtm.medium_first = urlUtms.medium;
					gwfUtm.campaign_first = urlUtms.campaign;
					gwfUtm.content_first = urlUtms.content;
					gwfUtm.term_first = urlUtms.term;

					console.log('[GWF DataLayer] UTMs FIRST capturadas:', urlUtms);
				}

				// LAST TOUCH — sempre atualiza
				gwfUtm.source_last = urlUtms.source;
				gwfUtm.medium_last = urlUtms.medium;
				gwfUtm.campaign_last = urlUtms.campaign;
				gwfUtm.content_last = urlUtms.content;
				gwfUtm.term_last = urlUtms.term;

				console.log('[GWF DataLayer] UTMs LAST atualizadas:', urlUtms);
			}

			if (urlParams.has('gads_account')) {
				gwfUtm.gads_account = urlParams.get('gads_account');
				console.log('[GWF DataLayer] gads_account capturado:', gwfUtm.gads_account);
			}

			// Click IDs — sempre atualizar se presentes na URL
			if (urlParams.has('gclid')) {
				gwfUtm.gclid = urlParams.get('gclid');
				console.log('[GWF DataLayer] gclid capturado:', gwfUtm.gclid);
			}

			if (urlParams.has('fbclid')) {
				gwfUtm.fbclid = urlParams.get('fbclid');
				console.log('[GWF DataLayer] fbclid capturado:', gwfUtm.fbclid);
			}

			// Persistir cookie (90 dias)
			utils.setCookie('gwf_utm', gwfUtm, 90);

			return gwfUtm;
		},

		/**
		 * ========================================================================
		 * FUNÇÃO PRINCIPAL - setContext
		 * ========================================================================
		 *
		 * Ponto de entrada do contexto. Inicializa sessão e UTMs, persiste nos
		 * storages e dispara o evento context_ready para o GTM.
		 *
		 * Os dados ficam armazenados em sessionStorage e cookies.
		 * O GTM os lê via variáveis dedicadas, não via dataLayer push,
		 * mantendo o payload de cada evento limpo e sem redundância.
		 */
		setContext: function () {
			const gwfSession = this.initSession();
			const gwfUtm = this.captureUTMs();

			window.dataLayer = window.dataLayer || [];
			window.dataLayer.push({
				event: 'gwf.linkbio.context_ready'
			});

			console.log('[GWF DataLayer] Context initialized (stored in sessionStorage/cookies):', {
				session: gwfSession,
				utm: gwfUtm
			});

			return {
				session: gwfSession,
				utm: gwfUtm
			};
		}

	}; // Fim context

	// ============================================================================
	// OBJETO: EVENTS (Disparo de Eventos)
	// ============================================================================

	window.gwfDataLayer.events = {

		/**
		 * ========================================================================
		 * EVENTO: click_whatsapp_store1
		 * ========================================================================
		 * Disparado ao clicar no botão de WhatsApp da marca.
		 * Conversão primária — mapeado no GA4 e Google Ads.
		 *
		 * @param {string} ctaLocation - Localização do botão na página (ex: 'header')
		 */
		push_clickWhatsappStore1: function (ctaLocation) {
			if (!ctaLocation) {
				console.error('[GWF DataLayer] push_clickWhatsappStore1 - ctaLocation obrigatório');
				return;
			}

			const customEventId = window.gwfDataLayer.utils.generateUUID();

			window.gwfDataLayer.utils.resetDataLayerGWF();

			window.dataLayer.push({
				event: 'gwf.linkbio.click_whatsapp_store1',
				gwf_event: 'click_whatsapp_store1',
				gwf_data: {
					event_id: customEventId,
					cta_location: ctaLocation
				}
			});

			console.log('[GWF DataLayer] click_whatsapp_store1 disparado:', { cta_location: ctaLocation });
		},

		/**
		 * ========================================================================
		 * EVENTO: click_ecommerce
		 * ========================================================================
		 * Disparado ao clicar em qualquer botão que direciona para a loja virtual.
		 * Conversão primária — mapeado no GA4 e Google Ads.
		 *
		 * @param {string} ctaLocation - Localização do botão (ex: 'header', 'shelf')
		 */
		push_clickEcommerce: function (ctaLocation) {
			if (!ctaLocation) {
				console.error('[GWF DataLayer] push_clickEcommerce - ctaLocation obrigatório');
				return;
			}

			const customEventId = window.gwfDataLayer.utils.generateUUID();
			
			window.gwfDataLayer.utils.resetDataLayerGWF();

			window.dataLayer.push({
				event: 'gwf.linkbio.click_ecommerce',
				gwf_event: 'click_ecommerce',
				gwf_data: {
					event_id: customEventId,
					cta_location: ctaLocation
				}
			});

			console.log('[GWF DataLayer] click_ecommerce disparado:', { cta_location: ctaLocation });
		},

		/**
		 * ========================================================================
		 * EVENTO: click_location_store1
		 * ========================================================================
		 * Disparado ao clicar em Maps ou Waze da Unidade Vila Prel.
		 * Conversão primária — mapeado no GA4 e Google Ads.
		 *
		 * @param {string} navApp - Aplicativo de navegação ('google_maps' | 'waze')
		 */
		push_clickLocationStore1: function (navApp) {
			if (!navApp) {
				console.error('[GWF DataLayer] push_clickLocationStore1 - navApp obrigatório');
				return;
			}

			const customEventId = window.gwfDataLayer.utils.generateUUID();
			
			window.gwfDataLayer.utils.resetDataLayerGWF();

			window.dataLayer.push({
				event: 'gwf.linkbio.click_location_store1',
				gwf_event: 'click_location_store1',
				gwf_data: {
					event_id: customEventId,
					store_id: 'store1',
					store_name: 'Vila Prel',
					nav_app: navApp
				}
			});

			console.log('[GWF DataLayer] click_location_store1 disparado:', { nav_app: navApp });
		},

		/**
		 * ========================================================================
		 * EVENTO: click_location_store2
		 * ========================================================================
		 * Disparado ao clicar em Maps ou Waze da Unidade Capão Redondo.
		 * Conversão primária — mapeado no GA4 e Google Ads.
		 *
		 * @param {string} navApp - Aplicativo de navegação ('google_maps' | 'waze')
		 */
		push_clickLocationStore2: function (navApp) {
			if (!navApp) {
				console.error('[GWF DataLayer] push_clickLocationStore2 - navApp obrigatório');
				return;
			}

			const customEventId = window.gwfDataLayer.utils.generateUUID();
			
			window.gwfDataLayer.utils.resetDataLayerGWF();

			window.dataLayer.push({
				event: 'gwf.linkbio.click_location_store2',
				gwf_event: 'click_location_store2',
				gwf_data: {
					event_id: customEventId,
					store_id: 'store2',
					store_name: 'Capão Redondo',
					nav_app: navApp
				}
			});

			console.log('[GWF DataLayer] click_location_store2 disparado:', { nav_app: navApp });
		},

		/**
		 * ========================================================================
		 * EVENTO: click_social
		 * ========================================================================
		 * Disparado ao clicar em qualquer ícone de rede social.
		 * Evento secundário — apenas análise, sem conversão no Google Ads.
		 *
		 * @param {string} socialNetwork - Rede social ('instagram' | 'facebook' | ...)
		 */
		push_clickSocial: function (socialNetwork) {
			if (!socialNetwork) {
				console.error('[GWF DataLayer] push_clickSocial - socialNetwork obrigatório');
				return;
			}

			const customEventId = window.gwfDataLayer.utils.generateUUID();
			
			window.gwfDataLayer.utils.resetDataLayerGWF();

			window.dataLayer.push({
				event: 'gwf.linkbio.click_social',
				gwf_event: 'click_social',
				gwf_data: {
					event_id: customEventId,
					social_network: socialNetwork
				}
			});

			console.log('[GWF DataLayer] click_social disparado:', { social_network: socialNetwork });
		},

		/**
		 * ========================================================================
		 * EVENTO: click_shelf
		 * ========================================================================
		 * Disparado ao clicar na imagem ou no botão "Compre Agora" de um produto
		 * do carrossel da LP.
		 * Evento secundário — apenas análise, sem conversão no Google Ads.
		 *
		 * @param {string} itemId       - ID do produto no e-commerce
		 * @param {string} itemName     - Nome do produto
		 * @param {number} itemPrice    - Preço do produto
		 * @param {number} itemPosition - Posição no carrossel (1, 2 ou 3)
		 */
		push_clickShelf: function (itemId, itemName, itemPrice, itemPosition) {
			if (!itemId || !itemName || !itemPosition) {
				console.error('[GWF DataLayer] push_clickShelf - itemId, itemName e itemPosition obrigatórios');
				return;
			}

			const customEventId = window.gwfDataLayer.utils.generateUUID();
			
			window.gwfDataLayer.utils.resetDataLayerGWF();

			window.dataLayer.push({
				event: 'gwf.linkbio.click_shelf',
				gwf_event: 'click_shelf',
				gwf_data: {
					event_id: customEventId,
					item_id: itemId,
					item_name: itemName,
					item_price: itemPrice || null,
					item_position: itemPosition
				}
			});

			console.log('[GWF DataLayer] click_shelf disparado:', {
				item_id: itemId,
				item_name: itemName,
				item_price: itemPrice,
				item_position: itemPosition
			});
		}

	}; // Fim events

	// ============================================================================
	// FUNÇÃO: GESTÃO DE AÇÕES NO DOM
	// ============================================================================

	/**
	 * Registra todos os listeners de clique dos botões rastreáveis da LP.
	 * Os dados de cada botão são lidos dos atributos data-gwf-* do HTML,
	 * tornando o código agnóstico à marca e reutilizável em outras LPs
	 * sem necessidade de alteração no JS.
	 *
	 * Atributos data-gwf-* esperados em cada tipo de botão:
	 *
	 * Botão WhatsApp:
	 *   data-gwf-event="click_whatsapp_store1"
	 *   data-gwf-cta-location="header"
	 *
	 * Botão E-commerce (header ou shelf):
	 *   data-gwf-event="click_ecommerce"
	 *   data-gwf-cta-location="header" | "shelf"
	 *
	 * Botão Localização Maps/Waze por loja:
	 *   data-gwf-event="click_location_store1" | "click_location_store2"
	 *   data-gwf-nav-app="google_maps" | "waze"
	 *
	 * Botão Social:
	 *   data-gwf-event="click_social"
	 *   data-gwf-social-network="instagram" | "facebook" | "youtube" | ...
	 *
	 * Botão Shelf (imagem ou CTA do produto):
	 *   data-gwf-event="click_shelf"
	 *   data-gwf-item-id="1191"
	 *   data-gwf-item-name="Caneca Namorados Motivo do Meu Stress"
	 *   data-gwf-item-price="59.90"
	 *   data-gwf-item-position="1"
	 */
	window.gwfDataLayer.handleActionsDOM = function () {
		const events = window.gwfDataLayer.events;

		// Mapa de handlers indexado pelo valor de data-gwf-event
		const eventHandlers = {

			click_whatsapp_store1: function (el) {
				const ctaLocation = el.dataset.gwfCtaLocation || 'unknown';
				events.push_clickWhatsappStore1(ctaLocation);
			},

			click_ecommerce: function (el) {
				const ctaLocation = el.dataset.gwfCtaLocation || 'unknown';
				events.push_clickEcommerce(ctaLocation);
			},

			click_location_store1: function (el) {
				const navApp = el.dataset.gwfNavApp || 'unknown';
				events.push_clickLocationStore1(navApp);
			},

			click_location_store2: function (el) {
				const navApp = el.dataset.gwfNavApp || 'unknown';
				events.push_clickLocationStore2(navApp);
			},

			click_social: function (el) {
				const socialNetwork = el.dataset.gwfSocialNetwork || 'unknown';
				events.push_clickSocial(socialNetwork);
			},

			click_shelf: function (el) {
				const itemId = el.dataset.gwfItemId || null;
				const itemName = el.dataset.gwfItemName || null;
				const itemPrice = parseFloat(el.dataset.gwfItemPrice) || null;
				const itemPosition = parseInt(el.dataset.gwfItemPosition, 10) || null;
				events.push_clickShelf(itemId, itemName, itemPrice, itemPosition);
			}

		};

		// Listener único para todos os elementos rastreáveis
		// Identifica o tipo de evento via atributo data-gwf-event
		document.querySelectorAll('[data-gwf-event]').forEach(function (el) {
			el.addEventListener('click', function (e) {
				// Verifica se o clique originou em um elemento filho
				// que também tem data-gwf-event — se sim, ignora
				// para evitar duplo disparo em elementos aninhados
				const clickedElement = e.target.closest('[data-gwf-event]');
				if (clickedElement !== e.currentTarget) return;

				e.stopPropagation();

				const eventType = e.currentTarget.dataset.gwfEvent;

				if (eventHandlers[eventType]) {
					eventHandlers[eventType](e.currentTarget);
				} else {
					console.warn('[GWF DataLayer] Tipo de evento não mapeado:', eventType);
				}
			});
		});

		console.log(
			'[GWF DataLayer] handleActionsDOM inicializado —',
			document.querySelectorAll('[data-gwf-event]').length,
			'elemento(s) rastreável(is) registrado(s)'
		);
	};

	// ============================================================================
	// AUTO-INICIALIZAÇÃO
	// ============================================================================

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', function () {
			console.log('[GWF DataLayer] Initializing on DOMContentLoaded');
			window.gwfDataLayer.utils.resetDataLayerGWF();
			window.gwfDataLayer.context.setContext();
			window.gwfDataLayer.handleActionsDOM();
		});
	} else {
		console.log('[GWF DataLayer] Initializing immediately (DOM already ready)');
		window.gwfDataLayer.utils.resetDataLayerGWF();
		window.gwfDataLayer.context.setContext();
		window.gwfDataLayer.handleActionsDOM();
	}

	console.log('[GWF DataLayer] gwfDataLayer initialized and ready');

})(); // Fim IIFE