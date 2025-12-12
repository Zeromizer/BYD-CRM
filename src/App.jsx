import { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout/Layout';
import { ToastProvider } from './components/Toast/Toast';
import './styles/animations.css';
import './App.css';

// Lazy load route components for code splitting
const Dashboard = lazy(() => import('./components/Dashboard/Dashboard'));
const DocumentManager = lazy(() => import('./components/Documents/DocumentManager/DocumentManager'));
const ExcelIntegration = lazy(() => import('./components/ExcelIntegration/ExcelIntegration'));
const CustomerAssistant = lazy(() => import('./components/CustomerAssistant/CustomerAssistant'));

// Loading fallback component
const PageLoader = () => (
  <div className="page-loader">
    <div className="loader-spinner"></div>
    <p>Loading...</p>
  </div>
);

function App() {
  return (
    <ToastProvider>
      <Router basename="/BYD-CRM">
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/" element={<Layout />}>
              <Route index element={<Dashboard />} />
              <Route path="assistant" element={<CustomerAssistant />} />
              <Route path="documents" element={<DocumentManager />} />
              <Route path="excel" element={<ExcelIntegration />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </Suspense>
      </Router>
    </ToastProvider>
  );
}

export default App;
