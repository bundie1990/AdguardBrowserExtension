// TODO fix
//  remove all 'use strict' comments
//  make tests working
//  remove code related to the old edge
//  remove integration mode
//  replace third party with modules

// Third party libraries
import './libs/deferred'; // TODO replace with async/await
import './filter/rules/scriptlets/redirects'; // TODO use import/export
import './filter/rules/scriptlets/scriptlets'; // TODO use import/export
import './libs/filter-downloader'; // TODO fix import/export issues

// Adguard Global and preferences
import './adguard';
import './prefs';

// Utils libraries
import './utils/common';
import './utils/log';
import './utils/public-suffixes';
import './utils/url';
import './utils/notifier';
import './utils/browser-utils';
import './utils/service-client';
import './utils/user-settings';
import './utils/notifications';
import './utils/frames';
import './utils/cookie';
import './utils/expiring-cache';

// Local storage and rules storage libraries
import './utils/local-storage';
// TODO setup rules-storage api for different browsers
import './utils/rules-storage';
import './storage';

// Chromium api adapter libraries
// TODO find better place for this library
import './api/common-script';
import './api/background-page';

// Tabs api library
import './api/tabs';
import './api/tabs-api';

// Rules and filters libraries
import './filter/rules/rules'; // TODO remove after moving to the es6 modules
import './filter/rules/local-script-rules';
import './filter/rules/shortcuts-lookup-table';
import './filter/rules/domains-lookup-table';
import './filter/rules/url-filter-lookup-table';
import './filter/rules/simple-regex';
import './filter/rules/base-filter-rule';
import './filter/rules/css-filter-rule';
import './filter/rules/css-filter';
import './filter/rules/script-filter-rule';
import './filter/rules/script-filter';
import './filter/rules/url-filter-rule';
import './filter/rules/url-filter';
import './filter/rules/content-filter-rule';
import './filter/rules/content-filter';
import './filter/rules/csp-filter';
import './filter/rules/cookie-filter';
import './filter/rules/redirect-filter';
import './filter/rules/replace-filter';
import './filter/rules/filter-rule-builder';
import './filter/rules/scriptlet-rule';
import './filter/rules/composite-rule';

// Filters metadata and filtration modules
import './filter/subscription';
import './filter/update-service';
import './filter/whitelist';
import './filter/userrules';
import './filter/filters';
import './filter/antibanner';
import './filter/request-blocking';
import './filter/cookie-filtering';
import './filter/request-context-storage';
import './filter/filters-tags';
import './filter/filters-categories';
import './filter/rule-converter';
import './utils/page-stats';


// Various modules for safebrowsing, logging, integration, ui and etc
import './filter/safebrowsing-filter';
import './filter/document-filter';
import './filter/filters-hit';
import './filter/locale-detect';
import './filter/integration';
import './filter/filtering-log';
import './ui-service';

// Content messaging
import './content-message-handler';

// Stealth
import './stealth';

// Sync settings
import './settings-provider';

// Init
import './startup';
import './start';
import './webrequest';
