import { lazy } from 'solid-js';
import type { RouteDefinition } from '@solidjs/router';
import { AppShell } from './components/AppShell';

const Home = lazy(() => import('./routes/Home'));
const Search = lazy(() => import('./routes/Search'));
const Article = lazy(() => import('./routes/Article'));
const RabbitHole = lazy(() => import('./routes/RabbitHole'));
const Collections = lazy(() => import('./routes/Collections'));
const Blog = lazy(() => import('./routes/Blog'));
const BlogArticle = lazy(() => import('./routes/BlogArticle'));
const NotFound = lazy(() => import('./routes/NotFound'));

export const routes: RouteDefinition[] = [
  {
    path: '/',
    component: AppShell,
    children: [
      { path: '/', component: Home },
      { path: '/search', component: Search },
      { path: '/wiki/:title', component: Article },
      { path: '/path', component: RabbitHole },
      { path: '/collections', component: Collections },
      { path: '/blog', component: Blog },
      { path: '/blog/:slug', component: BlogArticle },
      { path: '*', component: NotFound },
    ],
  },
];
