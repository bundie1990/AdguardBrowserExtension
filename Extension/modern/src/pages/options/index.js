import React from 'react';
import ReactDOM from 'react-dom';
import { Provider } from 'mobx-react';
import App from './components/App';
import i18n from '../../services/i18n';

import 'mobx-react/batchingForReactDom';

document.title = i18n.translate('options_settings');

// TODO
//  1. remove service information from svg icons
//  2. all components should be functional
//  3. remove legacy options page, and associated files
ReactDOM.render(
    <Provider>
        <App />
    </Provider>,
    document.getElementById('root'),
);
