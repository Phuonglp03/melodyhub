import 'antd/dist/reset.css';
import 'bootstrap/dist/css/bootstrap.min.css';
import React from 'react';
import { Provider } from 'react-redux';
import { ConfigProvider } from 'antd';
import { store, persistor } from './redux/store';
import AppRoutes from './routes/appRoutes';
import { PersistGate } from 'redux-persist/integration/react';
import TokenManager from './components/TokenManager';

const App = () => (
  <Provider store={store}>
    <PersistGate loading={null} persistor={persistor}>
      <TokenManager>
        <ConfigProvider theme={{ token: { colorPrimary: '#1890ff' } }}>
          <AppRoutes />
        </ConfigProvider>
      </TokenManager>
    </PersistGate>
  </Provider>
);

export default App;
