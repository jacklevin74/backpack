import './shim';
import { AppRegistry } from 'react-native';
import DemoApp from './src/DemoApp';
import { name as appName } from './app.json';

AppRegistry.registerComponent(appName, () => DemoApp);
