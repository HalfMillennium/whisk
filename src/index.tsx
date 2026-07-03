/* @refresh reload */
import { render } from 'solid-js/web';
import { Router } from '@solidjs/router';
import { inject } from '@vercel/analytics';
import './styles/base.css';
import './styles/app.css';
import { routes } from './App';

// Vercel Web Analytics. No Solid-specific entry exists, so we use the
// framework-agnostic injector; it auto-tracks page views from the router's
// pushState navigations. Gated to production so local dev isn't counted.
inject({ mode: import.meta.env.PROD ? 'production' : 'development' });

const root = document.getElementById('root');
render(() => <Router>{routes}</Router>, root!);
