import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { configurationError } from './lib/api';
import { Brand, ErrorMessage } from './components/ui';
import './styles.css';
createRoot(document.getElementById('root')!).render(<StrictMode>{configurationError ? <main className="not-found"><Brand/><h1>Workspace setup is incomplete.</h1><div style={{ maxWidth: 560 }}><ErrorMessage message={configurationError}/></div><p>Ask the site owner to finish the Supabase configuration.</p></main> : <BrowserRouter><App/></BrowserRouter>}</StrictMode>);
