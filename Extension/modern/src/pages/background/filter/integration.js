/**
 * This file is part of Adguard Browser Extension (https://github.com/AdguardTeam/AdguardBrowserExtension).
 *
 * Adguard Browser Extension is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Lesser General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * Adguard Browser Extension is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * along with Adguard Browser Extension.  If not, see <http://www.gnu.org/licenses/>.
 */

/**
 * adguard.integration is used for integration of Adguard extension and Adguard for Windows/Mac/Android versions.
 */
adguard.integration = (function (adguard) {
    /**
     * Looking for this header in HTTP response.
     * If this header is present - request is filtered by Adguard for Windows/Mac/Android
     */
    const ADGUARD_APP_HEADER = 'X-Adguard-Filtered';

    /**
     * X-Adguard-Rule header contains the rule which was applied to the HTTP request
     * If no rule applied - header won't be present in the response.
     */
    const ADGUARD_RULE_HEADER = 'X-Adguard-Rule';

    /**
     * Full mode means that extension can manage filtering status of the website.
     * That also means that Adguard returns X-Adguard-Rule header (older version can't do it)
     * Possible with Adguard 5.10.1180+
     */
    const INTEGRATION_MODE_FULL = 'FULL';

    /**
     * Adguard 5.10+. Extension cannot manage filtering status (only element blocking)
     */
    const INTEGRATION_MODE_DEFAULT = 'DEFAULT';

    /**
     * Older versions of Adguard. The only difference from default mode is API location
     */
    const INTEGRATION_MODE_OLD = 'OLD';

    /**
     * Detected adguard product name and version
     */
    let adguardProductName = null;
    let adguardAppVersion = null;

    let integrationMode = INTEGRATION_MODE_FULL;

    let integrationModeForceDisabled = false;
    let integrationModeLastCheckTime = 0;
    const INTEGRATION_CHECK_PERIOD_MS = 30 * 60 * 1000; // 30 minutes

    /**
     * https://github.com/AdguardTeam/AdguardBrowserExtension/issues/963
     */
    function reCheckIntegrationMode() {
        if (Date.now() - integrationModeLastCheckTime > INTEGRATION_CHECK_PERIOD_MS) {
            integrationModeLastCheckTime = Date.now();

            // Sending request that should be intercepted by the Adguard App
            adguard.backend.getResponseHeaders(`${adguard.backend.injectionsUrl}/generate_204`, (headers) => {
                if (headers === null) {
                    // Unable to retrieve response
                    integrationModeForceDisabled = false;
                    return;
                }
                const adguardAppHeaderValue = adguard.utils.browser.getHeaderValueByName(headers, ADGUARD_APP_HEADER);
                // Unable to find X-Adguard-Filtered header
                integrationModeForceDisabled = !adguardAppHeaderValue;
            });
        }
    }

    /**
     * Parses Adguard version from X-Adguard-Filtered header
     *
     * @param header Header value
     * @returns {{adguardProductName: null, adguardAppVersion: null, integrationMode: null}}
     * @private
     */
    function parseAppHeader(header) {
        const result = {
            adguardProductName: null,
            adguardAppVersion: null,
            integrationMode: null,
        };
        if (/([a-z\s]+);\s+version=([a-z0-9.-]+)/i.test(header)) {
            // new version of adguard
            const productName = RegExp.$1;
            // header is either Adguard for Mac or Adguard for Windows
            // depending on it we use localized product name
            if (adguard.utils.strings.containsIgnoreCase(productName, 'mac')) {
                result.adguardProductName = adguard.i18n.getMessage('adguard_product_mac');
            } else {
                result.adguardProductName = adguard.i18n.getMessage('adguard_product_windows');
            }
            result.adguardAppVersion = RegExp.$2;
            result.integrationMode = INTEGRATION_MODE_FULL;
        } else {
            if (/Adguard\s+(\d\.\d)/.test(header)) {
                result.adguardAppVersion = RegExp.$1;
            }
            if (result.adguardAppVersion === '5.8') {
                result.integrationMode = INTEGRATION_MODE_OLD;
            } else {
                result.integrationMode = INTEGRATION_MODE_DEFAULT;
            }
        }
        return result;
    }

    /**
     * Parses rule and filterId from X-Adguard-Rule header
     * @param header Header value
     * @private
     */
    function createRuleFromHeader(header) {
        const parts = header.split('; ');
        const headerInfo = Object.create(null);
        for (let i = 0; i < parts.length; i += 1) {
            const keyAndValue = parts[i].split('=');
            headerInfo[keyAndValue[0]] = decodeURIComponent(keyAndValue[1]);
        }

        return adguard.rules.builder.createRule(headerInfo.rule, headerInfo.filterId - 0);
    }

    /**
     * Parses Adguard version from X-Adguard-Rule header
     *
     * @param header Header value
     * @param tabUrl Tab Url
     * @returns {{documentWhiteListed: boolean, userWhiteListed: boolean, headerRule: null}}
     * @private
     */
    function parseRuleHeader(header, tabUrl) {
        const ruleInfo = {
            documentWhiteListed: false,
            userWhiteListed: false,
            headerRule: null,
        };
        if (!header) {
            return ruleInfo;
        }

        const rule = createRuleFromHeader(header);
        if (rule && rule.whiteListRule
            && rule instanceof adguard.rules.UrlFilterRule
            && rule.isFiltered(tabUrl, false, adguard.RequestTypes.DOCUMENT)
            && rule.isDocumentWhiteList()) {
            ruleInfo.headerRule = rule;
            ruleInfo.documentWhiteListed = true;
            ruleInfo.userWhiteListed = rule.filterId === adguard.utils.filters.USER_FILTER_ID;
        }

        return ruleInfo;
    }

    /**
     * Detects Adguard for Windows/Mac/Android
     * Checks if X-Adguard-Filtered header is present
     *
     * @param tab       Tab data
     * @param headers   Response headers
     * @param frameUrl  Frame url
     */
    const checkHeaders = function (tab, headers, frameUrl) {
        // Check for X-Adguard-Filtered header
        const adguardAppHeaderValue = adguard.utils.browser.getHeaderValueByName(headers, ADGUARD_APP_HEADER);
        if (!adguardAppHeaderValue) {
            // No X-Adguard-Filtered header, disable integration mode for this tab
            adguard.frames.recordAdguardIntegrationForTab(tab, false, false, false, null, null, false);
            return;
        }

        // Re-check integration status to prevent attack by the script, that adds X-Adguard-Filtered header
        reCheckIntegrationMode();

        // Set adguard detected in frame
        const appInfo = parseAppHeader(adguardAppHeaderValue);

        adguardProductName = appInfo.adguardProductName;
        adguardAppVersion = appInfo.adguardAppVersion;
        integrationMode = appInfo.integrationMode;

        const isFullIntegrationMode = integrationMode === INTEGRATION_MODE_FULL;

        // Check for white list rule in frame
        let ruleInfo = Object.create(null);
        if (isFullIntegrationMode) {
            const adguardRuleHeaderValue = adguard.utils.browser.getHeaderValueByName(headers, ADGUARD_RULE_HEADER);
            ruleInfo = parseRuleHeader(adguardRuleHeaderValue, frameUrl);
        }

        // Save integration info to framesMap
        const adguardRemoveRuleNotSupported = !isFullIntegrationMode;
        adguard.frames.recordAdguardIntegrationForTab(
            tab,
            true,
            ruleInfo.documentWhiteListed,
            ruleInfo.userWhiteListed,
            ruleInfo.headerRule,
            appInfo.adguardProductName,
            adguardRemoveRuleNotSupported
        );

        adguard.settings.changeShowInfoAboutAdguardFullVersion(false);
    };

    /**
     * Parse X-Adguard-Rule and returns request rule (if present)
     * @param headers
     */
    const parseAdguardRuleFromHeaders = function (headers) {
        const header = adguard.utils.browser.findHeaderByName(headers, ADGUARD_RULE_HEADER);
        if (header) {
            return createRuleFromHeader(header.value);
        }
        return null;
    };

    /**
     * Adds rule to User Filter
     *
     * @param ruleText  Rule text
     * @param callback  Finish callback
     */
    const addRuleToApp = function (ruleText, callback) {
        switch (integrationMode) {
            case INTEGRATION_MODE_OLD:
                adguard.backend.adguardAppAddRuleOld(ruleText, callback, callback);
                break;
            default:
                adguard.backend.adguardAppAddRule(ruleText, callback, callback);
                break;
        }
    };

    /**
     * Removes specified rule from User Filter
     *
     * @param ruleText  Rule text
     * @param callback  Finish callback
     */
    const removeRuleFromApp = function (ruleText, callback) {
        adguard.backend.adguardAppRemoveRule(ruleText, callback, callback);
    };

    /**
     * If page URL is whitelisted in desktop Adguard, we should forcibly set Referer header value to this page URL.
     * The problem is that standalone Adguard looks at the page referrer to check if it should bypass
     * this request or not.
     * Also there's an issue with Opera browser, it misses referrer for some requests.
     *
     * @param tab Tab
     */
    const shouldOverrideReferrer = function (tab) {
        return adguard.frames.isTabAdguardWhiteListed(tab);
    };

    /**
     * Checks if request is for AG desktop app to intercept
     * @param url request URL
     */
    const isIntegrationRequest = function (url) {
        return url && url.indexOf(adguard.backend.adguardAppUrl) === 0;
    };

    /**
     * Gets base url for requests to desktop AG
     */
    const getIntegrationBaseUrl = function () {
        return adguard.backend.adguardAppUrl;
    };

    /**
     * Gets headers used to authorize request to desktop AG
     * In our case we set Referer header. It can't be forget by the webpage so it's enough.
     */
    const getAuthorizationHeaders = function () {
        return [{
            name: 'Referer',
            value: adguard.backend.injectionsUrl,
        }];
    };

    return {

        checkHeaders,
        parseAdguardRuleFromHeaders,

        addRuleToApp,
        removeRuleFromApp,
        isIntegrationRequest,
        getAuthorizationHeaders,

        shouldOverrideReferrer,
        getIntegrationBaseUrl,

        /**
         * In some cases we have to force disable integration mode
         * See `reCheckIntegrationMode` for details
         * @returns {boolean}
         */
        isEnabled() {
            return adguard.settings.isIntegrationModeEnabled() && !integrationModeForceDisabled;
        },

        /**
         * In simple api integration module may be missed
         * @returns {boolean}
         */
        isSupported() {
            return true;
        },
    };
})(adguard);
