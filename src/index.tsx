/* @refresh reload */
import { render } from 'solid-js/web';
import { Router } from '@solidjs/router';
import './styles/base.css';
import './styles/app.css';
import { routes } from './App';

const root = document.getElementById('root');
render(() => <Router>{routes}</Router>, root!);
