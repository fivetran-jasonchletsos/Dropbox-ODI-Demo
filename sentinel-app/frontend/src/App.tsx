import { Routes, Route, useLocation } from 'react-router-dom';
import Layout from './components/Layout';
import HomePage from './pages/HomePage';
import InstitutionsPage from './pages/InstitutionsPage';
import InstitutionDetailPage from './pages/InstitutionDetailPage';
import StateRiskPage from './pages/StateRiskPage';
import CatalogPage from './pages/CatalogPage';
import PipelinePage from './pages/PipelinePage';
import ArchitecturePage from './pages/ArchitecturePage';
import WatchlistPage from './pages/WatchlistPage';
import AboutPage from './pages/AboutPage';

export default function App() {
  const loc = useLocation();
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Keyed pathname={loc.pathname}><HomePage /></Keyed>} />
        <Route path="/institutions" element={<Keyed pathname={loc.pathname}><InstitutionsPage /></Keyed>} />
        <Route path="/institutions/:certId" element={<Keyed pathname={loc.pathname}><InstitutionDetailPage /></Keyed>} />
        <Route path="/states" element={<Keyed pathname={loc.pathname}><StateRiskPage /></Keyed>} />
        <Route path="/catalog" element={<Keyed pathname={loc.pathname}><CatalogPage /></Keyed>} />
        <Route path="/pipeline" element={<Keyed pathname={loc.pathname}><PipelinePage /></Keyed>} />
        <Route path="/architecture" element={<Keyed pathname={loc.pathname}><ArchitecturePage /></Keyed>} />
        <Route path="/watchlist" element={<Keyed pathname={loc.pathname}><WatchlistPage /></Keyed>} />
        <Route path="/about" element={<Keyed pathname={loc.pathname}><AboutPage /></Keyed>} />
        <Route path="*" element={<div className="p-12 text-slate-400">Not found.</div>} />
      </Route>
    </Routes>
  );
}

function Keyed({ pathname, children }: { pathname: string; children: React.ReactNode }) {
  return <div key={pathname} className="fade-in">{children}</div>;
}
