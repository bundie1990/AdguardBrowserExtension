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

(function (adguard, api) {
    const ATTRIBUTE_START_MARK = '[';
    const ATTRIBUTE_END_MARK = ']';
    const QUOTES = '"';
    const TAG_CONTENT_MASK = 'tag-content';
    const WILDCARD_MASK = 'wildcard';
    const TAG_CONTENT_MAX_LENGTH = 'max-length';
    const TAG_CONTENT_MIN_LENGTH = 'min-length';
    const PARENT_ELEMENTS = 'parent-elements';
    const PARENT_SEARCH_LEVEL = 'parent-search-level';
    const DEFAULT_PARENT_SEARCH_LEVEL = 3;

    function Wildcard(pattern) {
        /**
         * Converts wildcard to regular expression
         *
         * @param pattern The wildcard pattern to convert
         * @return A regex equivalent of the given wildcard
         */
        function wildcardToRegex(pattern) {
            const specials = [
                '\\', '*', '+', '?', '|', '{', '}', '[', ']', '(', ')', '^', '$', '.', '#',
            ];
            const specialsRegex = new RegExp(`[${specials.join('\\')}]`, 'g');
            pattern = pattern.replace(specialsRegex, '\\$&');

            pattern = adguard.utils.strings.replaceAll(pattern, '\\*', '[\\s\\S]*');
            pattern = adguard.utils.strings.replaceAll(pattern, '\\?', '.');
            return `^${pattern}$`;
        }

        /**
         * Extracts longest string that does not contain * or ? symbols.
         *
         * @param pattern Wildcard pattern
         * @return Longest string without special symbols
         */
        function extractShortcut(pattern) {
            const wildcardChars = ['*', '?'];
            let startIndex = 0;
            let endIndex = adguard.utils.strings.indexOfAny(pattern, wildcardChars);

            if (endIndex < 0) {
                return pattern.toLowerCase();
            }

            let shortcut = endIndex === startIndex ? '' : pattern.substring(startIndex, endIndex - startIndex);

            while (endIndex >= 0) {
                startIndex = startIndex + endIndex + 1;
                if (pattern.length <= startIndex) {
                    break;
                }

                endIndex = adguard.utils.strings.indexOfAny(pattern.substring(startIndex), wildcardChars);
                const tmpShortcut = endIndex < 0
                    ? pattern.substring(startIndex)
                    : pattern.substring(startIndex, endIndex + startIndex);

                if (tmpShortcut.length > shortcut.length) {
                    shortcut = tmpShortcut;
                }
            }

            return shortcut.toLowerCase();
        }

        this.regexp = new RegExp(wildcardToRegex(pattern), 'i');
        this.shortcut = extractShortcut(pattern);

        /**
         * Returns 'true' if input text is matching wildcard.
         * This method first checking shortcut -- if shortcut exists in input string -- than it checks regexp.
         *
         * @param input Input string
         * @return true if input string matches wildcard
         */
        this.matches = function (input) {
            if (!input) {
                return false;
            }

            if (input.toLowerCase().indexOf(this.shortcut) < 0) {
                return false;
            }

            return this.regexp.test(input);
        };
    }

    function getQuoteIndex(text, startIndex) {
        let nextChar = '"';
        let quoteIndex = startIndex - 2;

        while (nextChar === '"') {
            quoteIndex = text.indexOf(QUOTES, quoteIndex + 2);
            if (quoteIndex === -1) {
                return -1;
            }
            nextChar = text.length === (quoteIndex + 1) ? '0' : text.charAt(quoteIndex + 1);
        }

        return quoteIndex;
    }

    /**
     * Creates an instance of the ContentFilterRule from its text format
     */
    const ContentFilterRule = function (ruleText, filterId) {
        api.FilterRule.call(this, ruleText, filterId);

        this.parentSearchLevel = DEFAULT_PARENT_SEARCH_LEVEL;
        this.maxLength = 8192;

        let mask = api.FilterRule.MASK_CONTENT_EXCEPTION_RULE;
        let indexOfMask = ruleText.indexOf(mask);
        if (indexOfMask >= 0) {
            this.whiteListRule = true;
        } else {
            mask = api.FilterRule.MASK_CONTENT_RULE;
            indexOfMask = ruleText.indexOf(mask);
        }

        if (indexOfMask < 0) {
            throw Error(`Invalid rule ${ruleText}`);
        }

        this.elementsFilter = ruleText.substring(indexOfMask + mask.length);
        let ruleStartIndex = ruleText.indexOf(ATTRIBUTE_START_MARK);

        // Cutting tag name from string
        if (ruleStartIndex === -1) {
            this.tagName = ruleText.substring(indexOfMask + mask.length);
        } else {
            this.tagName = ruleText.substring(indexOfMask + mask.length, ruleStartIndex);
        }

        // Loading domains (if any))
        if (indexOfMask > 0) {
            const domains = ruleText.substring(0, indexOfMask);
            this.loadDomains(domains);
        }

        if (!this.whiteListRule && this.isGeneric()) {
            throw Error('Content rule must have at least one permitted domain');
        }

        const selector = [this.tagName];

        // Loading attributes filter
        while (ruleStartIndex !== -1) {
            const equalityIndex = ruleText.indexOf(api.FilterRule.EQUAL, ruleStartIndex + 1);
            const quoteStartIndex = ruleText.indexOf(QUOTES, equalityIndex + 1);
            const quoteEndIndex = getQuoteIndex(ruleText, quoteStartIndex + 1);
            if (quoteStartIndex === -1 || quoteEndIndex === -1) {
                break;
            }
            const ruleEndIndex = ruleText.indexOf(ATTRIBUTE_END_MARK, quoteEndIndex + 1);

            const attributeName = ruleText.substring(ruleStartIndex + 1, equalityIndex);
            let attributeValue = ruleText.substring(quoteStartIndex + 1, quoteEndIndex);
            attributeValue = adguard.utils.strings.replaceAll(attributeValue, '""', '"');

            switch (attributeName) {
                case TAG_CONTENT_MASK:
                    this.tagContentFilter = attributeValue;
                    break;
                case WILDCARD_MASK:
                    this.wildcard = new Wildcard(attributeValue);
                    break;
                case TAG_CONTENT_MAX_LENGTH:
                    this.maxLength = parseInt(attributeValue, 10);
                    break;
                case TAG_CONTENT_MIN_LENGTH:
                    this.minLength = parseInt(attributeValue, 10);
                    break;
                case PARENT_ELEMENTS:
                    this.parentElements = attributeValue.split(',');
                    break;
                case PARENT_SEARCH_LEVEL:
                    this.parentSearchLevel = parseInt(attributeValue, 10);
                    break;
                default:
                    selector.push('[');
                    selector.push(attributeName);
                    selector.push('*="');
                    selector.push(attributeValue);
                    selector.push('"]');
                    break;
            }

            if (ruleEndIndex === -1) {
                break;
            }
            ruleStartIndex = ruleText.indexOf(ATTRIBUTE_START_MARK, ruleEndIndex + 1);
        }

        this.selector = selector.join('');

        // Validates selector immediately
        window.document.querySelectorAll(this.selector);
    };

    ContentFilterRule.prototype = Object.create(api.FilterRule.prototype);

    ContentFilterRule.prototype.getMatchedElements = function (document) {
        const elements = document.querySelectorAll(this.selector);

        let result = null;

        for (let i = 0; i < elements.length; i += 1) {
            const element = elements[i];

            let elementToDelete = null;

            if (this.isFiltered(element)) {
                if (this.parentElements) {
                    const parentElement = this.searchForParentElement(element);
                    if (parentElement) {
                        elementToDelete = parentElement;
                    }
                } else {
                    elementToDelete = element;
                }

                if (elementToDelete) {
                    if (result === null) {
                        result = [];
                    }
                    result.push(element);
                }
            }
        }

        return result;
    };

    /**
     * Checks if HtmlElement is filtered by this content filter.
     *
     * @param element Evaluated element
     * @return true if element should be filtered
     */
    ContentFilterRule.prototype.isFiltered = function (element) {
        // Checking tag content length limits
        const content = element.innerHTML || '';
        if (this.maxLength > 0) {
            // If max-length is set - checking content length (it should be lesser than max length)
            if (content.length > this.maxLength) {
                return false;
            }
        }

        if (this.minLength > 0) {
            // If min-length is set - checking content length (it should be greater than min length)
            if (content.length < this.minLength) {
                return false;
            }
        }

        if (!this.tagContentFilter && !this.wildcard) {
            // Rule does not depend on content
            return true;
        }

        if (!content) {
            return false;
        }

        // Checking tag content against filter
        if (this.tagContentFilter && content.indexOf(this.tagContentFilter) < 0) {
            return false;
        }

        // Checking tag content against the wildcard
        if (this.wildcard && !this.wildcard.matches(content)) {
            return false;
        }

        // All filters are passed, tag is filtered
        return true;
    };

    /**
     * Searches for parent element to delete.
     * Suitable parent elements are set by 'parent-elements' attribute.
     * If suitable element found - returns it. Otherwise - returns null.
     *
     * @param element Element evaluated against this rule
     * @return Parent element to be deleted
     */
    ContentFilterRule.prototype.searchForParentElement = function (element) {
        if (!this.parentElements || this.parentElements.length === 0) {
            return null;
        }

        let parentElement = element.parentNode;

        for (let i = 0; i < this.parentSearchLevel; i += 1) {
            if (!parentElement) {
                return null;
            }
            if (this.parentElements.indexOf(parentElement.tagName.toLowerCase()) > 0) {
                return parentElement;
            }
            parentElement = parentElement.parentNode;
        }

        return null;
    };

    /**
     * All content rules markers start with this character
     */
    ContentFilterRule.RULE_MARKER_FIRST_CHAR = '$';

    /**
     * Content rule markers
     */
    ContentFilterRule.RULE_MARKERS = [
        api.FilterRule.MASK_CONTENT_EXCEPTION_RULE,
        api.FilterRule.MASK_CONTENT_RULE,
    ];

    api.ContentFilterRule = ContentFilterRule;
    api.Wildcard = Wildcard;
})(adguard, adguard.rules);
